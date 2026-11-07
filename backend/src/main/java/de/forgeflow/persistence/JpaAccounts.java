package de.forgeflow.persistence;

import java.util.Locale;
import java.util.Optional;
import java.util.List;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import de.forgeflow.auth.Accounts;
import de.forgeflow.auth.AccountRules;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.persistence.PersistenceEntities.AccountRow;

@Repository
@Profile("postgres")
public class JpaAccounts implements Accounts {
    private final EntityManager entityManager;
    private static final tools.jackson.databind.json.JsonMapper JSON = tools.jackson.databind.json.JsonMapper.builder().build();
    public JpaAccounts(EntityManager entityManager) { this.entityManager = entityManager; }

    @Override
    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        return entityManager.createQuery("select account from StoredAccount account where account.email = :email", AccountRow.class)
            .setParameter("email", email.strip().toLowerCase(Locale.ROOT))
            .getResultList().stream()
            .findFirst()
            .map(this::user);
    }

    @Override @Transactional(readOnly = true) public Optional<User> findByUsername(String username) {
        return entityManager.createQuery("select account from StoredAccount account where account.username = :username", AccountRow.class).setParameter("username", username).getResultList().stream().findFirst().map(this::user);
    }
    private User user(AccountRow row) {
        return new User(row.id, row.email, row.name, row.passwordHash, row.administrator, row.active, row.sessionVersion, row.portalOnly, row.expiresAt, row.username == null ? de.forgeflow.auth.AppPermissions.legacyUsername(row.id) : row.username, row.allowedApps == null ? de.forgeflow.auth.AppPermissions.ALL : java.util.Arrays.asList(JSON.readValue(row.allowedApps, String[].class)));
    }
    private void values(AccountRow row, User user) {
        row.email = AccountRules.email(user.email());
        row.username = user.username();
        row.allowedApps = JSON.writeValueAsString(user.allowedApps());
        row.name = user.name();
        row.passwordHash = user.passwordHash();
        row.administrator = user.administrator();
        row.active = user.active();
        row.sessionVersion = user.sessionVersion();
        row.portalOnly = user.portalOnly();
        row.expiresAt = user.expiresAt();
    }
    private void flush() {
        try { entityManager.flush(); }
        catch (PersistenceException error) {
            for (Throwable cause = error; cause != null; cause = cause.getCause()) {
                if (cause instanceof java.sql.SQLException sql && "23505".equals(sql.getSQLState()))
                    throw new ApiFailure(409, "EMAIL_IN_USE", "Diese E-Mail-Adresse wird bereits verwendet.");
            }
            throw error;
        }
    }
    @Override
    @Transactional(readOnly = true)
    public Optional<User> findById(String id) { return Optional.ofNullable(entityManager.find(AccountRow.class, id)).map(this::user); }

    @Override
    @Transactional(readOnly = true)
    public List<User> list() {
        return entityManager.createQuery("select account from StoredAccount account order by account.email", AccountRow.class)
            .getResultList().stream().map(this::user).toList();
    }

    @Override
    @Transactional
    public User insert(User user) {
        if (findByUsername(user.username()).isPresent()) throw new ApiFailure(409, "USERNAME_IN_USE", "Dieser Benutzername wird bereits verwendet.");
        var row = new AccountRow();
        row.id = user.id();
        values(row, user);
        entityManager.persist(row);
        flush();
        return user(row);
    }

    @Override
    @Transactional
    public User replace(User user, long expectedSessionVersion) {
        var row = entityManager.find(AccountRow.class, user.id(), LockModeType.PESSIMISTIC_WRITE);
        AccountRules.current(row == null ? null : user(row), expectedSessionVersion);
        if (findByUsername(user.username()).filter(existing -> !existing.id().equals(user.id())).isPresent()) throw new ApiFailure(409, "USERNAME_IN_USE", "Dieser Benutzername wird bereits verwendet.");
        var expiry = row.expiresAt;
        values(row, user);
        row.expiresAt = expiry;
        flush();
        return user(row);
    }

    @Override @Transactional public boolean deleteExpired(String id) {
        var row = entityManager.find(AccountRow.class, id, LockModeType.PESSIMISTIC_WRITE);
        if (row == null || row.expiresAt == null || row.expiresAt.isAfter(java.time.Instant.now())) return false;
        entityManager.createNativeQuery("update ff_wiki_articles set parent_id = null where owner_id = :owner").setParameter("owner", id).executeUpdate();
        for (String table : List.of("ff_customer_contacts", "ff_tasks", "ff_activities", "ff_sprints", "ff_files", "ff_epics", "ff_wiki_articles", "ff_wiki_categories", "ff_projects", "ff_customers", "ff_workspaces", "ff_settings", "ff_ai_conversations", "ff_rest_collections", "ff_recent_activity", "ff_time_tracking", "ff_business", "ff_developer_data"))
            entityManager.createNativeQuery("delete from " + table + " where owner_id = :owner").setParameter("owner", id).executeUpdate();
        entityManager.createNativeQuery("delete from ff_portal_links where owner_id = :owner or user_id = :owner").setParameter("owner", id).executeUpdate();
        entityManager.remove(row); entityManager.flush(); return true;
    }
}
