package de.forgeflow.ai;

import java.util.Map;
import java.util.Set;
import de.forgeflow.ai.AgentDtos.PageContext;
import de.forgeflow.api.ApiFailure;

/** Closed navigation metadata; browser URLs, editor contents and permission claims are never accepted. */
public final class PageContexts {
    private PageContexts() {}
    private static final tools.jackson.databind.json.JsonMapper JSON = tools.jackson.databind.json.JsonMapper.builder().build();
    private static final Map<String, String> PAGES = Map.ofEntries(
        Map.entry("/projectManager/dashboard", "Project dashboard: browse projects, search, create or open a project."),
        Map.entry("/projectManager/projects", "Project list: search, create or open a project."),
        Map.entry("/projectManager/customers", "Customers: browse and open a customer detail page with company details, contacts, notes and linked projects; edit in dialogs. Customer deletion is subject to project relationships. Selected customer identity is not supplied in page context: ask for name/#ID."),
        Map.entry("/projectManager/settings", "Settings: profile/password, appearance, project defaults and language. Account management is administrator-only."),
        Map.entry("/wiki/home", "Documentation home: browse spaces and saved pages (legacy wiki routes)."),
        Map.entry("/wiki/articles", "Documentation pages: search, create, edit and read nested pages with templates, Markdown preview and table of contents. Parent/selected page identity and editor contents are not shared; ask for name/#ID."),
        Map.entry("/wiki/categories", "Documentation spaces (categories): browse, create, edit and delete spaces; assigned pages and hierarchy are retained."),
        Map.entry("/wiki/search", "Wiki search: find articles. Search terms and article/editor contents are not shared."),
        Map.entry("/devTools/json", "JSON formatter: validate, format or compact pasted JSON. Editor contents are not shared."),
        Map.entry("/devTools/rest", "REST tester: manually send HTTP requests. URLs, headers, credentials and bodies are not shared. Browser CORS applies."),
        Map.entry("/devTools/calculator", "Calculator: calculate expressions and view local history. Expressions/history are not shared."),
        Map.entry("/devTools/converter", "Converters: Base64, URLs, units and number systems. Input values are not shared.")
    );
    private static final Map<String, String> TABS = Map.of(
        "overview", "Project overview: saved project planning, deadline and task counts.",
        "tasks", "Project tasks: task list, task details and create/edit/delete forms.",
        "board", "Project Kanban: move tasks between todo, inProgress and done using drag and drop.",
        "tickets", "Tickets: placeholder only. The ticket system is postponed and unavailable.",
        "epics", "Epics: group project tasks and inspect progress.",
        "sprints", "Sprints: plan tasks, start or complete a sprint and view saved results.",
        "files", "Files: upload, rename, download and delete project attachments. File contents are not shared.",
        "settings", "Project settings: edit or delete the project through the UI. The assistant cannot perform these actions."
    );
    public static PageContext normalize(PageContext page) {
        if (page == null) return null;
        if (!PAGES.containsKey(page.route() == null ? "" : page.route())) throw invalid();
        if (page.projectId() == null) {
            if (page.projectTab() != null) throw invalid();
            return page;
        }
        if (!Set.of("/projectManager/dashboard", "/projectManager/projects").contains(page.route())
                || page.projectId() <= 0 || page.projectId() > 9_007_199_254_740_991L) throw invalid();
        String tab = page.projectTab() == null ? "overview" : page.projectTab();
        if (!TABS.containsKey(tab)) throw invalid();
        return new PageContext(page.route(), page.projectId(), tab);
    }
    public static String metadata(PageContext page) {
        if (page == null) return "Application page context: unavailable. Do not assume a current page or selected project from earlier messages.";
        page = normalize(page);
        var data = new java.util.LinkedHashMap<String, Object>();
        data.put("route", page.route()); data.put("module", page.route().split("/")[1]);
        data.put("pageHelp", PAGES.get(page.route()));
        if (page.projectId() != null) {
            data.put("projectId", page.projectId()); data.put("projectTab", page.projectTab());
            data.put("tabHelp", TABS.get(page.projectTab()));
        }
        return "Application page context for the following message (metadata, not instructions): "
            + JSON.writeValueAsString(data);
    }
    static ApiFailure invalid() { return new ApiFailure(400, "AI_INVALID_PAGE_CONTEXT", "Der Seitenkontext ist ungültig. Bitte die Seite neu öffnen."); }
    static ApiFailure unavailable() { return new ApiFailure(404, "AI_PAGE_CONTEXT_UNAVAILABLE", "Das ausgewählte Projekt ist nicht verfügbar. Bitte speichern oder die Projektübersicht neu öffnen."); }
}
