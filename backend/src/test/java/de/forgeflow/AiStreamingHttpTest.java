package de.forgeflow;

import java.io.InputStream;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import reactor.core.publisher.Flux;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.ai.AiModelGateway;
import de.forgeflow.auth.Accounts;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Actual Tomcat/HTTP sockets: MockMvc cannot verify disconnect callbacks or response flushing.
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.RANDOM_PORT, properties={
    "forgeflow.ai.enabled=true", "forgeflow.ai.api-key=test-only-key", "forgeflow.ai.model=test-only-model",
    "forgeflow.ai.timeout=10s", "forgeflow.origin=http://localhost:5173", "server.servlet.session.cookie.secure=false",
    "forgeflow.user.email=stream-admin@example.test", "logging.level.root=WARN"})
@ActiveProfiles("memory")
class AiStreamingHttpTest {
    private static final String PASSWORD = "Only-for-tests-12345";
    private static final String HASH = new BCryptPasswordEncoder(10).encode(PASSWORD);
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) { registry.add("forgeflow.user.password-hash", () -> HASH); }
    @LocalServerPort int port;
    @Autowired Accounts accounts;
    @Autowired JsonMapper json;
    @MockitoBean AiModelGateway model;
    protected HttpRequest.Builder request(String path) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/api/v1" + path))
            .timeout(Duration.ofSeconds(5)).header("Origin", "http://localhost:5173").header("Content-Type", "application/json");
    }
    protected record Session(HttpClient client, String csrf, String conversation) implements AutoCloseable {
        @Override public void close() { client.close(); }
    }
    protected Session session() throws Exception {
        String user = UUID.randomUUID().toString(); String email = user + "@example.test";
        accounts.insert(new Accounts.User(user, email, "Test", HASH, false, true, 0));
        var client = HttpClient.newBuilder().cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ALL)).build();
        var csrf = client.send(request("/auth/csrf").GET().build(), HttpResponse.BodyHandlers.ofString());
        String token = json.readTree(csrf.body()).get("csrfToken").stringValue();
        var login = client.send(request("/auth/login").header("X-CSRF-Token", token)
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(java.util.Map.of("email", email, "password", PASSWORD)))).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(login.statusCode()).isEqualTo(200);
        token = json.readTree(login.body()).get("csrfToken").stringValue();
        var conversation = client.send(request("/ai/conversations").header("X-CSRF-Token", token)
            .POST(HttpRequest.BodyPublishers.ofString("{\"language\":\"de\"}")).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(conversation.statusCode()).isEqualTo(201);
        return new Session(client, token, json.readTree(conversation.body()).get("id").stringValue());
    }
    private HttpResponse<InputStream> start(Session session, UUID requestId) throws Exception {
        var result = session.client.send(request("/ai/conversations/" + session.conversation + "/messages/stream").header("X-CSRF-Token", session.csrf)
            .header("Accept", "text/event-stream, application/json").POST(HttpRequest.BodyPublishers.ofString(
                json.writeValueAsString(java.util.Map.of("requestId", requestId, "message", "Hallo")))).build(), HttpResponse.BodyHandlers.ofInputStream());
        assertThat(result.statusCode()).isEqualTo(200);
        assertThat(result.headers().firstValue("X-Accel-Buffering")).contains("no");
        // A ready event must flush before the model produces any output.
        assertThat(new String(result.body().readNBytes(11), java.nio.charset.StandardCharsets.UTF_8)).isEqualTo("event:ready");
        return result;
    }
    @Test void explicitCancellationStopsTheProviderAndTheHttpResponseWithoutPersistingPartialMessages() throws Exception {
        var subscribed = new CountDownLatch(1); var cancelled = new CountDownLatch(1);
        when(model.stream(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(Flux.<AiModelGateway.Chunk>never()
            .doOnSubscribe(value -> subscribed.countDown()).doOnCancel(cancelled::countDown));
        try (var session = session()) {
            var requestId = UUID.randomUUID(); var result = start(session, requestId);
            assertThat(subscribed.await(2, TimeUnit.SECONDS)).isTrue();
            var concurrent = session.client.send(request("/ai/conversations/" + session.conversation + "/messages/stream")
                .header("X-CSRF-Token", session.csrf).header("Accept", "text/event-stream, application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "Again")))).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(concurrent.statusCode()).isEqualTo(409);
            assertThat(json.readTree(concurrent.body()).get("error").get("code").stringValue()).isEqualTo("AI_CONVERSATION_BUSY");
            var stopped = session.client.send(request("/ai/conversations/" + session.conversation + "/requests/" + requestId + "/cancel")
                .header("X-CSRF-Token", session.csrf).POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(stopped.statusCode()).isEqualTo(204); assertThat(cancelled.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(new String(result.body().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)).contains("event:cancelled");
            var history = session.client.send(request("/ai/conversations/" + session.conversation).GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(json.readTree(history.body()).get("messages").size()).isZero();
        }
    }
    @Test void closingTheBrowserConnectionStopsAnIdleProviderOnTheNextHeartbeat() throws Exception {
        var cancelled = new CountDownLatch(1);
        when(model.stream(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(Flux.<AiModelGateway.Chunk>never().doOnCancel(cancelled::countDown));
        try (var session = session()) {
            var result = start(session, UUID.randomUUID()); result.body().close();
            assertThat(cancelled.await(4, TimeUnit.SECONDS)).isTrue();
        }
    }
    @Test void logoutIsDetectedWithoutRequiringAnotherProviderChunk() throws Exception {
        var cancelled = new CountDownLatch(1);
        when(model.stream(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(Flux.<AiModelGateway.Chunk>never().doOnCancel(cancelled::countDown));
        try (var session = session()) {
            var result = start(session, UUID.randomUUID());
            var logout = session.client.send(request("/auth/logout").header("X-CSRF-Token", session.csrf)
                .POST(HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(logout.statusCode()).isEqualTo(204);
            assertThat(cancelled.await(3, TimeUnit.SECONDS)).isTrue();
            assertThat(new String(result.body().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8)).contains("event:error", "UNAUTHENTICATED");
        }
    }
}
