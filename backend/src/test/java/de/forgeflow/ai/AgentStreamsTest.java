package de.forgeflow.ai;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Sinks;
import de.forgeflow.ai.AgentDtos.SendMessage;
import de.forgeflow.auth.Accounts;
import de.forgeflow.auth.AttemptLimiter;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static de.forgeflow.ai.AiTestSupport.*;

class AgentStreamsTest {
    @Test void cancellingARealMultiStepExecutionStopsTheSecondProviderAndDiscardsTheWholeTurn() throws Exception {
        var properties = new AiProperties(true, "test-only-key", "test-only-model", java.time.Duration.ofSeconds(10), "completion", 256, 20, 2, 2, 4, 3, 4000, java.time.Duration.ofMinutes(1));
        var accounts = mock(Accounts.class); var storage = mock(de.forgeflow.workspace.WorkspaceStorage.class);
        when(accounts.findById("alice")).thenReturn(Optional.of(new Accounts.User("alice", "test@example.test", "Test", "hash", false, true, 0)));
        when(storage.load("alice")).thenReturn(new de.forgeflow.workspace.WorkspaceDtos.Envelope(1, "1", de.forgeflow.workspace.WorkspaceDtos.Data.empty()));
        var context = new AgentExecutionContext("alice", 0, () -> true);
        var chatModel = mock(org.springframework.ai.chat.model.ChatModel.class);
        var calls = new java.util.concurrent.atomic.AtomicInteger(); var second = new CountDownLatch(1); var cancelled = new CountDownLatch(1);
        when(chatModel.stream(any(org.springframework.ai.chat.prompt.Prompt.class))).thenAnswer(invocation -> calls.getAndIncrement() == 0
            ? Flux.just(new org.springframework.ai.chat.model.ChatResponse(java.util.List.of(new org.springframework.ai.chat.model.Generation(
                org.springframework.ai.chat.messages.AssistantMessage.builder().content("").toolCalls(java.util.List.of(new org.springframework.ai.chat.messages.AssistantMessage.ToolCall("lookup", "function", "list_projects", "{\"query\":\"\",\"offset\":0}"))).build(),
                org.springframework.ai.chat.metadata.ChatGenerationMetadata.builder().finishReason("tool_calls").build()))))
            : Flux.<org.springframework.ai.chat.model.ChatResponse>never().doOnSubscribe(subscription -> second.countDown()).doOnCancel(cancelled::countDown));
        var conversations = new MemoryConversationStore(properties, new TestClock()); var limits = new AgentLimits(properties, new AttemptLimiter());
        try (var streams = new AgentStreams(accounts, conversations, new OpenAiModelGateway(chatModel), limits, properties,
                new ProjectTools(accounts, storage, tools.jackson.databind.json.JsonMapper.builder().build(), new TestClock()))) {
            var conversation = conversations.create("alice", "en"); var input = new SendMessage(UUID.randomUUID(), "Find projects and read tasks");
            streams.start(context, conversation.id(), input);
            assertThat(second.await(3, TimeUnit.SECONDS)).isTrue();
            streams.cancel(context, conversation.id(), input.requestId());
            assertThat(cancelled.await(1, TimeUnit.SECONDS)).isTrue(); assertThat(calls).hasValue(2);
            assertThat(conversations.get("alice", conversation.id()).messages()).isEmpty();
            try (var lease = limits.acquire("alice")) { assertThat(lease).isNotNull(); }
            verify(storage).load("alice"); verifyNoMoreInteractions(storage);
        }
    }
    @Test void cancellationDisposesUpstreamDiscardsPartialHistoryAndReleasesTheLease() throws Exception {
        exercise(false);
    }
    @Test void logoutWithoutAnotherChunkDisposesUpstreamWithinTheHeartbeatDeadline() throws Exception {
        exercise(true);
    }
    private void exercise(boolean logout) throws Exception {
        var properties = new AiProperties(true, "test-only-key", "test-only-model", java.time.Duration.ofSeconds(10), "completion",
            256, 20, 2, 2, 4, 3, 4000, java.time.Duration.ofMinutes(1));
        var accounts = mock(Accounts.class); var gateway = mock(AiModelGateway.class);
        when(accounts.findById("alice")).thenReturn(Optional.of(new Accounts.User("alice", "test@example.test", "Test", "test-only-hash", false, true, 0)));
        var active = new AtomicBoolean(true); var context = new AgentExecutionContext("alice", 0, active::get);
        var conversations = new MemoryConversationStore(properties, new TestClock());
        var limits = new AgentLimits(properties, new AttemptLimiter());
        var subscribed = new CountDownLatch(1); var cancelled = new CountDownLatch(1);
        var sink = Sinks.many().unicast().<AiModelGateway.Chunk>onBackpressureBuffer();
        when(gateway.stream(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(sink.asFlux().doOnSubscribe(value -> subscribed.countDown()).doOnCancel(cancelled::countDown));
        try (var streams = new AgentStreams(accounts, conversations, gateway, limits, properties, tools(accounts))) {
            var id = conversations.create("alice", "de").id(); var input = new SendMessage(UUID.randomUUID(), "Hallo");
            streams.start(context, id, input);
            assertThat(subscribed.await(2, TimeUnit.SECONDS)).isTrue();
            sink.tryEmitNext(new AiModelGateway.Chunk("Partial", null));
            failure(() -> limits.acquire("alice"), 429, "AI_BUSY");
            if (logout) active.set(false); else streams.cancel(context, id, input.requestId());
            assertThat(cancelled.await(3, TimeUnit.SECONDS)).isTrue();
            sink.tryEmitNext(new AiModelGateway.Chunk("", new AiModelGateway.Reply("Late result", 1, 1, false)));
            assertThat(conversations.get("alice", id).messages()).isEmpty();
            // Cancellation is idempotent and a new call is allowed as soon as upstream stops.
            active.set(true); streams.cancel(context, id, input.requestId());
            // The cancellation signal precedes the remaining cleanup on the timer thread.
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(1);
            while (true) {
                try (var lease = limits.acquire("alice")) { assertThat(lease).isNotNull(); break; }
                catch (de.forgeflow.api.ApiFailure error) {
                    if (!"AI_BUSY".equals(error.code) || System.nanoTime() >= deadline) throw error;
                    Thread.sleep(5);
                }
            }
            var next = conversations.begin("alice", id, new SendMessage(UUID.randomUUID(), "Again"));
            conversations.abort(next);
        }
    }
    @Test void totalDeadlineCancelsEvenAProviderThatKeepsProducingChunks() throws Exception {
        var properties = properties(); var accounts = mock(Accounts.class); var gateway = mock(AiModelGateway.class);
        when(accounts.findById("alice")).thenReturn(Optional.of(new Accounts.User("alice", "test@example.test", "Test", "hash", false, true, 0)));
        var context = new AgentExecutionContext("alice", 0, () -> true);
        var conversations = new MemoryConversationStore(properties, new TestClock()); var cancelled = new CountDownLatch(1);
        when(gateway.stream(anyString(), anyList(), anyString(), any(de.forgeflow.ai.ProjectTools.Session.class))).thenReturn(Flux.interval(java.time.Duration.ofMillis(20))
            .map(index -> new AiModelGateway.Chunk("x", null)).doOnCancel(cancelled::countDown));
        try (var streams = new AgentStreams(accounts, conversations, gateway, new AgentLimits(properties, new AttemptLimiter()), properties, tools(accounts))) {
            var id = conversations.create("alice", "en").id();
            streams.start(context, id, new SendMessage(UUID.randomUUID(), "Hello"));
            assertThat(cancelled.await(3, TimeUnit.SECONDS)).isTrue();
            assertThat(conversations.get("alice", id).messages()).isEmpty();
        }
    }
}
