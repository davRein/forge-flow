# Projektübergabe: Dev Suite / ForgeFlow

Stand: 25. Oktober 2026. Diese Datei fasst die bisherige Arbeit für einen neuen Codex-Chat zusammen.
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
  Windows-PC, ohne Docker-Pflicht. Der Anwender betreibt die Anwendung inzwischen auch auf
  Ubuntu unter `https://185.56.150.178` mit Nginx, systemd und PostgreSQL (Details unten).
- Benutzeroberfläche und Kommunikation überwiegend auf Deutsch. Bestehende Funktionen erhalten.
- Die Haupt-README ist auf Wunsch auf Englisch und enthält nur Installation und Einrichtung einschließlich
  PostgreSQL, erstem Anwendungskonto und lokalem Start. Funktionsübersicht unter
  `docs/frontend.md`, ausführliche manuelle Prüfliste unter `docs/manual-check.md`.

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
- Ungespeicherte Dev-Tools-Eingaben und offene Formular-/Artikelentwürfe bleiben im Browser.
  Explizit gespeicherte REST-Anfragen haben einen eigenen privaten Kontospeicher außerhalb
  von Workspace und KI-Daten; siehe [REST-Collections](rest-collections.md).

### Frontend-Datenfluss

- `frontend/src/App.tsx`: Auth-Gate, Themes, Einstellungen, WorkspaceProvider und Hash-Navigation.
- `frontend/src/services/api/apiClient.ts`: zentrale JSON-/Multipart-/Blob-/Stream-Anfragen, Cookie-/CSRF-Behandlung,
  30-Sekunden-Zeitlimit (Chat-Stream: 90 Sekunden), Abbruch, Fehler und Schutz vor Operationen/Antworten aus alten Sitzungen.
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

Kompakte Dev Tools und private REST-Collections, 25. Oktober 2026:

- Referenzscreenshot zeigt den JSON Formatter. Dev Tools auf maximal 1160 px reduziert,
  kleinere Texte/Abstände, JSON-Editoren 220–320 px statt 380 px Mindesthöhe; Einrückungswahl
  und Aktionsbuttons unten bündig. REST mit Collection-Leiste links, kompakter Methode/
  URL/Senden-Zeile und per Tastatur bedienbaren Reitern Header/Body/Optionen; mobil gestapelt.
- Collections/Anfragen anlegen, suchen, einklappen, umbenennen, speichern/aktualisieren,
  kopieren und nach Bestätigung löschen. Laden sendet nie die gespeicherte Anfrage.
  Ungespeicherte Änderungen vor Ersatz bestätigen. Erfolgshinweis erst nach bestätigtem
  Commit; Fehlergrund und Entwurf bleiben bei Fehlern erhalten, kein automatischer PUT-Retry.
- Eigener accountgebundener `GET/PUT /api/v1/me/rest-collections`, Version 1 mit eigener
  Revision/ETag/If-Match, Origin und CSRF. V9 `ff_rest_collections` mit Account-FK und JSON-
  Textpayload. Account-Lock verhindert parallele Erstschreibvorgänge mit derselben Revision.
  JPA initialisiert alle NOT-NULL-Felder vor persist. Workspace-Ersetzung berührt den Speicher
  nicht; Definitionen sind weder im KI-Werkzeugumfang noch in localStorage enthalten.
  Rohtext für Header/Body, keine gespeicherten Antworten. Memory/Preview bleiben flüchtig.
- Limits: 100 Collections, insgesamt 1000 Anfragen/1 MiB UTF-8; Namen 200, URL 4000,
  Header 20000, Body 100000 Zeichen, Timeout 1–120 s. HTTP(S) ohne eingebettete Zugangsdaten;
  leere URL/ungültiger JSON-Body als unfertiger Entwurf erlaubt. Ausführung prüft zusätzlich
  bestehende REST-Validierung; weiterhin Browser-CORS/credentials omit/Abbruch/2-MiB-Anzeige.
  Keine Postman-Dateiimporte/-exporte, verschachtelten Ordner oder Umgebungsvariablen.
- Verifiziert: **225 Frontend-Tests**, ESLint und strikter API-Produktionsbuild erfolgreich.
  Normaler Backendlauf: **222 erfolgreich + drei Skips = 225**. Echter isolierter PostgreSQL-
  Gesamtlauf einschließlich Performance und Maven package: **224 erfolgreich + ein optionaler
  OpenAI-Live-Skip = 225**, keine Fehler. Testcluster `postgres-test-3687deb83b53402a92278a680b94ea3d`
  gestoppt, PID- und Passwortdatei entfernt. Keine vorhandenen Datenbanken/Dienste verändert,
  keine OpenAI-Anfrage. Neue Tests prüfen Kontotrennung, CSRF/Origin/Revisionsschutz,
  Validierung/UTF-8-Limit, unveränderte Rohdaten, zweite Backend-Instanz, parallele Schreiber,
  Datenbankrollback, echte Komponentenaktionen, Speicherfehler und verspätete Logout-Antworten.
- OpenAPI ergänzt private Schemas und Endpoint; 121 lokale Verweise aufgelöst. API-Bundle
  geprüft. Bekannte Vite-Chunkwarnung 605,69 kB / gzip 186,09 kB, kein Buildfehler. Visuelle
  Browserabnahme nicht durchgeführt; Schritte in browser-check.md. Kein Remote-Deployment.
- Vollständiges Uploadpaket `node_modules/.tmp/forgeflow-chat-*` neu erstellt; Asset
  **`index-CE-Rud11.js`**. Backend-SHA256
  `1a8a371989e5c9addb5643aa5c30debb5f3c5709e672e20cbc18c63a721898b8`, Frontend-Tar-SHA256
  `b3a9198251f66f2bed02b4e4915d4feae2bcac3010ec8818169af567a2eb45e5`.
  Beide Artefakte samt Prüfsummen und bestehenden Update-/Testskripten übertragen, V9 automatisch.
  Prüfsummen, tatsächlich gepacktes Frontend-Archiv und V9/Controller/JPA-Klassen im JAR geprüft.
  Update-Skript offline geprüft: sieben Erfolge; Symlink-Test unter Windows übersprungen
  und weiterhin vor Deployment mit `bash ~/test-linux-chat.sh` auf Ubuntu auszuführen.
  Offen: Anwender-Deployment und visuelle Abnahme in DE/EN/hell/dunkel/mobil. Bedienung,
  Privatsphäre, API-/Downgradegrenzen: [rest-collections.md](rest-collections.md).

Kompakte Projektansicht und Suchleiste, 24. Oktober 2026:

- Anwender lehnt die breite, farbige Projektansicht ab; Referenzscreenshot eingelesen.
  Gewünscht: leicht aufgehellte Leiste im Projektrahmen, Mappen-Icon mit „Neu“, Lupe
  mit nach rechts aufklappendem Suchfeld. Umsetzung für Projektliste und Dashboard.
- Neue `ProjectFrame`/`ProjectToolbar`: dezente Theme-Fläche, monochrome Inline-SVGs,
  30-px-Aktionen, kleiner Trefferzähler. Großer Anlegen-Button und dauerhaftes separates
  Suchfeld entfallen. Lupe öffnet/fokussiert Suche (240 px, mobil kleiner); erneuter Klick
  oder Escape leert und schließt, Fokus zurück zur Lupe. Geschlossen deaktiviert/nicht
  tabbbar/aria-hidden, aria-expanded/controls und Suchlabel vorhanden. Reduzierte Bewegung
  deaktiviert Transition. Suche bleibt rein lokal nach Projektname/Kunde ohne Schreibzugriff;
  bestehende neue Projektformulare und KI-Navigationssperren bleiben angebunden.
- Projektübersichten auf maximal 1100 px begrenzt, kleinere Überschrift/Abstände. Liste
  ohne verschachtelten Kartenrahmen, flachere 40-px-Zeilen, neutrale statt flächig blauer
  Auswahl und normale Titelgewichte. Dashboard-Karten dichter und ohne angehobenen Hover-
  Schatten. Kunden-/Einstellungs-/Detailseiten behalten die bisherige Breitenkonfiguration.
- DE/EN für die neuen Bedienelemente. Übersetzungskollision behoben: Projekt-„Neu“ heißt
  „New“, bisheriger KI-Vergleichsschlüssel „Neu“ nun „Nachher“ (= After); Bisher/Before
  und sämtliche fachlichen Vorschlags-/Entscheidungsdaten bleiben gleich.
- Verifiziert: **216 Frontend-Tests**, ESLint und strikter API-Produktionsbuild erfolgreich.
  Neue Komponentenfälle prüfen Öffnen/Fokus, Suche über Kunden, leere Treffer, Escape/
  Lupenklick/Filterreset, Rückfokus und unveränderte Daten sowie Neu aus beiden Ansichten.
  Bestehender KI-Navigationstest verwendet den neuen zugänglichen Aktionsnamen und prüft
  weiter die Formularsperre. Vite meldet bekannte Chunkwarnung 584,54 kB / gzip 180,33 kB.
  API-Bundle/105 OpenAPI-Verweise erneut geprüft. Backend unverändert zum vorher geprüften
  Dokumentationsstand, deshalb kein neuer Backend-Testlauf und keine neue Migration.
- Screenshot als Referenz angesehen, keine visuelle Abnahme des Ergebnisses: Browserinventar
  weiterhin leer. Manuelle Schritte unter browser-check.md ergänzt. Kein Remote-Deployment.
- Aktuelles vollständiges Uploadpaket neu gepackt und SHA-Datei verifiziert:
  Backend `370108f8f4d1cf85226cbc21b93b6c380e63b99ea40bfe925823b06e0f9427c0`,
  Frontend-Tar `1e80040d7e7a61deceea3526c65bb8292862c18729683bf0a94ee1f091dce78b`.
  **Aktueller Assetname: `index-NynyjBW5.js`.** Beide Teile samt Prüfsummendatei und
  bestehenden Update-/Testskripten übertragen. Paket enthält auch die vorherige Dokumentation
  und Sprachpersistenz. Offen: Anwender-Deployment und manuelle visuelle Abnahme.

Dokumentationsbereich nach Confluence-Vorbild, 24. Oktober 2026:

- Anwenderauftrag direkt umgesetzt: vorhandenes Wiki wird zur Dokumentation mit Bereichen
  und hierarchischen Seiten. Keine zweite Datenhaltung oder neue Abhängigkeit. Bestehende
  Artikel/Kategorien werden weiterverwendet; Modulschlüssel/Routen `wiki/*` und API-
  Sammlungen bleiben gültig. Neue Navigationstitel Dokumentation/Übersicht/Seiten/Bereiche;
  DE/EN einschließlich Chat-Seitenbezug und Vorschaukartenbeschriftungen.
- Neue Bereichs-/Startübersicht, seitliche Bereichsauswahl, auf-/zuklappbarer Seitenbaum,
  Breadcrumbs, zugehörige Unterseiten, Inhaltsverzeichnis ohne Hashroutenwechsel und Lesezeit.
  Baum auf 250 Einträge begrenzt, aktueller Pfad priorisiert; Suche findet sämtliche Seiten.
  Responsive Theme-Komponenten verwenden vorhandene Tokens. Browserinventar leer;
  deshalb keine visuelle Browserabnahme behaupten.
- Editor mit Bereich/Elternseite, Formatierungsleiste, Vorschau und drei Vorlagen (Anleitung,
  Entscheidung, Besprechung). Markdown ergänzt sicheres Fett/Kursiv/Inlinecode, geprüfte
  HTTP(S)/mailto-Links, Tabellen, Zitate und Trennlinien. HTML bleibt React-Text, Codebytes/
  Einrückungen erhalten. Vorlagen nur bei leerem neuem Inhalt, Sprachwechsel verändert
  bestehende Texte nicht. Artikelentwürfe bleiben im bestehenden Hook sitzungsgebunden;
  Stale-Guard verhindert Überschreiben zwischenzeitlicher Seitenänderungen. Neue IDs
  berücksichtigen inzwischen über KI angelegte Seiten/Bereiche. Entwürfe/Dialogsperren
  schützen KI-Freigaben. Kontowechsel setzt weiterhin alle kontogebundenen Zustände zurück.
- `Article.parentId` optional/null, null = Wurzelseite; Parent muss im selben Konto/Bereich
  vorhanden sein. Keine Schleifen, höchstens zwölf Ebenen; Frontenddecoder, Domain und
  Backend prüfen. Blattseiten können Bereich wechseln; Seiten mit Kindern behalten ihren
  Bereich, bis Kinder verschoben wurden. Seiten mit Kindern lassen sich nicht direkt löschen.
  Bereichslöschung ordnet Seiten neu zu und erhält Hierarchie/Inhalte.
- Flyway **V8__documentation_page_hierarchy.sql** ergänzt nullable parent_id, Index und
  zusammengesetzten Selbst-Fremdschlüssel. Bestehende Wiki-Inhalte bleiben Wurzelseiten.
  Multipart-Workspace-Vertrag/Revision/CSRF/Origin unverändert. Nur bei fehlender parentId
  in Altclient-HTTP-Requests wird der alte Parent revisionsgebunden ergänzt; explizites
  null löst die Zuordnung. Neuere Clients senden das Feld durchgängig.
- JPA löst alte Elternverweise vor dem atomaren Delete/Reinsert innerhalb derselben
  Transaktion (auch für H2s zeilenweise FK-Prüfung), schreibt dann Ebenen gesammelt in
  Eltern-vor-Kind-Reihenfolge und erhält ursprüngliche Sammlungsreihenfolge. Alle Änderungen
  einschließlich Revision und KI-Entscheidung rollen bei Fehlern zurück. Memory hat dieselben
  Hierarchieregeln, bleibt flüchtig. Kein automatischer Fallback auf Beispiel-/Memorydaten.
- Bestehende sieben KI-Werkzeugnamen bleiben. `articles`/`categories` bedeuten Seiten/Bereiche,
  parentId/categoryId-Filter lesen die Struktur. Anlage mit parent (eindeutiger Name/#ID)
  erbt ohne category den Bereich; bestätigte Änderung unterstützt parent inklusive leer
  für Wurzel. Dieselben Regeln/Budgets/Ownership/Idempotenz. Seitenidentität und Editorinhalt
  werden nicht im Kontext übergeben; bei mehrdeutigem „diese Seite“ Rückfrage.
- Neue Hierarchievorschläge verwenden Gesprächsformat **5**, Backend liest **1–5**.
  Alter Backend-Downgrade kann neue Gespräche nicht lesen und Seitenhierarchie beim
  Schreiben verlieren; Backup-/Datenerhaltprüfung erforderlich, kein manuelles Flyway-Revert.
- Verifiziert: **214 Frontend-Tests**, ESLint und strikter API-Produktionsbuild erfolgreich.
  Bestehende Vite-Chunkwarnung 580,13 kB / gzip 179,10 kB, kein Fehler. Normaler H2/Memory-
  Lauf: **216 erfolgreich + drei Skips = 219**. Abschließender isolierter echter PostgreSQL-
  Gesamtlauf einschließlich Performance: **218 erfolgreich, nur optionaler OpenAI-Live-Test
  übersprungen = 219**, Maven package erfolgreich. Testcluster
  `postgres-test-07bfc78a120d4094ababf78317417564` gestoppt, PID-/Passwortdatei entfernt;
  vorhandene Datenbanken/Dienste unverändert. Keine echte OpenAI-Anfrage.
- Prüfungen umfassen Upgrade bestehender Wiki-Daten, Parent-first bei beliebiger ID-Reihenfolge,
  FK-Kontentrennung, atomare Legacy-HTTP-Roundtrips und explizites Root-Move, fehlende/fremde/
  zyklische Parents, Tiefe, Daten-/Dateierhalt über zweite Backend-Instanz, KI-Vorschlag/
  Bestätigung und JPA-Entscheidungsrollback/retry. Frontend prüft zusätzlich Markdown-Sicherheit,
  reale Komponentennavigation, Baum, Breadcrumbs, TOC-Scrollcallback ohne Routenwechsel,
  Vorlagen/Toolbar/Vorschau, Entwürfe, Schema und externe ID-Änderungen.
- OpenAPI ergänzt parentId und Änderungsvorschau; **105 lokale Verweise aufgelöst**,
  API-Bundle geprüft. [Bedienung und Architektur](documentation.md), Browser-, Backend-,
  KI- und Linux-Dokumentation aktualisiert. Root-README bleibt reine Installation/Einrichtung.
- Vollständiges aktuelles Uploadpaar mit Prüfsummendatei unter `node_modules/.tmp/forgeflow-chat-*`:
  Backend `370108f8f4d1cf85226cbc21b93b6c380e63b99ea40bfe925823b06e0f9427c0`,
  Frontend-Tar `86da2eb018d60051741bdefa97c3e3a4bd40e5df9dcf296cf3ebb13994c7d8e3`.
  **Aktueller Assetname: `index-CxsUTHp1.js`.** Beide Teile mit bestehendem Update-/Testskript
  gemeinsam übertragen; Update sichert Anwendung/Datenbank, V8 läuft beim Backendstart.
  Keine neue Installation/Umgebungsvariable. Offen: Anwender-Deployment und visuelle Abnahme.
  Weitere mögliche Ausbaustufen: Versionshistorie, Kommentare, gemeinsame Bereiche,
  kollaborativer Editor und dokumentationsbezogene Anhänge.

Login-Sprache und englische Vorgabe, 24. Oktober 2026:

- Anwenderauftrag: Englisch muss beim erneuten Websiteaufruf schon vor der Anmeldung
  erhalten bleiben; ohne frühere Auswahl Englisch, außer bei erkennbarer Region DE/AT/CH.
- Ursache: Login war fest deutsch und lag außerhalb des Sprachproviders. `LoginPage`
  verwendet nun denselben Übersetzungsdienst einschließlich Sitzungsprüfung, Formular,
  Loginfehlern und Passwortwechselhinweis. Gemeinsamer `LanguageProvider` aktualisiert
  auch `document.documentElement.lang`; Settings-Lade-/Fehleransicht ebenfalls übersetzt.
- `browserLanguage.ts` merkt ausschließlich `de`/`en` unter `forgeflow.language` im
  Local Storage derselben Website. Aktuell angewendete Kontosprache/manueller Wechsel
  gilt für den nächsten Login, auch bei fehlgeschlagener Kontospeicherung. Keine Tokens,
  Kontokennungen oder Zugangsdaten im Browserspeicher. Bei Speicherfehlern bleibt die
  Auswahl für die laufende Seite aktiv; nach deren Schließen keine Persistenzgarantie.
- Ohne gemerkte Auswahl: explizite Region der primären Browser-Locale DE, AT oder CH
  ergibt Deutsch (auch en-DE/fr-CH); sonst Englisch. Bloßes `de` ohne Region ergibt
  Englisch. Dies ist ausdrücklich ein Regionshinweis, keine sichere Standortermittlung;
  keine GPS-Abfrage, IP-Geolokalisierung oder zusätzliche Netzwerkanfrage.
- Grundvorgabe und Zurücksetzen jetzt Englisch. Neue Konten ohne Settings übernehmen
  die Browserauswahl; gültige gespeicherte Kontosprachen haben nach Login Vorrang und
  aktualisieren die Loginvorgabe. Vor diesem Update nur serverseitig gespeicherte Sprache
  wird erst nach der nächsten Anmeldung im Browser gemerkt. Bestehende deutsche
  Datenbankwerte bleiben erhalten, keine Backend-/API-/Migrationsänderung. Lesen schreibt
  keine Settings zum Server; Ladefehler/verspätete Antworten bleiben abgesichert.
- Verifiziert: **206 Frontend-Tests**, Lint und strikter API-Produktionsbuild erfolgreich.
  Neue Fälle: Regionshinweise/fehlende/ungültige Locale, explizite Sprache über Neuladen,
  blockierter Speicher/Quota, Vorrang gespeicherter Kontosprache ohne automatische PUTs,
  Kontosprache → Abmeldung → englischer Login/Fehler sowie Wechsel trotz Speicherfehler.
  Bestehende deutsche UI-Tests geben ihre Sprache jetzt ausdrücklich an. Vite-Chunkwarnung
  556,52 kB / gzip 172,14 kB bleibt ohne Buildfehler. Keine neue Backend-Testausführung
  nötig; Backend unverändert zum unmittelbar zuvor geprüften Kundendetailstand.
- API-Bundle/105 OpenAPI-Verweise geprüft; vollständiges Uploadpaar und SHA-Datei neu
  gepackt und geprüft. Backend unverändert
  `37bdab7e9c5065351f0e09520e4bd566caf8e945d822a6015d56c6b9be30f532`,
  Frontend-Tar `120a7236e200ad68a0193d7a62320946e9d29dfd6e817a153d8ab8618048bed2`.
  **Aktueller Assetname: `index-CPgrWMJy.js`.** Enthält auch die Kundendetailänderungen.
  Offen: Anwender-Deployment über bestehendes Updateverfahren und manuelle Browserprüfung.
  Keine Remote-Installation oder visuelle Abnahme durch den Agenten.

Kundendetails, Ansprechpartner und interne Notizen, 24. Oktober 2026:

- Vom Anwender beauftragter nächster Schritt nach bestätigtem Kundenformular-Deployment.
  Kundenname/Details-Schaltfläche öffnet `#/projectManager/customers?customer=<ID>`;
  Stammdaten, Anschrift, zugehörige Projekte, Ansprechpartner und interne Notizen auf
  einer responsiven Detailseite. Fehlender Kunde ergibt einen sichtbaren Fehler.
  Ansprechpartner anlegen/bearbeiten/löschen, Notizen bearbeiten, Kundenstammdaten und
  Projektlinks verwenden die bestehenden Dialoge, Themes und Speichermeldungen; DE/EN.
  Entwürfe bleiben bei Modulwechsel erhalten und blockieren parallele KI-Freigaben.
- `Customer.contacts` und `Customer.notes` ergänzen den bestehenden atomaren Workspace-
  Vertrag ohne neue CRUD-Endpunkte. Notizen sind reiner Text mit höchstens 6000 Zeichen;
  bis 100 Ansprechpartner je Kunde und 10000 je Workspace. Ansprechpartner haben positive,
  workspaceweit eindeutige IDs, feste Kundenzuordnung, Namen und optional Funktion,
  E-Mail/Telefon. Funktion ist eine Berufsbezeichnung, keine Berechtigungsrolle.
- Fehlende/null Detailfelder alter Clients erhalten bestehende Daten; explizites `[]`
  bzw. `""` leert sie. Das Stammdatenformular erhält die Details ebenfalls. Frontend-
  Entwürfe prüfen zwischenzeitliche Änderungen vor dem Speichern. Kundenlöschung weist
  auf die mitgelöschten Ansprechpartner/Notizen hin; bestehender Projektbeziehungsschutz bleibt.
- Flyway **V7__customer_contacts_and_notes.sql** ergänzt `ff_customers.notes` und
  `ff_customer_contacts` mit zusammengesetztem Eigentümer-/Kunden-Fremdschlüssel und
  Löschkaskade. Frühere Migrationen unverändert. JPA lädt Kontakte gesammelt und schreibt
  sie gebündelt innerhalb derselben Revisionstransaktion; Memory unterstützt denselben
  Vertrag. PostgreSQL-Neustart, Kontentrennung und vollständiger Rollback mitgetestet.
- KI kann Ansprechpartner filtern/zählen/lesen sowie nach ausdrücklicher Kartenfreigabe
  anlegen/ändern und Kundennotizen lesen/anlegen/ändern. Bestehende sieben Werkzeugnamen,
  Schritt-/Zeit-/Tokenlimits, CSRF/Origin, Ablaufzeiten und idempotente Entscheidungen bleiben.
  Kundenergebnisse liefern eine Kontaktanzahl statt unbeschränkt eingebetteter Kontaktdaten;
  Notizen werden nur in Detailabfragen in begrenzten Textabschnitten ausgegeben.
  Keine Kontaktlöschung oder Kundenzuordnungsänderung per KI. Der Seitenkontext enthält
  keine ausgewählte Kunden-ID: bei unklarem Ziel nach Namen/#ID fragen.
- Neue entsprechende gespeicherte Gesprächsinhalte verwenden internes Format **4**;
  der Leser akzeptiert weiterhin 1–4. Ein alter Backend-Downgrade kann Format 4 nicht
  lesen und beim Workspace-Schreiben neue Kontakte/Notizen verlieren. Deshalb kein
  unkontrollierter Downgrade oder manuelles Zurücksetzen der Migration.
- Verifiziert: **200 Frontend-Tests**, ESLint und strikter API-Produktionsbuild erfolgreich.
  Vite meldet weiterhin die Chunkgrößenwarnung: 554,23 kB / gzip 171,45 kB, kein Buildfehler.
  Isolierter echter PostgreSQL-Gesamtlauf: **212 erfolgreiche Backend-Tests, ein optionaler
  OpenAI-Live-Test übersprungen** (213 insgesamt), Maven package erfolgreich. Separater
  H2/Memory-Lauf: **210 erfolgreich, drei Skips** (PostgreSQL, Performance, OpenAI).
  Tests umfassen echte HTTP-Freigaben und lokale SDK-Wire-Antworten ohne Anbieterzugriff.
- OpenAPI: **105 lokale Verweise aufgelöst**, Kontakt-/Notizschema und API-Bundle geprüft.
  Testcluster gestoppt, PID- und Passwortdateien entfernt; bestehende Dienste unverändert.
  Keine echte OpenAI-Anfrage, keine Remote-Installation. Browserinventar leer, deshalb
  keine visuelle Abnahme. Manuelle Schritte unter [browser-check.md](browser-check.md),
  Funktions-/Kompatibilitätsdetails unter [customer-details.md](customer-details.md).
- Vollständiges aktuelles Uploadpaket unter `node_modules/.tmp/forgeflow-chat-*`, Prüfsummen
  nach Verpackung verifiziert: Backend
  `37bdab7e9c5065351f0e09520e4bd566caf8e945d822a6015d56c6b9be30f532`,
  Frontend-Tar `8db47e6dbe8ffdf4783d0caa89b79727459b70c5d9b359d84c33526f27ffe272`.
  **Aktueller Assetname: `index-DmMcYGTM.js`.** Beide Teile samt Prüfsummendatei und
  bestehendem Update-/Testskript gemeinsam übertragen; V7 läuft automatisch beim Start.
  Keine zusätzliche Installation oder Umgebungsvariable. Offen: Anwender-Deployment
  dieses Pakets und manuelle Browserprüfung; bisheriges Kundenformularpaket bereits live.

Kundenformular, PLZ und globale Branchenverwaltung, 24. Oktober 2026:

- Nach Anwender-Rückmeldung „Sieht immer noch gleich aus“ öffentliches HTML ohne
  Anmeldung und mit separatem Queryparameter erneut gelesen: Server liefert noch
  `index-BUhsoBws.js`, also das Paket vor Kundenformular/PLZ. Lokales fertiges Archiv
  enthält verifiziert `index-Bfknu5R8.js`; beide Artefakt-Prüfsummen unten stimmen.
  Anschließend hat der Anwender das vollständige Paar erfolgreich eingespielt und
  `index-Bfknu5R8.js` öffentlich bestätigt. Alle acht Linux-Offline-Tests erfolgreich;
  Serverbackup `/opt/forgeflow/chat-update.L63uoF`. SSH-Leseversuch des Agenten mit
  BatchMode/StrictHostKeyChecking mangels Schlüsselanmeldung abgewiesen; keine Serveränderung
  durch den Agenten. Das oben dokumentierte Kundendetailpaket ist der nächste Stand.
- Anwenderauftrag: Kundenanlage optisch professioneller und vollständiger gestalten,
  insbesondere PLZ dauerhaft speichern; Branche als Dropdown mit zentral verwaltbaren
  Inhalten. Umsetzung ohne neue Abhängigkeit. Gruppen Unternehmen/Anschrift/Kontakt,
  zusammenstehende Pflichtsterne, PLZ/Ort nebeneinander, responsive Einspaltenansicht,
  Autocomplete und DE/EN. Bestehendes Dialog-/Fokus-/Themeverhalten bleibt erhalten.
- `Customer.postalCode` durchgängig in DTO, JPA-Mapping, Memory, Frontend-Typ/Manifest,
  Formular, Übersicht/Adressanzeige, Suche und KI-Lesen/Filtern/Anlage/Änderung ergänzt.
  Text, höchstens 32 Zeichen, führende Nullen/internationale PLZ erhalten. Im Formular
  Pflichtfeld; Altclients/alte Chats ohne Feld bleiben kompatibel, Backend normalisiert
  fehlend/null auf leer. Bestehende Kunden ohne PLZ bleiben lesbar, keine erfundenen Werte.
- Neue Flyway **V6__customer_postal_code_global_industries.sql** ergänzt
  `ff_customers.postal_code VARCHAR(32) NOT NULL DEFAULT ''` und `ff_global_settings`
  als versionierte Singleton-Konfiguration mit zwölf anfänglichen Branchen. Frühere
  Migrationen unverändert. PostgreSQL dauerhaft, Memory nur bis Neustart. Lokale
  Frontend-Vorschau hält den Katalog sitzungsgebunden ohne API-Aufrufe.
- Annahme zur gewünschten globalen Verwaltung ausdrücklich mitgeteilt und umgesetzt:
  aktive angemeldete Nutzer dürfen lesen/auswählen; nur aktuelle Administratoren ändern.
  Neuer Einstellungsbereich „Globale Einstellungen“, eigener geschützter Endpunkt
  GET/PUT `/api/v1/settings/global`, eigene Revision/ETag und If-Match. PUT mit Origin/CSRF,
  403 für normale Nutzer, 409 für parallele Änderungen, 428 ohne Header, 400/422 für
  ungültige Daten. JPA-Zeilensperre, kein Überschreiben persönlicher Settings/Workspaces.
- Branchen: 1–100 Namen mit jeweils höchstens 100 Zeichen, trim/NFC, keine Kontrollzeichen
  oder Duplikate unabhängig von Großschreibung. Ausdrücklicher Speichern-Button, Entwurf
  bleibt bei Fehler erhalten, explizites „Neu laden und Entwurf verwerfen“. Offener Entwurf
  blockiert KI-Freigaben. Shared Context aktualisiert Dropdown nach Speicherung; alte
  Antworten nach Logout verworfen, keine automatischen Schreibwiederholungen/Ersatzbeispiele.
- Globale Namen sind Auswahldaten, keine neue Fremdschlüsselpflicht für Kunden. Entfernen/
  Umbenennen in der Liste verändert keine Kundendaten. Bisherige Werte außerhalb der Liste
  bleiben in der Bearbeitung erhalten. Kompatibler Workspace-/KI-Vertrag akzeptiert weiter
  historische Branchentexte. KI kann Katalog über `read_workspace(entity=industries)` lesen;
  globale Liste ändern ist kein KI-Werkzeug. Bestehende KI-Anlage/-Änderung bleibt verfügbar.
- Verifiziert: **193 Frontend-Tests**, Lint und strikter API-Produktionsbuild erfolgreich.
  Bestehende Vite-Chunkwarnung 542,29 kB (gzip 168,26 kB), kein Buildfehler. Abschließender
  isolierter echter PostgreSQL-Gesamtlauf: **200 erfolgreiche Backend-Tests, nur OpenAI-
  Live-Test übersprungen** (201 insgesamt), Maven package erfolgreich. Die Tests prüfen
  Upgrade mit Bestandskunden, PLZ führende Null/international, gemeinsames Lesen nach
  Start einer zweiten Backend-Instanz, Administratorrechte, CSRF/Origin/Revision, ungültige
  Listen, KI-Durchgängigkeit und Frontend-Lade-/Sitzungsfehler ohne Beispieldaten.
- Abschließender normaler H2/Memory-Gesamtlauf ebenfalls erfolgreich: **198 erfolgreiche
  Backend-Tests, drei Skips** (PostgreSQL-spezifisch, Performance, OpenAI; 201 insgesamt).
  Leere Kataloglisten ergeben gemäß bestehendem Bean-Validation-Vertrag 400, andere
  fachlich ungültige Listen 422; beide Speicherprofile und der API-Vertrag berücksichtigen dies.
- Keine echte OpenAI-Anfrage oder Remote-Installation durch den Agenten. Browserinventar
  leer; Versuch einer Vorschau meldete `Browser is not available: iab`. Deshalb keine
  visuelle Abnahme behaupten. Isolierte Testcluster gestoppt und Passwortdateien entfernt;
  vorhandene Dienste/Datenbanken nicht verändert.
- OpenAPI ergänzt PLZ, GlobalSettings, GET/PUT und den lesbaren KI-Katalog;
  **103 lokale Verweise aufgelöst**, API-Bundle geprüft. Leitfaden [customers.md](customers.md),
  Backend-/API-/Frontend-/Browserdokumentation sowie englische Setup-README aktualisiert.
- Vollständiges Uploadpaket neu erstellt und Prüfsummen verifiziert:
  Backend `fdfc3bb1bf142301eb138f941962b4019d8c9a1aff0039b3aca25875c9c7fdd2`,
  Frontend-Tar `7e6e39b5372b17d8f9ad5cec6b52593f848e764f5ad476c56e6f93153f1bcb15`.
  Frontend `index-Bfknu5R8.js`. Bestehende forgeflow-chat-Dateien zusammen mit Update-/
  Testskript übertragen. Update erstellt vorab Datenbankdump, V6 läuft beim Backendstart.
  Keine neue Installation/Pflichtvariable. Alter Backend-Downgrade kann neue PLZ beim
  Schreiben verlieren; keine manuelle SQL-Rücksetzung ohne Backup-/Datenerhaltprüfung.
  Deployment dieses Kundenformularpakets inzwischen vom Anwender bestätigt; aktueller
  Folgestand und noch offene Browserprüfung siehe Kundendetails oben.

KI-Assistent, bestätigte Änderungen bestehender Fachdaten, 24. Oktober 2026:

- Der Anwender hat das vorherige Abfrage-/Anlagepaket auf dem Server als funktionierend
  bestätigt und Änderungen beauftragt, ausdrücklich zusätzlich zur weiterhin gewünschten
  Anlage neuer Kunden/Projekte usw. Die Anlage bleibt unverändert verfügbar und wurde
  erneut mitgetestet. Kein Auftrag für Löschoperationen oder Konto-/Rollenänderungen.
- Neues Werkzeug `propose_workspace_update` ergänzt die bisherigen sechs Namen. Exakte
  eigene #ID oder eindeutiger Name/Titel; nur ausdrücklich gewünschte, freigegebene Felder.
  Bereiche: Kunden, Projekte, Aufgaben, Epics, geplante Sprints, Wiki-Artikel/Kategorien
  und Dateiumbenennen. Referenzen bleiben im eigenen Workspace/jeweiligen Projekt.
  Aktive/abgeschlossene Sprints und Projektzugehörigkeiten bleiben geschützt.
- `workspace.update` verwendet einen unveränderlichen Patch `data={id,...}` und vollständige
  bisherige Werte in `before`. Keine ungefragte Vollersetzung langer Datensätze. Karte zeigt
  alte/neue Werte in DE/EN; erst „Bestätigen und ändern“ schreibt. Fünf Minuten gültig,
  höchstens ein Vorschlag am Ende der Werkzeugfolge. Bestehender HTTP-Pfad
  `/ai/conversations/{id}/creations/{actionId}/decision` gilt kompatibel für beide Typen.
- Bestätigung prüft Sitzung/Inhaber, Revision, Vorherwerte und Fachregeln erneut. Konflikte
  nutzen weiterhin `AI_CREATE_CONFLICT`. Wiederholter Erfolg schreibt nicht erneut und
  erzeugt keine zweite Aktivität. Passende Aktivitäten für Aufgaben/Epics/Sprints/Dateien.
  PostgreSQL speichert Änderung und Chatstatus atomar; nachgelagerter Statusfehler rollt
  Fachänderung zurück. Dateiumbenennen erhält exakt die Bytes. Frontend nutzt denselben
  Schutz offener Formulare und dieselbe reine Lesewiederherstellung unsicherer Antworten.
- Geänderte bisherige/neue Textfelder jeweils höchstens 6000 Zeichen, beide Objekte je
  12000 JSON-Zeichen, Ergebnis insgesamt weiterhin 20000; keine still gekürzte Vorschau.
  Ungeänderte lange Inhalte bleiben erhalten. Weitere Limits/Providerkonfiguration bleiben
  erhalten. Keine neuen Dependencies, Migrationen oder Pflichtvariablen.
- Gespräche mit Updates verwenden **Aggregatformat 3**; aktuelles Backend liest 1–3.
  Alte reine Gespräche behalten Format 1/2. Ältere JARs können Format 3 nicht lesen;
  manueller Downgrade nach Nutzung benötigt Daten-/Backupprüfung, kein automatisches Restore.
- Verifiziert: **185 Frontend-Tests**, Lint, strikter TypeScript/API-Produktionsbuild erfolgreich.
  Chunkwarnung 531,91 kB (gzip 165,01 kB), kein Buildfehler. Vollständiger echter isolierter
  PostgreSQL-Lauf einschließlich der letzten beiden zusätzlichen Schutztests:
  **195 erfolgreiche Backend-Tests, nur OpenAI-Live-Test übersprungen** (196 insgesamt),
  Maven package erfolgreich. H2/Memory-Gesamtlauf davor: 191 erfolgreich, drei Skips
  (194 insgesamt); die danach ergänzten zwei Unitfälle sind im PostgreSQL-Gesamtlauf enthalten.
  Isolierten Prozess gestoppt und Passwortdatei entfernt; vorhandene Dienste unverändert.
  Keine echte OpenAI-Anfrage, visuelle Browserabnahme oder Remote-Installation durch den Agenten.
- Tests umfassen Vorher-/Nachherwerte aller acht Bereiche, Erhalt ungeänderter langer Texte,
  ungültige/mehrdeutige/fremde Referenzen, sensible Felder vor Audit, kein No-op-Vorschlag,
  geschützte Sprintzustände, Konflikte/Ablehnung/Ablauf/Sitzungswiderruf, parallele Freigaben,
  Versions-3-Roundtrip, JPA-Rollback/Wiederholung, Memory- und PostgreSQL-HTTP-Schutz,
  echtes SDK nur über Loopback, DE/EN-Karten und Nachlesen verlorener Antworten ohne POST-Replay.
- OpenAPI: **98 lokale Verweise geprüft**, getrennte Creation-/Update-Schemas und gemeinsame
  Mutation-Union, historische Entscheidungsroute erhalten. Leitfaden [ai-updates.md](ai-updates.md),
  Backend-, API-, Frontend-, Linux- und manuelle Browserdokumentation aktualisiert.
- Aktuelles vollständiges Uploadpaket neu erstellt und SHA-256 verifiziert:
  Backend `3a6316853f2fc0e6c9c07cbe8d747c6670cd121e5b8b19632fe3cd7cd488f704`,
  Frontend-Tar `6c1429a8ab4837d1012bf7a670c4525eb2956fc5702e5eefac42747ad9e2e45d`.
  Frontend `index-BUhsoBws.js`. Dateien `node_modules/.tmp/forgeflow-chat-*` zusammen mit
  `scripts/update-linux-chat.sh` und `scripts/test-linux-chat.sh` übertragen. Noch offen:
  Anwender spielt das Paar ein und prüft neue Änderungen sowie bisherige Anlagen im Browser.

KI-Assistent, bereichsübergreifende Abfragen und bestätigte Anlage, 24. Oktober 2026:

- Anwenderauftrag: „Ich will über die KI alles abfragen können und auch alles anlegen
  können“. Die Kundenanzahl kommt jetzt direkt aus der Kundenliste, unabhängig von
  Projektzuordnungen. `read_workspace` ergänzt Suche, exakte Anzahl, Detailansicht,
  Seitennavigation und validierte AND-Filter für Kunden, Projekte, Aufgaben, Aktivitäten,
  Epics, Sprints, Dateien, Wiki-Artikel/Kategorien sowie das eigene Profil und Einstellungen.
  Kontoliste nur für aktuelle Administratoren. Filter müssen zum gewählten Bereich gehören;
  unbekannte/sensible oder bereichsfremde Felder ergeben Fehler statt falscher Nullwerte.
- `propose_workspace_create` erzeugt geprüfte Vorschläge für Kunden, Projekte, Aufgaben,
  Epics, geplante Sprints, Wiki-Artikel/Kategorien, UTF-8-Textdateien und normale aktive
  Benutzerkonten. Namen/#ID werden ausschließlich im eigenen Workspace aufgelöst.
  Keine Schreiboperation durch Modellaufruf oder Chat-„ja“: erst die explizite Karte ruft
  POST `/ai/conversations/{id}/creations/{actionId}/decision` mit Entscheidung auf.
  Pro Nachricht höchstens ein Anlagevorschlag, fünf Minuten gültig. Revision, Sitzung,
  Kontoberechtigung und Fachregeln werden bei Bestätigung erneut geprüft. Wiederholte
  erfolgreiche Bestätigung legt keinen zweiten Datensatz an. Ablehnen speichert nichts.
- Kontoanlage bleibt administratorpflichtig; das Initialpasswort wird ausschließlich im
  separaten Kartenfeld erfasst und direkt an den Bestätigungsendpunkt übertragen. Kein
  Passwort/Hash in Modellargumenten, Aktionsdaten, Antworten oder Chat-/Ausführungshistorie.
  BCrypt und bestehende Passwortregeln bleiben erhalten. Keine Rollenänderung als Werkzeug.
- PostgreSQL speichert Fachänderung/Dateibytes/Konto und Aktionsstatus in derselben
  Transaktion. Nach `WorkspaceStorage.save`/EntityManager.clear wird die abgelöste
  Gesprächszeile erneut geladen. Rollbacktests für Workspace, Datei und Konto erzwingen
  einen nachgelagerten Statusfehler und prüfen vollständiges Zurückrollen sowie Wiederholung.
  Memory serialisiert Freigaben. Keine Transaktion bleibt während Provideraufrufen offen.
- Frontend zeigt Quellen und sämtliche Vorschlagsdaten in DE/EN mit Theme-Tokens.
  Offene Formulare/ausstehende Speicherungen blockieren Freigaben. Nach Erfolg wird der
  Workspace nachgeladen, ohne Komponenten auszuhängen oder zwischenzeitliche lokale
  Änderungen zu überschreiben; Kontoanlage aktualisiert die Benutzerliste. Verlorene
  Antworten werden nur nachgelesen, nicht automatisch erneut geschrieben.
- Alte Gespräche bleiben lesbar: reine Legacy-Aggregate behalten Format 1 und enthalten
  keine neuen leeren Felder. Neue Workspace-Ergebnisse/Anlagevorschläge verwenden Format 2;
  aktuelles Backend liest beide. **Ein altes Backend kann Format-2-Chats nicht lesen.**
  Ein manueller Downgrade nach Benutzung benötigt Daten-/Backupprüfung; kein automatisches
  Datenbank-Restore oder Löschen neuer Chats durch das Update-Skript.
- Keine neuen Dependencies, SQL-Migrationen oder Pflichtvariablen. Vorhandene Provider-,
  Zeit-, Schritt- und Ergebnisgrenzen bleiben bestehen; Werkzeugargumentgrenze jetzt 16000.
  Textdateien: UTF-8-Inhalt anlegen/lesen, binäre Anhänge nur Metadaten. PDF/Office/Bildanalyse,
  Chat-Dateiupload, Bearbeiten/Löschen bestehender Datensätze, Einstellungsschreibwerkzeuge,
  fremde Workspaces, externe HTTP-/Dateisystemzugriffe und Tickets bleiben außerhalb des Umfangs.
- Abschließend verifiziert am 24. Oktober nach der letzten Filterkorrektur: **185 erfolgreiche
  Backend-Tests gegen isoliertes echtes PostgreSQL, nur OpenAI-Live-Test übersprungen**
  (186 insgesamt), Maven package erfolgreich. Normaler H2/Memory-Lauf: **183 erfolgreich,
  drei Skips** (PostgreSQL-spezifisch, Performance, OpenAI). Isolierter PostgreSQL-Prozess
  gestoppt und temporäre Passwortdatei entfernt; vorhandene Dienste/Datenbanken unverändert.
  **182 Frontend-Tests erfolgreich**, Lint und strikter API-Produktionsbuild erfolgreich.
  Bestehende Vite-Chunkwarnung: 530,25 kB, gzip 164,61 kB. Keine echte OpenAI-Anfrage,
  visuelle Browserabnahme oder Remote-Installation durch den Agenten.
- OpenAPI: **96 lokale Verweise aufgelöst**, neuer Entscheidungsendpunkt/Write-only-Passwort
  und API-Frontend geprüft. Uploadpaket samt SHA-256 erneut erstellt und verifiziert:
  `node_modules/.tmp/forgeflow-chat-backend.jar`:
  `45e0e34ad886b84d564bd312d941185e97148aaa935d9439508019a49bf8b54f`;
  `node_modules/.tmp/forgeflow-chat-frontend.tar.gz`:
  `aee0410bd91d1b589fd51959218216e4d3e5cff686cc2831b100668d2366ecfd`.
  Frontend `index-bUkDsXxq.js`. Gemeinsam mit `forgeflow-chat.sha256`,
  `scripts/update-linux-chat.sh` und `scripts/test-linux-chat.sh` übertragen. Die Skripte
  haben sieben erfolgreiche Offlinefälle; ein Linux-Symlinkfall war unter Git Bash übersprungen.
- Details/Beispiele/Grenzen: [ai-workspace.md](ai-workspace.md). Backend-README, API-Vertrag,
  Frontend-, Linux- und Browser-Dokumentation aktualisiert. Nächster Anwenderschritt:
  vollständiges Paar auf Ubuntu einspielen, neu anmelden und neue Abfragen/Bestätigungskarten
  gemäß Browser-Prüfliste abnehmen. Alte Abschnitte unten dokumentieren frühere Meilensteine.

KI-Assistent, Meilenstein 4, 23. Oktober 2026:

- Vom Anwender freigegeben und umgesetzt: erstes vorhandenes Fachfeature als lesende
  KI-Werkzeuge. `ProjectTools` bietet `list_projects`, `get_project_summary` und
  `list_open_tasks` als Spring-AI-`ToolCallback`s an. Daten kommen ausschließlich aus
  `WorkspaceStorage.load` des im Ausführungskontext authentifizierten Kontos.
  Administratoren erhalten keinen Fremdzugriff. Keine neue Fach-API, keine Migration,
  keine Schreibaktion und keine Änderung der Workspace-Speicherverträge.
- Werkzeuge liefern höchstens zehn Projekte bzw. offene Aufgaben, Planung, Termine,
  Aufgabenanzahlen sowie begrenzte Namen/Titel/Codes. Keine langen Beschreibungen,
  Kundenkontakte, Wiki-, Datei- oder Kontoinhalte. Argumente: höchstens 2048 JSON-Zeichen,
  strikte Feld-/Typprüfung, Offset 0–10000, kein Modellargument für Benutzerkennung.
  Ergebnis maximal 20000 JSON-Zeichen mit Revision, Abrufzeit, Seiten-/Kürzungsanzeige.
  Namen werden exakt und ohne Beachtung der Großschreibung aufgelöst, `#ID` ist eindeutig.
  Teilweise passende oder mehrdeutige Namen verlangen Klärung; unbekannte/fremde
  Projekte liefern gleiches NOT_FOUND. Projekttexte bleiben nicht vertrauenswürdige Daten.
- `OpenAiModelGateway` lässt das Modell aus den registrierten Werkzeugen wählen.
  Pro Chat-Versuch höchstens ein Werkzeug und zwei Provider-Anfragen, danach
  `tool_choice=none`; weitere oder unbekannte Werkzeugaufrufe werden abgewiesen.
  Keine autonome Werkzeugschleife. Allgemeine Nachrichten lesen keinen Workspace.
  Gesamtzeitlimit, Account-/Sitzungsprüfungen, Abbruch und Kapazitätsgrenzen bleiben
  erhalten. Nach Abbruch während eines Datenbanklesens keine Weitergabe an den Provider.
  Usage summiert die zwei Anfragen; Chat-Versuchslimit zählt weiterhin logische Versuche.
- Konfiguriertes Modell bleibt erhalten. Für `gpt-6-luna`/Datumsvarianten wird wegen
  dessen dokumentierter Chat-Completions-Tool-Anforderung `reasoning_effort=none`
  gesetzt. Andere Modelloptionen bleiben unverändert. Spring AI bleibt bei 2.0.1,
  Spring Boot bei 4.1.1. Keine neue Abhängigkeit und keine echten API-Schlüssel gelesen.
- SSE ergänzt `tool` mit `started`/`completed`. Bestätigte Assistentennachrichten
  enthalten `tools`; der Gesprächsspeicher erhält diese zusammen mit dem Nachrichtenpaar.
  `ProjectToolResults.tsx` zeigt lesende Zugriffe, aufklappbare Quellen, Kennungen,
  Aufgabenstände und Abrufzeit auf Deutsch/Englisch im bestehenden Theme. Laufzeit-
  prüfung der Tool-Daten in `services/ai/projectTools.ts`, Fortschritt im Chat-Store.
  Hinweis zur Weitergabe abgefragter Projektdaten an OpenAI dauerhaft im Widget.
  Die Karten rendern Projektnamen ausschließlich als Text.
- Verifiziert: **151 Frontend-Tests**, ESLint und API-Produktionsbuild erfolgreich.
  **105 erfolgreiche Backend-Tests, 2 Skips** (echtes PostgreSQL und OpenAI-Live-Test).
  Echte SDK-Anfragen an einen lokalen HTTP-Testserver prüfen fragmentierte Tool-
  Argumente, strikte Schemas, tatsächlichen Aufruf des registrierten Werkzeugs,
  Eigentümerprojektion, Rückgabe als Tool-Nachricht, finale Streaming-/JSON-Antwort und
  summierte Usage. Zusätzlich: fremde/unklare Namen, ungültige Argumente, Seiten,
  Kürzung/Unicode, Sitzungswiderruf, Abbruch, verbotene/mehrfache Werkzeugaufrufe,
  normaler Chat ohne Datenzugriff, Quellen im bestätigten Verlauf und sichere UI-Ausgabe.
  Keine echte OpenAI-Anfrage, keine visuelle Browserprüfung und kein aktueller echter PG-Lauf.
  OpenAPI-JSON und 65 Schema-Verweise gültig.
- Aktualisierte Upload-Dateien verwenden weiterhin `node_modules/.tmp/forgeflow-chat-*`:
  Backend-JAR, Frontend-Tar und SHA-256-Liste. Frontend-Datei `index-BLFMfbkT.js`.
  Vorhandenes `scripts/update-linux-chat.sh` installiert das Paar mit Backup und Rollback;
  keine Backend-/Nginx-Konfigurationsänderung erforderlich. Noch nicht remote installiert.
  Befehle: `docs/linux-server.md`, Vertrag und Grenzen: `docs/ai-assistant.md`.
- Offen: Upload und Live-Prüfung des M4-Werkzeugaufrufs auf dem vorhandenen Server.
  Nächster Meilenstein ist Seitenkontext (M5). Schreibaktionen, autonome Schleifen
  und dauerhafte PostgreSQL-Gesprächsverläufe folgen später. Ticketsystem bleibt vertagt.

KI-Assistent, M4-Fehlerkorrektur, 23. Oktober 2026:

- Anwender meldete im neuen Widget bei „Welche Projekte habe ich“ die allgemeine
  Meldung `AI_UNAVAILABLE`. Der Screenshot zeigt keine konkrete Provider-Ursache.
- Lokal reproduzierter Fehler: Neu gebaute `OpenAiChatOptions` im Werkzeugpfad
  überschreiben das konfigurierte Modell mit dem Bibliotheksstandard `gpt-5-mini`.
  Ein echter SDK-Test gegen Loopback schlug mit erwartet `gpt-6-luna`, tatsächlich
  `gpt-5-mini` fehl. `OpenAiModelGateway.requestOptions()` kopiert jetzt `model.getOptions()`
  vor dem Ergänzen der Werkzeuge, sowohl für die Auswahl als auch für die finale Antwort.
- Regression prüft tatsächliche Requests beider Phasen: konfigurierter Modellname,
  Luna-Reasoning-Modus, Tokenlimit, kein Temperature-Parameter und `store=false`.
  Zweiter Durchlauf erhält auch einen anderen konfigurierten Modellnamen. Zwölf
  Providerlimit-Fälle verwenden nun den Werkzeugpfad und bestätigen einen Versuch
  ohne Retry und ohne Workspace-Zugriff.
- Verifiziert: Paketbuild mit **105 erfolgreichen Backend-Tests, 2 Skips** (echtes
  PostgreSQL und OpenAI-Live-Test), ESLint und API-Frontend-Build erfolgreich.
  Keine echte OpenAI-Anfrage und keine visuelle Browserprüfung durch den Agenten.
- Uploadpaket `node_modules/.tmp/forgeflow-chat-*` erneut erstellt; Frontend weiterhin
  `index-BLFMfbkT.js`. Installation mit `scripts/update-linux-chat.sh` und anschließende
  echte Chat-Prüfung durch den Anwender stehen aus. Serverkonfiguration bleibt erhalten.

KI-Assistent, fortgesetzte M4-Fehlerdiagnose, 23. Oktober 2026:

- Anwender meldet nach dem Modelloptionen-Fix dieselbe allgemeine Fehlermeldung.
  Die konkrete Live-Ursache ist weiterhin unbekannt. Keine weitere Behebung behaupten,
  bevor Modell, installierte Version und Provider-/Runtimefehler eingegrenzt sind.
- `OpenAiModelGateway` unterscheidet jetzt Provider-Konfigurationsfehler (400/404/422)
  und API-Zugriffsfehler (401/403), jeweils mit sicherer 503-Meldung. Browseranmeldung
  bleibt bei Provider-401 erhalten. Deutsche/englische Übersetzungen ergänzt.
- Bereinigte WARN-Diagnose: Phase, Providerstatus, bekannte Code-/Typ-/Parameterwerte;
  sonst `other`. Interne Fehler: Klassen und Codestelle, keine Originaltexte/Stacks.
  Neue Transporttests entdeckten, dass Spring AIs interner MessageAggregator dennoch
  vollständige Provider-Ausnahmen schreibt. Bibliothekslogs daher in `application.yml`
  deaktiviert. Logtests lesen diese Policy und prüfen, dass private Testwerte weder in
  Fehlermeldungen noch in erfassten Logereignissen erscheinen.
- `scripts/diagnose-linux-ai.py` liest vorhandene Ubuntu-Logs sowie Modell/JAR-Prüfsumme
  und gibt nur bekannte Fehlerkategorien aus. Kein Neustart, keine Konfigurationsänderung,
  kein Modellaufruf. Fünf Unitfälle in `scripts/test-linux-ai-diagnostics.py` vorbereitet;
  lokal fehlt Python, diese Tests und die Serverdiagnose sind noch nicht ausgeführt.
- Verifiziert: **151 Frontend-Tests**, ESLint und API-Build erfolgreich; **112 erfolgreiche
  Backend-Tests, 2 Skips** (echtes PostgreSQL/OpenAI). Vollständiger Paketbuild erfolgreich.
  Logtests sind gegen den von anderen Spring-Tests geänderten Root-Loglevel isoliert.
  Keine echte OpenAI-Anfrage und keine visuelle Browserprüfung.
- Aktuelles Uploadpaket erneut unter `node_modules/.tmp/forgeflow-chat-*` vorbereitet,
  Frontend `index-jZ8G_GsU.js`. Noch nicht installiert. Zunächst die vorhandenen Serverlogs
  mit dem Diagnosehelfer auswerten; nächste Aktion hängt von der Ausgabe des Anwenders ab.
- Anschließend vom Anwender auf Ubuntu ausgeführt: fünf Python-Diagnosetests bestanden.
  Servermodell aus `backend.env`: `gpt-6-luna`. Installierte JAR-Prüfsumme beginnt
  `be80d3be0d29`; das ist der frühere Modelloptionen-Fix, noch ohne neue Fehlerdiagnose.
  Lokales aktuelles Paket beginnt `42cb3a5b5e6e`. Update-Skript lief erfolgreich mit
  Backup `/opt/forgeflow/chat-update.ycG4bU`, installierte jedoch die frühere Upload-Datei.
  Alte Logs belegen OpenAI `BadRequestException`/HTTP 400 am 23. Oktober um 12:12 und
  12:28 UTC; genaue Ablehnung bleibt unbekannt. Nächster Schritt: aktuelle drei Paketdateien
  erneut hochladen/installieren, eine bewusste Chat-Anfrage testen und Diagnose erneut lesen.

KI-Assistent, finale M4-Anfrage korrigiert, 23. Oktober 2026:

- Neueste Anwenderdiagnose bestätigt installierten Diagnose-Build `42cb3a5b5e6e…`,
  Modell `gpt-6-luna` und um 15:31:17 UTC die Ablehnung `phase=final_answer`, HTTP 400,
  `code=absent`, `parameter=tool_choice`. Der Fehler liegt nach dem serverseitigen Lesen
  bei der finalen Modellantwort. Der Screenshot zeigt die neue Konfigurationsfehlermeldung.
- Die finale Anfrage schickte `tool_choice=none`, entfernte aber die Werkzeugdefinitionen.
  `OpenAiModelGateway.toolOptions` bildet jetzt für beide Phasen die gleichen
  Definitions-/Modelloptionen; Auswahl mit `auto`, finale Antwort mit `none`.
  Weitere Werkzeugaufrufe werden weiterhin zusätzlich im Backend abgewiesen.
- Echten SDK-Transporttest erweitert: finale Anfrage muss die gleichen drei Definitionen
  wie die Auswahl und `parallel_tool_calls=false` enthalten. Vor der Korrektur schlug
  der Test wegen fehlendem `tools` fehl, danach erfolgreiche Streaming-/JSON-Antwort.
  Modell-/Reasoning-/Tokenvertrag, Eigentümerprojektion, einmaliges Lesen, Grenzen und
  Zurückweisung weiterer Aufrufe bleiben durch die vollständige Suite geprüft.
- Verifiziert: **112 erfolgreiche Backend-Tests, 2 Skips** (echtes PostgreSQL/OpenAI),
  Paketbuild, ESLint und API-Frontend-Build erfolgreich. Frontend unverändert,
  `index-jZ8G_GsU.js`; seine 151 Tests wurden im vorherigen Durchlauf geprüft.
  Keine echte OpenAI-Anfrage durch den Agenten. Anschließend hat der Anwender bestätigt,
  dass die Projektabfrage mit dem korrigierten Build auf dem Server funktioniert.
- Uploadpaket `node_modules/.tmp/forgeflow-chat-*` neu erstellt und Prüfsummen geprüft.
  Aktuelle SHA-256-Liste gehört immer gemeinsam zu JAR/Frontend-Tar; erneut alle drei
  Dateien hochladen. Bestehendes Update-Skript und Serverkonfiguration bleiben erhalten.
- M4 ist damit auch durch den Anwender live bestätigt. Nächster dokumentierter
  Meilenstein: M5 „Context Awareness“ mit aktueller Route, ausgewähltem Projekt und
  serverseitig geprüftem Seitenkontext. Noch nicht begonnen; neue Schreib-/UI-Aktionen
  gehören zu M6, mehrstufige Ausführung zu M7 und persistente Verläufe zu M8.

KI-Assistent, Qualität und Deployment M9, 24. Oktober 2026:

- Nach dem M8-Paket hat der Anwender mit „ok weiter“ M9 beauftragt. Keine neuen Fachtools,
  UI-Funktionen, Provider, Dependencies oder Migrationen. M10 bleibt optional und unbegonnen.
- `AiPostgresIntegrationTest` führt denselben vorhandenen zwölfteiligen KI-HTTP-Vertrag
  wie Memory mit JPA aus. `AiPostgresStreamingHttpTest` wiederholt die drei echten Tomcat-
  Socket-Fälle für Abbruch, Verbindungsabbruch und Logout unter PostgreSQL. Keine bezahlten
  Modellanfragen; Mocks/Loopback bleiben die Vorgabe. Zwei kleine geschützte Hilfsmethoden
  und der Session-Testrecord ermöglichen Wiederverwendung statt kopierter Vertragstests.
- Echte PostgreSQL-Suiten verwenden je ein eigenes generiertes Schema für unabhängige
  Bootstrap-Konten. Der erste Gesamtlauf deckte eine Kollision zwischen den bisherigen
  Test-Administratoren auf. Die Trennung betrifft ausschließlich Tests; Produktion und
  AccountBootstrap wurden nicht verändert. Die zweite Backend-Instanz im Persistenztest
  verwendet ausdrücklich dasselbe Testschema.
- `scripts/test-postgres-isolated.ps1` erstellt einen neuen SCRAM-geschützten Testcluster
  unter dem ignorierten node_modules/.tmp, nutzt einen freien Loopback-Port, führt Maven
  package aus und stoppt danach den Cluster. Keine Anwendungskonfiguration, vorhandenen
  Dienste oder Datenbanken werden gelesen/verändert. Passwortdatei wird entfernt und
  Prozessumgebung wiederhergestellt. Daten/Logs bleiben zur Diagnose. Windows-Start nutzt
  einen versteckten postgres-Prozess mit pg_isready; direkte pg_ctl-Starts hielten anfangs
  geerbte Handles offen. Die betroffenen isolierten Instanzen wurden gezielt gestoppt;
  nach dem erfolgreichen Lauf waren alle Testinstanzen gestoppt und Passwortdateien entfernt.
- Optionale Performanceprüfung (`-Performance` / `-Dforgeflow.performance=true`): echte
  authentifizierte Tomcat-GETs mit zehn Gesprächen à zehn Turns und 50 Ausführungsläufen.
  Zehn Warmups + 100 Messungen je Endpunkt. Bericht backend/target/ai-performance.json,
  Snapshot node_modules/.tmp/ai-m9-performance-postgres.json. PostgreSQL 18.6 / Java 21.0.12.1:
  p95 Liste 35,06 ms, Verlauf 11,55 ms, Ausführungen 14,59 ms. Keine Provider-Anfrage.
  Nur lokaler Einzelclient, kein TLS-/Internet-/Provider-/Lasttest und keine Serverzusage.
- Update-Skript veröffentlicht index.html jetzt über eine fertige Datei und atomare
  Umbenennung im selben Verzeichnis, erst nach erfolgreichem Kopieren aller neuen Assets.
  Alte Assets bleiben erhalten. Auch bei Kopier-/Renamefehlern bleibt die alte Startseite.
  Öffentliche Auth-Prüfung umfasst jetzt Liste, Detail und Ausführungshistorie (je 401).
  Bestehende Sicherung/Rollback bleiben erhalten; keine neue Pflichtkonfiguration.
- Offline-Bash-Prüfung: sieben erfolgreiche Fälle für Archive, Rollback und Veröffentlichung;
  ein Symlink-Fall unter Git Bash übersprungen, auf Ubuntu auszuführen. Bash-Syntax und
  LF/kein BOM geprüft. Kein echter Ubuntu-Update-/Rollback-Ausfalltest durch den Agenten.
- Verifiziert: **175 Frontend-Tests**, Lint und strikter API-Produktionsbuild erfolgreich.
  Bestehende Chunkwarnung 516,23 kB (gzip 160,50 kB). **Echter PostgreSQL-Gesamtlauf:
  167 erfolgreiche Backend-Tests, nur OpenAI-Live-Test übersprungen** (168 insgesamt),
  Maven package erfolgreich. Normaler H2/Memory-Lauf: **165 erfolgreich, 3 Skips**
  (PostgreSQL-spezifischer Fall, Performance und OpenAI). Alle ohne Fehler.
- Neuer Betriebs-/Qualitätsleitfaden docs/ai-quality.md mit Testmatrix, Befehlen,
  Messergebnissen und Deploymentgrenzen. Backend-README, ai-assistant, linux-server und
  browser-check verlinken/erklären die Ergänzungen. API unverändert, 82 lokale OpenAPI-
  Verweise geprüft. Keine visuelle Browserprüfung oder Remote-Installation durch den Agenten.
- Paket node_modules/.tmp/forgeflow-chat-* geprüft, Frontend index-DZ4MNv5z.js. JAR und
  Frontend-Funktionalität entsprechen M8; M9 ergänzt Tests, Helfer und Update-Veröffentlichung.
  Backend SHA-256 `67eb59400358feed71cda13136e62724a98fa116b3cbca4ab06a9a272413ff71`,
  Frontend-Tar `dbeb71a9857d2ddb83f027bd227932fc115e89189a6b9dc6f5f3de78e87fd195`.
  Paket samt aktualisiertem update-linux-chat.sh und test-linux-chat.sh gemeinsam übertragen.
  Vollständige M8-Browser-Detailabnahme und M9-Serverupdate bleiben Anwenderschritte.

KI-Assistent, Gesprächspersistenz M8, 23. Oktober 2026:

- Der Anwender hat M7 nach seinem Deployment als funktionierend bestätigt und den nächsten
  Meilenstein beauftragt. M8 nutzt das bestehende PostgreSQL für Gesprächsverläufe und
  getrennte Ausführungshistorie. Keine neuen Fachschreibwerkzeuge, Provider oder Dependencies.
- `JpaConversationStore` ist im aktivierten KI-/Postgres-Profil zuständig; Memory bleibt
  flüchtig. Flyway V5 ergänzt `ff_ai_conversations`, `ff_ai_executions` und eine Sperrzeile
  für das globale Gesprächslimit. Bestätigte Nachrichtenpaare, Quellen, Seitenkontext,
  Idempotenzkennungen und private Freigabestatus liegen in einem versionierten Aggregat.
  Die letzten 50 Ausführungsläufe stehen separat mit Status/Zeiten/validierten Werkzeugschritten.
- Neue API: GET `/ai/conversations`, GET `/{id}/executions`, DELETE `/{id}`. GET `/{id}`
  ergänzt busy. Eigentümerprüfung gilt bei jeder Operation, auch für Administratoren;
  Löschen benötigt Origin/CSRF und entfernt beide Datenbestände atomar. Laufende Chats
  sind nicht löschbar. Kein Modellaufruf bei Listen, Laden, Historie oder Löschen.
- Gesprächszeilensperren serialisieren Commit, Abbruch, Löschung und Aktionsfreigaben.
  Keine Transaktion bleibt beim Modellaufruf offen. Laufzeitfreigabe AI_TIMEOUT+5s;
  verwaiste Läufe werden beim nächsten Zugriff als interrupted markiert, alte Commits
  mit AI_RUN_EXPIRED abgewiesen. Keine automatische Wiederholung oder Freigabeausführung.
- PostgreSQL-Aufbewahrung bei Inaktivität: optional AI_CONVERSATION_RETENTION (30d,
  zulässig 1d–365d). Lesen verlängert die Frist nicht; physische Bereinigung beim Anlegen
  eines neuen Chats. Backups separat. Memory behält AI_CONVERSATION_TTL. Bestehende
  flüchtige Chats werden nicht importiert. HTTP-Sitzungen/Versuchslimits bleiben flüchtig.
- Widget: „Unterhaltungen“ mit Wiederöffnen, letzten Ausführungen und bestätigtem Löschen,
  DE/EN, Theme-Tokens. Entwurf vor Gesprächswechsel ausdrücklich verwerfen. Gespeicherte
  Chats lassen sich nach Anmeldung wieder öffnen. Kein Chat in Local-/Session Storage.
- Tests: Persistenz über zweite Backend-Instanz, vollständige Commit-/Rollback-Grenzen,
  parallele Lauf-/Freigabeversuche, 50-Lauf-Grenze, Kontotrennung, Kaskadenlöschung,
  Aufbewahrung und verwaiste Läufe. HTTP prüft Eigentümer/Origin/CSRF; Frontend prüft
  Verwaltung, Validatoren, Entwürfe, Löschbestätigung und keine Modellanfrage beim Öffnen.
- Verifiziert: **175 Frontend-Tests erfolgreich**, ESLint ohne Warnungen, strikter TypeScript-
  und API-Produktionsbuild erfolgreich. Bestehende Vite-Größenwarnung für den Hauptchunk
  (516,23 kB; gzip 160,50 kB), kein Buildfehler. **150 Backend-Tests erfolgreich, 2 Skips**
  (optionales echtes PostgreSQL und OpenAI); Maven package erfolgreich. Die sieben neuen
  Persistenztests liefen mit H2 im PostgreSQL-Modus, einschließlich zweiter Backend-Instanz.
- OpenAPI mit **82 lokalen Verweisen**, Bash-Syntax des unveränderten Update-Skripts,
  Archivinhalt und SHA-256 geprüft. Uploadpaket `node_modules/.tmp/forgeflow-chat-*`,
  Frontend-Datei `index-DZ4MNv5z.js`:
  Backend `67eb59400358feed71cda13136e62724a98fa116b3cbca4ab06a9a272413ff71`,
  Frontend-Tar `3464f40340120e946ab9894a7123e6e0b9b4ea836de26b2f8848a6cdc7a6bf55`.
  Keine echte OpenAI-Anfrage. Echte PostgreSQL-/Browserprüfung des M8-Pakets und
  Remote-Deployment stehen aus; bestehende lokale Tests ersetzen diese Prüfung nicht.
  Nächster dokumentierter Meilenstein: M9 Qualität/Deployment; noch nicht begonnen.

KI-Assistent, mehrstufige Ausführung M7, 23. Oktober 2026:

- Der Anwender hat M6 live als funktionierend bestätigt und ausdrücklich den nächsten
  Meilenstein beauftragt. M7 erweitert ausschließlich die vorhandenen Lese- und
  Navigationsvorschlagswerkzeuge um begrenzte aufeinanderfolgende Schritte. Keine neuen
  Fachschreibaktionen, Datenquellen, Provider, Frameworks, Dependencies oder Migrationen.
- `OpenAiModelGateway.Execution` führt pro Subscription die manuelle Spring-AI-Schleife:
  bisherige Assistant-Tool-Calls/Tool-Antworten gehen in den nächsten Modellaufruf ein.
  `AI_MAX_TOOL_STEPS` ist optional, Vorgabe 4, zulässig 1–6. Maximal N+1 Provider-Anfragen;
  nach N Schritten erzwingt tool_choice=none die Textzusammenfassung. Gleiche Tool-Definitionen
  und konfigurierte Modell-/Token-/Reasoning-/Retry-Optionen bleiben in allen Phasen erhalten.
- Pro Modellantwort weiterhin maximal ein Tool, keine parallelen Aufrufe. Navigation,
  NOT_FOUND/AMBIGUOUS/INVALID_INPUT beenden die Werkzeugfolge. Vorschlag bleibt der letzte
  Schritt und wird erst beim atomaren Turn-Commit zur späteren M6-Freigabe registriert.
- `ProjectTools.Session` prüft jeden Schritt vor/nach Lesen unter der ursprünglichen Identität,
  bindet die Folge an dieselbe Workspace-Revision und verwirft Wiederholungen vor erneutem
  Lesen. Gleichwertige JSON-Feldreihenfolge/Leerraum/Großschreibung werden normalisiert.
  Wiederverwendete Provider-Call-IDs werden separat abgewiesen. Fehlercodes:
  AI_EXECUTION_LOOP (409), AI_WORKSPACE_CHANGED (409), AI_EXECUTION_RESULT_LIMIT (422).
- Gesamtgrenzen: AI_TIMEOUT unverändert (Vorgabe 20s), 16000 Antwortzeichen über alle Phasen,
  24000 JSON-Zeichen Werkzeugergebnisse insgesamt und weiterhin 20000 je Einzelergebnis.
  Token-Usage summiert alle Phasen; max-output-tokens gilt je Request, kein Euro-Budget.
  Der absolute Timeout verwendet eine feste monotone Deadline mit Reactor timeout-Publishern;
  Textabschnitte verlängern ihn nicht. Ein zunächst getestetes takeUntilOther mit Fehler-
  Publisher beendete den laufenden Provider nicht zuverlässig und wurde ersetzt. Der Test
  prüft ausdrücklich Cancel des zweiten kontinuierlich sendenden Modellstreams.
- `AgentDtos.Execution` und `AiModelGateway.Chunk` ergänzen SSE execution {phase,step,maxSteps}.
  Frontend prüft geschlossene Phasen/Zähler, zeigt DE/EN-Fortschritt und geordnete Quellenkarten,
  erhält bis zu sechs bestätigte Werkzeugergebnisse. Unvollständige/überlappende Schritte
  oder geänderte Grenzen werden abgewiesen. Nur done übernimmt den ganzen Turn.
- Fehler/Stoppen verwerfen die ganze unbestätigte Folge, erhalten den Entwurf und geben
  Laufkapazität frei. Kein automatisches Fortsetzen/Wiederholen, nur bestätigten Verlauf
  nachlesen. M6-Aktionsfreigaben bleiben separat, einmalig und ohne Provider-Anfrage.
  Gesprächs-/Ausführungsdaten bleiben im begrenzten Arbeitsspeicher; M8-Persistenz ist offen.
- Dokumentation: ai-assistant.md, backend-api.md, openapi.json, frontend.md, browser-check.md,
  linux-server.md und Backend-README aktualisiert. Root-README bleibt reine Einrichtung.
  Remote-Update erfolgt weiterhin als vollständiges forgeflow-chat-* Paar mit dem vorhandenen
  Update-Skript. Keine neue Pflichtvariable, Nginx-Änderung oder Datenbankmigration.
- Verifiziert: **171 erfolgreiche Frontend-Tests**, ESLint ohne Warnungen und
  TypeScript/API-Produktionsbuild erfolgreich. Bestehende Vite-Größenwarnung für den
  Hauptchunk (505,62 kB; gzip 157,66 kB), kein Buildfehler. **142 erfolgreiche Backend-Tests,
  2 Skips** (echtes PostgreSQL und OpenAI), Maven package erfolgreich. Neue Prüfungen
  umfassen mehrere echte SDK-/Loopback-Toolrunden, erzwungenes Finale, summierte Usage,
  Schritt-/Text-/Ergebnisgrenzen, Loop-/Revisionsschutz, Sitzungswiderruf, echtes Cancel
  des zweiten Providers, HTTP-Fortschritt/Commit, fehlerhafte Clientfolgen und Recovery.
- OpenAPI-JSON mit **75 lokalen Schemaverweisen** und passenden Laufzeitgrenzen geprüft,
  Bash-Syntax des unveränderten Update-Skripts, Archivinhalt und SHA-256 erfolgreich geprüft.
  Uploadpaket `node_modules/.tmp/forgeflow-chat-*`, Frontend-Datei `index-Dlz13J0C.js`:
  Backend `e5a9ae26f9e77cf2feb83b615b421d4bed4906d8c20467e15b4e20c9b9b17161`,
  Frontend-Tar `dfa0703108d8b7204a97e8d41136f127f42524e1514fe205923a60438ad6122f`.
  Keine echte OpenAI-Anfrage, kein aktueller echter PostgreSQL-Lauf, keine visuelle
  Browserprüfung und kein Deployment durch den Agenten. Anschließend hat der Anwender
  M7 nach seinem Deployment als funktionierend bestätigt; Detailprüfungen bleiben offen.

KI-Assistent, bestätigte Navigation M6, 23. Oktober 2026:

- Der Anwender hat nach bestätigtem M5 den vorgeschlagenen Navigationsteil von M6 mit
  „ok“ freigegeben: Projektübersicht, Aufgabenliste und Kanban öffnen. Keine Fachdatenänderung,
  Formularbefüllung, Editoränderung oder mehrstufige Ausführung beauftragt/implementiert.
- `propose_project_navigation(project, view)` ergänzt die drei Lesewerkzeuge. Exakter Name
  oder #ID, geschlossene Ansichten overview/tasks/board, eigene gespeicherte Projekte.
  Ein Werkzeug und höchstens zwei Provider-Anfragen je Chatversuch bleiben die Grenze.
  Das Werkzeug erzeugt nur einen typisierten Vorschlag mit fünf Minuten Gültigkeit.
- `NavigationActions`/`AgentActions`: unveränderliches Ziel, aktive ursprüngliche Kontoversion,
  Inhaber-/Origin-/CSRF-Prüfung, erneutes Projektlesen vor Freigabe. Erst ein vollständig
  bestätigtes Nachrichtenpaar registriert den Vorschlag. Ablehnung liest keine Fachdaten.
  Atomare einmalige Freigabe liefert executionId; Doppelklick/Replay erteilen sie nicht erneut.
- Zwei POST-Endpunkte: `.../actions/{actionId}/decision` und `.../result`. Status
  proposed/approved/rejected/succeeded/failed/expired; nur erlaubte Fehlercodes, keine privaten
  Fehlertexte. Ergebnisrückmeldung ist eine Browsermeldung, kein serverseitiger UI-Nachweis.
  GET und requestId-Replay zeigen aktuellen Status; nächste Chatnachricht erhält ihn als
  User-Metadatum. Metadaten zählen zum Verlaufslimit. Keine weiteren Provider-Anfragen
  bei Entscheidung/Ergebnis. Aktionen bleiben im begrenzten MemoryConversationStore.
- Frontend: Discriminated Union, Laufzeitvalidierung und Zielvergleich, Aktionskarte DE/EN,
  Bestätigen/Ablehnen, grüner Erfolg und Fehler/unklarer Zustand. Nur bestätigte Nachrichten
  zeigen bedienbare Karten. `ChatNavigationProvider` bindet an die vorhandene ProjectsPage;
  feste Route, Bestätigung durch tatsächlich sichtbaren M5-Kontext, Abbruch/3s-Zeitlimit.
- Offene Formulare/Dialoge, Kontoeingaben und nicht vollständig gespeicherter Workspace
  verhindern Navigation. Wiki-/Dev-Tools-Entwürfe bleiben gemountet. Verlorene Freigabe-
  oder Ergebnisantworten werden nie automatisch wiederholt: Verlauf lesen/neuen Vorschlag
  anfordern. Höchstens einmalige Freigabe, keine verteilte Exactly-once-Garantie.
- Keine Migration oder neue Konfiguration. Update erfolgt mit demselben geprüften
  `scripts/update-linux-chat.sh` und vollständigem `forgeflow-chat-*`-Paket. M6-Liveprüfung
  durch den Anwender bleibt offen; manuelle Fälle in `docs/browser-check.md`.
- Abschlussprüfung: **164 erfolgreiche Frontend-Tests**, ESLint ohne Warnungen,
  TypeScript/API-Produktionsbuild erfolgreich. Vite meldet eine Größenwarnung für den
  Hauptchunk (503,03 kB; gzip 156,81 kB), keinen Buildfehler. **128 erfolgreiche
  Backend-Tests, 2 Skips** (echtes PostgreSQL und OpenAI); Maven package erfolgreich.
  Zusätzlich OpenAPI-JSON und **75 lokale Schemaverweise**, Bash-Syntax des unveränderten
  Update-Skripts, Archivinhalt und beide SHA-256-Prüfsummen erfolgreich geprüft.
- Paket unter `node_modules/.tmp/forgeflow-chat-*`, Frontend-Datei `index-DFgp6DEj.js`:
  Backend `c403a40b97bd1e0defd9d33acd1742de170a27b8ec6cf71827a44089e9b8389e`,
  Frontend-Tar `5f17650dfd4d60072b7c616f331273eb2325b5c1f5b5138b9120f3bdcdc236bd`.
  Keine echte OpenAI-Anfrage, kein neuer PostgreSQL-Lauf, keine visuelle Browserprüfung
  und kein Deployment durch den Agenten. Anschließend hat der Anwender sein Remote-Update
  und M6 als funktionierend bestätigt. Zusätzliche manuelle Detailfälle nicht pauschal als
  geprüft behandeln; anschließend wurde M7 beauftragt.

KI-Assistent, Seitenkontext M5, 23. Oktober 2026:

- Vom Anwender nach erfolgreicher Live-Bestätigung des M4-Fixes freigegeben und jetzt
  lokal implementiert: aktuelle bekannte Route, sichtbar geöffnetes Projekt und dessen
  Tab als optionaler Nachrichtenkontext. Keine neuen Schreib-/UI-Aktionen (erst M6).
- Frontend: `services/ai/pageContext.ts` enthält den geschlossenen Katalog der zwölf
  echten Routen und acht Projekttabs. `ChatPageContextProvider` hängt am vorhandenen
  HashRouter; `ProjectsPage` veröffentlicht ausschließlich eine tatsächlich sichtbare
  Projektauswahl. Route-Key und Übersichtszustand verhindern alte Projektbezüge bei
  Navigation. Provider/Hooks sind für Fast Refresh getrennt. Der Chat bleibt außerhalb
  des Workspace-Lade-Gates erhalten und wird weiter pro Authentifizierung zurückgesetzt.
- `ChatWidget` zeigt „Seitenbezug“ beim Eingabefeld und pro Benutzer-/Teilnachricht,
  lokalisiert DE/EN im vorhandenen Theme. Kontext wird vor asynchronem Gesprächsstart
  kopiert. Gesendete Nachrichten behalten ihren Bezug bei Projekt-/Tab-/Modulwechsel.
  Bestehender Hinweis zur Weitergabe an OpenAI nennt jetzt auch den Seitenbezug.
- Kein Suchtext, keine URL-Parameter, Artikel-/Aufgabenauswahl, Editor-/Formularinhalte,
  REST-Daten oder Rollen aus dem Browser übertragen. Wiki/Dev Tools erhalten statische
  Hilfe zur Seite, keinen Zugriff auf private Eingaben. Keine neuen Abhängigkeiten.
- Backend: optionaler `AgentDtos.PageContext` an `SendMessage` und bestätigten Benutzer-
  nachrichten. `PageContexts` validiert Route, Feldkombinationen, IDs/Tab und ergänzt nur
  feste UI-Erläuterungen. Projekt-ID nur auf Dashboard/Projektliste mit Projektdetails;
  Tab ohne Angabe wird `overview`. Fehlender Kontext bleibt abwärtskompatibel.
- `ProjectTools.Session` prüft ausgewählte Kennungen im gespeicherten Workspace des
  authentifizierten Kontos vor dem Modellaufruf, auch für Administratoren. Gleicher
  `AI_PAGE_CONTEXT_UNAVAILABLE` für fehlende/fremde Projekte. Nach Lesen Sitzung und
  Laufaktivität erneut prüfen. Werkzeug liest danach frisch; Löschung ergibt NOT_FOUND.
  Die behauptete Browserseite ist keine Berechtigung und kein Beweis sichtbarer UI.
- Metadaten stehen als eigene User-Nachricht vor dem zugehörigen Text, nicht in der
  Systemanweisung. Historische Nachrichten behalten ihren eigenen Bezug; die jüngste
  Auswahl gilt für „hier/dieses Projekt“. Fakten weiter nur aus Werkzeugen; ohne
  Projektauswahl nachfragen. UI-Funktionen nur erklären, keine Ausführung behaupten.
- Normalisierter Kontext gehört zur Idempotenz: veränderter Text oder Kontext bei
  gleicher erfolgreicher `requestId` ergibt AI_REQUEST_MISMATCH. Frontend prüft den
  Bezug bestätigter Antworten und beim Nachladen nach Fehlern. Kontextmetadaten zählen
  zum variablen Zeichenbudget. Keine Datenbankmigration; Verläufe bleiben flüchtig.
- Verifiziert: **156 Frontend-Tests**, ESLint ohne Warnungen und API-Produktionsbuild
  erfolgreich. **119 erfolgreiche Backend-Tests, 2 Skips** (echtes PostgreSQL und OpenAI),
  vollständiger Paketbuild erfolgreich. Tests decken Router-/Projekt-/Tabwechsel,
  Übersicht, private Query-Parameter, Snapshot vor asynchronem Start, Antwortzuordnung,
  HTTP-Validierung, Eigentümer-/Admintrennung, Widerruf während Kontextlesen, veraltete
  Projekte, Idempotenz, Metadatenrollen/-Reihenfolge und tatsächliche SDK-Anfragen ab.
  OpenAPI-JSON und 67 Verweise gültig; zwölf Routen stimmen mit Frontend-Katalog überein.
- Uploadpaket erneut als `node_modules/.tmp/forgeflow-chat-*` vorbereitet und SHA-256
  geprüft. Frontend-Datei `index-DoainxLX.js`. Vorhandenes `scripts/update-linux-chat.sh`
  verwenden, alle drei Paketdateien neu übertragen. Serverkonfiguration bleibt erhalten.
  Keine echte OpenAI-Anfrage, keine visuelle Browserprüfung, kein neuer echter PG-Lauf
  und noch kein Serverdeployment durch den Agenten. Anschließend hat der Anwender
  bestätigt, dass M5 nach dem eigenen Deployment funktioniert. Einzelne zusätzliche
  manuelle Prüfungen stehen in `docs/linux-server.md` und `docs/browser-check.md`;
  diese nicht pauschal als ausgeführt behandeln. Anschließend wurde der Navigationsteil
  von M6 beauftragt; aktueller Stand im M6-Abschnitt darüber.

KI-Assistent, Meilenstein 3, 23. Oktober 2026:

- Nach dem erfolgreichen echten M2-API-Test hat der Anwender den Beginn des nächsten
  Meilensteins freigegeben. Umgesetzt sind das integrierte Chat-Widget im angemeldeten
  API-Modus, Streaming über POST-SSE, Status und gezielter Abbruch. Lokaler Datenmodus
  bleibt ohne Widget/API-Aufrufe. Öffnen allein sendet keine Modellanfrage.
- `frontend/src/components/chat/ChatWidget.tsx` und `chatStyles.ts`: schwebendes Widget,
  vorhandene Theme-Tokens, Deutsch/Englisch, Tastatur/Escape, Live-Regionen, schmale
  Fenster und reduzierte Bewegung. Schließen und Modulwechsel erhalten Entwurf,
  Verlauf und laufende Antwort. Stoppen beendet diese; ein neues Gespräch verlangt
  bei vorhandenem Verlauf Bestätigung. Modelltext wird ausschließlich als Text gerendert.
- `frontend/src/services/ai/`: begrenzter UTF-8-SSE-Parser, typgeprüfte Ereignisse,
  Repository mit bestehender Cookie-/CSRF-/Epoch-Behandlung und kontogebundener Store.
  Nur `done` übernimmt ein bestätigtes Nachrichtenpaar. Fehler/Abbruch verwerfen
  Teilantworten und erhalten den Entwurf. Nach Verbindungsverlust ausschließlich
  bestätigten Verlauf nachladen; kein automatischer weiterer kostenpflichtiger Versuch.
  Ein Rennen zwischen Stoppen und bereits eingetroffenem `done` ist gesondert getestet.
- Backend: bestehender JSON-Endpunkt bleibt erhalten. Neu sind
  `POST /api/v1/ai/conversations/{id}/messages/stream` sowie
  `POST /api/v1/ai/conversations/{id}/requests/{requestId}/cancel`.
  `AgentStreams` verwendet begrenzte Worker, den bestehenden Kapazitäts-/Versuchsschutz,
  expliziten Benutzer-/Sitzungskontext, Gesamtzeitlimit und sekündlichen Herzschlag.
  Abbruch, erkannter Verbindungsverlust und Sitzungswiderruf beenden die Provider-
  Subscription und geben die Freigabe zurück. Keine halben Nachrichtenpaare speichern.
  HTTP-Fehler vor Streambeginn bleiben JSON; spätere Fehler sind bereinigte SSE-Ereignisse.
- Spring MVC bleibt erhalten. Nur interne ASYNC-Dispatches sind von der erneuten
  URL-Autorisierung ausgenommen; ursprüngliche HTTP-Anfragen bleiben geschützt,
  Stream-Callbacks prüfen Sitzung und Kontoversion selbst weiter. Provider-Retries
  bleiben deaktiviert. Usage wird für Streams angefordert. `X-Accel-Buffering: no`
  und Herzschläge unterstützen die vorhandene Nginx-Konfiguration ohne deren Änderung.
- Verifiziert: **146 Frontend-Tests**, ESLint und API-Produktionsbuild erfolgreich;
  **93 Backend-Tests erfolgreich, 2 übersprungen** (echtes PostgreSQL und OpenAI-Live-Test).
  Die neuen Tests prüfen unter anderem echte lokale SDK-Streams mit UTF-8/Usage,
  Schließung des Provider-Sockets, echte lokale Tomcat-Verbindungen, sofortige Ausgabe,
  Abbruch, Verbindungsverlust, Logout, Fremdzugriff, Teilantworten, Entwürfe und Sprache.
  Keine echte OpenAI-Anfrage durch den Agenten und keine visuelle Browserprüfung.
  OpenAPI-JSON und 59 Schema-Verweise gültig; `git diff --check` erfolgreich.
- Vorbereitet: `node_modules/.tmp/forgeflow-chat-backend.jar`,
  `forgeflow-chat-frontend.tar.gz` und `forgeflow-chat.sha256` im selben Verzeichnis.
  Frontend-Datei `index-D0JLPnOw.js`, ausdrücklich mit API-Modus und `/api/v1` gebaut.
  `scripts/update-linux-chat.sh` prüft Prüfsummen, sichert Anwendung/Konfiguration/DB,
  installiert beide Teile und prüft HTTPS/Health/Anmeldeschutz. Fehler stellen die
  alten Anwendungsdateien wieder her. Keine Änderung an Backend-/Nginx-Konfiguration.
  Bash-Syntax und vier Offline-Regressionsgruppen bestanden; echter Symlink-Test
  benötigt Linux und wurde unter Git Bash übersprungen. Noch nicht remote installiert.
  Befehle: `docs/linux-server.md`, Details: `docs/ai-assistant.md`.
- Offen: Upload und Browserprüfung des M3-Widgets auf dem vorhandenen Server.
  Danach M4: erstes vorhandenes lesendes Projektwerkzeug; anschließend Seitenkontext,
  bestätigte Aktionen und spätere PostgreSQL-Chatverläufe. Aktuell weiterhin kein
  Zugriff auf Fachdaten oder Werkzeuge. Ticketsystem bleibt zurückgestellt.

KI-Assistent, Meilenstein 2, 23. Oktober 2026:

- Anschließend vom Anwender erfolgreicher echter Test gegen die Ubuntu-HTTPS-API:
  Anmeldung und Gesprächserstellung erfolgreich, echte deutsche KI-Antwort erhalten;
  gemeldete Usage 110 Eingabe-/39 Ausgabetoken, `truncated=false`. Diesen kostenpflichtigen
  Test hat der Anwender ausgeführt. Kein automatischer Zugriff auf Fachdaten oder Aktionen.
  Die neuere lokale Fehlerklassifikation wurde dabei nicht als remote installiert bestätigt.
- Die Terminalantwort zeigte falsch dekodierte Umlaute. Lokalen API-Testhelfer korrigiert:
  `Invoke-WebRequest -UseBasicParsing` mit expliziter UTF-8-Auswertung der Rohbytes und
  gemeinsamem Cookie-Speicher statt impliziter Windows-PowerShell-5.1-JSON-Dekodierung.
  Bestehende CSRF-/Fehlerdiagnose und einmalige Anfrage bleiben erhalten. Sechs Offline-
  Prüfgruppen erneut erfolgreich, jetzt mit Umlauten/Emoji in einer JSON-Antwort ohne
  Charset und mit absichtlich falsch dekodiertem `Content` als Regression. Kein Serverupdate
  für diese Skriptkorrektur nötig; erneute echte Terminalprüfung des Anwenders steht aus.
- Nächster echter Server-Test des Anwenders: Anmeldung erfolgreich, KI-Unterhaltung
  angelegt; Modellaufruf scheiterte mit `503 / AI_PROVIDER_LIMIT`. Der bisherige Adapter
  verwendete diesen Code für jede OpenAI-429-Antwort. Daher ist nur eine Provider-Begrenzung
  belegt, nicht die genaue Ursache; API-Guthaben/Budgets und Rate-Limits sind zu unterscheiden.
- `OpenAiModelGateway` klassifiziert nun bekannte sichere SDK-Fehlercodes:
  `AI_QUOTA_EXCEEDED` für Guthaben/Kontingent/Budgets, `AI_RATE_LIMITED` für bekannte
  Anfragelimits und neutraler `AI_PROVIDER_LIMIT` für unbekannte 429-Fälle. Keine Ausgabe
  der Original-Providertexte; kein automatischer Retry. SDK-`code` wird vor dem allgemeineren
  `type` ausgewertet. Dokumentation nennt API-Abrechnung und Organisations-/Projektlimits.
- Maven-Paketbuild: **82 erfolgreiche Tests, 2 Skips** (echtes PostgreSQL und OpenAI-Live-Test).
  Zwölf lokale HTTP-429-Fälle prüfen echten SDK-Parser, Guthaben-/Budgetcodes, Rate-Limits,
  Typ-Fallback, unbekannte Codes, redigierte Originaltexte und genau einen Provider-Versuch.
  Keine echte OpenAI-Anfrage durch den Agenten. Die aktualisierte JAR ist für den Upload
  unter `node_modules/.tmp/forgeflow-ai-backend.jar` vorbereitet; nicht remote installiert.
  Eine Korrektur der Abrechnung/Limits kann bereits mit der bestehenden Server-JAR wirken.
- Serverdiagnose im Anschluss: Anwender zeigte einen erfolgreichen Backend-Start mit
  PostgreSQL/V4; öffentlicher Health-Aufruf durch den Agenten meldete ebenfalls `ok`.
  Danach lieferte der interaktive KI-Test HTTP 503, während Browser-Anmeldung funktionierte.
  Der bisherige PowerShell-Fehlertext verlor dabei den Backend-Code. Ursache dieses 503
  ist noch nicht bestimmt; weder falsche Zugangsdaten noch deaktivierte KI behaupten.
- `scripts/test-ai-api.ps1` nennt jetzt erfolgreiche Zwischenschritte und beim Fehler
  den Schritt, HTTP-Status und strukturierten Backend-Code. Windows-PowerShell-5.1-Fallback
  liest denselben Fehler-Response, ohne einen möglicherweise kostenpflichtigen POST zu
  wiederholen. Keine Ausgabe beliebiger HTML-Fehlerseiten. Sechs Offline-Prüfgruppen
  bestanden, einschließlich `AI_DISABLED`, `AI_UNAVAILABLE` und `INVALID_CREDENTIALS`
  aus Response-Stream bzw. `ErrorDetails`, jeweils mit korrektem Logout-Verhalten.
  Nur lokale Skriptänderung; neuer Testlauf des Anwenders steht aus, kein JAR-Update nötig.
- Anschließend vom Anwender direkter Test auf Ubuntu angesprochen. Dafür
  `scripts/update-linux-ai.sh` (nur Backend, JAR-/Konfigurations-/DB-Sicherung,
  Health-Prüfung und JAR-Rollback) und `scripts/test-ai-api.ps1` vorbereitet.
  Der Test fragt das Anwendungskonto ab und arbeitet gegen die öffentliche HTTPS-API;
  er benötigt den KI-Schlüssel ausschließlich im Backend. Drei Offline-Prüfgruppen
  für CSRF-Erneuerung, UTF-8, Erfolgs-/Fehler-Logout und sichere Zieladressen bestanden;
  Bash-Syntax und Ablehnung ungültiger Deployment-Argumente geprüft. Kein echter
  Ubuntu-Update-/Rollback-Lauf oder kostenpflichtiger Modelltest ausgeführt.
  `node_modules/.tmp/forgeflow-ai-backend.jar` ist eine SHA-256-identische Kopie der
  geprüften JAR. Konkrete Upload-/Aktivierungs-/Testbefehle in `docs/linux-server.md`.
- Der Anwender hat `chatbot_handoff.md` als Grundlage eingebracht, zunächst ausschließlich
  Analyse verlangt und nach dem Architekturbericht den Implementierungsbeginn freigegeben.
  Umgesetzt ist die Backend-Grundlage; Chat-Widget/SSE, echte Projektwerkzeuge, Seitenkontext,
  bestätigte Aktionen und PostgreSQL-Chatverläufe folgen in den weiteren Meilensteinen.
- Spring-AI-BOM 2.0.1 mit `spring-ai-openai`, explizite bedingte Modellkonfiguration statt
  Starter-Autokonfiguration. Java 21 und Spring Boot 4.1.1 unverändert. Keine neue
  Frontend-Abhängigkeit, keine Änderung an Fachspeicherung oder Datenbankschema.
- Standard `AI_ENABLED=false`: kein KI-Client, kein Gesprächsspeicher, kein Schlüssel nötig.
  Bei Aktivierung sind `OPENAI_API_KEY` und `AI_MODEL` serverseitig erforderlich. Kein Modell
  fest voreingestellt; feste OpenAI-Zieladresse. Ausgabetoken, Timeout und Grenzen konfigurierbar.
  Provider-Retries aus, `store=false`, keine feste Temperaturvorgabe.
- Neu unter `backend/src/main/java/de/forgeflow/ai/`: Konfiguration, DTOs,
  `AgentController`, `AgentService`, `AgentExecutionContext`, `AgentLimits`,
  `ConversationStore`/`MemoryConversationStore` und `AiModelGateway`/`OpenAiModelGateway`.
  Drei geschützte JSON-Endpunkte zum Erstellen/Lesen eines Gesprächs und Senden einer Nachricht.
- Bestehende Cookie-/CSRF-/Origin-Prüfung bleibt aktiv. Serverseitige Kontotrennung,
  Sitzung/Kontoversion vor und nach Modellaufrufen prüfen; keine vom Client gelieferten
  Rollen, Eigentümer oder Systemnachrichten. Fremde IDs sind nicht von unbekannten unterscheidbar.
- Speicher ist in allen Profilen flüchtig und begrenzt. Ein laufender Aufruf je Konto,
  insgesamt zwei als Vorgabe, Anfragelimit über vorhandenen `AttemptLimiter`. Historygrenze
  zählt Zeichen, keine exakten Eingabetoken. Keine dauerhaften Tages-/Eurobudgets in M2.
- Erfolgreiche Anfragekennungen werden mit identischem Text ohne erneute Modellkosten
  wiedergegeben. Fehler hinterlassen keine halben Nachrichtenpaare. Zeitlich unklare,
  fehlgeschlagene oder abgelaufene Anfragen haben keine dauerhafte Idempotenzgarantie.
  Browser-Abbruch beendet in M2 den synchronen Provider-Aufruf noch nicht garantiert;
  der SDK-Timeout greift. Streaming und gezielter Abbruch folgen in M3.
- Provider-Fehler bleiben generisch, Timeouts sind `504 / AI_TIMEOUT`. Leere/überlange,
  blockierte oder unerwartete Tool-Antworten werden verworfen. Ungültige Pfadparameter
  werden im vorhandenen `ApiErrors` nun ebenfalls als strukturierter 400-Fehler behandelt.
- Maven-Paketbuild erfolgreich: **71 Backend-Tests bestanden, 2 übersprungen**
  (echtes PostgreSQL und ausdrücklich aktivierbarer OpenAI-Live-Test). Der SDK-Vertrag,
  `store=false`, Ausgabelimit, fehlende Tools, keine Provider-Retries und ein echter
  Transport-Timeout wurden gegen einen lokalen HTTP-Testserver geprüft. Keine kostenpflichtige
  OpenAI-Anfrage ausgeführt. Bestehende Datenbanktests verwendeten H2, kein echter PG-Lauf.
- Frontend unverändert: Lint, Produktionsbuild und alle **128 Tests** bestanden.
  OpenAPI-JSON/Schema-Verweise und PowerShell-Beispielsyntax geprüft. Keine visuelle Prüfung.
- Einrichtung, API-Beispiele und Grenzen stehen in `docs/ai-assistant.md`; Backend-README
  und `docs/backend-api.md` verlinken darauf, `docs/openapi.json` enthält den Vertrag.
  Ausführbare JAR unter `backend/target/backend-0.1.0-SNAPSHOT.jar`. Die anfängliche
  Serverübertragung und Aktivierung wurden inzwischen durch den erfolgreichen echten
  Test bestätigt (siehe oben); Stand der neueren lokalen JAR remote weiter unbestätigt.
  Chat-Widget/Streaming und die weiteren Meilensteine bleiben offen.

Speicherbenachrichtigungen statt Synchronisationsfeld, 23. Oktober 2026:

- Das dauerhafte Workspace-Feld „Daten mit dem Backend synchronisiert.“ wurde entfernt.
  `WorkspaceNotifications` zeigt stattdessen unten rechts einen kompakten Hinweis mit
  grünem Häkchen, sobald das Backend alle aktuellen Fachänderungen bestätigt hat.
  Kein Speichererfolg beim initialen Laden, Laden des Serverstands oder in lokalen Beispieldaten.
  Das gilt für den gemeinsamen Workspace einschließlich Projekten, Kunden und Wiki;
  Einstellungs- und Kontoformulare behalten ihre bisherigen eigenen Rückmeldungen.
- Erfolgshinweise verschwinden nach fünf Sekunden und können geschlossen werden.
  Mauskontakt und Tastaturfokus pausieren die Anzeigezeit. Neue Änderungen entfernen
  überholte Erfolgshinweise. Sprachwechsel aktualisiert den Text ohne neuen Timer.
- Speicherfehler bleiben rot mit tatsächlicher, übersetzbarer Fehlerursache sichtbar.
  Wiederholen und bestätigtes Laden des Serverstands bleiben verfügbar. Bei einem
  Revisionskonflikt gibt es kein blindes Wiederholen. Lokale Änderungen und Warnung
  beim Verlassen der Seite bleiben geschützt. Fehler verschwinden nicht durch einen Timer.
- Explizite Hinweise im Workspace-Store vermeiden verlorene Meldungen bei schnellen,
  gebündelten Schreibvorgängen. Alte Antworten/Timer dürfen keinen neuen Hinweis verändern;
  Neuladen und Sitzungswechsel entfernen die bisherigen Hinweise/Timer.
- Hell/dunkel, Deutsch/Englisch, Screenreader-Live-Regionen und reduzierte Bewegung berücksichtigt.
  Lint, Produktionsbuild und alle **128 Frontend-Tests** bestanden; acht neue Tests für
  Speicherabschlüsse, Fehler/Wiederholen, Konflikte, Zeitsteuerung und Sitzungswechsel.
  Keine visuelle Browserprüfung; Backend unverändert und nicht erneut getestet.
- Vorbereitet: `node_modules/.tmp/forgeflow-frontend-notifications.tar.gz`, Produktionsdatei
  `index-BbfQdHaz.js`. Das Archiv enthält auch die vorherigen Wiki-/Dev-Tools-Übersetzungen.
  Übertragung und öffentliche Browserprüfung stehen aus; Befehle in `docs/linux-server.md`.

Deutsch/Englisch für Wiki und Dev Tools, 22. Oktober 2026:

- Neuer ausdrücklicher Auftrag: Die vorhandene Sprachwahl soll auch Wiki und Dev Tools
  übersetzen. Dafür gemeinsame `useTranslation`-Anbindung und getrennte Wörterbücher
  für Einstellungen, Wiki, Tools und gemeinsame Navigation ergänzt.
- Wiki: Navigation, Übersichten, Suche, Editor/Vorschau, Kategorien, Dialoge, Zähler,
  Validierung und Rückmeldungen übersetzt. Datumsanzeigen und alphabetische Sortierung
  verwenden die gewählte Sprache. Eigene Titel, Kategorien und Markdown bleiben unverändert.
- Dev Tools: JSON Formatter, REST-Client, Rechner und alle Konverter einschließlich
  Einheiten, Platzhaltern, Kopiermeldungen, statischen/dynamischen Fehlern und Statusanzeigen.
  Sprache ändert keine Eingaben, JSON-Zahlen, Ergebnisse oder REST-Antworten und löst
  keine zusätzlichen REST-Anfragen aus. Gemeinsame Navigation, Header, Dialog-Schließlabel
  sowie Workspace-Speicherstatus sind ebenfalls angebunden.
- Englische Sprache wird aus der bestehenden V4-Einstellung übernommen; kein neues
  Backend und keine Datenbankmigration erforderlich. Andere Projektmanager-Inhalte
  bleiben Deutsch. Der Sprachhinweis in den Einstellungen nennt den erweiterten Umfang.
- Lint, Produktionsbuild und alle 120 Frontend-Tests bestanden (12 neue Prüfungen für
  Übersetzungen und gerenderte Komponenten). Darunter Entwurf/Vorschau, Sprachwechsel
  bestehender Fehler, JSON mit großer Ganzzahl, Rechenverlauf, Einheiten, REST-/Clipboard-
  Daten und Navigation. REST und Clipboard sind in den Tests simuliert; keine echten
  externen Anfragen oder Kopiervorgänge. Keine visuelle Browserprüfung.
- Direkte JSX-Texte in Wiki/Dev Tools geprüft: verbleibend nur sprachunabhängige
  Begriffe/Symbole `JSON`, `Text` und `ms`. Backend-Tests bei dieser Frontend-Änderung
  nicht erneut ausgeführt.
- Vorbereitet: `node_modules/.tmp/forgeflow-frontend-language.tar.gz`, Produktionsdatei
  `index-Cugorb9U.js`. Übertragung und öffentliche Browserprüfung stehen noch aus;
  konkrete Befehle unter `docs/linux-server.md`. Backend muss nicht neu gestartet werden.

Einstellungsmenü und Sprachwahl, 22. Oktober 2026:

- Der Anwender bestätigte die Kontoformular-Korrektur als funktionierend und beauftragte
  ein Menü für Nutzerverwaltung, Optik, Projektmanager und Sprache (Deutsch/Englisch).
- `SettingsPage.tsx` bietet eine eigene seitliche Navigation, in schmalen Fenstern oben.
  Die Kategorie steht in `?category=users|appearance|projects|language`; ungültige Werte
  zeigen Optik. Kontoformulare bleiben zwischen Kategorien gemountet und behalten Entwürfe.
  Speicherstatus, Fehler und Wiederholen bleiben auch in der Nutzerverwaltung zugänglich.
- `AppSettings.language` unterstützt `de`/`en`, mit Deutsch als Standard auch für alte
  Datensätze. Frontend-Normalisierung, API-Vertrag, Memory-/JPA-Speicherung und Flyway V4
  sind ergänzt. V4 fügt `ff_settings.language` mit Vorgabe `de` hinzu und erhält die
  bisherigen Theme-/Projektmanager-Werte. Alte Requests ohne Sprache bleiben gültig.
- Der genaue Umfang einer vollständigen App-Übersetzung wurde optional nachgefragt;
  ohne Antwort ausdrücklich zunächst der Einstellungsbereich umgesetzt. Dessen Menü,
  allgemeine Einstellungen und Kontoformulare unterstützen Englisch. Andere Module
  bleiben Deutsch. Übersetzungen ändern keine Benutzereingaben.
- Verifiziert: Lint, Produktionsbuild, 108 Frontend-Tests; Backend-Paket mit 39 erfolgreichen
  Tests und einem PostgreSQL-spezifischen Skip. Darunter Sprachvalidierung im Memory-/JPA-
  HTTP-Vertrag, Erhalt alter Einstellungen beim Upgrade und Englisch nach einer neuen
  Backend-Instanz. Der Upgrade-Test verwendet dateibasierte H2-Testdaten, da H2 2.4.240
  im persistenten Memory-Modus geschlossene Flyway-Sitzungen in IN-Constraints festhielt.
- Keine visuelle Browserprüfung und kein aktueller Lauf gegen echtes PostgreSQL.
  Anleitung: `docs/linux-server.md`, Details: `docs/user-settings.md`.
- Vorbereitet: `scripts/update-linux-settings.sh` und unter `node_modules/.tmp/`
  `forgeflow-settings-frontend.tar.gz`, `forgeflow-settings-backend.jar`.
  Das Skript sichert Programmdateien und die lokale Datenbank `forgeflow`, startet das
  Backend mit Migration, aktualisiert das Frontend und prüft HTTPS. Fehler stellen
  Programmdateien wieder her; die additive Migration bleibt bestehen. Nur Bash-Syntax,
    ungültige IP-Eingaben und LF-Zeilenenden lokal geprüft.
- Anschließend vom Anwender auf Ubuntu ausgeführt: `Settings update ready`,
  Sicherung `/opt/forgeflow/settings-update.Xl7DaM`. Zehn anfängliche Verbindungsfehler
  während des Backend-Neustarts wurden durch die Wiederholungen überwunden.
  Der Agent bestätigte von außen die neue Frontend-Datei `index-BiJ_2Lb7.js` und
  die Health-API mit `status=ok`, `storage=postgresql`. Öffentliche Browserprüfung
  der neuen Menübereiche und Sprachpersistenz bleibt noch offen.

Rückmeldung aller Kontoformulare, 22. Oktober 2026:

- Der nächste Screenshot zeigte „Benutzer anlegen“, nicht das Passwortformular.
  Die vorherige Korrektur war bereits öffentlich als `index-Dktcaz99.js` ausgeliefert;
  sie hatte die Rückmeldung im Benutzerformular noch nicht angepasst.
- Profil, Passwort, Benutzeranlage und Aktivierungsdialog verwenden jetzt jeweils
  Rückmeldungen am betätigten Formular, mit Fokus bei Fehler/Erfolg und bei wiederholtem
  Versuch. Ladefehler der Kontoliste sind getrennt; eine späte Listenantwort löscht
  keine Formularfehler mehr. Laufende Vorgänge und lokale Sperrgründe sind sichtbar.
  Benutzeranlage erklärt die unveränderte Passwortrichtlinie direkt am Formular;
  fehlgeschlagene Anlage erhält Eingaben zur Korrektur.
- Acht neue Komponententests senden die gerenderten React-Formulare mit simulierten
  HTTP-Antworten ab. Gegen den vorherigen Stand schlugen sieben davon fehl; nach der
  Korrektur bestehen alle 101 Frontend-Tests. Lint und Produktionsbuild bestanden.
  Test-Renderer und TypeScript-Typen sind reine Entwicklungsabhängigkeiten für React 18;
  `frontend/scripts/test.mjs` lädt die Komponententests über Vites TSX-Transformation.
- Keine visuelle Browserprüfung und keine Änderung echter Konten durch den Agenten.
  Neues Deployment-Paket: `node_modules/.tmp/forgeflow-frontend-account-forms.tar.gz`.
  Übertragung und öffentliche Formularprüfung durch den Anwender stehen noch aus.

Rückmeldung beim Passwortwechsel, 22. Oktober 2026:

- Der Anwender meldet beim öffentlichen Betrieb einen scheinbar wirkungslosen Klick
  auf „Passwort ändern“. Lokale Passwortvalidierung stand bisher am Anfang des gesamten
  Kontobereichs, API-Fehler nur im Header; beide konnten außerhalb des sichtbaren Formulars liegen.
- `AccountSettings.tsx` zeigt lokale Validierungsfehler und API-Fehler nun unmittelbar
  im Passwortformular. Eine fokussierbare Alert-Meldung erhält bei jedem erneuten Versuch
  den Fokus und ist mit den Passwortfeldern verknüpft. Laufende Anfragen sind am Button
  und über `aria-busy` erkennbar; bei Fehlern bleiben Eingaben für eine Korrektur erhalten.
- Lint, alle 93 bestehenden Frontend-Tests und Produktionsbuild erfolgreich.
  Der Browser-Connector meldete leere Browser-/App-Inventare; keine interaktive oder
  visuelle Prüfung des geänderten Formulars. Kein echtes Benutzerpasswort wurde geändert.
- Aktualisiertes Frontend muss noch auf den Server übertragen und dort im Browser
  geprüft werden. Backend und Datenbankschema benötigen für diese Korrektur kein Update.

Linux-Betrieb und öffentlicher Zugriff, 22. Oktober 2026:

- Der Anwender hat Java/Nginx/PostgreSQL auf Ubuntu eingerichtet und die lokal gebauten
  Dateien auf den Server übertragen. Nach Korrektur des Datenbankpassworts meldete der
  Backend-Health-Aufruf auf dem Server `status=ok` und `storage=postgresql`.
- Nutzerentscheidung: Die Seite soll direkt über die öffentliche IP im Browser laufen.
  Die zuvor vorgeschlagene Einschränkung auf einen SSH-Tunnel entsprach diesem Ziel nicht.
- Neu vorbereitet: `scripts/enable-linux-public.sh` für HTTPS direkt auf einer IPv4-Adresse,
  mit Let's-Encrypt-IP-Zertifikat (Certbot 5.4+), Nginx, Origin-/Cookie-Anpassung,
  Konfigurationssicherung, Wiederherstellung bei Fehlern und automatischer Erneuerung.
  Anleitung und konkrete Befehle: `docs/linux-server.md`.
- Lokal geprüft: Bash-Syntax, drei ungültige IP-Eingaben, LF-Zeilenenden, Lint und
  API-Produktionsbuild. Der erste Skriptlauf beim Anwender brach vor Änderungen wegen
  eines vermeintlichen TLS-Standardserver-Konflikts ab. Die Prüfung zählte auch
  kommentierte Listener mit; korrigiert, mit Dateiangabe bei aktiven Konflikten.
    Der zweite Lauf erreichte Certbot, die Zertifizierungsstelle erhielt jedoch HTTP 404
    für die Challenge-Datei. Nginx-/Backend-Konfiguration wurde wiederhergestellt.
    Die genaue 404-Ursache ist noch offen. Neu: Webroot-Rechte explizit setzen, Prüfdatei
    vor Certbot lokal und über die öffentliche IP mit exaktem Inhaltsvergleich abrufen,
    Pfadberechtigungen bei Fehler ausgeben; ERR-Rollback läuft nur noch im Hauptprozess.
    Zwölf lokale Prüfungen (`bash scripts/test-linux-public.sh`) bestanden unter Git Bash,
    POSIX-Verzeichnisrechte dort übersprungen. Bash-Syntax, Lint und Build bestanden.
  - Der nächste Serverlauf war erfolgreich: HTTP-Challenge-Selbstprüfung bestanden,
    IP-Zertifikat ausgestellt (Ablauf laut Ausgabe 29. Oktober 2026), simulierter
    Erneuerungslauf einschließlich Nginx-Deploy-Hook erfolgreich. Zwei vorübergehende
    HTTP-502-Antworten wurden durch die vorhandenen Wiederholungen überwunden;
    Abschlussmeldung `Ready: https://185.56.150.178`.
    Konfigurationssicherung: `/etc/forgeflow/public-backup.zWR78C`.
  - Anschließend vom Agenten von außen mit Zertifikatsprüfung bestätigt:
    `https://185.56.150.178/` liefert HTTP 200, `/api/v1/health` meldet
    `status=ok` und `storage=postgresql`. Anmeldung und Fachfunktionen im öffentlichen
    Browserbetrieb sind noch vom Anwender zu bestätigen.
- Bereits in diesem Durchlauf gebaut: ausführbare Spring-Boot-JAR, 37 erfolgreiche
  Backend-Tests und ein PostgreSQL-spezifischer Skip (H2-Testlauf, kein echter PG-Testlauf).

Lokaler Start: HTTP-404-Konflikt am 19. Oktober 2026 behoben:

- Ein alter Vite-Prozess aus dem ursprünglichen Hauptordner lauschte auf `::1:5173`
  und lieferte nach der Frontend-Verschiebung HTTP 404. Das neue Frontend auf
  `127.0.0.1:5173` und das PostgreSQL-Backend liefen bereits erfolgreich.
- Ausschließlich den identifizierten alten Projektprozess beendet. Danach lieferten
  `http://localhost:5173/` und die darüber weitergeleitete Backend-Health-API HTTP 200.
- Die lokale Portprüfung erfasst nun IPv4 und IPv6; die Startbereitschaft prüft dieselbe
  `localhost`-Adresse, die auch im Browser verwendet wird. Keine automatische Beendigung
  belegender Prozesse im Startskript.
- Sechs lokale Skript-Prüfgruppen erfolgreich, einschließlich echter temporärer
  IPv4-/IPv6-Listener sowie der Freigabe der Testports.
- Inzwischen liegen lokale Startkonfiguration und verschlüsseltes Verbindungspasswort
  vor; Backend-Logs bestätigen PostgreSQL und den Migrationsstand V3. Ein echter
  Dump-/Restore-Test und die aktuelle vollständige PostgreSQL-Suite bleiben unbestätigt.

Überarbeitung der Oberfläche am 19. Oktober 2026:

- Ruhige, an Jira/Confluence angelehnte Gestaltung über gemeinsame Theme-Tokens:
  abgestufte Schriftgrößen, lokale Systemschrift, dezente Flächen/Schatten, blaue
  Auswahlzustände und einheitliche Buttons/Formularfelder. Keine neuen Schrift-Downloads.
- Navigation mit SVG-Modulsymbolen, kompakter Kopfzeile und horizontal scrollbaren
  Bereichs-/Projekt-Tabs. Bei schmalen Fenstern wird die Modulnavigation zur Symbolleiste.
- Projektkarten, Aufgabenboard, Wiki, Dev Tools und Anmeldung verwenden die neue Gestaltung.
  Kurze Hover-/Fokus-Übergänge, Dialog- und Drawer-Einblendungen; `prefers-reduced-motion`
  schaltet Animationen und Übergänge ab. Dauernde Logo-/Status-Pulse entfernt.
- Lint, Produktionsbuild und 93 bestehende Frontend-Tests erfolgreich. Textkontraste für jeweils neun
  Kombinationen in beiden Themes berechnet: mindestens 5,59:1 (Grenze 4,5:1).
  Geänderte Vite-Einstiegsmodule wurden erfolgreich per HTTP ausgeliefert.
- Visuelle Prüfung in diesem Durchlauf noch offen: Browser-Connector nicht verfügbar.
  Automatische Freigabeprüfung hat Aufnahme/Nutzung eines bestehenden Edge-Fensters mit
  privaten Seiten und das Öffnen eines neuen Fensters darüber abgelehnt. Zustimmung zur
  ausschließlichen lokalen Vorschau wurde angefragt; ohne Antwort keine weitere UI-Aktion.
  Funktions-/Buildprüfungen ersetzen diese visuelle Prüfung nicht.

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
Die vollständige manuelle Prüfliste in `docs/manual-check.md` bleibt offen.

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
2. Aktuelles vollständiges Uploadpaket mit den beiden Chat-Update-/Testskripten auf den
   vorhandenen Ubuntu-Server übertragen; Befehle stehen in `docs/linux-server.md`.
   Backup und Format-2-Downgradegrenze beachten; vorhandene KI-/Datenbankkonfiguration erhalten.
3. Nach dem Update neu anmelden und `docs/browser-check.md` abnehmen: Kunden ohne Projekte
   zählen, Filter, Wiki-/Dateitexte, Vorschlag ablehnen/bestätigen, Konflikte und Kontoanlage
   nur als Administrator mit separatem Passwortfeld. Kein automatischer kostenpflichtiger Live-Test.
4. Für erneute isolierte PostgreSQL-Prüfungen `scripts/test-postgres-isolated.ps1 -Performance`
   verwenden. Der aktuelle Gesamtlauf einschließlich echter PostgreSQL-Tests ist erfolgreich;
   die vorhandene lokale Anwendungsdatenbank wurde dabei nicht benutzt.
5. Weitere Fachschreiboperationen, Binärdateianalyse, Rollen/Teams und Tickets nur nach neuem
   Auftrag. Keine unbegrenzte Aufzählung oder bisher nicht implementierte Funktion versprechen.

Diese Übergabe beauftragt keine zusätzlichen Features, Migrationen oder Veröffentlichung.
