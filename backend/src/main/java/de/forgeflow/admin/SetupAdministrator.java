package de.forgeflow.admin;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Arrays;
import java.util.UUID;
import de.forgeflow.auth.AccountRules;
import de.forgeflow.auth.AppPermissions;
import org.flywaydb.core.Flyway;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import tools.jackson.databind.json.JsonMapper;

/** Explicit operator command; no built-in password, account takeover or public bootstrap endpoint. */
public final class SetupAdministrator {
    public static boolean insert(Connection connection,String email,String hash) throws Exception {
        try(var query=connection.prepareStatement("SELECT administrator,active,portal_only,expires_at FROM ff_accounts WHERE username='administrator'" );var rows=query.executeQuery()) {
            if(rows.next()) {
                if(!rows.getBoolean(1)||!rows.getBoolean(2)||rows.getBoolean(3)||rows.getTimestamp(4)!=null) throw new IllegalStateException("Der reservierte Benutzername ist bereits durch ein anderes Konto belegt.");
                return false;
            }
        }
        String normalized=AccountRules.email(email);
        if(normalized.length()>254||!normalized.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw new IllegalArgumentException("Bitte eine gueltige E-Mail-Adresse angeben.");
        if(!hash.matches("\\$2[aby]\\$(1[0-5])\\$[./A-Za-z0-9]{53}")) throw new IllegalArgumentException("Ungueltiger Passwort-Hash.");
        try(var query=connection.prepareStatement("SELECT id FROM ff_accounts WHERE email=?")) { query.setString(1,normalized);try(var rows=query.executeQuery()) { if(rows.next()) throw new IllegalArgumentException("Diese E-Mail gehoert bereits zu einem Konto; kein Konto wurde ueberschrieben."); } }
        try(var update=connection.prepareStatement("INSERT INTO ff_accounts(id,email,name,password_hash,administrator,active,session_version,portal_only,expires_at,username,allowed_apps) VALUES (?,?,?,?,true,true,0,false,NULL,'administrator',?)")) {
            update.setString(1,UUID.randomUUID().toString());update.setString(2,normalized);update.setString(3,"Administrator");update.setString(4,hash);update.setString(5,JsonMapper.builder().build().writeValueAsString(AppPermissions.ALL));update.executeUpdate();
        }
        try(var update=connection.prepareStatement("UPDATE ff_account_setup SET administrator_assigned=true WHERE id=1")) { update.executeUpdate(); }
        return true;
    }
    private static void status(String value) {
        String file=System.getenv("FORGEFLOW_ADMIN_STATUS_FILE");
        if(file==null||file.isBlank()) return;
        try { java.nio.file.Files.writeString(java.nio.file.Path.of(file), "{\"status\":\""+value+"\"}"); }
        catch(java.io.IOException failure) { System.err.println("Statusdatei konnte nicht geschrieben werden."); }
    }
    public static void main(String[] args) {
        status("waiting");
        var console=System.console();
        if(console==null) { status("failed"); System.err.println("Bitte direkt in einem interaktiven Terminal starten.");System.exit(1);return; }
        String url=System.getenv("FORGEFLOW_ADMIN_DB_URL"),user=System.getenv("FORGEFLOW_ADMIN_DB_USER"),password=System.getenv("FORGEFLOW_ADMIN_DB_PASSWORD");
        try {
            if(url==null||!url.matches("jdbc:postgresql://(?:127\\.0\\.0\\.1|localhost):[0-9]+/[A-Za-z0-9_]+")) throw new IllegalArgumentException("Nur eine explizite lokale PostgreSQL-Verbindung ist erlaubt.");
            Flyway.configure().dataSource(url,user,password).locations("classpath:db/migration/common", "classpath:db/migration/postgresql").load().migrate();
            try(var connection=DriverManager.getConnection(url,user,password)) {
                connection.setAutoCommit(false);
                try(var lock=connection.createStatement()) { lock.execute("SELECT pg_advisory_xact_lock(59284621)"); }
                try(var query=connection.prepareStatement("SELECT administrator,active,portal_only,expires_at FROM ff_accounts WHERE username='administrator'");var rows=query.executeQuery()) {
                    if(rows.next()) { if(!rows.getBoolean(1)||!rows.getBoolean(2)||rows.getBoolean(3)||rows.getTimestamp(4)!=null) throw new IllegalStateException("Benutzername ist bereits belegt.");status("existing");console.printf("Das aktive Konto Administrator existiert bereits. Kein Passwort wurde geaendert.%n");return; }
                }
                String email=console.readLine("E-Mail fuer das neue Konto Administrator: ");
                if(email==null||email.isBlank()) { status("cancelled");console.printf("Abgebrochen. Kein Konto angelegt.%n");return; }
                char[] input=console.readPassword("Passwort (mindestens 12 Zeichen): "),repeated=null;
                if(input==null)return;
                String hash;
                try { repeated=console.readPassword("Passwort wiederholen: ");if(!Arrays.equals(input,repeated))throw new IllegalArgumentException("Die Passwoerter stimmen nicht ueberein.");String plain=new String(input);AccountRules.password(plain);hash=new BCryptPasswordEncoder(12).encode(plain); }
                finally { Arrays.fill(input,'\0');if(repeated!=null)Arrays.fill(repeated,'\0'); }
                if(insert(connection,email,hash)) { connection.commit();status("created");console.printf("Konto Administrator mit allen App-Rechten angelegt. Anmeldung mit Administrator oder E-Mail moeglich.%n"); }
            }
        } catch(Exception failure) { status("failed");System.err.println("Administrator konnte nicht eingerichtet werden. Bestehende Konten und Passwoerter wurden nicht ersetzt. Bitte Eingaben und Datenbankverbindung pruefen.");System.exit(1); }
    }
}
