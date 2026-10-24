package de.forgeflow.workspace;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.auth.Accounts;
import de.forgeflow.api.ApiFailure;

@RestController
@RequestMapping("/api/v1/settings/global")
public class GlobalSettingsController {
    private final WorkspaceStorage storage;
    private final Accounts accounts;
    public GlobalSettingsController(WorkspaceStorage storage, Accounts accounts) { this.storage = storage; this.accounts = accounts; }
    private Accounts.User user(Authentication authentication) {
        return accounts.findById(authentication.getName()).filter(Accounts.User::active).orElseThrow(() -> new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden."));
    }
    @GetMapping public ResponseEntity<GlobalSettings> get(Authentication authentication) {
        user(authentication); var settings = storage.loadGlobalSettings(); return ResponseEntity.ok().eTag(settings.revision()).body(settings);
    }
    @PutMapping public ResponseEntity<GlobalSettings> save(Authentication authentication,
            @RequestHeader(value="If-Match", required=false) String match, @Valid @RequestBody GlobalSettings input) {
        if (!user(authentication).administrator()) throw new ApiFailure(403, "FORBIDDEN", "Nur Administratoren können globale Einstellungen ändern.");
        if (match == null) throw new ApiFailure(428, "REVISION_REQUIRED", "Eine Datenversion ist erforderlich.");
        if (!match.equals("\"" + input.revision() + "\"")) throw new ApiFailure(422, "INVALID_GLOBAL_SETTINGS", "Ungültige Datenversion.");
        var saved = storage.saveGlobalSettings(input.normalized()); return ResponseEntity.ok().eTag(saved.revision()).body(saved);
    }
}
