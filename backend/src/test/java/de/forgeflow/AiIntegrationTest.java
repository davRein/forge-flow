package de.forgeflow;

import java.util.UUID;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.ai.AiModelGateway;
import de.forgeflow.auth.Accounts;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"forgeflow.ai.enabled=true", "forgeflow.ai.api-key=test-only-key", "forgeflow.ai.model=test-only-model",
    "forgeflow.ai.requests-per15-minutes=1",
    "forgeflow.user.id=ai-test-admin", "forgeflow.user.email=admin-ai@example.test", "forgeflow.origin=http://localhost:5173", "logging.level.root=WARN"})
@AutoConfigureMockMvc
@ActiveProfiles("memory")
class AiIntegrationTest {
    private static final String ORIGIN = "http://localhost:5173";
    private static final String PASSWORD = "Only-for-tests-12345";
    private static final String HASH = new BCryptPasswordEncoder(10).encode(PASSWORD);
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) { registry.add("forgeflow.user.password-hash", () -> HASH); }
    @Autowired MockMvc mvc;
    @Autowired JsonMapper json;
    @Autowired Accounts accounts;
    @MockitoBean AiModelGateway gateway;
    @Autowired de.forgeflow.workspace.WorkspaceStorage storage;
    @Autowired de.forgeflow.ai.ConversationStore conversations;
    protected String storageName() { return "memory"; }

    private String actionPath(MockHttpSession session) throws Exception {
        String owner = json.readTree(mvc.perform(get("/api/v1/auth/session").session(session)).andReturn().getResponse().getContentAsString()).get("user").get("id").stringValue();
        var previous = storage.load(owner); var data = de.forgeflow.workspace.WorkspaceDtos.Data.empty();
        storage.save(owner, previous.revision(), new de.forgeflow.workspace.WorkspaceDtos.Data(
            List.of(new de.forgeflow.workspace.WorkspaceDtos.Project(17, 1, "Alpha", true, "2026-12-31")),
            List.of(new de.forgeflow.workspace.WorkspaceDtos.Customer(1, "Test", "", "", "", "", null, "", "")), data.tasks(), data.activities(), data.epics(), data.sprints(), data.files(), data.wiki()), java.util.Map.of());
        var conversation = conversations.create(owner, "en");
        var pending = conversations.begin(owner, conversation.id(), new de.forgeflow.ai.AgentDtos.SendMessage(UUID.randomUUID(), "Open Alpha"));
        var action = new de.forgeflow.ai.NavigationActions.Action(UUID.randomUUID(), "project.open", 17, "Alpha", "overview", java.time.Instant.now().plusSeconds(299), "proposed", null);
        var result = new de.forgeflow.ai.ProjectTools.Result("OK", "1", java.time.Instant.now(), List.of(), List.of(), 1, 0, false, false, action);
        conversations.complete(pending, new AiModelGateway.Reply("Confirm the card.", 1, 1, false,
            List.of(new de.forgeflow.ai.AgentDtos.ToolEvent(UUID.randomUUID(), "propose_project_navigation", "completed", result))), 0);
        return "/api/v1/ai/conversations/" + conversation.id() + "/actions/" + action.id();
    }
    @Test void actionEndpointsUseCookieCsrfOriginOwnershipAndClosedBodiesWithoutCallingProvider() throws Exception {
        var session = login(); String path = actionPath(session);
        String body = json.writeValueAsString(java.util.Map.of("decisionId", UUID.randomUUID(), "decision", "approve"));
        mvc.perform(post(path + "/decision").with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post(path + "/decision").session(session).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/decision").session(session).with(csrf()).header("Origin", "https://foreign.example").contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/decision").session(login()).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isNotFound());
        for (var invalid : List.of("{}", "{\"decisionId\":\"" + UUID.randomUUID() + "\",\"decision\":\"approve\",\"projectId\":999}",
                "{\"decisionId\":\"" + UUID.randomUUID() + "\",\"decision\":\"executeScript\"}"))
            mvc.perform(post(path + "/decision").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(invalid)).andExpect(status().isBadRequest());
        var approved = mvc.perform(post(path + "/decision").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.action.status").value("approved")).andExpect(jsonPath("$.action.projectId").value(17)).andReturn();
        mvc.perform(post(path + "/decision").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body))
            .andExpect(status().isConflict()).andExpect(jsonPath("$.error.code").value("AI_ACTION_DECIDED"));
        String grant = json.readTree(approved.getResponse().getContentAsString()).get("executionId").stringValue();
        String result = json.writeValueAsString(java.util.Map.of("executionId", grant, "status", "succeeded"));
        mvc.perform(post(path + "/result").session(session).header("Origin", ORIGIN).contentType("application/json").content(result)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/result").session(login()).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(result)).andExpect(status().isNotFound());
        mvc.perform(post(path + "/result").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(result))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("succeeded"));
        verifyNoInteractions(gateway);
    }

    private MockHttpSession login() throws Exception {
        String id = UUID.randomUUID().toString(); String email = id + "@example.test";
        accounts.insert(new Accounts.User(id, email, "Test", HASH, false, true, 0));
        var csrfResult = mvc.perform(get("/api/v1/auth/csrf")).andReturn();
        var session = (MockHttpSession) csrfResult.getRequest().getSession(false);
        String token = json.readTree(csrfResult.getResponse().getContentAsString()).get("csrfToken").stringValue();
        mvc.perform(post("/api/v1/auth/login").session(session).header("Origin", ORIGIN).header("X-CSRF-TOKEN", token)
            .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("email", email, "password", PASSWORD))))
            .andExpect(status().isOk());
        return session;
    }
    private String create(MockHttpSession session) throws Exception {
        var result = mvc.perform(post("/api/v1/ai/conversations").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content("{\"language\":\"en\"}"))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.messages").isEmpty()).andExpect(jsonPath("$.language").value("en")).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").stringValue();
    }
    @Test void conversationListsExecutionHistoryAndDeletionAreOwnedAndDeletionRequiresCsrfAndOrigin() throws Exception {
        var session = login(); String id = create(session);
        mvc.perform(get("/api/v1/ai/conversations").session(session)).andExpect(status().isOk())
            .andExpect(jsonPath("$.storage").value(storageName())).andExpect(jsonPath("$.items[0].id").value(id)).andExpect(jsonPath("$.items[0].messageCount").value(0));
        var foreign = login();
        mvc.perform(get("/api/v1/ai/conversations").session(foreign)).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/v1/ai/conversations/" + id + "/executions").session(foreign)).andExpect(status().isNotFound());
        mvc.perform(delete("/api/v1/ai/conversations/" + id).session(session).header("Origin", ORIGIN)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/ai/conversations/" + id).session(session).with(csrf()).header("Origin", "https://foreign.example")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/ai/conversations/" + id).session(foreign).with(csrf()).header("Origin", ORIGIN)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/ai/conversations/" + id + "/executions").session(session)).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(delete("/api/v1/ai/conversations/" + id).session(session).with(csrf()).header("Origin", ORIGIN)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(session)).andExpect(status().isNotFound());
        verifyNoInteractions(gateway);
    }
    @Test void existingCookieCsrfAndOriginProtectionApplyToChat() throws Exception {
        mvc.perform(get("/api/v1/ai/conversations/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
        var session = login();
        mvc.perform(post("/api/v1/ai/conversations").session(session).header("Origin", ORIGIN).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("CSRF_REJECTED"));
        mvc.perform(post("/api/v1/ai/conversations").session(session).with(csrf()).header("Origin", "https://foreign.example")
            .contentType("application/json").content("{}"))
            .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("ORIGIN_REJECTED"));
        verifyNoInteractions(gateway);
    }
    @org.junit.jupiter.params.ParameterizedTest @org.junit.jupiter.params.provider.ValueSource(strings={"create", "update", "contacts", "notes"})
    void workspaceCreationRequiresOwnedImmutableProposalCsrfOriginAndExplicitDecisionAndNeverCallsTheProvider(String operation) throws Exception {
        boolean updating = java.util.Set.of("update", "notes").contains(operation), seeded = !"create".equals(operation);
        var session = login(); var id = create(session);
        String owner = json.readTree(mvc.perform(get("/api/v1/auth/session").session(session)).andReturn().getResponse().getContentAsString()).get("user").get("id").stringValue();
        var tool = new de.forgeflow.ai.ProjectTools(accounts, storage, json, java.time.Clock.systemUTC());
        if (seeded) {
            var snapshot = storage.load(owner); var empty = de.forgeflow.workspace.WorkspaceDtos.Data.empty();
            storage.save(owner, snapshot.revision(), new de.forgeflow.workspace.WorkspaceDtos.Data(empty.projects(),
                List.of(new de.forgeflow.workspace.WorkspaceDtos.Customer(1, "Original", "", "", "", "", null, "", "")), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki()), java.util.Map.of());
        }
        String toolName = updating ? "propose_workspace_update" : "propose_workspace_create";
        String field = "notes".equals(operation) ? "notes" : "name";
        var result = tool.session(new de.forgeflow.ai.AgentExecutionContext(owner, 0, () -> true)).read(toolName,
            "{\"entity\":\"" + ("contacts".equals(operation) ? "contacts" : "customers") + "\"," + (updating ? "\"target\":\"#1\"," : "")
            + "\"fields\":[" + ("contacts".equals(operation) ? "{\"name\":\"customer\",\"value\":\"#1\"}," : "") + "{\"name\":\"" + field + "\",\"value\":\"Created by explicit confirmation\"}]}");
        var pending = conversations.begin(owner, UUID.fromString(id), new de.forgeflow.ai.AgentDtos.SendMessage(UUID.randomUUID(), "Create customer"));
        conversations.complete(pending, new AiModelGateway.Reply("Please confirm", 1, 1, false,
            List.of(new de.forgeflow.ai.AgentDtos.ToolEvent(UUID.randomUUID(), toolName, "completed", result))));
        String path = "/api/v1/ai/conversations/" + id + "/creations/" + result.mutation().id() + "/decision";
        String body = json.writeValueAsString(java.util.Map.of("decisionId", UUID.randomUUID(), "decision", "approve"));
        assertThat(storage.load(owner).data().customers()).hasSize(seeded ? 1 : 0);
        if (updating) assertThat(storage.load(owner).data().customers().getFirst().name()).isEqualTo("Original");
        mvc.perform(post(path).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isUnauthorized());
        mvc.perform(post(path).session(session).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post(path).session(session).with(csrf()).header("Origin", "https://foreign.example").contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post(path).session(login()).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isNotFound());
        mvc.perform(post(path).session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body.replace("\"approve\"", "\"approve\",\"data\":{}"))).andExpect(status().isBadRequest());
        for (int repeat = 0; repeat < 2; repeat++) mvc.perform(post(path).session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("succeeded")).andExpect(jsonPath("$.data." + field).value("Created by explicit confirmation"));
        assertThat(storage.load(owner).data().customers()).hasSize(1);
        if ("contacts".equals(operation)) assertThat(storage.load(owner).data().customers().getFirst().contacts()).hasSize(1);
        if ("notes".equals(operation)) assertThat(storage.load(owner).data().customers().getFirst().notes()).isEqualTo("Created by explicit confirmation");
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(session)).andExpect(jsonPath("$.messages[1].tools[0].result.mutation.status").value("succeeded"));
        verifyNoInteractions(gateway);
    }
    @Test void ordinaryUsersCanChatWithOwnedHistoryAndIdempotentMessageSubmission() throws Exception {
        when(gateway.reply(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(new AiModelGateway.Reply("Test answer", 12, 3, false));
        var session = login(); String id = create(session); String request = UUID.randomUUID().toString();
        String body = json.writeValueAsString(java.util.Map.of("requestId", request, "message", "Hello"));
        for (int index = 0; index < 2; index++)
            mvc.perform(post("/api/v1/ai/conversations/" + id + "/messages").session(session).with(csrf()).header("Origin", ORIGIN)
                .contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.assistant.content").value("Test answer"))
                .andExpect(jsonPath("$.usage.inputTokens").value(12)).andExpect(jsonPath("$.truncated").value(false));
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.messages.length()").value(2));
        verify(gateway, times(1)).reply(eq("en"), anyList(), eq("Hello"), any(de.forgeflow.ai.ProjectTools.Session.class));
    }
    @Test void userCreationRequiresCurrentAdministratorRightsAndKeepsThePrivateInitialPasswordOutOfHistory() throws Exception {
        var session = login(); String id = create(session);
        String owner = json.readTree(mvc.perform(get("/api/v1/auth/session").session(session)).andReturn().getResponse().getContentAsString()).get("user").get("id").stringValue();
        var before = accounts.findById(owner).orElseThrow();
        accounts.replace(new Accounts.User(before.id(), before.email(), before.name(), before.passwordHash(), true, true, 0), 0);
        String email = UUID.randomUUID() + "@example.test";
        var result = new de.forgeflow.ai.ProjectTools(accounts, storage, json, java.time.Clock.systemUTC()).session(new de.forgeflow.ai.AgentExecutionContext(owner, 0, () -> true))
            .read("propose_workspace_create", json.writeValueAsString(java.util.Map.of("entity", "users", "fields", List.of(java.util.Map.of("name", "name", "value", "New normal user"), java.util.Map.of("name", "email", "value", email)))));
        var pending = conversations.begin(owner, UUID.fromString(id), new de.forgeflow.ai.AgentDtos.SendMessage(UUID.randomUUID(), "Create a user"));
        conversations.complete(pending, new AiModelGateway.Reply("Confirm and enter the password privately", 1, 1, false,
            List.of(new de.forgeflow.ai.AgentDtos.ToolEvent(UUID.randomUUID(), "propose_workspace_create", "completed", result))));
        String path = "/api/v1/ai/conversations/" + id + "/creations/" + result.mutation().id() + "/decision";
        String password = "Synthetic-account-test-123";
        String body = json.writeValueAsString(java.util.Map.of("decisionId", UUID.randomUUID(), "decision", "approve", "initialPassword", password));
        accounts.replace(before, 0);
        mvc.perform(post(path).session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isForbidden());
        assertThat(accounts.findByEmail(email)).isEmpty();
        accounts.replace(new Accounts.User(before.id(), before.email(), before.name(), before.passwordHash(), true, true, 0), 0);
        var response = mvc.perform(post(path).session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.administrator").value(false)).andExpect(jsonPath("$.status").value("succeeded")).andReturn();
        assertThat(response.getResponse().getContentAsString()).doesNotContain(password, "passwordHash", "sessionVersion");
        assertThat(new BCryptPasswordEncoder().matches(password, accounts.findByEmail(email).orElseThrow().passwordHash())).isTrue();
        var history = mvc.perform(get("/api/v1/ai/conversations/" + id).session(session)).andReturn().getResponse().getContentAsString();
        assertThat(history).doesNotContain(password, accounts.findByEmail(email).orElseThrow().passwordHash());
        verifyNoInteractions(gateway);
    }
    @Test void foreignConversationIdsAreRejectedOnReadAndWriteWithoutModelAccess() throws Exception {
        String id = create(login()); var foreign = login();
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(foreign)).andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("AI_CONVERSATION_NOT_FOUND"));
        mvc.perform(post("/api/v1/ai/conversations/" + id + "/messages").session(foreign).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "Hallo"))))
            .andExpect(status().isNotFound());
        verifyNoInteractions(gateway);
    }
    @Test void malformedIdsUnsupportedLanguageAndClientRolesAreRejected() throws Exception {
        var session = login(); String id = create(session);
        mvc.perform(get("/api/v1/ai/conversations/invalid").session(session)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        for (String body : new String[] {"{\"language\":\"fr\"}", "{\"language\":\"de\",\"ownerId\":\"someone-else\"}"})
            mvc.perform(post("/api/v1/ai/conversations").session(session).with(csrf()).header("Origin", ORIGIN).contentType("application/json").content(body)).andExpect(status().isBadRequest());
        for (String body : new String[] {"{\"message\":\"Hallo\"}", "{\"requestId\":\"" + UUID.randomUUID() + "\",\"message\":\" \"}",
                json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "x".repeat(4001))),
                json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "Hallo", "role", "system"))})
            mvc.perform(post("/api/v1/ai/conversations/" + id + "/messages").session(session).with(csrf()).header("Origin", ORIGIN)
                .contentType("application/json").content(body)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
        verifyNoInteractions(gateway);
    }
    @Test void providerFailuresAreStructuredAndDoNotExposeProviderDetailsOrPersistMessages() throws Exception {
        when(gateway.reply(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenThrow(new IllegalStateException("private-provider-detail"));
        var session = login(); String id = create(session);
        var response = mvc.perform(post("/api/v1/ai/conversations/" + id + "/messages").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "Hallo"))))
            .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.error.code").value("AI_UNAVAILABLE")).andReturn();
        assertThat(response.getResponse().getContentAsString()).doesNotContain("private-provider-detail", "test-only-key");
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(session)).andExpect(jsonPath("$.messages").isEmpty());
    }
    @Test void configuredAccountRateLimitAppliesAcrossConversations() throws Exception {
        when(gateway.reply(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(new AiModelGateway.Reply("Answer", 1, 1, false));
        var session = login(); String first = create(session); String second = create(session);
        mvc.perform(post("/api/v1/ai/conversations/" + first + "/messages").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "First"))))
            .andExpect(status().isOk());
        mvc.perform(post("/api/v1/ai/conversations/" + second + "/messages").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "Second"))))
            .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.error.code").value("RATE_LIMITED"));
        verify(gateway, times(1)).reply(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class));
    }
    @Test void streamingPreservesUtf8FinishesAtomicallyAndReplaysWithoutAnotherProviderCall() throws Exception {
        when(gateway.stream(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(reactor.core.publisher.Flux.just(
            new AiModelGateway.Chunk("Grüße ", null), new AiModelGateway.Chunk("für dich", null),
            new AiModelGateway.Chunk("", new AiModelGateway.Reply("Grüße für dich", 10, 3, false))));
        var session = login(); String id = create(session); String request = UUID.randomUUID().toString();
        String body = json.writeValueAsString(java.util.Map.of("requestId", request, "message", "Hallo"));
        for (int index = 0; index < 2; index++) {
            var result = mvc.perform(post("/api/v1/ai/conversations/" + id + "/messages/stream").session(session).with(csrf()).header("Origin", ORIGIN)
                .accept("text/event-stream", "application/json").contentType("application/json").content(body))
                .andExpect(request().asyncStarted()).andExpect(header().string("X-Accel-Buffering", "no")).andReturn();
            result.getAsyncResult(3000);
            var response = mvc.perform(asyncDispatch(result)).andExpect(status().isOk()).andReturn().getResponse();
            assertThat(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).contains("event:done", "Grüße für dich");
        }
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(session)).andExpect(jsonPath("$.messages.length()").value(2));
        verify(gateway, times(1)).stream(eq("en"), anyList(), eq("Hallo"), any(de.forgeflow.ai.ProjectTools.Session.class));
    }
    @Test void streamingErrorsAreSafeAndForeignCancellationAndMissingCsrfAreRejected() throws Exception {
        when(gateway.stream(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(reactor.core.publisher.Flux.error(new IllegalStateException("private-stream-error")));
        var session = login(); String id = create(session); String requestId = UUID.randomUUID().toString();
        String path = "/api/v1/ai/conversations/" + id;
        mvc.perform(post(path + "/messages/stream").session(session).header("Origin", ORIGIN).contentType("application/json")
            .content(json.writeValueAsString(java.util.Map.of("requestId", requestId, "message", "Hello"))))
            .andExpect(status().isForbidden());
        mvc.perform(post(path + "/requests/" + requestId + "/cancel").session(login()).with(csrf()).header("Origin", ORIGIN))
            .andExpect(status().isNotFound());
        var result = mvc.perform(post(path + "/messages/stream").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("requestId", requestId, "message", "Hello"))))
            .andExpect(request().asyncStarted()).andReturn();
        result.getAsyncResult(3000);
        String response = mvc.perform(asyncDispatch(result)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(response).contains("event:error", "AI_UNAVAILABLE").doesNotContain("private-stream-error");
        mvc.perform(get(path).session(session)).andExpect(jsonPath("$.messages").isEmpty());
    }
    @Test void ownedToolResultsAreStreamedAndPreservedInTheConfirmedConversation() throws Exception {
        var session = login(); String id = create(session);
        var profile = mvc.perform(get("/api/v1/auth/session").session(session)).andReturn();
        String owner = json.readTree(profile.getResponse().getContentAsString()).get("user").get("id").stringValue();
        var previous = storage.load(owner); var data = de.forgeflow.workspace.WorkspaceDtos.Data.empty();
        var project = new de.forgeflow.workspace.WorkspaceDtos.Project(1, 1, "Owned project", true, "2026-12-31");
        var customer = new de.forgeflow.workspace.WorkspaceDtos.Customer(1, "Private customer", "", "", "", "private@example.test", null, "", "");
        storage.save(owner, previous.revision(), new de.forgeflow.workspace.WorkspaceDtos.Data(List.of(project), List.of(customer), data.tasks(),
            data.activities(), data.epics(), data.sprints(), data.files(), data.wiki()), java.util.Map.of());
        when(gateway.stream(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenAnswer(invocation -> reactor.core.publisher.Flux.defer(() -> {
            de.forgeflow.ai.ProjectTools.Session toolSession = invocation.getArgument(3);
            assertThat(toolSession.pageContext().projectId()).isEqualTo(1L);
            var execution = UUID.randomUUID();
            var result = toolSession.read("list_projects", "{\"query\":\"\",\"offset\":0}");
            var event = new de.forgeflow.ai.AgentDtos.ToolEvent(execution, "list_projects", "completed", result);
            var tasks = toolSession.read("list_open_tasks", "{\"project\":\"#1\",\"offset\":0}");
            var taskEvent = new de.forgeflow.ai.AgentDtos.ToolEvent(UUID.randomUUID(), "list_open_tasks", "completed", tasks);
            return reactor.core.publisher.Flux.just(new AiModelGateway.Chunk("", null, null, new de.forgeflow.ai.AgentDtos.Execution("reading", 1, 4)),
                new AiModelGateway.Chunk("", null, new de.forgeflow.ai.AgentDtos.ToolEvent(execution, "list_projects", "started", null)),
                new AiModelGateway.Chunk("", null, event), new AiModelGateway.Chunk("", null, null, new de.forgeflow.ai.AgentDtos.Execution("reading", 2, 4)),
                new AiModelGateway.Chunk("", null, new de.forgeflow.ai.AgentDtos.ToolEvent(taskEvent.id(), "list_open_tasks", "started", null)), new AiModelGateway.Chunk("", null, taskEvent),
                new AiModelGateway.Chunk("", new AiModelGateway.Reply("One project, no open tasks.", 30, 6, false, List.of(event, taskEvent))));
        }));
        var result = mvc.perform(post("/api/v1/ai/conversations/" + id + "/messages/stream").session(session).with(csrf()).header("Origin", ORIGIN)
            .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "List my projects",
                "context", java.util.Map.of("route", "/projectManager/projects", "projectId", 1, "projectTab", "tasks")))))
            .andExpect(request().asyncStarted()).andReturn();
        result.getAsyncResult(3000);
        String stream = mvc.perform(asyncDispatch(result)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(stream).contains("event:execution", "event:tool", "list_open_tasks", "Owned project", "event:done").doesNotContain("private@example.test", "Private customer");
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(session))
            .andExpect(jsonPath("$.messages[1].tools[0].name").value("list_projects"))
            .andExpect(jsonPath("$.messages[1].tools.length()").value(2))
            .andExpect(jsonPath("$.messages[1].tools[1].name").value("list_open_tasks"))
            .andExpect(jsonPath("$.messages[0].context.projectId").value(1))
            .andExpect(jsonPath("$.messages[0].context.projectTab").value("tasks"))
            .andExpect(jsonPath("$.messages[1].tools[0].result.projects[0].name").value("Owned project"));
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(login())).andExpect(status().isNotFound());
    }
    @Test void contextCannotCarryPermissionsDraftsUnknownRoutesOrUnavailableProjectIds() throws Exception {
        var session = login(); String id = create(session);
        for (var page : List.of(java.util.Map.of("route", "/wiki/home", "role", "administrator"),
                java.util.Map.of("route", "/devTools/rest", "editor", "test-only-private"), java.util.Map.of("route", "/wiki/home?secret=value"),
                java.util.Map.of("route", "/wiki/home", "projectId", 1), java.util.Map.of("route", "/projectManager/projects", "projectId", -1)))
            mvc.perform(post("/api/v1/ai/conversations/" + id + "/messages").session(session).with(csrf()).header("Origin", ORIGIN)
                .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "Hier?", "context", page))))
                .andExpect(status().isBadRequest());
        for (var projectId : List.of(1, 999)) {
            var selectedSession = login(); var selectedConversation = create(selectedSession);
            mvc.perform(post("/api/v1/ai/conversations/" + selectedConversation + "/messages").session(selectedSession).with(csrf()).header("Origin", ORIGIN)
                .contentType("application/json").content(json.writeValueAsString(java.util.Map.of("requestId", UUID.randomUUID(), "message", "Hier?",
                    "context", java.util.Map.of("route", "/projectManager/projects", "projectId", projectId)))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.error.code").value("AI_PAGE_CONTEXT_UNAVAILABLE"));
        }
        verifyNoInteractions(gateway);
        mvc.perform(get("/api/v1/ai/conversations/" + id).session(session)).andExpect(jsonPath("$.messages").isEmpty());
    }
}
