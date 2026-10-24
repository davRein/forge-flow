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
        // Reload constraints between Flyway setup and application startup. H2's
        // persistent in-memory mode can retain closed sessions in IN constraints.
        String url = "jdbc:h2:file:./target/test-databases/upgrade_" + UUID.randomUUID()
            + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_ON_EXIT=FALSE";
        Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration/common").target("1").load().migrate();
        String hash = new BCryptPasswordEncoder(10).encode("Migration-Test-12345");
        try (var connection = DriverManager.getConnection(url, "sa", "");
                var account = connection.prepareStatement("insert into ff_accounts(id, email, name, password_hash) values ('legacy-admin', 'legacy@example.test', 'Bisheriges Konto', ?)")) {
            account.setString(1, hash);
            account.executeUpdate();
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("insert into ff_workspaces(owner_id, revision) values ('legacy-admin', 'existing-revision')");
                statement.executeUpdate("insert into ff_wiki_categories(owner_id,id,sort_order,name,description,created_at,updated_at) values ('legacy-admin',1,0,'Existing documentation','Legacy space','2026-10-24T10:00:00Z','2026-10-24T10:00:00Z')");
                statement.executeUpdate("insert into ff_wiki_articles(owner_id,id,sort_order,title,content,category_id,created_at,updated_at) values ('legacy-admin',1,0,'Existing page','Legacy content',1,'2026-10-24T10:00:00Z','2026-10-24T10:00:00Z')");
                statement.executeUpdate("insert into ff_settings(owner_id, theme_mode, default_project_view, default_task_priority) values ('legacy-admin', 'light', 'projects', 'high')");
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
            assertThat(workspace.data().wiki().articles().getFirst().content()).isEqualTo("Legacy content");
            assertThat(workspace.data().wiki().articles().getFirst().parentId()).isNull();
            assertThat(workspace.data().customers().getFirst().name()).isEqualTo("Bestehender Kunde");
            assertThat(workspace.data().customers().getFirst().postalCode()).isEmpty();
            var global = context.getBean(WorkspaceStorage.class).loadGlobalSettings();
            assertThat(global.industries()).contains("IT & Software");
            context.getBean(WorkspaceStorage.class).saveGlobalSettings(new de.forgeflow.workspace.GlobalSettings(global.revision(), java.util.List.of("Persistente Branche")));
            var data = workspace.data(); var oldCustomer = data.customers().getFirst();
            var customer = new de.forgeflow.workspace.WorkspaceDtos.Customer(oldCustomer.id(), oldCustomer.name(), oldCustomer.street(), oldCustomer.city(), oldCustomer.country(), oldCustomer.email(), oldCustomer.website(), oldCustomer.phone(), oldCustomer.industry(), "SW1A 1AA");
            context.getBean(WorkspaceStorage.class).save(user.id(), workspace.revision(), new de.forgeflow.workspace.WorkspaceDtos.Data(data.projects(), java.util.List.of(customer), data.tasks(), data.activities(), data.epics(), data.sprints(), data.files(), data.wiki()), java.util.Map.of());
            var settings = context.getBean(WorkspaceStorage.class).loadSettings(user.id()).settings();
            assertThat(settings.language()).isEqualTo("de");
            assertThat(settings.themeMode()).isEqualTo("light");
            assertThat(settings.defaultProjectView()).isEqualTo("projects");
            assertThat(settings.defaultTaskPriority()).isEqualTo("high");
            // Simulate a later explicit database privilege change. Bootstrap must not undo it.
            context.getBean(JdbcTemplate.class).update("update ff_accounts set administrator = false where id = 'legacy-admin'");
        }
        try (var context = new SpringApplicationBuilder(BackendApplication.class).run(arguments)) {
            assertThat(context.getBean(Accounts.class).findById("legacy-admin").orElseThrow().administrator()).isFalse();
            assertThat(context.getBean(WorkspaceStorage.class).load("legacy-admin").data().customers().getFirst().postalCode()).isEqualTo("SW1A 1AA");
            assertThat(context.getBean(WorkspaceStorage.class).loadGlobalSettings().industries()).containsExactly("Persistente Branche");
        }
    }
}
