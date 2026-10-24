package de.forgeflow.persistence;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.rest.RestCollections;
import de.forgeflow.rest.RestCollectionsStorage;
import de.forgeflow.persistence.PersistenceEntities.*;

@Repository
@Profile("postgres")
public class JpaRestCollectionsStorage implements RestCollectionsStorage {
    private final EntityManager entityManager;
    private final JsonMapper json;
    public JpaRestCollectionsStorage(EntityManager entityManager, JsonMapper json) { this.entityManager = entityManager; this.json = json; }
    @Override @Transactional(readOnly=true) public RestCollections load(String ownerId) {
        var row = entityManager.find(RestCollectionsRow.class, ownerId);
        return row == null ? RestCollections.empty() : json.readValue(row.payload, RestCollections.class).withRevision(row.revision);
    }
    @Override @Transactional public RestCollections save(String ownerId, RestCollections input) {
        var account = entityManager.find(AccountRow.class, ownerId, LockModeType.PESSIMISTIC_WRITE);
        if (account == null || !account.active) throw new ApiFailure(401, "UNAUTHENTICATED", "Bitte anmelden.");
        if (!load(ownerId).revision().equals(input.revision())) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Collections wurden inzwischen geändert. Bitte neu laden.");
        var saved = input.withRevision(java.util.UUID.randomUUID().toString());
        var row = entityManager.find(RestCollectionsRow.class, ownerId);
        boolean created = row == null;
        if (created) { row = new RestCollectionsRow(); row.ownerId = ownerId; }
        row.revision = saved.revision(); row.payload = json.writeValueAsString(saved);
        if (created) entityManager.persist(row);
        return saved;
    }
}
