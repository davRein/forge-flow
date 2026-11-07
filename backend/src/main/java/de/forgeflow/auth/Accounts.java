package de.forgeflow.auth;

import java.util.Optional;
import java.util.List;

public interface Accounts {
    record User(String id, String email, String name, String passwordHash, boolean administrator, boolean active, long sessionVersion, boolean portalOnly, java.time.Instant expiresAt, String username, List<String> allowedApps) {
        public User {
            username = AppPermissions.username(username);
            allowedApps = portalOnly ? List.of() : administrator ? AppPermissions.ALL : AppPermissions.grants(allowedApps);
        }
        public User(String id, String email, String name, String passwordHash, boolean administrator, boolean active, long sessionVersion, boolean portalOnly, java.time.Instant expiresAt) {
            this(id, email, name, passwordHash, administrator, active, sessionVersion, portalOnly, expiresAt, AppPermissions.legacyUsername(id), AppPermissions.ALL);
        }
        public User(String id, String email, String name, String passwordHash, boolean administrator, boolean active, long sessionVersion, boolean portalOnly) {
            this(id, email, name, passwordHash, administrator, active, sessionVersion, portalOnly, null);
        }
        @Override public boolean active() { return active && (expiresAt == null || expiresAt.isAfter(java.time.Instant.now())); }
        public User(String id, String email, String name, String passwordHash, boolean administrator, boolean active, long sessionVersion) {
            this(id, email, name, passwordHash, administrator, active, sessionVersion, false);
        }
        public User(String id, String email, String name, String passwordHash) {
            this(id, email, name, passwordHash, false, true, 0);
        }
        @Override public String toString() { return "User[id=" + id + ", credentials=REDACTED]"; }
    }
    Optional<User> findByEmail(String email);
    default Optional<User> findByUsername(String username) { return list().stream().filter(user -> user.username().equals(username)).findFirst(); }
    default Optional<User> findByLogin(String value) {
        if (value.contains("@")) return findByEmail(AccountRules.email(value));
        try { return findByUsername(AppPermissions.username(value)); } catch (de.forgeflow.api.ApiFailure invalid) { return Optional.empty(); }
    }
    Optional<User> findById(String id);
    List<User> list();
    User insert(User user);
    User replace(User user, long expectedSessionVersion);
    default boolean deleteExpired(String id) { return false; }
}
