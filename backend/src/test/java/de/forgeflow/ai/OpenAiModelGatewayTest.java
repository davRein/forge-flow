package de.forgeflow.ai;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import static org.assertj.core.api.Assertions.*;
import static de.forgeflow.ai.AiTestSupport.*;

class OpenAiModelGatewayTest {
    @Test void currentPageMetadataRemainsUserDataAndSupersedesHistoricalProjectContext() {
        var captured = new AtomicReference<Prompt>();
        var model = org.mockito.Mockito.mock(ChatModel.class);
        org.mockito.Mockito.when(model.stream(org.mockito.ArgumentMatchers.any(Prompt.class))).thenAnswer(invocation -> {
            captured.set(invocation.getArgument(0)); return reactor.core.publisher.Flux.just(response("Wiki help", "stop"));
        });
        var accounts = org.mockito.Mockito.mock(de.forgeflow.auth.Accounts.class);
        org.mockito.Mockito.when(accounts.findById("alice")).thenReturn(java.util.Optional.of(new de.forgeflow.auth.Accounts.User("alice", "test@example.test", "Test", "hash", false, true, 0)));
        var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
        var registry = new ProjectTools(accounts, storage, tools.jackson.databind.json.JsonMapper.builder().build(), new TestClock());
        var current = registry.session(new AgentExecutionContext("alice", 0, () -> true), () -> true, new AgentDtos.PageContext("/wiki/articles", null, null));
        var history = List.of(new AgentDtos.Message(UUID.randomUUID(), "user", "Hier?", Instant.now(), List.of(), new AgentDtos.PageContext("/projectManager/projects", 17L, "tasks")),
            new AgentDtos.Message(UUID.randomUUID(), "assistant", "Project answer", Instant.now()));
        new OpenAiModelGateway(model).reply("de", history, "Was kann ich hier machen?", current);
        var messages = captured.get().getInstructions();
        assertThat(messages).extracting(message -> message.getMessageType().getValue()).containsExactly("system", "user", "user", "assistant", "user", "user");
        assertThat(messages.getFirst().getText()).contains("LATEST", "ask which project", "only propose the three navigation targets").doesNotContain("\"projectId\":17");
        assertThat(messages.get(1).getText()).contains("\"projectId\":17");
        assertThat(messages.get(4).getText()).contains("/wiki/articles", "pageHelp").doesNotContain("projectId", "17");
        assertThat(messages.getLast().getText()).isEqualTo("Was kann ich hier machen?");
        org.mockito.Mockito.verifyNoInteractions(storage);
    }
    private static ChatResponse response(String text, String finish) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text), ChatGenerationMetadata.builder().finishReason(finish).build())),
            ChatResponseMetadata.builder().usage(new DefaultUsage(20, 4)).build());
    }
    @Test void onlyServerSystemPromptAndOwnedHistoryAreSentWithUsageAndTruncation() {
        var prompt = new AtomicReference<Prompt>();
        ChatModel model = input -> { prompt.set(input); return response("Text", "length"); };
        var gateway = new OpenAiModelGateway(model);
        var history = List.of(new AgentDtos.Message(UUID.randomUUID(), "user", "Hallo", Instant.now()),
            new AgentDtos.Message(UUID.randomUUID(), "assistant", "Antwort", Instant.now()));
        var result = gateway.reply("de", history, "Weiter");
        assertThat(prompt.get().getInstructions()).extracting(message -> message.getMessageType().getValue()).containsExactly("system", "user", "assistant", "user");
        assertThat(prompt.get().getInstructions().getFirst().getText()).contains("NO application tools", "Antworte auf Deutsch.");
        assertThat(result.text()).isEqualTo("Text"); assertThat(result.truncated()).isTrue(); assertThat(result.inputTokens()).isEqualTo(20);
        gateway.reply("en", List.of(), "Hello");
        assertThat(prompt.get().getInstructions().getFirst().getText()).contains("Respond in English.");
    }
    @Test void blankOversizedFilteredAndIncompleteResponsesAreRejected() {
        for (var response : new ChatResponse[] {response(" ", "stop"), response("x".repeat(16001), "stop"),
                response("Text", "content_filter"), new ChatResponse(List.of())}) {
            var gateway = new OpenAiModelGateway(input -> response);
            failure(() -> gateway.reply("de", List.of(), "Hallo"), 502, "AI_INVALID_RESPONSE");
        }
    }
    @Test void providerExceptionTextIsNeverExposedAndTimeoutsAreRecognizable() {
        try (var logs = new AiLogCapture()) {
            var gateway = new OpenAiModelGateway(input -> { throw new IllegalStateException("sensitive-provider-detail"); });
            assertThatThrownBy(() -> gateway.reply("de", List.of(), "Hallo")).hasMessageNotContaining("sensitive-provider-detail");
            var timeout = new OpenAiModelGateway(input -> { throw new IllegalStateException(new java.net.SocketTimeoutException("sensitive-url")); });
            failure(() -> timeout.reply("de", List.of(), "Hallo"), 504, "AI_TIMEOUT");
            assertThat(logs.text()).contains("AI diagnostic phase=request category=internal", "exception=java.lang.IllegalStateException",
                "location=de.forgeflow.ai.OpenAiModelGatewayTest#").doesNotContain("sensitive-provider-detail", "sensitive-url");
        }
    }
    @Test void streamingRejectsMissingFinishFilteredAndOversizedReplies() {
        for (var responses : List.of(List.of(response("Partial", "")), List.of(response("Filtered", "content_filter")), List.of(response("x".repeat(16001), "stop")))) {
            var model = org.mockito.Mockito.mock(ChatModel.class);
            org.mockito.Mockito.when(model.stream(org.mockito.ArgumentMatchers.any(Prompt.class))).thenReturn(reactor.core.publisher.Flux.fromIterable(responses));
            var gateway = new OpenAiModelGateway(model);
            failure(() -> gateway.stream("en", List.of(), "Hello").collectList().block(), 502, "AI_INVALID_RESPONSE");
        }
    }
    @Test void reusedCallIdsAndMultipleParallelToolCallsAreRejected() {
        for (boolean multiple : new boolean[] {false, true}) {
            var calls = java.util.List.of(new AssistantMessage.ToolCall("call_1", "function", "list_projects", "{\"query\":\"\",\"offset\":0}"));
            var both = new java.util.ArrayList<>(calls); both.add(new AssistantMessage.ToolCall("call_2", "function", "list_projects", "{\"query\":\"\",\"offset\":0}"));
            var toolResponse = new ChatResponse(List.of(new Generation(AssistantMessage.builder().toolCalls(multiple ? both : calls).content("").build(),
                ChatGenerationMetadata.builder().finishReason("tool_calls").build())));
            var model = org.mockito.Mockito.mock(ChatModel.class);
            org.mockito.Mockito.when(model.stream(org.mockito.ArgumentMatchers.any(Prompt.class))).thenReturn(reactor.core.publisher.Flux.just(toolResponse));
            var accounts = org.mockito.Mockito.mock(de.forgeflow.auth.Accounts.class);
            org.mockito.Mockito.when(accounts.findById("alice")).thenReturn(java.util.Optional.of(new de.forgeflow.auth.Accounts.User("alice", "test@example.test", "Test", "hash", false, true, 0)));
            var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
            org.mockito.Mockito.when(storage.load("alice")).thenReturn(new de.forgeflow.workspace.WorkspaceDtos.Envelope(1, "1", de.forgeflow.workspace.WorkspaceDtos.Data.empty()));
            var projectTools = new ProjectTools(accounts, storage, tools.jackson.databind.json.JsonMapper.builder().build(), new TestClock());
            failure(() -> new OpenAiModelGateway(model).stream("en", List.of(), "List my projects", projectTools.session(new AgentExecutionContext("alice", 0, () -> true))).collectList().block(), 502, "AI_TOOL_REJECTED");
            org.mockito.Mockito.verify(model, org.mockito.Mockito.times(multiple ? 1 : 2)).stream(org.mockito.ArgumentMatchers.any(Prompt.class));
            if (multiple) org.mockito.Mockito.verifyNoInteractions(storage); else org.mockito.Mockito.verify(storage).load("alice");
        }
    }
    @Test void ordinaryMessagesRegisterToolsWithoutReadingOrSendingTheWorkspace() {
        var model = org.mockito.Mockito.mock(ChatModel.class);
        var prompt = new AtomicReference<Prompt>();
        org.mockito.Mockito.when(model.stream(org.mockito.ArgumentMatchers.any(Prompt.class))).thenAnswer(invocation -> {
            prompt.set(invocation.getArgument(0)); return reactor.core.publisher.Flux.just(response("Hello", "stop"));
        });
        var accounts = org.mockito.Mockito.mock(de.forgeflow.auth.Accounts.class);
        org.mockito.Mockito.when(accounts.findById("alice")).thenReturn(java.util.Optional.of(new de.forgeflow.auth.Accounts.User("alice", "test@example.test", "Test", "hash", false, true, 0)));
        var storage = org.mockito.Mockito.mock(de.forgeflow.workspace.WorkspaceStorage.class);
        var registry = new ProjectTools(accounts, storage, tools.jackson.databind.json.JsonMapper.builder().build(), new TestClock());
        var reply = new OpenAiModelGateway(model).reply("en", List.of(), "Hello", registry.session(new AgentExecutionContext("alice", 0, () -> true)));
        assertThat(reply.text()).isEqualTo("Hello"); assertThat(reply.tools()).isEmpty();
        assertThat(((org.springframework.ai.model.tool.ToolCallingChatOptions) prompt.get().getOptions()).getToolCallbacks()).hasSize(7);
        assertThat(prompt.get().getInstructions().getFirst().getText()).contains("UNTRUSTED DATA", "at most 4 sequential tool steps");
        org.mockito.Mockito.verifyNoInteractions(storage);
        org.mockito.Mockito.verify(model).stream(org.mockito.ArgumentMatchers.any(Prompt.class));
    }
}
