package de.forgeflow;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import de.forgeflow.auth.Accounts;
import de.forgeflow.workspace.WorkspaceStorage;
import static org.assertj.core.api.Assertions.*;

class AccountMigrationTest {
    @Test
    void existingAccountsAndDataSurviveUpgradeAndAdministratorIsAssignedOnlyOnce() throws Exception {
        String url = "jdbc:h2:mem:upgrade_" + UUID.randomUUID()
            + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1";
        Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration/common").target("1").load().migrate();
        String hash = new BCryptPasswordEncoder(10).encode("Migration-Test-12345");
        try (var connection = DriverManager.getConnection(url, "sa", "");
                var account = connection.prepareStatement("insert into ff_accounts(id, email, name, password_hash) values ('legacy-admin', 'legacy@example.test', 'Bisheriges Konto', ?)")) {
            account.setString(1, hash);
            account.executeUpdate();
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("insert into ff_workspaces(owner_id, revision) values ('legacy-admin', 'existing-revision')");
                statement.executeUpdate("insert into ff_customers(owner_id, id, sort_order, name, street, city, country, email, phone, industry) values ('legacy-admin', 7, 0, 'Bestehender Kunde', '', '', '', '', '', '')");
            }
        }
        String[] arguments = {
            "--spring.profiles.active=postgres", "--server.port=0", "--spring.datasource.url=" + url,
            "--spring.datasource.username=sa", "--spring.datasource.password=",
            "--spring.flyway.locations=classpath:db/migration/common",
            "--forgeflow.user.id=legacy-admin", "--forgeflow.user.email=", "--forgeflow.user.password-hash=",
            "--spring.main.banner-mode=off", "--logging.level.root=ERROR"
        };
        try (var context = new SpringApplicationBuilder(BackendApplication.class).run(arguments)) {
            var user = context.getBean(Accounts.class).findById("legacy-admin").orElseThrow();
            assertThat(user.administrator()).isTrue();
            assertThat(user.passwordHash()).isEqualTo(hash);
            var workspace = context.getBean(WorkspaceStorage.class).load(user.id());
            assertThat(workspace.revision()).isEqualTo("existing-revision");
            assertThat(workspace.data().customers().getFirst().name()).isEqualTo("Bestehender Kunde");
            // Simulate a later explicit database privilege change. Bootstrap must not undo it.
            context.getBean(JdbcTemplate.class).update("update ff_accounts set administrator = false where id = 'legacy-admin'");
        }
        try (var context = new SpringApplicationBuilder(BackendApplication.class).run(arguments)) {
            assertThat(context.getBean(Accounts.class).findById("legacy-admin").orElseThrow().administrator()).isFalse();
        }
    }
}
