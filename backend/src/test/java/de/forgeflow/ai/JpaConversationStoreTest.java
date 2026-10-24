package de.forgeflow.ai;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.ai.AgentDtos.*;
import de.forgeflow.auth.Accounts;
import static org.assertj.core.api.Assertions.*;
import static de.forgeflow.ai.AiTestSupport.*;

@SpringBootTest(properties={"forgeflow.ai.enabled=true", "forgeflow.ai.api-key=test-only-key", "forgeflow.ai.model=test-only-model",
    "forgeflow.user.id=chat-test-admin", "forgeflow.user.email=chat-admin@example.test", "spring.datasource.url=jdbc:h2:mem:chat-persistence;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
    "spring.datasource.username=sa", "spring.datasource.password=", "spring.flyway.locations=classpath:db/migration/common", "logging.level.root=WARN"})
@ActiveProfiles("postgres")
class JpaConversationStoreTest {
    private static final boolean POSTGRES = System.getenv("TEST_POSTGRES_URL") != null && !System.getenv("TEST_POSTGRES_URL").isBlank();
    private static final String URL = POSTGRES ? postgresUrl() : "jdbc:h2:mem:chat-persistence;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000";
    private static final String USER = POSTGRES ? System.getenv().getOrDefault("TEST_POSTGRES_USER", "forgeflow_test") : "sa";
    private static final String PASSWORD = POSTGRES ? System.getenv().getOrDefault("TEST_POSTGRES_PASSWORD", "") : "";
    private static final String MIGRATIONS = "classpath:db/migration/common" + (POSTGRES ? ",classpath:db/migration/postgresql" : "");
    private static final String SCHEMA = POSTGRES ? "ai_chat_" + UUID.randomUUID().toString().replace("-", "") : "public";
    private static String postgresUrl() {
        String value = System.getenv("TEST_POSTGRES_URL");
        if (!value.startsWith("jdbc:postgresql://")) throw new IllegalArgumentException("A dedicated PostgreSQL test database is required.");
        var uri = java.net.URI.create(value.substring(5));
        if (uri.getRawQuery() != null || uri.getPath() == null || !uri.getPath().matches("/[a-z][a-z0-9_]*_test")) throw new IllegalArgumentException("Database must end in _test without URL parameters.");
        return value;
    }
    @org.springframework.test.context.DynamicPropertySource
    static void configuration(org.springframework.test.context.DynamicPropertyRegistry registry) {
        registry.add("forgeflow.user.password-hash", () -> "$2a$10$" + "a".repeat(53));
        registry.add("spring.datasource.url", () -> URL); registry.add("spring.datasource.username", () -> USER); registry.add("spring.datasource.password", () -> PASSWORD); registry.add("spring.flyway.locations", () -> MIGRATIONS);
        registry.add("spring.datasource.hikari.schema", () -> SCHEMA); registry.add("spring.flyway.schemas", () -> SCHEMA);
        registry.add("spring.flyway.default-schema", () -> SCHEMA); registry.add("spring.jpa.properties.hibernate.default_schema", () -> SCHEMA);
    }
    @Autowired ConversationStore store;
    @Autowired Accounts accounts;
    @Autowired EntityManager em;
    @Autowired JsonMapper json;
    @Autowired AiProperties properties;
    @Autowired PlatformTransactionManager transactions;
    @Autowired de.forgeflow.workspace.WorkspaceStorage workspace;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @MockitoBean AiModelGateway gateway;
    private String owner() {
        var id = UUID.randomUUID().toString();
        accounts.insert(new Accounts.User(id, id + "@example.test", "Test", "$2a$10$" + "a".repeat(53), false, true, 0)); return id;
    }
    private <T> T tx(java.util.function.Supplier<T> work) { return new TransactionTemplate(transactions).execute(status -> work.get()); }
    private ConversationStore.PendingTurn pending(String owner, UUID id) { return store.begin(owner, id, new SendMessage(UUID.randomUUID(), "Test-only message")); }
    private AiModelGateway.Reply navigation() {
        var action = new NavigationActions.Action(UUID.randomUUID(), "project.open", 17, "Test project", "overview", java.time.Instant.now().plusSeconds(299), "proposed", null);
        var result = new ProjectTools.Result("OK", "1", java.time.Instant.now(), List.of(), List.of(), 1, 0, false, false, action);
        return new AiModelGateway.Reply("Confirm the card", 4, 2, false, List.of(new ToolEvent(UUID.randomUUID(), "propose_project_navigation", "completed", result)));
    }
    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(strings={"customers", "files", "users", "update", "contacts", "notes", "articles"})
    void creationAndDecisionAreOneTransactionEvenWhenWorkspaceWritesClearThePersistenceContext(String entity) {
        var owner = owner(); var context = new AgentExecutionContext(owner, 0, () -> true); var conversation = store.create(owner, "de");
        var tools = new ProjectTools(accounts, workspace, json, java.time.Clock.systemUTC());
        var fields = new java.util.LinkedHashMap<String, String>(); fields.put("name", "Atomic test record");
        if ("files".equals(entity)) {
            var empty = de.forgeflow.workspace.WorkspaceDtos.Data.empty(); var previous = workspace.load(owner);
            workspace.save(owner, previous.revision(), new de.forgeflow.workspace.WorkspaceDtos.Data(
                List.of(new de.forgeflow.workspace.WorkspaceDtos.Project(1, 1, "Files project", false, "2026-12-31")),
                List.of(new de.forgeflow.workspace.WorkspaceDtos.Customer(1, "Files customer", "", "", "", "", null, "", "")), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki()), java.util.Map.of());
            fields.put("project", "#1"); fields.put("content", "Atomic Grüße 😀"); fields.put("name", "atomic.txt");
        }
        if ("users".equals(entity)) {
            var user = accounts.findById(owner).orElseThrow(); accounts.replace(new Accounts.User(user.id(), user.email(), user.name(), user.passwordHash(), true, true, 0), 0);
            fields.put("email", UUID.randomUUID() + "@example.test");
        }
        if (java.util.Set.of("update", "contacts", "notes").contains(entity)) {
            var empty = de.forgeflow.workspace.WorkspaceDtos.Data.empty(); var previous = workspace.load(owner);
            workspace.save(owner, previous.revision(), new de.forgeflow.workspace.WorkspaceDtos.Data(empty.projects(),
                List.of(new de.forgeflow.workspace.WorkspaceDtos.Customer(1, "Before", "", "", "", "", null, "", "")), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki()), java.util.Map.of());
        }
        if ("contacts".equals(entity)) fields.put("customer", "#1");
        if ("notes".equals(entity)) { fields.clear(); fields.put("notes", "Atomic notes 😀"); }
        if ("articles".equals(entity)) {
            var empty = de.forgeflow.workspace.WorkspaceDtos.Data.empty(); var previous = workspace.load(owner); var stamp = "2026-10-24T10:00:00Z";
            workspace.save(owner, previous.revision(), new de.forgeflow.workspace.WorkspaceDtos.Data(empty.projects(), empty.customers(), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(),
                new de.forgeflow.workspace.WorkspaceDtos.Wiki(List.of(new de.forgeflow.workspace.WorkspaceDtos.Article(1, "Root", "Existing root", null, stamp, stamp)), List.of())), java.util.Map.of());
            fields.clear(); fields.put("title", "Atomic child"); fields.put("content", "  Child 😀\n"); fields.put("parent", "#1");
        }
        String toolName = java.util.Set.of("update", "notes").contains(entity) ? "propose_workspace_update" : "propose_workspace_create";
        var arguments = new java.util.LinkedHashMap<String, Object>(); arguments.put("entity", java.util.Set.of("update", "notes").contains(entity) ? "customers" : entity);
        arguments.put("fields", fields.entrySet().stream().map(entry -> java.util.Map.of("name", entry.getKey(), "value", entry.getValue())).toList());
        if (java.util.Set.of("update", "notes").contains(entity)) arguments.put("target", "#1");
        var result = tools.session(context).read(toolName, json.writeValueAsString(arguments));
        store.complete(pending(owner, conversation.id()), new AiModelGateway.Reply("Confirm", 1, 1, false,
            List.of(new ToolEvent(UUID.randomUUID(), toolName, "completed", result))));
        var actions = new AgentActions(accounts, workspace, store); var input = new WorkspaceMutations.DecisionInput(UUID.randomUUID(), "approve", "users".equals(entity) ? "Synthetic-atomic-user-123" : null);
        var before = workspace.load(owner);
        // The workspace save succeeds, then this chat constraint rejects the persisted decision.
        jdbc.execute("alter table ff_ai_conversations add constraint ai_creation_rollback check (owner_id <> '" + owner + "' or payload not like '%\"resultRevision\":\"%')");
        try { assertThatThrownBy(() -> actions.mutate(context, conversation.id(), result.mutation().id(), input)).isInstanceOf(RuntimeException.class); }
        finally { jdbc.execute("alter table ff_ai_conversations drop constraint ai_creation_rollback"); }
        assertThat(workspace.load(owner)).isEqualTo(before);
        if ("users".equals(entity)) assertThat(accounts.findByEmail(fields.get("email"))).isEmpty();
        assertThat(store.get(owner, conversation.id()).messages().getLast().tools().getFirst().result().mutation().status()).isEqualTo("proposed");
        var created = actions.mutate(context, conversation.id(), result.mutation().id(), input);
        assertThat(created.status()).isEqualTo("succeeded");
        if ("customers".equals(entity)) assertThat(workspace.load(owner).data().customers()).hasSize(1);
        if ("contacts".equals(entity)) assertThat(workspace.load(owner).data().customers().getFirst().contacts()).hasSize(1);
        if ("notes".equals(entity)) assertThat(workspace.load(owner).data().customers().getFirst().notes()).isEqualTo("Atomic notes 😀");
        if ("articles".equals(entity)) {
            assertThat(workspace.load(owner).data().wiki().articles()).hasSize(2);
            assertThat(workspace.load(owner).data().wiki().articles().getLast().parentId()).isEqualTo(1L);
        }
        if ("update".equals(entity)) {
            assertThat(workspace.load(owner).data().customers()).hasSize(1);
            assertThat(workspace.load(owner).data().customers().getFirst().name()).isEqualTo("Atomic test record");
        }
        if ("files".equals(entity)) assertThat(workspace.attachment(owner, 1, 1).bytes()).isEqualTo("Atomic Grüße 😀".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        if ("users".equals(entity)) assertThat(accounts.findByEmail(fields.get("email"))).isPresent();
        assertThat(actions.mutate(context, conversation.id(), result.mutation().id(), input).resultRevision()).isEqualTo(created.resultRevision());
        var reloaded = tx(() -> new JpaConversationStore(em, json, properties).get(owner, conversation.id()));
        assertThat(reloaded.messages().getLast().tools().getFirst().result().mutation().status()).isEqualTo("succeeded");
    }
    @Test void confirmedTurnsExecutionHistoryAndActionStatusSurviveASeparateAdapterWithoutReissuingGrants() {
        var owner = owner(); var conversation = store.create(owner, "en"); var pending = pending(owner, conversation.id());
        var started = java.time.Instant.now();
        store.record(pending, new ExecutionStep(1, "propose_project_navigation", "{\"project\":\"#17\",\"view\":\"overview\"}", "started", null, started, null));
        store.record(pending, new ExecutionStep(1, "propose_project_navigation", "{\"project\":\"#17\",\"view\":\"overview\"}", "completed", "OK", started, java.time.Instant.now()));
        var turn = store.complete(pending, navigation(), 3); var action = turn.assistant().tools().getFirst().result().action();
        var grant = store.decide(owner, conversation.id(), action.id(), 3, new NavigationActions.DecisionInput(UUID.randomUUID(), "approve"));
        assertThat(grant.executionId()).isNotNull();
        var fresh = new JpaConversationStore(em, json, properties);
        var loaded = tx(() -> fresh.get(owner, conversation.id()));
        assertThat(loaded.messages()).hasSize(2); assertThat(loaded.busy()).isFalse();
        assertThat(loaded.messages().getLast().tools().getFirst().result().action().status()).isEqualTo("approved");
        assertThat(json.writeValueAsString(loaded)).doesNotContain(grant.executionId().toString(), "sessionVersion", "executionId");
        assertThat(tx(() -> fresh.executions(owner, conversation.id())).getFirst().steps().getFirst().arguments()).contains("#17");
        failure(() -> tx(() -> fresh.decide(owner, conversation.id(), action.id(), 3, new NavigationActions.DecisionInput(UUID.randomUUID(), "approve"))), 409, "AI_ACTION_DECIDED");
        store.report(owner, conversation.id(), action.id(), 3, new NavigationActions.ResultInput(grant.executionId(), "succeeded", null));
        var replay = tx(() -> fresh.begin(owner, conversation.id(), new SendMessage(pending.requestId(), pending.message())));
        assertThat(replay.replay().assistant().tools().getFirst().result().action().status()).isEqualTo("succeeded");
        assertThat(store.executions(owner, conversation.id())).hasSize(1);
        org.mockito.Mockito.verifyNoInteractions(gateway);
    }
    @Test void aNewBackendApplicationCanReadTheCommittedConversationFromTheSameDatabase() {
        var owner = owner(); var id = store.create(owner, "en").id();
        store.complete(pending(owner, id), new AiModelGateway.Reply("Persisted across backend instances", 1, 1, false));
        try (var fresh = new org.springframework.boot.builder.SpringApplicationBuilder(de.forgeflow.BackendApplication.class)
                .bannerMode(org.springframework.boot.Banner.Mode.OFF).profiles("postgres").run(
                    "--server.address=127.0.0.1", "--server.port=0", "--forgeflow.ai.enabled=true", "--forgeflow.ai.api-key=test-only-key", "--forgeflow.ai.model=test-only-model",
                    "--spring.datasource.url=" + URL, "--spring.datasource.username=" + USER, "--spring.datasource.password=" + PASSWORD,
                    "--spring.flyway.locations=" + MIGRATIONS, "--spring.flyway.schemas=" + SCHEMA, "--spring.flyway.default-schema=" + SCHEMA,
                    "--spring.datasource.hikari.schema=" + SCHEMA, "--spring.jpa.properties.hibernate.default_schema=" + SCHEMA, "--logging.level.root=WARN")) {
            var reloaded = fresh.getBean(ConversationStore.class).get(owner, id);
            assertThat(reloaded.messages().getLast().content()).isEqualTo("Persisted across backend instances");
            assertThat(fresh.getBean(ConversationStore.class).executions(owner, id).getFirst().status()).isEqualTo("succeeded");
        }
    }
    @Test void rowLocksAllowOneWriterAndOneApprovalAcrossConcurrentRequests() throws Exception {
        var owner = owner(); var id = store.create(owner, "de").id();
        try (var executor = Executors.newFixedThreadPool(2)) {
            var results = executor.invokeAll(List.<Callable<ConversationStore.PendingTurn>>of(() -> beginOrNull(owner, id), () -> beginOrNull(owner, id)));
            var pending = results.stream().map(result -> { try { return result.get(); } catch (Exception error) { throw new AssertionError(error); } }).filter(java.util.Objects::nonNull).toList();
            assertThat(pending).hasSize(1);
            var turn = store.complete(pending.getFirst(), navigation()); var actionId = turn.assistant().tools().getFirst().result().action().id();
            var approvals = executor.invokeAll(List.<Callable<Boolean>>of(() -> approve(owner, id, actionId), () -> approve(owner, id, actionId)));
            int grants = 0; for (var result : approvals) if (result.get()) grants++;
            assertThat(grants).isEqualTo(1);
        }
    }
    private ConversationStore.PendingTurn beginOrNull(String owner, UUID id) {
        try { return pending(owner, id); } catch (de.forgeflow.api.ApiFailure error) { assertThat(error.code).isEqualTo("AI_CONVERSATION_BUSY"); return null; }
    }
    private boolean approve(String owner, UUID id, UUID actionId) {
        try { return store.decide(owner, id, actionId, 0, new NavigationActions.DecisionInput(UUID.randomUUID(), "approve")).executionId() != null; }
        catch (de.forgeflow.api.ApiFailure error) { assertThat(error.code).isEqualTo("AI_ACTION_DECIDED"); return false; }
    }
    @Test void ownershipDeletionAndRetentionApplyToBothMemoryAndExecutionData() {
        var alice = owner(); var bob = owner(); var id = store.create(alice, "de").id(); var pending = pending(alice, id);
        store.complete(pending, new AiModelGateway.Reply("Test reply", 1, 1, false));
        assertThat(store.list(alice).storage()).isEqualTo("postgresql"); assertThat(store.list(alice).items()).extracting(ConversationSummary::id).contains(id);
        assertThat(store.list(bob).items()).isEmpty();
        failure(() -> store.get(bob, id), 404, "AI_CONVERSATION_NOT_FOUND");
        failure(() -> store.executions(bob, id), 404, "AI_CONVERSATION_NOT_FOUND");
        failure(() -> store.delete(bob, id), 404, "AI_CONVERSATION_NOT_FOUND");
        store.delete(alice, id); failure(() -> store.get(alice, id), 404, "AI_CONVERSATION_NOT_FOUND");
        assertThat(tx(() -> em.createQuery("select count(run) from StoredChatExecution run where run.conversationId = :id", Long.class).setParameter("id", id).getSingleResult())).isZero();
        var expired = store.create(alice, "en").id();
        var later = new TestClock(); later.now = java.time.Instant.now().plus(Duration.ofDays(31));
        var fresh = new JpaConversationStore(em, json, properties, later);
        failure(() -> tx(() -> fresh.get(alice, expired)), 404, "AI_CONVERSATION_NOT_FOUND");
        tx(() -> fresh.create(alice, "en"));
        assertThat(tx(() -> em.find(ChatEntities.ConversationRow.class, expired))).isNull();
    }
    @Test void abandonedRunsRecoverWithoutReplayAndOldTicketsCannotCommit() {
        var owner = owner(); var id = store.create(owner, "en").id(); var first = pending(owner, id);
        failure(() -> store.delete(owner, id), 409, "AI_CONVERSATION_BUSY");
        var clock = new TestClock(); clock.now = java.time.Instant.now().plusSeconds(70);
        var fresh = new JpaConversationStore(em, json, properties, clock);
        assertThat(tx(() -> fresh.get(owner, id)).busy()).isFalse();
        assertThat(tx(() -> fresh.executions(owner, id)).getFirst().status()).isEqualTo("interrupted");
        failure(() -> tx(() -> fresh.complete(first, new AiModelGateway.Reply("Late", 1, 1, false))), 409, "AI_RUN_EXPIRED");
        var next = tx(() -> fresh.begin(owner, id, new SendMessage(UUID.randomUUID(), "Explicit retry")));
        tx(() -> { fresh.abort(first); return null; });
        assertThat(tx(() -> fresh.get(owner, id)).busy()).isTrue();
        tx(() -> fresh.complete(next, new AiModelGateway.Reply("New reply", 1, 1, false)));
        assertThat(tx(() -> fresh.get(owner, id)).messages()).hasSize(2);
    }
    @Test void invalidCommitsRollbackAndFailedRunsHaveHistoryWithoutPartialConversationMessages() {
        var owner = owner(); var id = store.create(owner, "en").id(); var pending = pending(owner, id);
        var reply = navigation(); var tool = reply.tools().getFirst();
        failure(() -> store.complete(pending, new AiModelGateway.Reply("Invalid", 1, 1, false, List.of(tool, tool))), 502, "AI_TOOL_REJECTED");
        assertThat(store.get(owner, id).messages()).isEmpty();
        store.abort(pending, "failed", "AI_UNAVAILABLE");
        assertThat(store.executions(owner, id).getFirst().status()).isEqualTo("failed");
        assertThat(store.executions(owner, id).getFirst().errorCode()).isEqualTo("AI_UNAVAILABLE");
        failure(() -> store.action(owner, id, tool.result().action().id()), 404, "AI_ACTION_NOT_FOUND");
    }
    @Test void executionHistoryKeepsOnlyTheLatestFiftyRuns() {
        var owner = owner(); var id = store.create(owner, "en").id(); UUID latest = null;
        for (int index = 0; index < 52; index++) { var pending = pending(owner, id); latest = pending.ticket(); store.abort(pending, "cancelled", "AI_CANCELLED"); }
        assertThat(store.executions(owner, id)).hasSize(50); assertThat(store.executions(owner, id).getFirst().id()).isEqualTo(latest);
        assertThat(tx(() -> em.createQuery("select count(run) from StoredChatExecution run where run.conversationId = :id", Long.class).setParameter("id", id).getSingleResult())).isEqualTo(50);
    }
}
