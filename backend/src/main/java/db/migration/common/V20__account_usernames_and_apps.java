package db.migration.common;

import java.util.ArrayList;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import de.forgeflow.auth.AppPermissions;
import tools.jackson.databind.json.JsonMapper;

/** Preserve existing identities/passwords and grant the previous access to existing users. */
public class V20__account_usernames_and_apps extends BaseJavaMigration {
    @Override public Integer getChecksum() { return "account-usernames-apps-v1".hashCode(); }
    @Override public void migrate(Context context) throws Exception {
        var connection = context.getConnection();
        try (var statement=connection.createStatement()) {
            statement.execute("ALTER TABLE ff_accounts ADD COLUMN username VARCHAR(64)");
            statement.execute("ALTER TABLE ff_accounts ADD COLUMN allowed_apps TEXT");
        }
        var ids=new ArrayList<String>();
        try(var query=connection.createStatement();var rows=query.executeQuery("SELECT id FROM ff_accounts")) { while(rows.next()) ids.add(rows.getString(1)); }
        String apps=JsonMapper.builder().build().writeValueAsString(java.util.List.of("projectManager", "git", "wiki", "devTools", "timeTracker", "business", "cloud", "knowledgeHub", "flowPilot", "pulseWatch", "dataScout", "requestLab"));
        for(String id:ids) try(var update=connection.prepareStatement("UPDATE ff_accounts SET username=?,allowed_apps=? WHERE id=?")) {
            update.setString(1,AppPermissions.legacyUsername(id));update.setString(2,apps);update.setString(3,id);update.executeUpdate();
        }
        try(var statement=connection.createStatement()) {
            statement.execute("ALTER TABLE ff_accounts ADD CONSTRAINT ff_accounts_username_lower CHECK (username=LOWER(username))");
            statement.execute("CREATE UNIQUE INDEX ff_accounts_username_unique ON ff_accounts(username)");
        }
    }
}
