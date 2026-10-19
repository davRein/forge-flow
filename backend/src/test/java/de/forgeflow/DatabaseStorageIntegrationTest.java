package de.forgeflow;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import de.forgeflow.api.ApiFailure;
import de.forgeflow.auth.Accounts;
import de.forgeflow.persistence.AccountBootstrap;
import de.forgeflow.workspace.WorkspaceDtos.*;
import de.forgeflow.workspace.WorkspaceStorage;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Runs the complete HTTP contract inherited from the reference-storage suite as well.
// By default H2 exercises the common SQL schema and JPA adapter without installing a DB.
// TEST_POSTGRES_URL switches this same suite to a dedicated PostgreSQL test database.
@ActiveProfiles(value = "postgres", inheritProfiles = false)
class DatabaseStorageIntegrationTest extends BackendIntegrationTest {
    private static final boolean POSTGRES = System.getenv("TEST_POSTGRES_URL") != null && !System.getenv("TEST_POSTGRES_URL").isBlank();
    private static final String URL = POSTGRES ? postgresUrl()
        : "jdbc:h2:file:./target/test-databases/" + UUID.randomUUID()
            + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_ON_EXIT=FALSE;LOCK_TIMEOUT=10000";
    private static final String USER = POSTGRES ? System.getenv().getOrDefault("TEST_POSTGRES_USER", "forgeflow_test") : "sa";
    private static final String PASSWORD = POSTGRES ? System.getenv().getOrDefault("TEST_POSTGRES_PASSWORD", "") : "";
    private static final String MIGRATIONS = "classpath:db/migration/common" + (POSTGRES ? ",classpath:db/migration/postgresql" : "");
    private static final String NOW = "2026-10-19T12:00:00Z";
    private static String postgresUrl() {
        String value = System.getenv("TEST_POSTGRES_URL");
        if (!value.startsWith("jdbc:postgresql://"))
            throw new IllegalArgumentException("TEST_POSTGRES_URL muss eine PostgreSQL-Testdatenbank angeben.");
        var uri = java.net.URI.create(value.substring("jdbc:".length()));
        if (uri.getRawQuery() != null
                || uri.getPath() == null || !uri.getPath().matches("/[a-z][a-z0-9_]*_test"))
            throw new IllegalArgumentException("TEST_POSTGRES_URL muss auf eine separate Datenbank mit Suffix _test zeigen, ohne URL-Parameter.");
        return value;
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired EntityManager entityManager;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> URL);
        registry.add("spring.datasource.username", () -> USER);
        registry.add("spring.datasource.password", () -> PASSWORD);
        registry.add("spring.flyway.locations", () -> MIGRATIONS);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
    }

    private String newOwner() {
        String id = UUID.randomUUID().toString();
        addOwner(id);
        return id;
    }

    private void addOwner(String id) {
        if (jdbc.queryForObject("select count(*) from ff_accounts where id = ?", Integer.class, id) == 0)
            jdbc.update("insert into ff_accounts(id, email, name, password_hash) values (?, ?, ?, ?)",
                id, id + "@example.test", "Testkonto", new BCryptPasswordEncoder(10).encode("Nur-im-Test-12345"));
    }

    private Data fixture(String title) {
        return new Data(
            List.of(new Project(1, 1, title, false, "2026-12-31")),
            List.of(new Customer(1, "Kunde", "", "", "", "", null, "", "")),
            List.of(), List.of(), List.of(), List.of(),
            List.of(new FileMetadata(1, 1, "Grüße.txt", 5, "text/plain", 0, NOW, NOW)),
            new Wiki(List.of(), List.of()));
    }

    private Map<Long, WorkspaceStorage.Attachment> file(String text) {
        return Map.of(1L, new WorkspaceStorage.Attachment(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    @Test
    void accountsAndEqualClientIdsStayIsolatedAndDeletionRemovesBytes() {
        String first = newOwner();
        String second = newOwner();
        var original = fixture("Erstes Projekt");
        storage.save(first, storage.load(first).revision(), original, file("Hallo"));
        storage.save(second, storage.load(second).revision(), fixture("Zweites Projekt"), file("Welt!"));
        assertThat(storage.load(first).data()).isEqualTo(original);
        assertThat(storage.load(second).data().projects().getFirst().name()).isEqualTo("Zweites Projekt");
        assertThat(storage.attachment(first, 1, 1).bytes()).isEqualTo("Hallo".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var loaded = storage.load(first);
        storage.save(first, loaded.revision(), Data.empty(), Map.of());
        assertThat(storage.load(first).data()).isEqualTo(Data.empty());
        assertThatThrownBy(() -> storage.attachment(first, 1, 1)).isInstanceOf(ApiFailure.class);
        assertThat(storage.attachment(second, 1, 1).bytes()).isEqualTo("Welt!".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void unchangedFileBytesAndCollectionOrderSurviveSubsequentSaves() {
        String owner = newOwner();
        var initial = fixture("Projekt");
        var customers = List.of(new Customer(9, "Zuerst", "", "", "", "", "", "", ""), initial.customers().getFirst());
        var data = new Data(initial.projects(), customers, initial.tasks(), initial.activities(), initial.epics(),
            initial.sprints(), initial.files(), initial.wiki());
        String revision = storage.save(owner, storage.load(owner).revision(), data, file("Hallo"));
        storage.save(owner, revision, data, Map.of());
        assertThat(storage.load(owner).data()).isEqualTo(data);
        assertThat(storage.attachment(owner, 1, 1).bytes()).isEqualTo("Hallo".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    @Test
    void databaseFailureAfterDeletesRollsBackRowsBytesAndRevision() {
        String owner = newOwner();
        var initial = fixture("Vorher");
        String revision = storage.save(owner, storage.load(owner).revision(), initial, file("Hallo"));
        var wiki = new Wiki(List.of(new Article(1, "reject-db-write", "Inhalt", null, NOW, NOW)), List.of());
        var next = new Data(initial.projects(), initial.customers(), List.of(), List.of(), List.of(), List.of(), initial.files(), wiki);
        jdbc.execute("alter table ff_wiki_articles add constraint test_write_failure check (title <> 'reject-db-write')");
        try {
            assertThatThrownBy(() -> storage.save(owner, revision, next, file("Welt!")))
                .isInstanceOf(DataIntegrityViolationException.class);
            assertThat(storage.load(owner)).isEqualTo(new Envelope(1, revision, initial));
            assertThat(storage.attachment(owner, 1, 1).bytes()).isEqualTo("Hallo".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        } finally {
            jdbc.execute("alter table ff_wiki_articles drop constraint test_write_failure");
        }
    }

    @Test
    void simultaneousWritersCannotBothCommitTheSameRevision() throws Exception {
        String owner = newOwner();
        String revision = storage.load(owner).revision();
        var start = new CountDownLatch(1);
        Callable<Integer> save = () -> {
            start.await();
            try { storage.save(owner, revision, Data.empty(), Map.of()); return 200; }
            catch (ApiFailure failure) { return failure.status; }
        };
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(save);
            var second = executor.submit(save);
            start.countDown();
            assertThat(List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS)))
                .containsExactlyInAnyOrder(200, 409);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void databaseForeignKeysRejectCrossAccountRelations() {
        String first = newOwner();
        String second = newOwner();
        storage.save(first, storage.load(first).revision(), fixture("Projekt"), file("Hallo"));
        storage.load(second);
        assertThatThrownBy(() -> jdbc.update(
            "insert into ff_projects(owner_id, id, sort_order, customer_id, name, planning_completed, deadline) values (?, 1, 0, 1, 'Fremd', false, '2026-12-31')", second))
            .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(storage.load(second).data()).isEqualTo(Data.empty());
    }

    @Test
    void bootstrapNeverOverwritesAnExistingHashAndCanBeOmittedAfterProvisioning() {
        var before = accounts.findByEmail("admin@example.test").orElseThrow();
        var template = new TransactionTemplate(transactions);
        template.executeWithoutResult(status -> new AccountBootstrap(entityManager, before.id(), before.email(),
            "Geänderter Name", new BCryptPasswordEncoder(10).encode("Anderes-Testpasswort-12345")).run(null));
        assertThat(accounts.findByEmail(before.email()).orElseThrow()).isEqualTo(before);
        template.executeWithoutResult(status -> new AccountBootstrap(entityManager, "unused", "", "", "").run(null));
    }

    @Test
    void aNewBackendInstanceReadsCommittedAccountsSettingsWorkspaceAndFiles() {
        String owner = newOwner();
        var original = fixture("Dauerhaft");
        String revision = storage.save(owner, storage.load(owner).revision(), original, file("Hallo"));
        var settings = new Settings(1, new SettingsValues("light", "projects", "high"));
        storage.saveSettings(owner, settings);
        try (var context = new SpringApplicationBuilder(BackendApplication.class).run(
                "--spring.profiles.active=postgres", "--server.port=0",
                "--spring.datasource.url=" + URL, "--spring.datasource.username=" + USER,
                "--spring.datasource.password=" + PASSWORD, "--spring.flyway.locations=" + MIGRATIONS,
                "--forgeflow.user.email=", "--forgeflow.user.password-hash=",
                "--spring.main.banner-mode=off", "--logging.level.root=ERROR")) {
            WorkspaceStorage other = context.getBean(WorkspaceStorage.class);
            assertThat(other.load(owner)).isEqualTo(new Envelope(1, revision, original));
            assertThat(other.loadSettings(owner)).isEqualTo(settings);
            assertThat(other.attachment(owner, 1, 1).bytes()).isEqualTo("Hallo".getBytes(java.nio.charset.StandardCharsets.UTF_8));
            assertThat(context.getBean(Accounts.class).findByEmail(owner + "@example.test")).isPresent();
        }
    }

    @Test
    void healthReportsTheConfiguredStorage() throws Exception {
        mvc.perform(get("/api/v1/health")).andExpect(status().isOk()).andExpect(jsonPath("$.storage").value("postgresql"));
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "TEST_POSTGRES_URL", matches = "jdbc:postgresql:.+")
    void postgresIndexRejectsASecondActiveSprintEvenWithoutApplicationValidation() {
        String owner = newOwner();
        var base = fixture("Projekt");
        var sprint = new Sprint(1, 1, "Sprint", "", "2026-10-19", "2026-10-31", "active",
            List.of(), NOW, NOW, NOW, null);
        var data = new Data(base.projects(), base.customers(), List.of(), List.of(), List.of(),
            List.of(sprint), base.files(), base.wiki());
        storage.save(owner, storage.load(owner).revision(), data, file("Hallo"));
        assertThatThrownBy(() -> jdbc.update(
            "insert into ff_sprints(owner_id, id, sort_order, project_id, title, goal, start_date, end_date, status, task_ids, created_at, updated_at, started_at) "
                + "values (?, 2, 1, 1, 'Zweiter Sprint', '', '2026-10-19', '2026-10-31', 'active', '[]', ?, ?, ?)",
            owner, NOW, NOW, NOW)).isInstanceOf(DataIntegrityViolationException.class);
    }
}
