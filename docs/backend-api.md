# Backend-Vertrag und Frontend-Anbindung

Der vollständige maschinenlesbare Vertrag liegt in [openapi.json](openapi.json), das Java-Gerüst
unter [backend](../backend/README.md). Die API verwendet die Basis `/api/v1`, JSON für Nutzdaten,
Cookie-Sitzungen und einen CSRF-Header für Änderungen.

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
