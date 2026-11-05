package de.forgeflow.business;

import java.util.*;
import java.util.function.UnaryOperator;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

@Repository @Profile("!postgres")
public class MemoryBusinessStorage implements BusinessStorage {
    private final Map<String, BusinessData> values = new HashMap<>();
    private final de.forgeflow.auth.ExpiredOwners expired=new de.forgeflow.auth.ExpiredOwners();
    @org.springframework.context.event.EventListener public synchronized void erase(de.forgeflow.auth.TrialAccounts.Expired event) { expired.mark(event.owner());values.remove(event.owner()); }
    @Override public synchronized BusinessData load(String owner) { return values.getOrDefault(owner, BusinessData.empty()); }
    @Override public synchronized BusinessData mutate(String owner, UnaryOperator<BusinessData> operation) {
        expired.reject(owner);
        var next = operation.apply(load(owner)).withRevision(UUID.randomUUID().toString()); values.put(owner, next); return next;
    }
}
