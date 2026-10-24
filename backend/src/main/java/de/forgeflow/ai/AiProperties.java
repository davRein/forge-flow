package de.forgeflow.ai;

import java.time.Duration;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties("forgeflow.ai")
public record AiProperties(
    @DefaultValue("false") boolean enabled,
    @DefaultValue("") String apiKey,
    @DefaultValue("") String model,
    @DefaultValue("20s") Duration timeout,
    @DefaultValue("completion") String outputTokenMode,
    @DefaultValue("1024") @Min(1) @Max(4096) int maxOutputTokens,
    @DefaultValue("20") @Min(1) @Max(1000) int requestsPer15Minutes,
    @DefaultValue("2") @Min(1) @Max(16) int maxConcurrent,
    @DefaultValue("10") @Min(1) @Max(50) int maxConversationsPerUser,
    @DefaultValue("200") @Min(1) @Max(1000) int maxConversations,
    @DefaultValue("10") @Min(1) @Max(50) int maxTurns,
    @DefaultValue("24000") @Min(4000) @Max(100000) int maxHistoryCharacters,
    @DefaultValue("30m") Duration conversationTtl,
    @DefaultValue("4") @Min(1) @Max(6) int maxToolSteps,
    @DefaultValue("30d") Duration conversationRetention
) {
    @org.springframework.boot.context.properties.bind.ConstructorBinding
    public AiProperties {}
    public AiProperties(boolean enabled, String apiKey, String model, Duration timeout, String outputTokenMode,
            int maxOutputTokens, int requestsPer15Minutes, int maxConcurrent, int maxConversationsPerUser, int maxConversations,
            int maxTurns, int maxHistoryCharacters, Duration conversationTtl, int maxToolSteps) {
        this(enabled, apiKey, model, timeout, outputTokenMode, maxOutputTokens, requestsPer15Minutes, maxConcurrent,
            maxConversationsPerUser, maxConversations, maxTurns, maxHistoryCharacters, conversationTtl, maxToolSteps, Duration.ofDays(30));
    }
    public AiProperties(boolean enabled, String apiKey, String model, Duration timeout, String outputTokenMode,
            int maxOutputTokens, int requestsPer15Minutes, int maxConcurrent, int maxConversationsPerUser, int maxConversations,
            int maxTurns, int maxHistoryCharacters, Duration conversationTtl) {
        this(enabled, apiKey, model, timeout, outputTokenMode, maxOutputTokens, requestsPer15Minutes, maxConcurrent,
            maxConversationsPerUser, maxConversations, maxTurns, maxHistoryCharacters, conversationTtl, 4);
    }
    @AssertTrue(message="Enabled AI requires OPENAI_API_KEY and AI_MODEL.")
    public boolean isConfigured() { return !enabled || (apiKey != null && !apiKey.isBlank() && model != null && !model.isBlank()); }

    @AssertTrue(message="AI_TIMEOUT must be between 1s and 60s.")
    public boolean isTimeoutValid() { return timeout != null && timeout.compareTo(Duration.ofSeconds(1)) >= 0 && timeout.compareTo(Duration.ofSeconds(60)) <= 0; }

    @AssertTrue(message="AI_CONVERSATION_TTL must be between 1m and 8h.")
    public boolean isTtlValid() { return conversationTtl != null && conversationTtl.compareTo(Duration.ofMinutes(1)) >= 0 && conversationTtl.compareTo(Duration.ofHours(8)) <= 0; }
    @AssertTrue(message="AI_CONVERSATION_RETENTION must be between 1d and 365d.")
    public boolean isRetentionValid() { return conversationRetention != null && conversationRetention.compareTo(Duration.ofDays(1)) >= 0 && conversationRetention.compareTo(Duration.ofDays(365)) <= 0; }

    @AssertTrue(message="AI_OUTPUT_TOKEN_MODE must be completion or legacy.")
    public boolean isTokenModeValid() { return "completion".equals(outputTokenMode) || "legacy".equals(outputTokenMode); }

    @Override public String toString() { return "AiProperties[enabled=" + enabled + ", credentials=REDACTED]"; }
}
