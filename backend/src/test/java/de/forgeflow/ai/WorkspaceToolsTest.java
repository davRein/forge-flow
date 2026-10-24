package de.forgeflow.ai;

import java.time.Duration;
import java.util.*;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.MemoryWorkspaceStorage;
import de.forgeflow.workspace.WorkspaceDtos.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static de.forgeflow.ai.AiTestSupport.*;

class WorkspaceToolsTest {
    private final Accounts accounts = mock(Accounts.class);
    private final MemoryWorkspaceStorage storage = new MemoryWorkspaceStorage();
    private final JsonMapper json = JsonMapper.builder().build();
    private final TestClock clock = new TestClock();
    private final ProjectTools tools = new ProjectTools(accounts, storage, json, clock);
    private final MemoryConversationStore conversations = new MemoryConversationStore(new AiProperties(true, "test-only", "test-only", Duration.ofSeconds(20), "completion", 1024, 100, 2, 20, 200, 50, 100000, Duration.ofHours(1)), clock);
    private final AgentActions actions = new AgentActions(accounts, storage, conversations);
    private final AgentExecutionContext context = new AgentExecutionContext("alice", 0, () -> true);
    WorkspaceToolsTest() { when(accounts.findById("alice")).thenReturn(Optional.of(new Accounts.User("alice", "alice@example.test", "Test", "test-only", true, true, 0))); }
    private record Proposal(UUID conversation, WorkspaceMutations.Action action) {}
    @Test void documentationChildPagesInheritSpaceAndMovesRequireExplicitValidConfirmation() {
        create("categories", Map.of("name", "Docs")); create("categories", Map.of("name", "Other"));
        create("articles", Map.of("title", "Root", "content", "# Root", "category", "#1"));
        var child = proposal("articles", Map.of("title", "Child", "content", "Child text", "parent", "#1"));
        assertThat(child.action().data().get("parentId").longValue()).isEqualTo(1L);
        assertThat(child.action().data().get("categoryId").longValue()).isEqualTo(1L);
        assertThat(storage.load("alice").data().wiki().articles()).hasSize(1);
        assertThat(conversations.state("alice", child.conversation()).version()).isEqualTo(5);
        decide(child, "approve"); decide(child, "approve");
        assertThat(storage.load("alice").data().wiki().articles()).hasSize(2);
        var result = tools.session(context).read("read_workspace", json.writeValueAsString(Map.of("entity", "articles", "query", "", "project", "", "mode", "count", "offset", 0, "textOffset", 0,
            "filters", List.of(Map.of("field", "parentId", "operator", "eq", "value", "1")))));
        assertThat(result.total()).isEqualTo(1);
        assertThatThrownBy(() -> update("articles", "#1", Map.of("parent", "#2"))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        assertThatThrownBy(() -> proposal("articles", Map.of("title", "Wrong", "content", "Text", "category", "#2", "parent", "#1"))).isInstanceOf(de.forgeflow.api.ApiFailure.class);
        var move = update("articles", "#2", Map.of("parent", ""));
        assertThat(storage.load("alice").data().wiki().articles().get(1).parentId()).isEqualTo(1L);
        decide(move, "approve"); assertThat(storage.load("alice").data().wiki().articles().get(1).parentId()).isNull();
        assertThat(storage.load("bob").data().wiki().articles()).isEmpty();
    }
    @Test void contactsAndCustomerNotesUseExplicitOwnedCreationAndFieldUpdatesWithBoundedReadResults() {
        create("customers", Map.of("name", "One", "notes", "  Existing note 😀\n")); create("customers", Map.of("name", "Two"));
        var contact = proposal("contacts", Map.of("customer", "#1", "name", "First", "role", "Manager", "email", "first@example.test"));
        assertThat(storage.load("alice").data().customers().getFirst().contacts()).isEmpty();
        decide(contact, "approve"); decide(contact, "approve");
        create("contacts", Map.of("customer", "#2", "name", "Second", "phone", "123"));
        var query = json.writeValueAsString(Map.of("entity", "contacts", "query", "", "project", "", "mode", "list", "offset", 0, "textOffset", 0,
            "filters", List.of(Map.of("field", "customerId", "operator", "eq", "value", "1"))));
        var result = tools.session(context).read("read_workspace", query);
        assertThat(result.total()).isEqualTo(1); assertThat(result.workspace().items().getFirst().fields()).containsEntry("name", "First").containsEntry("role", "Manager");
        var customer = read("customers", "#1", "detail", 0, 0).workspace().items().getFirst().fields();
        assertThat(customer).containsEntry("notes", "  Existing note 😀\n").containsEntry("contactCount", "1").doesNotContainKey("contacts");
        assertThat(read("customers", "#1", "list", 0, 0).workspace().items().getFirst().fields()).doesNotContainKey("notes");
        decide(update("contacts", "#1", Map.of("role", "Director", "phone", "+49 123")), "approve");
        decide(update("customers", "#1", Map.of("notes", "  Changed note\n")), "approve");
        var saved = storage.load("alice").data().customers().getFirst();
        assertThat(saved.contacts()).hasSize(1); assertThat(saved.contacts().getFirst().role()).isEqualTo("Director"); assertThat(saved.notes()).isEqualTo("  Changed note\n");
        assertThat(storage.load("alice").data().customers().get(1).contacts().getFirst().name()).isEqualTo("Second");
        assertThat(storage.load("bob").data().customers()).isEmpty();
    }
    @Test void contactProposalsRejectUnknownCustomersBadDataReparentingAndStaleRevisionsWithoutWriting() {
        create("customers", Map.of("name", "One"));
        failure(() -> proposal("contacts", Map.of("customer", "#999", "name", "Foreign")), 422, "AI_CREATE_INVALID");
        failure(() -> proposal("contacts", Map.of("customer", "#1", "name", "Invalid", "email", "bad")), 422, "AI_CREATE_INVALID");
        var rejected = proposal("contacts", Map.of("customer", "#1", "name", "Rejected")); decide(rejected, "reject");
        assertThat(storage.load("alice").data().customers().getFirst().contacts()).isEmpty();
        create("contacts", Map.of("customer", "#1", "name", "Original"));
        failure(() -> update("contacts", "#1", Map.of("customerId", "2")), 422, "AI_CREATE_INVALID");
        failure(() -> update("contacts", "#1", Map.of("administrator", "true")), 422, "AI_CREATE_INVALID");
        var stale = update("contacts", "#1", Map.of("name", "Stale")); decide(update("customers", "#1", Map.of("name", "Changed")), "approve");
        failure(() -> decide(stale, "approve"), 409, "AI_CREATE_CONFLICT");
        assertThat(storage.load("alice").data().customers().getFirst().contacts().getFirst().name()).isEqualTo("Original");
        assertThat(conversations.state("alice", stale.conversation()).version()).isEqualTo(4);
    }
    @Test void customerPostalCodesAndSharedIndustryChoicesAreAvailableThroughExistingAiTools() {
        create("customers", Map.of("name", "Postal customer", "postalCode", "01234"));
        assertThat(read("customers", "#1", "detail", 0, 0).workspace().items().getFirst().fields()).containsEntry("postalCode", "01234");
        decide(update("customers", "#1", Map.of("postalCode", "SW1A 1AA")), "approve");
        assertThat(storage.load("alice").data().customers().getFirst().postalCode()).isEqualTo("SW1A 1AA");
        assertThat(read("industries", "", "count", 0, 0).total()).isEqualTo(storage.loadGlobalSettings().industries().size());
        var global = storage.loadGlobalSettings(); storage.saveGlobalSettings(new de.forgeflow.workspace.GlobalSettings(global.revision(), List.of("New global industry")));
        assertThat(read("industries", "", "list", 0, 0).workspace().items().getFirst().label()).isEqualTo("New global industry");
    }
    private Proposal update(String entity, String target, Map<String, String> fields) {
        var result = tools.session(context).read("propose_workspace_update", updateInput(entity, target, fields));
        var conversation = conversations.create("alice", "de"); var pending = conversations.begin("alice", conversation.id(), new AgentDtos.SendMessage(UUID.randomUUID(), "Update test record"));
        conversations.complete(pending, new AiModelGateway.Reply("Please confirm changes", 1, 1, false,
            List.of(new AgentDtos.ToolEvent(UUID.randomUUID(), "propose_workspace_update", "completed", result))));
        return new Proposal(conversation.id(), result.mutation());
    }
    private String updateInput(String entity, String target, Map<String, String> fields) {
        return json.writeValueAsString(Map.of("entity", entity, "target", target, "fields", fields.entrySet().stream().map(entry -> Map.of("name", entry.getKey(), "value", entry.getValue())).toList()));
    }
    @Test void updateReferencesStayWithinTheOwnedProjectAndActiveOrCompletedSprintsRemainProtected() {
        create("customers", Map.of("name", "One")); create("customers", Map.of("name", "Two"));
        create("projects", Map.of("name", "One", "customer", "#1", "deadline", "2026-12-31"));
        create("projects", Map.of("name", "Two", "customer", "#2", "deadline", "2026-12-31"));
        create("epics", Map.of("project", "#2", "title", "Other project epic"));
        create("tasks", Map.of("project", "#1", "title", "Own task")); create("tasks", Map.of("project", "#2", "title", "Other project task"));
        create("sprints", Map.of("project", "#1", "title", "Sprint", "startDate", "2026-10-24", "endDate", "2026-11-01"));
        failure(() -> update("tasks", "#1", Map.of("epic", "#1")), 422, "AI_CREATE_INVALID");
        failure(() -> update("sprints", "#1", Map.of("tasks", "#2")), 422, "AI_CREATE_INVALID");
        failure(() -> update("projects", "#1", Map.of("customer", "#999")), 422, "AI_CREATE_INVALID");
        decide(update("projects", "#1", Map.of("customer", "#2")), "approve");
        assertThat(storage.load("alice").data().projects().getFirst().customerId()).isEqualTo(2);
        var saved = storage.load("alice"); var data = saved.data(); var sprint = data.sprints().getFirst();
        var active = new Sprint(sprint.id(), sprint.projectId(), sprint.title(), sprint.goal(), sprint.startDate(), sprint.endDate(), "active", sprint.taskIds(), sprint.createdAt(), sprint.updatedAt(), clock.instant().toString(), null);
        storage.save("alice", saved.revision(), new Data(data.projects(), data.customers(), data.tasks(), data.activities(), data.epics(), List.of(active), data.files(), data.wiki()), Map.of());
        failure(() -> update("sprints", "#1", Map.of("title", "Forbidden")), 422, "AI_CREATE_INVALID");
        var current = storage.load("alice"); var completed = new Sprint(active.id(), active.projectId(), active.title(), active.goal(), active.startDate(), active.endDate(), "completed", active.taskIds(), active.createdAt(), active.updatedAt(), active.startedAt(), new Completion(clock.instant().toString(), List.of()));
        storage.save("alice", current.revision(), new Data(data.projects(), data.customers(), data.tasks(), data.activities(), data.epics(), List.of(completed), data.files(), data.wiki()), Map.of());
        failure(() -> update("sprints", "#1", Map.of("title", "Forbidden")), 422, "AI_CREATE_INVALID");
    }
    @Test void simultaneousUpdateApprovalsCommitOnlyOneRevisionAndOneActivity() throws Exception {
        create("customers", Map.of("name", "One")); create("projects", Map.of("name", "One", "customer", "#1", "deadline", "2026-12-31"));
        create("tasks", Map.of("project", "#1", "title", "Task")); var proposal = update("tasks", "#1", Map.of("status", "done"));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var results = executor.invokeAll(List.<Callable<WorkspaceMutations.Action>>of(() -> decide(proposal, "approve"), () -> decide(proposal, "approve")));
            assertThat(results.get(0).get().resultRevision()).isEqualTo(results.get(1).get().resultRevision());
        }
        assertThat(storage.load("alice").data().activities()).extracting(Activity::type).containsExactly("task_created", "task_updated");
    }
    @Test void updatesShowExactBeforeAndAfterPreserveUnspecifiedFieldsAndRequireExplicitConfirmation() {
        create("customers", Map.of("name", "Original", "city", "Bonn", "email", "keep@example.test"));
        create("projects", Map.of("name", "Project", "customer", "#1", "deadline", "2026-12-31"));
        create("epics", Map.of("project", "#1", "title", "Epic"));
        create("tasks", Map.of("project", "#1", "title", "Task", "description", "Keep this description", "epic", "#1"));
        create("sprints", Map.of("project", "#1", "title", "Sprint", "startDate", "2026-10-24", "endDate", "2026-11-01"));
        create("categories", Map.of("name", "Category")); create("articles", Map.of("title", "Article", "content", "Original text", "category", "#1"));
        var proposal = update("customers", "Original", Map.of("city", "Köln"));
        assertThat(proposal.action().type()).isEqualTo("workspace.update");
        assertThat(proposal.action().before().get("city").asText()).isEqualTo("Bonn");
        assertThat(proposal.action().data().get("city").asText()).isEqualTo("Köln");
        assertThat(storage.load("alice").data().customers().getFirst().city()).isEqualTo("Bonn");
        decide(proposal, "approve"); assertThat(storage.load("alice").data().customers().getFirst().email()).isEqualTo("keep@example.test");
        decide(update("projects", "#1", Map.of("deadline", "2027-01-31", "planningCompleted", "true")), "approve");
        decide(update("tasks", "#1", Map.of("status", "done", "priority", "high", "epic", "")), "approve");
        decide(update("epics", "#1", Map.of("title", "Changed epic")), "approve");
        decide(update("sprints", "#1", Map.of("tasks", "#1", "goal", "New goal")), "approve");
        decide(update("articles", "#1", Map.of("content", "  Grüße 😀\n", "category", "")), "approve");
        decide(update("categories", "#1", Map.of("name", "Changed category")), "approve");
        var data = storage.load("alice").data();
        assertThat(data.projects().getFirst().deadline()).isEqualTo("2027-01-31"); assertThat(data.projects().getFirst().planningCompleted()).isTrue();
        assertThat(data.tasks().getFirst().status()).isEqualTo("done"); assertThat(data.tasks().getFirst().epicId()).isNull();
        assertThat(data.tasks().getFirst().description()).isEqualTo("Keep this description"); assertThat(data.tasks().getFirst().code()).isEqualTo("TASK-1");
        assertThat(data.sprints().getFirst().taskIds()).containsExactly(1L); assertThat(data.wiki().articles().getFirst().content()).isEqualTo("  Grüße 😀\n");
        assertThat(data.wiki().articles().getFirst().categoryId()).isNull(); assertThat(data.customers()).hasSize(1); assertThat(data.tasks()).hasSize(1);
        assertThat(data.activities()).extracting(Activity::type).contains("task_updated", "epic_updated", "sprint_updated");
    }
    @Test void updateRejectionConflictExpiryRevocationAndOwnershipCannotOverwriteOrDuplicateRecords() {
        create("customers", Map.of("name", "Before")); var rejected = update("customers", "#1", Map.of("name", "Rejected")); decide(rejected, "reject");
        assertThat(storage.load("alice").data().customers().getFirst().name()).isEqualTo("Before");
        var stale = update("customers", "#1", Map.of("name", "Stale")); var current = storage.load("alice"); storage.save("alice", current.revision(), current.data(), Map.of());
        failure(() -> decide(stale, "approve"), 409, "AI_CREATE_CONFLICT");
        var expired = update("customers", "#1", Map.of("name", "Expired")); clock.advance(Duration.ofMinutes(6)); failure(() -> decide(expired, "approve"), 409, "AI_ACTION_EXPIRED");
        var fresh = update("customers", "#1", Map.of("name", "After"));
        failure(() -> conversations.mutate("bob", fresh.conversation(), fresh.action().id(), 0, new NavigationActions.DecisionInput(UUID.randomUUID(), "approve"), action -> "never"), 404, "AI_CONVERSATION_NOT_FOUND");
        var result = decide(fresh, "approve"); assertThat(decide(fresh, "approve").resultRevision()).isEqualTo(result.resultRevision());
        assertThat(storage.load("alice").data().customers()).hasSize(1); assertThat(storage.load("alice").data().customers().getFirst().name()).isEqualTo("After");
        var revoked = update("customers", "#1", Map.of("name", "Revoked")); when(accounts.findById("alice")).thenReturn(Optional.empty());
        failure(() -> decide(revoked, "approve"), 401, "UNAUTHENTICATED");
    }
    @Test void updateWhitelistsRejectSecretsBeforeAuditAndRejectInvalidAmbiguousNoOpOrOversizedPreviews() {
        create("customers", Map.of("name", "Same")); create("customers", Map.of("name", "Same"));
        var audit = new ArrayList<AgentDtos.ExecutionStep>();
        for (String key : List.of("password", "administrator", "id", "ownerId", "createdAt", "project"))
            failure(() -> tools.session(context, () -> true, null, audit::add).read("propose_workspace_update", updateInput("customers", "#1", Map.of(key, "forbidden"))), 422, "AI_CREATE_INVALID");
        assertThat(audit).isEmpty();
        failure(() -> update("customers", "Same", Map.of("city", "Berlin")), 422, "AI_CREATE_INVALID");
        failure(() -> update("customers", "#999", Map.of("city", "Berlin")), 422, "AI_CREATE_INVALID");
        failure(() -> update("customers", "#1", Map.of("name", "Same")), 422, "AI_CREATE_INVALID");
        failure(() -> update("customers", "#1", Map.of("name", "")), 422, "AI_CREATE_INVALID");
        failure(() -> update("users", "#1", Map.of("name", "No account edits")), 422, "AI_CREATE_INVALID");
        create("projects", Map.of("name", "Project", "customer", "#1", "deadline", "2026-12-31"));
        failure(() -> update("projects", "#1", Map.of("deadline", "invalid")), 422, "INVALID_WORKSPACE");
        create("tasks", Map.of("project", "#1", "title", "Task")); failure(() -> update("tasks", "#1", Map.of("status", "unknown")), 422, "AI_CREATE_INVALID");
        var before = storage.load("alice"); var old = before.data(); var now = clock.instant().toString();
        storage.save("alice", before.revision(), new Data(old.projects(), old.customers(), old.tasks(), old.activities(), old.epics(), old.sprints(), old.files(),
            new Wiki(List.of(new Article(1, "Long", "x".repeat(10000), null, now, now)), List.of())), Map.of());
        decide(update("articles", "#1", Map.of("title", "Renamed")), "approve");
        assertThat(storage.load("alice").data().wiki().articles().getFirst().content()).hasSize(10000);
        failure(() -> update("articles", "#1", Map.of("content", "Short")), 422, "AI_CREATE_INVALID");
    }
    @Test void fileRenamePreservesExactBytesAndUpdateHistoryRoundTripsWithoutExecutingAgain() {
        create("customers", Map.of("name", "Files")); create("projects", Map.of("name", "Files", "customer", "#1", "deadline", "2026-12-31"));
        create("files", Map.of("project", "#1", "name", "before.txt", "content", "Bytes 😀\n"));
        var bytes = storage.attachment("alice", 1, 1).bytes(); var proposal = update("files", "#1", Map.of("name", "after.txt"));
        assertThat(json.writeValueAsString(proposal.action())).doesNotContain("Bytes");
        var state = conversations.state("alice", proposal.conversation()); assertThat(state.version()).isEqualTo(3);
        var copy = new MemoryConversationStore(new AiProperties(true, "test-only", "test-only", Duration.ofSeconds(20), "completion", 1024, 100, 2, 20, 200, 50, 100000, Duration.ofHours(1)), clock);
        copy.restore(json.readValue(json.writeValueAsString(state), ConversationState.class));
        assertThat(copy.get("alice", proposal.conversation()).messages().getLast().tools().getFirst().result().mutation().before()).isEqualTo(proposal.action().before());
        var action = new AgentActions(accounts, storage, copy); var input = new NavigationActions.DecisionInput(UUID.randomUUID(), "approve");
        action.mutate(context, proposal.conversation(), proposal.action().id(), input); action.mutate(context, proposal.conversation(), proposal.action().id(), input);
        assertThat(storage.attachment("alice", 1, 1).bytes()).isEqualTo(bytes); assertThat(storage.load("alice").data().files().getFirst().name()).isEqualTo("after.txt");
        assertThat(storage.load("alice").data().activities()).extracting(Activity::type).containsExactly("file_renamed");
        failure(() -> update("files", "#1", Map.of("content", "No file overwrites")), 422, "AI_CREATE_INVALID");
    }
    private Proposal proposal(String entity, Map<String, String> fields) {
        var result = tools.session(context).read("propose_workspace_create", json.writeValueAsString(Map.of("entity", entity, "fields", fields.entrySet().stream().map(entry -> Map.of("name", entry.getKey(), "value", entry.getValue())).toList())));
        var conversation = conversations.create("alice", "de"); var pending = conversations.begin("alice", conversation.id(), new AgentDtos.SendMessage(UUID.randomUUID(), "Create test record"));
        conversations.complete(pending, new AiModelGateway.Reply("Please confirm", 1, 1, false, List.of(new AgentDtos.ToolEvent(UUID.randomUUID(), "propose_workspace_create", "completed", result))));
        return new Proposal(conversation.id(), result.mutation());
    }
    private WorkspaceMutations.Action decide(Proposal proposal, String decision) { return actions.mutate(context, proposal.conversation(), proposal.action().id(), new NavigationActions.DecisionInput(UUID.randomUUID(), decision)); }
    private void create(String entity, Map<String, String> fields) { assertThat(decide(proposal(entity, fields), "approve").status()).isEqualTo("succeeded"); }
    private ProjectTools.Result read(String entity, String query, String mode, int offset, int textOffset) {
        return tools.session(context).read("read_workspace", json.writeValueAsString(Map.of("entity", entity, "query", query, "project", "", "mode", mode, "offset", offset, "textOffset", textOffset)));
    }
    @Test void allSevenCreationTypesAreTypedLinkedAndVisibleOnlyAfterExplicitConfirmation() {
        var customer = proposal("customers", Map.of("name", "Kunde Ü", "email", "contact@example.test"));
        assertThat(storage.load("alice").data().customers()).isEmpty(); decide(customer, "approve");
        create("projects", Map.of("name", "Alpha", "customer", "#1", "deadline", "2026-12-31"));
        create("epics", Map.of("project", "#1", "title", "Epic Ü"));
        storage.saveSettings("alice", new Settings(1, new SettingsValues("dark", "dashboard", "high")));
        create("tasks", Map.of("project", "Alpha", "epic", "#1", "title", "Task Ü", "status", "done"));
        create("sprints", Map.of("project", "#1", "title", "Sprint Ü", "startDate", "2026-10-24", "endDate", "2026-11-02", "tasks", "#1"));
        create("categories", Map.of("name", "Dokumentation")); create("articles", Map.of("title", "Grüße", "content", "Untrusted <script>data</script>", "category", "#1"));
        var data = storage.load("alice").data();
        assertThat(data.tasks().getFirst().priority()).isEqualTo("high"); assertThat(data.tasks().getFirst().epicId()).isEqualTo(1);
        assertThat(data.sprints().getFirst().taskIds()).containsExactly(1L); assertThat(data.activities()).hasSize(3);
        for (String entity : List.of("customers", "projects", "tasks", "activities", "epics", "sprints", "files", "articles", "categories")) assertThat(read(entity, "", "count", 0, 0).total()).isEqualTo("activities".equals(entity) ? 3 : "files".equals(entity) ? 0 : 1);
        assertThat(read("tasks", "", "list", 0, 0).workspace().items().getFirst().fields()).containsEntry("status", "done");
        assertThat(read("articles", "#1", "detail", 0, 0).workspace().items().getFirst().fields()).containsEntry("content", "Untrusted <script>data</script>");
    }
    @Test void customerCountDoesNotDependOnProjectsAndDetailedQueriesArePaginatedAndAccountLocal() {
        for (int index = 0; index < 13; index++) create("customers", Map.of("name", "Customer " + index));
        assertThat(read("customers", "", "count", 0, 0).total()).isEqualTo(13); assertThat(read("projects", "", "count", 0, 0).total()).isZero();
        var page = read("customers", "", "list", 10, 0); assertThat(page.workspace().items()).hasSize(3); assertThat(page.more()).isFalse();
        create("articles", Map.of("title", "Long", "content", "a".repeat(1999) + "😀" + "b".repeat(2100)));
        var first = read("articles", "#1", "detail", 0, 0); assertThat(first.textTruncated()).isTrue(); assertThat(first.workspace().items().getFirst().fields().get("content")).hasSize(1999);
        assertThat(read("articles", "#1", "detail", 0, 2000).workspace().items().getFirst().fields().get("content")).startsWith("😀");
        assertThat(storage.load("bob").data().customers()).isEmpty();
    }
    @Test void invalidOwnershipFieldsReferencesAndMalformedCreationValuesCannotWriteOrBeAudited() {
        var audited = new ArrayList<AgentDtos.ExecutionStep>();
        for (String field : List.of("ownerId", "administrator", "password", "id")) {
            String input = json.writeValueAsString(Map.of("entity", "customers", "fields", List.of(Map.of("name", field, "value", "invalid"))));
            failure(() -> tools.session(context, () -> true, null, audited::add).read("propose_workspace_create", input), 422, "AI_CREATE_INVALID");
        }
        assertThat(audited).isEmpty();
        failure(() -> proposal("projects", Map.of("name", "Foreign", "customer", "#999", "deadline", "2026-12-31")), 422, "AI_CREATE_INVALID");
        failure(() -> proposal("customers", Map.of("name", "x".repeat(1001))), 422, "AI_CREATE_INVALID");
        failure(() -> proposal("articles", Map.of("title", "Empty content")), 422, "AI_CREATE_INVALID");
        assertThat(storage.load("alice").data().customers()).isEmpty();
    }
    @Test void filteredCountsAndFullTextSearchDoNotRequireEnumeratingPagesAndEquivalentFiltersCannotLoop() {
        create("customers", Map.of("name", "Filters customer")); create("projects", Map.of("name", "Filters project", "customer", "#1", "deadline", "2026-12-31"));
        create("tasks", Map.of("project", "#1", "title", "High open", "priority", "high")); create("tasks", Map.of("project", "#1", "title", "Done", "priority", "high", "status", "done"));
        String input = json.writeValueAsString(Map.of("entity", "tasks", "query", "", "project", "", "mode", "count", "offset", 0, "textOffset", 0,
            "filters", List.of(Map.of("field", "priority", "operator", "eq", "value", "high"), Map.of("field", "status", "operator", "eq", "value", "todo"))));
        var session = tools.session(context); var result = session.read("read_workspace", input); assertThat(result.total()).isEqualTo(1); assertThat(result.workspace().items()).isEmpty();
        failure(() -> session.read("read_workspace", input.replace("high", "HIGH")), 409, "AI_EXECUTION_LOOP");
        create("articles", Map.of("title", "Ordinary title", "content", "Find the unique-body-marker inside the article"));
        assertThat(read("articles", "unique-body-marker", "count", 0, 0).total()).isEqualTo(1);
        failure(() -> tools.session(context).read("read_workspace", input.replace("priority", "passwordHash")), 422, "AI_CREATE_INVALID");
        failure(() -> tools.session(context).read("read_workspace", input.replace("\"tasks\"", "\"customers\"")), 422, "AI_CREATE_INVALID");
    }
    @Test void rejectionExpirySessionRevocationAndWorkspaceConflictsCannotCreateRecords() {
        var rejected = proposal("customers", Map.of("name", "Rejected")); decide(rejected, "reject"); failure(() -> decide(rejected, "approve"), 409, "AI_ACTION_DECIDED");
        var expired = proposal("customers", Map.of("name", "Expired")); clock.advance(Duration.ofMinutes(6)); failure(() -> decide(expired, "approve"), 409, "AI_ACTION_EXPIRED");
        var stale = proposal("customers", Map.of("name", "Stale")); var state = storage.load("alice"); storage.save("alice", state.revision(), state.data(), Map.of());
        failure(() -> decide(stale, "approve"), 409, "AI_CREATE_CONFLICT");
        var fresh = proposal("customers", Map.of("name", "Revoked")); when(accounts.findById("alice")).thenReturn(Optional.empty());
        failure(() -> decide(fresh, "approve"), 401, "UNAUTHENTICATED"); assertThat(storage.load("alice").data().customers()).isEmpty();
    }
    @Test void concurrentAndRepeatedApprovalCreatesExactlyOneRecordAndAnUnchangedReplay() throws Exception {
        var proposal = proposal("customers", Map.of("name", "Once"));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var results = executor.invokeAll(List.<Callable<WorkspaceMutations.Action>>of(() -> decide(proposal, "approve"), () -> decide(proposal, "approve")));
            assertThat(results.get(0).get().resultRevision()).isEqualTo(results.get(1).get().resultRevision());
        }
        assertThat(storage.load("alice").data().customers()).hasSize(1);
        var loaded = conversations.get("alice", proposal.conversation()); assertThat(loaded.messages().getLast().tools().getFirst().result().mutation().status()).isEqualTo("succeeded");
        failure(() -> conversations.mutate("bob", proposal.conversation(), proposal.action().id(), 0, new NavigationActions.DecisionInput(UUID.randomUUID(), "approve"), action -> "invalid"), 404, "AI_CONVERSATION_NOT_FOUND");
    }
    @Test void textFilesPreserveBytesAndCanBeReadWithoutReadingAnyLocalFilesystemPath() {
        create("customers", Map.of("name", "Files customer")); create("projects", Map.of("name", "Files project", "customer", "#1", "deadline", "2026-12-31"));
        String content = "    Grüße 😀\n";
        create("files", Map.of("project", "#1", "name", "notes.md", "mediaType", "text/markdown", "content", content));
        assertThat(storage.attachment("alice", 1, 1).bytes()).isEqualTo(content.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(read("files", "#1", "detail", 0, 0).workspace().items().getFirst().fields()).containsEntry("content", content);
        create("files", Map.of("project", "#1", "name", "empty.txt", "content", "")); assertThat(storage.attachment("alice", 1, 2).bytes()).isEmpty();
        failure(() -> proposal("files", Map.of("project", "#1", "name", "../private.txt", "content", "invalid")), 422, "INVALID_WORKSPACE");
        failure(() -> proposal("files", Map.of("project", "#1", "name", "NOTES.md", "content", "duplicate")), 422, "INVALID_WORKSPACE");
    }
    @Test void legacyAggregatesRemainReadableAndOnlyNewWorkspaceResultsUseTheExtendedFormat() {
        var legacy = conversations.create("alice", "de");
        var pending = conversations.begin("alice", legacy.id(), new AgentDtos.SendMessage(UUID.randomUUID(), "Legacy message"));
        conversations.complete(pending, new AiModelGateway.Reply("Legacy answer", 1, 1, false));
        String payload = json.writeValueAsString(conversations.state("alice", legacy.id()));
        assertThat(payload).contains("\"version\":1").doesNotContain("\"mutations\"", "\"workspace\"");
        var restored = new MemoryConversationStore(properties(), clock); restored.restore(json.readValue(payload, ConversationState.class));
        assertThat(restored.get("alice", legacy.id()).messages().getLast().content()).isEqualTo("Legacy answer");
        var proposal = proposal("customers", Map.of("name", "Extended format"));
        assertThat(conversations.state("alice", proposal.conversation()).version()).isEqualTo(4);
    }
    @Test void onlyAdministratorsCanQueryOrCreateUsersAndThePrivatePasswordNeverEntersTheProposalOrTranscript() {
        var inserted = new java.util.concurrent.atomic.AtomicReference<Accounts.User>();
        when(accounts.insert(org.mockito.ArgumentMatchers.any())).thenAnswer(call -> { inserted.set(call.getArgument(0)); return inserted.get(); });
        var proposal = proposal("users", Map.of("name", "New account", "email", "new-account@example.test"));
        failure(() -> decide(proposal, "approve"), 400, "INVALID_PASSWORD"); assertThat(inserted.get()).isNull();
        String password = "Synthetic-only-password-123";
        var input = new WorkspaceMutations.DecisionInput(UUID.randomUUID(), "approve", password);
        var result = actions.mutate(context, proposal.conversation(), proposal.action().id(), input);
        assertThat(result.status()).isEqualTo("succeeded"); assertThat(inserted.get().administrator()).isFalse();
        assertThat(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().matches(password, inserted.get().passwordHash())).isTrue();
        assertThat(json.writeValueAsString(input)).doesNotContain(password);
        assertThat(json.writeValueAsString(conversations.get("alice", proposal.conversation()))).doesNotContain(password, inserted.get().passwordHash(), "sessionVersion");
        decide(proposal, "approve"); verify(accounts, times(1)).insert(org.mockito.ArgumentMatchers.any());
        when(accounts.list()).thenReturn(List.of(inserted.get())); assertThat(read("users", "", "count", 0, 0).total()).isEqualTo(1);
        assertThat(json.writeValueAsString(read("users", "", "detail", 0, 0))).doesNotContain(password, inserted.get().passwordHash(), "sessionVersion");
        when(accounts.findById("alice")).thenReturn(Optional.of(new Accounts.User("alice", "alice@example.test", "Normal", "test-only", false, true, 0)));
        failure(() -> read("users", "", "count", 0, 0), 403, "FORBIDDEN");
        failure(() -> proposal("users", Map.of("name", "Forbidden", "email", "forbidden@example.test")), 403, "FORBIDDEN");
        assertThat(read("profile", "", "detail", 0, 0).total()).isEqualTo(1); assertThat(read("settings", "", "detail", 0, 0).total()).isEqualTo(1);
    }
}
