package de.forgeflow.ai;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.workspace.WorkspaceStorage;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static de.forgeflow.ai.AiTestSupport.*;

class AgentActionsTest {
    private final Accounts accounts = mock(Accounts.class);
    private final WorkspaceStorage storage = mock(WorkspaceStorage.class);
    private final TestClock clock = new TestClock();
    private final AiProperties properties = new AiProperties(true, "test-only-key", "test-only-model", Duration.ofSeconds(1), "completion",
        256, 20, 2, 10, 20, 10, 10000, Duration.ofMinutes(30));
    private final MemoryConversationStore store = new MemoryConversationStore(properties, clock);
    private final ProjectTools tools = new ProjectTools(accounts, storage, JsonMapper.builder().build(), clock);
    private final AgentActions actions = new AgentActions(accounts, storage, store);
    private AgentExecutionContext context(String id, long version) {
        when(accounts.findById(id)).thenReturn(Optional.of(new Accounts.User(id, id + "@example.test", "Test", "test-only-hash", true, true, version)));
        return new AgentExecutionContext(id, version, () -> true);
    }
    private Envelope saved(String name) {
        return new Envelope(1, "1", new Data(List.of(new Project(17, 1, name, true, "2026-12-31")), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), new Wiki(List.of(), List.of())));
    }
    private record Proposal(AgentExecutionContext context, UUID conversation, NavigationActions.Action action, ConversationStore.PendingTurn pending, AiModelGateway.Reply reply) {}
    private Proposal proposal(boolean commit) {
        var context = context("alice", 3);
        when(storage.load("alice")).thenReturn(saved("Alpha"));
        var conversation = store.create("alice", "en");
        var pending = store.begin("alice", conversation.id(), new AgentDtos.SendMessage(UUID.randomUUID(), "Open Alpha tasks"));
        var result = tools.session(context).read("propose_project_navigation", "{\"project\":\"#17\",\"view\":\"tasks\"}");
        var reply = new AiModelGateway.Reply("Please confirm the card.", 1, 1, false,
            List.of(new AgentDtos.ToolEvent(UUID.randomUUID(), "propose_project_navigation", "completed", result)));
        if (commit) store.complete(pending, reply, context.sessionVersion());
        return new Proposal(context, conversation.id(), result.action(), pending, reply);
    }
    private NavigationActions.Decision decision(Proposal p, String decision) {
        return actions.decide(p.context(), p.conversation(), p.action().id(), new NavigationActions.DecisionInput(UUID.randomUUID(), decision));
    }
    @Test void proposalIsNotExecutableUntilCommittedAndAbortingLeavesNoAction() {
        var p = proposal(false);
        failure(() -> decision(p, "approve"), 404, "AI_ACTION_NOT_FOUND");
        store.abort(p.pending());
        assertThat(store.get("alice", p.conversation()).messages()).isEmpty();
        failure(() -> decision(p, "approve"), 404, "AI_ACTION_NOT_FOUND");
        verify(storage).load("alice"); verifyNoMoreInteractions(storage);
    }
    @Test void confirmationIsOneTimeBoundToTargetAndResultsUpdateHistoryAndIdempotentMessageReplay() {
        var p = proposal(true); clearInvocations(storage);
        var grant = decision(p, "approve");
        assertThat(grant.executionId()).isNotNull(); assertThat(grant.action().status()).isEqualTo("approved");
        assertThat(grant.action().projectId()).isEqualTo(17); assertThat(grant.action().projectTab()).isEqualTo("tasks");
        failure(() -> decision(p, "approve"), 409, "AI_ACTION_DECIDED");
        failure(() -> actions.report(p.context(), p.conversation(), p.action().id(), new NavigationActions.ResultInput(UUID.randomUUID(), "succeeded", null)), 409, "AI_ACTION_UNAVAILABLE");
        var input = new NavigationActions.ResultInput(grant.executionId(), "succeeded", null);
        assertThat(actions.report(p.context(), p.conversation(), p.action().id(), input).status()).isEqualTo("succeeded");
        assertThat(actions.report(p.context(), p.conversation(), p.action().id(), input).status()).isEqualTo("succeeded");
        failure(() -> actions.report(p.context(), p.conversation(), p.action().id(), new NavigationActions.ResultInput(grant.executionId(), "failed", "UNSAVED_CHANGES")), 409, "AI_ACTION_DECIDED");
        var replay = store.begin("alice", p.conversation(), new AgentDtos.SendMessage(p.pending().requestId(), p.pending().message())).replay();
        assertThat(replay.assistant().tools().getFirst().result().action().status()).isEqualTo("succeeded");
        assertThat(NavigationActions.metadata(replay.assistant().tools().getFirst().result().action())).contains("succeeded", "reported by the UI").doesNotContain("Alpha", grant.executionId().toString());
        verify(storage).load("alice"); verifyNoMoreInteractions(storage);
    }
    @Test void rejectionDoesNotReadWorkspaceAndCannotBeReapprovedOrReported() {
        var p = proposal(true); clearInvocations(storage);
        var rejected = decision(p, "reject");
        assertThat(rejected.action().status()).isEqualTo("rejected"); assertThat(rejected.executionId()).isNull();
        failure(() -> decision(p, "approve"), 409, "AI_ACTION_DECIDED");
        failure(() -> actions.report(p.context(), p.conversation(), p.action().id(), new NavigationActions.ResultInput(UUID.randomUUID(), "succeeded", null)), 409, "AI_ACTION_UNAVAILABLE");
        verifyNoInteractions(storage);
    }
    @Test void deletedRenamedAndForeignProjectsCannotBeApprovedEvenByAdministrators() {
        for (var saved : List.of(new Envelope(1, "2", Data.empty()), saved("Renamed"))) {
            var p = proposal(true); when(storage.load("alice")).thenReturn(saved);
            failure(() -> decision(p, "approve"), 409, "AI_ACTION_UNAVAILABLE");
            assertThat(store.action("alice", p.conversation(), p.action().id()).action().status()).isEqualTo("proposed");
        }
        var p = proposal(true); var bob = context("bob", 3);
        failure(() -> actions.decide(bob, p.conversation(), p.action().id(), new NavigationActions.DecisionInput(UUID.randomUUID(), "approve")), 404, "AI_CONVERSATION_NOT_FOUND");
        failure(() -> actions.decide(p.context(), p.conversation(), UUID.randomUUID(), new NavigationActions.DecisionInput(UUID.randomUUID(), "approve")), 404, "AI_ACTION_NOT_FOUND");
        verify(storage, never()).load("bob");
    }
    @Test void expiryRevocationAndNewSessionVersionsInvalidateOldProposals() {
        var p = proposal(true); clock.advance(Duration.ofMinutes(5)); clearInvocations(storage);
        failure(() -> decision(p, "approve"), 409, "AI_ACTION_EXPIRED");
        assertThat(store.get("alice", p.conversation()).messages().getLast().tools().getFirst().result().action().status()).isEqualTo("expired");
        verifyNoInteractions(storage);
        var next = proposal(true); var newer = context("alice", 4);
        failure(() -> decision(next, "approve"), 401, "UNAUTHENTICATED");
        failure(() -> actions.decide(newer, next.conversation(), next.action().id(), new NavigationActions.DecisionInput(UUID.randomUUID(), "approve")), 409, "AI_ACTION_UNAVAILABLE");
        failure(() -> actions.decide(new AgentExecutionContext("alice", 4, () -> false), next.conversation(), next.action().id(), new NavigationActions.DecisionInput(UUID.randomUUID(), "approve")), 401, "UNAUTHENTICATED");
    }
    @Test void simultaneousApprovalsYieldOneGrantAndBusyTurnsCannotApprove() throws Exception {
        var p = proposal(true);
        var pending = store.begin("alice", p.conversation(), new AgentDtos.SendMessage(UUID.randomUUID(), "Another message"));
        failure(() -> decision(p, "approve"), 409, "AI_CONVERSATION_BUSY"); store.abort(pending);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var results = executor.invokeAll(List.<java.util.concurrent.Callable<Boolean>>of(() -> approve(p), () -> approve(p)));
            assertThat(results.stream().map(result -> { try { return result.get(); } catch (Exception error) { throw new AssertionError(error); } }).filter(Boolean::booleanValue).count()).isEqualTo(1);
        }
    }
    private boolean approve(Proposal p) {
        try { return decision(p, "approve").executionId() != null; }
        catch (de.forgeflow.api.ApiFailure failure) { assertThat(failure.code).isEqualTo("AI_ACTION_DECIDED"); return false; }
    }
    @Test void strictArgumentsAndOutcomeCodesRejectArbitraryNavigationAndPrivateErrorText() {
        var p = proposal(true);
        for (var input : List.of("{\"project\":\"#17\",\"view\":\"settings\"}", "{\"project\":\"#17\",\"view\":\"board\",\"url\":\"https://example.test\"}"))
            assertThat(tools.session(p.context()).read("propose_project_navigation", input).outcome()).isEqualTo("INVALID_INPUT");
        var grant = decision(p, "approve");
        failure(() -> actions.report(p.context(), p.conversation(), p.action().id(), new NavigationActions.ResultInput(grant.executionId(), "failed", "private-error-text")), 400, "AI_INVALID_ACTION");
        failure(() -> actions.report(p.context(), p.conversation(), p.action().id(), new NavigationActions.ResultInput(grant.executionId(), "succeeded", "EXPIRED")), 400, "AI_INVALID_ACTION");
        assertThat(actions.report(p.context(), p.conversation(), p.action().id(), new NavigationActions.ResultInput(grant.executionId(), "failed", "UNSAVED_CHANGES")).status()).isEqualTo("failed");
    }
}
