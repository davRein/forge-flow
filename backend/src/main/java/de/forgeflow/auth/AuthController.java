package de.forgeflow.auth;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.api.ApiFailure;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    public record Login(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 72) String password) {
        @Override public String toString() { return "Login[credentials=REDACTED]"; }
    }
    private record Attempt(int count, long expires) {}
    private final Map<String, Attempt> attempts = new HashMap<>();
    private final Accounts accounts;
    private final BCryptPasswordEncoder encoder;
    private final SecurityContextRepository contexts;
    private final HttpSessionCsrfTokenRepository csrf;
    private final String dummyHash;
    public AuthController(Accounts accounts, BCryptPasswordEncoder encoder, SecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrf) {
        this.accounts = accounts; this.encoder = encoder; this.contexts = contexts; this.csrf = csrf;
        this.dummyHash = encoder.encode(UUID.randomUUID().toString());
    }
    private synchronized void limit(String key, int max) {
        long now = System.currentTimeMillis(); attempts.entrySet().removeIf(entry -> entry.getValue().expires() <= now);
        Attempt previous = attempts.getOrDefault(key, new Attempt(0, now + 900000));
        if (attempts.size() >= 10000 && !attempts.containsKey(key)) throw new ApiFailure(429, "RATE_LIMITED", "Zu viele Anmeldeversuche.");
        Attempt next = new Attempt(previous.count() + 1, previous.expires()); attempts.put(key, next);
        if (next.count() > max) throw new ApiFailure(429, "RATE_LIMITED", "Zu viele Anmeldeversuche. Bitte später erneut versuchen.");
    }
    private Map<String, Object> session(Accounts.User user, CsrfToken token) {
        return Map.of("user", Map.of("id", user.id(), "email", user.email(), "name", user.name()), "csrfToken", token.getToken());
    }
    private CsrfToken token(HttpServletRequest request, HttpServletResponse response) {
        CsrfToken token = csrf.loadToken(request);
        if (token == null) { token = csrf.generateToken(request); csrf.saveToken(token, request, response); }
        return token;
    }
    @GetMapping("/csrf")
    Map<String, String> csrf(HttpServletRequest request, HttpServletResponse response) { return Map.of("csrfToken", token(request, response).getToken()); }
    @PostMapping("/login")
    Map<String, Object> login(@Valid @RequestBody Login input, HttpServletRequest request, HttpServletResponse response) {
        limit("ip:" + request.getRemoteAddr(), 50);
        String email = input.email().strip().toLowerCase(Locale.ROOT);
        limit("account:" + request.getRemoteAddr() + ":" + email, 10);
        if (input.password().getBytes(StandardCharsets.UTF_8).length > 72 || input.password().indexOf('\0') >= 0) throw new ApiFailure(401, "INVALID_CREDENTIALS", "E-Mail oder Passwort ist falsch.");
        Accounts.User user = accounts.findByEmail(email).orElse(null);
        boolean verified = encoder.matches(input.password(), user == null ? dummyHash : user.passwordHash());
        if (user == null || !verified) throw new ApiFailure(401, "INVALID_CREDENTIALS", "E-Mail oder Passwort ist falsch.");
        request.getSession(true); request.changeSessionId();
        Authentication auth = new UsernamePasswordAuthenticationToken(user.email(), null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        var context = SecurityContextHolder.createEmptyContext(); context.setAuthentication(auth); SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        csrf.saveToken(null, request, response);
        return session(user, token(request, response));
    }
    @GetMapping("/session")
    Map<String, Object> current(Authentication auth, HttpServletRequest request, HttpServletResponse response) {
        Accounts.User user = accounts.findByEmail(auth.getName()).orElseThrow(() -> new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden."));
        return session(user, token(request, response));
    }
}
