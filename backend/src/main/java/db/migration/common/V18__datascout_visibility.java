package db.migration.common;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.UUID;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import tools.jackson.databind.json.JsonMapper;

/** Add the requested fourth remote app, preserving previous selections and AI permissions. */
public class V18__datascout_visibility extends BaseJavaMigration {
    @Override public Integer getChecksum() { return "datascout-visible-v1".hashCode(); }
    @Override public void migrate(Context context) throws Exception {
        var json = JsonMapper.builder().build();
        var connection = context.getConnection();
        try (var query = connection.prepareStatement("SELECT id, visible_apps FROM ff_global_settings"); var rows = query.executeQuery()) {
            while (rows.next()) {
                var apps = new ArrayList<>(Arrays.asList(json.readValue(rows.getString(2), String[].class)));
                if (apps.contains("dataScout")) continue;
                apps.add("dataScout");
                try (var update = connection.prepareStatement("UPDATE ff_global_settings SET visible_apps=?, revision=? WHERE id=?")) {
                    update.setString(1, json.writeValueAsString(apps));
                    update.setString(2, UUID.randomUUID().toString());
                    update.setInt(3, rows.getInt(1));
                    update.executeUpdate();
                }
            }
        }
    }
}
