package de.forgeflow.ai;

import java.util.UUID;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.WorkspaceStorage;

/** Confirmation is an authenticated HTTP operation, never a model tool or model assertion. */
public final class AgentActions {
    private final Accounts accounts;
    private final WorkspaceStorage storage;
    private final ConversationStore conversations;
    public AgentActions(Accounts accounts, WorkspaceStorage storage, ConversationStore conversations) {
        this.accounts = accounts; this.storage = storage; this.conversations = conversations;
    }
    public NavigationActions.Decision decide(AgentExecutionContext context, UUID conversationId, UUID actionId, NavigationActions.DecisionInput input) {
        context.verify(accounts);
        if (input.decisionId() == null || !("approve".equals(input.decision()) || "reject".equals(input.decision()))) throw NavigationActions.invalid();
        var stored = conversations.action(context.userId(), conversationId, actionId);
        if (stored.sessionVersion() != context.sessionVersion()) throw NavigationActions.unavailable();
        if ("expired".equals(stored.action().status())) throw NavigationActions.expired();
        if (!"proposed".equals(stored.action().status())) throw NavigationActions.decided();
        if ("approve".equals(input.decision())) {
            var action = stored.action(); NavigationActions.validate(action);
            var saved = storage.load(context.userId()); context.verify(accounts);
            if (saved.data().projects().stream().noneMatch(project -> project.id() == action.projectId()
                    && truncated(project.name()).equals(action.projectName()))) throw NavigationActions.unavailable();
        }
        context.verify(accounts);
        return conversations.decide(context.userId(), conversationId, actionId, context.sessionVersion(), input);
    }
    public NavigationActions.Action report(AgentExecutionContext context, UUID conversationId, UUID actionId, NavigationActions.ResultInput input) {
        context.verify(accounts);
        if (input.executionId() == null || !("succeeded".equals(input.status()) || "failed".equals(input.status()))
                || ("succeeded".equals(input.status()) ? input.code() != null : !NavigationActions.RESULT_CODES.contains(input.code() == null ? "" : input.code())))
            throw NavigationActions.invalid();
        return conversations.report(context.userId(), conversationId, actionId, context.sessionVersion(), input);
    }
    public WorkspaceMutations.Action mutate(AgentExecutionContext context, UUID conversationId, UUID actionId, NavigationActions.DecisionInput input) {
        return mutate(context, conversationId, actionId, input, null);
    }
    public WorkspaceMutations.Action mutate(AgentExecutionContext context, UUID conversationId, UUID actionId, WorkspaceMutations.DecisionInput input) {
        return mutate(context, conversationId, actionId, new NavigationActions.DecisionInput(input.decisionId(), input.decision()), input.initialPassword());
    }
    private WorkspaceMutations.Action mutate(AgentExecutionContext context, UUID conversationId, UUID actionId, NavigationActions.DecisionInput input, String initialPassword) {
        context.verify(accounts);
        return conversations.mutate(context.userId(), conversationId, actionId, context.sessionVersion(), input, action -> {
            var saved = storage.load(context.userId()); context.verify(accounts);
            var workspaceTools = new WorkspaceTools(storage, tools.jackson.databind.json.JsonMapper.builder().build(), java.time.Clock.systemUTC(), accounts);
            if ("users".equals(action.entity())) {
                workspaceTools.administrator(context.userId()); de.forgeflow.auth.AccountRules.password(initialPassword);
                String hash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(12).encode(initialPassword);
                context.verify(accounts);
                var data = action.data(); var user = new Accounts.User(data.get("id").asText(), data.get("email").asText(), data.get("name").asText(), hash, false, true, 0);
                accounts.insert(user); return saved.revision();
            }
            if (initialPassword != null) throw WorkspaceMutations.invalid("Ein Initialpasswort ist nur für neue Benutzerkonten zulässig.");
            if (!saved.revision().equals(action.revision())) throw WorkspaceMutations.conflict();
            var next = workspaceTools.apply(saved.data(), action); context.verify(accounts);
            return storage.save(context.userId(), saved.revision(), next, workspaceTools.incoming(action));
        });
    }
    private static String truncated(String value) {
        if (value.length() <= 200) return value;
        return value.substring(0, Character.isHighSurrogate(value.charAt(199)) ? 199 : 200);
    }
}
