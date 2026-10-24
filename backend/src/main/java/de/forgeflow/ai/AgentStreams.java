package de.forgeflow.ai;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import de.forgeflow.ai.AgentDtos.SendMessage;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.Accounts;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import reactor.core.Disposables;
import reactor.core.scheduler.Scheduler;
import reactor.core.scheduler.Schedulers;

/** Owns bounded, short-lived runs. All callbacks carry the original account/session explicitly. */
public final class AgentStreams implements AutoCloseable {
    private final Accounts accounts;
    private final ConversationStore conversations;
    private final AiModelGateway model;
    private final AgentLimits limits;
    private final AiProperties properties;
    private final ProjectTools tools;
    private final Map<UUID, Run> active = new ConcurrentHashMap<>();
    private final Scheduler workers;
    private final Scheduler timers = Schedulers.newSingle("ai-stream-timer", true);

    public AgentStreams(Accounts accounts, ConversationStore conversations, AiModelGateway model, AgentLimits limits, AiProperties properties, ProjectTools tools) {
        this.accounts = accounts; this.conversations = conversations; this.model = model; this.limits = limits; this.properties = properties;
        this.tools = tools;
        workers = Schedulers.newBoundedElastic(properties.maxConcurrent(), 1, "ai-stream", 30, true);
    }

    public SseEmitter start(AgentExecutionContext context, UUID id, SendMessage input) {
        context.verify(accounts);
        var pending = conversations.begin(context.userId(), id, input);
        if (pending.replay() != null) {
            var emitter = new SseEmitter(2000L);
            try { emitter.send(SseEmitter.event().name("done").data(pending.replay())); emitter.complete(); }
            catch (IOException error) { emitter.completeWithError(error); }
            return emitter;
        }
        AgentLimits.Lease lease;
        try { lease = limits.acquire(context.userId()); }
        catch (RuntimeException error) { conversations.abort(pending, "failed", error instanceof ApiFailure failure ? failure.code : "AI_UNAVAILABLE"); throw error; }
        var run = new Run(context, pending, lease);
        active.put(id, run);
        run.start();
        return run.emitter;
    }

    public void cancel(AgentExecutionContext context, UUID id, UUID requestId) {
        context.verify(accounts);
        // Same 404 for missing and foreign conversations, even when a run is active.
        conversations.get(context.userId(), id);
        var run = active.get(id);
        if (run != null && run.pending.requestId().equals(requestId)) run.cancel();
    }

    private final class Run {
        final AgentExecutionContext context;
        final ConversationStore.PendingTurn pending;
        final AgentLimits.Lease lease;
        final SseEmitter emitter = new SseEmitter(properties.timeout().toMillis() + 2000);
        final reactor.core.Disposable.Swap subscription = Disposables.swap();
        final reactor.core.Disposable.Composite tasks = Disposables.composite();
        volatile boolean ended;
        int characters;
        AiModelGateway.Reply reply;
        String terminalStatus = "interrupted", terminalCode = "AI_RUN_INTERRUPTED";

        Run(AgentExecutionContext context, ConversationStore.PendingTurn pending, AgentLimits.Lease lease) {
            this.context = context; this.pending = pending; this.lease = lease;
            emitter.onCompletion(this::disconnected);
            emitter.onError(error -> disconnected());
            emitter.onTimeout(() -> fail(new ApiFailure(504, "AI_TIMEOUT", "Der KI-Anbieter hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.")));
        }
        synchronized void start() {
            if (!emit("ready", Map.of("requestId", pending.requestId()))) return;
            tasks.add(timers.schedule(() -> fail(new ApiFailure(504, "AI_TIMEOUT", "Der KI-Anbieter hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.")), properties.timeout().toMillis(), TimeUnit.MILLISECONDS));
            tasks.add(timers.schedulePeriodically(this::heartbeat, 1, 1, TimeUnit.SECONDS));
            subscription.update(reactor.core.publisher.Flux.defer(() -> {
                context.verify(accounts);
                return model.stream(pending.language(), pending.history(), pending.message(), tools.session(context, () -> !ended, pending.context(), step -> conversations.record(pending, step)));
            })
                .subscribeOn(workers).subscribe(this::chunk, this::fail, this::complete));
        }
        synchronized void heartbeat() {
            if (ended) return;
            try { context.verify(accounts); emit("ping", Map.of()); }
            catch (RuntimeException error) { fail(error); }
        }
        synchronized void chunk(AiModelGateway.Chunk chunk) {
            if (ended) return;
            try {
                context.verify(accounts);
                if (reply != null) throw new IllegalStateException("Data after final reply.");
                if (chunk.completed() != null) reply = chunk.completed();
                if (chunk.tool() != null) emit("tool", chunk.tool());
                if (chunk.execution() != null) emit("execution", chunk.execution());
                if (chunk.delta() != null && !chunk.delta().isEmpty()) {
                    characters += chunk.delta().length();
                    if (characters > 16000) throw new ApiFailure(502, "AI_INVALID_RESPONSE", "Der KI-Anbieter hat keine verwendbare Textantwort geliefert.");
                    emit("delta", Map.of("text", chunk.delta()));
                }
            } catch (RuntimeException error) { fail(error); }
        }
        synchronized void complete() {
            if (ended) return;
            try {
                context.verify(accounts);
                if (reply == null || reply.text() == null || reply.text().isBlank() || reply.text().length() > 16000)
                    throw new ApiFailure(502, "AI_INVALID_RESPONSE", "Der KI-Anbieter hat keine verwendbare Textantwort geliefert.");
                var turn = conversations.complete(pending, reply, context.sessionVersion());
                emit("done", turn);
                finish();
            } catch (RuntimeException error) { fail(error); }
        }
        synchronized void fail(Throwable error) {
            if (ended) return;
            var safe = OpenAiModelGateway.safeFailure(error);
            terminalStatus = "failed"; terminalCode = safe.code;
            emit("error", Map.of("status", safe.status, "code", safe.code, "message", safe.getMessage()));
            finish();
        }
        synchronized void cancel() {
            if (ended) return;
            terminalStatus = "cancelled"; terminalCode = "AI_CANCELLED";
            emit("cancelled", Map.of("requestId", pending.requestId()));
            finish();
        }
        synchronized void disconnected() { finish(); }
        private boolean emit(String name, Object data) {
            if (ended) return false;
            try { emitter.send(SseEmitter.event().name(name).data(data)); return true; }
            catch (IOException | IllegalStateException error) { finish(); return false; }
        }
        private void finish() {
            if (ended) return;
            ended = true;
            subscription.dispose(); tasks.dispose();
            try { conversations.abort(pending, terminalStatus, terminalCode); }
            finally { lease.close(); active.remove(pending.conversationId(), this); emitter.complete(); }
        }
    }
    @Override public void close() {
        active.values().forEach(Run::cancel);
        workers.dispose(); timers.dispose();
    }
}
