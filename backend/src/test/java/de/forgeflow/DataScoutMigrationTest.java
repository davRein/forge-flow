package de.forgeflow;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class DataScoutMigrationTest {
    @Test void addsOnlyDataScoutWhilePreservingAppAndAiSelections() throws Exception {
        String url = "jdbc:h2:mem:datascout_migration_" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        var config = Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration/common");
        config.target("17").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement()) {
            statement.executeUpdate("UPDATE ff_global_settings SET visible_apps='[\"wiki\",\"flowPilot\"]', ai_apps='[]', revision='before-datascout'");
        }
        config.target("18").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement(); var rows = statement.executeQuery("SELECT visible_apps, ai_apps, revision FROM ff_global_settings")) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getString(1)).isEqualTo("[\"wiki\",\"flowPilot\",\"dataScout\"]");
            assertThat(rows.getString(2)).isEqualTo("[]");
            assertThat(rows.getString(3)).isNotEqualTo("before-datascout");
        }
        config.target("18").load().migrate();
    }
}
