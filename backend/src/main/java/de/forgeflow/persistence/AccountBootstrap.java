package de.forgeflow.persistence;

import java.util.Locale;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import de.forgeflow.persistence.PersistenceEntities.AccountRow;
import de.forgeflow.persistence.PersistenceEntities.AccountSetupRow;

// Initial provisioning only. Environment changes never overwrite existing login credentials.
@Component
@Profile("postgres")
public class AccountBootstrap implements ApplicationRunner {
    private final EntityManager entityManager;
    private final String id;
    private final String email;
    private final String name;
    private final String hash;

    public AccountBootstrap(EntityManager entityManager,
            @Value("${forgeflow.user.id}") String id,
            @Value("${forgeflow.user.email}") String email,
            @Value("${forgeflow.user.name}") String name,
            @Value("${forgeflow.user.password-hash}") String hash) {
        this.entityManager = entityManager;
        this.id = id;
        this.email = email.strip().toLowerCase(Locale.ROOT);
        this.name = name;
        this.hash = hash;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        AccountSetupRow setup = entityManager.find(AccountSetupRow.class, 1, LockModeType.PESSIMISTIC_WRITE);
        // No bootstrap credentials are required after the first account has been provisioned.
        if (email.isEmpty() && hash.isEmpty()) {
            if (entityManager.createQuery("select count(account) from StoredAccount account", Long.class).getSingleResult() == 0)
                throw new IllegalStateException("Für die erste Einrichtung AUTH_USER_EMAIL und AUTH_PASSWORD_HASH setzen.");
            if (!setup.administratorAssigned) {
                AccountRow first = entityManager.find(AccountRow.class, id);
                if (first == null) throw new IllegalStateException("AUTH_USER_ID muss für die einmalige Administrator-Einrichtung auf das bestehende Konto zeigen.");
                assignAdministrator(first, setup);
            }
            return;
        }
        if (id.isBlank() || id.length() > 128 || email.isBlank() || email.length() > 254 || name.isBlank()
                || !hash.matches("\\$2[aby]\\$(1[0-5])\\$[./A-Za-z0-9]{53}"))
            throw new IllegalArgumentException("Ungültige Konto-Konfiguration. E-Mail und gültigen BCrypt-Hash setzen.");
        AccountRow existing = entityManager.find(AccountRow.class, id);
        if (existing != null) {
            if (!existing.email.equals(email))
                throw new IllegalStateException("Die Bootstrap-Kennung gehört bereits zu einem anderen Konto.");
            assignAdministrator(existing, setup);
            return;
        }
        if (!entityManager.createQuery("select account.id from StoredAccount account where account.email = :email", String.class)
                .setParameter("email", email).getResultList().isEmpty())
            throw new IllegalStateException("Die Bootstrap-E-Mail gehört bereits zu einem anderen Konto.");
        var account = new AccountRow();
        account.id = id;
        account.email = email;
        account.name = name;
        account.passwordHash = hash;
        assignAdministrator(account, setup);
        entityManager.persist(account);
    }

    private void assignAdministrator(AccountRow account, AccountSetupRow setup) {
        if (!setup.administratorAssigned) {
            if (!account.active) throw new IllegalStateException("Ein deaktiviertes Konto kann nicht als erster Administrator eingerichtet werden.");
            account.administrator = true;
            setup.administratorAssigned = true;
        }
    }
}
