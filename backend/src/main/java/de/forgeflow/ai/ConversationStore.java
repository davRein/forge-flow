package de.forgeflow.ai;

import java.util.List;
import java.util.UUID;
import de.forgeflow.ai.AgentDtos.*;

public interface ConversationStore {
    record PendingTurn(String ownerId, UUID conversationId, UUID ticket, UUID requestId, String message,
            String language, List<Message> history, PageContext context, Turn replay) {
        public PendingTurn { history = List.copyOf(history); }
        @Override public String toString() { return "PendingTurn[content=REDACTED]"; }
    }
    Conversation create(String ownerId, String language);
    Conversation get(String ownerId, UUID conversationId);
    ConversationList list(String ownerId);
    void delete(String ownerId, UUID conversationId);
    List<ExecutionRecord> executions(String ownerId, UUID conversationId);
    void record(PendingTurn pending, ExecutionStep step);
    PendingTurn begin(String ownerId, UUID conversationId, SendMessage input);
    Turn complete(PendingTurn pending, AiModelGateway.Reply reply);
    default Turn complete(PendingTurn pending, AiModelGateway.Reply reply, long sessionVersion) { return complete(pending, reply); }
    NavigationActions.Stored action(String ownerId, UUID conversationId, UUID actionId);
    NavigationActions.Decision decide(String ownerId, UUID conversationId, UUID actionId, long sessionVersion, NavigationActions.DecisionInput input);
    NavigationActions.Action report(String ownerId, UUID conversationId, UUID actionId, long sessionVersion, NavigationActions.ResultInput input);
    WorkspaceMutations.Action mutate(String ownerId, UUID conversationId, UUID actionId, long sessionVersion,
        NavigationActions.DecisionInput input, java.util.function.Function<WorkspaceMutations.Action, String> apply);
    void abort(PendingTurn pending);
    default void abort(PendingTurn pending, String status, String errorCode) { abort(pending); }
}
