package de.forgeflow.ai;

import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.ai.AgentDtos.*;
import de.forgeflow.ai.ChatEntities.*;
import de.forgeflow.api.ApiFailure;

/** Short row-locked transactions only. Never keeps a DB transaction open across provider/tool reads. */
@Repository @Profile("postgres")
@ConditionalOnProperty(prefix="forgeflow.ai", name="enabled", havingValue="true")
@Transactional
public class JpaConversationStore implements ConversationStore {
    private final EntityManager em;
    private final JsonMapper json;
    private final AiProperties properties;
    private final Clock clock;
    @org.springframework.beans.factory.annotation.Autowired
    public JpaConversationStore(EntityManager em, JsonMapper json, AiProperties properties) { this(em, json, properties, Clock.systemUTC()); }
    JpaConversationStore(EntityManager em, JsonMapper json, AiProperties properties, Clock clock) { this.em = em; this.json = json; this.properties = properties; this.clock = clock; }
    private MemoryConversationStore engine() { return new MemoryConversationStore(properties, clock, properties.conversationRetention()); }
    private ApiFailure missing() { return new ApiFailure(404, "AI_CONVERSATION_NOT_FOUND", "Die Unterhaltung wurde nicht gefunden oder ist abgelaufen."); }
    private void prune() {
        em.createQuery("delete from StoredChat chat where chat.updatedAt <= :cutoff and (chat.pendingUntil is null or chat.pendingUntil <= :now)")
            .setParameter("cutoff", clock.instant().minus(properties.conversationRetention())).setParameter("now", clock.instant()).executeUpdate();
    }
    private ConversationRow owned(String owner, UUID id) {
        var rows = em.createQuery("select chat from StoredChat chat where chat.id = :id and chat.ownerId = :owner", ConversationRow.class)
            .setParameter("id", id).setParameter("owner", owner).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
        if (rows.isEmpty()) throw missing();
        var row = rows.getFirst();
        if (!row.updatedAt.isAfter(clock.instant().minus(properties.conversationRetention())) && (row.pendingUntil == null || !row.pendingUntil.isAfter(clock.instant()))) throw missing();
        return row;
    }
    private List<ExecutionRow> records(ConversationRow row) {
        return em.createQuery("select run from StoredChatExecution run where run.ownerId = :owner and run.conversationId = :id order by run.position", ExecutionRow.class)
            .setParameter("owner", row.ownerId).setParameter("id", row.id).getResultList();
    }
    private <T> T use(String owner, UUID id, Function<MemoryConversationStore, T> action) {
        var row = owned(owner, id); var records = records(row);
        var state = json.readValue(row.payload, ConversationState.class);
        if ((state.version() < 1 || state.version() > 5) || !id.equals(state.id()) || !owner.equals(state.ownerId())) throw new IllegalStateException("Invalid stored conversation identity or version.");
        var engine = engine(); engine.restore(state.executions(records.stream().map(run -> json.readValue(run.payload, ExecutionRecord.class)).toList()));
        T result = action.apply(engine);
        // Workspace commits clear the shared persistence context after their bulk writes.
        // Reattach the locked chat/ledger before saving the decision in the same transaction.
        if (!em.contains(row)) { row = owned(owner, id); records = records(row); }
        save(row, engine.state(owner, id), records);
        return result;
    }
    private void save(ConversationRow row, ConversationState state, List<ExecutionRow> rows) {
        row.language = state.language(); row.createdAt = state.createdAt(); row.updatedAt = state.updatedAt(); row.pendingUntil = state.pendingUntil();
        row.payload = json.writeValueAsString(state.executions(List.of()));
        if (!em.contains(row)) em.persist(row);
        long position = rows.stream().mapToLong(run -> run.position).max().orElse(0);
        for (var saved : rows) if (state.executions().stream().noneMatch(run -> run.id().equals(saved.id))) em.remove(saved);
        for (var run : state.executions()) {
            var saved = rows.stream().filter(candidate -> candidate.id.equals(run.id())).findFirst().orElse(null);
            boolean fresh = saved == null;
            if (fresh) { saved = new ExecutionRow(); saved.id = run.id(); saved.ownerId = state.ownerId(); saved.conversationId = state.id(); saved.position = ++position; }
            saved.requestId = run.requestId(); saved.status = run.status(); saved.startedAt = run.startedAt(); saved.finishedAt = run.finishedAt(); saved.errorCode = run.errorCode();
            saved.payload = json.writeValueAsString(run);
            if (fresh) em.persist(saved);
        }
        em.flush();
    }
    @Override public Conversation create(String owner, String language) {
        em.find(StoreLock.class, 1, LockModeType.PESSIMISTIC_WRITE); prune();
        long total = em.createQuery("select count(chat) from StoredChat chat", Long.class).getSingleResult();
        long own = em.createQuery("select count(chat) from StoredChat chat where chat.ownerId = :owner", Long.class).setParameter("owner", owner).getSingleResult();
        if (total >= properties.maxConversations() || own >= properties.maxConversationsPerUser()) throw new ApiFailure(429, "AI_CONVERSATION_LIMIT", "Zu viele Unterhaltungen. Bitte später erneut versuchen.");
        var engine = engine(); var conversation = engine.create(owner, language); var state = engine.state(owner, conversation.id());
        var row = new ConversationRow(); row.id = conversation.id(); row.ownerId = owner; save(row, state, List.of()); return conversation;
    }
    @Override public Conversation get(String owner, UUID id) { return use(owner, id, store -> store.get(owner, id)); }
    @Override public ConversationList list(String owner) {
        // Lock rows in stable ID order to avoid deadlocks between simultaneous list requests.
        var ids = em.createQuery("select chat.id from StoredChat chat where chat.ownerId = :owner and chat.updatedAt > :cutoff order by chat.id", UUID.class)
            .setParameter("owner", owner).setParameter("cutoff", clock.instant().minus(properties.conversationRetention())).setMaxResults(50).getResultList();
        var items = ids.stream().map(id -> use(owner, id, store -> store.list(owner).items().getFirst()))
            .sorted(java.util.Comparator.comparing(ConversationSummary::updatedAt).reversed().thenComparing(ConversationSummary::id)).toList();
        return new ConversationList("postgresql", properties.conversationRetention().toSeconds(), items);
    }
    @Override public void delete(String owner, UUID id) {
        get(owner, id); var row = owned(owner, id);
        if (row.pendingUntil != null && row.pendingUntil.isAfter(clock.instant())) throw new ApiFailure(409, "AI_CONVERSATION_BUSY", "Für diese Unterhaltung wird bereits eine Antwort erstellt.");
        em.remove(row); em.flush();
    }
    @Override public List<ExecutionRecord> executions(String owner, UUID id) { return use(owner, id, store -> store.executions(owner, id)); }
    @Override public PendingTurn begin(String owner, UUID id, SendMessage input) { return use(owner, id, store -> store.begin(owner, id, input)); }
    @Override public Turn complete(PendingTurn pending, AiModelGateway.Reply reply) { return complete(pending, reply, 0); }
    @Override public Turn complete(PendingTurn pending, AiModelGateway.Reply reply, long version) { return use(pending.ownerId(), pending.conversationId(), store -> store.complete(pending, reply, version)); }
    @Override public void record(PendingTurn pending, ExecutionStep step) { use(pending.ownerId(), pending.conversationId(), store -> { store.record(pending, step); return null; }); }
    @Override public NavigationActions.Stored action(String owner, UUID id, UUID actionId) { return use(owner, id, store -> store.action(owner, id, actionId)); }
    @Override public NavigationActions.Decision decide(String owner, UUID id, UUID actionId, long version, NavigationActions.DecisionInput input) { return use(owner, id, store -> store.decide(owner, id, actionId, version, input)); }
    @Override public NavigationActions.Action report(String owner, UUID id, UUID actionId, long version, NavigationActions.ResultInput input) { return use(owner, id, store -> store.report(owner, id, actionId, version, input)); }
    @Override public WorkspaceMutations.Action mutate(String owner, UUID id, UUID actionId, long version, NavigationActions.DecisionInput input,
            Function<WorkspaceMutations.Action, String> apply) { return use(owner, id, store -> store.mutate(owner, id, actionId, version, input, apply)); }
    @Override public void abort(PendingTurn pending) { abort(pending, "interrupted", "AI_RUN_INTERRUPTED"); }
    @Override public void abort(PendingTurn pending, String status, String code) {
        try { use(pending.ownerId(), pending.conversationId(), store -> { store.abort(pending, status, code); return null; }); }
        catch (ApiFailure error) { if (error.status != 404) throw error; }
    }
}
