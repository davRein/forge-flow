package de.forgeflow.ai;

import java.util.List;
import java.util.Optional;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import de.forgeflow.ai.AgentDtos.PageContext;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.WorkspaceDtos;
import de.forgeflow.workspace.WorkspaceStorage;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static de.forgeflow.ai.AiTestSupport.*;

class PageContextsTest {
    private static PageContext project(long id) { return new PageContext("/projectManager/projects", id, "tasks"); }
    private Accounts accounts() {
        var accounts = mock(Accounts.class);
        when(accounts.findById("alice")).thenReturn(Optional.of(new Accounts.User("alice", "test@example.test", "Test", "test-only-hash", true, true, 0)));
        return accounts;
    }
    private WorkspaceDtos.Envelope saved() {
        var empty = WorkspaceDtos.Data.empty();
        return new WorkspaceDtos.Envelope(1, "revision-1", new WorkspaceDtos.Data(List.of(new WorkspaceDtos.Project(17, 1, "Private name", false, "2026-12-31")),
            empty.customers(), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki()));
    }
    @Test void closedNavigationSchemaRejectsUrlsInvalidIdsUnknownTabsAndCrossModuleSelections() {
        for (var page : List.of(new PageContext("/wiki/search?secret=value", null, null), new PageContext("https://example.test", null, null),
                project(0), project(-1), project(9_007_199_254_740_992L), new PageContext("/wiki/home", 17L, "tasks"),
                new PageContext("/projectManager/settings", 17L, null), new PageContext("/projectManager/projects", null, "tasks"),
                new PageContext("/projectManager/projects", 17L, "run_shell")))
            failure(() -> PageContexts.normalize(page), 400, "AI_INVALID_PAGE_CONTEXT");
        assertThat(PageContexts.normalize(new PageContext("/projectManager/projects", 17L, null))).isEqualTo(new PageContext("/projectManager/projects", 17L, "overview"));
        assertThat(PageContexts.normalize(null)).isNull();
        assertThat(PageContexts.metadata(new PageContext("/projectManager/projects", 17L, "tickets"))).contains("postponed", "unavailable");
        assertThat(PageContexts.metadata(new PageContext("/devTools/rest", null, null))).contains("not shared", "CORS");
        assertThat(PageContexts.metadata(new PageContext("/cloud/files", null, null))).contains("own login", "no Nextcloud tools");
    }
    @Test void selectedProjectsAreLoadedUnderTheAuthenticatedOwnerEvenForAnAdministrator() {
        var storage = mock(WorkspaceStorage.class); when(storage.load("alice")).thenReturn(saved());
        var registry = new ProjectTools(accounts(), storage, tools.jackson.databind.json.JsonMapper.builder().build(), new TestClock());
        var context = new AgentExecutionContext("alice", 0, () -> true);
        assertThat(registry.session(context, () -> true, project(17)).pageContext()).isEqualTo(project(17));
        failure(() -> registry.session(context, () -> true, project(18)), 404, "AI_PAGE_CONTEXT_UNAVAILABLE");
        verify(storage, times(2)).load("alice"); verifyNoMoreInteractions(storage);
        assertThat(PageContexts.metadata(project(17))).doesNotContain("Private name", "revision-1", "alice");
    }
    @Test void assistantRequestsRequireAnExplicitSupportedContext() {
        assertThat(PageContexts.requireSupported(new PageContext("/projectManager/projects", null, null)).route()).isEqualTo("/projectManager/projects");
        assertThat(PageContexts.requireSupported(new PageContext("/wiki/home", null, null)).route()).isEqualTo("/wiki/home");
        failure(() -> PageContexts.requireSupported(null), 403, "AI_APP_FORBIDDEN");
    }
    @Test void assistantHistoryIsSeparatedByApplicationModule() {
        var pm = new PageContext("/projectManager/projects", null, null);
        var wiki = new PageContext("/wiki/articles", null, null);
        var wikiHome = new PageContext("/wiki/home", null, null);
        var at = Instant.EPOCH;
        var history = List.of(
            new AgentDtos.Message(UUID.randomUUID(), "user", "project manager data", at, List.of(), pm),
            new AgentDtos.Message(UUID.randomUUID(), "assistant", "project manager answer", at, List.of()),
            new AgentDtos.Message(UUID.randomUUID(), "user", "wiki data", at, List.of(), wiki),
            new AgentDtos.Message(UUID.randomUUID(), "assistant", "wiki answer", at, List.of()),
            new AgentDtos.Message(UUID.randomUUID(), "user", "old tool-backed wiki data", at, List.of(), wiki),
            new AgentDtos.Message(UUID.randomUUID(), "assistant", "old tool-backed wiki answer", at,
                List.of(new AgentDtos.ToolEvent(UUID.randomUUID(), "read_workspace", "completed", null))),
            new AgentDtos.Message(UUID.randomUUID(), "user", "legacy data", at, List.of()),
            new AgentDtos.Message(UUID.randomUUID(), "assistant", "legacy answer", at, List.of()));
        assertThat(PageContexts.projectManagerHistory(history)).extracting(AgentDtos.Message::content)
            .containsExactly("project manager data", "project manager answer");
        assertThat(PageContexts.historyForModule(history, wikiHome)).extracting(AgentDtos.Message::content)
            .containsExactly("wiki data", "wiki answer");
    }
    @Test void pageHelpWithoutASelectedProjectNeedsNoWorkspaceAndRevocationDuringValidationStopsIt() {
        var storage = mock(WorkspaceStorage.class); var active = new AtomicBoolean(true);
        var registry = new ProjectTools(accounts(), storage, tools.jackson.databind.json.JsonMapper.builder().build(), new TestClock());
        var context = new AgentExecutionContext("alice", 0, active::get);
        registry.session(context, () -> true, new PageContext("/wiki/articles", null, null));
        verifyNoInteractions(storage);
        when(storage.load("alice")).thenAnswer(invocation -> { active.set(false); return saved(); });
        failure(() -> registry.session(context, () -> true, project(17)), 401, "UNAUTHENTICATED");
    }
    @Test void freshToolReadsDoNotUseDeletedProjectsFromThePageValidationSnapshot() {
        var storage = mock(WorkspaceStorage.class);
        when(storage.load("alice")).thenReturn(saved(), new WorkspaceDtos.Envelope(1, "revision-2", WorkspaceDtos.Data.empty()));
        var registry = new ProjectTools(accounts(), storage, tools.jackson.databind.json.JsonMapper.builder().build(), new TestClock());
        var session = registry.session(new AgentExecutionContext("alice", 0, () -> true), () -> true, project(17));
        assertThat(session.read("get_project_summary", "{\"project\":\"#17\"}").outcome()).isEqualTo("NOT_FOUND");
        verify(storage, times(2)).load("alice");
    }
}
