package de.forgeflow.business;

import java.time.*;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.*;
import de.forgeflow.time.TimeTrackingStorage;
import de.forgeflow.workspace.WorkspaceStorage;
import tools.jackson.databind.json.JsonMapper;

@RestController
public class PortalController {
    private final PortalStorage links; private final Accounts accounts; private final WorkspaceStorage workspace; private final BusinessStorage business; private final TimeTrackingStorage time; private final BCryptPasswordEncoder passwords; private final PdfReports pdf; private final JsonMapper json;
    public PortalController(PortalStorage links, Accounts accounts, WorkspaceStorage workspace, BusinessStorage business, TimeTrackingStorage time, BCryptPasswordEncoder passwords, PdfReports pdf, JsonMapper json) { this.links = links; this.accounts = accounts; this.workspace = workspace; this.business = business; this.time = time; this.passwords = passwords; this.pdf = pdf; this.json = json; }
    private String digest(byte[] bytes) { try { return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes)); } catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); } }
    private PortalLink publish(PortalLink grant) {
        if (links.find(grant.userId()).isEmpty() && links.list(grant.ownerId()).size() >= 100) throw BusinessRules.invalid("Höchstens 100 Portal-Konten pro Arbeitsbereich.");
        var data = workspace.load(grant.ownerId()).data();
        var projects = data.projects().stream().filter(value -> grant.projectIds().contains(value.id()) && value.customerId() == grant.customerId()).map(value -> new PortalSnapshot.Project(value.id(), value.name(), value.deadline(), data.tasks().stream().filter(task -> task.projectId() == value.id()).count(), data.tasks().stream().filter(task -> task.projectId() == value.id() && task.status().equals("done")).count())).toList();
        var ids = projects.stream().map(value -> value.id()).toList();
        var articles = data.wiki().articles().stream().filter(value -> grant.articleIds().contains(value.id())).map(value -> new PortalSnapshot.Page(value.id(), value.title(), value.content())).toList();
        if (articles.stream().mapToLong(value -> value.content().length()).sum() > 2 * 1024 * 1024) throw BusinessRules.invalid("Die Portal-Dokumentation ist zu groß.");
        var files = data.files().stream().filter(value -> grant.fileIds().contains(value.id()) && ids.contains(value.projectId())).toList();
        if (files.stream().mapToLong(value -> value.size()).sum() > 25 * 1024 * 1024) throw BusinessRules.invalid("Portal-Dateien dürfen insgesamt höchstens 25 MiB umfassen.");
        var documents = business.load(grant.ownerId()).documents().stream().filter(value -> grant.documentIds().contains(value.id()) && value.customerId() == grant.customerId() && !value.status().equals("draft")).toList();
        var reports = new LinkedHashMap<String, List<de.forgeflow.time.TimeTracking.Entry>>(); var entries = time.load(grant.ownerId()).entries();
        for (String month : grant.reportMonths()) reports.put(month, entries.stream().filter(value -> Objects.equals(value.customerId(), grant.customerId()) && value.date().startsWith(month + "-") && (value.projectId() == null || ids.contains(value.projectId()))).map(value -> new de.forgeflow.time.TimeTracking.Entry(value.id(), value.date(), value.startMinute(), value.minutes(), value.breakMinutes(), value.customerId(), value.projectId(), value.customerName(), value.projectName(), "", value.billable())).toList());
        var snapshot = new PortalSnapshot(data.customers().stream().filter(value -> value.id() == grant.customerId()).map(value -> value.name()).findFirst().orElse(""), projects, articles,
            files.stream().map(value -> new PortalSnapshot.File(value.id(), value.projectId(), value.name(), value.size(), digest(workspace.attachment(grant.ownerId(), value.projectId(), value.id()).bytes()))).toList(), documents, reports);
        String payload = json.writeValueAsString(snapshot);
        if (payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 5 * 1024 * 1024) throw BusinessRules.invalid("Die Portal-Freigabe ist zu groß.");
        return grant.withSnapshot(payload);
    }
    private PortalSnapshot snapshot(PortalLink grant) { return grant.snapshot() == null || grant.snapshot().isEmpty() ? PortalSnapshot.empty() : json.readValue(grant.snapshot(), PortalSnapshot.class); }
    public record NewPortal(@NotBlank @Size(max=1000) String name, @NotBlank @Email @Size(max=254) String email, @NotBlank @Size(max=72) String password, @Positive long customerId) { @Override public String toString() { return "NewPortal[credentials=REDACTED]"; } }
    @GetMapping("/api/v1/me/business/portal-accounts") public List<Map<String, Object>> list(Authentication auth) { return links.list(auth.getName()).stream().map(link -> Map.<String, Object>of("link", link, "user", AccountSessions.profile(accounts.findById(link.userId()).orElseThrow()))).toList(); }
    @PostMapping("/api/v1/me/business/portal-accounts") @Transactional public ResponseEntity<Map<String, Object>> create(Authentication auth, @Valid @RequestBody NewPortal input) {
        if (links.list(auth.getName()).size() >= 100) throw BusinessRules.invalid("Höchstens 100 Portal-Konten pro Arbeitsbereich.");
        if (workspace.load(auth.getName()).data().customers().stream().noneMatch(value -> value.id() == input.customerId())) throw BusinessRules.invalid("Der ausgewählte Kunde ist nicht verfügbar.");
        AccountRules.password(input.password());
        var user = accounts.insert(new Accounts.User(UUID.randomUUID().toString(), AccountRules.email(input.email()), input.name().strip(), passwords.encode(input.password()), false, true, 0, true));
        var link = links.save(new PortalLink(user.id(), auth.getName(), "portal-initial", input.customerId(), true, List.of(), List.of(), List.of(), List.of(), List.of()), this::publish);
        return ResponseEntity.status(201).body(Map.of("link", link, "user", AccountSessions.profile(user)));
    }
    @PutMapping("/api/v1/me/business/portal-accounts/{id}") public PortalLink update(Authentication auth, @PathVariable String id, @RequestHeader(value="If-Match", required=false) String match, @Valid @RequestBody PortalLink input) {
        var old = links.find(id).filter(value -> value.ownerId().equals(auth.getName())).orElseThrow(() -> new ApiFailure(404, "NOT_FOUND", "Portal-Konto nicht gefunden."));
        if (match == null) throw new ApiFailure(428, "REVISION_REQUIRED", "Eine Datenversion ist erforderlich.");
        if (!match.equals("\"" + input.revision() + "\"") || !input.userId().equals(id) || !input.ownerId().equals(old.ownerId()) || input.customerId() != old.customerId()) throw BusinessRules.invalid("Ungültige Portal-Freigabe.");
        if (!input.active()) return links.save(input, value -> value.withSnapshot(old.snapshot()));
        var data = workspace.load(auth.getName()).data();
        for (var project : input.projectIds()) if (data.projects().stream().noneMatch(value -> value.id() == project && value.customerId() == old.customerId())) throw BusinessRules.invalid("Ungültige Projektfreigabe.");
        for (var article : input.articleIds()) if (data.wiki().articles().stream().noneMatch(value -> value.id() == article)) throw BusinessRules.invalid("Ungültige Dokumentationsfreigabe.");
        for (var file : input.fileIds()) if (data.files().stream().noneMatch(value -> value.id() == file && input.projectIds().contains(value.projectId()))) throw BusinessRules.invalid("Dateien benötigen eine Projektfreigabe.");
        for (var document : input.documentIds()) if (business.load(auth.getName()).documents().stream().noneMatch(value -> value.id().equals(document) && value.customerId() == old.customerId() && !value.status().equals("draft"))) throw BusinessRules.invalid("Nur freigegebene Dokumente dieses Kunden sind verfügbar.");
        for (var month : input.reportMonths()) try { YearMonth.parse(month); } catch (DateTimeException error) { throw BusinessRules.invalid("Ungültiger Monat."); }
        return links.save(input, value -> value.active() ? publish(value) : value.withSnapshot(old.snapshot()));
    }
    private PortalLink access(Authentication auth) {
        if (accounts.findById(auth.getName()).filter(value -> value.portalOnly() && value.active()).isEmpty()) throw new ApiFailure(403, "FORBIDDEN", "Kein Portal-Zugriff.");
        return links.find(auth.getName()).filter(PortalLink::active).filter(link -> accounts.findById(link.ownerId()).filter(value -> value.active() && !value.portalOnly()).isPresent()).orElseThrow(() -> new ApiFailure(403, "PORTAL_REVOKED", "Der Portal-Zugang wurde widerrufen."));
    }
    @GetMapping("/api/v1/portal/home") public Map<String, Object> home(Authentication auth) {
        var grant = access(auth); var published = snapshot(grant);
        return Map.of("customerName", published.customerName(), "projects", published.projects(), "articles", published.articles(),
            "files", published.files().stream().map(value -> Map.of("id", value.id(), "name", value.name(), "size", value.size())).toList(),
            "documents", published.documents().stream().map(value -> Map.of("id", value.id(), "title", value.title(), "kind", value.kind(), "number", value.number(), "status", value.status())).toList(), "reportMonths", published.reports().keySet());
    }
    @GetMapping("/api/v1/portal/documents/{id}/pdf") public ResponseEntity<byte[]> document(Authentication auth, @PathVariable UUID id, @RequestParam(defaultValue="en") String language) {
        var grant = access(auth); var document = snapshot(grant).documents().stream().filter(value -> value.id().equals(id)).findFirst().orElseThrow(() -> new ApiFailure(404, "NOT_FOUND", "Dokument nicht gefunden."));
        return BusinessPdfController.file(pdf.document(document, language), document.number() + ".pdf");
    }
    @GetMapping("/api/v1/portal/timesheet/pdf") public ResponseEntity<byte[]> timesheet(Authentication auth, @RequestParam String month, @RequestParam(defaultValue="en") String language) {
        var grant = access(auth); var entries = snapshot(grant).reports().get(month); if (entries == null) throw new ApiFailure(404, "NOT_FOUND", "Leistungsnachweis nicht freigegeben.");
        return BusinessPdfController.file(pdf.timesheet(entries, "", month, false, language), "timesheet-" + month + ".pdf");
    }
    @GetMapping("/api/v1/portal/files/{id}") public ResponseEntity<byte[]> file(Authentication auth, @PathVariable long id) {
        var grant = access(auth); var file = snapshot(grant).files().stream().filter(value -> value.id() == id).findFirst().orElseThrow(() -> new ApiFailure(404, "NOT_FOUND", "Datei nicht gefunden."));
        var bytes = workspace.attachment(grant.ownerId(), file.projectId(), id); if (!digest(bytes.bytes()).equals(file.sha256())) throw new ApiFailure(404, "NOT_FOUND", "Die freigegebene Dateiversion ist nicht verfügbar.");
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).header("Content-Disposition", ContentDisposition.attachment().filename(file.name(), java.nio.charset.StandardCharsets.UTF_8).build().toString()).body(bytes.bytes());
    }
}
