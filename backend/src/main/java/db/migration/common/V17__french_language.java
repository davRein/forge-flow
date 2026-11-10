package db.migration.common;

import java.util.ArrayList;
import java.util.Locale;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/** Extend installed language constraints while preserving existing preferences and chats. */
public class V17__french_language extends BaseJavaMigration {
    private static final String ALLOWED = "language IN ('de', 'en', 'fr')";
    @Override public Integer getChecksum() { return ("language-check-v1:" + ALLOWED).hashCode(); }
    @Override public void migrate(Context context) throws Exception {
        for (String table : java.util.List.of("ff_settings", "ff_ai_conversations")) {
            var connection = context.getConnection();
            var constraints = new ArrayList<String>();
            try (var query = connection.prepareStatement("""
                    SELECT tc.constraint_name, cc.check_clause
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.check_constraints cc
                      ON tc.constraint_catalog = cc.constraint_catalog
                     AND tc.constraint_schema = cc.constraint_schema
                     AND tc.constraint_name = cc.constraint_name
                    WHERE tc.table_schema = ? AND LOWER(tc.table_name) = ?
                      AND tc.constraint_type = 'CHECK'
                    """)) {
                query.setString(1, connection.getSchema());
                query.setString(2, table);
                try (var rows = query.executeQuery()) {
                    while (rows.next()) {
                        String clause = rows.getString(2).toLowerCase(Locale.ROOT);
                        if (clause.contains("language") && clause.contains("'de'") && clause.contains("'en'"))
                            constraints.add(rows.getString(1));
                    }
                }
            }
            if (constraints.size() != 1) throw new IllegalStateException("Expected exactly one language check constraint on " + table);
            String name = constraints.getFirst().replace("\"", "\"\"");
            try (var statement = connection.createStatement()) {
                statement.execute("ALTER TABLE " + table + " DROP CONSTRAINT \"" + name + "\"");
                statement.execute("ALTER TABLE " + table + " ADD CONSTRAINT " + table + "_language_check CHECK (" + ALLOWED + ")");
            }
        }
    }
}
