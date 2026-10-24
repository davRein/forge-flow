package de.forgeflow.ai;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import de.forgeflow.ai.AgentDtos.*;

/** Internal aggregate state, never an HTTP response. Execution grants stay private. */
record ConversationState(int version, UUID id, String ownerId, String language, Instant createdAt, Instant updatedAt, UUID pending,
                         Instant pendingUntil, List<Turn> turns, List<ActionState> actions, List<ExecutionRecord> executions,
                         @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_EMPTY) List<WorkspaceMutations.Stored> mutations) {
    record ActionState(NavigationActions.Action action, long sessionVersion, UUID executionId) {
        @Override public String toString() { return "ActionState[content=REDACTED]"; }
    }
    ConversationState executions(List<ExecutionRecord> records) { return new ConversationState(version, id, ownerId, language, createdAt, updatedAt, pending, pendingUntil, turns, actions, records, mutations); }
    @Override public String toString() { return "ConversationState[content=REDACTED]"; }
}
