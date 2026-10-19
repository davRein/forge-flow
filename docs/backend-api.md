# Backend-Vertrag und Frontend-Anbindung

Der vollständige maschinenlesbare Vertrag liegt in [openapi.json](openapi.json), das Java-Gerüst
unter [backend](../backend/README.md). Die API verwendet die Basis `/api/v1`, JSON für Nutzdaten,
Cookie-Sitzungen und einen CSRF-Header für Änderungen.

| Methode | Endpunkt | Aufgabe |
| --- | --- | --- |
| GET | `/health` | Erreichbarkeit |
| GET | `/auth/csrf` | CSRF für die Anmeldung beziehen |
| POST | `/auth/login` | Anmeldung mit serverseitiger BCrypt-Prüfung |
| GET | `/auth/session` | Sitzung und Benutzerprofil prüfen |
| POST | `/auth/logout` | Sitzung beenden |
| GET / PUT | `/me/settings` | Einstellungen des angemeldeten Benutzers |
| GET | `/workspace` | Projekte, Kunden, Aufgaben, Aktivitäten, Epics, Sprints, Dateien und Wiki laden |
| PUT | `/workspace` | Zusammengehörige Änderungen atomar speichern |
| GET | `/projects/{projectId}/files/{fileId}/content` | Geschützten Dateiinhalt laden |

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
