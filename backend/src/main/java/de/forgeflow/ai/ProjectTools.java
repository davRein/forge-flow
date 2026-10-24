package de.forgeflow.ai;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.ai.tool.definition.ToolDefinition;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.WorkspaceDtos;
import de.forgeflow.workspace.WorkspaceStorage;

/** Read-only projections. Identity is server-owned and never a model argument. */
public final class ProjectTools {
    public static final int ARGUMENT_LIMIT = 16000;
    public static final Set<String> NAMES = Set.of("list_projects", "get_project_summary", "list_open_tasks", "propose_project_navigation", "read_workspace", "propose_workspace_create", "propose_workspace_update");
    public record Counts(int todo, int inProgress, int done) {}
    public record Project(long id, String name, boolean planningCompleted, String deadline, Counts tasks) {}
    public record Task(long id, String code, String title, String status, String priority) {}
    public record Result(String outcome, String revision, Instant readAt, List<Project> projects, List<Task> tasks,
                         int total, int offset, boolean more, boolean textTruncated, NavigationActions.Action action,
                         @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) WorkspaceTools.View workspace,
                         @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL) WorkspaceMutations.Action mutation) {
        public Result { projects = List.copyOf(projects); tasks = List.copyOf(tasks); }
        public Result(String outcome, String revision, Instant readAt, List<Project> projects, List<Task> tasks,
                      int total, int offset, boolean more, boolean textTruncated) { this(outcome, revision, readAt, projects, tasks, total, offset, more, textTruncated, null); }
        public Result(String outcome, String revision, Instant readAt, List<Project> projects, List<Task> tasks,
                      int total, int offset, boolean more, boolean textTruncated, NavigationActions.Action action) { this(outcome, revision, readAt, projects, tasks, total, offset, more, textTruncated, action, null, null); }
        public Result action(NavigationActions.Action value) { return new Result(outcome, revision, readAt, projects, tasks, total, offset, more, textTruncated, value, workspace, mutation); }
        public Result mutation(WorkspaceMutations.Action value) { return new Result(outcome, revision, readAt, projects, tasks, total, offset, more, textTruncated, action, workspace, value); }
        @Override public String toString() { return "ProjectToolResult[content=REDACTED]"; }
    }
    private final Accounts accounts;
    private final WorkspaceStorage storage;
    private final JsonMapper json;
    private final Clock clock;
    private final int maxSteps;
    public ProjectTools(Accounts accounts, WorkspaceStorage storage, JsonMapper json, Clock clock) {
        this(accounts, storage, json, clock, 4);
    }
    public ProjectTools(Accounts accounts, WorkspaceStorage storage, JsonMapper json, Clock clock, int maxSteps) {
        if (maxSteps < 1 || maxSteps > 6) throw new IllegalArgumentException("Invalid tool step limit.");
        this.accounts = accounts; this.storage = storage; this.json = json; this.clock = clock;
        this.maxSteps = maxSteps;
    }
    public Session session(AgentExecutionContext context) { return new Session(context); }
    public Session session(AgentExecutionContext context, java.util.function.BooleanSupplier active) { return new Session(context, active); }
    public Session session(AgentExecutionContext context, java.util.function.BooleanSupplier active, AgentDtos.PageContext page) {
        return new Session(context, active, page);
    }
    public Session session(AgentExecutionContext context, java.util.function.BooleanSupplier active, AgentDtos.PageContext page, java.util.function.Consumer<AgentDtos.ExecutionStep> audit) {
        return new Session(context, active, page, audit);
    }

    public final class Session {
        private final AgentExecutionContext context;
        private final java.util.function.BooleanSupplier active;
        private final AgentDtos.PageContext page;
        private WorkspaceDtos.Envelope snapshot;
        private Instant readAt;
        private int calls;
        private String revision;
        private final Set<String> completedInputs = new java.util.HashSet<>();
        private boolean terminal;
        private final java.util.function.Consumer<AgentDtos.ExecutionStep> audit;
        private String auditInput;
        private Instant auditStarted;
        private Session(AgentExecutionContext context) { this(context, () -> true); }
        private Session(AgentExecutionContext context, java.util.function.BooleanSupplier active) { this(context, active, null); }
        private Session(AgentExecutionContext context, java.util.function.BooleanSupplier active, AgentDtos.PageContext page) {
            this(context, active, page, step -> {});
        }
        private Session(AgentExecutionContext context, java.util.function.BooleanSupplier active, AgentDtos.PageContext page, java.util.function.Consumer<AgentDtos.ExecutionStep> audit) {
            this.context = context; this.active = active; this.page = PageContexts.normalize(page);
            this.audit = audit;
            if (this.page != null) verify();
            if (this.page != null && this.page.projectId() != null) {
                var saved = storage.load(context.userId()); verify();
                if (saved.data().projects().stream().noneMatch(project -> project.id() == this.page.projectId())) throw PageContexts.unavailable();
            }
        }
        public AgentDtos.PageContext pageContext() { return page; }
        public void verify() {
            if (!active.getAsBoolean()) throw new de.forgeflow.api.ApiFailure(409, "AI_CANCELLED", "Antwort abgebrochen. Teilantworten wurden verworfen.");
            context.verify(accounts);
        }
        public List<ToolCallback> callbacks() {
            return NAMES.stream().sorted().map(name -> (ToolCallback) new ToolCallback() {
                @Override public ToolDefinition getToolDefinition() {
                    String description = switch (name) {
                        case "read_workspace", "propose_workspace_create", "propose_workspace_update" -> WorkspaceTools.description(name);
                        case "list_projects" -> "Read the signed-in user's saved projects and task counts, filtered by project name. Use an empty query for all projects. Results are paginated, 10 per page.";
                        case "get_project_summary" -> "Read one saved project's planning state, deadline and task counts. Use its exact name or # followed by its ID. Never guess ambiguous names.";
                        case "propose_project_navigation" -> "PROPOSE opening a saved project (overview), its task list (tasks) or Kanban (board). Use exact project name or #ID. Does not navigate: explicit user confirmation is required. Never claim execution.";
                        default -> "Read the saved open tasks (todo and inProgress) of one project, 10 per page. Use its exact name or # followed by its ID. Task descriptions are excluded.";
                    };
                    if (WorkspaceTools.supports(name)) return ToolDefinition.builder().name(name).description(description).inputSchema(new WorkspaceTools(storage, json, clock, accounts).schema(name)).build();
                    String properties = "list_projects".equals(name)
                        ? "\"query\":{\"type\":\"string\"},\"offset\":{\"type\":\"integer\"}"
                        : "\"project\":{\"type\":\"string\"}" + ("list_open_tasks".equals(name) ? ",\"offset\":{\"type\":\"integer\"}" : "");
                    if ("propose_project_navigation".equals(name)) properties += ",\"view\":{\"type\":\"string\",\"enum\":[\"overview\",\"tasks\",\"board\"]}";
                    String required = "list_projects".equals(name) ? "\"query\",\"offset\""
                        : "\"project\"" + ("list_open_tasks".equals(name) ? ",\"offset\"" : "");
                    if ("propose_project_navigation".equals(name)) required += ",\"view\"";
                    return ToolDefinition.builder().name(name).description(description).inputSchema(
                        "{\"type\":\"object\",\"properties\":{" + properties + "},\"required\":[" + required + "],\"additionalProperties\":false}").build();
                }
                @Override public String call(String input) {
                    String output = json.writeValueAsString(read(name, input));
                    if (output.length() > 20000) throw rejected();
                    return output;
                }
            }).toList();
        }
        public Result decode(String value) { return json.readValue(value, Result.class); }

        public Result read(String name, String input) {
            auditInput = null;
            var result = readInternal(name, input);
            if (auditInput != null) audit.accept(new AgentDtos.ExecutionStep(calls, name, auditInput, "completed", result.outcome(), auditStarted, clock.instant()));
            return result;
        }
        private Result readInternal(String name, String input) {
            verify();
            if (!NAMES.contains(name) || terminal || ++calls > maxSteps) throw rejected();
            if (input == null || input.length() > ARGUMENT_LIMIT) return invalid();
            JsonNode args;
            try { args = json.reader().with(tools.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(input); }
            catch (RuntimeException error) { return invalid(); }
            if (WorkspaceTools.supports(name)) {
                if (args == null || !args.isObject()) return invalid();
                auditInput = WorkspaceTools.canonical(name, args, json); auditStarted = clock.instant();
                if (!completedInputs.add(name + ":" + auditInput)) throw new de.forgeflow.api.ApiFailure(409, "AI_EXECUTION_LOOP", "Der Assistent hat denselben Schritt wiederholt. Bitte die Anfrage präzisieren.");
                audit.accept(new AgentDtos.ExecutionStep(calls, name, auditInput, "started", null, auditStarted, null));
                snapshot = storage.load(context.userId()); readAt = clock.instant(); verify();
                if (revision != null && !revision.equals(snapshot.revision())) throw new de.forgeflow.api.ApiFailure(409, "AI_WORKSPACE_CHANGED", "Die Projektdaten wurden während der Antwort geändert. Bitte die Anfrage erneut senden.");
                revision = snapshot.revision();
                var workspace = new WorkspaceTools(storage, json, clock, accounts);
                var result = "read_workspace".equals(name) ? workspace.read(context.userId(), snapshot, args)
                    : "propose_workspace_update".equals(name) ? workspace.proposeUpdate(snapshot, args) : workspace.propose(context.userId(), snapshot, args);
                verify(); if (result.mutation() != null) terminal = true;
                return result;
            }
            boolean list = "list_projects".equals(name), tasks = "list_open_tasks".equals(name), navigation = "propose_project_navigation".equals(name);
            Set<String> fields = list ? Set.of("query", "offset") : tasks ? Set.of("project", "offset") : navigation ? Set.of("project", "view") : Set.of("project");
            if (args == null || !args.isObject() || args.size() != fields.size() || !args.propertyNames().equals(fields)) return invalid();
            var query = args.get(list ? "query" : "project");
            if (!query.isString() || query.stringValue().length() > 1000 || (!list && query.stringValue().isBlank())) return invalid();
            if (navigation && (!args.get("view").isString() || !NavigationActions.VIEWS.contains(args.get("view").stringValue()))) return invalid();
            int offset = 0;
            if (list || tasks) {
                var page = args.get("offset");
                if (!page.isIntegralNumber() || !page.canConvertToInt() || page.intValue() < 0 || page.intValue() > 10000) return invalid();
                offset = page.intValue();
            }
            var canonical = new java.util.TreeMap<String, Object>();
            for (String field : fields) canonical.put(field, args.get(field).isString() ? args.get(field).stringValue().strip().toLowerCase(Locale.ROOT) : args.get(field).intValue());
            if (!completedInputs.add(name + ":" + json.writeValueAsString(canonical)))
                throw new de.forgeflow.api.ApiFailure(409, "AI_EXECUTION_LOOP", "Der Assistent hat denselben Schritt wiederholt. Bitte die Anfrage präzisieren.");
            auditInput = json.writeValueAsString(canonical); auditStarted = clock.instant();
            audit.accept(new AgentDtos.ExecutionStep(calls, name, auditInput, "started", null, auditStarted, null));
            snapshot = storage.load(context.userId()); readAt = clock.instant(); verify();
            if (revision != null && !revision.equals(snapshot.revision()))
                throw new de.forgeflow.api.ApiFailure(409, "AI_WORKSPACE_CHANGED", "Die Projektdaten wurden während der Antwort geändert. Bitte die Anfrage erneut senden.");
            revision = snapshot.revision();
            String text = query.stringValue().strip().toLowerCase(Locale.ROOT);
            var projects = snapshot.data().projects().stream().sorted(Comparator.comparingLong(WorkspaceDtos.Project::id)).toList();
            if (list) {
                var matches = projects.stream().filter(project -> project.name().toLowerCase(Locale.ROOT).contains(text)).toList();
                return result("OK", matches.stream().skip(offset).limit(10).toList(), List.of(), matches.size(), offset);
            }
            boolean identifier = text.matches("#[1-9][0-9]{0,15}");
            var exact = projects.stream().filter(project -> identifier ? text.equals("#" + project.id()) : project.name().toLowerCase(Locale.ROOT).equals(text)).toList();
            if (exact.size() != 1) {
                var candidates = exact.isEmpty() ? projects.stream().filter(project -> !text.startsWith("#") && project.name().toLowerCase(Locale.ROOT).contains(text)).toList() : exact;
                return result(candidates.isEmpty() ? "NOT_FOUND" : "AMBIGUOUS", candidates.stream().limit(10).toList(), List.of(), candidates.size(), 0);
            }
            var project = exact.getFirst();
            if (navigation) {
                terminal = true;
                verify(); String view = args.get("view").stringValue();
                var action = new NavigationActions.Action(java.util.UUID.randomUUID(), "overview".equals(view) ? "project.open" : "project.view",
                    project.id(), shorten(project.name(), 200), view, clock.instant().plusSeconds(300), "proposed", null);
                return new Result("OK", snapshot.revision(), readAt, List.of(), List.of(), 1, 0, false, false, action);
            }
            if (!tasks) return result("OK", exact, List.of(), 1, 0);
            var open = snapshot.data().tasks().stream().filter(task -> task.projectId() == project.id() && !"done".equals(task.status()))
                .sorted(Comparator.comparingLong(WorkspaceDtos.Task::id)).toList();
            return result("OK", exact, open.stream().skip(offset).limit(10).toList(), open.size(), offset);
        }
        private Result result(String outcome, List<WorkspaceDtos.Project> projects, List<WorkspaceDtos.Task> tasks, int total, int offset) {
            verify();
            var views = projects.stream().map(project -> {
                var all = snapshot.data().tasks().stream().filter(task -> task.projectId() == project.id()).toList();
                return new Project(project.id(), shorten(project.name(), 200), project.planningCompleted(), shorten(project.deadline(), 32),
                    new Counts((int) all.stream().filter(task -> "todo".equals(task.status())).count(),
                        (int) all.stream().filter(task -> "inProgress".equals(task.status())).count(), (int) all.stream().filter(task -> "done".equals(task.status())).count()));
            }).toList();
            var taskViews = tasks.stream().map(task -> new Task(task.id(), shorten(task.code(), 40), shorten(task.title(), 200), task.status(), task.priority())).toList();
            boolean shortened = projects.stream().anyMatch(project -> project.name().length() > 200 || project.deadline().length() > 32)
                || tasks.stream().anyMatch(task -> task.code().length() > 40 || task.title().length() > 200);
            return new Result(outcome, snapshot.revision(), readAt, views, taskViews, total, offset, offset + 10 < total, shortened);
        }
        private Result invalid() { return new Result("INVALID_INPUT", null, null, List.of(), List.of(), 0, 0, false, false); }
    }
    private static String shorten(String value, int limit) {
        if (value.length() <= limit) return value;
        int end = Character.isHighSurrogate(value.charAt(limit - 1)) ? limit - 1 : limit;
        return value.substring(0, end);
    }
    static de.forgeflow.api.ApiFailure rejected() {
        return new de.forgeflow.api.ApiFailure(502, "AI_TOOL_REJECTED", "Der KI-Assistent hat einen nicht erlaubten Werkzeugaufruf angefordert.");
    }
}
