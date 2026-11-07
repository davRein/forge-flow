package de.forgeflow;

import java.sql.DriverManager;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AccountAccessMigrationTest {
    @Test void preservesLegacyAccountsAndProvisioningNeverResetsAnExistingAdministrator() throws Exception {
        String url="jdbc:h2:mem:account_access_"+UUID.randomUUID()+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        var config=Flyway.configure().dataSource(url,"sa","").locations("classpath:db/migration/common");
        config.target("19").load().migrate();
        try(var connection=DriverManager.getConnection(url,"sa","");var statement=connection.createStatement()) { statement.executeUpdate("INSERT INTO ff_accounts(id,email,name,password_hash,administrator,active,session_version,portal_only) VALUES ('legacy-user','legacy@example.test','Legacy','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',false,true,7,false)"); }
        config.target("20").load().migrate();
        try(var connection=DriverManager.getConnection(url,"sa","");var statement=connection.createStatement();var row=statement.executeQuery("SELECT username,allowed_apps,password_hash,session_version FROM ff_accounts WHERE id='legacy-user'")) {
            assertThat(row.next()).isTrue();assertThat(row.getString(1)).startsWith("u_");assertThat(row.getString(2)).contains("requestLab","dataScout");assertThat(row.getString(3)).isEqualTo("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");assertThat(row.getLong(4)).isEqualTo(7);
            String hash=new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(10).encode("Synthetic-Admin-12345");
            assertThatThrownBy(() -> de.forgeflow.admin.SetupAdministrator.insert(connection,"legacy@example.test",hash)).isInstanceOf(IllegalArgumentException.class);
            assertThat(de.forgeflow.admin.SetupAdministrator.insert(connection,"operator@example.test",hash)).isTrue();
            assertThat(de.forgeflow.admin.SetupAdministrator.insert(connection,"other@example.test",hash)).isFalse();
            try(var admin=connection.createStatement().executeQuery("SELECT administrator,active,name,password_hash FROM ff_accounts WHERE username='administrator'")) { assertThat(admin.next()).isTrue();assertThat(admin.getBoolean(1)).isTrue();assertThat(admin.getBoolean(2)).isTrue();assertThat(admin.getString(3)).isEqualTo("Administrator");assertThat(admin.getString(4)).isEqualTo(hash); }
        }
    }
}
