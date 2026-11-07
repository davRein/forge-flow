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
        context.verify(accounts);
        var result = conversations.get(context.userId(), id);
        if (!de.forgeflow.auth.AppPermissions.allowsHistory(accounts.findById(context.userId()).orElseThrow(), result)) throw new ApiFailure(403, "APP_FORBIDDEN", "Für diesen Verlauf fehlt die App-Berechtigung.");
        return result;
    }
    public ConversationList list(AgentExecutionContext context) {
        context.verify(accounts);
        var user=accounts.findById(context.userId()).orElseThrow();
        var result=conversations.list(context.userId());
        if(user.administrator() || user.allowedApps().containsAll(de.forgeflow.auth.AppPermissions.ALL)) return result;
        return new ConversationList(result.storage(), result.retentionSeconds(), result.items().stream().filter(item -> de.forgeflow.auth.AppPermissions.allowsHistory(user, conversations.get(context.userId(),item.id()))).toList());
    }
    public void delete(AgentExecutionContext context, UUID id) { context.verify(accounts); conversations.delete(context.userId(), id); }
    public java.util.List<ExecutionRecord> executions(AgentExecutionContext context, UUID id) { context.verify(accounts); de.forgeflow.auth.AppPermissions.require(accounts.findById(context.userId()).orElseThrow(), "projectManager"); return conversations.executions(context.userId(), id); }
    public Turn send(AgentExecutionContext context, UUID id, SendMessage input) {
        context.verify(accounts);
        var page = PageContexts.requireSupported(input.context());
        de.forgeflow.auth.AppPermissions.require(accounts.findById(context.userId()).orElseThrow(), page.route().equals("/devTools/rest") ? "requestLab" : page.route().split("/")[1]);
        var pending = conversations.begin(context.userId(), id, new SendMessage(input.requestId(), input.message(), page));
        if (pending.replay() != null) return pending.replay();
        try (var lease = limits.acquire(context.userId())) {
            context.verify(accounts);
            var history = PageContexts.historyForModule(pending.history(), page);
            var reply = PageContexts.isProjectManager(page)
                ? model.reply(pending.language(), history, pending.message(), tools.session(context, () -> true, page, step -> conversations.record(pending, step)))
                : model.reply(pending.language(), history, PageContexts.messageForPage(page, pending.message()));
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
