package de.forgeflow.ai;

import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import de.forgeflow.ai.AgentDtos.*;
import static org.assertj.core.api.Assertions.*;
import static de.forgeflow.ai.AiTestSupport.*;

class MemoryConversationStoreTest {
    @Test void contextIsPartOfIdempotencyAndConfirmedUserMessages() {
        var store = new MemoryConversationStore(properties(), new TestClock());
        var conversation = store.create("alice", "de"); var request = UUID.randomUUID();
        var page = new AgentDtos.PageContext("/projectManager/projects", 17L, "tasks");
        var pending = store.begin("alice", conversation.id(), new AgentDtos.SendMessage(request, "Hier?", page));
        var turn = store.complete(pending, new AiModelGateway.Reply("Antwort", 1, 1, false));
        assertThat(turn.user().context()).isEqualTo(page);
        assertThat(store.begin("alice", conversation.id(), new AgentDtos.SendMessage(request, "Hier?", page)).replay()).isEqualTo(turn);
        failure(() -> store.begin("alice", conversation.id(), new AgentDtos.SendMessage(request, "Hier?", new AgentDtos.PageContext("/wiki/home", null, null))), 409, "AI_REQUEST_MISMATCH");
        failure(() -> store.begin("alice", conversation.id(), new AgentDtos.SendMessage(request, "Hier?")), 409, "AI_REQUEST_MISMATCH");
    }
    @Test void conversationsAreOwnedImmutableAndDoNotRevealForeignExistence() {
        var store = new MemoryConversationStore(properties(), new TestClock());
        var conversation = store.create("alice", "de");
        assertThat(conversation.messages()).isEmpty();
        assertThatThrownBy(() -> conversation.messages().add(null)).isInstanceOf(UnsupportedOperationException.class);
        failure(() -> store.get("bob", conversation.id()), 404, "AI_CONVERSATION_NOT_FOUND");
        failure(() -> store.begin("bob", conversation.id(), new SendMessage(UUID.randomUUID(), "test")), 404, "AI_CONVERSATION_NOT_FOUND");
        failure(() -> store.get("alice", UUID.randomUUID()), 404, "AI_CONVERSATION_NOT_FOUND");
    }
    @Test void completedTurnsReplayOnlyWithIdenticalPayloadAndDoNotMutateOldSnapshots() {
        var store = new MemoryConversationStore(properties(), new TestClock());
        var conversation = store.create("alice", "en"); var input = new SendMessage(UUID.randomUUID(), "Hello");
        var pending = store.begin("alice", conversation.id(), input);
        var turn = store.complete(pending, new AiModelGateway.Reply("Hi", 10, 2, false));
        assertThat(conversation.messages()).isEmpty();
        assertThat(store.get("alice", conversation.id()).messages()).extracting(Message::role).containsExactly("user", "assistant");
        assertThat(store.begin("alice", conversation.id(), input).replay()).isEqualTo(turn);
        failure(() -> store.begin("alice", conversation.id(), new SendMessage(input.requestId(), "Changed")), 409, "AI_REQUEST_MISMATCH");
    }
    @Test void busyConversationCanBeRetriedAfterAbortButOldAbortCannotUnlockNewWork() {
        var store = new MemoryConversationStore(properties(), new TestClock());
        var id = store.create("alice", "de").id(); var input = new SendMessage(UUID.randomUUID(), "Hallo");
        var first = store.begin("alice", id, input);
        failure(() -> store.begin("alice", id, input), 409, "AI_CONVERSATION_BUSY");
        store.abort(first); var second = store.begin("alice", id, input); store.abort(first);
        failure(() -> store.begin("alice", id, input), 409, "AI_CONVERSATION_BUSY");
        store.abort(second); assertThat(store.get("alice", id).messages()).isEmpty();
    }
    @Test void abandonedLeasesCannotCommitAndExpiredConversationsReleaseCapacity() {
        var clock = new TestClock(); var store = new MemoryConversationStore(properties(20, 2, 1, 2, 3, 4000), clock);
        var id = store.create("alice", "de").id(); var pending = store.begin("alice", id, new SendMessage(UUID.randomUUID(), "Hallo"));
        clock.advance(Duration.ofMinutes(2));
        failure(() -> store.create("alice", "de"), 429, "AI_CONVERSATION_LIMIT");
        failure(() -> store.complete(pending, new AiModelGateway.Reply("Antwort", null, null, false)), 409, "AI_RUN_EXPIRED");
        assertThat(store.get("alice", id).messages()).isEmpty();
        assertThat(store.executions("alice", id).getFirst().status()).isEqualTo("interrupted");
        clock.advance(Duration.ofMinutes(1));
        failure(() -> store.get("alice", id), 404, "AI_CONVERSATION_NOT_FOUND");
        assertThat(store.create("alice", "de").messages()).isEmpty();
    }
    @Test void perUserAndGlobalConversationLimitsAreBothEnforced() {
        var store = new MemoryConversationStore(properties(20, 2, 1, 2, 3, 4000), new TestClock());
        store.create("alice", "de");
        failure(() -> store.create("alice", "en"), 429, "AI_CONVERSATION_LIMIT");
        store.create("bob", "en");
        failure(() -> store.create("charlie", "en"), 429, "AI_CONVERSATION_LIMIT");
    }
    @Test void turnAndPromptSizeLimitsRejectBeforeAcquiringAConversationLease() {
        var store = new MemoryConversationStore(properties(20, 2, 2, 4, 1, 4000), new TestClock());
        var id = store.create("alice", "de").id();
        var pending = store.begin("alice", id, new SendMessage(UUID.randomUUID(), "Hallo"));
        store.complete(pending, new AiModelGateway.Reply("Antwort", null, null, false));
        failure(() -> store.begin("alice", id, new SendMessage(UUID.randomUUID(), "Weiter")), 422, "AI_CONTEXT_LIMIT");
        var largeId = store.create("alice", "de").id();
        failure(() -> store.begin("alice", largeId, new SendMessage(UUID.randomUUID(), "x".repeat(4001))), 422, "AI_CONTEXT_LIMIT");
        assertThat(store.begin("alice", largeId, new SendMessage(UUID.randomUUID(), "Klein")).ticket()).isNotNull();
    }
}
