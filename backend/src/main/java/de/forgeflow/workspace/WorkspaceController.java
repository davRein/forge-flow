package de.forgeflow.workspace;

import java.io.IOException;
import java.util.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.WorkspaceDtos.*;

@RestController
@RequestMapping("/api/v1")
public class WorkspaceController {
    private final WorkspaceStorage storage;
    private final Accounts accounts;
    private final JsonMapper json;
    private final Validator validator;
    public WorkspaceController(WorkspaceStorage storage, Accounts accounts, JsonMapper json, Validator validator) {
        this.storage = storage; this.accounts = accounts; this.json = json; this.validator = validator;
    }
    private String owner(Authentication auth) { return accounts.findById(auth.getName()).filter(Accounts.User::active).orElseThrow(() -> new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden.")).id(); }
    @GetMapping("/health") Map<String, String> health() { return Map.of("status", "ok", "storage", storage.kind()); }
    @GetMapping("/workspace") ResponseEntity<Envelope> workspace(Authentication auth) {
        Envelope record = storage.load(owner(auth)); return ResponseEntity.ok().eTag(record.revision()).body(record);
    }
    @PutMapping(value="/workspace", consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<Map<String, String>> save(Authentication auth, @RequestHeader(value="If-Match", required=false) String ifMatch,
            @RequestParam("manifest") String manifest, HttpServletRequest request) throws IOException {
        if (ifMatch == null) throw new ApiFailure(428, "REVISION_REQUIRED", "Eine Datenversion ist erforderlich.");
        if (manifest.length() > 4 * 1024 * 1024) throw new ApiFailure(413, "PAYLOAD_TOO_LARGE", "Das Datenmanifest ist zu groß.");
        Envelope record;
        try { record = json.readValue(manifest, Envelope.class); }
        catch (RuntimeException error) { throw new ApiFailure(422, "INVALID_WORKSPACE", "Ungültiges Datenmanifest."); }
        if (!validator.validate(record).isEmpty() || !ifMatch.equals("\"" + record.revision() + "\"")) throw new ApiFailure(422, "INVALID_WORKSPACE", "Ungültige Daten oder Datenversion.");
        // Older clients omit parentId; explicit null moves a page to the space root.
        var missingParents = new HashSet<Long>();
        for (var page : json.readTree(manifest).path("data").path("wiki").path("articles")) {
            if (!page.has("parentId")) missingParents.add(page.get("id").longValue());
        }
        if (!missingParents.isEmpty()) {
            var previous = storage.load(owner(auth));
            if (!previous.revision().equals(record.revision())) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Daten wurden inzwischen geändert. Bitte neu laden.");
            var parents = new HashMap<Long, Long>();
            previous.data().wiki().articles().forEach(page -> { if (page.parentId() != null) parents.put(page.id(), page.parentId()); });
            var data = record.data();
            var pages = data.wiki().articles().stream().map(page -> missingParents.contains(page.id())
                ? new Article(page.id(), page.title(), page.content(), page.categoryId(), page.createdAt(), page.updatedAt(), parents.get(page.id())) : page).toList();
            record = new Envelope(record.version(), record.revision(), new Data(data.projects(), data.customers(), data.tasks(), data.activities(), data.epics(), data.sprints(), data.files(), new Wiki(pages, data.wiki().categories())));
        }
        Map<Long, WorkspaceStorage.Attachment> incoming = new HashMap<>();
        var multipart = org.springframework.web.util.WebUtils.getNativeRequest(request, MultipartHttpServletRequest.class);
        if (multipart == null) throw new ApiFailure(400, "INVALID_MULTIPART", "Multipart-Daten fehlen.");
        var files = record.data().files();
        for (var entry : multipart.getMultiFileMap().entrySet()) {
            if (!entry.getKey().matches("file-[1-9][0-9]*") || entry.getValue().size() != 1) throw new ApiFailure(422, "INVALID_WORKSPACE", "Ungültige Datei-Zuordnung.");
            long id;
            try { id = Long.parseLong(entry.getKey().substring(5)); } catch (NumberFormatException error) { throw new ApiFailure(422, "INVALID_WORKSPACE", "Ungültige Datei-Kennung."); }
            if (files.stream().noneMatch(file -> file.id() == id)) throw new ApiFailure(422, "INVALID_WORKSPACE", "Datei-Metadaten fehlen.");
            incoming.put(id, new WorkspaceStorage.Attachment(entry.getValue().getFirst().getBytes()));
        }
        String revision = storage.save(owner(auth), record.revision(), record.data(), incoming);
        return ResponseEntity.ok().eTag(revision).body(Map.of("revision", revision));
    }
    @GetMapping("/projects/{projectId}/files/{fileId}/content")
    ResponseEntity<byte[]> attachment(Authentication auth, @PathVariable long projectId, @PathVariable long fileId) {
        var content = storage.attachment(owner(auth), projectId, fileId);
        if (content == null) throw new ApiFailure(404, "NOT_FOUND", "Datei nicht gefunden.");
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_OCTET_STREAM).header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=download").body(content.bytes());
    }
    @GetMapping("/me/settings") Object settings(Authentication auth) {
        Settings values = storage.loadSettings(owner(auth));
        return values == null ? tools.jackson.databind.node.NullNode.getInstance() : values;
    }
    @PutMapping("/me/settings") ResponseEntity<Void> settings(Authentication auth, @Valid @RequestBody Settings values) { storage.saveSettings(owner(auth), values); return ResponseEntity.noContent().build(); }
}
