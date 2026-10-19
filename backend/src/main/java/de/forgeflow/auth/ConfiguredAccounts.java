package de.forgeflow.auth;

import java.util.Locale;
import java.util.Optional;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import de.forgeflow.api.ApiFailure;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

// Environment-backed account for database-free local development.
@Repository
@Profile("!postgres")
public class ConfiguredAccounts implements Accounts {
    private final Map<String, User> users = new LinkedHashMap<>();
    public ConfiguredAccounts(@Value("${forgeflow.user.id}") String id, @Value("${forgeflow.user.email}") String email,
            @Value("${forgeflow.user.name}") String name, @Value("${forgeflow.user.password-hash}") String passwordHash) {
        if (id.isBlank() || email.isBlank() || !passwordHash.matches("\\$2[aby]\\$(1[0-5])\\$[./A-Za-z0-9]{53}"))
            throw new IllegalArgumentException("AUTH_USER_EMAIL und AUTH_PASSWORD_HASH mit bcrypt-Kostenfaktor 10–15 müssen gesetzt sein.");
        users.put(id, new User(id, email.strip().toLowerCase(Locale.ROOT), name, passwordHash, true, true, 0));
    }
    @Override public synchronized Optional<User> findByEmail(String email) {
        return users.values().stream().filter(user -> user.email().equals(AccountRules.email(email))).findFirst();
    }
    @Override public synchronized Optional<User> findById(String id) { return Optional.ofNullable(users.get(id)); }
    @Override public synchronized List<User> list() { return List.copyOf(users.values()); }
    @Override public synchronized User insert(User user) {
        if (users.containsKey(user.id()) || findByEmail(user.email()).isPresent())
            throw new ApiFailure(409, "EMAIL_IN_USE", "Diese E-Mail-Adresse wird bereits verwendet.");
        users.put(user.id(), user);
        return user;
    }
    @Override public synchronized User replace(User user, long expectedSessionVersion) {
        AccountRules.current(users.get(user.id()), expectedSessionVersion);
        if (findByEmail(user.email()).filter(existing -> !existing.id().equals(user.id())).isPresent())
            throw new ApiFailure(409, "EMAIL_IN_USE", "Diese E-Mail-Adresse wird bereits verwendet.");
        users.put(user.id(), user);
        return user;
    }
}
