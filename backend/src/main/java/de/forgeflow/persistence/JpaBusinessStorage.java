package de.forgeflow.persistence;

import java.util.function.UnaryOperator;
import jakarta.persistence.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.business.*;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.persistence.PersistenceEntities.*;

@Repository @Profile("postgres")
public class JpaBusinessStorage implements BusinessStorage {
    private final EntityManager entityManager; private final JsonMapper json;
    public JpaBusinessStorage(EntityManager entityManager, JsonMapper json) { this.entityManager = entityManager; this.json = json; }
    @Override @Transactional(readOnly=true) public BusinessData load(String owner) {
        var row = entityManager.find(BusinessRow.class, owner); return row == null ? BusinessData.empty() : json.readValue(row.payload, BusinessData.class).withRevision(row.revision);
    }
    @Override @Transactional public BusinessData mutate(String owner, UnaryOperator<BusinessData> operation) {
        var account = entityManager.find(AccountRow.class, owner, LockModeType.PESSIMISTIC_WRITE);
        if (account == null || !account.active || account.portalOnly) throw new ApiFailure(403, "FORBIDDEN", "Kein Zugriff auf den Arbeitsbereich.");
        var value = operation.apply(load(owner)).withRevision(java.util.UUID.randomUUID().toString());
        var row = entityManager.find(BusinessRow.class, owner); boolean created = row == null;
        if (created) { row = new BusinessRow(); row.ownerId = owner; }
        row.revision = value.revision(); row.payload = json.writeValueAsString(value); if (created) entityManager.persist(row); return value;
    }
}
