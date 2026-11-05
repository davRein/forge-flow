package de.forgeflow.auth;

import java.util.Optional;
import java.util.List;

public interface Accounts {
    record User(String id, String email, String name, String passwordHash, boolean administrator, boolean active, long sessionVersion, boolean portalOnly, java.time.Instant expiresAt) {
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
    Optional<User> findById(String id);
    List<User> list();
    User insert(User user);
    User replace(User user, long expectedSessionVersion);
    default boolean deleteExpired(String id) { return false; }
}
