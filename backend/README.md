# Spring-Boot-Backend vorbereiten

Das Gerüst verwendet Java 21, Spring Boot 4.1.1 und Spring Security. Es stellt den Vertrag aus
[openapi.json](../docs/openapi.json) bereit. Benutzer werden über BCrypt geprüft; Fachdaten und
Einstellungen werden je angemeldetem Konto getrennt. Eine Datenbank ist noch nicht angebunden.
`MemoryWorkspaceStorage` und `ConfiguredAccounts` sind austauschbare Referenzadapter. Daten,
Dateiinhalte und Sitzungen gehen beim Backend-Neustart verloren.

## Starten

Java 21 und Maven 3.9 werden benötigt. Vom Projektverzeichnis aus:

```powershell
mvn -f backend/pom.xml test
mvn -f backend/pom.xml package
mvn -f backend/pom.xml dependency:build-classpath -Dmdep.outputFile=target/classpath.txt
java -cp ("backend/target/classes;" + (Get-Content -Raw backend/target/classpath.txt)) de.forgeflow.auth.HashPassword
```

`HashPassword` liest das Passwort verdeckt aus dem Terminal und gibt nur den Hash aus.
Es verlangt mindestens 12 Zeichen und höchstens 72 UTF-8-Bytes. Der Kostenfaktor ist 12.
Ein vorhandener BCrypt-Hash mit Kostenfaktor 10–15 kann ebenfalls verwendet werden.

Danach im selben Terminal konfigurieren:

```powershell
$env:AUTH_USER_ID = 'initial-admin'
$env:AUTH_USER_EMAIL = 'admin@example.test'
$env:AUTH_USER_NAME = 'Administrator'
$env:AUTH_PASSWORD_HASH = '<hier den erzeugten BCrypt-Hash einsetzen>'
$env:APP_ORIGIN = 'http://localhost:5173'
$env:COOKIE_SECURE = 'false' # ausschließlich für lokale Entwicklung über HTTP
mvn -f backend/pom.xml spring-boot:run
```

Der Server lauscht auf `127.0.0.1:3001`. Ohne konfigurierte E-Mail und gültigen Hash schlägt der
Start fehl. Es gibt kein fest eingebautes Anmeldepasswort. Spring Boot liest die Werte aus der
Prozessumgebung; eine `.env`-Datei wird hier nicht automatisch eingelesen.

Im Frontend `.env.example` als `.env.local` kopieren, `VITE_DATA_MODE=api` setzen und Vite
neu starten. Vite leitet `/api` zum Backend weiter. Für den Produktivbetrieb muss der Webserver
dieselbe Weiterleitung unter HTTPS bereitstellen. `COOKIE_SECURE` bleibt dort auf `true`.
`APP_ORIGIN` muss dem tatsächlichen Browser-Ursprung einschließlich Port entsprechen.
Die Backend-Adresse wird nicht als fremde Domain im Frontend hinterlegt.

## Anmeldung und Zuständigkeiten

1. `GET /api/v1/auth/csrf` erstellt bei Bedarf eine anonyme HTTP-Sitzung und liefert den CSRF-Token.
2. `POST /api/v1/auth/login` erhält E-Mail und unverändertes Passwort als JSON mit CSRF-Header.
   Der Server prüft mit `BCryptPasswordEncoder.matches`, erneuert Sitzungs-ID und CSRF-Token und
   speichert den SecurityContext. Der Browser erhält nur Benutzerprofil und CSRF-Token.
3. `GET /api/v1/auth/session` prüft die Sitzung. Geschützte Endpunkte antworten ohne gültige
   Anmeldung mit `401`. Der Client entfernt daraufhin kontobezogene Zustände.
4. `POST /api/v1/auth/logout` invalidiert die HTTP-Sitzung und löscht das Cookie.

Das Cookie ist `HttpOnly`, `SameSite=Strict` und standardmäßig `Secure`. Die Sitzungsdauer ist
acht Stunden ohne Aktivität. Alle Schreibzugriffe, einschließlich Login und Logout, benötigen
CSRF und den konfigurierten Ursprung. Passwörter und Sitzungs-IDs werden nicht im Browser-Speicher
abgelegt. Falsche Anmeldedaten erhalten dieselbe Fehlermeldung; ein Dummy-Hash wird auch für
unbekannte Konten geprüft. Anmeldeversuche werden im Referenzserver pro IP und IP/E-Mail begrenzt.
Vor mehreren Serverinstanzen muss diese Begrenzung in einen gemeinsamen Speicher verlegt werden.

Die BCrypt-Grenze gilt für **Bytes**, nicht Zeichen. Sie wird vor dem Vergleich geprüft, damit
unterschiedliche lange Passwörter nicht durch Abschneiden identisch behandelt werden.
Siehe [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
und [Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html).

## Datenbank später anschließen

- `Accounts.findByEmail` durch ein Benutzer-Repository ersetzen. In der Datenbank nur den
  BCrypt-Hash, keine Klartextpasswörter speichern; das Benutzerprofil hat eine stabile Kennung.
- `WorkspaceStorage` mit Spring Data/JPA implementieren. Die Kontokennung wird aus der geprüften
  Anmeldung übernommen. Nutzereingaben dürfen den Eigentümer nicht festlegen.
- Revision prüfen, Fachdaten schreiben und Dateiverweise übernehmen in **einer Transaktion**.
  Ein veraltetes `If-Match` muss weiterhin `409` liefern. Keine automatische Zusammenführung,
  kein Überschreiben bei Konflikten. Datenbank-Constraints müssen Kennungen und Beziehungen absichern.
- Binärdateien in einen Blob-/Objektspeicher auslagern. Erst nach vollständigem Upload referenzieren;
  bei Fehlern darf keine Teiländerung sichtbar werden. Der Referenzadapter begrenzt den gesamten
  Dateiinhalt pro Benutzer auf 20 MiB und eine HTTP-Anfrage auf 25 MiB.
- Einstellungen bleiben ein eigener Datensatz pro Benutzer, getrennt von den Fachdaten.
- Bei mehreren Instanzen Spring Session mit gemeinsamem Speicher und gemeinsame Login-Begrenzung
  einsetzen. Datenbank, Rollenverwaltung und gemeinsame Team-Workspaces sind noch nicht umgesetzt.

Der aktuelle Schreibvertrag überträgt einen vollständigen Workspace als Transaktion, damit etwa
Projektlöschung, Epic-Zuordnung und Kategorieauflösung zusammen gespeichert werden. Die positiven
numerischen Kennungen werden derzeit im geladenen Client-Zustand vergeben; Revisionen verhindern
Kollisionen paralleler Sitzungen. Eine spätere Vergabe durch die Datenbank wird hinter dem
Repository-Vertrag umgesetzt. Dev-Tools-Eingaben und offene Formularentwürfe bleiben lokal.

## Verifikation ohne Systeminstallation unter Windows

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-backend.ps1` lädt bei Bedarf
Temurin Java 21 und Maven in `node_modules/.tmp/backend-tools`, prüft die Archiv-Prüfsummen und
führt die Spring-Tests aus. System-PATH und installierte Programme werden nicht verändert.
