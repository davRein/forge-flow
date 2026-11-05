import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.util.Arrays;
import java.util.Locale;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Interactive local recovery; credentials are never printed or passed as arguments. */
class ResetLocalPassword {
    public static void main(String[] args) throws Exception {
        boolean check = args.length == 1 && args[0].equals("--check-connection");
        var console = System.console();
        if (console == null && !check) throw new IllegalStateException("Bitte direkt in einem interaktiven Terminal starten.");
        // Fail early if the runtime classpath does not contain the PostgreSQL driver.
        Class.forName("org.postgresql.Driver");
        try (var connection = DriverManager.getConnection(System.getenv("FORGEFLOW_RESET_DB_URL"),
                System.getenv("FORGEFLOW_RESET_DB_USER"), System.getenv("FORGEFLOW_RESET_DB_PASSWORD"))) {
            if (check) {
                try (var query = connection.prepareStatement("SELECT count(*) FROM ff_accounts WHERE active = true AND expires_at IS NULL AND portal_only = false");
                        var rows = query.executeQuery()) {
                    rows.next();
                    System.out.println("Datenbankverbindung erfolgreich; aktive Anwendungskonten: " + rows.getLong(1));
                }
                return;
            }
            console.printf("Vorhandene aktive Anwendungskonten:%n");
            try (var query = connection.prepareStatement("SELECT email FROM ff_accounts WHERE active = true AND expires_at IS NULL AND portal_only = false ORDER BY email");
                    var rows = query.executeQuery()) {
                while (rows.next()) console.printf("  %s%n", rows.getString(1));
            }
            var email = console.readLine("E-Mail des Kontos: ");
            if (email == null || email.isBlank()) return;
            email = email.strip().toLowerCase(Locale.ROOT);
            String id;
            long version;
            try (var query = connection.prepareStatement("SELECT id, session_version FROM ff_accounts WHERE email = ? AND active = true AND expires_at IS NULL AND portal_only = false")) {
                query.setString(1, email);
                try (var rows = query.executeQuery()) {
                    if (!rows.next()) throw new IllegalArgumentException("Kein aktives normales Konto mit dieser E-Mail gefunden.");
                    id = rows.getString(1);
                    version = rows.getLong(2);
                }
            }
            char[] input = console.readPassword("Neues Passwort (mindestens 12 Zeichen, maximal 72 UTF-8-Bytes): ");
            if (input == null) return;
            char[] repeated = null;
            String hash;
            try {
                repeated = console.readPassword("Neues Passwort wiederholen: ");
                if (!Arrays.equals(input, repeated)) throw new IllegalArgumentException("Die Passwoerter stimmen nicht ueberein.");
                var password = new String(input);
                if (password.codePointCount(0, password.length()) < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72 || password.indexOf('\0') >= 0)
                    throw new IllegalArgumentException("Das Passwort muss mindestens 12 Zeichen und hoechstens 72 UTF-8-Bytes enthalten.");
                hash = new BCryptPasswordEncoder(12).encode(password);
            } finally {
                Arrays.fill(input, '\0');
                if (repeated != null) Arrays.fill(repeated, '\0');
            }
            try (var update = connection.prepareStatement("UPDATE ff_accounts SET password_hash = ?, session_version = session_version + 1 WHERE id = ? AND session_version = ? AND active = true AND expires_at IS NULL AND portal_only = false")) {
                update.setString(1, hash);
                update.setString(2, id);
                update.setLong(3, version);
                if (update.executeUpdate() != 1) throw new IllegalStateException("Das Konto wurde inzwischen geaendert. Bitte erneut starten.");
            }
            console.printf("Passwort fuer %s neu gesetzt. Bitte im Browser normal anmelden.%n", email);
        } catch (java.sql.SQLException failure) {
            if (failure.getMessage() != null && failure.getMessage().startsWith("No suitable driver"))
                throw new IllegalStateException("Der PostgreSQL-JDBC-Treiber wurde nicht geladen.");
            throw new IllegalStateException("Lokale Datenbankoperation fehlgeschlagen (SQLSTATE " + failure.getSQLState() + "). Es wird kein erfolgreicher Reset bestaetigt.");
        }
    }
}
