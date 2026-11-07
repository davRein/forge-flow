package de.forgeflow.auth;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.api.ApiFailure;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    public record Login(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 72) String password) {
        @Override public String toString() { return "Login[credentials=REDACTED]"; }
    }
    private final AttemptLimiter attempts;
    private final Accounts accounts;
    private final BCryptPasswordEncoder encoder;
    private final SecurityContextRepository contexts;
    private final HttpSessionCsrfTokenRepository csrf;
    private final String dummyHash;
    private final String origin;
    public AuthController(Accounts accounts, BCryptPasswordEncoder encoder, SecurityContextRepository contexts,
            HttpSessionCsrfTokenRepository csrf, AttemptLimiter attempts,
            @org.springframework.beans.factory.annotation.Value("${forgeflow.origin}") String origin) {
        this.accounts = accounts; this.encoder = encoder; this.contexts = contexts; this.csrf = csrf;
        this.dummyHash = encoder.encode(UUID.randomUUID().toString());
        this.attempts = attempts;
        this.origin = origin;
    }
    @GetMapping("/csrf")
    Map<String, String> csrf(HttpServletRequest request, HttpServletResponse response) {
        return Map.of("csrfToken", AccountSessions.token(request, response, csrf).getToken());
    }
    @PostMapping("/login")
    Map<String, Object> login(@Valid @RequestBody Login input, HttpServletRequest request, HttpServletResponse response) {
        attempts.check("ip:" + request.getRemoteAddr(), 50);
        String email = input.email().strip().toLowerCase(Locale.ROOT);
        attempts.check("account:" + request.getRemoteAddr() + ":" + email, 10);
        if (input.password().getBytes(StandardCharsets.UTF_8).length > 72 || input.password().indexOf('\0') >= 0) throw new ApiFailure(401, "INVALID_CREDENTIALS", "Benutzername, E-Mail oder Passwort ist falsch.");
        Accounts.User user = accounts.findByLogin(email).orElse(null);
        boolean verified = encoder.matches(input.password(), user == null ? dummyHash : user.passwordHash());
        if (user == null || !user.active() || !verified) throw new ApiFailure(401, "INVALID_CREDENTIALS", "Benutzername, E-Mail oder Passwort ist falsch.");
        return AccountSessions.renew(user, request, response, contexts, csrf);
    }
    @GetMapping("/session")
    Map<String, Object> current(Authentication auth, HttpServletRequest request, HttpServletResponse response) {
        Accounts.User user = accounts.findById(auth.getName()).filter(Accounts.User::active)
            .orElseThrow(() -> new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden."));
        return AccountSessions.response(user, request, response, csrf);
    }
    // Nginx auth_request checks the live suite session without exposing account data or CSRF tokens.
    @GetMapping("/showcase-session")
    org.springframework.http.ResponseEntity<Map<String, Object>> showcaseSession(Authentication authentication, @RequestParam(required=false) String app) {
        Accounts.User user = accounts.findById(authentication.getName()).filter(Accounts.User::active)
            .filter(value -> !value.portalOnly())
            .orElseThrow(() -> new ApiFailure(403, "FORBIDDEN", "Diese Sitzung darf die Apps nicht verwenden."));
        if (app != null && !app.isBlank()) AppPermissions.require(user, app);
        var profile = new java.util.LinkedHashMap<String, Object>(AccountSessions.profile(user));
        profile.put("issuer", origin);
        return org.springframework.http.ResponseEntity.ok()
            .header("X-ForgeFlow-User-Id", user.id())
            .body(profile);
    }

    // Kept for compatibility with the previous administrator-only deployment.
    @GetMapping("/showcase-access")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    void showcaseAccess() {}
}
