package de.forgeflow.developer;
import java.util.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
@Repository @Profile("!postgres")
public class MemoryDeveloperStorage implements DeveloperStorage {
    private final Map<String,DeveloperData> values=new HashMap<>();
    private final de.forgeflow.auth.ExpiredOwners expired=new de.forgeflow.auth.ExpiredOwners();
    public synchronized DeveloperData load(String owner) { return values.getOrDefault(owner,DeveloperData.empty()); }
    public synchronized DeveloperData mutate(String owner,java.util.function.UnaryOperator<DeveloperData> operation) { expired.reject(owner);var next=operation.apply(load(owner)).revision(UUID.randomUUID().toString()); values.put(owner,next); return next; }
    @org.springframework.context.event.EventListener public synchronized void erase(de.forgeflow.auth.TrialAccounts.Expired event) { expired.mark(event.owner());values.remove(event.owner()); }
}
