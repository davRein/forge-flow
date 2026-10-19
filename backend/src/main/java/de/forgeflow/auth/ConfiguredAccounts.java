package de.forgeflow.auth;

import java.util.Locale;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

// Replace with a Spring Data repository when database integration begins.
@Repository
public class ConfiguredAccounts implements Accounts {
    private final User user;
    public ConfiguredAccounts(@Value("${forgeflow.user.id}") String id, @Value("${forgeflow.user.email}") String email,
            @Value("${forgeflow.user.name}") String name, @Value("${forgeflow.user.password-hash}") String passwordHash) {
        if (id.isBlank() || email.isBlank() || !passwordHash.matches("\\$2[aby]\\$(1[0-5])\\$[./A-Za-z0-9]{53}"))
            throw new IllegalArgumentException("AUTH_USER_EMAIL und AUTH_PASSWORD_HASH mit bcrypt-Kostenfaktor 10–15 müssen gesetzt sein.");
        this.user = new User(id, email.strip().toLowerCase(Locale.ROOT), name, passwordHash);
    }
    @Override public Optional<User> findByEmail(String email) { return user.email().equals(email) ? Optional.of(user) : Optional.empty(); }
}
