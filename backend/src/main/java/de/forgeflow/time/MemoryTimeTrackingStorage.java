package de.forgeflow.time;

import java.util.*;
import jakarta.validation.Validator;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.workspace.WorkspaceStorage;

@Repository
@Profile("!postgres")
public class MemoryTimeTrackingStorage implements TimeTrackingStorage {
    private final Map<String, TimeTracking> documents = new HashMap<>();
    private final WorkspaceStorage workspace;
    private final Validator validator;
    private final JsonMapper json;
    public MemoryTimeTrackingStorage(WorkspaceStorage workspace, Validator validator, JsonMapper json) { this.workspace = workspace; this.validator = validator; this.json = json; }
    @Override public synchronized TimeTracking load(String ownerId) { return documents.getOrDefault(ownerId, TimeTracking.empty()); }
    @Override public synchronized TimeTracking save(String ownerId, TimeTracking input) {
        var previous = load(ownerId);
        if (!previous.revision().equals(input.revision())) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Zeiteinträge wurden inzwischen geändert. Bitte neu laden.");
        var saved = input.normalized(previous, workspace.load(ownerId).data(), validator, json).withRevision(UUID.randomUUID().toString());
        documents.put(ownerId, saved); return saved;
    }
}
