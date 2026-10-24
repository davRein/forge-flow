package de.forgeflow.ai;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.validation.autoconfigure.ValidationAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import de.forgeflow.auth.Accounts;
import de.forgeflow.auth.AttemptLimiter;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static de.forgeflow.ai.AiTestSupport.*;

class AiConfigurationTest {
    @Configuration(proxyBeanMethods=false) static class Dependencies {
        @Bean Accounts accounts() { return mock(Accounts.class); }
        @Bean AttemptLimiter attempts() { return new AttemptLimiter(); }
        @Bean de.forgeflow.workspace.WorkspaceStorage storage() { return mock(de.forgeflow.workspace.WorkspaceStorage.class); }
        @Bean tools.jackson.databind.json.JsonMapper json() { return tools.jackson.databind.json.JsonMapper.builder().build(); }
    }
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
        .withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
        .withUserConfiguration(Dependencies.class, AiConfiguration.class);

    @Test void disabledByDefaultNeedsNoKeyAndCreatesNoAiClientsOrStores() {
        runner.run(context -> {
            assertThat(context).hasNotFailed().hasSingleBean(AiProperties.class)
                .doesNotHaveBean(AiModelGateway.class).doesNotHaveBean(AgentService.class).doesNotHaveBean(ConversationStore.class).doesNotHaveBean(AgentStreams.class);
            assertThat(context.getBean(AiProperties.class).enabled()).isFalse();
            assertThat(context.getBean(AiProperties.class).maxToolSteps()).isEqualTo(4);
        });
    }
    @Test void enabledWithoutConfigurationFailsFast() {
        runner.withPropertyValues("forgeflow.ai.enabled=true").run(context -> assertThat(context).hasFailed());
    }
    @Test void configuredFeatureWiresTheRealProviderWithoutMakingRequests() {
        runner.withPropertyValues("forgeflow.ai.enabled=true", "forgeflow.ai.api-key=test-only-key", "forgeflow.ai.model=test-only-model")
            .run(context -> {
                assertThat(context).hasNotFailed().hasSingleBean(AgentService.class).hasSingleBean(AiModelGateway.class);
                assertThat(context.getBean(AiModelGateway.class)).isInstanceOf(OpenAiModelGateway.class);
            });
    }
    @Test void invalidBoundsAndTokenModeAreRejectedAtStartup() {
        for (String value : new String[] {"forgeflow.ai.max-concurrent=0", "forgeflow.ai.timeout=5m",
                "forgeflow.ai.max-output-tokens=999999", "forgeflow.ai.output-token-mode=both", "forgeflow.ai.conversation-ttl=1s",
                "forgeflow.ai.max-tool-steps=0", "forgeflow.ai.max-tool-steps=7", "forgeflow.ai.conversation-retention=1h", "forgeflow.ai.conversation-retention=366d"})
            runner.withPropertyValues(value).run(context -> assertThat(context).hasFailed());
    }
    @Test void modelOptionsEnforceTimeoutNoRetriesAndExclusiveTokenLimits() {
        var options = AiConfiguration.options(properties());
        assertThat(options.getModel()).isEqualTo("test-only-model");
        assertThat(options.getMaxCompletionTokens()).isEqualTo(256); assertThat(options.getMaxTokens()).isNull();
        assertThat(options.getTemperature()).isNull(); assertThat(options.getStore()).isFalse();
        assertThat(options.getMaxRetries()).isZero(); assertThat(options.getTimeout()).isEqualTo(java.time.Duration.ofSeconds(1));
        var original = properties();
        var legacy = new AiProperties(true, original.apiKey(), original.model(), original.timeout(), "legacy", original.maxOutputTokens(),
            original.requestsPer15Minutes(), original.maxConcurrent(), original.maxConversationsPerUser(), original.maxConversations(),
            original.maxTurns(), original.maxHistoryCharacters(), original.conversationTtl());
        assertThat(AiConfiguration.options(legacy).getMaxTokens()).isEqualTo(256);
        assertThat(AiConfiguration.options(legacy).getMaxCompletionTokens()).isNull();
        assertThat(original.toString()).doesNotContain(original.apiKey());
    }
    @Test void lunaChatCompletionsUsesItsDocumentedNonReasoningToolModeWithoutChangingTheModel() {
        var original = properties();
        var luna = new AiProperties(true, original.apiKey(), "gpt-6-luna", original.timeout(), original.outputTokenMode(), original.maxOutputTokens(),
            original.requestsPer15Minutes(), original.maxConcurrent(), original.maxConversationsPerUser(), original.maxConversations(), original.maxTurns(), original.maxHistoryCharacters(), original.conversationTtl());
        assertThat(AiConfiguration.options(luna).getModel()).isEqualTo("gpt-6-luna");
        assertThat(AiConfiguration.options(luna).getReasoningEffort()).isEqualTo("none");
        assertThat(AiConfiguration.options(original).getReasoningEffort()).isNull();
    }
}
