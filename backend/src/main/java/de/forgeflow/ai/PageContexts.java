package de.forgeflow.ai;

import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import java.util.List;
import de.forgeflow.ai.AgentDtos.PageContext;
import de.forgeflow.ai.AgentDtos.Message;
import de.forgeflow.api.ApiFailure;

/** Closed navigation metadata; browser URLs, editor contents and permission claims are never accepted. */
public final class PageContexts {
    private PageContexts() {}
    private static final tools.jackson.databind.json.JsonMapper JSON = tools.jackson.databind.json.JsonMapper.builder().build();
    private static final Map<String, String> PAGES = Map.ofEntries(
        Map.entry("/cloud/files", "Cloud: open the separately hosted Nextcloud in a new tab with its own login. No Nextcloud files, users, credentials or permissions are supplied to the assistant; no Nextcloud tools are available."),
        Map.entry("/projectManager/dashboard", "Project dashboard: browse projects, search, create or open a project."),
        Map.entry("/projectManager/projects", "Project list: search, create or open a project."),
        Map.entry("/projectManager/customers", "Customers: browse and open a customer detail page with company details, contacts, notes and linked projects; edit in dialogs. Customer deletion is subject to project relationships. Selected customer identity is not supplied in page context: ask for name/#ID."),
        Map.entry("/projectManager/settings", "Settings: profile/password, appearance, project defaults and language. Account management is administrator-only."),
        Map.entry("/settings/general", "Global settings menu: profile/password, appearance, project defaults, language, shared industries, navigation app selection and AI button selection. Shared app/AI selections and lists are administrator-only. The assistant has no tools or data access on this page."),
        Map.entry("/git/repositories", "GitHub repositories: manually connect a private token, list accessible repositories and confirm a server-side clone. Credentials, repositories and clone data are private and unavailable to assistant tools."),
        Map.entry("/devTools/snippeter", "Snippeter: manually generate, edit, highlight and save private code snippets. Editor contents are not shared with this assistant; no snippet tools are available."),
        Map.entry("/devTools/dbScripter", "DB Scripter: private PostgreSQL connections, SQL generation and explicitly confirmed execution. No database credentials, schema or query results are supplied to this assistant; no SQL execution tools are available."),
        Map.entry("/wiki/home", "Documentation home: browse spaces and saved pages (legacy wiki routes)."),
        Map.entry("/wiki/articles", "Documentation pages: search, create, edit and read nested pages with templates, Markdown preview and table of contents. Parent/selected page identity and editor contents are not shared; ask for name/#ID."),
        Map.entry("/wiki/categories", "Documentation spaces (categories): browse, create, edit and delete spaces; assigned pages and hierarchy are retained."),
        Map.entry("/wiki/search", "Wiki search: find articles. Search terms and article/editor contents are not shared."),
        Map.entry("/devTools/json", "JSON formatter: validate, format or compact pasted JSON. Editor contents are not shared."),
        Map.entry("/requestLab/client", "RequestLab: manually send HTTP requests and manage private collections. URLs, headers, credentials, bodies and responses are not shared with this assistant; no request execution tools are available. Browser CORS applies."),
        Map.entry("/devTools/rest", "REST tester: manually send HTTP requests. URLs, headers, credentials and bodies are not shared. Browser CORS applies."),
        Map.entry("/devTools/calculator", "Calculator: calculate expressions and view local history. Expressions/history are not shared."),
        Map.entry("/devTools/converter", "Converters: Base64, URLs, units and number systems. Input values are not shared."),
        Map.entry("/timeTracker/calendar", "TimeTracker: private weekly calendar, customer/project bookings, breaks and billable time. Time entries, dates, filters and comments are not shared with the assistant. No time-tracking tools are available; do not claim to read or change entries."),
        Map.entry("/timeTracker/reports", "TimeTracker reports: weekly totals by customer/project and manual CSV export. Time entries and reports are private and unavailable to assistant tools."),
        Map.entry("/projectManager/today", "Personal work overview: open tasks, upcoming project deadlines and unlogged weekdays."),
        Map.entry("/business/budgets", "Private project budgets. Business and time data are not available to assistant tools."),
        Map.entry("/business/documents", "Quotations and invoices. Draft, review, issue and PDF download. Business documents and financial settings are private and unavailable to assistant tools."),
        Map.entry("/business/templates", "Project templates: tasks, milestones and documentation. No template tools are available to the assistant."),
        Map.entry("/business/portal", "Customer portal access management. Portal accounts only receive explicitly shared content; no portal management tools are available to the assistant."),
        Map.entry("/business/profile", "Private billing profile and defaults. Not available to assistant tools."),
        Map.entry("/knowledgeHub/chat", "AI Knowledge Hub chat. The embedded application's messages and knowledge data are not shared with this assistant; no application tools are available."),
        Map.entry("/knowledgeHub/documents", "AI Knowledge Hub documents. The embedded application's documents are not shared with this assistant; no application tools are available."),
        Map.entry("/knowledgeHub/account", "AI Knowledge Hub account and privacy. Account data is not shared with this assistant; no application tools are available."),
        Map.entry("/knowledgeHub/privacy", "AI Knowledge Hub privacy. Account data is not shared with this assistant; no application tools are available."),
        Map.entry("/flowPilot/overview", "FlowPilot overview. Workflow and job data are not shared with this assistant; no application tools are available."),
        Map.entry("/flowPilot/workflows", "FlowPilot workflows. Workflow data is not shared with this assistant; no application tools are available."),
        Map.entry("/flowPilot/runs", "FlowPilot runs. Execution data is not shared with this assistant; no application tools are available."),
        Map.entry("/flowPilot/integrations", "FlowPilot integrations. Integration data and credentials are not shared with this assistant; no application tools are available."),
        Map.entry("/flowPilot/jobs", "FlowPilot jobs and schedules. Job data is not shared with this assistant; no application tools are available."),
        Map.entry("/dataScout/dashboard", "DataScout local shared demo dashboard. No account-scoped monitoring data or application tools are supplied to this assistant."),
        Map.entry("/dataScout/collection", "DataScout offline fixture collection. No collection tools are supplied to this assistant."),
        Map.entry("/dataScout/jobs", "DataScout local schedules. No scheduling tools are supplied to this assistant."),
        Map.entry("/pulseWatch/overview", "PulseWatch overview. Monitoring data is not shared with this assistant; no application tools are available.")
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
    public static PageContext requireSupported(PageContext page) {
        if (page == null) throw new ApiFailure(403, "AI_APP_FORBIDDEN", "Der KI-Assistent benötigt einen gültigen Seitenkontext.");
        return normalize(page);
    }
    public static boolean isProjectManager(PageContext page) {
        return page != null && normalize(page).route().startsWith("/projectManager/");
    }
    public static List<Message> projectManagerHistory(List<Message> history) {
        return historyForModule(history, new PageContext("/projectManager/projects", null, null));
    }
    public static List<Message> historyForModule(List<Message> history, PageContext page) {
        String module = normalize(page).route().split("/")[1];
        var result = new ArrayList<Message>();
        for (int index = 0; index + 1 < history.size(); index += 2) {
            Message user = history.get(index), assistant = history.get(index + 1);
            if ("user".equals(user.role()) && user.context() != null
                    && module.equals(normalize(user.context()).route().split("/")[1]) && "assistant".equals(assistant.role())
                    && ("projectManager".equals(module) || assistant.tools().isEmpty())) {
                result.add(user);
                result.add(assistant);
            }
        }
        return List.copyOf(result);
    }
    public static String messageForPage(PageContext page, String message) {
        return metadata(page) + "\nUser request: " + message;
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
