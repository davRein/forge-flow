package de.forgeflow.ai;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.metadata.ChatGenerationMetadata;
import org.springframework.ai.chat.metadata.ChatResponseMetadata;
import org.springframework.ai.chat.metadata.DefaultUsage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatOptions;
import reactor.core.publisher.Flux;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.auth.Accounts;
import de.forgeflow.auth.AttemptLimiter;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.workspace.WorkspaceStorage;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static de.forgeflow.ai.AiTestSupport.*;

class AgentExecutionTest {
    private final Accounts accounts = mock(Accounts.class);
    private final WorkspaceStorage storage = mock(WorkspaceStorage.class);
    private final ChatModel model = mock(ChatModel.class);
    private final TestClock clock = new TestClock();
    private final AgentExecutionContext context = new AgentExecutionContext("alice", 0, () -> true);
    private final AtomicInteger calls = new AtomicInteger();
    private final java.util.ArrayList<Prompt> prompts = new java.util.ArrayList<>();
    AgentExecutionTest() {
        when(accounts.findById("alice")).thenReturn(Optional.of(new Accounts.User("alice", "test@example.test", "Test", "test-only-hash", true, true, 0)));
        when(storage.load("alice")).thenReturn(envelope("1"));
    }
    private Envelope envelope(String revision) {
        var empty = Data.empty();
        return new Envelope(1, revision, new Data(List.of(new Project(1, 1, "Alpha", true, "2026-12-31"), new Project(2, 1, "Beta", false, "2026-12-31")),
            empty.customers(), List.of(new Task(1, 1, null, "AL-1", "Saved task", "private-description", "todo", "high", "2026-10-23", "2026-10-23")),
            empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki()));
    }
    private ProjectTools.Session session(int steps) { return new ProjectTools(accounts, storage, JsonMapper.builder().build(), clock, steps).session(context); }
    private ChatResponse tool(int step, String name, String arguments) {
        return new ChatResponse(List.of(new Generation(AssistantMessage.builder().content("")
            .toolCalls(List.of(new AssistantMessage.ToolCall("call_" + step, "function", name, arguments))).build(),
            ChatGenerationMetadata.builder().finishReason("tool_calls").build())), ChatResponseMetadata.builder().usage(new DefaultUsage(10, 3)).build());
    }
    private ChatResponse text(String text, String finish) {
        return new ChatResponse(List.of(new Generation(new AssistantMessage(text), ChatGenerationMetadata.builder().finishReason(finish).build())),
            ChatResponseMetadata.builder().usage(new DefaultUsage(10, 3)).build());
    }
    private void script(java.util.function.IntFunction<Flux<ChatResponse>> script) {
        when(model.stream(any(Prompt.class))).thenAnswer(invocation -> { prompts.add(invocation.getArgument(0)); return script.apply(calls.getAndIncrement()); });
    }
    @Test void sequentialReadsFeedTheirResultsIntoTheNextModelCallAndAggregateUsageAndProgress() {
        script(step -> Flux.just(switch (step) {
            case 0 -> tool(step, "list_projects", "{\"query\":\"Al\",\"offset\":0}");
            case 1 -> tool(step, "list_open_tasks", "{\"project\":\"#1\",\"offset\":0}");
            default -> text("Alpha has one saved open task.", "stop");
        }));
        var chunks = new OpenAiModelGateway(model).stream("en", List.of(), "Find Alpha and read its open tasks", session(4)).collectList().block();
        assertThat(chunks).isNotNull(); var reply = chunks.getLast().completed();
        assertThat(reply.tools()).extracting(AgentDtos.ToolEvent::name).containsExactly("list_projects", "list_open_tasks");
        assertThat(reply.inputTokens()).isEqualTo(30); assertThat(reply.outputTokens()).isEqualTo(9);
        assertThat(chunks.stream().filter(chunk -> chunk.execution() != null).map(AiModelGateway.Chunk::execution).toList()).containsExactly(
            new AgentDtos.Execution("thinking", 0, 4), new AgentDtos.Execution("reading", 1, 4), new AgentDtos.Execution("thinking", 1, 4),
            new AgentDtos.Execution("reading", 2, 4), new AgentDtos.Execution("thinking", 2, 4));
        assertThat(prompts.get(0).getContents()).doesNotContain("Saved task", "private-description");
        assertThat(((org.springframework.ai.chat.messages.ToolResponseMessage) prompts.get(1).getInstructions().getLast()).getResponses().getFirst().responseData()).contains("Alpha").doesNotContain("Saved task", "private-description");
        assertThat(((org.springframework.ai.chat.messages.ToolResponseMessage) prompts.get(2).getInstructions().getLast()).getResponses().getFirst().responseData()).contains("Saved task").doesNotContain("private-description");
        assertThat(prompts.get(2).getInstructions()).extracting(message -> message.getMessageType().getValue()).containsExactly("system", "user", "user", "assistant", "tool", "assistant", "tool");
        verify(storage, times(2)).load("alice"); verifyNoMoreInteractions(storage);
    }
    @ParameterizedTest @ValueSource(ints={1, 4, 6})
    void budgetForcesOneFinalAnswerWithDefinitionsRetainedAndNoExtraToolExecution(int steps) {
        script(step -> Flux.just(step < steps ? tool(step, "list_projects", "{\"query\":\"\",\"offset\":" + step * 10 + "}") : text("Only the checked pages are included.", "stop")));
        var reply = new OpenAiModelGateway(model, Duration.ofSeconds(3), steps).reply("en", List.of(), "Read pages", session(steps));
        assertThat(reply.tools()).hasSize(steps); assertThat(calls).hasValue(steps + 1);
        var options = (OpenAiChatOptions) prompts.getLast().getOptions();
        assertThat(options.getToolChoice()).isEqualTo("none"); assertThat(options.getToolCallbacks()).hasSize(7);
        assertThat(prompts.getLast().getContents()).contains("no tool steps remain", "disclose");
        verify(storage, times(steps)).load("alice");
    }
    @Test void ignoringTheFinalBoundaryCannotExecuteAnotherTool() {
        script(step -> Flux.just(tool(step, "get_project_summary", "{\"project\":\"#" + (step + 1) + "\"}")));
        failure(() -> new OpenAiModelGateway(model, Duration.ofSeconds(3), 1).reply("en", List.of(), "Read", session(1)), 502, "AI_TOOL_REJECTED");
        assertThat(calls).hasValue(2); verify(storage).load("alice"); verifyNoMoreInteractions(storage);
    }
    @Test void reorderedWhitespaceAndCaseEquivalentArgumentsAreRejectedBeforeARepeatedRead() {
        script(step -> Flux.just(tool(step, "list_projects", step == 0 ? "{\"query\":\" Al \",\"offset\":0}" : "{\"offset\":0,\"query\":\"al\"}")));
        failure(() -> new OpenAiModelGateway(model).reply("en", List.of(), "Read", session(4)), 409, "AI_EXECUTION_LOOP");
        assertThat(calls).hasValue(2); verify(storage).load("alice"); verifyNoMoreInteractions(storage);
    }
    @Test void changedWorkspaceRevisionAbortsBeforeReturningMixedResults() {
        when(storage.load("alice")).thenReturn(envelope("1"), envelope("2"));
        script(step -> Flux.just(tool(step, step == 0 ? "list_projects" : "get_project_summary", step == 0 ? "{\"query\":\"\",\"offset\":0}" : "{\"project\":\"#1\"}")));
        failure(() -> new OpenAiModelGateway(model).reply("en", List.of(), "Read", session(4)), 409, "AI_WORKSPACE_CHANGED");
        assertThat(calls).hasValue(2); verify(storage, times(2)).load("alice"); verifyNoMoreInteractions(storage);
    }
    @Test void nonOkResultsAndNavigationProposalsEndTheToolSequence() {
        for (var arguments : List.of("{\"project\":\"#999\"}", "{\"project\":\"#1\",\"view\":\"tasks\"}", "{}")) {
            calls.set(0); prompts.clear(); clearInvocations(storage);
            String name = arguments.contains("view") ? "propose_project_navigation" : "get_project_summary";
            script(step -> Flux.just(step == 0 ? tool(step, name, arguments) : text("Please clarify or confirm the card.", "stop")));
            var reply = new OpenAiModelGateway(model).reply("en", List.of(), "Read", session(4));
            assertThat(calls).hasValue(2); assertThat(reply.tools()).hasSize(1);
            assertThat(((OpenAiChatOptions) prompts.getLast().getOptions()).getToolChoice()).isEqualTo("none");
            verify(storage, times(arguments.equals("{}") ? 0 : 1)).load("alice");
        }
    }
    @Test void absoluteDeadlineCancelsAContinuousSecondModelStream() throws Exception {
        var cancelled = new CountDownLatch(1);
        script(step -> step == 0 ? Flux.just(tool(step, "list_projects", "{\"query\":\"\",\"offset\":0}"))
            : Flux.interval(Duration.ofMillis(15)).map(index -> text("x", "")).doOnCancel(cancelled::countDown));
        failure(() -> new OpenAiModelGateway(model, Duration.ofSeconds(2), 4).stream("en", List.of(), "Read", session(4)).collectList().block(), 504, "AI_TIMEOUT");
        assertThat(cancelled.await(1, TimeUnit.SECONDS)).as("Second provider stream cancelled; calls=%s", calls.get()).isTrue(); assertThat(calls).hasValue(2);
        verify(storage).load("alice"); verifyNoMoreInteractions(storage);
    }
    @Test void aggregateTextAndToolResultBudgetsApplyAcrossAllSteps() {
        script(step -> Flux.just(step == 0 ? new ChatResponse(List.of(new Generation(AssistantMessage.builder().content("x".repeat(9000))
            .toolCalls(List.of(new AssistantMessage.ToolCall("call_0", "function", "list_projects", "{\"query\":\"\",\"offset\":0}"))).build(), ChatGenerationMetadata.builder().finishReason("tool_calls").build())))
            : text("y".repeat(9000), "stop")));
        failure(() -> new OpenAiModelGateway(model).reply("en", List.of(), "Read", session(4)), 502, "AI_INVALID_RESPONSE");
        calls.set(0); prompts.clear();
        var empty = Data.empty(); var projects = java.util.stream.LongStream.rangeClosed(1, 10).mapToObj(id -> new Project(id, 1, "\\".repeat(200), true, "2026-12-31")).toList();
        when(storage.load("alice")).thenReturn(new Envelope(1, "1", new Data(projects, empty.customers(), empty.tasks(), empty.activities(), empty.epics(), empty.sprints(), empty.files(), empty.wiki())));
        script(step -> Flux.just(tool(step, "list_projects", JsonMapper.builder().build().writeValueAsString(java.util.Map.of("query", "\\".repeat(step + 1), "offset", 0)))));
        failure(() -> new OpenAiModelGateway(model, Duration.ofSeconds(3), 6).reply("en", List.of(), "Read", session(6)), 422, "AI_EXECUTION_RESULT_LIMIT");
        assertThat(calls.get()).isBetween(2, 6);
    }
    @Test void revocationDuringASecondModelResponsePreventsTheNextRead() {
        script(step -> {
            if (step == 1) when(accounts.findById("alice")).thenReturn(Optional.empty());
            return Flux.just(tool(step, "list_projects", "{\"query\":\"\",\"offset\":" + step * 10 + "}"));
        });
        failure(() -> new OpenAiModelGateway(model).reply("en", List.of(), "Read", session(4)), 401, "UNAUTHENTICATED");
        verify(storage).load("alice"); verifyNoMoreInteractions(storage);
    }
    @Test void aFailedFinalAnswerLeavesNoCommittedToolHistoryOrApprovableNavigationAndRecoveryIsExplicit() {
        script(step -> step == 0 ? Flux.just(tool(step, "list_projects", "{\"query\":\"\",\"offset\":0}"))
            : step == 1 ? Flux.just(tool(step, "propose_project_navigation", "{\"project\":\"#1\",\"view\":\"tasks\"}"))
            : Flux.error(new IllegalStateException("private-provider-error")));
        var store = new MemoryConversationStore(properties(), clock); var conversation = store.create("alice", "en");
        var service = new AgentService(accounts, store, new OpenAiModelGateway(model), new AgentLimits(properties(), new AttemptLimiter()),
            new ProjectTools(accounts, storage, JsonMapper.builder().build(), clock));
        failure(() -> service.send(context, conversation.id(), new AgentDtos.SendMessage(UUID.randomUUID(), "Find Alpha and open its tasks")), 503, "AI_UNAVAILABLE");
        assertThat(store.get("alice", conversation.id()).messages()).isEmpty(); assertThat(calls).hasValue(3);
        // A new explicit message can recover; no background retry or unfinished action is resumed.
        script(step -> Flux.just(text("Recovered after explicit retry.", "stop")));
        assertThat(service.send(context, conversation.id(), new AgentDtos.SendMessage(UUID.randomUUID(), "Try again")).assistant().content()).contains("Recovered");
        assertThat(calls).hasValue(4);
    }
}
