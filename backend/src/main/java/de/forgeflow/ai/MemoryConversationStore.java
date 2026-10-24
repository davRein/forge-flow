package de.forgeflow.ai;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import de.forgeflow.ai.AgentDtos.*;
import de.forgeflow.api.ApiFailure;

public final class MemoryConversationStore implements ConversationStore {
    private static final class ActionEntry {
        NavigationActions.Action value;
        final long sessionVersion;
        UUID executionId;
        ActionEntry(NavigationActions.Action value, long sessionVersion) { this.value = value; this.sessionVersion = sessionVersion; }
    }
    private static final class Entry {
        final UUID id;
        final String ownerId;
        final String language;
        final Instant createdAt;
        final List<Turn> turns = new ArrayList<>();
        final Map<UUID, ActionEntry> actions = new HashMap<>();
        final Map<UUID, WorkspaceMutations.Stored> mutations = new HashMap<>();
        Instant updatedAt;
        UUID pending;
        Instant pendingUntil;
        final List<ExecutionRecord> executions = new ArrayList<>();
        Entry(String ownerId, String language, Instant now) {
            this(UUID.randomUUID(), ownerId, language, now);
        }
        Entry(UUID id, String ownerId, String language, Instant now) {
            this.id = id;
            this.ownerId = ownerId; this.language = language; this.createdAt = now; this.updatedAt = now;
        }
        List<Message> messages() { return turns.stream().map(turn -> updated(this, turn)).flatMap(turn -> java.util.stream.Stream.of(turn.user(), turn.assistant())).toList(); }
        Conversation snapshot() { return new Conversation(id, language, createdAt, updatedAt, messages(), pending != null); }
    }
    private final Map<UUID, Entry> entries = new HashMap<>();
    private final AiProperties properties;
    private final Clock clock;
    private final java.time.Duration ttl;
    public MemoryConversationStore(AiProperties properties, Clock clock) { this(properties, clock, properties.conversationTtl()); }
    MemoryConversationStore(AiProperties properties, Clock clock, java.time.Duration ttl) { this.properties = properties; this.clock = clock; this.ttl = ttl; }
    synchronized void restore(ConversationState state) {
        var entry = new Entry(state.id(), state.ownerId(), state.language(), state.createdAt());
        entry.updatedAt = state.updatedAt(); entry.pending = state.pending(); entry.pendingUntil = state.pendingUntil(); entry.turns.addAll(state.turns()); entry.executions.addAll(state.executions());
        for (var saved : state.actions()) { var action = new ActionEntry(saved.action(), saved.sessionVersion()); action.executionId = saved.executionId(); entry.actions.put(saved.action().id(), action); }
        if (state.mutations() != null) for (var saved : state.mutations()) entry.mutations.put(saved.action().id(), saved);
        entries.put(entry.id, entry);
    }
    synchronized ConversationState state(String ownerId, UUID id) {
        var entry = owned(ownerId, id);
        boolean extended = !entry.mutations.isEmpty() || entry.turns.stream().flatMap(turn -> turn.assistant().tools().stream())
            .anyMatch(tool -> tool.result() != null && (tool.result().workspace() != null || tool.result().mutation() != null));
        boolean updates = entry.mutations.values().stream().anyMatch(saved -> "workspace.update".equals(saved.action().type()));
        boolean customerDetails = entry.mutations.values().stream().anyMatch(saved -> "contacts".equals(saved.action().entity())
            || "customers".equals(saved.action().entity()) && (saved.action().data().has("notes") || saved.action().data().has("contacts")))
            || entry.turns.stream().flatMap(turn -> turn.assistant().tools().stream()).anyMatch(tool -> tool.result() != null && tool.result().workspace() != null && "contacts".equals(tool.result().workspace().entity()));
        boolean hierarchy = entry.mutations.values().stream().anyMatch(saved -> "articles".equals(saved.action().entity()) && saved.action().data().has("parentId"));
        return new ConversationState(hierarchy ? 5 : customerDetails ? 4 : updates ? 3 : extended ? 2 : 1, id, ownerId, entry.language, entry.createdAt, entry.updatedAt, entry.pending, entry.pendingUntil, List.copyOf(entry.turns),
            entry.actions.values().stream().map(action -> new ConversationState.ActionState(action.value, action.sessionVersion, action.executionId)).toList(), List.copyOf(entry.executions), List.copyOf(entry.mutations.values()));
    }
    private void end(Entry entry, String status, String code) {
        if (entry.pending == null) return;
        for (int index = 0; index < entry.executions.size(); index++) {
            var run = entry.executions.get(index);
            if (run.id().equals(entry.pending)) entry.executions.set(index, new ExecutionRecord(run.id(), run.requestId(), status, run.startedAt(), clock.instant(), code, run.steps()));
        }
        entry.pending = null; entry.pendingUntil = null; entry.updatedAt = clock.instant();
    }
    private void recover(Entry entry) {
        if (entry.pending != null && entry.pendingUntil != null && !entry.pendingUntil.isAfter(clock.instant())) end(entry, "interrupted", "AI_RUN_INTERRUPTED");
    }

    private void prune() {
        entries.values().forEach(this::recover);
        Instant cutoff = clock.instant().minus(ttl);
        // An in-flight call keeps its entry until complete/abort. Provider timeouts bound that lease.
        entries.values().removeIf(entry -> entry.pending == null && !entry.updatedAt.isAfter(cutoff));
    }
    private Entry owned(String ownerId, UUID id) {
        Entry entry = entries.get(id);
        if (entry == null || !entry.ownerId.equals(ownerId))
            throw new ApiFailure(404, "AI_CONVERSATION_NOT_FOUND", "Die Unterhaltung wurde nicht gefunden oder ist abgelaufen.");
        recover(entry);
        for (var action : entry.actions.values()) if ("proposed".equals(action.value.status()) && !action.value.expiresAt().isAfter(clock.instant()))
            action.value = action.value.state("expired", null);
        entry.mutations.replaceAll((key, saved) -> "proposed".equals(saved.action().status()) && !saved.action().expiresAt().isAfter(clock.instant())
            ? new WorkspaceMutations.Stored(saved.action().state("expired", null), saved.sessionVersion()) : saved);
        return entry;
    }
    private static Turn updated(Entry entry, Turn turn) {
        var tools = turn.assistant().tools().stream().map(tool -> {
            var action = tool.result() == null ? null : tool.result().action();
            var state = action == null ? null : entry.actions.get(action.id());
            var mutation = tool.result() == null ? null : tool.result().mutation();
            if (mutation != null && entry.mutations.containsKey(mutation.id())) return new ToolEvent(tool.id(), tool.name(), tool.status(), tool.result().mutation(entry.mutations.get(mutation.id()).action()));
            return state == null ? tool : new ToolEvent(tool.id(), tool.name(), tool.status(), tool.result().action(state.value));
        }).toList();
        var message = turn.assistant();
        return new Turn(turn.requestId(), turn.user(), new Message(message.id(), message.role(), message.content(), message.createdAt(), tools, message.context()), turn.usage(), turn.truncated());
    }
    @Override public synchronized Conversation create(String ownerId, String language) {
        prune();
        if (entries.size() >= properties.maxConversations()
                || entries.values().stream().filter(entry -> entry.ownerId.equals(ownerId)).count() >= properties.maxConversationsPerUser())
            throw new ApiFailure(429, "AI_CONVERSATION_LIMIT", "Zu viele Unterhaltungen. Bitte später erneut versuchen.");
        Entry entry = new Entry(ownerId, language, clock.instant()); entries.put(entry.id, entry); return entry.snapshot();
    }
    @Override public synchronized Conversation get(String ownerId, UUID id) { prune(); return owned(ownerId, id).snapshot(); }
    @Override public synchronized ConversationList list(String ownerId) {
        prune();
        return new ConversationList("memory", ttl.toSeconds(), entries.values().stream().filter(entry -> entry.ownerId.equals(ownerId))
            .sorted(java.util.Comparator.comparing((Entry entry) -> entry.updatedAt).reversed().thenComparing(entry -> entry.id))
            .map(entry -> new ConversationSummary(entry.id, entry.language, title(entry),
                entry.createdAt, entry.updatedAt, entry.turns.size() * 2, entry.pending != null)).toList());
    }
    private static String title(Entry entry) {
        if (entry.turns.isEmpty()) return "";
        String text = entry.turns.getFirst().user().content();
        int end = Math.min(100, text.length());
        if (end < text.length() && Character.isHighSurrogate(text.charAt(end - 1))) end--;
        return text.substring(0, end);
    }
    @Override public synchronized void delete(String ownerId, UUID id) {
        prune(); var entry = owned(ownerId, id);
        if (entry.pending != null) throw new ApiFailure(409, "AI_CONVERSATION_BUSY", "Für diese Unterhaltung wird bereits eine Antwort erstellt.");
        entries.remove(id);
    }
    @Override public synchronized List<ExecutionRecord> executions(String ownerId, UUID id) { prune(); return List.copyOf(owned(ownerId, id).executions).reversed(); }
    @Override public synchronized void record(PendingTurn pending, ExecutionStep step) {
        var entry = owned(pending.ownerId(), pending.conversationId());
        if (!java.util.Objects.equals(entry.pending, pending.ticket()) || entry.pending == null) throw runExpired();
        if (step.number() < 1 || step.number() > properties.maxToolSteps() || !ProjectTools.NAMES.contains(step.name()) || step.arguments().length() > ProjectTools.ARGUMENT_LIMIT) throw ProjectTools.rejected();
        for (int index = 0; index < entry.executions.size(); index++) {
            var run = entry.executions.get(index); if (!run.id().equals(entry.pending)) continue;
            var steps = new ArrayList<>(run.steps());
            if (step.number() == steps.size() + 1 && "started".equals(step.status())) steps.add(step);
            else if (step.number() == steps.size() && !steps.isEmpty() && "started".equals(steps.getLast().status()) && "completed".equals(step.status())) steps.set(steps.size() - 1, step);
            else throw ProjectTools.rejected();
            entry.executions.set(index, new ExecutionRecord(run.id(), run.requestId(), run.status(), run.startedAt(), run.finishedAt(), run.errorCode(), steps));
        }
    }
    private static ApiFailure runExpired() { return new ApiFailure(409, "AI_RUN_EXPIRED", "Der frühere Lauf ist nicht mehr aktiv. Bitte die Anfrage erneut senden."); }

    @Override public synchronized PendingTurn begin(String ownerId, UUID id, SendMessage input) {
        prune(); Entry entry = owned(ownerId, id);
        var page = PageContexts.normalize(input.context());
        for (Turn turn : entry.turns) {
            if (!turn.requestId().equals(input.requestId())) continue;
            if (!turn.user().content().equals(input.message()) || !java.util.Objects.equals(turn.user().context(), page))
                throw new ApiFailure(409, "AI_REQUEST_MISMATCH", "Diese Anfragekennung gehört zu einer anderen Nachricht.");
            return new PendingTurn(ownerId, id, null, input.requestId(), input.message(), entry.language, List.of(), page, updated(entry, turn));
        }
        if (entry.pending != null) throw new ApiFailure(409, "AI_CONVERSATION_BUSY", "Für diese Unterhaltung wird bereits eine Antwort erstellt.");
        List<Message> history = entry.messages();
        if (entry.turns.size() >= properties.maxTurns() || history.stream().mapToInt(message -> message.content().length()
                + (message.context() == null ? 0 : PageContexts.metadata(message.context()).length())
                + message.tools().stream().filter(tool -> tool.result() != null && tool.result().action() != null)
                    .mapToInt(tool -> NavigationActions.metadata(tool.result().action()).length()).sum()).sum()
                + history.stream().flatMap(message -> message.tools().stream()).filter(tool -> tool.result() != null && tool.result().mutation() != null)
                    .mapToInt(tool -> WorkspaceMutations.metadata(tool.result().mutation()).length()).sum()
                + input.message().length() + (page == null ? 0 : PageContexts.metadata(page).length()) > properties.maxHistoryCharacters())
            throw new ApiFailure(422, "AI_CONTEXT_LIMIT", "Die Unterhaltung ist zu lang. Bitte eine neue Unterhaltung beginnen.");
        entry.pending = UUID.randomUUID();
        entry.updatedAt = clock.instant();
        entry.pendingUntil = clock.instant().plus(properties.timeout()).plusSeconds(5);
        if (entry.executions.size() >= 50) entry.executions.removeFirst();
        entry.executions.add(new ExecutionRecord(entry.pending, input.requestId(), "running", clock.instant(), null, null, List.of()));
        return new PendingTurn(ownerId, id, entry.pending, input.requestId(), input.message(), entry.language, history, page, null);
    }
    @Override public synchronized Turn complete(PendingTurn pending, AiModelGateway.Reply reply) {
        return complete(pending, reply, 0);
    }
    @Override public synchronized Turn complete(PendingTurn pending, AiModelGateway.Reply reply, long sessionVersion) {
        Entry entry = owned(pending.ownerId(), pending.conversationId());
        if (!pending.ticket().equals(entry.pending)) throw runExpired();
        Instant now = clock.instant();
        if (reply.tools().size() > properties.maxToolSteps()
                || reply.tools().stream().map(ToolEvent::id).distinct().count() != reply.tools().size()
                || reply.tools().stream().anyMatch(tool -> tool.id() == null || !ProjectTools.NAMES.contains(tool.name()) || !"completed".equals(tool.status()) || tool.result() == null)) throw ProjectTools.rejected();
        for (var tool : reply.tools()) {
            var mutation = tool.result().mutation();
            if (mutation != null) {
                WorkspaceMutations.validate(mutation);
                if (tool != reply.tools().getLast() || !("workspace.update".equals(mutation.type()) ? "propose_workspace_update" : "propose_workspace_create").equals(tool.name()) || tool.result().action() != null
                        || !"OK".equals(tool.result().outcome()) || !"proposed".equals(mutation.status()) || mutation.resultRevision() != null
                        || entry.mutations.containsKey(mutation.id()) || !mutation.expiresAt().isAfter(now) || mutation.expiresAt().isAfter(now.plusSeconds(300))) throw ProjectTools.rejected();
                entry.mutations.put(mutation.id(), new WorkspaceMutations.Stored(mutation, sessionVersion));
            }
            var action = tool.result() == null ? null : tool.result().action();
            if (action == null) continue;
            NavigationActions.validate(action);
            if (tool != reply.tools().getLast()) throw ProjectTools.rejected();
            if (!"propose_project_navigation".equals(tool.name()) || !"completed".equals(tool.status()) || !"OK".equals(tool.result().outcome())
                    || !"proposed".equals(action.status()) || action.resultCode() != null || entry.actions.containsKey(action.id())
                    || !action.expiresAt().isAfter(now) || action.expiresAt().isAfter(now.plusSeconds(300))) throw ProjectTools.rejected();
            entry.actions.put(action.id(), new ActionEntry(action, sessionVersion));
        }
        Turn turn = new Turn(pending.requestId(), new Message(UUID.randomUUID(), "user", pending.message(), now, List.of(), pending.context()),
            new Message(UUID.randomUUID(), "assistant", reply.text(), now, reply.tools()), new Usage(reply.inputTokens(), reply.outputTokens()), reply.truncated());
        entry.turns.add(turn); end(entry, "succeeded", null); entry.updatedAt = now; return turn;
    }
    private ActionEntry action(Entry entry, UUID actionId) {
        var action = entry.actions.get(actionId);
        if (action == null) throw NavigationActions.notFound();
        return action;
    }
    @Override public synchronized NavigationActions.Stored action(String ownerId, UUID conversationId, UUID actionId) {
        prune(); var entry = owned(ownerId, conversationId); var action = action(entry, actionId);
        return new NavigationActions.Stored(action.value, action.sessionVersion);
    }
    @Override public synchronized NavigationActions.Decision decide(String ownerId, UUID conversationId, UUID actionId, long sessionVersion, NavigationActions.DecisionInput input) {
        prune(); var entry = owned(ownerId, conversationId); var action = action(entry, actionId);
        if (action.sessionVersion != sessionVersion) throw NavigationActions.unavailable();
        if ("expired".equals(action.value.status())) throw NavigationActions.expired();
        if (!"proposed".equals(action.value.status())) throw NavigationActions.decided();
        if (entry.pending != null) throw new ApiFailure(409, "AI_CONVERSATION_BUSY", "Für diese Unterhaltung wird bereits eine Antwort erstellt.");
        boolean approve = "approve".equals(input.decision());
        action.value = action.value.state(approve ? "approved" : "rejected", null);
        action.executionId = approve ? UUID.randomUUID() : null;
        entry.updatedAt = clock.instant();
        return new NavigationActions.Decision(action.value, action.executionId);
    }
    @Override public synchronized NavigationActions.Action report(String ownerId, UUID conversationId, UUID actionId, long sessionVersion, NavigationActions.ResultInput input) {
        prune(); var entry = owned(ownerId, conversationId); var action = action(entry, actionId);
        if (action.sessionVersion != sessionVersion || action.executionId == null || !action.executionId.equals(input.executionId())) throw NavigationActions.unavailable();
        if (!"approved".equals(action.value.status())) {
            if (action.value.status().equals(input.status()) && java.util.Objects.equals(action.value.resultCode(), input.code())) return action.value;
            throw NavigationActions.decided();
        }
        action.value = action.value.state(input.status(), input.code()); entry.updatedAt = clock.instant();
        return action.value;
    }
    @Override public synchronized WorkspaceMutations.Action mutate(String ownerId, UUID conversationId, UUID actionId, long sessionVersion,
            NavigationActions.DecisionInput input, java.util.function.Function<WorkspaceMutations.Action, String> apply) {
        prune(); var entry = owned(ownerId, conversationId); var saved = entry.mutations.get(actionId);
        if (saved == null) throw NavigationActions.notFound();
        if (saved.sessionVersion() != sessionVersion) throw NavigationActions.unavailable();
        boolean approve = "approve".equals(input.decision());
        if (!(approve || "reject".equals(input.decision())) || input.decisionId() == null) throw NavigationActions.invalid();
        var action = saved.action();
        if (approve && "succeeded".equals(action.status()) || !approve && "rejected".equals(action.status())) return action;
        if ("expired".equals(action.status())) throw NavigationActions.expired();
        if (!"proposed".equals(action.status())) throw NavigationActions.decided();
        if (entry.pending != null) throw new ApiFailure(409, "AI_CONVERSATION_BUSY", "Für diese Unterhaltung wird bereits eine Antwort erstellt.");
        String revision = approve ? apply.apply(action) : null;
        var result = action.state(approve ? "succeeded" : "rejected", revision);
        entry.mutations.put(actionId, new WorkspaceMutations.Stored(result, sessionVersion)); entry.updatedAt = clock.instant(); return result;
    }
    @Override public synchronized void abort(PendingTurn pending) {
        abort(pending, "interrupted", "AI_RUN_INTERRUPTED");
    }
    @Override public synchronized void abort(PendingTurn pending, String status, String errorCode) {
        Entry entry = entries.get(pending.conversationId());
        if (entry != null && pending.ticket() != null && pending.ticket().equals(entry.pending)) end(entry, status, errorCode);
    }
}
