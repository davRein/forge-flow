package de.forgeflow.ai;

import java.util.UUID;
import de.forgeflow.ai.AgentDtos.*;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.Accounts;

public final class AgentService {
    private final Accounts accounts;
    private final ConversationStore conversations;
    private final AiModelGateway model;
    private final AgentLimits limits;
    private final ProjectTools tools;
    public AgentService(Accounts accounts, ConversationStore conversations, AiModelGateway model, AgentLimits limits, ProjectTools tools) {
        this.accounts = accounts; this.conversations = conversations; this.model = model; this.limits = limits;
        this.tools = tools;
    }
    public Conversation create(AgentExecutionContext context, String language) {
        context.verify(accounts); return conversations.create(context.userId(), language);
    }
    public Conversation get(AgentExecutionContext context, UUID id) {
        context.verify(accounts); return conversations.get(context.userId(), id);
    }
    public ConversationList list(AgentExecutionContext context) { context.verify(accounts); return conversations.list(context.userId()); }
    public void delete(AgentExecutionContext context, UUID id) { context.verify(accounts); conversations.delete(context.userId(), id); }
    public java.util.List<ExecutionRecord> executions(AgentExecutionContext context, UUID id) { context.verify(accounts); return conversations.executions(context.userId(), id); }
    public Turn send(AgentExecutionContext context, UUID id, SendMessage input) {
        context.verify(accounts);
        var pending = conversations.begin(context.userId(), id, input);
        if (pending.replay() != null) return pending.replay();
        try (var lease = limits.acquire(context.userId())) {
            context.verify(accounts);
            var reply = model.reply(pending.language(), pending.history(), pending.message(), tools.session(context, () -> true, pending.context(), step -> conversations.record(pending, step)));
            // Logout, password changes or account deactivation can happen during the provider call.
            context.verify(accounts);
            if (reply == null || reply.text() == null || reply.text().isBlank() || reply.text().length() > 16000)
                throw new ApiFailure(502, "AI_INVALID_RESPONSE", "Der KI-Anbieter hat keine verwendbare Textantwort geliefert.");
            return conversations.complete(pending, reply, context.sessionVersion());
        } catch (ApiFailure error) { conversations.abort(pending, "failed", error.code); throw error; }
        catch (RuntimeException error) {
            conversations.abort(pending, "failed", "AI_UNAVAILABLE");
            throw new ApiFailure(503, "AI_UNAVAILABLE", "Der KI-Dienst ist derzeit nicht verfügbar. Bitte später erneut versuchen.");
        } finally { conversations.abort(pending); }
    }
}
