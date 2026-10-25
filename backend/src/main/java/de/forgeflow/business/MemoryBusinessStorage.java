package de.forgeflow.business;

import java.util.*;
import java.util.function.UnaryOperator;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

@Repository @Profile("!postgres")
public class MemoryBusinessStorage implements BusinessStorage {
    private final Map<String, BusinessData> values = new HashMap<>();
    @Override public synchronized BusinessData load(String owner) { return values.getOrDefault(owner, BusinessData.empty()); }
    @Override public synchronized BusinessData mutate(String owner, UnaryOperator<BusinessData> operation) {
        var next = operation.apply(load(owner)).withRevision(UUID.randomUUID().toString()); values.put(owner, next); return next;
    }
}
