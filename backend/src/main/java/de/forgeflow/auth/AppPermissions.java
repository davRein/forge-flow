package de.forgeflow.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.workspace.WorkspaceDtos.*;

/** Server-owned app grants. Shared project references remain read-only for business/time apps. */
public final class AppPermissions {
    private AppPermissions() {}
    public static final List<String> ALL = List.of("projectManager", "git", "wiki", "devTools", "timeTracker", "business", "cloud", "knowledgeHub", "flowPilot", "pulseWatch", "dataScout", "requestLab");
    public static String username(String value) {
        if (value == null || !value.strip().matches("[A-Za-z0-9][A-Za-z0-9._-]{2,63}")) throw new ApiFailure(422, "INVALID_USERNAME", "Der Benutzername benötigt 3 bis 64 Zeichen: Buchstaben, Ziffern, Punkt, Unterstrich oder Bindestrich.");
        return value.strip().toLowerCase(Locale.ROOT);
    }
    public static String legacyUsername(String id) {
        try { return "u_" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(id.getBytes(StandardCharsets.UTF_8))).substring(0, 56); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    public static List<String> grants(List<String> apps) {
        if (apps == null || apps.size() > ALL.size() || apps.stream().anyMatch(value -> value == null || !ALL.contains(value)) || new HashSet<>(apps).size() != apps.size()) throw new ApiFailure(422, "INVALID_APP_PERMISSIONS", "Ungültige App-Zuweisung.");
        return List.copyOf(apps);
    }
    public static boolean allows(Accounts.User user, String app) { return (app.equals("settings") || ALL.contains(app)) && !user.portalOnly() && (app.equals("settings") || user.administrator() || user.allowedApps().contains(app)); }
    public static void require(Accounts.User user, String app) { if (!allows(user, app)) throw new ApiFailure(403, "APP_FORBIDDEN", "Für diese App fehlt die Berechtigung."); }
    public static boolean allowsHistory(Accounts.User user, de.forgeflow.ai.AgentDtos.Conversation conversation) {
        return conversation.messages().stream().allMatch(message -> {
            String route = message.context() == null ? "/projectManager/projects" : de.forgeflow.ai.PageContexts.normalize(message.context()).route();
            return allows(user, route.equals("/devTools/rest") ? "requestLab" : route.split("/")[1]);
        });
    }
    public static String requiredApp(String path) {
        if (path.startsWith("/api/v1/me/rest-collections")) return "requestLab";
        if (path.startsWith("/api/v1/me/time-tracking")) return "timeTracker";
        if (path.startsWith("/api/v1/me/business")) return "business";
        if (path.startsWith("/api/v1/me/developer/github")) return "git";
        if (path.startsWith("/api/v1/me/developer/")) return "devTools";
        if (path.startsWith("/api/v1/projects/") || path.equals("/api/v1/me/recent-activity")) return "projectManager";
        if (path.startsWith("/api/v1/ai/actions")) return "projectManager";
        return null;
    }
    public static Data visible(Accounts.User user, Data data) {
        boolean projects = allows(user, "projectManager"), refs = projects || allows(user, "business") || allows(user, "timeTracker");
        var customers = projects ? data.customers() : refs ? data.customers().stream().map(c -> new Customer(c.id(), c.name(), "", "", "", "", "", "", c.industry())).toList() : List.<Customer>of();
        return new Data(refs ? data.projects() : List.of(), customers, projects ? data.tasks() : List.of(), projects ? data.activities() : List.of(), projects ? data.epics() : List.of(), projects ? data.sprints() : List.of(), projects ? data.files() : List.of(), allows(user, "wiki") ? data.wiki() : Data.empty().wiki());
    }
    public static Data merge(Accounts.User user, Data input, Data previous) {
        boolean projects = allows(user, "projectManager"), wiki = allows(user, "wiki");
        if (!projects && !wiki) throw new ApiFailure(403, "APP_FORBIDDEN", "Für diese Änderung fehlt die Berechtigung.");
        var view = visible(user, previous);
        if (!projects && (!input.projects().equals(view.projects()) || !input.customers().equals(view.customers()) || !input.tasks().isEmpty() || !input.activities().isEmpty() || !input.epics().isEmpty() || !input.sprints().isEmpty() || !input.files().isEmpty())) require(user, "projectManager");
        if (!wiki && !input.wiki().equals(Data.empty().wiki())) require(user, "wiki");
        return new Data(projects ? input.projects() : previous.projects(), projects ? input.customers() : previous.customers(), projects ? input.tasks() : previous.tasks(), projects ? input.activities() : previous.activities(), projects ? input.epics() : previous.epics(), projects ? input.sprints() : previous.sprints(), projects ? input.files() : previous.files(), wiki ? input.wiki() : previous.wiki());
    }
}
