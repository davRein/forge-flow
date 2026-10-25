package de.forgeflow.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.Validator;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.time.TimeTracking;
import de.forgeflow.time.TimeTrackingStorage;
import de.forgeflow.workspace.WorkspaceStorage;
import de.forgeflow.persistence.PersistenceEntities.*;

@Repository
@Profile("postgres")
public class JpaTimeTrackingStorage implements TimeTrackingStorage {
    private final EntityManager entityManager;
    private final JsonMapper json;
    private final WorkspaceStorage workspace;
    private final Validator validator;
    public JpaTimeTrackingStorage(EntityManager entityManager, JsonMapper json, WorkspaceStorage workspace, Validator validator) { this.entityManager = entityManager; this.json = json; this.workspace = workspace; this.validator = validator; }
    @Override @Transactional(readOnly=true) public TimeTracking load(String ownerId) {
        var row = entityManager.find(TimeTrackingRow.class, ownerId);
        return row == null ? TimeTracking.empty() : json.readValue(row.payload, TimeTracking.class).withRevision(row.revision);
    }
    @Override @Transactional public TimeTracking save(String ownerId, TimeTracking input) {
        var account = entityManager.find(AccountRow.class, ownerId, LockModeType.PESSIMISTIC_WRITE);
        if (account == null || !account.active) throw new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden.");
        var previous = load(ownerId);
        if (!previous.revision().equals(input.revision())) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Zeiteinträge wurden inzwischen geändert. Bitte neu laden.");
        var saved = input.normalized(previous, workspace.load(ownerId).data(), validator, json).withRevision(java.util.UUID.randomUUID().toString());
        var row = entityManager.find(TimeTrackingRow.class, ownerId); boolean created = row == null;
        if (created) { row = new TimeTrackingRow(); row.ownerId = ownerId; }
        row.revision = saved.revision(); row.payload = json.writeValueAsString(saved);
        if (created) entityManager.persist(row);
        return saved;
    }
}
