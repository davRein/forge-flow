package de.forgeflow.auth;

import java.time.*;
import java.util.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.bind.annotation.*;
import de.forgeflow.api.ApiFailure;

@RestController @Configuration @EnableScheduling
public class TrialAccounts {
    public record Expired(String owner) {}
    private final Accounts accounts; private final AttemptLimiter limits; private final BCryptPasswordEncoder passwords;
    private final SecurityContextRepository contexts; private final HttpSessionCsrfTokenRepository csrf; private final ApplicationEventPublisher events; private final boolean enabled;
    public TrialAccounts(Accounts accounts, AttemptLimiter limits, BCryptPasswordEncoder passwords, SecurityContextRepository contexts, HttpSessionCsrfTokenRepository csrf, ApplicationEventPublisher events, @Value("${forgeflow.trials.enabled:true}") boolean enabled) {
        this.accounts=accounts; this.limits=limits; this.passwords=passwords; this.contexts=contexts; this.csrf=csrf; this.events=events; this.enabled=enabled;
    }
    @PostMapping("/api/v1/auth/trial") public synchronized Map<String,Object> create(@Valid @RequestBody AuthController.Login input, HttpServletRequest request, HttpServletResponse response) {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities().stream().noneMatch(value -> value.getAuthority().equals("ROLE_ADMIN"))) throw new ApiFailure(403,"FORBIDDEN","Nur Administratoren dürfen Konten anlegen.");
        if (!enabled) throw new ApiFailure(403,"TRIAL_DISABLED","Testkonten sind derzeit deaktiviert.");
        limits.check("trial-ip:" + request.getRemoteAddr(),3);
        if (accounts.list().stream().filter(user -> user.expiresAt()!=null && user.active()).count() >= 30) throw new ApiFailure(429,"TRIAL_LIMIT","Derzeit sind alle Testzugänge belegt.");
        AccountRules.password(input.password());
        var user = accounts.insert(new Accounts.User(UUID.randomUUID().toString(),AccountRules.email(input.email()),"Test user",passwords.encode(input.password()),false,true,0,false,Instant.now().plus(Duration.ofHours(6))));
        return AccountSessions.renew(user,request,response,contexts,csrf);
    }
    @Scheduled(fixedDelay=30000, initialDelay=1000) public void cleanup() {
        for (var user : accounts.list()) if (user.expiresAt()!=null && !user.expiresAt().isAfter(Instant.now())) {
            try { if (accounts.deleteExpired(user.id())) events.publishEvent(new Expired(user.id())); }
            catch(org.springframework.dao.DataAccessException failure){org.slf4j.LoggerFactory.getLogger(TrialAccounts.class).warn("Trial cleanup failed; will retry. category={}",failure.getClass().getSimpleName());}
        }
    }
}
