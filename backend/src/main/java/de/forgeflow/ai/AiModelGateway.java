package de.forgeflow.ai;

import java.util.List;
import de.forgeflow.ai.AgentDtos.Message;
import reactor.core.publisher.Flux;

@FunctionalInterface
public interface AiModelGateway {
    record Reply(String text, Integer inputTokens, Integer outputTokens, boolean truncated, List<AgentDtos.ToolEvent> tools) {
        public Reply { tools = List.copyOf(tools); }
        public Reply(String text, Integer inputTokens, Integer outputTokens, boolean truncated) { this(text, inputTokens, outputTokens, truncated, List.of()); }
        @Override public String toString() { return "Reply[content=REDACTED]"; }
    }
    Reply reply(String language, List<Message> history, String message);
    default Reply reply(String language, List<Message> history, String message, ProjectTools.Session tools) { return reply(language, history, message); }
    record Chunk(String delta, Reply completed, AgentDtos.ToolEvent tool, AgentDtos.Execution execution) {
        public Chunk(String delta, Reply completed) { this(delta, completed, null, null); }
        public Chunk(String delta, Reply completed, AgentDtos.ToolEvent tool) { this(delta, completed, tool, null); }
        @Override public String toString() { return "Chunk[content=REDACTED]"; }
    }
    default Flux<Chunk> stream(String language, List<Message> history, String message) {
        return Flux.error(new UnsupportedOperationException("Streaming is not supported by this gateway."));
    }
    default Flux<Chunk> stream(String language, List<Message> history, String message, ProjectTools.Session tools) { return stream(language, history, message); }
}
