# Projektübergabe: Dev Suite / ForgeFlow

Stand: 18. Oktober 2026. Diese Datei fasst die bisherige Arbeit für einen neuen Codex-Chat zusammen.
Vor Änderungen immer den aktuellen Quellcode prüfen. Die hier genannten Testergebnisse stammen
aus dem letzten abgeschlossenen Implementierungsdurchlauf und sind keine erneute Prüfung dieses
Dokumentationsschritts.

## Projekt und Entscheidungen des Anwenders

- Hauptverzeichnis: `D:\Projects\Vite\dev-suite`. Frontend und Backend bleiben im selben Repository.
- Frontend: React 18, TypeScript im Strict Mode, Vite 5, styled-components, React Router 7.
- Backend: **Java / Spring Boot**, Entwicklung in IntelliJ. Ein begonnenes Node-Backend wurde
  vollständig durch das Spring-Gerüst ersetzt; es gibt keine bcrypt-Node-Abhängigkeit im Frontend.
- Zuerst sollten die Frontend-Features fertig werden; anschließend wurde ausdrücklich die
  Vorbereitung des gesamten Projekts für ein Backend einschließlich Login und BCrypt beauftragt.
- **Ticketsystem vorerst überspringen.** Der Tickets-Tab ist weiterhin ein Platzhalter.
- Einstellungen sollen später pro Benutzer dauerhaft in der Datenbank gespeichert werden.
- Datenbank-Auswahl, dauerhafte Speicherung und produktives Deployment sind noch offen.
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

- `src/App.tsx`: Auth-Gate, Themes, Einstellungen, WorkspaceProvider und Hash-Navigation.
- `src/services/api/apiClient.ts`: zentrale JSON-/Multipart-/Blob-Anfragen, Cookie-/CSRF-Behandlung,
  30-Sekunden-Zeitlimit, Abbruch, Fehler und Schutz vor Operationen aus alten Sitzungen.
- `src/services/auth/authStore.ts`: CSRF vor Login, Sitzungsprüfung, Login/Logout und Schutz
  vor verspäteten Antworten. Ein Sitzungswechsel setzt kontobezogene UI-Zustände zurück.
- `src/services/workspace/workspaceTypes.ts`: gemeinsame Fachtypen und Repository-Schnittstelle.
- `workspaceSchema.ts`: Laufzeitprüfung der vom Backend geladenen Daten.
- `workspaceRepository.ts`: lokaler Adapter und API-Adapter einschließlich Dateiübertragung.
- `workspaceStore.ts`: gemeinsamer Fachzustand, Bündelung zusammengehöriger Änderungen,
  geordnetes Speichern, Wiederholen und Versionskonflikte.
- `src/hooks/workspaceContext.ts`: bestehende Fach-Hooks verwenden `useWorkspaceField`.
  Projekte, Kunden, Aufgaben, Epics, Sprints, Dateien, Aktivitäten und Wiki liegen dadurch nicht
  mehr in voneinander unabhängigen, frisch initialisierten Hook-Datenbeständen.
- `src/services/settings/`: eigener asynchroner, versionierter Speicher pro Benutzer.
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

- `auth/Accounts` und `ConfiguredAccounts`: Benutzerzugriff, derzeit ein konfiguriertes Konto.
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
- Backend-Neustart verwirft Daten, Dateien und Sitzungen. Es gibt noch keine JPA-Entities,
  Datenbankmigrationen, Rollenverwaltung oder gemeinsamen Team-Workspaces.

Zum Start sind `AUTH_USER_EMAIL` und `AUTH_PASSWORD_HASH` erforderlich. Weitere Konfiguration:
`AUTH_USER_ID`, `AUTH_USER_NAME`, `APP_ORIGIN`, `PORT`, `COOKIE_SECURE`. Standard ist ein sicheres
Cookie; für lokale HTTP-Entwicklung `COOKIE_SECURE=false` setzen. Spring liest Prozessvariablen,
keine automatische `.env`-Datei. Echte Zugangsdaten nicht in Übergabedateien oder Chats ablegen.

## Zuletzt verifiziert

Im letzten Implementierungsdurchlauf erfolgreich:

- `npm.cmd run lint` und `npm.cmd run build`.
- `npm.cmd test`: **86** Frontend-, Fachlogik-, API-, Auth- und Repository-Tests.
- Spring/Maven: **7** Integrationstests, einschließlich echter BCrypt-Loginprüfung,
  CSRF/Sitzungswechsel/Logout, Einstellungen, Versionskonflikten und aller Fachbereiche mit Datei-Upload/-Download.
- `npm.cmd audit --omit=dev`: keine gemeldeten Schwachstellen in Produktionsabhängigkeiten
  zu diesem Prüfzeitpunkt. React Router wurde innerhalb Version 7 auf einen korrigierten Stand aktualisiert.
- Entwicklungsserver: 54 Komponentenmodule ohne fehlenden Default-Export ausgeliefert.

Eine visuelle Browserprüfung war in dieser Umgebung mangels verbundenem Browser nicht möglich.
Die manuelle Prüfliste steht in der Haupt-README. Diese Prüfung ist weiterhin offen.

## Arbeitsumgebung und bekannte Besonderheiten

- Im ursprünglichen Arbeitskontext waren Node/npm im eingeschränkten Shell-PATH nicht verfügbar;
  freigegebene `npm.cmd`-Aufrufe funktionierten. In IntelliJ den tatsächlichen lokalen PATH prüfen.
- Java/Maven wurden für die Prüfung portabel unter `node_modules/.tmp/backend-tools` abgelegt.
  Das ist kein systemweit installiertes JDK. In IntelliJ JDK 21 und Maven ausdrücklich konfigurieren.
- `scripts/verify-backend.ps1` prüft Archiv-Prüfsummen und führt Backend-Tests aus; Downloads
  und Maven-Cache bleiben unter dem ignorierten `node_modules/.tmp/`.
- Eine frühere leere Vite-Seite entstand durch ein kurzzeitig leeres Modul beim Schreiben.
  `vite.config.ts` verwendet deshalb `watch.awaitWriteFinish`. Quellcode atomar ändern und
  bei ähnlichen Fehlern die tatsächlich ausgelieferten Module/Exporte prüfen.
- Zum Zeitpunkt der bisherigen Arbeit stand keine nutzbare Git-Historie zur Verfügung.

## Sinnvolle Fortsetzung

1. Vorhandenen Code, Root-`AGENTS.md`, diese Übergabe und die Backend-Dokumentation lesen.
2. In IntelliJ das vorhandene Maven-Projekt importieren, Java 21 und die Startvariablen einrichten.
3. Den API-Modus mit dem Referenzbackend lokal durchspielen; offene Browserprüfungen nachholen.
4. Danach die nächste konkrete Aufgabe des Anwenders bearbeiten. Für dauerhafte Speicherung
   zuerst die gewünschte Datenbank und das Datenmodell klären, dann Referenzadapter durch
   transaktionale Implementierungen ersetzen. Bestehende API-, Konto- und Konfliktregeln erhalten.

Diese Übergabe beauftragt keine zusätzlichen Features, Migrationen oder Veröffentlichung.
