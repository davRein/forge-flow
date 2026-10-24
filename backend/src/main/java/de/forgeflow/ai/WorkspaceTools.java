package de.forgeflow.ai;

import java.time.Clock;
import java.util.*;
import java.util.function.ToLongFunction;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.Accounts;
import de.forgeflow.auth.AccountRules;
import de.forgeflow.auth.AccountController;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.workspace.WorkspaceStorage;
import de.forgeflow.workspace.WorkspaceValidation;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Account-local queries and typed creation plans. Never writes while a model tool is running. */
public final class WorkspaceTools {
    static final Set<String> COLLECTIONS = Set.of("customers", "projects", "tasks", "activities", "epics", "sprints", "files", "articles", "categories", "users", "profile", "settings", "industries", "contacts");
    record Industry(String id, String name) {}
    private static final Map<String, Set<String>> FIELDS = Map.of(
        "customers", Set.of("name", "street", "postalCode", "city", "country", "email", "website", "phone", "industry", "notes"),
        "contacts", Set.of("customer", "name", "role", "email", "phone"),
        "projects", Set.of("name", "customer", "deadline", "planningCompleted"),
        "tasks", Set.of("project", "epic", "title", "description", "status", "priority"),
        "epics", Set.of("project", "title", "description"),
        "sprints", Set.of("project", "title", "goal", "startDate", "endDate", "tasks"),
        "articles", Set.of("title", "content", "category", "parent"), "categories", Set.of("name", "description"),
        "files", Set.of("project", "name", "content", "mediaType"), "users", Set.of("name", "email"));
    public record Row(String id, String label, Map<String, String> fields) { public Row { fields = Collections.unmodifiableMap(new LinkedHashMap<>(fields)); } }
    public record View(String entity, String mode, int textOffset, List<Row> items, String message) { public View { items = List.copyOf(items); } }
    private static final Set<String> FILTER_FIELDS = Set.of("id", "name", "title", "email", "street", "postalCode", "city", "country", "industry", "role", "phone", "website", "code", "status", "priority", "customerId", "projectId", "epicId", "categoryId", "parentId", "planningCompleted", "deadline", "createdAt", "updatedAt", "startDate", "endDate", "taskIds", "mediaType", "size", "administrator", "active", "language", "themeMode", "defaultProjectView", "defaultTaskPriority", "type", "message", "lastModified", "addedAt");
    record Filter(String field, String operator, String value) {}
    record Query(String entity, String query, String project, String mode, int offset, int textOffset, List<Filter> filters) {}
    private final JsonMapper json;
    private final Clock clock;
    private final WorkspaceStorage storage;
    private final Accounts accounts;
    public WorkspaceTools(WorkspaceStorage storage, JsonMapper json, Clock clock, Accounts accounts) { this.storage = storage; this.json = json; this.clock = clock; this.accounts = accounts; }
    static String description(String name) {
        if ("propose_workspace_update".equals(name)) return WorkspaceUpdates.description();
        return "read_workspace".equals(name)
            ? "Query saved customers, contacts (customerId filter selects a customer), projects, tasks (all statuses), activities, epics, sprints, files, articles, categories; own profile/settings; industries lists the globally configured customer industry choices (read-only, use empty project); users ONLY for administrators, never hashes/session data. File detail can read UTF-8 text (first 1 MiB); binary files provide metadata only. mode=count returns exact matching count only; list returns 10 summaries; detail returns 1 record including text. query empty means all, #ID means exact ID, otherwise substring in name/title/code/email/description/wiki content. filters is an AND list (empty for no filters) of {field,operator,value}: eq,contains,lt,gt on saved scalar fields. Examples tasks status eq todo, priority eq high; projects customerId eq 7; deadline lt 2026-12-31. References are numeric IDs, null uses value null as a string; taskIds eq tests membership. project empty means no filter, otherwise exact project name/#ID. Use empty project for wiki/profile/settings/users. offset paginates records; textOffset paginates long text in 2000-character chunks. Both start at 0. Never infer global counts from a project list."
            : "PROPOSE creating one customer, customer contact, project, task, epic, planned sprint, wiki article/category, UTF-8 text file or normal user account (administrators only). DOES NOT SAVE: the user must confirm the immutable card. fields is a list of {name,value} strings; omit optional fields. For customer industry choices read_workspace entity industries first; existing industry text stays compatible. postalCode is text, preserve leading zeros/international formats. Required fields: contacts=customer,name (optional role/job title,email,phone); customers=name; projects=name,customer,deadline (YYYY-MM-DD); tasks=project,title; epics=project,title; sprints=project,title,startDate,endDate; articles=title,content; categories=name; files=project,name,content; users=name,email. NEVER ask for or pass passwords: the user enters the initial password only in the card's private password field, not in chat or tool arguments. customer/project/epic/category reference exact names or #ID, never guess ambiguous names. Optional customers: street,postalCode,city,country,email,website,phone,industry,notes; projects: planningCompleted true/false; tasks: epic,description,status todo/inProgress/done,priority low/medium/high; epics/categories: description; sprints: goal,tasks (comma-separated #taskIDs); articles: category (documentation space),parent (exact parent page name/#ID, inherits space if category omitted); files: mediaType text/plain,text/markdown,text/csv,application/json. Ask for missing mandatory information; do not invent dates or links. Task defaults to todo and account priority or medium. Text maximum 6000 characters. IDs, timestamps and relationships are server-owned.";
    }
    String schema(String name) {
        if ("propose_workspace_update".equals(name)) return new WorkspaceUpdates(this, json, clock).schema();
        if ("read_workspace".equals(name)) return "{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"entity\",\"query\",\"project\",\"mode\",\"offset\",\"textOffset\",\"filters\"],\"properties\":{\"entity\":{\"type\":\"string\",\"enum\":" + json.writeValueAsString(COLLECTIONS.stream().sorted().toList())
            + "},\"query\":{\"type\":\"string\"},\"project\":{\"type\":\"string\"},\"mode\":{\"type\":\"string\",\"enum\":[\"count\",\"list\",\"detail\"]},\"offset\":{\"type\":\"integer\"},\"textOffset\":{\"type\":\"integer\"},\"filters\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"field\",\"operator\",\"value\"],\"properties\":{\"field\":{\"type\":\"string\"},\"operator\":{\"type\":\"string\",\"enum\":[\"eq\",\"contains\",\"lt\",\"gt\"]},\"value\":{\"type\":\"string\"}}}}}}";
        return "{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"entity\",\"fields\"],\"properties\":{\"entity\":{\"type\":\"string\",\"enum\":" + json.writeValueAsString(WorkspaceMutations.ENTITIES.stream().sorted().toList())
            + "},\"fields\":{\"type\":\"array\",\"items\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"name\",\"value\"],\"properties\":{\"name\":{\"type\":\"string\"},\"value\":{\"type\":\"string\"}}}}}}";
    }
    static boolean supports(String name) { return Set.of("read_workspace", "propose_workspace_create", "propose_workspace_update").contains(name); }
    static String canonical(String name, JsonNode input, JsonMapper json) {
        if ("propose_workspace_update".equals(name)) return WorkspaceUpdates.canonical(input, json);
        if ("read_workspace".equals(name)) {
            var value = query(input);
            return json.writeValueAsString(List.of(value.entity(), value.query().toLowerCase(Locale.ROOT), value.project().toLowerCase(Locale.ROOT), value.mode(), value.offset(), value.textOffset(), value.filters().stream().map(filter -> json.writeValueAsString(new Filter(filter.field(), filter.operator(), filter.value().toLowerCase(Locale.ROOT)))).sorted().toList()));
        }
        return json.writeValueAsString(Map.of("entity", string(input, "entity", 30), "fields", new TreeMap<>(creationFields(input))));
    }
    static Query query(JsonNode input) {
        require(input.isObject() && (input.propertyNames().equals(Set.of("entity", "query", "project", "mode", "offset", "textOffset"))
            || input.propertyNames().equals(Set.of("entity", "query", "project", "mode", "offset", "textOffset", "filters"))), "Ungültige Abfragefelder.");
        String entity = string(input, "entity", 30), query = string(input, "query", 1000), project = string(input, "project", 1000), mode = string(input, "mode", 10);
        require(COLLECTIONS.contains(entity) && Set.of("count", "list", "detail").contains(mode), "Unbekannter Abfragebereich.");
        int offset = number(input, "offset", 10000), textOffset = number(input, "textOffset", 1000000);
        var filters = new ArrayList<Filter>();
        if (input.has("filters")) {
            var values = input.get("filters"); require(values.isArray() && values.size() <= 10, "Höchstens zehn Filter sind zulässig.");
            for (var item : values) {
                require(item.isObject() && item.propertyNames().equals(Set.of("field", "operator", "value")), "Ungültiger Filter.");
                var filter = new Filter(string(item, "field", 40), string(item, "operator", 10), string(item, "value", 1000));
                Class<?> type = switch (entity) { case "customers" -> Customer.class; case "projects" -> Project.class; case "tasks" -> Task.class; case "activities" -> Activity.class;
                    case "epics" -> Epic.class; case "sprints" -> Sprint.class; case "files" -> FileMetadata.class; case "articles" -> Article.class; case "categories" -> Category.class;
                    case "users", "profile" -> Accounts.User.class; case "contacts" -> CustomerContact.class; case "settings" -> SettingsValues.class; case "industries" -> Industry.class; default -> throw WorkspaceMutations.invalid("Unbekannter Bereich."); };
                require(FILTER_FIELDS.contains(filter.field()) && ("id".equals(filter.field()) || Arrays.stream(type.getRecordComponents()).anyMatch(component -> component.getName().equals(filter.field())))
                    && Set.of("eq", "contains", "lt", "gt").contains(filter.operator()), "Filter gehört nicht zum abgefragten Bereich."); filters.add(filter);
            }
        }
        return new Query(entity, query, project, mode, offset, textOffset, List.copyOf(filters));
    }
    private static String string(JsonNode node, String key, int max) {
        var value = node.get(key); require(value != null && value.isString() && value.stringValue().length() <= max, "Ungültiges Feld: " + key);
        return value.stringValue().strip();
    }
    private static int number(JsonNode node, String key, int max) {
        var value = node.get(key); require(value != null && value.isIntegralNumber() && value.canConvertToInt() && value.intValue() >= 0 && value.intValue() <= max, "Ungültige Seitengrenze."); return value.intValue();
    }
    private static void require(boolean valid, String reason) { if (!valid) throw WorkspaceMutations.invalid(reason); }
    List<?> collection(Data data, String entity) {
        return switch (entity) { case "contacts" -> data.customers().stream().flatMap(customer -> customer.contacts().stream()).toList(); case "customers" -> data.customers(); case "projects" -> data.projects(); case "tasks" -> data.tasks(); case "activities" -> data.activities();
            case "epics" -> data.epics(); case "sprints" -> data.sprints(); case "files" -> data.files(); case "articles" -> data.wiki().articles(); case "categories" -> data.wiki().categories(); default -> throw WorkspaceMutations.invalid("Unbekannter Datenbereich."); };
    }
    private String label(JsonNode item) { for (String key : List.of("name", "title", "message")) if (item.has(key)) return item.get(key).asText(); return "#" + item.get("id").asText(); }
    private boolean matches(JsonNode item, String query) {
        String value = query.strip().toLowerCase(Locale.ROOT);
        return value.isEmpty() || (value.startsWith("#") ? value.equals("#" + item.get("id").asText())
            : label(item).toLowerCase(Locale.ROOT).contains(value) || item.has("code") && item.get("code").asText().toLowerCase(Locale.ROOT).contains(value)
                || List.of("email", "description", "content", "goal", "notes", "role").stream().anyMatch(key -> item.hasNonNull(key) && item.get(key).asText().toLowerCase(Locale.ROOT).contains(value)));
    }
    private boolean filtered(JsonNode item, Filter filter) {
        var value = item.get(filter.field()); if (value == null) return false;
        if (value.isArray()) return "eq".equals(filter.operator()) && java.util.stream.StreamSupport.stream(value.spliterator(), false).anyMatch(element -> element.asText().equals(filter.value()));
        String actual = value.isNull() ? "null" : value.asText();
        if ("contains".equals(filter.operator())) return actual.toLowerCase(Locale.ROOT).contains(filter.value().toLowerCase(Locale.ROOT));
        if ("eq".equals(filter.operator())) return actual.equalsIgnoreCase(filter.value());
        int comparison;
        if (value.isNumber()) { try { comparison = new java.math.BigDecimal(actual).compareTo(new java.math.BigDecimal(filter.value())); } catch (NumberFormatException error) { throw WorkspaceMutations.invalid("Numerischer Filter erwartet."); } }
        else comparison = actual.compareToIgnoreCase(filter.value());
        return "lt".equals(filter.operator()) ? comparison < 0 : comparison > 0;
    }
    private Map<String, Object> profile(Accounts.User user) { return Map.of("id", user.id(), "name", user.name(), "email", user.email(), "administrator", user.administrator(), "active", user.active()); }
    public void administrator(String owner) {
        if (!accounts.findById(owner).filter(Accounts.User::active).map(Accounts.User::administrator).orElse(false)) throw new ApiFailure(403, "FORBIDDEN", "Dafür sind Administratorrechte erforderlich.");
    }
    public ProjectTools.Result read(String owner, Envelope snapshot, JsonNode input) {
        Query query = query(input); long project = query.project().isEmpty() ? 0 : resolve(snapshot.data().projects(), query.project(), null);
        require(project == 0 || !Set.of("articles", "categories", "profile", "settings", "users", "industries").contains(query.entity()), "Dieser Bereich verwendet keinen Projektfilter.");
        List<?> values;
        if ("industries".equals(query.entity())) {
            var names = storage.loadGlobalSettings().industries(); values = java.util.stream.IntStream.range(0, names.size()).mapToObj(index -> new Industry(Integer.toString(index + 1), names.get(index))).toList();
        }
        else if ("users".equals(query.entity())) { administrator(owner); values = accounts.list().stream().map(this::profile).toList(); }
        else if ("profile".equals(query.entity())) values = List.of(profile(accounts.findById(owner).orElseThrow()));
        else if ("settings".equals(query.entity())) {
            var saved = storage.loadSettings(owner); var settings = saved == null ? new SettingsValues("dark", "dashboard", "medium") : saved.settings();
            values = List.of(Map.of("id", owner, "themeMode", settings.themeMode(), "defaultProjectView", settings.defaultProjectView(), "defaultTaskPriority", settings.defaultTaskPriority(), "language", settings.language()));
        } else values = collection(snapshot.data(), query.entity());
        var found = values.stream().<JsonNode>map(json::valueToTree).filter(item -> matches(item, query.query())).filter(item -> query.filters().stream().allMatch(filter -> filtered(item, filter)))
            .filter(item -> project == 0 || ("projects".equals(query.entity()) ? item.get("id").longValue() == project
                : Set.of("customers", "contacts").contains(query.entity()) ? snapshot.data().projects().stream().anyMatch(value -> value.id() == project && value.customerId() == item.get("customers".equals(query.entity()) ? "id" : "customerId").longValue())
                : item.has("projectId") && item.get("projectId").longValue() == project))
            .sorted(Comparator.<JsonNode>comparingLong(item -> item.get("id").isNumber() ? item.get("id").longValue() : 0).thenComparing(item -> item.get("id").asText())).toList();
        var truncated = new boolean[1]; int limit = "detail".equals(query.mode()) ? 1 : 10;
        var items = "count".equals(query.mode()) ? List.<Row>of() : found.stream().skip(query.offset()).limit(limit).map(item -> {
            var fields = new LinkedHashMap<String, String>();
            var projection = (tools.jackson.databind.node.ObjectNode) item.deepCopy();
            if ("customers".equals(query.entity())) { projection.put("contactCount", item.get("contacts").size()); projection.remove("contacts"); }
            if ("files".equals(query.entity()) && "detail".equals(query.mode())) {
                String type = item.get("mediaType").asText();
                if (type.startsWith("text/") || Set.of("application/json", "application/xml").contains(type)) {
                    byte[] bytes = storage.attachment(owner, item.get("projectId").longValue(), item.get("id").longValue()).bytes();
                    int end = Math.min(bytes.length, 1048576);
                    if (end < bytes.length) { while (end > 0 && (bytes[end] & 0xc0) == 0x80) end--; truncated[0] = true; }
                    try { projection.put("content", java.nio.charset.StandardCharsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(bytes, 0, end)).toString()); }
                    catch (java.nio.charset.CharacterCodingException error) { projection.put("content", "Kein lesbares UTF-8-Textformat."); }
                } else projection.put("content", "Binärdatei: nur Metadaten verfügbar.");
            }
            for (var entry : projection.properties()) {
                String key = entry.getKey(); var value = entry.getValue();
                boolean content = Set.of("description", "content", "goal", "completion", "notes").contains(key);
                if (content && !"detail".equals(query.mode())) continue;
                String text = value.isNull() ? "" : value.isString() ? value.stringValue() : value.toString();
                int start = content ? Math.min(query.textOffset(), text.length()) : 0;
                if (start > 0 && start < text.length() && Character.isLowSurrogate(text.charAt(start))) start--;
                int max = content ? 2000 : "detail".equals(query.mode()) ? 1000 : 200;
                if (text.length() - start > max) truncated[0] = true;
                fields.put(key, clip(text.substring(start), max));
            }
            return new Row(item.get("id").asText(), clip(label(item), 200), fields);
        }).toList();
        return new ProjectTools.Result("OK", snapshot.revision(), clock.instant(), List.of(), List.of(), found.size(), query.offset(),
            !"count".equals(query.mode()) && query.offset() + limit < found.size(), truncated[0], null,
            new View(query.entity(), query.mode(), query.textOffset(), items, null), null);
    }
    private static Map<String, String> creationFields(JsonNode input) {
        require(input.isObject() && input.propertyNames().equals(Set.of("entity", "fields")), "Ungültiger Anlagevorschlag.");
        String entity = string(input, "entity", 30); require(FIELDS.containsKey(entity), "Dieser Bereich unterstützt keine Anlage.");
        var entries = input.get("fields"); require(entries.isArray() && entries.size() <= 20, "Ungültige Anlagefelder.");
        var values = new LinkedHashMap<String, String>();
        for (var entry : entries) {
            require(entry.isObject() && entry.propertyNames().equals(Set.of("name", "value")), "Ungültige Anlagefelder.");
            String key = string(entry, "name", 40), value = string(entry, "value", 6000);
            if (Set.of("content", "description", "goal", "notes").contains(key)) value = entry.get("value").stringValue();
            require(FIELDS.get(entity).contains(key) && !values.containsKey(key), "Nicht erlaubtes oder doppeltes Anlagefeld: " + key); values.put(key, value);
        }
        return values;
    }
    public ProjectTools.Result propose(String owner, Envelope snapshot, JsonNode input) {
        var values = creationFields(input); String entity = string(input, "entity", 30);
        var data = snapshot.data(); long id = "users".equals(entity) ? 0 : next(collection(data, entity).stream().<JsonNode>map(json::valueToTree).toList(), value -> value.get("id").longValue());
        String now = clock.instant().toString(); Object created;
        switch (entity) {
            case "users" -> {
                administrator(owner); String name = required(values, "name"), email = AccountRules.email(required(values, "email"));
                require(Validation.VALUE.validate(new AccountController.Profile(name, email, null)).isEmpty(), "Ungültiger Name oder E-Mail-Adresse.");
                require(accounts.findByEmail(email).isEmpty(), "Diese E-Mail-Adresse wird bereits verwendet.");
                created = Map.of("id", UUID.randomUUID().toString(), "name", name, "email", email, "administrator", false, "active", true);
            }
            case "files" -> {
                require(values.containsKey("content"), "Pflichtangabe fehlt: content");
                String content = value(values, "content"), type = values.getOrDefault("mediaType", "text/plain");
                require(Set.of("text/plain", "text/markdown", "text/csv", "application/json").contains(type), "Nicht unterstützter Textdateityp.");
                var file = new FileMetadata(id, resolve(data.projects(), required(values, "project"), null), required(values, "name"), content.getBytes(java.nio.charset.StandardCharsets.UTF_8).length, type, clock.millis(), now, now);
                var node = (tools.jackson.databind.node.ObjectNode) json.valueToTree(file); node.put("content", content); created = node;
            }
            case "customers" -> created = new Customer(id, required(values, "name"), value(values, "street"), value(values, "city"), value(values, "country"), value(values, "email"), value(values, "website"), value(values, "phone"), value(values, "industry"), value(values, "postalCode"), List.of(), value(values, "notes"));
            case "contacts" -> created = new CustomerContact(id, resolve(data.customers(), required(values, "customer"), null), required(values, "name"), value(values, "role"), value(values, "email"), value(values, "phone"));
            case "projects" -> {
                String planning = values.getOrDefault("planningCompleted", "false"); require(Set.of("true", "false").contains(planning), "Planungsstatus muss true oder false sein.");
                created = new Project(id, resolve(data.customers(), required(values, "customer"), null), required(values, "name"), Boolean.parseBoolean(planning), required(values, "deadline"));
            }
            case "tasks" -> {
                long project = resolve(data.projects(), required(values, "project"), null);
                var settings = storage.loadSettings(owner); String priority = settings == null ? "medium" : settings.settings().defaultTaskPriority();
                String epic = value(values, "epic"); created = new Task(id, project, epic.isEmpty() ? null : resolve(data.epics(), epic, project), "TASK-" + id,
                    required(values, "title"), value(values, "description"), values.getOrDefault("status", "todo"), values.getOrDefault("priority", priority), now, now);
            }
            case "epics" -> created = new Epic(id, resolve(data.projects(), required(values, "project"), null), required(values, "title"), value(values, "description"), now, now);
            case "sprints" -> {
                long project = resolve(data.projects(), required(values, "project"), null); var tasks = new ArrayList<Long>();
                if (!value(values, "tasks").isBlank()) for (String task : value(values, "tasks").split(",", -1)) tasks.add(resolve(data.tasks(), task.strip(), project));
                created = new Sprint(id, project, required(values, "title"), value(values, "goal"), required(values, "startDate"), required(values, "endDate"), "planned", tasks, now, now, null, null);
            }
            case "articles" -> {
                String category = value(values, "category"), parent = value(values, "parent");
                Long parentId = parent.isEmpty() ? null : resolve(data.wiki().articles(), parent, null);
                Long categoryId = null;
                if (!category.isEmpty()) categoryId = resolve(data.wiki().categories(), category, null);
                else if (parentId != null) categoryId = data.wiki().articles().stream().filter(page -> page.id() == parentId).findFirst().orElseThrow().categoryId();
                created = new Article(id, required(values, "title"), required(values, "content"), categoryId, now, now, parentId);
            }
            case "categories" -> created = new Category(id, required(values, "name"), value(values, "description"), now, now);
            default -> throw WorkspaceMutations.invalid("Unbekannter Datenbereich.");
        }
        var action = new WorkspaceMutations.Action(UUID.randomUUID(), "workspace.create", entity, json.valueToTree(created), snapshot.revision(), clock.instant().plusSeconds(300), "proposed", null);
        if (!"users".equals(entity)) apply(data, action);
        return new ProjectTools.Result("OK", snapshot.revision(), clock.instant(), List.of(), List.of(), 1, 0, false, false, null, null, action);
    }
    public ProjectTools.Result proposeUpdate(Envelope snapshot, JsonNode input) { return new WorkspaceUpdates(this, json, clock).propose(snapshot, input); }
    long resolve(List<?> values, String selector, Long project) {
        var matches = values.stream().<JsonNode>map(json::valueToTree).filter(item -> project == null || item.has("projectId") && item.get("projectId").longValue() == project)
            .filter(item -> selector.startsWith("#") ? selector.equals("#" + item.get("id").asText()) : label(item).equalsIgnoreCase(selector.strip())).toList();
        require(matches.size() == 1, "Verknüpfung nicht gefunden oder nicht eindeutig: " + clip(selector, 100) + ". Bitte eine eigene Kennung (#ID) angeben.");
        return matches.getFirst().get("id").longValue();
    }
    private static String required(Map<String, String> values, String key) { String value = value(values, key); require(!value.isBlank(), "Pflichtangabe fehlt: " + key); return value; }
    private static String value(Map<String, String> values, String key) { return values.getOrDefault(key, ""); }
    private static <T> long next(List<T> values, ToLongFunction<T> id) { long max = values.stream().mapToLong(id).max().orElse(0); require(max < 9_007_199_254_740_991L, "Keine weitere Kennung verfügbar."); return max + 1; }
    private static <T> List<T> append(List<T> items, T value) { require(items.size() < 10000, "Die Sammlung ist voll."); var result = new ArrayList<>(items); result.add(value); return List.copyOf(result); }
    private static final class Validation { static final jakarta.validation.Validator VALUE = jakarta.validation.Validation.buildDefaultValidatorFactory().getValidator(); }
    public Data apply(Data old, WorkspaceMutations.Action action) {
        if ("workspace.update".equals(action.type())) return new WorkspaceUpdates(this, json, clock).apply(old, action);
        WorkspaceMutations.validate(action); var node = action.data();
        var projects = old.projects(); var customers = old.customers(); var tasks = old.tasks(); var epics = old.epics(); var sprints = old.sprints(); var articles = old.wiki().articles(); var categories = old.wiki().categories();
        switch (action.entity()) {
            case "files" -> { var metadata = (tools.jackson.databind.node.ObjectNode) node.deepCopy(); metadata.remove("content");
                var file = json.treeToValue(metadata, FileMetadata.class); require(file.size() == node.get("content").asText().getBytes(java.nio.charset.StandardCharsets.UTF_8).length, "Ungültige Dateigröße.");
                return validateFiles(old, append(old.files(), file)); }
            case "customers" -> customers = append(customers, json.treeToValue(node, Customer.class));
            case "contacts" -> {
                var contact = json.treeToValue(node, CustomerContact.class);
                require(customers.stream().anyMatch(customer -> customer.id() == contact.customerId()), "Kunde nicht gefunden.");
                customers = customers.stream().map(customer -> customer.id() == contact.customerId() ? withDetails(customer, append(customer.contacts(), contact), customer.notes()) : customer).toList();
            }
            case "projects" -> projects = append(projects, json.treeToValue(node, Project.class));
            case "tasks" -> tasks = append(tasks, json.treeToValue(node, Task.class));
            case "epics" -> epics = append(epics, json.treeToValue(node, Epic.class));
            case "sprints" -> sprints = append(sprints, json.treeToValue(node, Sprint.class));
            case "articles" -> articles = append(articles, json.treeToValue(node, Article.class));
            case "categories" -> categories = append(categories, json.treeToValue(node, Category.class));
            default -> throw WorkspaceMutations.invalid("Unbekannter Datenbereich.");
        }
        var activities = old.activities();
        if (Set.of("tasks", "epics", "sprints").contains(action.entity())) {
            String type = Map.of("tasks", "task_created", "epics", "epic_created", "sprints", "sprint_created").get(action.entity());
            long id = next(activities, Activity::id);
            activities = append(activities, new Activity(id, node.get("projectId").longValue(), type,
                "KI: " + node.get("title").asText() + " angelegt", node.get("createdAt").asText()));
        }
        var result = WorkspaceValidation.preserveCustomerDetails(new Data(projects, customers, tasks, activities, epics, sprints, old.files(), new Wiki(articles, categories)), old);
        require(Validation.VALUE.validate(result).isEmpty(), "Ungültige Anlagewerte. Bitte Pflichtfelder, Feldlängen und Status prüfen."); WorkspaceValidation.validate(result, old); return result;
    }
    static Customer withDetails(Customer customer, List<CustomerContact> contacts, String notes) {
        return new Customer(customer.id(), customer.name(), customer.street(), customer.city(), customer.country(), customer.email(), customer.website(), customer.phone(), customer.industry(), customer.postalCode(), contacts, notes);
    }
    private Data validateFiles(Data old, List<FileMetadata> files) {
        var result = new Data(old.projects(), old.customers(), old.tasks(), old.activities(), old.epics(), old.sprints(), files, old.wiki());
        require(Validation.VALUE.validate(result).isEmpty(), "Ungültige Dateimetadaten."); WorkspaceValidation.validate(result, old); return result;
    }
    public Map<Long, WorkspaceStorage.Attachment> incoming(WorkspaceMutations.Action action) {
        return "workspace.create".equals(action.type()) && "files".equals(action.entity()) ? Map.of(action.data().get("id").longValue(), new WorkspaceStorage.Attachment(action.data().get("content").asText().getBytes(java.nio.charset.StandardCharsets.UTF_8))) : Map.of();
    }
    static String clip(String text, int max) { if (text.length() <= max) return text; return text.substring(0, Character.isHighSurrogate(text.charAt(max - 1)) ? max - 1 : max); }
}
