# Projektübergabe: Dev Suite / ForgeFlow

Stand: 19. Oktober 2026. Diese Datei fasst die bisherige Arbeit für einen neuen Codex-Chat zusammen.
Vor Änderungen immer den aktuellen Quellcode prüfen. Die hier genannten Testergebnisse stammen
aus dem letzten abgeschlossenen Implementierungsdurchlauf und sind keine erneute Prüfung dieses
Dokumentationsschritts.

## Projekt und Entscheidungen des Anwenders

- Hauptverzeichnis: `D:\Projects\Vite\dev-suite`. Frontend und Backend bleiben im selben Repository.
- Frontend unter `frontend/`, Java-Backend unter `backend/`. Der Hauptordner verwaltet
  den npm-Workspace samt gemeinsamer Lockdatei/Abhängigkeiten sowie die Betriebsskripte.
  Bisherige npm-Befehle funktionieren weiterhin im Hauptordner; Frontend-Befehle auch in `frontend/`.
  Vite lädt `frontend/.env.local`; Build-Ausgabe ist `frontend/dist/`.
- Frontend: React 18, TypeScript im Strict Mode, Vite 5, styled-components, React Router 7.
- Backend: **Java / Spring Boot**, Entwicklung in IntelliJ. Ein begonnenes Node-Backend wurde
  vollständig durch das Spring-Gerüst ersetzt; es gibt keine bcrypt-Node-Abhängigkeit im Frontend.
- Zuerst sollten die Frontend-Features fertig werden; anschließend wurde ausdrücklich die
  Vorbereitung des gesamten Projekts für ein Backend einschließlich Login und BCrypt beauftragt.
- **Ticketsystem vorerst überspringen.** Der Tickets-Tab ist weiterhin ein Platzhalter.
- Einstellungen werden pro Benutzer dauerhaft in PostgreSQL gespeichert.
- **PostgreSQL 18.6 ist lokal installiert und angebunden.** Vorerst alles auf demselben
  Windows-PC, ohne Docker-Pflicht. Produktives Deployment bleibt offen.
- Benutzeroberfläche und Kommunikation überwiegend auf Deutsch. Bestehende Funktionen erhalten.

## Bereits implementierte Frontend-Funktionen

| Bereich | Vorhanden |
| --- | --- |
| Navigation | Hash-Routen, Modulwechsel, gültige Direktlinks, Weiterleitung ungültiger Seiten |
| Projekte / Kunden | Dashboard, Listen, Suche, Anlegen, Bearbeiten, Löschen mit Beziehungsschutz und Projektkaskade |
| Aufgaben | CRUD, Liste, Kanban mit Drag-and-drop, Details, Priorität, Status, Aktivitäten und Epic-/Sprint-Anzeige |
| Epics | CRUD, Aufgabenzuordnung innerhalb desselben Projekts, Suche, Fortschritt und Statusfilter |
| Sprints | Planung, Backlog, Aufgabenzuordnung, maximal ein aktiver Sprint pro Projekt, Start/Abschluss und historische Momentaufnahme |
| Dateien | Mehrfachauswahl, Drag-and-drop, Suche/Filter/Sortierung, Umbenennen, Download, Entfernen und Duplikatprüfung |
| Einstellungen | Hell/dunkel, Standard-Projektansicht, Standard-Aufgabenpriorität, Zurücksetzen, Lade-/Speicherfehler und Wiederholen |
| Wiki | Artikel-/Kategorien-CRUD, Suche, Filter, Sortierung, grundlegende Markdown-Vorschau, URL-Parameter und lokale Artikelentwürfe |
| Dev Tools | JSON formatieren/komprimieren/validieren, HTTP-Anfragen mit Abbruch/Zeitlimit, Rechner mit Verlauf, Base64/URL/Einheiten/Zahlensysteme |

JSON-Formatierung erhält große Zahlen und doppelte Schlüssel. Markdown stellt HTML als Text dar.
Abgeschlossene Sprint-Ergebnisse bleiben bei späteren Aufgabenänderungen unverändert. Offene
Aufgaben gehen beim Sprint-Abschluss ins Backlog zurück. Dateiaktionen erhalten Dateibytes und
geben temporäre Download-URLs wieder frei. Der REST-Tester ist ein separates Werkzeug für frei
eingegebene Zieladressen und unterliegt Browser-CORS; er sendet keine Cookies.

## Backend-Anbindung und Architektur

### Zwei Betriebsarten

- `VITE_DATA_MODE=local` ist die Vorgabe: anonyme Beispieldaten, kein Backend nötig, keine
  Authentifizierungsanfragen. Beim Neuladen werden lokale Daten zurückgesetzt.
- `VITE_DATA_MODE=api`: Login und verifizierte Cookie-Sitzung sind erforderlich. Fachdaten,
  Einstellungen und Dateien werden über das Backend geladen und gespeichert. Fehler führen
  nicht zu einem Rückfall auf Beispieldaten. API-Basis: `VITE_API_BASE_URL=/api/v1`.
- Vite leitet `/api` nach `http://127.0.0.1:3001` weiter. Nach Änderung der Vite-Umgebung neu starten.
- Dev-Tools-Eingaben und offene Formular-/Artikelentwürfe werden nicht ans Backend übertragen.

### Frontend-Datenfluss

- `frontend/src/App.tsx`: Auth-Gate, Themes, Einstellungen, WorkspaceProvider und Hash-Navigation.
- `frontend/src/services/api/apiClient.ts`: zentrale JSON-/Multipart-/Blob-Anfragen, Cookie-/CSRF-Behandlung,
  30-Sekunden-Zeitlimit, Abbruch, Fehler und Schutz vor Operationen aus alten Sitzungen.
- `frontend/src/services/auth/authStore.ts`: CSRF vor Login, Sitzungsprüfung, Login/Logout und Schutz
  vor verspäteten Antworten. Ein Sitzungswechsel setzt kontobezogene UI-Zustände zurück.
- `frontend/src/services/workspace/workspaceTypes.ts`: gemeinsame Fachtypen und Repository-Schnittstelle.
- `workspaceSchema.ts`: Laufzeitprüfung der vom Backend geladenen Daten.
- `workspaceRepository.ts`: lokaler Adapter und API-Adapter einschließlich Dateiübertragung.
- `workspaceStore.ts`: gemeinsamer Fachzustand, Bündelung zusammengehöriger Änderungen,
  geordnetes Speichern, Wiederholen und Versionskonflikte.
- `frontend/src/hooks/workspaceContext.ts`: bestehende Fach-Hooks verwenden `useWorkspaceField`.
  Projekte, Kunden, Aufgaben, Epics, Sprints, Dateien, Aktivitäten und Wiki liegen dadurch nicht
  mehr in voneinander unabhängigen, frisch initialisierten Hook-Datenbeständen.
- `frontend/src/services/settings/`: eigener asynchroner, versionierter Speicher pro Benutzer.
  `apiSettingsRepository.ts` verwendet `/me/settings`; Einstellungen sind vom Workspace getrennt.

### HTTP-Vertrag

Basis für alle folgenden Pfade: `/api/v1`. Details in [backend-api.md](backend-api.md),
vollständiger maschinenlesbarer Vertrag in [openapi.json](openapi.json).

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/health` | Erreichbarkeit |
| GET | `/auth/csrf` | CSRF-Token und bei Bedarf anonyme Sitzung |
| POST | `/auth/login` | E-Mail/Passwort prüfen, Sitzung und CSRF erneuern |
| GET | `/auth/session` | Anmeldung prüfen, Profil und CSRF liefern |
| POST | `/auth/logout` | Sitzung invalidieren und Cookie löschen |
| GET / PUT | `/me/settings` | Einstellungen des angemeldeten Kontos |
| GET / PUT | `/workspace` | Gesamten Workspace laden / atomar übernehmen |
| GET | `/projects/{projectId}/files/{fileId}/content` | Geschützten Dateiinhalt laden |

Der Schreibvertrag ist aktuell **eine Workspace-Transaktion**, keine Sammlung separater
CRUD-Endpunkte je Fachentität. `PUT /workspace` sendet `multipart/form-data` mit dem JSON-Feld
`manifest` und neuen Binärdateien als `file-{id}`. `If-Match` enthält die zuletzt bestätigte
Revision in doppelten Anführungszeichen. Projektlöschung und verknüpfte Zuordnungsänderungen
werden dadurch gemeinsam übernommen. Unveränderte Dateiinhalte werden nicht erneut hochgeladen.

Ein veralteter Stand ergibt `409`; kein automatisches Überschreiben oder Zusammenführen.
Lokale Änderungen bleiben bei Speicherfehlern erhalten. Das Laden des Serverstands nach einem
Konflikt verlangt das ausdrückliche Verwerfen lokaler Änderungen. Numerische Kennungen werden
derzeit im geladenen Client-Zustand vergeben; die zukünftige Datenbankvergabe ist noch offen.

### Java-Gerüst

Unter `backend/`: eigenständiges Maven-Projekt, **Java 21 / Spring Boot 4.1.1 / Spring Security**.
Startklasse: `de.forgeflow.BackendApplication`. Einrichtung: [backend/README.md](../backend/README.md).

- `auth/Accounts` und `ConfiguredAccounts`: Benutzerzugriff; initial ein konfiguriertes Konto,
  weitere Konten über die Administrationsoberfläche. Im Memory-Profil bleiben Änderungen flüchtig.
- `auth/AuthController`: `BCryptPasswordEncoder.matches`, generische Loginfehler, Dummy-Hash für
  unbekannte Benutzer, Login-Begrenzung, Wechsel der Sitzungs-ID und des CSRF-Tokens.
- `auth/SecurityConfig`: HttpOnly-Sitzungscookie, CSRF, Ursprungsprüfung, geschützte Endpunkte,
  Logout und strukturierte Authentifizierungsfehler. Keine Speicherung von Sitzungstokens in
  Local Storage oder Session Storage.
- BCrypt-Kostenfaktor für neue Hashes: 12. Grenze: 72 UTF-8-Bytes. `HashPassword` liest ein neues
  Passwort verdeckt aus dem Terminal. Es gibt kein eingebautes Anmeldepasswort.
- `workspace/WorkspaceStorage`: austauschbarer Vertrag für Fachzustand, Dateien und Einstellungen.
- `MemoryWorkspaceStorage`: kontogetrennter Referenzadapter ohne Datenbank; Commit und
  Revisionsprüfung werden zusammen ausgeführt.
- `WorkspaceDtos`, `WorkspaceValidation`, `WorkspaceController`: DTOs, Validierung,
  Beziehungen und Endpunkte. Dateien dürfen im Referenzadapter insgesamt 20 MiB pro Konto
  belegen; eine Multipart-Anfrage ist auf 25 MiB begrenzt.
- Im Standardprofil `memory` verwirft ein Backend-Neustart Daten, Dateien und Sitzungen.
  Feinere Rollen und gemeinsame Team-Workspaces bleiben offen.

### PostgreSQL-Anbindung vom 19. Oktober

- Standardprofil `memory`: bisheriger Referenzbetrieb, keine installierte Datenbank nötig.
- Profil `postgres`: `JpaAccounts`, `AccountBootstrap` und `JpaWorkspaceStorage` unter
  `backend/src/main/java/de/forgeflow/persistence/`; JPA-Entities und Flyway-Migrationen sind ergänzt.
- Konten, Fachsammlungen und Einstellungen haben eigene Tabellen. Primär-/Fremdschlüssel
  enthalten die Kontokennung. Client-IDs und Reihenfolge bleiben erhalten.
- Dateien liegen für den lokalen Betrieb als `bytea` gemeinsam mit Metadaten in PostgreSQL.
  Die vorhandenen 20-/25-MiB-Grenzen bleiben bestehen. Externer Objektspeicher ist später möglich.
- Kontodatensatz-Sperren serialisieren gleichzeitiges Laden/Schreiben. Revision, Fachänderungen
  und Dateiinhalte werden zusammen transaktional gespeichert. Fehler rollen auch bereits
  geschriebene Teiländerungen zurück; veraltete Revisionen ergeben weiterhin `409`.
- V1 erstellt das Schema; V2 ergänzt den PostgreSQL-Index für höchstens einen aktiven Sprint
  pro Konto/Projekt. Hibernate prüft das Schema, statt es automatisch zu ändern.
- Bootstrap legt das erste Konto aus den Startvariablen an und überschreibt bestehende
  Hashes/Profile nicht. Danach können E-Mail und Hash aus der Startumgebung entfernt werden.
- Ein aktiviertes PostgreSQL-Profil fällt bei Verbindungsfehlern nicht auf Arbeitsspeicher zurück.
  Datenbank-/Transaktionsfehler ergeben `503 / STORAGE_UNAVAILABLE` ohne SQL-Details.
- Sitzungen und Login-Begrenzung bleiben flüchtig. Die nachfolgend ergänzte Kontoverwaltung
  erweitert diesen Stand; Team-Workspaces bleiben offen.
- PostgreSQL 18.6 wurde vom Anwender unter `D:\Program Files\PostgreSQL\18\` installiert.
  Dienst `postgresql-x64-18`, Server `127.0.0.1:5432`, Datenbank und Anwendungskonto `forgeflow`.
  Der Agent hat Erreichbarkeit und `/api/v1/health` mit `storage=postgresql` geprüft.
  Der Anwender hat Kunden/Projekte angelegt und deren Erhalt nach Backend-Neustart bestätigt.
  Kein automatischer Import des bisherigen Arbeitsspeichers. Die automatisierte Suite gegen
  die separate PostgreSQL-Datenbank `forgeflow_test` wurde vom Anwender mit 23 erfolgreichen
  Tests ohne übersprungene Tests bestätigt. Anleitung: `backend/README.md`.

Zum Start sind `AUTH_USER_EMAIL` und `AUTH_PASSWORD_HASH` erforderlich. Weitere Konfiguration:
`AUTH_USER_ID`, `AUTH_USER_NAME`, `APP_ORIGIN`, `PORT`, `COOKIE_SECURE`. Standard ist ein sicheres
Cookie; für lokale HTTP-Entwicklung `COOKIE_SECURE=false` setzen. Spring liest Prozessvariablen,
keine automatische `.env`-Datei. Echte Zugangsdaten nicht in Übergabedateien oder Chats ablegen.

Im PostgreSQL-Profil werden die Auth-Variablen nur für die erste Kontoeinrichtung benötigt.
Aktivierung später mit `SPRING_PROFILES_ACTIVE=postgres`, `DB_URL`, `DB_USER` und `DB_PASSWORD`.
Die Datei `frontend/.env.local` bleibt bei `VITE_DATA_MODE=api` und enthält keine Datenbank-Zugangsdaten.

### Lokaler Betrieb und Kontoverwaltung

Auftrag des Anwenders: Startkonfiguration und Sicherung einrichten, Browserprüfung nachholen,
danach Kontoverwaltung ergänzen.

- Neue Skripte unter `scripts/`: `configure-local.ps1`, `start-local.ps1`,
  `start-backend.ps1`, `start-frontend.ps1`, `backup-local.ps1`, `restore-local.ps1`,
  `test-postgres-local.ps1` und gemeinsamer Helfer `local-common.ps1`.
- npm-Kommandos: `setup:local`, `start:local`, `backup:local`, `restore:local`,
  `test:local-scripts`, `test:postgres`. Ausführliche Anleitung: `docs/local-operation.md`.
- Nicht geheime Einstellungen und ein Windows-DPAPI-verschlüsseltes Verbindungspasswort
  liegen unter `backend/.local/`; Backups unter `backups/`. Beide Verzeichnisse sind ignoriert.
  Noch keine lokale Einrichtung durch den Agenten: dem Agenten fehlt das Datenbankpasswort.
  Der Anwender wurde um Ausführung von `configure-local.ps1` im eigenen Terminal gebeten.
- Der gemeinsame Start nutzt verborgene Hilfsprozesse, feste lokale Ports, Bereitschaftsprüfung,
  lokale Logs und beendet per Strg+C nur die selbst gestarteten Prozessbäume.
- Vor dem Backend-Start wird bei Bedarf ein konsistenter PostgreSQL-Custom-Dump angelegt
  (letzte gültige Sicherung älter als 24 Stunden). Kein dauerhaft laufender Sicherungszeitplan.
  Archive sind nicht verschlüsselt; nur das Verbindungspasswort ist DPAPI-geschützt.
- Restore ist ausschließlich in eine neue Datenbank mit Präfix `forgeflow_restore_` erlaubt,
  nie in bestehende Datenbanken. `-Verify` entfernt anschließend nur die selbst erstellte Kopie.
  Prüfsumme, Dateiinhaltgrößen, Constraints und Migrationsstatus werden geprüft.
- Ein echter Dump-/Restore-Test ist noch offen, bis lokale Einrichtung und interaktive
  Administratoranmeldung verfügbar sind. Syntax/DPAPI/Integritätsschutz wurden separat getestet.
- Konto-UI: `frontend/src/pages/projects/components/AccountSettings.tsx`, unter Einstellungen.
  Eigenes Profil, Passwortwechsel, Administrator-Kontoliste, Anlegen normaler Konten,
  Aktivieren/Deaktivieren. Deaktivierung erhält Daten; Administrator ist geschützt.
- Neue API: `PUT /me/profile`, `POST /me/password`, `GET/POST /users`,
  `PUT /users/{id}/active`. Kein öffentliches Signup, kein Kontolöschen, kein E-Mail-Reset
  und keine Oberfläche zur Vergabe weiterer Administratorrechte.
- Migration V3 ergänzt `administrator`, `active`, `session_version` und `ff_account_setup`.
  Das bestehende Konto mit `AUTH_USER_ID` erhält einmalig Administratorrechte; normale Starts
  machen spätere Rechteänderungen nicht rückgängig. Benutzer-IDs, Passwörter und Fachbestand bleiben erhalten.
- Sitzungen verwenden `AccountPrincipal(id, sessionVersion)`, nicht die veränderliche E-Mail.
  Passwortänderung, E-Mail-Änderung und Deaktivierung widerrufen bestehende Sitzungen.
  Aktuelle Passwörter werden bei Passwort-/E-Mail-Änderungen geprüft und Versuche begrenzt.
- Neue Funktionalität noch nicht gegen das echte lokale PostgreSQL geprüft. Vorherige
  Anwenderbestätigung von 23 PostgreSQL-Tests betrifft den Stand vor Kontoverwaltung/V3.
- Browser-Inventar war leer; `cua.createBrowserTab('iab', ...)` meldete
  `Browser is not available: iab`. Keine neue visuelle Prüfung behaupten.
  Vollständige Prüfliste steht in `docs/browser-check.md`.

## Zuletzt verifiziert

Frontend-Verschiebung am 19. Oktober 2026, vom Agenten ausgeführt:

- React-Code, Assets, Einstiegspunkt, Konfiguration und Test-Runner nach `frontend/`
  verschoben; die vorhandene lokale Umgebungsdatei wurde mitgenommen.
- npm-Workspace mit gemeinsamer Lockdatei; Befehle im Hauptordner leiten weiter.
  `scripts/start-frontend.ps1` startet aus `frontend/`. Backend- und Sicherungspfade bleiben gültig.
- Lint, Produktionsbuild und alle **93** Frontend-Tests im Hauptordner erfolgreich.
- Isolierte `npm ci`-Installation mit der neuen Lockdatei und anschließender Build direkt
  aus `frontend/` erfolgreich. Keine bestehenden Paketversionen aktualisiert;
  npm hat veraltete Einträge des entfernten Node-Backends aus der Lockdatei bereinigt.
- Vite über den Hauptordner auf einem separaten Testport gestartet: Einstiegspunkt,
  `main.tsx`, `App.tsx`, öffentliches SVG und Vite-Client mit HTTP 200 ausgeliefert.
  Testserver anschließend beendet. Das ist keine visuelle Browserprüfung.
- Lokale PowerShell-Skripte: **5** Prüfgruppen erfolgreich. Backend-Tests bei dieser
  reinen Frontend-Umstrukturierung nicht erneut ausgeführt; Ergebnisse unten stammen
  aus dem vorherigen Kontoverwaltungsdurchlauf.

Kontoverwaltungsdurchlauf vom 19. Oktober 2026, vom Agenten ausgeführt:

- `npm.cmd run lint`, `npm.cmd run build`.
- `npm.cmd test`: **93** erfolgreiche Tests.
- Spring/Maven: **37** erfolgreiche Tests; **1** PostgreSQL-spezifischer Index-Test
  ohne echte PostgreSQL-Testverbindung übersprungen. Einschließlich Kontoverwaltung, CSRF,
  Sitzungswiderruf, E-Mail-Wiederverwendung, Rate-Limits und Upgrade eines vorhandenen Datenbestands.
- `scripts/test-local-scripts.ps1`: **5** erfolgreiche Prüfgruppen (Syntax, DPAPI,
  lokale Zielkonfiguration, Backup-Integrität und Wiederherstellungsschutz).
- Noch offen: aktuelle Suite mit V3 gegen echtes PostgreSQL, tatsächlicher Dump-/Restore-Test
  und visuelle Browserprüfung. Keine neuen Zugangsdaten wurden im Projekt dokumentiert.

Vorheriger PostgreSQL-Implementierungsdurchlauf:

- `npm.cmd run lint` und `npm.cmd run build`.
- `npm.cmd test`: **86** Frontend-, Fachlogik-, API-, Auth- und Repository-Tests.
- Spring/Maven: **22** erfolgreiche Tests; ein zusätzlicher PostgreSQL-spezifischer Index-Test
  wird ohne PostgreSQL übersprungen. Der HTTP-Vertrag läuft mit Referenzspeicher und JPA/H2.
  Zusätzlich geprüft: Kontotrennung, Fremdschlüssel, Dateierhalt/-löschung, Reihenfolge, Bootstrap,
  Transaktions-Rollback, parallele Schreiber und eine neue Backend-Instanz mit demselben Datenbestand.
- Anschließend vom Anwender bestätigt: dieselbe Suite gegen PostgreSQL 18.6, Datenbank
  `forgeflow_test`, mit **23 erfolgreichen Tests, 0 Fehlern und 0 übersprungenen Tests**,
  einschließlich V2-Index. Dieser PostgreSQL-Lauf wurde im Terminal des Anwenders ausgeführt;
  der Agent hat ihn nicht selbst ausgeführt.

Frühere Prüfung vom 18. Oktober, in diesem Durchlauf nicht erneut ausgeführt:

- `npm.cmd audit --omit=dev`: keine gemeldeten Schwachstellen in Produktionsabhängigkeiten
  zu diesem Prüfzeitpunkt. React Router wurde innerhalb Version 7 auf einen korrigierten Stand aktualisiert.
- Entwicklungsserver: 54 Komponentenmodule ohne fehlenden Default-Export ausgeliefert.

Eine vollständige visuelle Browserprüfung durch den Agenten wurde nicht ausgeführt.
Der Anwender hat lokalen Backend-/Frontend-Start, Anmeldung und den Erhalt von Kunden/Projekten
nach Backend-Neustart mit echtem PostgreSQL als funktionierend bestätigt.
Die vollständige manuelle Prüfliste in der Haupt-README bleibt offen.

## Arbeitsumgebung und bekannte Besonderheiten

- Im ursprünglichen Arbeitskontext waren Node/npm im eingeschränkten Shell-PATH nicht verfügbar;
  freigegebene `npm.cmd`-Aufrufe funktionierten. In IntelliJ den tatsächlichen lokalen PATH prüfen.
- Java/Maven wurden für die Prüfung portabel unter `node_modules/.tmp/backend-tools` abgelegt.
  Das ist kein systemweit installiertes JDK. In IntelliJ JDK 21 und Maven ausdrücklich konfigurieren.
- `scripts/verify-backend.ps1` prüft Archiv-Prüfsummen und führt Backend-Tests aus; Downloads
  und Maven-Cache bleiben unter dem ignorierten `node_modules/.tmp/`.
- Eine frühere leere Vite-Seite entstand durch ein kurzzeitig leeres Modul beim Schreiben.
  `frontend/vite.config.ts` verwendet deshalb `watch.awaitWriteFinish`. Quellcode atomar ändern und
  bei ähnlichen Fehlern die tatsächlich ausgelieferten Module/Exporte prüfen.
- Zum Zeitpunkt der bisherigen Arbeit stand keine nutzbare Git-Historie zur Verfügung.

## Sinnvolle Fortsetzung

1. Vorhandenen Code, Root-`AGENTS.md`, diese Übergabe und die Backend-Dokumentation lesen.
2. Lokale Einrichtung mit `npm.cmd run setup:local` durch den Anwender abschließen.
   Danach `npm.cmd run backup:local` und Wiederherstellungsprüfung in einer neuen Kopie.
3. Die aktuelle Suite mit `npm.cmd run test:postgres` gegen `forgeflow_test` prüfen.
   Der Helfer verwendet die gespeicherten lokalen Zugangsdaten, setzt Testvariablen nur für
   den Aufruf und überschreibt die Anwendungsdatenbank nicht.
4. Backend/Vite nach Freigeben der Ports mit `npm.cmd run start:local` neu starten.
   V3 wird automatisch migriert. Bei einer abweichenden alten Kontokennung beim Setup
   `-BootstrapUserId` angeben.
5. Bei verbundenem Browser die Prüfliste `docs/browser-check.md` ausführen.
   Feinere Rollen/Teams, E-Mail-Reset, produktiven Betrieb und Kontolöschen nur nach neuem Auftrag.

Diese Übergabe beauftragt keine zusätzlichen Features, Migrationen oder Veröffentlichung.
