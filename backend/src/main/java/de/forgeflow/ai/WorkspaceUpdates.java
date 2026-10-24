package de.forgeflow.ai;

import java.time.Clock;
import java.util.*;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.workspace.WorkspaceValidation;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** Bounded field patches with a complete before/after preview; never writes from a tool. */
final class WorkspaceUpdates {
    static final Map<String, Set<String>> FIELDS = Map.of(
        "customers", Set.of("name", "street", "postalCode", "city", "country", "email", "website", "phone", "industry", "notes"),
        "contacts", Set.of("name", "role", "email", "phone"),
        "projects", Set.of("name", "customer", "deadline", "planningCompleted"),
        "tasks", Set.of("title", "description", "status", "priority", "epic"),
        "epics", Set.of("title", "description"),
        "sprints", Set.of("title", "goal", "startDate", "endDate", "tasks"),
        "articles", Set.of("title", "content", "category", "parent"), "categories", Set.of("name", "description"),
        "files", Set.of("name"));
    private static final Map<String, String> REFERENCES = Map.of("customer", "customerId", "epic", "epicId", "category", "categoryId", "parent", "parentId", "tasks", "taskIds");
    private final WorkspaceTools tools;
    private final JsonMapper json;
    private final Clock clock;
    WorkspaceUpdates(WorkspaceTools tools, JsonMapper json, Clock clock) { this.tools = tools; this.json = json; this.clock = clock; }
    static String description() {
        return "PROPOSE updating ONE existing saved record; never saves. User must explicitly confirm a before/after card. entity: customers, contacts, projects, tasks, epics, sprints, articles, categories, files. target: exact name/title or #ID; ambiguous names require #ID. fields: nonempty list of {name,value} strings, ONLY explicitly requested changes. customers: name,street,postalCode,city,country,email,website,phone,industry,notes; contacts: name,role (job title, not permissions),email,phone; projects: name,customer,deadline,planningCompleted (true/false); tasks: title,description,status (todo/inProgress/done),priority (low/medium/high),epic; epics: title,description; PLANNED sprints only: title,goal,startDate,endDate,tasks (comma-separated #taskIDs); articles: title,content,category,parent; categories: name,description; files: name ONLY (preserves bytes). customer/epic/category references exact names or #ID, empty epic/category removes assignment. Empty parent moves a documentation page to the space root. Parent must be in the same space; cycles and more than 12 levels are rejected. A page with children cannot change space until its children are moved. Empty tasks removes sprint tasks. Dates YYYY-MM-DD. Text <=6000 characters. IDs, project membership, codes, timestamps, roles, passwords and file content are not editable. No deleting or sprint lifecycle changes. Ask for missing changes or ambiguous targets; never guess or replace unspecified fields.";
    }
    String schema() {
        return "{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"entity\",\"target\",\"fields\"],\"properties\":{\"entity\":{\"type\":\"string\",\"enum\":"
            + json.writeValueAsString(FIELDS.keySet().stream().sorted().toList()) + "},\"target\":{\"type\":\"string\"},\"fields\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"name\",\"value\"],\"properties\":{\"name\":{\"type\":\"string\"},\"value\":{\"type\":\"string\"}}}}}}";
    }
    private static void require(boolean valid, String message) { if (!valid) throw WorkspaceMutations.invalid(message); }
    private static String string(JsonNode node, String key, int max) {
        var value = node.get(key); require(value != null && value.isString() && value.asText().length() <= max, "Ungültiges Änderungsfeld: " + key); return value.asText();
    }
    static Map<String, String> fields(JsonNode input) {
        require(input != null && input.isObject() && input.propertyNames().equals(Set.of("entity", "target", "fields")), "Ungültiger Änderungsvorschlag.");
        String entity = string(input, "entity", 30); require(FIELDS.containsKey(entity), "Dieser Bereich unterstützt keine Änderung.");
        require(!string(input, "target", 1000).isBlank(), "Die zu ändernde Kennung fehlt.");
        var entries = input.get("fields"); require(entries.isArray() && entries.size() > 0 && entries.size() <= 10, "Eine bis zehn Änderungen sind erforderlich.");
        var values = new TreeMap<String, String>();
        for (var entry : entries) {
            require(entry.isObject() && entry.propertyNames().equals(Set.of("name", "value")), "Ungültige Änderungsfelder.");
            String name = string(entry, "name", 40), value = string(entry, "value", 6000);
            require(FIELDS.get(entity).contains(name) && !values.containsKey(name), "Nicht erlaubtes oder doppeltes Änderungsfeld.");
            values.put(name, Set.of("content", "description", "goal", "notes").contains(name) ? value : value.strip());
        }
        return values;
    }
    static String canonical(JsonNode input, JsonMapper json) {
        var values = fields(input);
        return json.writeValueAsString(List.of(input.get("entity").asText(), input.get("target").asText().strip().toLowerCase(Locale.ROOT), values));
    }
    private JsonNode record(Data data, String entity, long id) {
        return tools.collection(data, entity).stream().<JsonNode>map(json::valueToTree).filter(item -> item.get("id").longValue() == id).findFirst()
            .orElseThrow(() -> WorkspaceMutations.invalid("Eintrag nicht gefunden. Bitte eine eigene Kennung (#ID) angeben."));
    }
    ProjectTools.Result propose(Envelope snapshot, JsonNode input) {
        var values = fields(input); String entity = input.get("entity").asText(); var data = snapshot.data();
        long id = tools.resolve(tools.collection(data, entity), input.get("target").asText().strip(), null);
        var current = record(data, entity, id); var patch = json.createObjectNode(); var before = json.createObjectNode(); patch.put("id", id);
        if ("sprints".equals(entity)) require("planned".equals(current.get("status").asText()), "Nur geplante Sprints können hier bearbeitet werden.");
        for (var entry : values.entrySet()) {
            String key = REFERENCES.getOrDefault(entry.getKey(), entry.getKey()), text = entry.getValue(); JsonNode value;
            if ("customer".equals(entry.getKey())) value = json.valueToTree(tools.resolve(data.customers(), text, null));
            else if ("epic".equals(entry.getKey())) value = text.isEmpty() ? json.nullNode() : json.valueToTree(tools.resolve(data.epics(), text, current.get("projectId").longValue()));
            else if ("category".equals(entry.getKey())) value = text.isEmpty() ? json.nullNode() : json.valueToTree(tools.resolve(data.wiki().categories(), text, null));
            else if ("parent".equals(entry.getKey())) value = text.isEmpty() ? json.nullNode() : json.valueToTree(tools.resolve(data.wiki().articles(), text, null));
            else if ("tasks".equals(entry.getKey())) {
                var ids = new ArrayList<Long>();
                if (!text.isBlank()) for (String selector : text.split(",", -1)) ids.add(tools.resolve(data.tasks(), selector.strip(), current.get("projectId").longValue()));
                value = json.valueToTree(ids);
            } else if ("planningCompleted".equals(key)) { require(Set.of("true", "false").contains(text), "Planungsstatus muss true oder false sein."); value = json.valueToTree(Boolean.parseBoolean(text)); }
            else value = json.valueToTree(text);
            if (!value.equals(current.get(key))) { patch.set(key, value); before.set(key, current.get(key)); }
        }
        require(patch.size() > 1, "Die gewünschten Werte sind bereits gespeichert. Keine Änderung erforderlich.");
        if (current.has("updatedAt")) { patch.put("updatedAt", clock.instant().toString()); before.set("updatedAt", current.get("updatedAt")); }
        var action = new WorkspaceMutations.Action(UUID.randomUUID(), "workspace.update", entity, patch, snapshot.revision(), clock.instant().plusSeconds(300), "proposed", null, before);
        apply(data, action);
        return new ProjectTools.Result("OK", snapshot.revision(), clock.instant(), List.of(), List.of(), 1, 0, false, false, null, null, action);
    }
    static void validate(WorkspaceMutations.Action action) {
        require(FIELDS.containsKey(action.entity()) && action.before() != null && action.before().isObject(), "Ungültige Änderungsvorschau.");
        var keys = new HashSet<>(action.data().propertyNames()); keys.remove("id");
        var allowed = new HashSet<String>(); FIELDS.get(action.entity()).forEach(key -> allowed.add(REFERENCES.getOrDefault(key, key)));
        if (!Set.of("customers", "projects", "contacts").contains(action.entity())) allowed.add("updatedAt");
        require(!keys.isEmpty() && allowed.containsAll(keys) && action.before().propertyNames().equals(keys)
            && action.before().toString().length() <= 12000, "Ungültige Änderungsvorschau.");
        for (var value : List.of(action.data(), action.before())) for (var field : value.properties()) {
            var item = field.getValue();
            require(item.isNull() || item.isString() && item.asText().length() <= 6000 || item.isBoolean() || item.isIntegralNumber()
                || item.isArray() && item.size() <= 10000 && java.util.stream.StreamSupport.stream(item.spliterator(), false).allMatch(JsonNode::isIntegralNumber),
                "Der bisherige oder neue Wert ist für die Änderungskarte zu groß. Bitte den normalen Editor verwenden.");
        }
    }
    private <T> List<T> replace(List<T> items, JsonNode merged, Class<T> type) {
        long id = merged.get("id").longValue(); T replacement = json.treeToValue(merged, type);
        return items.stream().map(item -> json.valueToTree(item).get("id").longValue() == id ? replacement : item).toList();
    }
    private static final jakarta.validation.Validator VALIDATOR = jakarta.validation.Validation.buildDefaultValidatorFactory().getValidator();
    Data apply(Data old, WorkspaceMutations.Action action) {
        WorkspaceMutations.validate(action);
        var current = record(old, action.entity(), action.data().get("id").longValue());
        if ("sprints".equals(action.entity())) require("planned".equals(current.get("status").asText()), "Nur geplante Sprints können hier bearbeitet werden.");
        var merged = (ObjectNode) current.deepCopy();
        for (var field : action.before().properties()) {
            if (!field.getValue().equals(current.get(field.getKey()))) throw WorkspaceMutations.conflict();
            merged.set(field.getKey(), action.data().get(field.getKey()));
        }
        var projects = old.projects(); var customers = old.customers(); var tasks = old.tasks(); var epics = old.epics(); var sprints = old.sprints();
        var files = old.files(); var articles = old.wiki().articles(); var categories = old.wiki().categories();
        switch (action.entity()) {
            case "customers" -> customers = replace(customers, merged, Customer.class);
            case "contacts" -> {
                var contact = json.treeToValue(merged, CustomerContact.class);
                customers = customers.stream().map(customer -> customer.id() == contact.customerId() ? WorkspaceTools.withDetails(customer,
                    customer.contacts().stream().map(value -> value.id() == contact.id() ? contact : value).toList(), customer.notes()) : customer).toList();
            }
            case "projects" -> projects = replace(projects, merged, Project.class);
            case "tasks" -> tasks = replace(tasks, merged, Task.class);
            case "epics" -> epics = replace(epics, merged, Epic.class);
            case "sprints" -> sprints = replace(sprints, merged, Sprint.class);
            case "articles" -> articles = replace(articles, merged, Article.class);
            case "categories" -> categories = replace(categories, merged, Category.class);
            case "files" -> files = replace(files, merged, FileMetadata.class);
            default -> throw WorkspaceMutations.invalid("Dieser Bereich unterstützt keine Änderung.");
        }
        var activities = old.activities();
        if (Set.of("tasks", "epics", "sprints", "files").contains(action.entity())) {
            require(activities.size() < 10000, "Die Aktivitätssammlung ist voll.");
            long id = activities.stream().mapToLong(Activity::id).max().orElse(0) + 1;
            String type = Map.of("tasks", "task_updated", "epics", "epic_updated", "sprints", "sprint_updated", "files", "file_renamed").get(action.entity());
            var next = new ArrayList<>(activities); next.add(new Activity(id, merged.get("projectId").longValue(), type,
                "KI: " + merged.get("files".equals(action.entity()) ? "name" : "title").asText() + " geändert", merged.get("updatedAt").asText())); activities = List.copyOf(next);
        }
        var result = new Data(projects, customers, tasks, activities, epics, sprints, files, new Wiki(articles, categories));
        require(VALIDATOR.validate(result).isEmpty(), "Ungültige Änderungswerte. Bitte Pflichtfelder, Feldlängen und Status prüfen.");
        WorkspaceValidation.validate(result, old); return result;
    }
}
