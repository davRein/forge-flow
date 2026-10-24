# KI-Assistent: Qualität und Betrieb (M9)

Stand: 24. Oktober 2026. M9 ergänzt den bestehenden Assistenten um PostgreSQL-HTTP-
Vertragstests, Socket-Tests, reproduzierbare lokale Zeitmessungen und eine atomare
Veröffentlichung der Frontend-Startseite. Neue Fachfunktionen oder Modellanfragen
werden dadurch nicht eingeführt. Architektur und Limits: [ai-assistant.md](ai-assistant.md).

## Automatische Prüfungen

| Prüfung | Abdeckung | Datenbank / Modell |
| --- | --- | --- |
| `AiIntegrationTest` / `AiPostgresIntegrationTest` | Derselbe HTTP-Vertrag für Anmeldung, Origin/CSRF, fremde Kennungen, ungültige Rollen/Parameter, Werkzeugquellen, Einmalfreigaben, Idempotenz, Rate-Limit und sichere Fehler | Memory / JPA; Mock-Modell |
| `AiStreamingHttpTest` / `AiPostgresStreamingHttpTest` | Echte Tomcat-Sockets: frühes Flush, konkurrierende Anfrage, expliziter Abbruch, Browserverbindungsabbruch und Logout während eines stillen Streams | Memory / JPA; Mock-Modell |
| `JpaConversationStoreTest` | Zweite Backend-Instanz, parallele Commits/Freigaben, Kontotrennung, Rollback, Löschung, Aufbewahrung und verwaiste Läufe | JPA, H2 oder separates PostgreSQL |
| `OpenAiWireTest` und Agent-/Werkzeugtests | Echte SDK-Requests an Loopback-Server; mehrstufige Ausführung, Limits und Autorisierung | Lokaler HTTP-Stub; keine OpenAI-Anfrage |
| Frontend-Suite | Streamvalidierung, Zustand, Seitenbezug, Aktionsfreigaben und Gesprächsverwaltung | Simuliertes Backend / Komponentenrenderer |
| `test-linux-chat.sh` | Archivpfade/-typen, Rollback, Veröffentlichung erst nach Assets und Verhalten bei fehlgeschlagenem Umbenennen | Temporäre lokale Dateien; keine Dienste |

Normaler Testlauf verwendet H2 für den JPA-Vertrag. `TEST_POSTGRES_URL` schaltet die
Datenbanktests auf eine separate PostgreSQL-Datenbank mit Suffix `_test` um; niemals
die Anwendungsdatenbank verwenden. Die KI-Persistenz-/HTTP-/Socket-Suiten erhalten
innerhalb dieser Datenbank je ein eigenes generiertes Schema, damit ihre verschiedenen
Bootstrap-Konten und Gesprächslimits unabhängig bleiben. Die Datenbank-Testrolle muss
diese Testschemas anlegen dürfen. Sie werden mit dem isolierten Cluster aufbewahrt.
Der normale Lauf sendet keine OpenAI-Anfrage.
Der kostenpflichtige Live-Test bleibt separat und ausdrücklich opt-in.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
mvn.cmd -f backend/pom.xml test
```

## Isoliertes echtes PostgreSQL unter Windows

Der neue Helfer benötigt installierte PostgreSQL-Binaries, Java 21 und Maven (oder die
bereits heruntergeladenen Werkzeuge unter `node_modules/.tmp/backend-tools`). Er liest
keine Anwendungskonfiguration oder bestehenden Datenbankpasswörter. Er initialisiert
einen neuen Cluster unter `node_modules/.tmp/postgres-test-<UUID>`, bindet ihn nur an
Loopback auf einem freien Port und verwendet ein zufälliges Testpasswort mit SCRAM.
Vorhandene Dienste und Datenbanken werden nicht verändert. Das Initialisierungspasswort
wird abschließend entfernt, Prozessvariablen werden zurückgesetzt und die Testinstanz
wird auch bei Testfehlern gestoppt. Daten/Logs bleiben zur Diagnose im ignorierten Ordner.
Ein fehlgeschlagener Stop wird ausdrücklich gemeldet.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-postgres-isolated.ps1 -Performance
```

Bei anderem Installationspfad `-PostgresBin 'C:\Program Files\PostgreSQL\18\bin'` ergänzen.
Ohne `-Performance` entfällt die optionale Messung. Der Helfer setzt den OpenAI-Live-Test
ausdrücklich auf false. Eine restriktive Prozess-Sandbox kann initdb am Erstellen des
Windows-Tokens hindern; dann in einem normalen lokalen Terminal ausführen.

## Zeitmessung

Optional `-Dforgeflow.performance=true` mit Maven aktivieren. Ausgabe:
`backend/target/ai-performance.json`. Der Socket-Test misst drei authentifizierte GETs:
Gesprächsliste, vollständiger Verlauf und Ausführungshistorie. Datenbasis: zehn eigene
Gespräche mit je zehn vollständigen Nachrichtenpaaren; die gemessene Ausführungsliste
enthält 50 Läufe. Pro Endpunkt zehn Aufwärmaufrufe und 100 Messungen, p50/p95/p99 und Maximum
in Millisekunden. Anmeldung und Testdatenerzeugung liegen außerhalb des Messfensters.
Alle Rückgaben müssen HTTP 200 und gültiges JSON liefern; das Mock-Modell muss unberührt bleiben.

Die Messung verwendet einen Client auf Tomcat-Loopback. Sie enthält Datenbankarbeit,
Authentifizierung und JSON, aber keine TLS-/Internet-/OpenAI-Latenz. Sie ist weder ein
Lasttest noch eine Zusicherung für den Ubuntu-Server. Keine zeitabhängige harte Testgrenze;
Abweichungen müssen anhand derselben Hardware und Datenbasis untersucht werden.

Lokaler geprüfter Lauf vom 24. Oktober 2026, PostgreSQL 18.6 und Java 21.0.12.1:

| Endpunkt | p50 | p95 | p99 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Gesprächsliste | 27,86 ms | 35,06 ms | 37,77 ms | 47,95 ms |
| Vollständiger Verlauf | 10,15 ms | 11,55 ms | 14,29 ms | 18,43 ms |
| Ausführungshistorie | 10,64 ms | 14,59 ms | 27,57 ms | 29,28 ms |

Jeder Endpunkt hatte 100 erfolgreiche Messungen; Provider-Anfragen: 0. Dies ist eine
einzelne lokale Momentaufnahme. Die Liste lädt derzeit die begrenzten Gesprächsaggregate
unter Zeilensperren; bei künftig wesentlich größeren Limits ist eine separate Projektion
für Listeneinträge zu messen, bevor die Limits angehoben werden.

## Deployment-Konfiguration und Grenzen

Die vorhandene Installation bleibt maßgeblich: Backend als Benutzer `forgeflow`,
JAR unter `/opt/forgeflow/backend.jar`, geschützte Umgebung `/etc/forgeflow/backend.env`,
PostgreSQL-Profil und Nginx vor dem nur an Loopback gebundenen Port 3001.
`APP_ORIGIN=https://185.56.150.178`, `COOKIE_SECURE=true` und die vorhandenen Datenbank-/KI-
Einstellungen beibehalten. Keine neue Pflichtvariable und keine neue Migration für M9.

| Vorhandene Einstellung | Vorgabe | Bedeutung |
| --- | --- | --- |
| `AI_TIMEOUT` | `20s` | Gesamtzeitlimit einer Werkzeug-/Modellfolge, höchstens 60s |
| `AI_MAX_CONCURRENT` | `2` | Begrenzte parallele KI-Läufe pro Backend-Instanz |
| `AI_REQUESTS_PER_15_MINUTES` | `20` | Versuche je Konto; kein garantiertes Euro-Budget |
| `AI_MAX_TOOL_STEPS` | `4` | Höchstens 1–6 Werkzeugschritte und N+1 Modellanfragen |
| `AI_MAX_CONVERSATIONS_PER_USER` / `AI_MAX_CONVERSATIONS` | `10` / `200` | Gespeicherte Gesprächszahl begrenzen |
| `AI_CONVERSATION_RETENTION` | `30d` | PostgreSQL-Inaktivitätsfrist; Bereinigung beim Anlegen |

Die Datenbankverbindungen bleiben durch Hikari begrenzt (derzeit Standardpoolgröße 10,
Verbindungszeitlimit 10s). Höhere KI-Parallelität erfordert eine neue Messung; die Obergrenze
16 ist keine Empfehlung für diesen Server. Sitzungen, Versuchslimits und aktive Streams
bleiben instanzlokal. PostgreSQL-Persistenz allein macht den Betrieb nicht clusterfähig.

`update-linux-chat.sh` prüft Prüfsummen, Archiv und PostgreSQL-Health vor Änderungen,
sichert Datenbank/JAR/Frontend/Umgebung und stellt das vorherige Anwendungspaar bei Fehlern
wieder her. Additive Migrationen bleiben erhalten. Die neue Startseite wird als fertige
Datei im selben Verzeichnis umbenannt, nachdem alle neuen Assets vorhanden sind; alte Assets
bleiben für offene Tabs erhalten. Die öffentliche Prüfung verlangt HTTP 401 auf allen drei
KI-Lesewegen ohne Sitzung. Sie sendet keine Nachricht und führt keine Aktion aus.

Upload und manuelle Nachprüfung: [linux-server.md](linux-server.md).
Visuelle Prüfung sowie ein echter Ubuntu-/Nginx-Update-/Rollback-Lauf sind gesondert
durchzuführen. Grundsätzliches Funktionieren von M8 ist nicht mit einer dokumentierten
vollständigen Detailabnahme gleichzusetzen. Die bisherigen manuellen Fälle stehen in
[browser-check.md](browser-check.md).
