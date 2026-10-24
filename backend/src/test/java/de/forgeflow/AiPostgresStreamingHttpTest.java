package de.forgeflow;

import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import de.forgeflow.ai.AgentDtos.SendMessage;
import de.forgeflow.ai.AiModelGateway;
import de.forgeflow.ai.ConversationStore;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Actual Tomcat sockets plus JPA: cancellation, disconnect and logout tests are inherited. */
@ActiveProfiles(value="postgres", inheritProfiles=false)
class AiPostgresStreamingHttpTest extends AiStreamingHttpTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) { AiTestDatabase.configure(registry, "ai-sse-"); }
    @Autowired ConversationStore conversations;
    @Autowired DataSource datasource;

    @Test @EnabledIfSystemProperty(named="forgeflow.performance", matches="true")
    void measureAuthenticatedHistoryReadsWithoutProviderRequests() throws Exception {
        try (var session = session()) {
            var profile = session.client().send(request("/auth/session").GET().build(), HttpResponse.BodyHandlers.ofString());
            String owner = json.readTree(profile.body()).get("user").get("id").stringValue();
            // Maximum default conversation count, ten complete turns each; latest chat also has 50 run records.
            var ids = new ArrayList<UUID>(); ids.add(UUID.fromString(session.conversation()));
            for (int index = 1; index < 10; index++) ids.add(conversations.create(owner, "de").id());
            for (int run = 0; run < 40; run++) {
                var pending = conversations.begin(owner, ids.getFirst(), new SendMessage(UUID.randomUUID(), "Synthetic cancelled run"));
                conversations.abort(pending, "cancelled", "AI_CANCELLED");
            }
            for (var id : ids) for (int turn = 0; turn < 10; turn++) {
                var pending = conversations.begin(owner, id, new SendMessage(UUID.randomUUID(), "Synthetic benchmark question " + turn));
                conversations.complete(pending, new AiModelGateway.Reply("Synthetic answer. ".repeat(40), 1, 1, false));
            }
            var measurements = new LinkedHashMap<String, Object>();
            for (var entry : Map.of("list", "/ai/conversations", "conversation", "/ai/conversations/" + session.conversation(),
                    "executions", "/ai/conversations/" + session.conversation() + "/executions").entrySet()) {
                var samples = new ArrayList<Double>();
                for (int index = 0; index < 110; index++) {
                    long start = System.nanoTime();
                    var response = session.client().send(request(entry.getValue()).GET().build(), HttpResponse.BodyHandlers.ofString());
                    double elapsed = (System.nanoTime() - start) / 1_000_000.0;
                    assertThat(response.statusCode()).isEqualTo(200);
                    assertThat(json.readTree(response.body())).isNotNull();
                    if (index >= 10) samples.add(elapsed);
                }
                samples.sort(Double::compare);
                measurements.put(entry.getKey(), Map.of("samples", samples.size(), "p50_ms", percentile(samples, .50),
                    "p95_ms", percentile(samples, .95), "p99_ms", percentile(samples, .99), "max_ms", samples.getLast()));
            }
            verifyNoInteractions(model);
            String database;
            try (var connection = datasource.getConnection()) { database = connection.getMetaData().getDatabaseProductName() + " " + connection.getMetaData().getDatabaseProductVersion(); }
            var report = Map.of("database", database, "java", System.getProperty("java.version"), "providerRequests", 0,
                "scenario", "Tomcat loopback; one authenticated client; 10 conversations x 10 complete turns; 10 warmups; no TLS or provider latency",
                "measurements", measurements);
            Files.createDirectories(Path.of("target"));
            Files.writeString(Path.of("target/ai-performance.json"), json.writerWithDefaultPrettyPrinter().writeValueAsString(report));
            System.out.println("AI performance report: target/ai-performance.json (synthetic data; no provider requests).");
        }
    }
    private static double percentile(List<Double> sorted, double fraction) { return sorted.get((int) Math.ceil(sorted.size() * fraction) - 1); }
}
