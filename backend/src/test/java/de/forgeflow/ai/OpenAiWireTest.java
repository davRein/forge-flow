package de.forgeflow.ai;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.ai.openai.OpenAiChatModel;
import tools.jackson.databind.json.JsonMapper;
import static org.assertj.core.api.Assertions.*;
import static de.forgeflow.ai.AiTestSupport.*;

// Exercises the actual Spring AI + OpenAI SDK transport only against a loopback server.
class OpenAiWireTest {
    private AiLogCapture logs;
    private final java.util.Map<ch.qos.logback.classic.Logger, ch.qos.logback.classic.Level> previousLevels = new java.util.HashMap<>();
    @BeforeEach void useApplicationProviderLoggingPolicy() throws Exception {
        logs = new AiLogCapture();
        var yaml = new org.springframework.boot.env.YamlPropertySourceLoader().load("application", new org.springframework.core.io.ClassPathResource("application.yml")).getFirst();
        for (String name : List.of("org.springframework.ai", "com.openai")) {
            assertThat(yaml.getProperty("logging.level." + name)).isEqualTo("OFF");
            var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(name);
            previousLevels.put(logger, logger.getLevel());
            logger.setLevel(ch.qos.logback.classic.Level.OFF);
        }
    }
    @AfterEach void restoreLogging() { previousLevels.forEach(ch.qos.logback.classic.Logger::setLevel); logs.close(); }
    private static final byte[] RESPONSE = ("{\"id\":\"test-completion\",\"object\":\"chat.completion\",\"created\":1,\"model\":\"test-only-model\","
        + "\"choices\":[{\"index\":0,\"message\":{\"role\":\"assistant\",\"content\":\"Test answer\"},\"finish_reason\":\"stop\"}],"
        + "\"usage\":{\"prompt_tokens\":20,\"completion_tokens\":3,\"total_tokens\":23}}").getBytes(StandardCharsets.UTF_8);
    private OpenAiModelGateway gateway(HttpServer server) {
        return gateway(server, properties());
    }
    private OpenAiModelGateway gateway(HttpServer server, AiProperties properties) {
        var options = AiConfiguration.options(properties).mutate().baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1").build();
        return new OpenAiModelGateway(OpenAiChatModel.builder().options(options).build(), java.time.Duration.ofSeconds(20), properties.maxToolSteps());
    }
    @Test void realSdkHonorsRequestContractAndMapsTheResponse() throws Exception {
        var request = new AtomicReference<String>(); var method = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            method.set(exchange.getRequestMethod()); request.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.getResponseHeaders().set("Content-Type", "application/json"); exchange.sendResponseHeaders(200, RESPONSE.length);
            try (var body = exchange.getResponseBody()) { body.write(RESPONSE); }
        });
        server.start();
        try {
            var reply = gateway(server).reply("de", List.of(), "Test message");
            assertThat(reply.text()).isEqualTo("Test answer"); assertThat(reply.outputTokens()).isEqualTo(3);
            var json = JsonMapper.builder().build().readTree(request.get());
            assertThat(method.get()).isEqualTo("POST"); assertThat(json.get("model").stringValue()).isEqualTo("test-only-model");
            assertThat(json.get("max_completion_tokens").intValue()).isEqualTo(256);
            assertThat(json.has("max_tokens")).isFalse(); assertThat(json.has("temperature")).isFalse();
            assertThat(json.get("store").booleanValue()).isFalse(); assertThat(json.has("tools")).isFalse();
            assertThat(json.has("stream_options")).isFalse();
            assertThat(json.get("messages").get(1).get("content").stringValue()).isEqualTo("Test message");
        } finally { server.stop(0); }
    }
    @ParameterizedTest
    @CsvSource({
        "credit_balance_exhausted,insufficient_quota,AI_QUOTA_EXCEEDED",
        "insufficient_quota,insufficient_quota,AI_QUOTA_EXCEEDED",
        "organization_spend_limit_exceeded,insufficient_quota,AI_QUOTA_EXCEEDED",
        "project_spend_limit_exceeded,insufficient_quota,AI_QUOTA_EXCEEDED",
        "organization_usage_limit_exceeded,insufficient_quota,AI_QUOTA_EXCEEDED",
        "billing_hard_limit_reached,insufficient_quota,AI_QUOTA_EXCEEDED",
        "rate_limit_exceeded,rate_limit_error,AI_RATE_LIMITED",
        "slow_down,rate_limit_error,AI_RATE_LIMITED",
        "rate_limit,insufficient_quota,AI_RATE_LIMITED",
        ",insufficient_quota,AI_QUOTA_EXCEEDED",
        "unknown_code,unknown_type,AI_PROVIDER_LIMIT",
        ",rate_limit_error,AI_PROVIDER_LIMIT"
    })
    void providerLimitsAreClassifiedWithoutLeakingDetailsOrRetrying(String providerCode, String providerType, String expectedCode) throws Exception {
        var calls = new AtomicInteger(); var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            calls.incrementAndGet(); exchange.getRequestBody().readAllBytes();
            var detail = new java.util.HashMap<String, Object>();
            detail.put("message", "private-provider-detail"); detail.put("type", providerType);
            if (providerCode != null) detail.put("code", providerCode);
            byte[] body = JsonMapper.builder().build().writeValueAsBytes(java.util.Map.of("error", detail));
            exchange.getResponseHeaders().set("Content-Type", "application/json"); exchange.sendResponseHeaders(429, body.length);
            try (var output = exchange.getResponseBody()) { output.write(body); }
        }); server.start();
        try {
            var gateway = gateway(server);
            var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
            assertThatThrownBy(() -> gateway.reply("en", List.of(), "Hello", projectSession(storage, () -> true)))
                .isInstanceOfSatisfying(de.forgeflow.api.ApiFailure.class, error -> {
                    assertThat(error.status).isEqualTo(503); assertThat(error.code).isEqualTo(expectedCode);
                    assertThat(error.getMessage()).doesNotContain("private-provider-detail");
                });
            assertThat(calls).hasValue(1);
            org.mockito.Mockito.verifyNoInteractions(storage);
        }
        finally { server.stop(0); }
    }
    @Test void realTransportTimeoutEndsTheCallWithoutRetry() throws Exception {
        var calls = new AtomicInteger(); var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            server.setExecutor(executor); server.createContext("/v1/chat/completions", exchange -> {
                calls.incrementAndGet(); exchange.getRequestBody().readAllBytes();
                try { Thread.sleep(1800); } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
                exchange.close();
            }); server.start();
            try { failure(() -> gateway(server).reply("de", List.of(), "Hallo"), 504, "AI_TIMEOUT"); assertThat(calls).hasValue(1); }
            finally { server.stop(0); }
        }
    }
    @ParameterizedTest
    @CsvSource({
        "400,unsupported_parameter,invalid_request_error,reasoning_effort,AI_PROVIDER_CONFIGURATION,unsupported_parameter,invalid_request_error,reasoning_effort",
        "400,invalid_function_parameters,invalid_request_error,tools[0].function.parameters,AI_PROVIDER_CONFIGURATION,invalid_function_parameters,invalid_request_error,tools",
        "401,invalid_api_key,authentication_error,model,AI_PROVIDER_AUTHENTICATION,invalid_api_key,authentication_error,model",
        "403,permission_denied,permission_error,model,AI_PROVIDER_AUTHENTICATION,permission_denied,permission_error,model",
        "404,model_not_found,invalid_request_error,model,AI_PROVIDER_CONFIGURATION,model_not_found,invalid_request_error,model",
        "422,invalid_value,invalid_request_error,messages[0].content,AI_PROVIDER_CONFIGURATION,invalid_value,invalid_request_error,messages",
        "500,private-code,private-type,private-param,AI_UNAVAILABLE,other,other,other"
    })
    void providerFailuresExposeSafeCategoriesAndLogOnlyAllowlistedMetadata(int status, String code, String type, String param,
            String expected, String loggedCode, String loggedType, String loggedParam) throws Exception {
        var calls = new AtomicInteger();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            calls.incrementAndGet(); exchange.getRequestBody().readAllBytes();
            byte[] body = JsonMapper.builder().build().writeValueAsBytes(java.util.Map.of("error", java.util.Map.of(
                "message", "private-provider-message test-only-secret test-only-chat", "code", code, "type", type, "param", param)));
            exchange.getResponseHeaders().set("Content-Type", "application/json"); exchange.sendResponseHeaders(status, body.length);
            try (var stream = exchange.getResponseBody()) { stream.write(body); }
        }); server.start();
        try {
            var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
            assertThatThrownBy(() -> gateway(server).stream("de", List.of(), "test-only-chat", projectSession(storage, () -> true))
                .collectList().block(java.time.Duration.ofSeconds(5)))
                .isInstanceOfSatisfying(de.forgeflow.api.ApiFailure.class, error -> {
                    assertThat(error.status).isEqualTo(503); assertThat(error.code).isEqualTo(expected);
                    assertThat(error.getMessage()).doesNotContain("private-", "test-only-");
                });
            assertThat(calls).hasValue(1); org.mockito.Mockito.verifyNoInteractions(storage);
            assertThat(logs.text()).contains("AI diagnostic phase=tool_selection category=provider status=" + status,
                "code=" + loggedCode, "type=" + loggedType, "parameter=" + loggedParam)
                .doesNotContain("private-", "test-only-secret", "test-only-chat");
        } finally { server.stop(0); }
    }
    private static String chunk(String text, String finish) {
        return "data: {\"id\":\"test-stream\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"test-only-model\","
            + "\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"" + text + "\"},\"finish_reason\":"
            + (finish == null ? "null" : "\"" + finish + "\"") + "}]}\n\n";
    }
    @Test void realSdkStreamsUtf8DeltasUsageAndFinishReasonWithoutAggregatingOrRetrying() throws Exception {
        var request = new AtomicReference<String>(); var calls = new AtomicInteger();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        String payload = chunk("Grüße ", null) + chunk("für dich", null) + chunk("", "stop")
            + "data: {\"id\":\"test-stream\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"test-only-model\",\"choices\":[],"
            + "\"usage\":{\"prompt_tokens\":20,\"completion_tokens\":3,\"total_tokens\":23}}\n\ndata: [DONE]\n\n";
        server.createContext("/v1/chat/completions", exchange -> {
            calls.incrementAndGet(); request.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream"); exchange.sendResponseHeaders(200, 0);
            try (var body = exchange.getResponseBody()) { body.write(payload.getBytes(StandardCharsets.UTF_8)); }
        }); server.start();
        try {
            var events = gateway(server).stream("de", List.of(), "Hello").collectList().block(java.time.Duration.ofSeconds(5));
            assertThat(events).isNotNull();
            assertThat(events.stream().map(AiModelGateway.Chunk::delta).filter(value -> !value.isEmpty()).toList()).containsExactly("Grüße ", "für dich");
            assertThat(events.getLast().completed()).isEqualTo(new AiModelGateway.Reply("Grüße für dich", 20, 3, false));
            var json = JsonMapper.builder().build().readTree(request.get());
            assertThat(json.get("stream").booleanValue()).isTrue(); assertThat(json.get("store").booleanValue()).isFalse();
            assertThat(json.get("stream_options").get("include_usage").booleanValue()).isTrue();
            assertThat(json.get("max_completion_tokens").intValue()).isEqualTo(256);
            assertThat(calls).hasValue(1);
        } finally { server.stop(0); }
    }
    @Test void cancellingTheActualSdkStreamClosesTheProviderConnection() throws Exception {
        var disconnected = new java.util.concurrent.CountDownLatch(1);
        var calls = new AtomicInteger(); var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            server.setExecutor(executor); server.createContext("/v1/chat/completions", exchange -> {
                calls.incrementAndGet(); exchange.getRequestBody().readAllBytes();
                exchange.getResponseHeaders().set("Content-Type", "text/event-stream"); exchange.sendResponseHeaders(200, 0);
                try (var body = exchange.getResponseBody()) {
                    for (int index = 0; index < 100; index++) {
                        body.write(chunk("x".repeat(500), null).getBytes(StandardCharsets.UTF_8)); body.flush();
                        try { Thread.sleep(30); } catch (InterruptedException error) { Thread.currentThread().interrupt(); break; }
                    }
                } catch (java.io.IOException error) { disconnected.countDown(); }
            }); server.start();
            try {
                var first = gateway(server).stream("en", List.of(), "Hello").next().block(java.time.Duration.ofSeconds(5));
                assertThat(first).isNotNull(); assertThat(first.delta()).hasSize(500);
                assertThat(disconnected.await(2, java.util.concurrent.TimeUnit.SECONDS)).as("Provider socket must close on subscription cancellation").isTrue();
                assertThat(calls).hasValue(1);
            } finally { server.stop(0); }
        }
    }
    private static String toolChunk(String name, String arguments, boolean fragmented) {
        return toolChunk(name, arguments, fragmented, "call_read_1");
    }
    private static String toolChunk(String name, String arguments, boolean fragmented, String callId) {
        var json = JsonMapper.builder().build();
        var first = java.util.Map.of("index", 0, "id", callId, "type", "function", "function", java.util.Map.of("name", name, "arguments", fragmented ? arguments.substring(0, 5) : arguments));
        var second = java.util.Map.of("index", 0, "function", java.util.Map.of("arguments", fragmented ? arguments.substring(5) : ""));
        String prefix = "data: {\"id\":\"tool-stream\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"test-only-model\",\"choices\":[{\"index\":0,\"delta\":";
        return prefix + json.writeValueAsString(java.util.Map.of("role", "assistant", "tool_calls", List.of(first))) + ",\"finish_reason\":null}]}\n\n"
            + (fragmented ? prefix + json.writeValueAsString(java.util.Map.of("tool_calls", List.of(second))) + ",\"finish_reason\":null}]}\n\n" : "")
            + prefix + "{},\"finish_reason\":\"tool_calls\"}]}\n\n"
            + "data: {\"id\":\"tool-stream\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"test-only-model\",\"choices\":[],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":7,\"total_tokens\":19}}\n\ndata: [DONE]\n\n";
    }
    private ProjectTools.Session projectSession(de.forgeflow.workspace.WorkspaceStorage storage, java.util.function.BooleanSupplier active) {
        return projectSession(storage, active, null);
    }
    private ProjectTools.Session projectSession(de.forgeflow.workspace.WorkspaceStorage storage, java.util.function.BooleanSupplier active, AgentDtos.PageContext page) {
        var accounts = org.mockito.Mockito.mock(de.forgeflow.auth.Accounts.class);
        org.mockito.Mockito.when(accounts.findById("alice")).thenReturn(java.util.Optional.of(new de.forgeflow.auth.Accounts.User("alice", "test@example.test", "Test", "test-only-hash", false, true, 0)));
        return new ProjectTools(accounts, storage, JsonMapper.builder().build(), new TestClock()).session(new AgentExecutionContext("alice", 0, active), () -> true, page);
    }
    @ParameterizedTest @org.junit.jupiter.params.provider.ValueSource(strings={"read_workspace", "propose_workspace_create", "propose_workspace_update", "contact-create", "notes-update"})
    void actualSdkHandlesCustomerCountsAndCreationProposalsWithoutPerformingTheWrite(String operation) throws Exception {
        String toolName = "contact-create".equals(operation) ? "propose_workspace_create" : "notes-update".equals(operation) ? "propose_workspace_update" : operation;
        var mapper = JsonMapper.builder().build(); var storage = new de.forgeflow.workspace.MemoryWorkspaceStorage();
        var empty = de.forgeflow.workspace.WorkspaceDtos.Data.empty(); var before = storage.load("alice");
        var customers = java.util.stream.LongStream.rangeClosed(1, 3).mapToObj(id -> new de.forgeflow.workspace.WorkspaceDtos.Customer(id, "Customer " + id, "", "", "", "private-contact@example.test", null, "", "")).toList();
        storage.save("alice", before.revision(), new de.forgeflow.workspace.WorkspaceDtos.Data(empty.projects(), customers, empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki()), java.util.Map.of());
        String arguments = "contact-create".equals(operation) ? "{\"entity\":\"contacts\",\"fields\":[{\"name\":\"customer\",\"value\":\"#1\"},{\"name\":\"name\",\"value\":\"New contact\"},{\"name\":\"role\",\"value\":\"Manager\"}]}"
            : "notes-update".equals(operation) ? "{\"entity\":\"customers\",\"target\":\"#1\",\"fields\":[{\"name\":\"notes\",\"value\":\"New note\"}]}"
            : "read_workspace".equals(toolName) ? "{\"entity\":\"customers\",\"mode\":\"count\",\"query\":\"\",\"project\":\"\",\"offset\":0,\"textOffset\":0,\"filters\":[]}"
            : "{\"entity\":\"customers\"," + ("propose_workspace_update".equals(toolName) ? "\"target\":\"#1\"," : "") + "\"fields\":[{\"name\":\"name\",\"value\":\"New Kunde Ü\"}]}";
        var requests = new java.util.concurrent.CopyOnWriteArrayList<tools.jackson.databind.JsonNode>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requests.add(mapper.readTree(exchange.getRequestBody().readAllBytes()));
            String payload = requests.size() == 1 ? toolChunk(toolName, arguments, true) : chunk("Checked result; confirm any proposal.", "stop") + "data: [DONE]\n\n";
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream"); exchange.sendResponseHeaders(200, 0);
            try (var body = exchange.getResponseBody()) { body.write(payload.getBytes(StandardCharsets.UTF_8)); }
        }); server.start();
        try {
            var reply = gateway(server).reply("de", List.of(), "Test customer operation", projectSession(storage, () -> true));
            assertThat(reply.tools()).hasSize(1); assertThat(requests).hasSize(2); assertThat(storage.load("alice").data().customers()).hasSize(3);
            var result = reply.tools().getFirst().result();
            if ("read_workspace".equals(toolName)) { assertThat(result.total()).isEqualTo(3); assertThat(result.workspace().items()).isEmpty(); }
            else { assertThat(result.mutation().data().get("id").longValue()).isEqualTo("propose_workspace_update".equals(toolName) || "contact-create".equals(operation) ? 1 : 4); assertThat(result.mutation().status()).isEqualTo("proposed");
                assertThat(requests.getLast().get("tool_choice").asText()).isEqualTo("none"); }
            assertThat(storage.load("alice").data().customers().getFirst().contacts()).isEmpty();
            assertThat(storage.load("alice").data().customers().getFirst().notes()).isEmpty();
            assertThat(requests.getLast().toString()).doesNotContain("private-contact@example.test");
        } finally { server.stop(0); }
    }
    @Test void actualSdkSelectsRegisteredToolReadsOnlyOwnedDataAndReceivesItsResultBeforeStreamingTheFinalAnswer() throws Exception {
        var requests = new java.util.concurrent.CopyOnWriteArrayList<tools.jackson.databind.JsonNode>();
        var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
        var empty = de.forgeflow.workspace.WorkspaceDtos.Data.empty();
        var data = new de.forgeflow.workspace.WorkspaceDtos.Data(
            List.of(new de.forgeflow.workspace.WorkspaceDtos.Project(1, 1, "Alpha", true, "2026-12-31")), empty.customers(),
            List.of(new de.forgeflow.workspace.WorkspaceDtos.Task(1, 1, null, "AL-1", "Offene Aufgabe", "private-description", "todo", "high", "2026-10-23", "2026-10-23")),
            empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki());
        org.mockito.Mockito.when(storage.load("alice")).thenReturn(new de.forgeflow.workspace.WorkspaceDtos.Envelope(1, "revision-8", data));
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requests.add(JsonMapper.builder().build().readTree(exchange.getRequestBody().readAllBytes()));
            String payload = requests.size() % 2 == 1 ? toolChunk("get_project_summary", "{\"project\":\"#1\"}", true)
                : chunk("Alpha: eine offene Aufgabe.", "stop") + "data: {\"id\":\"final\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"test-only-model\",\"choices\":[],\"usage\":{\"prompt_tokens\":60,\"completion_tokens\":8,\"total_tokens\":68}}\n\ndata: [DONE]\n\n";
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream"); exchange.sendResponseHeaders(200, 0);
            try (var body = exchange.getResponseBody()) { body.write(payload.getBytes(StandardCharsets.UTF_8)); }
        }); server.start();
        try {
            var original = properties();
            var luna = new AiProperties(true, original.apiKey(), "gpt-6-luna", original.timeout(), original.outputTokenMode(), original.maxOutputTokens(),
                original.requestsPer15Minutes(), original.maxConcurrent(), original.maxConversationsPerUser(), original.maxConversations(), original.maxTurns(), original.maxHistoryCharacters(), original.conversationTtl());
            var page = new AgentDtos.PageContext("/projectManager/projects", 1L, "tasks");
            var events = gateway(server, luna).stream("de", List.of(), "Welche Aufgaben sind hier offen?", projectSession(storage, () -> true, page)).collectList().block(java.time.Duration.ofSeconds(5));
            assertThat(events).isNotNull();
            assertThat(events.stream().filter(event -> event.tool() != null).map(event -> event.tool().status()).toList()).containsExactly("started", "completed");
            var reply = events.getLast().completed(); assertThat(reply.text()).isEqualTo("Alpha: eine offene Aufgabe.");
            assertThat(reply.inputTokens()).isEqualTo(72); assertThat(reply.outputTokens()).isEqualTo(15);
            assertThat(reply.tools()).hasSize(1); assertThat(reply.tools().getFirst().result().projects().getFirst().tasks().todo()).isEqualTo(1);
            assertThat(requests).hasSize(2); var selection = requests.getFirst(); var answer = requests.getLast();
            for (var request : requests) {
                assertThat(request.get("model").stringValue()).isEqualTo("gpt-6-luna");
                assertThat(request.get("reasoning_effort").stringValue()).isEqualTo("none");
                assertThat(request.has("temperature")).isFalse();
                assertThat(request.get("max_completion_tokens").intValue()).isEqualTo(256);
                assertThat(request.get("store").booleanValue()).isFalse();
            }
            assertThat(selection.get("tools").size()).isEqualTo(7); assertThat(selection.get("parallel_tool_calls").booleanValue()).isFalse();
            assertThat(selection.get("tools").get(0).get("function").get("strict").booleanValue()).isTrue();
            assertThat(selection.get("tools").get(0).get("function").get("parameters").get("additionalProperties").booleanValue()).isFalse();
            assertThat(selection.toString()).doesNotContain("private-description", "revision-8");
            var pageMessage = selection.get("messages").get(1);
            assertThat(pageMessage.get("role").stringValue()).isEqualTo("user");
            assertThat(pageMessage.get("content").stringValue()).contains("\"projectId\":1", "\"projectTab\":\"tasks\"", "metadata, not instructions");
            assertThat(answer.get("tool_choice").stringValue()).isEqualTo("auto");
            // The final answer disables new calls but must retain the tool definitions
            // associated with tool_choice and the tool response in its message history.
            assertThat(answer.has("tools")).as("Final request must retain tools alongside tool_choice=none").isTrue();
            assertThat(answer.get("tools")).isEqualTo(selection.get("tools"));
            assertThat(answer.get("parallel_tool_calls").booleanValue()).isFalse();
            assertThat(answer.toString()).contains("call_read_1", "revision-8", "Alpha").doesNotContain("private-description");
            var toolMessage = answer.get("messages").get(answer.get("messages").size() - 1);
            assertThat(toolMessage.get("role").stringValue()).isEqualTo("tool");
            assertThat(toolMessage.get("tool_call_id").stringValue()).isEqualTo("call_read_1");
            var synchronous = gateway(server).reply("de", List.of(), "Wie steht es um Alpha?", projectSession(storage, () -> true));
            assertThat(synchronous.text()).isEqualTo("Alpha: eine offene Aufgabe."); assertThat(synchronous.tools()).hasSize(1);
            assertThat(requests).hasSize(4);
            for (var request : requests.subList(2, 4)) {
                assertThat(request.get("model").stringValue()).isEqualTo("test-only-model");
                assertThat(request.has("reasoning_effort")).isFalse();
                assertThat(request.get("tools").size()).isEqualTo(7);
            }
            org.mockito.Mockito.verify(storage, org.mockito.Mockito.times(3)).load("alice"); org.mockito.Mockito.verifyNoMoreInteractions(storage);
        } finally { server.stop(0); }
    }
    @Test void actualSdkNavigationToolReturnsTypedProposalWithoutExecutingAndNextTurnIncludesReportedStatus() throws Exception {
        var requests = new java.util.concurrent.CopyOnWriteArrayList<tools.jackson.databind.JsonNode>();
        var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
        var empty = de.forgeflow.workspace.WorkspaceDtos.Data.empty();
        var data = new de.forgeflow.workspace.WorkspaceDtos.Data(List.of(new de.forgeflow.workspace.WorkspaceDtos.Project(17, 1, "Alpha", true, "2026-12-31")),
            empty.customers(), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki());
        org.mockito.Mockito.when(storage.load("alice")).thenReturn(new de.forgeflow.workspace.WorkspaceDtos.Envelope(1, "1", data));
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requests.add(JsonMapper.builder().build().readTree(exchange.getRequestBody().readAllBytes()));
            String payload = requests.size() == 1 ? toolChunk("propose_project_navigation", "{\"project\":\"#17\",\"view\":\"board\"}", true)
                : chunk("Please confirm the navigation card.", "stop") + "data: [DONE]\n\n";
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream"); exchange.sendResponseHeaders(200, 0);
            try (var body = exchange.getResponseBody()) { body.write(payload.getBytes(StandardCharsets.UTF_8)); }
        }); server.start();
        try {
            var reply = gateway(server).reply("en", List.of(), "Open Alpha Kanban", projectSession(storage, () -> true));
            var proposal = reply.tools().getFirst().result().action();
            assertThat(proposal.type()).isEqualTo("project.view"); assertThat(proposal.projectId()).isEqualTo(17);
            assertThat(proposal.projectTab()).isEqualTo("board"); assertThat(proposal.status()).isEqualTo("proposed");
            assertThat(requests).hasSize(2);
            assertThat(requests.get(1).get("tool_choice").stringValue()).isEqualTo("none");
            var output = requests.get(1).get("messages").get(requests.get(1).get("messages").size() - 2).get("content").stringValue();
            assertThat(output).contains("project.view", "proposed", "Alpha");
            var finished = new AgentDtos.ToolEvent(reply.tools().getFirst().id(), "propose_project_navigation", "completed", reply.tools().getFirst().result().action(proposal.state("succeeded", null)));
            var history = List.of(new AgentDtos.Message(java.util.UUID.randomUUID(), "user", "Open Alpha", java.time.Instant.now()),
                new AgentDtos.Message(java.util.UUID.randomUUID(), "assistant", reply.text(), java.time.Instant.now(), List.of(finished)));
            gateway(server).reply("en", history, "Did it work?", projectSession(storage, () -> true));
            assertThat(requests).hasSize(3);
            assertThat(requests.getLast().get("messages").toString()).contains("reported by the UI", "succeeded", "projectTab");
            org.mockito.Mockito.verify(storage).load("alice"); org.mockito.Mockito.verifyNoMoreInteractions(storage);
        } finally { server.stop(0); }
    }
    @Test void actualSdkChainsTwoToolsAndRetainsTheirCallIdsBeforeAForcedFinalAnswer() throws Exception {
        var requests = new java.util.concurrent.CopyOnWriteArrayList<tools.jackson.databind.JsonNode>();
        var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
        var empty = de.forgeflow.workspace.WorkspaceDtos.Data.empty();
        var data = new de.forgeflow.workspace.WorkspaceDtos.Data(List.of(new de.forgeflow.workspace.WorkspaceDtos.Project(17, 1, "Alpha", true, "2026-12-31")),
            empty.customers(), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki());
        org.mockito.Mockito.when(storage.load("alice")).thenReturn(new de.forgeflow.workspace.WorkspaceDtos.Envelope(1, "revision-1", data));
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requests.add(JsonMapper.builder().build().readTree(exchange.getRequestBody().readAllBytes()));
            String payload = switch (requests.size()) {
                case 1 -> toolChunk("list_projects", "{\"query\":\"Al\",\"offset\":0}", true, "call_lookup");
                case 2 -> toolChunk("list_open_tasks", "{\"project\":\"#17\",\"offset\":0}", true, "call_tasks");
                default -> chunk("Alpha has no saved open tasks.", "stop") + "data: [DONE]\n\n";
            };
            exchange.getResponseHeaders().set("Content-Type", "text/event-stream"); exchange.sendResponseHeaders(200, 0);
            try (var body = exchange.getResponseBody()) { body.write(payload.getBytes(StandardCharsets.UTF_8)); }
        }); server.start();
        try {
            var options = AiConfiguration.options(properties()).mutate().baseUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1").build();
            var reply = new OpenAiModelGateway(OpenAiChatModel.builder().options(options).build(), java.time.Duration.ofSeconds(3), 2)
                .reply("en", List.of(), "Find Alpha and read its open tasks", projectSession(storage, () -> true));
            assertThat(reply.tools()).extracting(AgentDtos.ToolEvent::name).containsExactly("list_projects", "list_open_tasks");
            assertThat(reply.text()).contains("no saved open tasks"); assertThat(requests).hasSize(3);
            for (int index = 0; index < requests.size(); index++) {
                assertThat(requests.get(index).get("model").stringValue()).isEqualTo("test-only-model");
                assertThat(requests.get(index).get("tool_choice").stringValue()).isEqualTo(index == 2 ? "none" : "auto");
                assertThat(requests.get(index).get("tools")).isEqualTo(requests.getFirst().get("tools"));
                assertThat(requests.get(index).get("parallel_tool_calls").booleanValue()).isFalse();
            }
            var messages = requests.getLast().get("messages");
            assertThat(messages.get(4).get("tool_call_id").stringValue()).isEqualTo("call_lookup");
            assertThat(messages.get(6).get("tool_call_id").stringValue()).isEqualTo("call_tasks");
            assertThat(messages.get(messages.size() - 1).get("content").stringValue()).contains("no tool steps remain");
            org.mockito.Mockito.verify(storage, org.mockito.Mockito.times(2)).load("alice"); org.mockito.Mockito.verifyNoMoreInteractions(storage);
        } finally { server.stop(0); }
    }
    @Test void actualSdkUnknownToolRequestsAndSessionRevocationCannotReachASecondModelCall() throws Exception {
        for (boolean revoke : new boolean[] {false, true}) {
            var calls = new AtomicInteger(); var active = new java.util.concurrent.atomic.AtomicBoolean(true);
            var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
            org.mockito.Mockito.when(storage.load("alice")).thenAnswer(invocation -> {
                active.set(false); return new de.forgeflow.workspace.WorkspaceDtos.Envelope(1, "1", de.forgeflow.workspace.WorkspaceDtos.Data.empty());
            });
            var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            server.createContext("/v1/chat/completions", exchange -> {
                calls.incrementAndGet(); exchange.getRequestBody().readAllBytes();
                String payload = toolChunk(revoke ? "get_project_summary" : "delete_project", "{\"project\":\"#1\"}", false);
                exchange.getResponseHeaders().set("Content-Type", "text/event-stream"); exchange.sendResponseHeaders(200, 0);
                try (var body = exchange.getResponseBody()) { body.write(payload.getBytes(StandardCharsets.UTF_8)); }
            }); server.start();
            try {
                failure(() -> gateway(server).stream("de", List.of(), "Test", projectSession(storage, active::get)).collectList().block(java.time.Duration.ofSeconds(5)),
                    revoke ? 401 : 502, revoke ? "UNAUTHENTICATED" : "AI_TOOL_REJECTED");
                assertThat(calls).hasValue(1);
                if (!revoke) org.mockito.Mockito.verifyNoInteractions(storage);
            } finally { server.stop(0); }
        }
    }
}
