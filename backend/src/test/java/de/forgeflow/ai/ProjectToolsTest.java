package de.forgeflow.ai;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.workspace.WorkspaceStorage;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static de.forgeflow.ai.AiTestSupport.*;

class ProjectToolsTest {
    private final Accounts accounts = mock(Accounts.class);
    private final WorkspaceStorage storage = mock(WorkspaceStorage.class);
    private final JsonMapper json = JsonMapper.builder().build();
    private final ProjectTools tools = new ProjectTools(accounts, storage, json, new TestClock());
    private final AgentExecutionContext alice = context("alice", true);
    private AgentExecutionContext context(String id, boolean admin) {
        when(accounts.findById(id)).thenReturn(Optional.of(new Accounts.User(id, id + "@example.test", "Test", "test-only-hash", admin, true, 0)));
        return new AgentExecutionContext(id, 0, () -> true);
    }
    private Task task(long id, String status) {
        return new Task(id, 1, null, "AL-" + id, "Task " + id, "private-long-description", status, "high", "2026-10-23", "2026-10-23");
    }
    private Data data(List<Project> projects, List<Task> tasks) {
        return new Data(projects, List.of(new Customer(1, "Private customer", "secret-street", "secret-city", "secret-country", "private-email", null, "secret-phone", "secret-industry")),
            tasks, List.of(), List.of(), List.of(), List.of(), new Wiki(List.of(new Article(1, "Private wiki", "private-wiki-content", null, "2026-10-23", "2026-10-23")), List.of()));
    }
    private void seed(List<Project> projects, List<Task> tasks) {
        when(storage.load("alice")).thenReturn(new Envelope(1, "revision-7", data(projects, tasks)));
        when(storage.load("bob")).thenReturn(new Envelope(1, "other-revision", data(List.of(new Project(999, 1, "foreign-secret-project", false, "2026-12-31")), List.of())));
    }
    @Test void projectionsUseTheAuthenticatedOwnerAndExcludePrivateUnrelatedFieldsEvenForAdministrators() {
        seed(List.of(new Project(1, 1, "Alpha", true, "2026-12-31")), List.of(task(1, "todo"), task(2, "inProgress"), task(3, "done")));
        var result = tools.session(alice).read("get_project_summary", "{\"project\":\"Alpha\"}");
        assertThat(result.outcome()).isEqualTo("OK"); assertThat(result.projects().getFirst().tasks()).isEqualTo(new ProjectTools.Counts(1, 1, 1));
        assertThat(result.revision()).isEqualTo("revision-7"); assertThat(result.readAt()).isNotNull();
        assertThat(json.writeValueAsString(result)).doesNotContain("private-email", "secret-street", "private-long-description", "private-wiki-content", "foreign-secret-project", "password");
        var tasks = tools.session(alice).read("list_open_tasks", "{\"project\":\"#1\",\"offset\":0}");
        assertThat(tasks.tasks()).extracting(ProjectTools.Task::id).containsExactly(1L, 2L);
        verify(storage, times(2)).load("alice"); verifyNoMoreInteractions(storage);
        assertThat(result.toString()).doesNotContain("Alpha");
    }
    @Test void missingForeignAndAmbiguousProjectsNeverChooseAnArbitraryMatch() {
        seed(List.of(new Project(1, 1, "Alpha", false, "2026-12-31"), new Project(2, 1, "ALPHA", true, "2026-12-31")), List.of());
        assertThat(tools.session(alice).read("get_project_summary", "{\"project\":\"alpha\"}").outcome()).isEqualTo("AMBIGUOUS");
        assertThat(tools.session(alice).read("get_project_summary", "{\"project\":\"#999\"}").outcome()).isEqualTo("NOT_FOUND");
        assertThat(tools.session(alice).read("get_project_summary", "{\"project\":\"foreign-secret-project\"}").projects()).isEmpty();
        var id = tools.session(alice).read("get_project_summary", "{\"project\":\"#2\"}");
        assertThat(id.outcome()).isEqualTo("OK"); assertThat(id.projects()).extracting(ProjectTools.Project::id).containsExactly(2L);
        verify(storage, never()).load("bob");
    }
    @Test void malformedUnknownAndOversizedArgumentsCannotChangeOwnerOrAccessStorage() {
        for (String input : List.of("{}", "not-json", "{\"query\":\"\",\"offset\":0,\"ownerId\":\"bob\"}",
                "{\"query\":\"\",\"offset\":-1}", "{\"query\":\"\",\"offset\":1.5}", "{\"query\":7,\"offset\":0}",
                "{\"query\":\"\",\"offset\":0} {}", "x".repeat(2049))) {
            assertThat(tools.session(alice).read("list_projects", input).outcome()).isEqualTo("INVALID_INPUT");
        }
        failure(() -> tools.session(alice).read("delete_project", "{}"), 502, "AI_TOOL_REJECTED");
        verifyNoInteractions(storage);
    }
    @Test void pagingIsStableBoundedAndReportsShortenedTextWithoutSplittingUnicodeSurrogates() {
        var projects = java.util.stream.LongStream.rangeClosed(1, 13).mapToObj(id -> new Project(id, 1, "x".repeat(199) + "👋" + id, false, "2026-12-31")).toList();
        seed(projects, List.of());
        var first = tools.session(alice).read("list_projects", "{\"query\":\"\",\"offset\":0}");
        assertThat(first.projects()).hasSize(10); assertThat(first.total()).isEqualTo(13); assertThat(first.more()).isTrue(); assertThat(first.textTruncated()).isTrue();
        assertThat(first.projects().getFirst().name()).hasSize(199);
        var next = tools.session(alice).read("list_projects", "{\"query\":\"\",\"offset\":10}");
        assertThat(next.projects()).extracting(ProjectTools.Project::id).containsExactly(11L, 12L, 13L); assertThat(next.more()).isFalse();
        assertThat(json.writeValueAsString(first)).hasSizeLessThan(8000);
    }
    @Test void toolDefinitionsContainOnlyAllowlistedInputsAndAnIdenticalCallCannotReadAgain() {
        var session = tools.session(alice);
        assertThat(session.callbacks()).extracting(callback -> callback.getToolDefinition().name()).containsExactly("get_project_summary", "list_open_tasks", "list_projects", "propose_project_navigation", "propose_workspace_create", "propose_workspace_update", "read_workspace");
        for (var callback : session.callbacks()) {
            String schema = callback.getToolDefinition().inputSchema();
            assertThat(schema).contains("\"additionalProperties\":false").doesNotContain("ownerId", "userId", "url", "password");
        }
        seed(List.of(), List.of());
        session.read("list_projects", "{\"query\":\"\",\"offset\":0}");
        failure(() -> session.read("list_projects", "{\"query\":\"\",\"offset\":0}"), 409, "AI_EXECUTION_LOOP");
        verify(storage).load("alice"); verifyNoMoreInteractions(storage);
    }
    @Test void revocationAndCancellationBeforeOrDuringStorageReadsDoNotReturnData() {
        var active = new AtomicBoolean(false); var session = tools.session(new AgentExecutionContext("alice", 0, active::get));
        failure(() -> session.read("list_projects", "{\"query\":\"\",\"offset\":0}"), 401, "UNAUTHENTICATED");
        verifyNoInteractions(storage);
        active.set(true);
        when(storage.load("alice")).thenAnswer(invocation -> { active.set(false); return new Envelope(1, "1", Data.empty()); });
        failure(() -> tools.session(new AgentExecutionContext("alice", 0, active::get)).read("list_projects", "{\"query\":\"\",\"offset\":0}"), 401, "UNAUTHENTICATED");
        failure(() -> tools.session(alice, () -> false).read("list_projects", "{\"query\":\"\",\"offset\":0}"), 409, "AI_CANCELLED");
        var running = new AtomicBoolean(true);
        when(storage.load("alice")).thenAnswer(invocation -> { running.set(false); return new Envelope(1, "1", Data.empty()); });
        failure(() -> tools.session(alice, running::get).read("list_projects", "{\"query\":\"\",\"offset\":0}"), 409, "AI_CANCELLED");
    }
}
