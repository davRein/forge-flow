package de.forgeflow.time;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.Accounts;

@RestController
@RequestMapping("/api/v1/me/time-tracking")
public class TimeTrackingController {
    private final TimeTrackingStorage storage;
    private final Accounts accounts;
    public TimeTrackingController(TimeTrackingStorage storage, Accounts accounts) { this.storage = storage; this.accounts = accounts; }
    private String owner(Authentication authentication) { return accounts.findById(authentication.getName()).filter(Accounts.User::active).orElseThrow(() -> new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden.")).id(); }
    @GetMapping public ResponseEntity<TimeTracking> get(Authentication authentication) { var value = storage.load(owner(authentication)); return ResponseEntity.ok().eTag(value.revision()).body(value); }
    @PutMapping public ResponseEntity<TimeTracking> save(Authentication authentication,
            @RequestHeader(value="If-Match", required=false) String match, @Valid @RequestBody TimeTracking input) {
        if (match == null) throw new ApiFailure(428, "REVISION_REQUIRED", "Eine Datenversion ist erforderlich.");
        if (!match.equals("\"" + input.revision() + "\"")) throw new ApiFailure(422, "INVALID_TIME_ENTRY", "Ungültige Datenversion.");
        var value = storage.save(owner(authentication), input); return ResponseEntity.ok().eTag(value.revision()).body(value);
    }
}
