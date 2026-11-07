package de.forgeflow.auth;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.api.ApiFailure;

@RestController
@RequestMapping("/api/v1")
public class AccountController {
    public record Profile(@NotBlank @Size(max=1000) String name, @NotBlank @Email @Size(max=254) String email,
            @Size(max=72) String currentPassword) {
        @Override public String toString() { return "Profile[credentials=REDACTED]"; }
    }
    public record Password(@NotBlank @Size(max=72) String currentPassword, @NotBlank @Size(max=72) String newPassword) {
        @Override public String toString() { return "Password[credentials=REDACTED]"; }
    }
    public record NewUser(@NotBlank @Size(max=1000) String name, @NotBlank @Email @Size(max=254) String email,
            @NotBlank @Size(max=72) String password, @Size(max=64) String username, @Size(max=12) List<String> allowedApps) {
        public NewUser(String name, String email, String password) { this(name, email, password, null, null); }
        @Override public String toString() { return "NewUser[credentials=REDACTED]"; }
    }
    public record Active(@NotNull Boolean active) {}
    public record Access(@NotBlank @Size(max=64) String username, @NotNull @Size(max=12) List<String> allowedApps, @NotNull @Min(0) Long sessionVersion) {}
    private final Accounts accounts;
    private final BCryptPasswordEncoder encoder;
    private final SecurityContextRepository contexts;
    private final HttpSessionCsrfTokenRepository csrf;
    private final AttemptLimiter attempts;

    public AccountController(Accounts accounts, BCryptPasswordEncoder encoder, SecurityContextRepository contexts,
            HttpSessionCsrfTokenRepository csrf, AttemptLimiter attempts) {
        this.accounts = accounts; this.encoder = encoder; this.contexts = contexts; this.csrf = csrf;
        this.attempts = attempts;
    }
    private Accounts.User current(Authentication authentication) {
        if (!(authentication.getPrincipal() instanceof AccountPrincipal principal))
            throw new ApiFailure(401, "UNAUTHENTICATED", "Bitte erneut anmelden.");
        return accounts.findById(principal.id()).filter(user -> user.active() && user.sessionVersion() == principal.sessionVersion())
            .orElseThrow(() -> new ApiFailure(401, "UNAUTHENTICATED", "Bitte erneut anmelden."));
    }
    private Accounts.User administrator(Authentication authentication) {
        Accounts.User user = current(authentication);
        if (!user.administrator()) throw new ApiFailure(403, "FORBIDDEN", "Dafür sind Administratorrechte erforderlich.");
        return user;
    }
    private void verify(String password, Accounts.User user) {
        attempts.check("password-check:" + user.id(), 10);
        if (password == null || password.getBytes(StandardCharsets.UTF_8).length > 72 || password.indexOf('\0') >= 0
                || !encoder.matches(password, user.passwordHash()))
            throw new ApiFailure(400, "CURRENT_PASSWORD_INVALID", "Das aktuelle Passwort ist falsch.");
    }
    @PutMapping("/me/profile")
    Map<String, Object> profile(Authentication authentication, @Valid @RequestBody Profile input,
            HttpServletRequest request, HttpServletResponse response) {
        Accounts.User before = current(authentication);
        String email = AccountRules.email(input.email());
        boolean changedEmail = !before.email().equals(email);
        if (changedEmail) verify(input.currentPassword(), before);
        var next = new Accounts.User(before.id(), email, input.name().strip(), before.passwordHash(),
            before.administrator(), true, before.sessionVersion() + (changedEmail ? 1 : 0), before.portalOnly(), before.expiresAt(), before.username(), before.allowedApps());
        Accounts.User saved = accounts.replace(next, before.sessionVersion());
        return changedEmail ? AccountSessions.renew(saved, request, response, contexts, csrf)
            : AccountSessions.response(saved, request, response, csrf);
    }
    @PostMapping("/me/password")
    ResponseEntity<Void> password(Authentication authentication, @Valid @RequestBody Password input, HttpServletRequest request) {
        Accounts.User before = current(authentication);
        verify(input.currentPassword(), before);
        AccountRules.password(input.newPassword());
        var next = new Accounts.User(before.id(), before.email(), before.name(), encoder.encode(input.newPassword()),
            before.administrator(), true, before.sessionVersion() + 1, before.portalOnly(), before.expiresAt(), before.username(), before.allowedApps());
        accounts.replace(next, before.sessionVersion());
        var session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }
    private static Map<String, Object> managedProfile(Accounts.User user) {
        var profile = AccountSessions.profile(user);
        profile.put("sessionVersion", user.sessionVersion());
        return profile;
    }
    @GetMapping("/users")
    List<Map<String, Object>> users(Authentication authentication) {
        administrator(authentication);
        return accounts.list().stream().map(AccountController::managedProfile).toList();
    }
    @PostMapping("/users")
    ResponseEntity<Map<String, Object>> create(Authentication authentication, @Valid @RequestBody NewUser input) {
        administrator(authentication);
        AccountRules.password(input.password());
        if (input.username()!=null && input.username().strip().equalsIgnoreCase("Administrator")) throw new ApiFailure(422,"RESERVED_USERNAME","Der Benutzername Administrator ist für das Administratorkonto reserviert.");
        String id = UUID.randomUUID().toString();
        var user = new Accounts.User(id, AccountRules.email(input.email()), input.name().strip(), encoder.encode(input.password()), false, true, 0, false, null,
            input.username() == null ? AppPermissions.legacyUsername(id) : input.username(), input.allowedApps() == null ? AppPermissions.ALL : AppPermissions.grants(input.allowedApps()));
        return ResponseEntity.status(201).body(AccountSessions.profile(accounts.insert(user)));
    }
    @PutMapping("/users/{id}/access")
    Map<String, Object> access(Authentication authentication, @PathVariable String id, @Valid @RequestBody Access input) {
        administrator(authentication);
        var before = accounts.findById(id).orElseThrow(() -> new ApiFailure(404, "NOT_FOUND", "Konto nicht gefunden."));
        if (before.administrator() || before.portalOnly() || before.expiresAt() != null) throw new ApiFailure(400, "ADMIN_ACCOUNT_PROTECTED", "Dieses besondere Konto kann hier nicht geändert werden.");
        if (input.username().strip().equalsIgnoreCase("Administrator")) throw new ApiFailure(422,"RESERVED_USERNAME","Der Benutzername Administrator ist für das Administratorkonto reserviert.");
        AccountRules.current(before, input.sessionVersion());
        var next = new Accounts.User(before.id(), before.email(), before.name(), before.passwordHash(), false, before.active(), before.sessionVersion()+1, false, before.expiresAt(), input.username(), AppPermissions.grants(input.allowedApps()));
        return managedProfile(accounts.replace(next, before.sessionVersion()));
    }
    @PutMapping("/users/{id}/active")
    Map<String, Object> active(Authentication authentication, @PathVariable String id, @Valid @RequestBody Active input) {
        Accounts.User actor = administrator(authentication);
        Accounts.User before = accounts.findById(id).orElseThrow(() -> new ApiFailure(404, "NOT_FOUND", "Konto nicht gefunden."));
        if (before.id().equals(actor.id()) || before.administrator())
            throw new ApiFailure(400, "ADMIN_ACCOUNT_PROTECTED", "Das Administratorkonto kann hier nicht deaktiviert werden.");
        if (before.active() == input.active()) return managedProfile(before);
        var next = new Accounts.User(before.id(), before.email(), before.name(), before.passwordHash(),
            false, input.active(), before.sessionVersion() + 1, before.portalOnly(), before.expiresAt(), before.username(), before.allowedApps());
        return managedProfile(accounts.replace(next, before.sessionVersion()));
    }
}
