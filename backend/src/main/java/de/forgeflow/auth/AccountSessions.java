package de.forgeflow.auth;

import java.util.List;
import java.util.Map;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;

public final class AccountSessions {
    private AccountSessions() {}
    public static Map<String, Object> profile(Accounts.User user) {
        return Map.of("id", user.id(), "email", user.email(), "name", user.name(),
            "administrator", user.administrator(), "active", user.active(), "portalOnly", user.portalOnly());
    }
    public static CsrfToken token(HttpServletRequest request, HttpServletResponse response, HttpSessionCsrfTokenRepository csrf) {
        CsrfToken token = csrf.loadToken(request);
        if (token == null) { token = csrf.generateToken(request); csrf.saveToken(token, request, response); }
        return token;
    }
    public static Map<String, Object> response(Accounts.User user, HttpServletRequest request, HttpServletResponse response,
            HttpSessionCsrfTokenRepository csrf) {
        return Map.of("user", profile(user), "csrfToken", token(request, response, csrf).getToken());
    }
    public static Map<String, Object> renew(Accounts.User user, HttpServletRequest request, HttpServletResponse response,
            SecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrf) {
        request.getSession(true);
        request.changeSessionId();
        var authorities = user.administrator()
            ? List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN"))
            : List.of(new SimpleGrantedAuthority("ROLE_USER"));
        var principal = new AccountPrincipal(user.id(), user.sessionVersion());
        var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        contexts.saveContext(context, request, response);
        csrf.saveToken(null, request, response);
        return response(user, request, response, csrf);
    }
}
