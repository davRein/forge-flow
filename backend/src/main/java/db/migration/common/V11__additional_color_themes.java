package db.migration.common;

import java.util.ArrayList;
import java.util.Locale;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** V1's unnamed CHECK has different generated names in PostgreSQL and H2. */
public class V11__additional_color_themes extends BaseJavaMigration {
    private static final String ALLOWED = "theme_mode IN ('dark', 'light', 'aurora', 'dune')";
    @Override public Integer getChecksum() { return ("theme-check-v1:" + ALLOWED).hashCode(); }
    @Override public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        var constraints = new ArrayList<String>();
        try (var query = connection.prepareStatement("""
                SELECT tc.constraint_name, cc.check_clause
                FROM information_schema.table_constraints tc
                JOIN information_schema.check_constraints cc
                  ON tc.constraint_catalog = cc.constraint_catalog
                 AND tc.constraint_schema = cc.constraint_schema
                 AND tc.constraint_name = cc.constraint_name
                WHERE tc.table_schema = ? AND LOWER(tc.table_name) = 'ff_settings'
                  AND tc.constraint_type = 'CHECK'
                """)) {
            query.setString(1, connection.getSchema());
            try (var rows = query.executeQuery()) {
                while (rows.next()) {
                    String clause = rows.getString(2).toLowerCase(Locale.ROOT);
                    // PostgreSQL 18 also exposes NOT NULL as a CHECK here. Keep it.
                    if (clause.contains("theme_mode") && clause.contains("'dark'") && clause.contains("'light'")) {
                        constraints.add(rows.getString(1));
                    }
                }
            }
        }
        if (constraints.size() != 1) throw new IllegalStateException("Expected exactly one theme_mode check constraint on ff_settings.");
        String name = constraints.getFirst().replace("\"", "\"\"");
        try (var statement = connection.createStatement()) {
            statement.executeUpdate("ALTER TABLE ff_settings DROP CONSTRAINT \"" + name + "\"");
            statement.executeUpdate("ALTER TABLE ff_settings ADD CONSTRAINT ff_settings_theme_mode_check CHECK (" + ALLOWED + ")");
        }
    }
}
