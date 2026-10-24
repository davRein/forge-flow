package de.forgeflow.ai;

import java.time.Instant;
import java.util.UUID;
import jakarta.persistence.*;

/** Internal database rows, distinct from public conversation and execution DTOs. */
public final class ChatEntities {
    private ChatEntities() {}
    @Entity(name="ChatStoreLock") @Table(name="ff_ai_store_lock")
    public static class StoreLock { @Id public int id; }
    @Entity(name="StoredChat") @Table(name="ff_ai_conversations")
    public static class ConversationRow {
        @Id public UUID id;
        @Column(name="owner_id", length=128, nullable=false) public String ownerId;
        @Column(length=2, nullable=false) public String language;
        @Column(name="created_at", nullable=false) public Instant createdAt;
        @Column(name="updated_at", nullable=false) public Instant updatedAt;
        @Column(name="pending_until") public Instant pendingUntil;
        @Column(nullable=false, columnDefinition="text") public String payload;
    }
    @Entity(name="StoredChatExecution") @Table(name="ff_ai_executions")
    public static class ExecutionRow {
        @Id public UUID id;
        @Column(name="owner_id", length=128, nullable=false) public String ownerId;
        @Column(name="conversation_id", nullable=false) public UUID conversationId;
        @Column(name="request_id", nullable=false) public UUID requestId;
        @Column(name="sequence_number", nullable=false) public long position;
        @Column(length=16, nullable=false) public String status;
        @Column(name="started_at", nullable=false) public Instant startedAt;
        @Column(name="finished_at") public Instant finishedAt;
        @Column(name="error_code", length=64) public String errorCode;
        @Column(nullable=false, columnDefinition="text") public String payload;
    }
}
