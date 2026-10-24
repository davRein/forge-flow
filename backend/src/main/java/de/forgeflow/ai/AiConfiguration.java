package de.forgeflow.ai;

import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import de.forgeflow.auth.Accounts;
import de.forgeflow.auth.AttemptLimiter;
import de.forgeflow.workspace.WorkspaceStorage;

@Configuration(proxyBeanMethods=false)
@EnableConfigurationProperties(AiProperties.class)
public class AiConfiguration {
    static OpenAiChatOptions options(AiProperties properties) {
        var options = OpenAiChatOptions.builder().apiKey(properties.apiKey()).model(properties.model()).baseUrl("https://api.openai.com/v1")
            .timeout(properties.timeout()).maxRetries(0).store(false).n(1).temperature(null).streamUsage(true);
        if ("legacy".equals(properties.outputTokenMode())) options.maxTokens(properties.maxOutputTokens());
        else options.maxCompletionTokens(properties.maxOutputTokens());
        // Luna requires non-reasoning Chat Completions for function calling. Preserve the configured model.
        if (properties.model().equals("gpt-6-luna") || properties.model().startsWith("gpt-6-luna-")) options.reasoningEffort("none");
        return options.build();
    }
    @Configuration(proxyBeanMethods=false)
    @ConditionalOnProperty(prefix="forgeflow.ai", name="enabled", havingValue="true")
    static class Enabled {
        @Bean @ConditionalOnMissingBean(AiModelGateway.class)
        AiModelGateway aiModelGateway(AiProperties properties) {
            return new OpenAiModelGateway(OpenAiChatModel.builder().options(options(properties)).build(), properties.timeout(), properties.maxToolSteps());
        }
        @Bean ProjectTools projectTools(Accounts accounts, WorkspaceStorage storage, tools.jackson.databind.json.JsonMapper json, AiProperties properties) {
            return new ProjectTools(accounts, storage, json, Clock.systemUTC(), properties.maxToolSteps());
        }
        @Bean @org.springframework.context.annotation.Profile("!postgres")
        ConversationStore conversations(AiProperties properties) { return new MemoryConversationStore(properties, Clock.systemUTC()); }
        @Bean AgentActions agentActions(Accounts accounts, WorkspaceStorage storage, ConversationStore conversations) { return new AgentActions(accounts, storage, conversations); }
        @Bean AgentLimits agentLimits(AiProperties properties, AttemptLimiter attempts) { return new AgentLimits(properties, attempts); }
        @Bean AgentService agentService(Accounts accounts, ConversationStore conversations, AiModelGateway model, AgentLimits limits, ProjectTools tools) {
            return new AgentService(accounts, conversations, model, limits, tools);
        }
        @Bean AgentStreams agentStreams(Accounts accounts, ConversationStore conversations, AiModelGateway model, AgentLimits limits, AiProperties properties, ProjectTools tools) {
            return new AgentStreams(accounts, conversations, model, limits, properties, tools);
        }
    }
}
