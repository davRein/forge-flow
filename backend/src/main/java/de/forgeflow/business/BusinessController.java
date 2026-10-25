package de.forgeflow.business;

import java.time.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.auth.Accounts;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.time.TimeTrackingStorage;
import de.forgeflow.workspace.WorkspaceStorage;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.business.BusinessData.*;
import de.forgeflow.business.BusinessData.Timer;

@RestController @RequestMapping("/api/v1/me/business")
public class BusinessController {
    private final BusinessStorage storage; private final BusinessRules rules; private final WorkspaceStorage workspace; private final TimeTrackingStorage time; private final Accounts accounts;
    public BusinessController(BusinessStorage storage, BusinessRules rules, WorkspaceStorage workspace, TimeTrackingStorage time, Accounts accounts) { this.storage = storage; this.rules = rules; this.workspace = workspace; this.time = time; this.accounts = accounts; }
    private String owner(Authentication authentication) { return accounts.findById(authentication.getName()).filter(user -> user.active() && !user.portalOnly()).orElseThrow(() -> new ApiFailure(403, "FORBIDDEN", "Kein Zugriff auf den Arbeitsbereich.")).id(); }
    private static String match(String value) { if (value == null) throw new ApiFailure(428, "REVISION_REQUIRED", "Eine Datenversion ist erforderlich."); if (!value.startsWith("\"") || !value.endsWith("\"") || value.length() < 3) throw BusinessRules.invalid("Ungültige Datenversion."); return value.substring(1, value.length() - 1); }
    private ResponseEntity<BusinessData> response(BusinessData value) { return ResponseEntity.ok().eTag(value.revision()).body(value); }
    @GetMapping public ResponseEntity<BusinessData> get(Authentication authentication) { return response(storage.load(owner(authentication))); }
    @PutMapping public ResponseEntity<BusinessData> save(Authentication authentication, @RequestHeader(value="If-Match", required=false) String header, @Valid @RequestBody BusinessData input) {
        String owner = owner(authentication), revision = match(header);
        if (!revision.equals(input.revision())) throw BusinessRules.invalid("Ungültige Datenversion.");
        return response(storage.mutate(owner, previous -> rules.normalize(input, previous, workspace.load(owner).data(), time.load(owner))));
    }
    public record TimerInput(@NotNull @Size(max=100) String zone, @Positive Long customerId, @Positive Long projectId, @NotNull @Size(max=2000) String comment, boolean billable) {
        @Override public String toString() { return "TimerInput[content=REDACTED]"; }
    }
    @PostMapping("/timer/{action}") public ResponseEntity<BusinessData> timer(Authentication authentication, @PathVariable String action,
            @RequestHeader(value="If-Match", required=false) String header, @Valid @RequestBody TimerInput input) {
        String owner = owner(authentication), revision = match(header);
        return response(storage.mutate(owner, previous -> {
            BusinessRules.revision(revision, previous); var timer = previous.timer(); Instant now = Instant.now();
            switch (action) {
                case "start" -> {
                    if (timer != null) throw BusinessRules.invalid("Bitte zuerst die laufende Stoppuhr abschließen.");
                    try { ZoneId.of(input.zone()); } catch (DateTimeException error) { throw BusinessRules.invalid("Ungültige Zeitzone."); }
                    var data = workspace.load(owner).data();
                    if (input.customerId() != null && data.customers().stream().noneMatch(value -> value.id() == input.customerId())) throw BusinessRules.invalid("Der ausgewählte Kunde ist nicht verfügbar.");
                    if (input.projectId() != null && data.projects().stream().noneMatch(value -> value.id() == input.projectId() && Objects.equals(value.customerId(), input.customerId()))) throw BusinessRules.invalid("Das ausgewählte Projekt gehört nicht zu diesem Kunden.");
                    timer = new Timer(UUID.randomUUID(), now.toString(), 0, now.toString(), input.zone(), input.customerId(), input.projectId(), input.comment(), input.billable());
                }
                case "pause" -> { if (timer == null) throw BusinessRules.invalid("Keine Stoppuhr vorhanden."); if (timer.startedAt() != null) timer = new Timer(timer.id(), null, timer.elapsedSeconds() + Math.max(0, Duration.between(Instant.parse(timer.startedAt()), now).getSeconds()), timer.originAt(), timer.zone(), timer.customerId(), timer.projectId(), timer.comment(), timer.billable()); }
                case "resume" -> { if (timer == null) throw BusinessRules.invalid("Keine Stoppuhr vorhanden."); if (timer.startedAt() == null) timer = new Timer(timer.id(), now.toString(), timer.elapsedSeconds(), timer.originAt(), timer.zone(), timer.customerId(), timer.projectId(), timer.comment(), timer.billable()); }
                case "complete" -> { if (timer == null || time.load(owner).entries().stream().noneMatch(entry -> entry.id().equals(previous.timer().id()))) throw BusinessRules.invalid("Bitte die gemessene Zeit zuerst speichern."); timer = null; }
                case "discard" -> timer = null;
                default -> throw new ApiFailure(404, "NOT_FOUND", "Aktion nicht gefunden.");
            }
            return previous.withTimer(timer);
        }));
    }
    public record Apply(@NotBlank String revision, @NotBlank String workspaceRevision, @Positive long customerId, @NotBlank @Size(max=1000) String name, @NotBlank String deadline) {}
    @PostMapping("/templates/{id}/apply") public Map<String, Object> apply(Authentication authentication, @PathVariable UUID id, @Valid @RequestBody Apply input) {
        String owner = owner(authentication); var projectId = new long[1];
        var saved = storage.mutate(owner, previous -> {
            BusinessRules.revision(input.revision(), previous);
            var template = previous.templates().stream().filter(value -> value.id().equals(id)).findFirst().orElseThrow(() -> new ApiFailure(404, "NOT_FOUND", "Vorlage nicht gefunden."));
            var envelope = workspace.load(owner); var data = envelope.data();
            if (!envelope.revision().equals(input.workspaceRevision())) throw new ApiFailure(409, "VERSION_CONFLICT", "Der Arbeitsbereich wurde inzwischen geändert.");
            if (data.customers().stream().noneMatch(value -> value.id() == input.customerId())) throw BusinessRules.invalid("Der ausgewählte Kunde ist nicht verfügbar.");
            try { LocalDate.parse(input.deadline()); } catch (DateTimeException error) { throw BusinessRules.invalid("Ungültige Deadline."); }
            long nextProject = data.projects().stream().mapToLong(Project::id).max().orElse(0) + 1; projectId[0] = nextProject;
            long nextTask = data.tasks().stream().mapToLong(Task::id).max().orElse(0) + 1, nextEpic = data.epics().stream().mapToLong(Epic::id).max().orElse(0) + 1;
            var projects = new ArrayList<>(data.projects()); projects.add(new Project(nextProject, input.customerId(), input.name().strip(), false, input.deadline()));
            var tasks = new ArrayList<>(data.tasks()); var epics = new ArrayList<>(data.epics()); String now = Instant.now().toString();
            var codes = new HashSet<String>(); data.tasks().forEach(value -> codes.add(value.code()));
            for (var task : template.tasks()) { String code = "FF-" + nextTask; while (codes.contains(code)) code += "N"; codes.add(code); tasks.add(new Task(nextTask++, nextProject, null, code, task.title(), task.description(), "todo", task.priority(), now, now)); }
            for (var title : template.milestones()) epics.add(new Epic(nextEpic++, nextProject, title, "", now, now));
            var categories = new ArrayList<>(data.wiki().categories()); var articles = new ArrayList<>(data.wiki().articles());
            if (!template.pages().isEmpty()) {
                long category = categories.stream().mapToLong(Category::id).max().orElse(0) + 1, article = articles.stream().mapToLong(Article::id).max().orElse(0) + 1;
                categories.add(new Category(category, input.name().strip(), "Project documentation", now, now));
                for (var page : template.pages()) articles.add(new Article(article++, page.title(), page.content(), category, now, now));
            }
            workspace.save(owner, input.workspaceRevision(), new Data(projects, data.customers(), tasks, data.activities(), epics, data.sprints(), data.files(), new Wiki(articles, categories)), Map.of());
            return previous;
        });
        return Map.of("business", saved, "projectId", projectId[0]);
    }
}
