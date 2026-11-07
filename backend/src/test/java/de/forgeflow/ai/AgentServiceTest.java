package de.forgeflow.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import de.forgeflow.ai.AgentDtos.*;
import de.forgeflow.auth.Accounts;
import de.forgeflow.auth.AttemptLimiter;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static de.forgeflow.ai.AiTestSupport.*;

class AgentServiceTest {
    private final Accounts accounts = mock(Accounts.class);
    private static SendMessage input(String message) {
        return new SendMessage(UUID.randomUUID(), message, new PageContext("/projectManager/projects", null, null));
    }
    private AgentExecutionContext context(String user) {
        when(accounts.findById(user)).thenReturn(Optional.of(new Accounts.User(user, "test@example.test", "Test", "test-only-hash", false, true, 0)));
        return new AgentExecutionContext(user, 0, () -> true);
    }
    private AgentService service(AiProperties properties, AiModelGateway gateway) {
        return new AgentService(accounts, new MemoryConversationStore(properties, new TestClock()), gateway, new AgentLimits(properties, new AttemptLimiter()), tools(accounts));
    }
    @Test void historyAndUsageArePreservedAndSuccessfulRequestIdsPreventDuplicateProviderCharges() {
        var seen = new ArrayList<List<Message>>(); var calls = new AtomicInteger();
        var service = service(properties(), (language, history, message) -> {
            assertThat(language).isEqualTo("en"); seen.add(history); calls.incrementAndGet();
            return new AiModelGateway.Reply("Answer", 12, 3, false);
        });
        var context = context("alice"); var id = service.create(context, "en").id();
        var input = input("Hello"); var result = service.send(context, id, input);
        assertThat(service.send(context, id, input)).isEqualTo(result); assertThat(calls).hasValue(1);
        service.send(context, id, input("Continue"));
        assertThat(seen.get(0)).isEmpty(); assertThat(seen.get(1)).extracting(Message::content).containsExactly("Hello", "Answer");
        assertThat(result.usage().inputTokens()).isEqualTo(12);
        assertThat(service.get(context, id).messages()).hasSize(4);
    }
    @Test void foreignUsersAndInvalidSessionsNeverReachTheModel() {
        AiModelGateway gateway = mock(AiModelGateway.class); var service = service(properties(), gateway);
        var alice = context("alice"); var id = service.create(alice, "de").id();
        failure(() -> service.send(context("bob"), id, input("Hallo")), 404, "AI_CONVERSATION_NOT_FOUND");
        failure(() -> service.get(new AgentExecutionContext("alice", 0, () -> false), id), 401, "UNAUTHENTICATED");
        failure(() -> service.send(new AgentExecutionContext("alice", 1, () -> true), id, input("Hallo")), 401, "UNAUTHENTICATED");
        failure(() -> service.send(alice, id, new SendMessage(UUID.randomUUID(), "No context")), 403, "AI_APP_FORBIDDEN");
        verifyNoInteractions(gateway);
    }
    @Test void otherAppsUseToolFreeAnswersAndCannotReuseProjectManagerHistory() {
        var noToolHistory = new ArrayList<List<Message>>();
        var noToolMessages = new ArrayList<String>();
        var gateway = mock(AiModelGateway.class);
        when(gateway.reply(anyString(), anyList(), anyString())).thenAnswer(invocation -> {
            noToolHistory.add(invocation.getArgument(1));
            noToolMessages.add(invocation.getArgument(2));
            return new AiModelGateway.Reply("General answer", 1, 1, false);
        });
        when(gateway.reply(anyString(), anyList(), anyString(), any(ProjectTools.Session.class)))
            .thenReturn(new AiModelGateway.Reply("Project answer", 1, 1, false));
        var service = service(properties(), gateway);
        var alice = context("alice");
        var id = service.create(alice, "en").id();
        service.send(alice, id, input("Project request"));
        var wikiHome = new PageContext("/wiki/home", null, null);
        service.send(alice, id, new SendMessage(UUID.randomUUID(), "Wiki question", wikiHome));
        service.send(alice, id, new SendMessage(UUID.randomUUID(), "Follow-up", new PageContext("/wiki/articles", null, null)));

        assertThat(noToolHistory.get(0)).isEmpty();
        assertThat(noToolHistory.get(1)).extracting(Message::content).containsExactly("Wiki question", "General answer");
        assertThat(noToolHistory.get(1)).noneMatch(message -> message.content().contains("Project request") || message.content().contains("Project answer"));
        assertThat(noToolMessages.get(0)).contains("Documentation home", "Wiki question");
        verify(gateway, times(1)).reply(anyString(), anyList(), anyString(), any(ProjectTools.Session.class));
        verify(gateway, times(2)).reply(anyString(), anyList(), anyString());
    }
    @Test void logoutDuringGenerationDiscardsTheResultAndReleasesCapacity() {
        var active = new AtomicBoolean(true); var calls = new AtomicInteger(); var alice = context("alice");
        var service = service(properties(), (language, history, message) -> {
            if (calls.incrementAndGet() == 1) active.set(false);
            return new AiModelGateway.Reply("Answer", 1, 1, false);
        });
        var id = service.create(alice, "de").id(); var context = new AgentExecutionContext("alice", 0, active::get);
        failure(() -> service.send(context, id, input("Hallo")), 401, "UNAUTHENTICATED");
        assertThat(service.get(alice, id).messages()).isEmpty(); active.set(true);
        assertThat(service.send(context, id, input("Nochmal")).assistant().content()).isEqualTo("Answer");
    }
    @Test void sessionVersionChangesDuringGenerationPreventCommittingTheAnswer() {
        var alice = context("alice");
        var service = service(properties(), (language, history, message) -> {
            when(accounts.findById("alice")).thenReturn(Optional.of(new Accounts.User("alice", "test@example.test", "Test", "test-hash", false, true, 1)));
            return new AiModelGateway.Reply("Answer", 1, 1, false);
        });
        var id = service.create(alice, "de").id();
        failure(() -> service.send(alice, id, input("Hallo")), 401, "UNAUTHENTICATED");
    }
    @Test void providerErrorsAndInvalidAnswersDoNotPersistHalfTurnsOrLeakDetails() {
        var calls = new AtomicInteger(); var service = service(properties(), (language, history, message) -> {
            if (calls.incrementAndGet() == 1) throw new IllegalStateException("secret-provider-detail");
            return new AiModelGateway.Reply(" ", 1, 1, false);
        });
        var alice = context("alice"); var id = service.create(alice, "de").id();
        failure(() -> service.send(alice, id, input("Hallo")), 503, "AI_UNAVAILABLE");
        failure(() -> service.send(alice, id, input("Nochmal")), 502, "AI_INVALID_RESPONSE");
        assertThat(service.get(alice, id).messages()).isEmpty();
    }
    @Test void rateLimitsAreAccountWideAndSuccessfulReplaysRemainFree() {
        var service = service(properties(1, 2, 2, 4, 3, 4000), (language, history, message) -> new AiModelGateway.Reply("Answer", 1, 1, false));
        var alice = context("alice"); var id = service.create(alice, "de").id(); var input = input("Hallo");
        var result = service.send(alice, id, input); assertThat(service.send(alice, id, input)).isEqualTo(result);
        var other = service.create(alice, "de").id();
        failure(() -> service.send(alice, other, input("Weiter")), 429, "RATE_LIMITED");
    }
    @Test void activeUserAndGlobalConcurrencyLimitsRejectWithoutStartingAnotherProviderCall() throws Exception {
        var started = new CountDownLatch(1); var release = new CountDownLatch(1); var calls = new AtomicInteger();
        var service = service(properties(20, 1, 2, 4, 3, 4000), (language, history, message) -> {
            calls.incrementAndGet(); started.countDown();
            try { if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("Test timed out."); }
            catch (InterruptedException error) { Thread.currentThread().interrupt(); throw new IllegalStateException(error); }
            return new AiModelGateway.Reply("Answer", 1, 1, false);
        });
        var alice = context("alice"); var bob = context("bob");
        var id = service.create(alice, "de").id(); var otherAlice = service.create(alice, "de").id(); var otherBob = service.create(bob, "en").id();
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> service.send(alice, id, input("First")));
            try {
                assertThat(started.await(3, TimeUnit.SECONDS)).isTrue();
                failure(() -> service.send(alice, otherAlice, input("Second")), 429, "AI_BUSY");
                failure(() -> service.send(bob, otherBob, input("Third")), 429, "AI_BUSY");
                assertThat(calls).hasValue(1);
            } finally { release.countDown(); }
            assertThat(first.get(3, TimeUnit.SECONDS).assistant().content()).isEqualTo("Answer");
            assertThat(service.send(bob, otherBob, input("Now free")).assistant().content()).isEqualTo("Answer");
        }
    }
}
