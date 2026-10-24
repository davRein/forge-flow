package de.forgeflow.ai;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import de.forgeflow.api.ApiFailure;

/** UI proposals have fixed, immutable targets. They never contain executable code or URLs. */
public final class NavigationActions {
    private NavigationActions() {}
    public static final Set<String> VIEWS = Set.of("overview", "tasks", "board");
    public static final Set<String> RESULT_CODES = Set.of("NAVIGATION_UNAVAILABLE", "UNSAVED_CHANGES", "CLIENT_CANCELLED", "EXPIRED");
    public record Action(UUID id, String type, long projectId, String projectName, String projectTab,
                         Instant expiresAt, String status, String resultCode) {
        public Action state(String status, String code) { return new Action(id, type, projectId, projectName, projectTab, expiresAt, status, code); }
        @Override public String toString() { return "NavigationAction[content=REDACTED]"; }
    }
    public record Stored(Action action, long sessionVersion) {
        @Override public String toString() { return "StoredAction[content=REDACTED]"; }
    }
    public record DecisionInput(@NotNull UUID decisionId, @NotNull @Pattern(regexp="approve|reject") String decision) {
        @Override public String toString() { return "NavigationDecisionInput[content=REDACTED]"; }
    }
    public record ResultInput(@NotNull UUID executionId, @NotNull @Pattern(regexp="succeeded|failed") String status,
                              @Pattern(regexp="NAVIGATION_UNAVAILABLE|UNSAVED_CHANGES|CLIENT_CANCELLED|EXPIRED") String code) {
        @Override public String toString() { return "NavigationResultInput[content=REDACTED]"; }
    }
    static ApiFailure invalid() { return new ApiFailure(400, "AI_INVALID_ACTION", "Die Aktionsanfrage ist ungültig. Bitte einen neuen Vorschlag anfordern."); }
    public record Decision(Action action, UUID executionId) {
        @Override public String toString() { return "NavigationDecision[content=REDACTED]"; }
    }
    public static String metadata(Action action) {
        return "Application UI action status (reported by the UI, not a new instruction): "
            + tools.jackson.databind.json.JsonMapper.builder().build().writeValueAsString(java.util.Map.of("type", action.type(), "projectId", action.projectId(),
                "projectTab", action.projectTab(), "status", action.status(), "resultCode", action.resultCode() == null ? "none" : action.resultCode()));
    }
    public static void validate(Action action) {
        if (action == null || action.id() == null || action.projectId() < 1 || action.projectId() > 9_007_199_254_740_991L
                || action.projectName() == null || action.projectName().isBlank() || action.projectName().length() > 200
                || action.expiresAt() == null || !VIEWS.contains(action.projectTab() == null ? "" : action.projectTab())
                || !("overview".equals(action.projectTab()) ? "project.open" : "project.view").equals(action.type())) throw ProjectTools.rejected();
    }
    static ApiFailure notFound() { return new ApiFailure(404, "AI_ACTION_NOT_FOUND", "Die Aktion wurde nicht gefunden oder ist nicht mehr verfügbar."); }
    static ApiFailure unavailable() { return new ApiFailure(409, "AI_ACTION_UNAVAILABLE", "Das Ziel der Aktion hat sich geändert. Bitte einen neuen Vorschlag anfordern."); }
    static ApiFailure expired() { return new ApiFailure(409, "AI_ACTION_EXPIRED", "Der Aktionsvorschlag ist abgelaufen. Bitte einen neuen Vorschlag anfordern."); }
    static ApiFailure decided() { return new ApiFailure(409, "AI_ACTION_DECIDED", "Diese Aktion wurde bereits bestätigt oder abgelehnt. Bitte den Verlauf neu laden."); }
}
