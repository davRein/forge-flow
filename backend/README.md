# Spring-Boot-Backend lokal betreiben

Java 21, Spring Boot 4.1.1, Spring Security und Maven 3.9. Anmeldung mit serverseitiger
BCrypt-Prüfung. Der API-Vertrag bleibt in [openapi.json](../docs/openapi.json) definiert.

Für den bereits eingerichteten lokalen PC: [Startkonfiguration, Backup und Wiederherstellung](../docs/local-operation.md).
Einmal `npm.cmd run setup:local`, danach `npm.cmd run start:local`.

## Betriebsarten

| Backend-Profil | Speicherung | Datenbank erforderlich |
| --- | --- | --- |
| `memory` (Vorgabe) | Konto aus Startvariablen; Fachdaten, Dateien und Einstellungen im Arbeitsspeicher | Nein |
| `postgres` | Konten, Fachdaten, Dateien und Einstellungen dauerhaft in PostgreSQL | Ja |

PostgreSQL ist ausgewählt, darf aber später installiert werden. PostgreSQL, Backend und Vite
können direkt auf demselben Windows-PC laufen. Docker ist nicht erforderlich.
Die Anwendung installiert oder startet keinen Datenbankserver.

**Bis zur Datenbankeinrichtung bleibt der Speicher flüchtig.** Ein Backend-Neustart im
`memory`-Profil verwirft Daten, Dateien, Einstellungen und Sitzungen. Auch mit PostgreSQL bleiben
HTTP-Sitzungen flüchtig: Nach einem Backend-Neustart ist eine neue Anmeldung erforderlich,
gespeicherte Fachdaten bleiben erhalten. Es gibt keinen automatischen Import des bisherigen
Arbeitsspeichers oder der Frontend-Beispieldaten.

Die Frontend-Einstellung `VITE_DATA_MODE=api` verbindet das Frontend mit beiden Backend-Profilen.
`VITE_DATA_MODE=local` nutzt nur die flüchtigen Beispiele im Browser.

## Jetzt ohne PostgreSQL starten

Im Projektverzeichnis, nachdem Java und Maven im Terminal eingerichtet sind:

```powershell
mvn.cmd -f backend/pom.xml test
mvn.cmd -f backend/pom.xml package
mvn.cmd -f backend/pom.xml dependency:build-classpath "-Dmdep.outputFile=target/classpath.txt"
java -cp ("backend/target/classes;" + (Get-Content -Raw backend/target/classpath.txt).Trim()) de.forgeflow.auth.HashPassword
```

`HashPassword` liest das Passwort in einem interaktiven Terminal verdeckt und gibt nur den
BCrypt-Hash aus. Mindestens 12 Zeichen, höchstens 72 UTF-8-Bytes; Kostenfaktor 12.
Vorhandene BCrypt-Hashes mit Kostenfaktor 10–15 sind ebenfalls zulässig.

Danach im selben Terminal:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'memory'
$env:AUTH_USER_ID = 'initial-admin'
$env:AUTH_USER_EMAIL = 'admin@example.test'
$env:AUTH_USER_NAME = 'Administrator'
$env:AUTH_PASSWORD_HASH = Read-Host 'Vollständigen erzeugten BCrypt-Hash einfügen'
$env:APP_ORIGIN = 'http://localhost:5173'
$env:COOKIE_SECURE = 'false'
mvn.cmd -f backend/pom.xml spring-boot:run
```

Bei der Abfrage die vollständige Hash-Zeile einfügen, die mit `$2a$`, `$2b$` oder `$2y$`
beginnt. Dort nicht das Klartextpasswort eingeben. Beim Browser-Login wird das ursprüngliche
Passwort verwendet. Keine echten Zugangsdaten oder Hashes in Quellcode, Chats, Logs oder
Dokumentation aufnehmen. Es gibt kein eingebautes Anmeldepasswort.

Der Server lauscht auf `127.0.0.1:3001`.
`http://127.0.0.1:3001/api/v1/health` meldet `storage: "reference"` bzw. `"postgresql"`.
Das ist eine Erreichbarkeitsauskunft, keine laufende Prüfung der Datenbankverbindung.

Im Frontend `frontend/.env.local` (vom Projektverzeichnis aus) setzen und Vite neu starten:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api/v1
```

Vite leitet `/api` zum Backend weiter. `APP_ORIGIN` muss dem Browser-Ursprung einschließlich
Port entsprechen. `COOKIE_SECURE=false` gilt ausschließlich für lokale HTTP-Entwicklung.
Spring liest Prozessvariablen; eine `.env`-Datei wird vom Backend nicht automatisch geladen.
Datenbankzugangsdaten gehören niemals in eine `VITE_*`-Variable.

## Später PostgreSQL auf demselben PC einrichten

1. Eine stabile PostgreSQL-Version installieren, beispielsweise PostgreSQL 18. Der
   [offizielle Windows-Download](https://www.postgresql.org/download/windows/) verweist auf
   einen Installer mit Server, psql und optionalem pgAdmin.
2. Den PostgreSQL-Dienst starten. Für diese lokale Konfiguration Port 5432 verwenden und
   Zugriffe auf den eigenen PC beschränken.
3. Als Datenbankadministrator in **SQL Shell (psql)** verbinden und anlegen:

```sql
CREATE ROLE forgeflow LOGIN;
\password forgeflow
CREATE DATABASE forgeflow OWNER forgeflow;
```

`\password` fragt das Datenbankpasswort verdeckt ab. Es ist ein psql-Befehl und funktioniert
nicht im pgAdmin-Abfragefenster. Die Anwendung verwendet das eigene Konto `forgeflow`,
nicht das administrative `postgres`-Konto.

4. Das Backend stoppen und im Terminal konfigurieren:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'postgres'
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/forgeflow'
$env:DB_USER = 'forgeflow'
$taskDbSecret = Read-Host 'Datenbankpasswort' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $taskDbSecret).Password
mvn.cmd -f backend/pom.xml spring-boot:run
```

Beim ersten Datenbankstart zusätzlich die oben beschriebenen `AUTH_USER_*`-Variablen und
`AUTH_PASSWORD_HASH` setzen. Sie provisionieren das erste Anwendungskonto.
Das Datenbankpasswort und das Login-Passwort der Anwendung sind unabhängig voneinander.

Flyway erstellt die Tabellen beim ersten Start und führt spätere versionierte Migrationen aus.
Hibernate prüft mit `ddl-auto=validate`; es verändert oder löscht das Schema nicht automatisch.
Bei einer nicht erreichbaren oder falsch eingerichteten Datenbank schlägt der Start fehl.
Es gibt keinen stillen Rückfall auf den flüchtigen Speicher.

**Bootstrap:** Ein vorhandenes Konto wird anhand seiner stabilen Kennung erkannt.
Hash und Profil werden beim nächsten Start nicht überschrieben. Eine abweichende E-Mail zur
gleichen Kennung oder eine bereits belegte E-Mail führen zu einem Einrichtungsfehler.
Nach dem ersten erfolgreichen Start dürfen `AUTH_USER_EMAIL` und `AUTH_PASSWORD_HASH`
beide aus der Prozessumgebung entfernt werden. Bestehende Konten werden aus der Datenbank
geladen. Unter Einstellungen lassen sich Profil und Passwort bearbeiten. Der erste
Administrator kann normale Konten anlegen sowie deaktivieren und wieder aktivieren.
Migration V3 ergänzt Kontostatus und Sitzungsversion. Das bisherige Konto mit `AUTH_USER_ID`
(Vorgabe `initial-admin`) erhält einmalig Administratorrechte; die Vergabe wird in
`ff_account_setup` festgehalten und beim nächsten Start nicht wiederholt.

Das Frontend bleibt bei `VITE_DATA_MODE=api`. Vor dem ersten Wechsel wichtige Testdaten
sichern: Der bisherige Arbeitsspeicher wird nicht automatisch übernommen.
Regelmäßige Datenbanksicherungen gehören zur späteren lokalen Einrichtung.

## Speicherung und Konsistenz

- `Accounts` und `WorkspaceStorage` bleiben die Grenzen zu den austauschbaren Adaptern.
- `JpaAccounts` lädt Benutzer und BCrypt-Hashes aus `ff_accounts`.
- `JpaWorkspaceStorage` speichert Fachsammlungen in eigenen Tabellen mit kontobezogenen
  zusammengesetzten Schlüsseln und Fremdschlüsseln. Eigentümer kommen aus der Anmeldung.
- Der Workspace bleibt die API-Transaktionsgrenze. Der Kontodatensatz wird für Laden und
  Schreiben gesperrt; Revision prüfen, Beziehungen ändern, Dateien schreiben und Revision
  bestätigen erfolgen in derselben Transaktion. Veraltete Revisionen liefern weiterhin
  `409`, ohne automatisches Überschreiben oder Zusammenführen.
- Für den lokalen Betrieb liegen Dateibytes in einer PostgreSQL-`bytea`-Spalte, damit
  Metadaten und Inhalte dieselbe Transaktion nutzen. Grenzen: 20 MiB Dateiinhalte je Konto,
  25 MiB je Multipart-Anfrage. Ein späterer Objektspeicher bleibt möglich.
- Sammlungsreihenfolge und numerische Client-Kennungen bleiben erhalten. Sprint-Aufgabenlisten
  und Abschlussmomentaufnahmen liegen als JSON-Text vor, damit historische Aufgaben auch
  nach deren Löschung erhalten bleiben.
- Migration V2 sichert höchstens einen aktiven Sprint je Konto und Projekt durch einen
  bedingten eindeutigen PostgreSQL-Index ab.
- Einstellungen bleiben ein eigener Datensatz je Konto, unabhängig von der Workspace-Revision.
- Datenbank-/Transaktionsfehler werden als `503 / STORAGE_UNAVAILABLE` ohne interne SQL-Details
  gemeldet. Lokale Änderungen bleiben im Frontend für Wiederholen erhalten.
- Dev-Tools-Eingaben und offene Formular-/Artikelentwürfe bleiben im Frontend.

Für größere Datenmengen kann der vollständige Austausch der Fachzeilen durch gezielte
Änderungen ersetzt werden, ohne den API-Vertrag zu ändern.

## Anmeldung und Sitzungen

1. `GET /api/v1/auth/csrf` liefert CSRF und erstellt bei Bedarf eine anonyme Sitzung.
2. `POST /api/v1/auth/login` prüft E-Mail und Passwort mit `BCryptPasswordEncoder.matches`,
   erneuert Sitzungs-ID und CSRF-Token.
3. `GET /api/v1/auth/session` prüft die Sitzung. Ohne gültige Anmeldung antworten geschützte
   Endpunkte mit `401`; der Client entfernt kontobezogene Zustände.
4. `POST /api/v1/auth/logout` invalidiert die Sitzung und löscht das Cookie.

Cookies sind `HttpOnly`, `SameSite=Strict` und standardmäßig `Secure`; acht Stunden
Inaktivitätslimit. Änderungen einschließlich Login und Logout verlangen CSRF und den
konfigurierten Ursprung. Generische Loginfehler, Dummy-Hash-Prüfung und Login-Begrenzung
bleiben bestehen. Keine Passwörter oder Sitzungs-IDs im Browser-Speicher.

Sitzungen verwenden stabile Benutzerkennungen und eine Sitzungsversion. Passwortänderung,
E-Mail-Änderung und Deaktivierung widerrufen bisherige Sitzungen. Aktuelle Passwörter werden
bei Passwort-/E-Mail-Änderungen geprüft; diese Prüfungen sind ebenfalls begrenzt.
Das eigene Profil und die eigenen Fachbestände bleiben getrennt von der Kontoverwaltung.

Mehrere Serverinstanzen, gemeinsame Sitzungen/Login-Begrenzung, feinere Rollen,
Team-Workspaces und Produktivdeployment bleiben offen. Öffentliche Registrierung, E-Mail-
Passwortreset und endgültiges Kontolöschen sind nicht implementiert.
Das Ticketsystem bleibt zurückgestellt.

## Tests ohne installierten PostgreSQL-Server

`mvn.cmd -f backend/pom.xml test` führt den HTTP-Vertrag mit Referenzspeicher und JPA-Adapter
aus. Die Datenbanktests verwenden H2 unter `backend/target/test-databases/`. H2 ist nur eine
Testabhängigkeit, kein Ersatz für PostgreSQL im Anwendungsbetrieb.

Geprüft werden auch Kontotrennung, Dateierhalt/-löschung, Reihenfolge, Rollback nach einem
Datenbankfehler mitten in der Transaktion, parallele Schreiber, Fremdschlüssel, Bootstrap
und das Lesen gespeicherter Daten durch eine neue Backend-Instanz.
H2 prüft nur V1. Der PostgreSQL-spezifische V2-Index und sein Test bleiben ohne PostgreSQL offen;
dieser eine Test wird übersprungen.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-backend.ps1` richtet bei
Bedarf checksummengeprüftes Java/Maven unter `node_modules/.tmp/backend-tools` ein.
Es installiert weder PostgreSQL noch Programme systemweit.

## Später gegen echtes PostgreSQL testen

Eine **separate Testdatenbank** anlegen, beispielsweise `forgeflow_test`. Niemals die
Anwendungsdatenbank verwenden: Tests schreiben und löschen Fachdaten und verändern
vorübergehend eine Tabellenbedingung.

```powershell
$env:TEST_POSTGRES_URL = 'jdbc:postgresql://127.0.0.1:5432/forgeflow_test'
$env:TEST_POSTGRES_USER = 'forgeflow'
$taskTestDbSecret = Read-Host 'Passwort des Testdatenbankkontos' -AsSecureString
$env:TEST_POSTGRES_PASSWORD = [System.Net.NetworkCredential]::new('', $taskTestDbSecret).Password
mvn.cmd -f backend/pom.xml test
```

Dann läuft dieselbe Suite einschließlich V1, V2 und Index-Test gegen PostgreSQL.
Die `TEST_POSTGRES_*`-Variablen anschließend entfernen, wenn wieder H2 verwendet werden soll.
Der lokale PostgreSQL-18.6-Betrieb und der Erhalt von Kunden/Projekten nach Backend-Neustart
wurden vom Anwender bestätigt. Auch die automatisierte Suite gegen die separate Datenbank
`forgeflow_test` wurde vom Anwender mit 23 erfolgreichen Tests, ohne Fehler und ohne übersprungene
Tests bestätigt. Dieser PostgreSQL-Lauf wurde im Terminal des Anwenders ausgeführt.
