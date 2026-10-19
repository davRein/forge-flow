package de.forgeflow.auth;

import java.util.Set;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.filter.OncePerRequestFilter;
import de.forgeflow.api.ApiErrors;

@Configuration
public class SecurityConfig {
    @Bean BCryptPasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean org.springframework.security.core.userdetails.UserDetailsService users(Accounts accounts) {
        return email -> accounts.findByEmail(email).map(user -> org.springframework.security.core.userdetails.User.withUsername(user.email()).password(user.passwordHash()).roles("USER").build())
            .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("Ungültige Anmeldung."));
    }
    @Bean SecurityContextRepository securityContexts() { return new HttpSessionSecurityContextRepository(); }
    @Bean HttpSessionCsrfTokenRepository csrfTokens() { return new HttpSessionCsrfTokenRepository(); }
    @Bean SecurityFilterChain security(HttpSecurity http, SecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrf,
            @Value("${forgeflow.origin}") String origin) throws Exception {
        http.formLogin(form -> form.disable()).httpBasic(basic -> basic.disable())
            .requestCache(cache -> cache.disable())
            .securityContext(context -> context.securityContextRepository(contexts))
            .csrf(config -> config.csrfTokenRepository(csrf).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
            .authorizeHttpRequests(auth -> auth.requestMatchers("/api/v1/auth/csrf", "/api/v1/auth/login", "/api/v1/health").permitAll().anyRequest().authenticated())
            .exceptionHandling(errors -> errors
                .authenticationEntryPoint((req, res, error) -> ApiErrors.write(res, 401, "UNAUTHENTICATED", "Bitte anmelden."))
                .accessDeniedHandler((req, res, error) -> ApiErrors.write(res, 403, "CSRF_REJECTED", "Die Sicherheitsprüfung ist fehlgeschlagen. Bitte Sitzung neu laden.")))
            .logout(logout -> logout.logoutUrl("/api/v1/auth/logout").invalidateHttpSession(true).deleteCookies("FORGEFLOW_SESSION")
                .logoutSuccessHandler((req, res, auth) -> res.setStatus(204)))
            .headers(headers -> headers.cacheControl(cache -> {}).contentSecurityPolicy(csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
            .addFilterBefore(new OncePerRequestFilter() {
                @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, java.io.IOException {
                    if ("cross-site".equals(request.getHeader("Sec-Fetch-Site")) || (!Set.of("GET", "HEAD", "OPTIONS").contains(request.getMethod()) && !origin.equals(request.getHeader("Origin")))) {
                        ApiErrors.write(response, 403, "ORIGIN_REJECTED", "Ungültiger Ursprung der Anfrage."); return;
                    }
                    chain.doFilter(request, response);
                }
            }, CsrfFilter.class);
        return http.build();
    }
}
