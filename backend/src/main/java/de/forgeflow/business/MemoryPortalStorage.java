package de.forgeflow.business;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import de.forgeflow.api.ApiFailure;
@Repository @Profile("!postgres")
public class MemoryPortalStorage implements PortalStorage {
    private final Map<String, PortalLink> values = new HashMap<>();
    public synchronized Optional<PortalLink> find(String user) { return Optional.ofNullable(values.get(user)); }
    public synchronized List<PortalLink> list(String owner) { return values.values().stream().filter(value -> value.ownerId().equals(owner)).toList(); }
    public synchronized PortalLink save(PortalLink input, java.util.function.UnaryOperator<PortalLink> publish) {
        var old = values.get(input.userId());
        if (old != null && (!old.ownerId().equals(input.ownerId()) || !old.revision().equals(input.revision())) || old == null && !input.revision().equals("portal-initial")) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Portal-Freigabe wurde inzwischen geändert.");
        var next = publish.apply(input).withRevision(UUID.randomUUID().toString()); values.put(next.userId(), next); return next;
    }
}
