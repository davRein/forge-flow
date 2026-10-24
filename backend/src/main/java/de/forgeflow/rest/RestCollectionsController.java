package de.forgeflow.rest;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.Accounts;

@RestController
@RequestMapping("/api/v1/me/rest-collections")
public class RestCollectionsController {
    private final RestCollectionsStorage storage;
    private final Accounts accounts;
    private final JsonMapper json;
    public RestCollectionsController(RestCollectionsStorage storage, Accounts accounts, JsonMapper json) { this.storage = storage; this.accounts = accounts; this.json = json; }
    private String owner(Authentication authentication) { return accounts.findById(authentication.getName()).filter(Accounts.User::active).orElseThrow(() -> new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden.")).id(); }
    @GetMapping public ResponseEntity<RestCollections> get(Authentication authentication) {
        var value = storage.load(owner(authentication)); return ResponseEntity.ok().eTag(value.revision()).body(value);
    }
    @PutMapping public ResponseEntity<RestCollections> save(Authentication authentication,
            @RequestHeader(value="If-Match", required=false) String match, @Valid @RequestBody RestCollections input) {
        String owner = owner(authentication);
        if (match == null) throw new ApiFailure(428, "REVISION_REQUIRED", "Eine Datenversion ist erforderlich.");
        if (!match.equals("\"" + input.revision() + "\"")) throw new ApiFailure(422, "INVALID_REST_COLLECTIONS", "Ungültige Datenversion.");
        input.validate(json); var value = storage.save(owner, input); return ResponseEntity.ok().eTag(value.revision()).body(value);
    }
}
