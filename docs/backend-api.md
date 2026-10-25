# Backend-Vertrag und Frontend-Anbindung

Business und Portal verwenden Flyway V13; Details und Betriebsgrenzen:
[business-suite.md](business-suite.md). Alle nachfolgenden Pfade unter `/api/v1`:

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET / PUT | `/me/business` | Private Profile, Budgets, Vorlagen, Dokumente, serververwaltete Stoppuhr |
| POST | `/me/business/timer/{action}` | `start`, `pause`, `resume`, `complete`, `discard` mit If-Match |
| POST | `/me/business/templates/{id}/apply` | Projekt atomar erstellen; Business-/Workspace-Revision im Body |
| GET | `/me/business/documents/{id}/pdf` | Eigenes Angebot oder Rechnung als PDF |
| GET | `/me/business/timesheet/pdf` | Monatlicher Nachweis; `month`, optional Kunde/Projekt/Kommentare/Sprache |
| GET / POST | `/me/business/portal-accounts` | Eigene Portal-Konten auflisten / anlegen |
| PUT | `/me/business/portal-accounts/{id}` | Explizite Veröffentlichung oder Widerruf, If-Match |
| GET | `/portal/home` | Ausschließlich veröffentlichte Portal-Inhalte |
| GET | `/portal/documents/{id}/pdf` | Veröffentlichtes Dokument |
| GET | `/portal/timesheet/pdf` | Veröffentlichter Monat, ohne Kommentare |
| GET | `/portal/files/{id}` | Explizit freigegebene Dateiversion mit Hashprüfung |

Business-GET/PUT verwendet Version 1, Revision/ETag und exakt zitiertes If-Match. PUT muss
dieselbe Revision im Body enthalten; es darf den Timer nicht frei überschreiben. Timer-POST
hat die letzte Business-Revision im Header und `zone`, optionale Kunden-/Projektkennung,
Kommentar sowie Abrechenbar im Body. `complete` setzt eine gespeicherte Zeit mit Timer-UUID
voraus. Normale Origin-/CSRF-, Eigentümer- und Größenprüfungen gelten für Schreibzugriffe.
Kein automatischer Retry bei 409 oder unsicherem Schreibausgang.

Das Sitzungsprofil ergänzt `portalOnly`. Der serverseitige Filter lässt solchen Konten nur
Sitzung, Logout, Passwortänderung und `/portal/*`; interne APIs bleiben auch bei direktem
Aufruf gesperrt. Ein neues Portal-Konto hat keine Veröffentlichung. Portal-PUT baut unter
Eigentümersperre eine neue geprüfte Momentaufnahme auf; der Client kann keine eigenen
Snapshot-Inhalte einschleusen. PDFs werden als `application/pdf` mit Attachment-Header
geliefert. Vollständige Parameter, Schemas und Fehler stehen in [openapi.json](openapi.json).

TimeTracker: `GET/PUT /me/time-tracking` speichert private, versionierte Zeitbuchungen
mit Revision/If-Match außerhalb des Workspace. Datums-/Überschneidungsprüfung, echte
Kunden-/Projektnamen als historische Momentaufnahme und Eigentümerschutz; Flyway V12.
Höchstens 10000 Einträge und 5 MiB UTF-8. [Vertrag und Grenzen](time-tracker.md).

Persönliche Einstellungen akzeptieren `themeMode: dark|light|aurora|dune` im bisherigen
Version-1-Dokument. V11 erweitert die Datenbankprüfung ohne Änderung bestehender Werte.
Frontend und Backend gemeinsam aktualisieren. [Details](user-settings.md).

`GET /me/recent-activity` liefert die fünf neuesten bestätigten, kontogetrennten
Navigationsereignisse. V10 speichert sie atomar zusammen mit Workspace-/persönlichen
Einstellungsänderungen. Bestehende Schreibverträge bleiben gleich. [Details](navigation-and-history.md).

Private REST-Collections: `GET/PUT /me/rest-collections`, eigenes Version-1-Dokument mit
Revision/ETag und If-Match. PUT benötigt aktive Sitzung, Origin und CSRF; keine automatische
Wiederholung. Kontogetrennt außerhalb von Workspace und KI-Werkzeugen, Migration V9.
Höchstens 100 Collections, insgesamt 1000 Anfragen und 1 MiB UTF-8. [Vertrag und Grenzen](rest-collections.md).

Dokumentation verwendet weiterhin `wiki.articles` (Seiten) und `wiki.categories` (Bereiche).
Artikel ergänzen optional `parentId`: null = oberste Ebene, sonst eigene Seite im selben
Bereich. Höchstens zwölf Ebenen, keine Schleifen. Fehlend im alten Workspace-HTTP-Request
erhält eine bestehende Zuordnung; explizites null löst sie. V8 ergänzt den kontogebundenen
Selbst-Fremdschlüssel. Atomarer Workspace-Endpunkt unverändert. KI unterstützt parentId-
Filter und bestätigte Vorschläge über das Feld parent. [Details](documentation.md).

Der vollständige maschinenlesbare Vertrag liegt in [openapi.json](openapi.json), das Java-Gerüst
unter [backend](../backend/README.md). Die API verwendet die Basis `/api/v1`, JSON für Nutzdaten,
Cookie-Sitzungen und einen CSRF-Header für Änderungen.

Kunden ergänzen `contacts` (bis 100 CustomerContact pro Kunde, insgesamt bis 10000) und
`notes` (Klartext bis 6000 Zeichen). Fehlend/null bei alten Requests erhält vorhandene
Details; explizite leere Werte entfernen sie. Kontakte haben kontoweit eindeutige id,
customerId, name, role (Geschäftsfunktion), email und phone. V7 speichert Kontakte mit
kontogebundenem Kunden-Fremdschlüssel und Notizen in derselben Workspace-Transaktion.
Keine neuen CRUD-Endpunkte. KI erweitert die vorhandenen Werkzeuge um Kontakte und Notizen;
Freigaben bleiben unveränderlich/revisionsgebunden. [Protokoll und Beispiele](customer-details.md).

Kunden ergänzen `postalCode` als Text (maximal 32 Zeichen; für Altclients fehlend/null → leer).
V6 ergänzt das PostgreSQL-Feld ohne Verlust bestehender Kunden. Globale Branchenlisten:
`GET /settings/global` für angemeldete Nutzer, `PUT /settings/global` nur für aktuelle
Administratoren mit Origin, CSRF und If-Match. Eigene globale Revision, keine Workspace-
Ersetzung; 409 bei Konflikt, 428 bei fehlendem Header. Details: [customers.md](customers.md).

Die optionale KI-Anbindung ergänzt `POST /ai/conversations`,
`GET /ai/conversations/{id}`, den synchronen Endpunkt `POST /ai/conversations/{id}/messages`,
`POST /ai/conversations/{id}/messages/stream` und
`POST /ai/conversations/{id}/requests/{requestId}/cancel`.
Sie nutzt dieselben Sicherheitsprüfungen und ist standardmäßig deaktiviert
(`503 / AI_DISABLED` für angemeldete Benutzer). Gespräche sind kontogetrennt und
im PostgreSQL-Profil dauerhaft gespeichert; im Memory-Profil bleiben sie flüchtig.
`GET /ai/conversations` listet eigene Gespräche, `DELETE /ai/conversations/{id}` löscht sie
zusammen mit ihrer Ausführungshistorie. `GET /ai/conversations/{id}/executions` liefert
die letzten 50 Läufe. Diese Verwaltungsendpunkte erzeugen keine Modellanfrage.
Drei kontogebundene lesende Projektwerkzeuge
liefern begrenzte Übersichten, Aufgabenanzahlen und offene Aufgaben. SSE meldet
Werkzeugfortschritt; bestätigte Assistentennachrichten enthalten optional `tools`.
Pro Chat-Versuch sind standardmäßig vier aufeinanderfolgende Werkzeugschritte und fünf
Provider-Anfragen erlaubt (`AI_MAX_TOOL_STEPS`: 1–6, höchstens ein Werkzeug je Modellantwort).
SSE meldet zusätzlich `execution { phase, step, maxSteps }` mit thinking/reading/answering.
Vorschlag, nicht eindeutige Ergebnisse oder Schrittgrenze erzwingen eine abschließende
Textantwort. Gespeicherte Assistentennachrichten enthalten höchstens sechs geordnete
Werkzeugergebnisse; ein Navigationsvorschlag steht ausschließlich am Ende.
Das Gesamtzeitlimit bleibt `AI_TIMEOUT`; Wiederholungen und wechselnde Workspace-Revisionen
stoppen den Lauf. Fehler: `409 AI_EXECUTION_LOOP`, `409 AI_WORKSPACE_CHANGED`,
`422 AI_EXECUTION_RESULT_LIMIT`. Die ganze unbestätigte Folge wird verworfen;
Recovery liest nur bestätigten Verlauf oder verlangt erneutes ausdrückliches Senden.
Beide Nachrichten-Endpunkte akzeptieren optional `context: { route, projectId?, projectTab? }`.
Die zwölf bekannten Routen und vorhandenen Projekttabs sind fest begrenzt; Rollen,
Editorinhalte und beliebige URLs werden nicht akzeptiert. Projektkennungen werden vor
dem Modellaufruf im gespeicherten Workspace des angemeldeten Kontos geprüft. Bestätigte
Benutzernachrichten enthalten den normalisierten Kontext; dieser gehört zur Idempotenz
einer `requestId`. Ein anderer Kontext bei gleicher Kennung ergibt `AI_REQUEST_MISMATCH`.
Fehler: `400 AI_INVALID_PAGE_CONTEXT`, `404 AI_PAGE_CONTEXT_UNAVAILABLE` beziehungsweise
die bestehende Eingabevalidierung. Nach Streambeginn erscheinen sie als SSE-Fehler.
Details und Limits: [ai-assistant.md](ai-assistant.md).

Die erweiterte Fachanbindung ergänzt die Modellwerkzeuge `read_workspace` und
`propose_workspace_create` und `propose_workspace_update` für eigene Kunden, Projekte, Aufgaben, Epics, Sprints,
Wiki, Textdateien, Profil/Einstellungen und berechtigte Kontoverwaltung. Zählabfragen
und Filter werden serverseitig ausgeführt. `AiProjectToolResult` ergänzt optional
`workspace` (begrenzte Textprojektion) und `mutation` (unveränderlicher Anlage-/Änderungsvorschlag).
Bestehende Projekt-/Navigationsfelder bleiben erhalten. Das Tool-Allowlisting umfasst
jetzt sieben Namen; validierte kanonische Argumente sind auf 16000 Zeichen begrenzt.

`workspace.update` enthält Kennung/geänderte Felder in `data` und exakte bisherige Werte
in `before`. Beide Typen verwenden denselben Entscheidungsendpunkt. Änderungen prüfen
zusätzlich Vorherwerte, erhalten ungeänderte Felder und erzeugen passende Aktivitäten.
Keine Kontoänderungen oder Löschungen. Details: [ai-updates.md](ai-updates.md).

`POST /ai/conversations/{id}/creations/{actionId}/decision` erhält
`{ decisionId, decision, initialPassword? }`, keine frei änderbaren Datensatzdaten.
Origin, CSRF, Inhaber und aktive ursprüngliche Kontoversion werden geprüft. Nur dieser
separate Bestätigungsaufruf speichert. PostgreSQL übernimmt Fachänderung/Dateibytes oder
Konto und Aktionsstatus atomar; Erfolg wird idempotent ohne erneute Anlage wiedergegeben.
Geänderter Workspace: `409 AI_CREATE_CONFLICT`. Vorschläge gelten fünf Minuten.
Konten erfordern aktuelle Administratorrechte; das Initialpasswort gehört ausschließlich
ins private Kartenfeld und niemals in den Chat. Benutzerliste/Profil enthalten keine
Hashes oder Sitzungsversionen. Details, Feldkatalog und Grenzen: [ai-workspace.md](ai-workspace.md).

Der Frontend-Code liegt unter `frontend/src/`, die Vite-Konfiguration und
Umgebungsdateien unter `frontend/`. Die npm-Befehle im Hauptordner delegieren an
diesen Workspace. Vites `/api`-Proxy verwendet weiterhin `http://127.0.0.1:3001`.

Das Backend-Profil `memory` bleibt ohne Datenbank startbar. Das optionale Profil `postgres`
verwendet JPA und Flyway für dauerhafte Speicherung von Konten, Workspace, Einstellungen und
Dateibytes in PostgreSQL. PostgreSQL kann später lokal installiert werden; der HTTP-Vertrag
bleibt gleich. Es gibt keinen automatischen Import des Referenzspeichers. Sitzungen bleiben
auch im PostgreSQL-Profil flüchtig. Einrichtung: [Backend-README](../backend/README.md).

| Methode | Endpunkt | Aufgabe |
| --- | --- | --- |
| GET | `/health` | Erreichbarkeit |
| GET | `/auth/csrf` | CSRF für die Anmeldung beziehen |
| POST | `/auth/login` | Anmeldung mit serverseitiger BCrypt-Prüfung |
| GET | `/auth/session` | Sitzung und Benutzerprofil prüfen |
| POST | `/auth/logout` | Sitzung beenden |
| GET / PUT | `/me/settings` | Einstellungen des angemeldeten Benutzers |
| PUT | `/me/profile` | Eigenen Namen/E-Mail ändern, Sitzung erneuern |
| POST | `/me/password` | Eigenes Passwort ändern und Sitzungen beenden |
| GET / POST | `/users` | Als Administrator Konten auflisten/anlegen |
| PUT | `/users/{id}/active` | Als Administrator ein normales Konto aktivieren/deaktivieren |
| GET | `/workspace` | Projekte, Kunden, Aufgaben, Aktivitäten, Epics, Sprints, Dateien und Wiki laden |
| PUT | `/workspace` | Zusammengehörige Änderungen atomar speichern |
| GET | `/projects/{projectId}/files/{fileId}/content` | Geschützten Dateiinhalt laden |

## Kontoverwaltung und Sitzungswiderruf

Sitzungsprofile enthalten zusätzlich `administrator` und `active`; keine Hashes oder
internen Sitzungsversionen. Konten haben eine stabile Kennung, die auch bei einer Änderung
der E-Mail-Adresse erhalten bleibt. Gespeicherte Sitzungen verwenden diese Kennung und eine
serverseitig geprüfte Sitzungsversion, damit die Wiederverwendung einer E-Mail-Adresse keine
alten Sitzungen auf ein anderes Konto umleiten kann.

`PUT /me/profile` erhält `{ name, email, currentPassword? }`. Bei Änderung der E-Mail-Adresse
ist das aktuelle Passwort erforderlich. Erfolg liefert dasselbe Sitzungsformat wie Login,
mit bei E-Mail-Änderung erneuerter Sitzungs-ID/CSRF. Eine reine Namensänderung erhält die
Sitzung, damit offene Entwürfe erhalten bleiben. Andere bisherige Sitzungen werden bei E-Mail-Änderung ungültig.
`POST /me/password` erhält `{ currentPassword, newPassword }` und liefert `204`.
Danach muss sich der Benutzer erneut anmelden; auch andere bisherige Sitzungen sind ungültig.
Neue Passwörter verlangen mindestens 12 Unicode-Zeichen, höchstens 72 UTF-8-Bytes und kein NUL.

`POST /users` erhält `{ name, email, password }` und legt ausschließlich normale Konten mit
leerem Fachbestand an. `PUT /users/{id}/active` erhält `{ active: boolean }`. Deaktivierung
widerruft Sitzungen, erhält Daten und kann durch Aktivierung rückgängig gemacht werden.
Administratorkonten können über diese API nicht deaktiviert werden. Die Kontoverwaltung
gewährt Administratoren keinen Zugriff auf die Fachbestände anderer Konten.

Alle Änderungen benötigen CSRF und den passenden Ursprung. Kontoverwaltung verlangt
Administratorrechte. Fehler: `400 CURRENT_PASSWORD_INVALID` bzw. `INVALID_PASSWORD`,
`400 ADMIN_ACCOUNT_PROTECTED`, `409 EMAIL_IN_USE` bzw. `ACCOUNT_CHANGED`,
`403 FORBIDDEN`, `429 RATE_LIMITED`. Unbekannte JSON-Felder werden abgewiesen.
Öffentliche Registrierung, Rollenvergabe, Kontolöschen und E-Mail-Passwortreset sind nicht enthalten.

## KI-Navigationsfreigaben

Bei aktivierter KI kann `propose_project_navigation(project, view)` eine Aktionskarte für
`overview`, `tasks` oder `board` eines gespeicherten eigenen Projekts vorbereiten. Erst das
bestätigte Chatpaar registriert `assistant.tools[].result.action`. Der Vorschlag navigiert nicht.

- `POST /ai/conversations/{id}/actions/{actionId}/decision`: nur `{ decisionId, decision }`
  mit UUID und `approve`/`reject`. Authentifizierter Inhaber, ursprüngliche Kontoversion,
  fünf Minuten Gültigkeit, Origin und CSRF; bei approve Projektkennung und angezeigten Namen
  erneut prüfen. Nur die erste Entscheidung ist gültig. Einmaliges approve liefert
  `{ action, executionId }`, reject liefert executionId null. Kein erneutes Erteilen bei Replay.
- `POST /ai/conversations/{id}/actions/{actionId}/result`: `{ executionId, status, code }`.
  Status `succeeded` mit Code null/fehlend oder `failed` mit geschlossenem Fehlercode
  `NAVIGATION_UNAVAILABLE`, `UNSAVED_CHANGES`, `CLIENT_CANCELLED`, `EXPIRED`.
  Identische terminale Ergebniswiederholungen sind idempotent, Änderungen nicht erlaubt.

Fremde/unbekannte Aktionen sind nicht zugänglich. Fehler umfassen `400 AI_INVALID_ACTION`,
`404 AI_ACTION_NOT_FOUND`, `409 AI_ACTION_UNAVAILABLE`, `AI_ACTION_EXPIRED`, `AI_ACTION_DECIDED`
und `AI_CONVERSATION_BUSY`; unbekannte JSON-Felder ergeben `400 INVALID_INPUT`.
Keine Modellanfrage oder Fachdatenänderung durch diese Endpunkte. Der Status ist eine
UI-Rückmeldung und wird beim nächsten Chattext als User-Metadatum an das Modell gegeben.
Gespräche/Aktionsstatus sind im PostgreSQL-Profil dauerhaft. Die private einmalige
Ausführungsfreigabe wird beim Laden niemals erneut erteilt. Bei verlorener Freigabeantwort niemals automatisch
ausführen/wiederholen; Verlauf lesen oder neuen Vorschlag anfordern. Schema: `docs/openapi.json`.

## Gespeicherte KI-Unterhaltungen (M8)

Flyway V5 ergänzt getrennte Gesprächs- und Ausführungstabellen im vorhandenen PostgreSQL.
Nach Anmeldung können eigene Chats auch nach einem Backend-Neustart erneut geöffnet werden.
`GET /ai/conversations` liefert `{ storage, retentionSeconds, items }`; die Einträge enthalten
`id`, `language`, `title` (erste Benutzernachricht, höchstens 100 Zeichen), `createdAt`,
`updatedAt`, `messageCount` und `busy`. `GET /ai/conversations/{id}` ergänzt ebenfalls `busy`.
Die Liste ist nach letzter Aktivität sortiert und auf die vorhandenen höchstens 50 Chats
je Konto begrenzt. Fremde, unbekannte und abgelaufene Kennungen ergeben einheitlich 404.

Die Ausführungshistorie enthält Kennung, Request-Kennung, Beginn/Ende, Status, sicheren
Fehlercode sowie geordnete Werkzeugschritte mit validierten kanonischen Argumenten und Outcome.
Status: `running`, `succeeded`, `failed`, `cancelled` oder `interrupted`. Keine privaten
Aktionsfreigaben oder Sitzungsversionen werden ausgegeben. Chatpaare werden erst vollständig
bestätigt übernommen; fehlgeschlagene Läufe bleiben separat nachvollziehbar.

`DELETE` benötigt Origin und CSRF und liefert 204; ein laufender Chat ergibt 409
`AI_CONVERSATION_BUSY`. Gelöscht werden Gespräch und Ausführungshistorie atomar.
`AI_CONVERSATION_RETENTION` bestimmt die PostgreSQL-Inaktivitätsfrist (30d, zulässig 1d–365d).
Reines Lesen verlängert sie nicht. Physische Bereinigung erfolgt beim nächsten Anlegen;
Backups haben eine eigene Aufbewahrung. Memory verwendet weiterhin `AI_CONVERSATION_TTL`.
Nach einem Absturz wird ein verwaister Lauf nach `AI_TIMEOUT + 5s` beim nächsten Zugriff
als unterbrochen markiert. Ein verspäteter Commit ergibt 409 `AI_RUN_EXPIRED`.
Kein automatisches Fortsetzen, keine Modellanfrage beim Laden oder Löschen. Vor M8 flüchtige
Chats werden nicht übernommen. Weitere Details: [ai-assistant.md](ai-assistant.md).

## Workspace speichern

`GET /workspace` liefert `{ version: 1, revision, data }` und einen `ETag`. `data` enthält die
Sammlungen `projects`, `customers`, `tasks`, `activities`, `epics`, `sprints`, `files` und `wiki`.
Ein neues Konto beginnt mit leeren Sammlungen. Beispieldaten werden ausschließlich im lokalen
Modus verwendet und niemals automatisch in ein Backend übertragen.

`PUT /workspace` erhält `multipart/form-data` mit:

- `manifest`: denselben versionierten Datensatz als JSON-String mit zuletzt bestätigter Revision.
- `file-{id}`: Binärinhalt einer neuen Datei. Im Manifest stehen Kennung, Projekt, Name, Größe,
  MIME-Typ, ursprünglicher Änderungszeitpunkt und Anwendungszeitpunkte. Vorhandene, unveränderte
  Dateiinhalte müssen nicht erneut übertragen werden. Entfernte Dateien fehlen im neuen Manifest.
- `If-Match: "revision"`: die zuletzt bestätigte Revision in doppelten Anführungszeichen.

Bei Erfolg folgt `{ revision: "neue-revision" }`. Der Client bündelt Änderungen eines UI-Vorgangs
und serialisiert nachfolgende Schreibzugriffe. Änderungen während eines laufenden Speicherns
werden mit der anschließend bestätigten Revision gesendet. Ein Speicherfehler erhält den lokalen
Stand und bietet Wiederholen. Bei `409` ist Wiederholen gesperrt; der Serverstand muss nach
ausdrücklichem Verwerfen lokaler Änderungen geladen werden.

Der Workspace ist die Transaktionsgrenze, damit zusammengehörige Beziehungen gemeinsam geändert
werden. Der Server prüft Datensätze, Referenzen, Dateinamen und Sprint-Regeln vor dem Commit.
Künftige fachliche Einzelendpunkte können hinter `WorkspaceRepository` ergänzt werden.

## Frontend-Struktur

- `services/api/apiClient.ts`: gemeinsame Cookie-/CSRF-Behandlung, Fehler, Zeitlimit, Abbruch,
  JSON/Multipart und Schutz gegen Operationen aus einer abgelaufenen Sitzung.
- `services/auth/authStore.ts`: Sitzungsprüfung, Login, Logout und Verwerfen verspäteter Antworten.
  Eine erneuerte oder andere Sitzung erhält einen eigenen Gültigkeitsbereich.
- `services/workspace/workspaceTypes.ts`: Daten- und Repository-Verträge.
- `workspaceSchema.ts`: prüft Backend-Antworten vor Übernahme in die Oberfläche.
- `workspaceRepository.ts`: lokaler und HTTP-Adapter einschließlich Dateien.
- `workspaceStore.ts`: gemeinsamer Fachzustand, Lade-/Speicherstatus und Konfliktbehandlung.
- `hooks/workspaceContext.ts`: Anbindung aller vorhandenen Fach-Hooks an denselben Speicher.
- `services/settings/apiSettingsRepository.ts`: kontobezogene Einstellungen über `/me/settings`.

`VITE_DATA_MODE=local` verwendet die bisherigen Beispieldaten ohne Anmeldung oder API-Anfragen.
`VITE_DATA_MODE=api` verlangt eine bestätigte Backend-Sitzung und lädt echte Backend-Antworten.
Bei einem Backend-Fehler gibt es keinen Rückfall auf Beispieldaten. Das Frontend speichert weder
Passwörter noch Sitzungs-IDs in Local Storage oder Session Storage. Nach Logout oder `401` werden
Fachzustände, Einstellungen und Dev-Tools-Eingaben durch Unmounten entfernt.

## Fehlerformat

```json
{ "error": { "code": "VERSION_CONFLICT", "message": "Die Daten wurden inzwischen geändert." } }
```

Verwendete Statuscodes: `400` Eingabe, `401` fehlende Anmeldung, `403` CSRF/Ursprung, `409`
Revision, `413` Größe, `422` fachliche Daten, `428` fehlende Revision und `429` Login-Begrenzung.
Dateizugriffe außerhalb des eigenen Workspaces ergeben `404`.
Speicher-/Transaktionsfehler ergeben `503` mit `STORAGE_UNAVAILABLE`, ohne SQL- oder
Verbindungsdetails. Ein aktiviertes PostgreSQL-Profil fällt bei Datenbankfehlern nicht auf
den Referenzspeicher zurück. `/health` meldet den Speichertyp (`reference` oder `postgresql`);
es ist keine laufende Datenbank-Verfügbarkeitsprüfung.

## Sprachwahl

`GET /me/settings` und `PUT /me/settings` unterstützen zusätzlich `settings.language`
mit `de` und `en`. Anfragen ohne das Feld bleiben gültig und verwenden Deutsch.
Die Version-1-Einstellungshülle und die bisherigen Felder bleiben gleich.
Der PostgreSQL-Adapter speichert den Wert in `ff_settings.language`; Flyway V4
ergänzt die Spalte mit Vorgabe `de` für bestehende Konten. Der Sprachwechsel betrifft
Einstellungen, Wiki, Dev Tools und gemeinsame Navigation. Details: [user-settings.md](user-settings.md).
