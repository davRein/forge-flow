package de.forgeflow.ai;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AgentDtos {
    private AgentDtos() {}
    public record CreateConversation(@Pattern(regexp="de|en") String language) {
        public CreateConversation { if (language == null) language = "de"; }
    }
    public record PageContext(@NotBlank @Size(max=64) String route, @jakarta.validation.constraints.Positive Long projectId,
                              @Size(max=16) String projectTab) {
        @Override public String toString() { return "PageContext[content=REDACTED]"; }
    }
    public record SendMessage(@NotNull UUID requestId, @NotBlank @Size(max=4000) String message, @jakarta.validation.Valid PageContext context) {
        public SendMessage(UUID requestId, String message) { this(requestId, message, null); }
        @Override public String toString() { return "SendMessage[content=REDACTED]"; }
    }
    public record ToolEvent(UUID id, String name, String status, ProjectTools.Result result) {
        @Override public String toString() { return "ToolEvent[name=" + name + ", status=" + status + ", content=REDACTED]"; }
    }
    public record Message(UUID id, String role, String content, Instant createdAt, List<ToolEvent> tools, PageContext context) {
        public Message { tools = List.copyOf(tools); }
        public Message(UUID id, String role, String content, Instant createdAt, List<ToolEvent> tools) { this(id, role, content, createdAt, tools, null); }
        public Message(UUID id, String role, String content, Instant createdAt) { this(id, role, content, createdAt, List.of(), null); }
        @Override public String toString() { return "Message[role=" + role + ", content=REDACTED]"; }
    }
    public record Usage(Integer inputTokens, Integer outputTokens) {}
    public record Execution(String phase, int step, int maxSteps) {}
    public record ConversationSummary(UUID id, String language, String title, Instant createdAt, Instant updatedAt, int messageCount, boolean busy) {
        @Override public String toString() { return "ConversationSummary[content=REDACTED]"; }
    }
    public record ConversationList(String storage, long retentionSeconds, List<ConversationSummary> items) {}
    public record ExecutionStep(int number, String name, String arguments, String status, String outcome, Instant startedAt, Instant finishedAt) {
        @Override public String toString() { return "ExecutionStep[content=REDACTED]"; }
    }
    public record ExecutionRecord(UUID id, UUID requestId, String status, Instant startedAt, Instant finishedAt, String errorCode, List<ExecutionStep> steps) {
        public ExecutionRecord { steps = List.copyOf(steps); }
        @Override public String toString() { return "ExecutionRecord[content=REDACTED]"; }
    }
    public record Turn(UUID requestId, Message user, Message assistant, Usage usage, boolean truncated) {
        @Override public String toString() { return "Turn[content=REDACTED]"; }
    }
    public record Conversation(UUID id, String language, Instant createdAt, Instant updatedAt, List<Message> messages, boolean busy) {
        public Conversation(UUID id, String language, Instant createdAt, Instant updatedAt, List<Message> messages) { this(id, language, createdAt, updatedAt, messages, false); }
        public Conversation { messages = List.copyOf(messages); }
        @Override public String toString() { return "Conversation[content=REDACTED]"; }
    }
}
