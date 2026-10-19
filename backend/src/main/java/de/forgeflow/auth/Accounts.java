package de.forgeflow.auth;

import java.util.Optional;

public interface Accounts {
    record User(String id, String email, String name, String passwordHash) {}
    Optional<User> findByEmail(String email);
}
