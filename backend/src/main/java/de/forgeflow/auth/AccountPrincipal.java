package de.forgeflow.auth;

import java.io.Serializable;
import java.security.Principal;

// A stable ID prevents an old session from becoming another user's session after an email change.
public record AccountPrincipal(String id, long sessionVersion) implements Principal, Serializable {
    @Override public String getName() { return id; }
}
