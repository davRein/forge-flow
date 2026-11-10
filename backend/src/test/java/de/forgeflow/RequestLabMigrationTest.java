package de.forgeflow;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import de.forgeflow.ai.PageContexts;
import de.forgeflow.ai.AgentDtos.PageContext;
import static org.assertj.core.api.Assertions.*;

class RequestLabMigrationTest {
    @ParameterizedTest @ValueSource(booleans = {true, false})
    void followsExistingDevToolsChoiceAndPreservesAi(boolean toolsVisible) throws Exception {
        String url = "jdbc:h2:mem:requestlab_" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        var config = Flyway.configure().dataSource(url, "sa", "").locations("classpath:db/migration/common");
        config.target("18").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var update = connection.prepareStatement("UPDATE ff_global_settings SET visible_apps=?, ai_apps='[]', revision='before-requestlab'")) {
            update.setString(1, toolsVisible ? "[\"wiki\",\"devTools\",\"dataScout\"]" : "[\"wiki\",\"dataScout\"]");
            update.executeUpdate();
        }
        config.target("19").load().migrate();
        try (var connection = DriverManager.getConnection(url, "sa", ""); var statement = connection.createStatement(); var rows = statement.executeQuery("SELECT visible_apps, ai_apps, revision FROM ff_global_settings")) {
            assertThat(rows.next()).isTrue();
            assertThat(rows.getString(1)).isEqualTo(toolsVisible ? "[\"wiki\",\"devTools\",\"requestLab\",\"dataScout\"]" : "[\"wiki\",\"dataScout\"]");
            assertThat(rows.getString(2)).isEqualTo("[]");
            if (toolsVisible) assertThat(rows.getString(3)).isNotEqualTo("before-requestlab");
            else assertThat(rows.getString(3)).isEqualTo("before-requestlab");
        }
        config.target("19").load().migrate();
    }
    @Test void requestLabContextDoesNotGrantProjectToolsOrRevealRequestData() {
        var context = new PageContext("/requestLab/client", null, null);
        assertThat(PageContexts.requireSupported(context)).isEqualTo(context);
        assertThat(PageContexts.isProjectManager(context)).isFalse();
        assertThat(PageContexts.metadata(context)).contains("not shared", "CORS");
    }
}
