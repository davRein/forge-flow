# Suite, Knowledge Hub, FlowPilot und PulseWatch auf forge-flow.de

## Erweiterung DataScout, 7. November 2026

Auf Benutzerwunsch ist DataScout für das vollständige nächste Release integriert.
Veröffentlichungsstatus und Release-ID stehen in `docs/HANDOFF.md`; dieser Abschnitt
allein bestätigt noch keinen erfolgreichen Serverlauf.

- Geschützte Pfade `/datascout/` und `/datascout-api/`, interne API 127.0.0.1:8002,
  eigener Offline-Worker im bestehenden Compose-Projekt. Keine neue öffentliche
  Portfreigabe. Statische Dateien im gemeinsamen Nginx-Release, eigenes CSP.
- Zusätzlich zum Nginx-Guard prüft die API jede echte Suite-Sitzung erneut am festen
  Loopback-Endpunkt. Nur das Suite-Cookie wird weitergegeben; keine Identität aus
  Browserheadern oder Frame-Nachrichten. POST verlangt die exakte Suite-Origin.
- Eigene Datenbank/Rolle `forgeflow_datascout`; vollständiger Dump vor dem Update,
  bestehende Secrets unverändert. Kontoabhängige PostgreSQL-Schemas enthalten jeweils
  Jobs, Leases, Historie, Regeln und Inbox. Worker bleibt während jeder Ausführung
  im Kontobereich. Anwendungstrennung mit einer Dienstrolle, kein RLS-Versprechen.
- V18 ergänzt DataScout in der gespeicherten sichtbaren App-Auswahl und erhält die
  übrigen Apps sowie sämtliche KI-Freigaben. Rollback sichert die vorherige Auswahl
  und stellt nur die unverändert gebliebene V18-Ergänzung zurück, damit alte Clients
  keine unbekannte App erhalten. Andere Anwendungsdaten werden nicht zurückgespielt.
- Migrationen laufen vor dem Start. Bereitschaft prüft API und Worker-Heartbeat;
  Zugriffstests verlangen anonym 401, fremde Schreib-Origin 403 und verweigern
  gefälschte Identitätsheader. Sammlung bleibt Offline-Fixture; kein bezahlter Test.
- Vor Paketierung DataScout mit `VITE_BASE_PATH=/datascout/`,
  `VITE_API_PREFIX=/datascout-api`, `VITE_SUITE_ORIGIN=https://forge-flow.de` bauen.
  Suite-Build erhält `VITE_DATASCOUT_URL=https://forge-flow.de/datascout/`.
  Details im Nachbarprojekt: `data-scout/docs/SUITE-REMOTE.md`.


## Aktuell veröffentlicht: 6. November 2026

Release `20261106T190524Z-96f6b831` wurde tatsächlich auf forge-flow.de installiert.
Enthält die globale Auswahl der Navigations-Apps und KI-Buttons, auf Projektmanager
begrenzte KI-Werkzeuge sowie Französisch für ForgeFlow (V16/V17).
Knowledge Hub, FlowPilot und PulseWatch sind im Gesamtpaket enthalten; bei Französisch
verwenden ihre eingebetteten Oberflächen weiterhin Englisch.

Vorbereitung: 284 erfolgreiche Tests gegen isoliertes echtes PostgreSQL, zwei opt-in
Skips, produktive JAR und Suite-Build sowie 25 erfolgreiche Offline-Deploymenttests.
Interaktiver Remote-Installer erfolgreich. Anschließend extern geprüft: Health
`ok`/`postgresql`, ausgeliefertes `index-jRtTvLPn.js` stimmt bytegenau mit dem lokalen
Release überein; anonyme Suite-/App-Aufrufe jeweils 401. Strg+F5 und erneut anmelden.
Keine angemeldete visuelle Abnahme und kein kostenpflichtiger KI-Aufruf in diesem Durchlauf.

## Gemeinsame Themes und produktive KI, 5. November 2026

Alle sieben Suite-Themes (Hell, Dunkel, Aurora, Dune, Forest, Ink, Rose) gelten auch
für eingebetteten Hub, FlowPilot und PulseWatch. Änderungen werden ohne Reload übertragen;
Standalone-Farbgebung bleibt erhalten. Suite-Migration V15 erweitert die erlaubten
gespeicherten Themes; installierte Migrationen werden nicht verändert.

Der Installer erzwingt keine Fake-KI mehr. Er liest ausschließlich auf dem Server
`AI_ENABLED`, `OPENAI_API_KEY` und `AI_MODEL` aus `/etc/forgeflow/backend.env`.
Bei aktivierter Suite-KI verwendet Hub denselben Schlüssel/Antwortmodell sowie
`text-embedding-3-small` mit 1536 Dimensionen; FlowPilot verwendet denselben
Schlüssel/dasselbe Modell im Live-Modus mit zunächst **5 reservierten Aufrufen pro
UTC-Tag**, gemeinsam für API und Worker und alle Suite-Benutzer. Das ist kein
gemeinsames Budget mit Hub/Suite. Hub behält seine Einwilligung vor externer
Verarbeitung und vorhandenen Anfrage-/Dokumentlimits. Kein automatischer bezahlter
Smoke-Test beim Installieren. Echte Providerberechtigung und Modellkompatibilität
sind erst durch einen bewussten realen Benutzeraufruf verifiziert.

Ohne aktivierte KI lautet der Zustand `disabled` / „KI nicht konfiguriert“.
Unvollständige aktivierte Konfiguration bricht die Bereitstellung ab; kein Fake-Fallback.
Die lokalen Standalone-Demo-Defaults bleiben fake/mock. FlowPilots HTTP-Adapter und
E-Mail-Simulation sowie explizite Stub-Knoten bleiben simuliert und gekennzeichnet;
echte KI läuft über `ai_classify` / `ai_transform`.

Optional hat eine private, root-eigene Datei `/etc/forgeflow/showcase/ai.json`
(Modus 0600) Vorrang. Felder: `mode` (`openai` oder `disabled`), bei `openai`
`api_key`, `model`, optional `embedding_model` und `flow_daily_calls` (1–100).
Werte nur privat auf dem Server bearbeiten, niemals im Chat oder im Repository.
Diese Datei wird bei wiederholter Bereitstellung gelesen und nicht überschrieben.
API und Worker erhalten automatisch dieselben Einstellungen; vorhandene Suite-
und Datenbankschlüssel werden nicht verändert.

Bereits mit Fake-Embeddings indizierte Dokumente werden durch die bestehende
Modellprofil-Trennung nicht als OpenAI-Index verwendet. Nach aktivierter
Einwilligung betreffende PDFs bewusst erneut hochladen; keine automatische
Übertragung alter Dokumente. Original-PDFs werden vom Hub nicht dauerhaft gespeichert.

Prüfung: `node scripts/test-showcase-themes.mjs` benötigt einen Hub-Produktionsbuild
auf Loopback 5300 und freie 5513. Testet sieben Paletten, beide echten Frontends,
sofortige Farbwechsel, erhaltene Frames/Chatentwurf und Hilfstextfarben mit
synthetischen APIs; 14 Screenshots unter `node_modules/.tmp/theme-screenshots`.
Offline-Providerchecks: `scripts/test-showcase-provider-modes.py hub` bzw. `flow`
mit dem jeweiligen App-Venv aus der Suite-Wurzel ausführen.

## Stand und Voraussetzungen

Update vom 5. November 2026: Nach Bereitstellung des korrigierten Pakets
`20261105T120842Z-29291506` bestätigt der Anwender, dass **beide Apps laden**.
Es ersetzt den alten Administrator-Check durch die aktive Suite-Sitzung und aktiviert
FlowPilots vorhandene Benutzertrennung. Der vorherige Lauf `20261105T114123Z-cf09cfaf`
war zwar erfolgreich, blockierte aber die sichtbaren Module mit 403. Die folgenden
früheren Installationsprobleme dienen als Historie, nicht als aktueller Serverstatus.
Die Ladebestätigung ersetzt keine vollständige Funktions-/Mehrbenutzerabnahme.

Serverinventur des Anwenders vom 5. November 2026: Ubuntu 26.04.1, 2 CPUs,
3,8 GiB RAM, 104 GiB frei. ForgeFlow/PostgreSQL 18.6 läuft, Flyway V14 erfolgreich.
Nextcloud besitzt bereits eigene gesunde PostgreSQL-/Redis-Container. Die Datenbanken
`ai_knowledge_hub` und `flowpilot` sowie pgvector fehlen.

Ubuntu hat Python 3.14; FlowPilot benötigt Python 3.12. Die Zusatz-Apps verwenden
deshalb den vorhandenen Docker-Dienst mit Python 3.12 und Node 22. Ein eigener Redis
läuft auf 127.0.0.1:6381. System-Python, Nextcloud-Container und bestehende Datenbanken
werden nicht ersetzt. Nur `postgresql-18-pgvector` wird bei Bedarf per apt ergänzt;
ein vorher simulierter Paketplan darf keine bestehenden Kerndienste verändern.

## Paket übertragen und ausführen

Der dritte Lauf hat alle Images erfolgreich gebaut und wurde beim ersten Lesen von
`/app/alembic/env.py` unter UID 10001 abgebrochen. Die kopierten Quellverzeichnisse hatten
restriktive root-Rechte. Die Python-Images normalisieren jetzt ausschließlich `/app`
auf 0755 für Verzeichnisse und 0644 für Dateien; Geheimnisse außerhalb des Images
behalten ihre privaten Rechte. Beide Python-Images führen einen Lesetest als UID 10001
aus, Next als node. Die Container laufen weiter ohne Root-Rechte und mit read-only
Dateisystem. Auch für diese Korrektur das neue Gesamtpaket übertragen.
Hintergrund: [Docker übernimmt Quellrechte](https://docs.docker.com/reference/dockerfile/),
[tar-data-Filter für Verzeichnisse](https://docs.python.org/3.14/library/tarfile.html).

Der zweite Serverlauf erreichte pip, brach aber an einer fehlerhaft erzeugten Constraint-
Datei ab (`==` ohne Paketname). Auch dieser Paketierungsfehler ist korrigiert: Python
schreibt und validiert jeden Eintrag direkt als `Name==Version`; der Archivcheck prüft
beide Dateien vor dem Upload. Keine Zeilen manuell auf dem Server entfernen und keine
Passwörter zurücksetzen. Das aktuelle neue Gesamtpaket mit seinen Prüfsummen übertragen.

Der erste Serverlauf hat Datenbanken/Rollen und pgvector bereits eingerichtet, brach
aber mit Compose 5.6.0 vor dem ersten Image-Build an einem außerhalb des Kontexts
liegenden Dockerfile ab. Das korrigierte Paket enthält jedes Dockerfile direkt im
zugehörigen Kontext und prüft diese Anordnung automatisch. Erneut das **neue gesamte
Paket** übertragen; bestehende Datenbanken, Secrets und Basisimage-Digests bleiben erhalten.
Das alte Sicherungsverzeichnis nicht löschen. Es ist keine zusätzliche fs.read-Freigabe
und kein Systemneustart für diese Korrektur nötig. Technischer Hintergrund:
[Docker-Bake-Dateizugriffe](https://docs.docker.com/reference/cli/docker/buildx/bake/).

```powershell
scp node_modules/.tmp/forgeflow-showcase.tar.gz `
  node_modules/.tmp/forgeflow-showcase.tar.gz.sha256 `
  node_modules/.tmp/install-linux-showcase.sh dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'sudo bash ~/install-linux-showcase.sh ~/forgeflow-showcase.tar.gz'
```

SSH- und sudo-Passwort ausschließlich im Anwenderterminal eingeben, nicht im Chat.
Bei benötigtem Serverzugriff ausdrücklich zur Passworteingabe auffordern. Linux-Build,
Migrationen und echte HTTPS-Prüfungen des neuen Pakets erfolgen im Installer.

Das Paket enthält die geprüfte neue Suite-JAR, gebaute statische Frontends und explizit
ausgewählte Hub-/Python-Quellen. Lokale `.env`, Konten und Entwicklungsdaten fehlen
absichtlich. Linux-Zeilenenden, Archivpfade und SHA256-Prüfsummen werden geprüft.

Vor Änderungen sichert der Installer JAR, Frontend, PostgreSQL-Rollen und vorhandene
betroffene Anwendungsdatenbanken privat unter `/opt/forgeflow/showcase-update.*`.
Fehlende Datenbanken und eingeschränkte Rollen werden getrennt eingerichtet:

| Datenbank | Eigentümer/Dienstrolle | Stand nach Installation |
| --- | --- | --- |
| forgeflow | forgeflow, unverändert | bestehende Daten, Flyway V14 |
| ai_knowledge_hub | ai_knowledge_hub_app | pgvector, Alembic 0003_authentication |
| flowpilot | flowpilot | Migrationen 001–006, Jobs und KI-Budget |
| forgeflow_pulsewatch | forgeflow_pulsewatch | Suite-UUIDs als Monitor-Eigentümer; vorhandene Native-Konten bleiben erhalten |
| nextcloud | eigenes bestehendes Compose-Projekt | unverändert |

Geheimnisse werden serverseitig unter `/etc/forgeflow/showcase/` privat erzeugt und bei
Wiederholung erhalten. Bestehende Passwörter werden nicht zurückgesetzt. Abweichende
Eigentümer oder fremde Konfigurationen führen zum Abbruch. Wirkliche Dienstrollen
werden über TCP angemeldet; keine Testdatenbanken werden auf dem Server angelegt.

Die offiziellen Basisimages werden einmal heruntergeladen und als Digests in `images.env`
festgehalten. Python-Constraints übernehmen die lokal vorhandenen Paketversionen.
Builds laufen nacheinander; mindestens 1,5 GB verfügbarer RAM und 5 GiB freier Platz
sind erforderlich. Swap und bestehende Docker-/Nextcloud-Dienste werden nicht verändert.

## Zugriff mit der Dev-Suite-Kennung

Die Apps verwenden `/knowledge-hub`, `/flowpilot/` und `/pulsewatch/`; ihre APIs eigene Präfixe
`/knowledge-hub-api/`, `/flowpilot-api/` und `/pulsewatch-api/`. Bestehendes HTTPS, keine neuen DNS-Einträge.
Bei direktem Aufruf behalten beide ihre eigenen Menüs und ihre Sprachwahl.

Die Apps verwenden aktive **reguläre Suite-Konten**, nicht nur Administratoren.
Nginx prüft jede Route über `GET /api/v1/auth/showcase-session`. Anonyme, deaktivierte,
abgelaufene und reine Kundenportal-Sitzungen erhalten keinen Zugriff. Der bisherige
Administrator-Endpunkt bleibt aus Kompatibilitätsgründen unverändert geschützt.
`VITE_SHOWCASE_ADMIN_ONLY=false` gibt nur die Menüeinträge frei, nicht die API.

Die öffentlichen Hub-/FlowPilot-APIs erzwingen `X-ForgeFlow-Mode: suite` unabhängig vom Client.
Die App-Backends prüfen das Suite-Cookie über eine feste interne URL. Hub verknüpft
stabile Suite-IDs mit privaten Eigentümern; FlowPilot verwendet den Suite-Gateway und
Suite-Worker mit getrennten PostgreSQL-Schemas und Redis-Namensräumen. Das Weglassen
oder Ändern des Client-Headers darf keinen globalen Standalone-Workspace freigeben.
Interne Bereitschaftsprüfungen bleiben über Loopback ohne diesen Header möglich.

PulseWatch prüft dieselbe aktive Suite-Sitzung am Nginx-Edge. Nginx überschreibt bei
jeder API-Anfrage eine mögliche Client-Angabe von `X-ForgeFlow-User-Id` mit der ID aus
der erfolgreichen Suite-Auth-Subrequest. PulseWatch bindet damit Monitore an die
Suite-UUID und stellt im Suite-Modus weder native Anmeldung noch Konto-Bootstrap bereit.
Die lokalen Native-/Demo-Modi bleiben separat erhalten. Die additive PulseWatch-Migration
entfernt nur den Fremdschlüssel, der bisher Monitor-Eigentümer an native PulseWatch-
Konten band; vorhandene Datensätze und Anmeldedaten werden nicht gelöscht oder geändert.

Kein separates Hub-, FlowPilot- oder PulseWatch-Konto anlegen: Nach dem Update Strg+F5 und erneut in der Suite
anmelden. Die Registrierung bleibt geschlossen. Bereits bestehende native Konten und
globale Standalone-Daten werden nicht automatisch per E-Mail verknüpft oder gelöscht.
Unabhängiger lokaler Standalone-Betrieb bleibt erhalten; die öffentlichen Unterpfade
auf `forge-flow.de` verwenden ausschließlich die Suite-Kennung. Externe Webhooks sind
ebenfalls durch die Suite-Anmeldung geschützt. KI verwendet die oben beschriebene
Serverkonfiguration; HTTP bleibt mock.

## Betrieb und Fehlerfälle

`forgeflow-showcase.service` startet das eigene Compose-Projekt nach Docker/Neustarts.
Container haben Ressourcenlimits, read-only Dateisysteme, reduzierte Rechte und begrenzte
Logs. Next und APIs binden an Loopback 3300/8000/8001/8082; statische PulseWatch-Assets an
Loopback 3302; Redis an Loopback 6381, Daten unter
`/var/lib/forgeflow-showcase/redis`. Hub-Cleanup entfernt stündlich abgelaufene Sessions
und Rate-Limit-Zähler. Datenbanken, Schlüssel und Redis dauerhaft zusammen sichern;
die Deployment-Sicherung ersetzt keinen regelmäßigen Backupplan.

Der Installer prüft echte Hub-/FlowPilot-/PostgreSQL-/Redis-Bereitschaft, anonyme
HTTPS-Aufrufe auf 401 und fremde schreibende Origins auf 403. Nur der vorhandene
forge-flow.de-HTTPS-VirtualHost wird ergänzt; Nginx-Syntaxprüfung vor Reload.
IP-/www-/Cloud-Sites bleiben bestehen. JAR und Suite-Frontend werden gemeinsam über
das vorhandene Update-Skript veröffentlicht; bisherige Browser-Sitzungen enden.

Bei Fehler wird die vorige Programm-/Frontend-/Nginx-Version wiederherzustellen versucht.
Neue Datenbanken/Rollen und additive Migrationen bleiben erhalten, es wird nichts
gelöscht oder destruktiv zurückmigriert. Sicherung und ausgegebene Wiederherstellungs-
meldung prüfen. Ein neuer Versuch braucht ein Paket mit neuer Release-ID; Schlüssel
und vorhandene Daten werden weiterverwendet.

```bash
sudo systemctl status forgeflow forgeflow-showcase nginx
sudo docker compose --project-name forgeflow-showcase --project-directory /opt/forgeflow-showcase/current \
  --env-file /etc/forgeflow/showcase/images.env ps
sudo docker compose --project-name forgeflow-showcase --project-directory /opt/forgeflow-showcase/current \
  --env-file /etc/forgeflow/showcase/images.env logs --tail=80 hub-api hub-web flow-api flow-worker pulsewatch-api pulsewatch-web
```

## Erneut vorbereiten und prüfen

Vor dem Paketieren Lint, Tests und aktuelle Builds aus demselben Checkout erstellen.
Suite: `VITE_DATA_MODE=api`, `VITE_API_BASE_URL=/api/v1`,
`VITE_KNOWLEDGE_HUB_URL=https://forge-flow.de/knowledge-hub`,
`VITE_FLOWPILOT_URL=https://forge-flow.de/flowpilot/`,
`VITE_PULSEWATCH_URL=https://forge-flow.de/pulsewatch/`, `VITE_SHOWCASE_ADMIN_ONLY=false`.
FlowPilot: `VITE_BASE_PATH=/flowpilot/`, `VITE_API_PREFIX=/flowpilot-api`,
`VITE_SUITE_ORIGIN=https://forge-flow.de`. Hub: `NEXT_PUBLIC_BASE_PATH=/knowledge-hub`,
`NEXT_PUBLIC_API_URL=/knowledge-hub-api`, `NEXT_PUBLIC_SUITE_ORIGIN=https://forge-flow.de`,
`FORGEFLOW_CONTAINER_BUILD=true`. PulseWatch: `VITE_BASE_PATH=/pulsewatch/`,
`VITE_API_BASE_URL=/pulsewatch-api/api/v1`. Nur Prozessumgebung setzen, keine `.env` überschreiben.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-showcase-release.ps1`
prüft Artefakt-Aktualität/URLs und erstellt das ignorierte Paket samt Manifest/Prüfsummen.
`python scripts/test-showcase-deploy.py` prüft Deployment-Grenzen offline.
`python scripts/check-showcase-build-contexts.py` prüft die Dockerfile-Pfade direkt im
fertigen Archiv und ist auch Teil des Paketierungsskripts.
`python scripts/check-showcase-python-packages.py STAGING_DIRECTORY` prüft zusätzlich
mit pip die gepinnten Runtime-Abhängigkeiten für Linux/Python 3.12 und baut beide
Python-Projekte als Wheels mit dem lokalen Python-3.12-Interpreter. Es lädt nur öffentliche
PyPI-Pakete in ignorierte Prüfverzeichnisse, installiert nichts und greift nicht auf
Datenbanken/Provider zu. Vorhandene Hub-/FlowPilot-Venvs werden benötigt. Technische
Grundlage: [pip download für andere Zielsysteme](https://pip.pypa.io/en/stable/cli/pip_download/).
Der ältere `node scripts/test-showcase-production.mjs` prüft Produktionsbuilds mit
synthetischen APIs: Unterpfade, Navigation, Sprache, Entwurfserhalt und keine Frames
für Nichtadministratoren und setzt damit noch die frühere Administrator-Sperre voraus.
Er ist keine Abnahme des neuen SSO-Deployments. Für seine bisherige Variante Hub-Produktion
auf Port 5300 mit den obigen Werten
starten, 5513 frei lassen. Das ersetzt keine Container-/Nginx-/Kontenprüfung am Server.

Technische Quellen: [Next.js basePath](https://nextjs.org/docs/pages/api-reference/config/next-config-js/basePath),
[Compose-Dienste](https://docs.docker.com/reference/compose-file/services/),
[offizielles Python-Image](https://hub.docker.com/_/python).
