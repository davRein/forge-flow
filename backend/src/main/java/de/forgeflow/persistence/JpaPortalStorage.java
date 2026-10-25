package de.forgeflow.persistence;
import java.util.*;
import jakarta.persistence.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.business.*;
import de.forgeflow.persistence.PersistenceEntities.*;
@Repository @Profile("postgres")
public class JpaPortalStorage implements PortalStorage {
    private final EntityManager em; private final JsonMapper json;
    public JpaPortalStorage(EntityManager em, JsonMapper json) { this.em = em; this.json = json; }
    @Transactional(readOnly=true) public Optional<PortalLink> find(String user) { var row = em.find(PortalRow.class, user); return row == null ? Optional.empty() : Optional.of(json.readValue(row.payload, PortalLink.class).withRevision(row.revision)); }
    @Transactional(readOnly=true) public List<PortalLink> list(String owner) { return em.createQuery("select p from StoredPortalLink p where p.ownerId = :owner", PortalRow.class).setParameter("owner", owner).getResultList().stream().map(row -> json.readValue(row.payload, PortalLink.class).withRevision(row.revision)).toList(); }
    @Override @Transactional public PortalLink save(PortalLink input) { return save(input, java.util.function.UnaryOperator.identity()); }
    @Transactional public PortalLink save(PortalLink input, java.util.function.UnaryOperator<PortalLink> publish) {
        em.find(AccountRow.class, input.ownerId(), LockModeType.PESSIMISTIC_WRITE);
        var row = em.find(PortalRow.class, input.userId()); boolean created = row == null;
        if (created && !input.revision().equals("portal-initial") || !created && (!row.ownerId.equals(input.ownerId()) || !row.revision.equals(input.revision()))) throw new ApiFailure(409, "VERSION_CONFLICT", "Die Portal-Freigabe wurde inzwischen geändert.");
        var next = publish.apply(input).withRevision(UUID.randomUUID().toString());
        if (created) { row = new PortalRow(); row.userId = next.userId(); row.ownerId = next.ownerId(); }
        row.revision = next.revision(); row.payload = json.writeValueAsString(next); if (created) em.persist(row); return next;
    }
}
