package de.forgeflow.persistence;

import java.util.function.UnaryOperator;
import jakarta.persistence.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.developer.*;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.persistence.PersistenceEntities.*;

@Repository @Profile("postgres") public class JpaDeveloperStorage implements DeveloperStorage {
    private final EntityManager entityManager; private final JsonMapper json;
    public JpaDeveloperStorage(EntityManager entityManager,JsonMapper json) { this.entityManager=entityManager; this.json=json; }
    @Override @Transactional(readOnly=true) public DeveloperData load(String owner) { var row=entityManager.find(DeveloperRow.class,owner); return row==null?DeveloperData.empty():json.readValue(row.payload,DeveloperData.class).revision(row.revision); }
    @Override @Transactional public DeveloperData mutate(String owner,UnaryOperator<DeveloperData> operation) {
        var account=entityManager.find(AccountRow.class,owner,LockModeType.PESSIMISTIC_WRITE);
        if(account==null||!account.active||account.portalOnly||account.expiresAt!=null&&!account.expiresAt.isAfter(java.time.Instant.now())) throw new ApiFailure(401,"UNAUTHENTICATED","Bitte anmelden.");
        var value=operation.apply(load(owner)).revision(java.util.UUID.randomUUID().toString()); String payload=json.writeValueAsString(value);
        if(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>10*1024*1024) throw new ApiFailure(413,"DEVELOPER_LIMIT","Entwicklerdaten dürfen höchstens 10 MiB umfassen.");
        var row=entityManager.find(DeveloperRow.class,owner); boolean created=row==null; if(created) { row=new DeveloperRow(); row.ownerId=owner; }
        row.revision=value.revision(); row.payload=payload; if(created) entityManager.persist(row); return value;
    }
}
