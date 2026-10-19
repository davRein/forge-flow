# Dev Suite – Installation und Einrichtung

Die folgenden Schritte gelten für den lokalen Betrieb unter Windows mit PowerShell.
Alle Projektbefehle im Hauptordner `D:\Projects\Vite\dev-suite` ausführen.
Bei einer bereits eingerichteten Installation die entsprechenden Schritte überspringen.

## 1. Voraussetzungen

- Node.js 22 mit npm.
- Java JDK 21; `JAVA_HOME` muss auf das JDK zeigen.
- Maven 3.9; Java und Maven müssen im `PATH` verfügbar sein.
- PostgreSQL 18 mit Server und Kommandozeilenwerkzeugen (`psql`, `pg_dump`, `pg_restore`).

Installation im Terminal prüfen:

```powershell
node --version
npm.cmd --version
java -version
mvn.cmd -version
```

## 2. PostgreSQL einrichten

Den [PostgreSQL-Windows-Installer](https://www.postgresql.org/download/windows/) verwenden.
Server und Command Line Tools auswählen; pgAdmin ist optional. In Stack Builder müssen
für diese Anwendung keine weiteren Pakete installiert werden. Den Port auf `5432` belassen,
ein Passwort für das Administratorkonto `postgres` vergeben und den PostgreSQL-Dienst starten.

In PowerShell den tatsächlichen Installationspfad setzen und als Administrator verbinden:

```powershell
$taskPgBin = 'D:\Program Files\PostgreSQL\18\bin' # ggf. anpassen
& "$taskPgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
```

In **psql** ein eigenes Datenbankkonto und die Datenbank anlegen:

```sql
CREATE ROLE forgeflow LOGIN;
\password forgeflow
CREATE DATABASE forgeflow OWNER forgeflow;
\q
```

`\password forgeflow` fragt das neue Datenbankpasswort verdeckt ab. Es ist ein psql-Befehl,
kein SQL für das pgAdmin-Abfragefenster. Die Anwendung verwendet das Konto `forgeflow`.

Verbindung mit dessen Passwort prüfen:

```powershell
& "$taskPgBin\psql.exe" -h 127.0.0.1 -p 5432 -U forgeflow -d forgeflow -W -c 'SELECT current_database(), current_user;'
```

Beide Werte müssen `forgeflow` sein. Tabellen und Migrationen richtet das Backend beim
Start automatisch ein; sie müssen nicht von Hand angelegt werden.

## 3. Projekt vorbereiten

```powershell
npm.cmd ci
```

Die Datei `frontend/.env.local` mit folgendem Inhalt anlegen bzw. anpassen:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api/v1
```

Datenbankpasswörter und Passwort-Hashes gehören nicht in diese Datei.

## 4. Erstes Anwendungskonto einrichten

Nur bei einer neuen Anwendungsdatenbank erforderlich. Backend kompilieren und einen
BCrypt-Hash für das gewünschte Anmeldepasswort erzeugen:

```powershell
mvn.cmd -f backend/pom.xml compile dependency:build-classpath "-Dmdep.outputFile=target/classpath.txt"
java -cp ("backend/target/classes;" + (Get-Content -Raw backend/target/classpath.txt).Trim()) de.forgeflow.auth.HashPassword
```

Das Passwort muss mindestens 12 Zeichen haben und darf höchstens 72 UTF-8-Bytes belegen.
Danach im selben Terminal konfigurieren:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'postgres'
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/forgeflow'
$env:DB_USER = 'forgeflow'
$taskDbSecret = Read-Host 'Datenbankpasswort für forgeflow' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $taskDbSecret).Password
$env:AUTH_USER_ID = 'initial-admin'
$env:AUTH_USER_EMAIL = Read-Host 'E-Mail für das Anwendungskonto'
$env:AUTH_USER_NAME = 'Administrator'
$env:AUTH_PASSWORD_HASH = Read-Host 'Vollständigen erzeugten BCrypt-Hash einfügen'
$env:APP_ORIGIN = 'http://localhost:5173'
$env:COOKIE_SECURE = 'false'
mvn.cmd -f backend/pom.xml spring-boot:run
```

Bei der Hash-Abfrage die erzeugte Zeile mit `$2a$`, `$2b$` oder `$2y$` einfügen.
Beim späteren Login das ursprüngliche Passwort eingeben. Datenbankpasswort und
Anmeldepasswort der Anwendung sind voneinander unabhängig; es gibt kein Standardpasswort.

Nach erfolgreichem Start das Backend mit **Strg+C** beenden.

## 5. Lokalen Start einrichten

```powershell
npm.cmd run setup:local
npm.cmd run start:local
```

Das Setup prüft die Datenbankverbindung und speichert das Verbindungspasswort unter
`backend/.local/` verschlüsselt für denselben Windows-Benutzer auf demselben PC.
Bei abweichendem PostgreSQL-Pfad kann dieser explizit angegeben werden:
`npm.cmd run setup:local -- -PostgresBin 'D:\Program Files\PostgreSQL\18\bin'`.

Die Anwendung unter **http://localhost:5173** öffnen. Das Backend nutzt Port `3001`;
beide Ports müssen vor dem gemeinsamen Start frei sein. Mit **Strg+C** werden beide beendet.
Künftig genügt `npm.cmd run start:local`. Nach Datenbankpasswortänderungen das Setup wiederholen.

`COOKIE_SECURE=false` gilt für lokale HTTP-Entwicklung. Die Startskripte sind für Windows;
für direkte Backend-Konfiguration siehe [backend/README.md](backend/README.md).
Details zur lokalen Konfiguration und Sicherung: [docs/local-operation.md](docs/local-operation.md).
