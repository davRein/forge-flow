package de.forgeflow.rest;

import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import de.forgeflow.api.ApiFailure;

@Repository
@Profile("!postgres")
public class MemoryRestCollectionsStorage implements RestCollectionsStorage {
    private final Map<String, RestCollections> documents = new HashMap<>();
    private final de.forgeflow.auth.ExpiredOwners expired=new de.forgeflow.auth.ExpiredOwners();
    @org.springframework.context.event.EventListener public synchronized void erase(de.forgeflow.auth.TrialAccounts.Expired event) { expired.mark(event.owner());documents.remove(event.owner()); }
    @Override public synchronized RestCollections load(String ownerId) { return documents.getOrDefault(ownerId, RestCollections.empty()); }
    @Override public synchronized RestCollections save(String ownerId, RestCollections input) {
        expired.reject(ownerId);
        if (!load(ownerId).revision().equals(input.revision())) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Collections wurden inzwischen geändert. Bitte neu laden.");
        var saved = input.withRevision(UUID.randomUUID().toString()); documents.put(ownerId, saved); return saved;
    }
}
