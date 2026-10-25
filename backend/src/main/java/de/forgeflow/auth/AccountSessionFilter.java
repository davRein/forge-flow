package de.forgeflow.auth;

import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DataAccessException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import de.forgeflow.api.ApiErrors;

public final class AccountSessionFilter extends OncePerRequestFilter {
    private final Accounts accounts;
    public AccountSessionFilter(Accounts accounts) { this.accounts = accounts; }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return java.util.Set.of("/api/v1/auth/login", "/api/v1/auth/csrf", "/api/v1/health").contains(request.getRequestURI());
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && !(authentication instanceof AnonymousAuthenticationToken)) {
            try {
                var user = authentication.getPrincipal() instanceof AccountPrincipal principal
                    ? accounts.findById(principal.id()).filter(value -> value.active() && value.sessionVersion() == principal.sessionVersion()).orElse(null)
                    : null;
                if (user == null) {
                    var session = request.getSession(false);
                    if (session != null) session.invalidate();
                    SecurityContextHolder.clearContext();
                    ApiErrors.write(response, 401, "UNAUTHENTICATED", "Die Sitzung ist nicht mehr gültig. Bitte erneut anmelden.");
                    return;
                }
                String path = request.getRequestURI();
                if (user.portalOnly() && !java.util.Set.of("/api/v1/auth/session", "/api/v1/auth/logout", "/api/v1/me/password").contains(path) && !path.startsWith("/api/v1/portal/")) {
                    ApiErrors.write(response, 403, "PORTAL_ONLY", "Dieses Konto hat nur Zugriff auf das Kundenportal."); return;
                }
            } catch (DataAccessException error) {
                ApiErrors.write(response, 503, "STORAGE_UNAVAILABLE", "Das Konto konnte nicht geprüft werden. Bitte erneut versuchen.");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
