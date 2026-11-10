# ForgeFlow - Installation, Start und Betrieb

ForgeFlow verbindet Projektverwaltung, Dokumentation, Entwicklerwerkzeuge, Zeiterfassung,
Business, Git und Cloud mit AI Knowledge Hub, FlowPilot und PulseWatch. Diese README
beschreibt die Einrichtung und den Betrieb. Bedienung und Screenshots stehen in den
[separaten PDF-Handbüchern](docs/handbuecher/README.md).

Stand: 6. November 2026. Der aktuelle vollständige Release ist auf
**https://forge-flow.de** installiert. Die Installation ist kontengetrennt; es gibt
kein eingebautes Standardpasswort.

## Den passenden Einstieg wählen

| Ziel | Weg |
| --- | --- |
| Oberfläche ausprobieren, ohne Datenbank | Abschnitt 2: flüchtige Frontend-Demo |
| ForgeFlow lokal mit dauerhaften Daten | Abschnitte 3 und 4 |
| Alle Apps gemeinsam lokal starten | Zusätzlich Abschnitt 5 |
| Bereits eingerichteten Ubuntu-Server aktualisieren | Abschnitt 7 |
| Neuer, noch nicht eingerichteter Server | Abschnitt 8; Update-Installer allein reicht nicht |
| Eigenständiger Betrieb einer Zusatz-App | Abschnitt 5 und deren eigene README |

## 1. Projektaufbau und Voraussetzungen

Befehle gelten für **Windows PowerShell**, sofern kein Bash-Block angegeben ist.
Zuerst in die ForgeFlow-Repositorywurzel wechseln. Der konkrete Laufwerkspfad ist frei
wählbar. Node-/Java-/Python-Prozesse nach Änderungen an PATH neu starten.

```text
showcase/
  dev-suite/                  diese README, npm-Workspace und gemeinsame Startskripte
    frontend/                 React 18 / TypeScript / Vite
    backend/                  Java 21 / Spring Boot / Maven / Flyway
    integrations/             Anbindung der separaten Apps
    deploy/showcase/           Docker-, Nginx- und systemd-Konfiguration
    scripts/                  Einrichtung, Start, Sicherung, Tests und Paketierung
    docs/                     vertiefende technische Dokumentation
    output/pdf/               separate Benutzerhandbücher
  ai-knowledge-hub/            Next.js + Python/FastAPI + PostgreSQL/pgvector
  flowpilot-codex-starter/     React + Python 3.12 + optional PostgreSQL/Redis
  pulse-watch/                React + Java 21 + PostgreSQL oder H2-Demo
```

| Komponente | Voraussetzung |
| --- | --- |
| ForgeFlow-Frontend | Node.js 22.12+ oder 24, npm; Root-`package-lock.json` |
| ForgeFlow-Backend | JDK 21, Maven 3.9; `JAVA_HOME` zeigt auf das JDK |
| Dauerhafte ForgeFlow-Daten | PostgreSQL 18 mit `psql`, `pg_dump` und `pg_restore` |
| Knowledge Hub | Python 3.12+, eigenes Backend-Venv, Node-Abhängigkeiten, PostgreSQL mit pgvector |
| FlowPilot | Python **3.12**, gesperrte Abhängigkeiten über `backend/uv.lock`; Redis nur für Infrastruktur/Jobs |
| PulseWatch | Node-Abhängigkeiten, JDK 21/Maven; lokale Suite-Demo verwendet flüchtiges H2 |
| Containerbetrieb | Docker mit Linux-Containern und Compose; für Hub-Datenbank oder Ubuntu-Gesamtbetrieb |

```powershell
node --version
npm.cmd --version
java -version
mvn.cmd -version
py -0p
```

`npm.cmd` vermeidet Probleme mit der PowerShell-Ausführungsrichtlinie.
Npm-Befehle der Suite aus `dev-suite/` ausführen; sie delegieren an `frontend/`.
Abhängigkeiten installieren:

```powershell
npm.cmd ci
```

Die Nachbarprojekte gehören nicht zum ForgeFlow-npm-Workspace. Ihre Abhängigkeiten
werden separat installiert. Bestehende `.env`-Dateien niemals pauschal überschreiben.

## 2. Schnelle Frontend-Demo ohne Backend

```powershell
$env:VITE_DATA_MODE = 'local'
npm.cmd run dev
```

Öffnen: **http://localhost:5173**. Änderungen an den Beispieldaten gelten nur in dieser
Sitzung und gehen beim Neuladen verloren. Dieser Weg startet nur die Suite-Oberfläche:
Er ist kein vollständiger Test von Anmeldung, KI, Datenbank oder Zusatz-Apps.

Nach dem Stoppen mit Strg+C die Prozessvorgabe entfernen:

```powershell
Remove-Item Env:VITE_DATA_MODE -ErrorAction SilentlyContinue
```

Für die Suite-Demo **mit allen vier lokalen Zusatz-Apps** nach Einrichtung der
Nachbarprojekte und bei laufendem Docker Desktop:

```powershell
npm.cmd run start:demo
```

Der gemeinsame Start wartet auf alle Dienste. Die lokalen App-Adressen werden nur
für den Prozess gesetzt; vorhandene `.env`-Dateien bleiben erhalten. Strg+C stoppt
die selbst gestarteten Apps und erhält Datenbanken/Volumes. Läuft DataScout bereits
auf 5176/8002 im Offline-Modus, `npm.cmd run start:demo -- -UseExistingDataScout`
verwenden; diese vorhandenen Container werden dabei weder übernommen noch gestoppt.
PulseWatch nutzt in der Suite Port **5177**, eigenständig weiterhin 5175.

## 3. ForgeFlow-Datenbank und erstes Konto

### PostgreSQL bereitstellen

PostgreSQL 18 installieren und den Dienst starten. Die Command Line Tools mitinstallieren;
pgAdmin ist optional. Ein vorhandener PostgreSQL-Dienst kann verwendet werden.

```powershell
$taskPgBin = 'D:\Program Files\PostgreSQL\18\bin' # an eigene Installation anpassen
& "$taskPgBin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres -W
```

Im **psql-Terminal** für eine neue, leere Installation:

```sql
CREATE ROLE forgeflow LOGIN;
\password forgeflow
CREATE DATABASE forgeflow OWNER forgeflow;
\q
```

`\password` fragt verdeckt nach dem Datenbankpasswort. Vorhandene Datenbanken/Rollen
nicht neu anlegen oder löschen. Bei bestehenden Installationen deren Zugang verwenden.

```powershell
& "$taskPgBin\psql.exe" -h 127.0.0.1 -p 5432 -U forgeflow -d forgeflow -W -c 'SELECT current_database(), current_user;'
```

Erwartet: Datenbank und Benutzer jeweils `forgeflow`. Tabellen erstellt Flyway
automatisch. Die App benötigt keinen Datenbank-Superuser.

### Frontend konfigurieren

Eine noch nicht vorhandene Datei `frontend/.env.local` aus
[frontend/.env.example](frontend/.env.example) anlegen. Für ForgeFlow mindestens:

```dotenv
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api/v1
VITE_NEXTCLOUD_URL=https://cloud.forge-flow.de
```

Cloud ist optional. Eine leere Cloud-URL deaktiviert den Öffnen-Link.
Alle `VITE_*`- und `NEXT_PUBLIC_*`-Werte gelangen in den Browser:
dort niemals Passwörter, Schlüssel oder Token speichern.

### Ersten Administrator anlegen

Nur für eine **neue Anwendung ohne vorhandene Konten** erforderlich:

```powershell
mvn.cmd -f backend/pom.xml compile dependency:build-classpath "-Dmdep.outputFile=target/classpath.txt"
java -cp ("backend/target/classes;" + (Get-Content -Raw backend/target/classpath.txt).Trim()) de.forgeflow.auth.HashPassword
```

Eigenes Anwendungspasswort eingeben: mindestens 12 Zeichen, höchstens 72 UTF-8-Bytes.
Danach im selben Terminal konfigurieren:

```powershell
$env:SPRING_PROFILES_ACTIVE = 'postgres'
$env:DB_URL = 'jdbc:postgresql://127.0.0.1:5432/forgeflow'
$env:DB_USER = 'forgeflow'
$taskDbSecret = Read-Host 'Datenbankpasswort für forgeflow' -AsSecureString
$env:DB_PASSWORD = [System.Net.NetworkCredential]::new('', $taskDbSecret).Password
$env:AUTH_USER_ID = 'initial-admin'
$env:AUTH_USER_EMAIL = Read-Host 'E-Mail für das Anwendungskonto'
$env:AUTH_USER_NAME = 'Administrator'
$env:AUTH_PASSWORD_HASH = Read-Host 'Vollständigen erzeugten BCrypt-Hash einfügen'
$env:APP_ORIGIN = 'http://localhost:5173'
$env:COOKIE_SECURE = 'false'
mvn.cmd -f backend/pom.xml spring-boot:run
```

Den vollständigen Hash einschließlich `$2a$`, `$2b$` oder `$2y$` übernehmen.
Zur Anmeldung später das ursprüngliche Anwendungspasswort verwenden.
Datenbankpasswort und Anwendungspasswort sind unabhängig.

Nach erfolgreichem Start mit Strg+C stoppen. Anschließend sensible Prozessvariablen löschen:

```powershell
Remove-Item Env:DB_PASSWORD, Env:AUTH_PASSWORD_HASH -ErrorAction SilentlyContinue
```

Ein normaler Neustart verwendet die gespeicherten Konten und setzt keine Passwörter
zurück. Keine Bootstrapwerte verwenden, um bestehende Konten zu überschreiben.

## 4. Dauerhafter lokaler Start

Einmalig die Datenbankverbindung prüfen und Windows-DPAPI-Konfiguration speichern:

```powershell
npm.cmd run setup:local -- -PostgresBin 'D:\Program Files\PostgreSQL\18\bin'
```

Die Pfadangabe bei Bedarf anpassen. Das Datenbankpasswort wird ausschließlich für
denselben Windows-Benutzer auf diesem PC verschlüsselt unter `backend/.local/` gespeichert.

Für den ersten Start **ohne vorbereitete Zusatz-Apps**:

```powershell
$env:FORGEFLOW_SKIP_SHOWCASE = 'true'
npm.cmd run start:local
```

Öffnen: **http://localhost:5173**. Backend: **http://127.0.0.1:3001/api/v1/health**.
Erwartete Health-Antwort: `status=ok`, `storage=postgresql`.
Mit E-Mail und Anwendungspasswort aus Abschnitt 3 anmelden.

Strg+C beendet nur die von diesem Start erzeugten Prozesse. PostgreSQL läuft weiter,
gespeicherte Daten bleiben erhalten. Logs: `backend/.local/logs/`.
Vor dem Backendstart wird standardmäßig eine tägliche Sicherung geprüft/erstellt.
Das Backendprofil `memory` hingegen verliert Daten und Dateien beim Neustart.

`COOKIE_SECURE=false` gilt nur für lokales HTTP. Für die Suite exakt
`http://localhost:5173` verwenden: `127.0.0.1` und andere Ports sind andere Origins.
Details: [lokaler Betrieb](docs/local-operation.md).

## 5. Alle Zusatz-Apps lokal einrichten

Die drei Nachbarordner aus Abschnitt 1 müssen existieren. Zuerst deren Einrichtung
abschließen; der gemeinsame Starter installiert keine Abhängigkeiten und erzeugt
keine Hub-Datenbank. Alle folgenden Beispiele beginnen in `dev-suite/`.

### AI Knowledge Hub

```powershell
Push-Location ../ai-knowledge-hub
if (!(Test-Path infra/.env)) { Copy-Item infra/.env.example infra/.env }
# infra/.env: eigenes PostgreSQL-Passwort setzen.
# Wenn ForgeFlow bereits 5432 belegt: POSTGRES_PORT=5433 setzen.
docker compose --env-file infra/.env -f infra/compose.yaml up -d --wait
Push-Location backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e '.[dev]'
# backend/.env: DATABASE_URL passend zur gewählten Hub-Datenbank setzen.
# AI_PROVIDER=fake für den lokalen Demo-Betrieb verwenden.
.\.venv\Scripts\python.exe -m alembic upgrade head
Pop-Location
Push-Location frontend
npm.cmd ci
Pop-Location
Pop-Location
```

Vor Alembic die richtige **eigene Hub-Datenbank** wählen. Die Extension `vector`
muss vorhanden sein; das Compose-Init richtet sie nur bei einem neuen Volume ein.
Alternativ einen bestehenden PostgreSQL-Server mit pgvector verwenden.
Zugang und Port aus `infra/.env` und `infra/compose.yaml` übernehmen, bei einem
Hub-Container auf 5433 auch in `backend/.env` Port 5433 verwenden. Nicht die
ForgeFlow-Verbindungsdaten kopieren. Die Datenbank-URL kann URI-kodierte Zeichen benötigen.
Details: [Hub-README](../ai-knowledge-hub/README.md).

### FlowPilot

```powershell
Push-Location ../flowpilot-codex-starter
npm.cmd ci
python -m venv .tools/bootstrap
.\.tools\bootstrap\Scripts\python.exe -m pip install uv==0.13.6
$env:UV_PYTHON_INSTALL_DIR = Join-Path $PWD '.tools/python'
$env:UV_CACHE_DIR = Join-Path $PWD '.cache/uv'
.\.tools\bootstrap\Scripts\uv.exe sync --project backend --python 3.12 --locked
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
.\backend\.venv\Scripts\python.exe -m flowpilot.integrations.keys
Pop-Location
```

Der Schlüsselgenerator dient der eigenen lokalen Konfiguration; Ausgabe nur privat
in der vorgesehenen Backend-Konfiguration übernehmen. Für den gemeinsamen Demo-Start
sind PostgreSQL, Redis und Worker für FlowPilot nicht erforderlich.
Für dauerhafte Workflows/Jobs: eigene PostgreSQL-/Redis-Verbindung konfigurieren,
`python -m flowpilot.migrate` aus dem vorbereiteten Backend-Venv explizit ausführen
und den Worker starten. Der normale API-Start migriert FlowPilot nicht automatisch.
Details: [FlowPilot-README](../flowpilot-codex-starter/README.md).

### PulseWatch

```powershell
Push-Location ../pulse-watch
npm.cmd ci
Pop-Location
```

Der Suite-Starter baut das Java-Backend und startet ausdrücklich das Demo-Profil mit
flüchtigem H2 und internen Prüffällen. Dafür braucht PulseWatch keine eigene Datenbank.
Eigenständiger dauerhafter Betrieb mit eigenem Konto und PostgreSQL ist separat über
`setup:local` / `setup:account` einzurichten:
[PulseWatch-README](../pulse-watch/README.md).

### Gemeinsamer Start

```powershell
Remove-Item Env:FORGEFLOW_SKIP_SHOWCASE -ErrorAction SilentlyContinue
npm.cmd run start:local
```

| App | Oberfläche | Backend | Lokaler gemeinsamer Modus |
| --- | --- | --- | --- |
| ForgeFlow | localhost:5173 | 127.0.0.1:3001 | PostgreSQL, reguläre Anmeldung |
| Knowledge Hub | localhost:3000 | 127.0.0.1:8000 | local-demo, Fake-KI, eigene Datenbank |
| FlowPilot | localhost:5174 | 127.0.0.1:8001 | Demo, Mock-KI/-HTTP |
| PulseWatch | localhost:5177 | 127.0.0.1:8082 | Demo/H2, interne Prüffälle |

Alle acht Ports müssen frei sein. Der Start kann mehrere Minuten dauern.
Die Starter ändern keine `.env` der Nachbarprojekte; ihre Demo-Vorgaben gelten nur
im jeweiligen Prozess. In lokalen Demos sind Identitäten nicht automatisch gemeinsam.
Der produktive Suite-Betrieb verwendet dagegen die aktive ForgeFlow-Sitzung.
Standalone-Starts behalten ihre eigene Navigation und ihre eigene Anmeldung.

## 6. Erstkonfiguration in der Anwendung

1. Unter Einstellungen das Profil, Optik und die Sprache prüfen.
   Deutsch, Englisch und Französisch sind für ForgeFlow verfügbar.
2. Als Administrator unter **Anwendungen** die global sichtbaren Navigations-Apps wählen.
   Ausblenden ist keine fachliche API-Zugriffssperre; Einstellungen bleiben erreichbar.
3. Unter **KI** separat die Apps mit KI-Button wählen. Standard ist nur Projektmanager.
   Nur dort stehen Datenwerkzeuge zur Verfügung; andere aktivierte Buttons erlauben
   allgemeinen Chat. Schreibvorschläge benötigen Bestätigung.
4. Unter **Globale Einstellungen** die gemeinsame Branchenliste pflegen.
5. Weitere reguläre Benutzer als Administrator anlegen.
6. Vor Business-Dokumenten Absender, Steuer, Währung, Bank und Zahlungsvorgaben einrichten.
   Kundenportalkonten sehen ausschließlich ausdrücklich freigegebene Inhalte.

Französisch verwendet in Knowledge Hub, FlowPilot und PulseWatch noch den englischen
Fallback. Cloud/Nextcloud hat eine eigene Sprach- und Kontoverwaltung.
Funktionsgrenzen und Bedienung: [Handbücher](docs/handbuecher/README.md).

## 7. Bestehenden Ubuntu-Server vollständig aktualisieren

Ziel dieser Installation: `forge-flow.de`; dokumentierter SSH-Zugang
`dreinerts@185.56.150.178`. Für andere Hosts sind die fest auf diesen Server
abgestimmten Skripte vor Nutzung anzupassen. Der Installer ist **kein generischer
Erstinstallationsassistent**.

### Voraussetzungen auf dem bestehenden Server

- Ubuntu mit laufendem ForgeFlow-/PostgreSQL-18-Dienst, Nginx und gültigem HTTPS.
- Kanonischer Ursprung `APP_ORIGIN=https://forge-flow.de`, `COOKIE_SECURE=true`.
- Docker Engine mit Compose, Python 3, Git und PostgreSQL-Clientwerkzeuge.
- Mindestens 1,5 GB verfügbarer RAM und 5 GiB freier Platz vor Container-Builds.
- Eigene Konten, produktive Secrets und bestehende Datenbanken erhalten.
- Node-/Maven-Builds der Suite laufen lokal; Container-Builds der Zusatz-Apps auf dem Server.

### Aktuelle Artefakte erstellen

Lint und relevante Tests vor dem Paketieren ausführen. Nach Backendänderungen
eine frische Spring-Boot-JAR bauen:

```powershell
npm.cmd run lint
npm.cmd test
mvn.cmd -f backend/pom.xml package
# Optional mit installiertem PostgreSQL 18: isolierte echte DB-Tests plus JAR
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-postgres-isolated.ps1
```

Suite-Frontend mit expliziten Produktionswerten bauen:

```powershell
$env:VITE_DATA_MODE = 'api'
$env:VITE_API_BASE_URL = '/api/v1'
$env:VITE_KNOWLEDGE_HUB_URL = 'https://forge-flow.de/knowledge-hub'
$env:VITE_FLOWPILOT_URL = 'https://forge-flow.de/flowpilot/'
$env:VITE_PULSEWATCH_URL = 'https://forge-flow.de/pulsewatch/'
$env:VITE_SHOWCASE_ADMIN_ONLY = 'false'
npm.cmd run build
```

FlowPilot und PulseWatch ebenfalls mit ihren Produktionspfaden bauen:

```powershell
Push-Location ../flowpilot-codex-starter/frontend
$env:VITE_BASE_PATH = '/flowpilot/'
$env:VITE_API_PREFIX = '/flowpilot-api'
$env:VITE_SUITE_ORIGIN = 'https://forge-flow.de'
npm.cmd run build
Pop-Location

Push-Location ../pulse-watch/frontend
$env:VITE_BASE_PATH = '/pulsewatch/'
$env:VITE_API_BASE_URL = '/pulsewatch-api/api/v1'
$env:VITE_SUITE_ORIGIN = 'https://forge-flow.de'
npm.cmd run build
Pop-Location
```

Dafür ein **eigenes Build-Terminal** verwenden und danach schließen, damit die
Produktivvariablen nicht in den nächsten lokalen Start übernommen werden.
Knowledge Hub wird aus den mitgelieferten Quellen im Docker-Build gebaut.
Seine Umgebungen sowie private Providerwerte verwaltet der Installer auf dem Server.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-showcase-release.ps1
```

Der Paketierer prüft frische Artefakte, Produktionspfade, Docker-Kontexte, Python-Pins,
Linux-Zeilenenden und Prüfsummen. Ausgabe:
`node_modules/.tmp/forgeflow-showcase.tar.gz`, zugehörige `.sha256` und der
LF-normalisierte `install-linux-showcase.sh`. Lokale Secrets und Daten werden nicht kopiert.

### Übertragen und installieren

```powershell
scp node_modules/.tmp/forgeflow-showcase.tar.gz `
  node_modules/.tmp/forgeflow-showcase.tar.gz.sha256 `
  node_modules/.tmp/install-linux-showcase.sh dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'sudo bash ~/install-linux-showcase.sh ~/forgeflow-showcase.tar.gz'
```

SSH- und sudo-Passwörter nur im Terminal eingeben. Auf **Deployment ready** warten.
Der Installer sichert Anwendungen, Datenbanken und Konfiguration vor Änderungen,
baut die Container, migriert und prüft die Dienste. V16 ergänzt die App-/KI-Auswahl,
V17 Französisch. JAR und Frontend immer zusammen aktualisieren.

Bei Fehlern die vollständige Terminalausgabe und den privaten Sicherungspfad erhalten.
Keine Migrationen manuell löschen und keine alte JAR unbesehen zurückspielen.
Automatische Rücksicherung von Programm-/Nginx-Dateien ist keine Datenbank-Rückmigration.

### Erfolg prüfen

```powershell
Invoke-RestMethod https://forge-flow.de/api/v1/health
curl.exe -fsS https://forge-flow.de/
```

Erwartet: `ok` und `postgresql`, aktueller Assetname in der HTML-Seite.
Nicht angemeldete Aufrufe von `/knowledge-hub/`, `/flowpilot/`, `/pulsewatch/`
müssen 401 liefern. Anschließend Strg+F5 und erneut anmelden. Erst danach die
angemeldeten Ansichten manuell prüfen. Health allein belegt keine KI-Modellberechtigung.

Vollständiger Ablauf, Rollbackgrenzen und Containerdetails:
[Gesamtdeployment](docs/showcase-deployment.md).

## 8. Neuer Server und optionale Integrationen

Ein neuer Server benötigt zuerst eine eingerichtete ForgeFlow-Basis: PostgreSQL-Rolle
und Datenbank, Java-21-Laufzeit, Dienstbenutzer, JAR unter `/opt/forgeflow/backend.jar`,
systemd-Dienst `forgeflow`, privates `/etc/forgeflow/backend.env`, Frontend unter
`/var/www/forgeflow`, Nginx-Proxy auf `127.0.0.1:3001`, DNS sowie TLS/Certbot.
Das erste Administratorkonto muss wie in Abschnitt 3 im PostgreSQL-Profil angelegt
werden. Das Ubuntu-Update setzt diese Basis voraus und bricht sonst ab.
[Basisserver und HTTPS](docs/linux-server.md), [Backendkonfiguration](backend/README.md).

| Integration | Einrichtung / Grenze |
| --- | --- |
| ForgeFlow-KI | Nur Backend: `AI_ENABLED=true`, `OPENAI_API_KEY`, explizites `AI_MODEL`. Standard deaktiviert. [KI](docs/ai-assistant.md) |
| Hub-/FlowPilot-KI | Produktiv übernimmt der Installer private Suite-Providerwerte; optional `/etc/forgeflow/showcase/ai.json` mit Vorrang. Keine Schlüssel im Browser. Hub-Einwilligung erforderlich; FlowPilot zunächst 5 Aufrufe pro UTC-Tag. [Providerbetrieb](docs/showcase-deployment.md) |
| Git und externe PostgreSQL-Verbindungen | Persistentes `INTEGRATION_SECRET_KEY`, Git, Zielhosts über `DEV_DB_HOSTS`. Schlüssel mit Datenbank sichern und bei Updates erhalten. [Entwicklerintegrationen](docs/developer-tools.md) |
| Nextcloud | Eigene DNS-/TLS-/Docker-Installation, eigenes Konto und eigene Sicherung. Kein Suite-SSO. [Nextcloud](docs/nextcloud.md) |
| Testkonten | Sechs Stunden Laufzeit; `TRIAL_ACCOUNTS_ENABLED=false` deaktiviert neue Registrierung. Nach Ablauf bereinigt das Backend die Testdaten. |
| FlowPilot HTTP/E-Mail | Vorhandene Adapter sind im dokumentierten Showcase simuliert. Keine echten Zustellungen versprechen. |
| PulseWatch Alarme | Alarmereignisse und lokale Mailvorschauen; kein echter E-Mail-Versand. |

## 9. Sicherung, Wiederherstellung und Neustarts

```powershell
npm.cmd run backup:local
# Wiederherstellung nur mit gewähltem Backup und neuem Ziel:
Get-Help ./scripts/restore-local.ps1 -Detailed
```

Konkrete Restoreparameter zuerst in [Sicherung/Wiederherstellung](docs/local-operation.md)
prüfen. Das Skript stellt nur in eine **neue** Datenbank mit Präfix `forgeflow_restore_`
wieder her; es ersetzt keine aktive Datenbank. DPAPI-Dateien lassen sich nicht einfach
auf einen anderen PC kopieren.

Auf Ubuntu privat und regelmäßig sichern: alle vier Anwendungsdatenbanken, private
`/etc/forgeflow/`-Konfiguration, Redis-Daten, Git-Clones und gegebenenfalls Nextcloud-Volumes.
Installer-Sicherungen sind kein laufender Backupplan. Anwendungssitzungen können nach
Backendneustarts enden; gespeicherte Fach-/Dateidaten bleiben im PostgreSQL-Profil erhalten.

```bash
sudo systemctl status forgeflow forgeflow-showcase nginx
sudo journalctl -u forgeflow -n 100 --no-pager
sudo docker compose --project-name forgeflow-showcase \
  --project-directory /opt/forgeflow-showcase/current \
  --env-file /etc/forgeflow/showcase/images.env ps
```

Private Logs vor dem Teilen auf Zugangsdaten prüfen. Nextcloud separat betreiben und sichern.

## 10. Fehler gezielt eingrenzen

| Symptom | Prüfung |
| --- | --- |
| `node`, `java`, `mvn` nicht gefunden | PATH, JDK 21, `JAVA_HOME`; IntelliJ-Terminal neu öffnen |
| Port belegt / Starter beendet | Vorherigen eigenen Starter mit Strg+C stoppen; Logs unter `backend/.local/logs/` prüfen |
| Anmeldung: Invalid request origin | Exakte Browseradresse und `APP_ORIGIN` vergleichen, lokal `localhost:5173`, öffentlich kanonische HTTPS-Domain |
| Trotz Anmeldung keine API-Daten | `VITE_DATA_MODE=api`, laufendes Backend, gültige Sitzung; kein automatischer Demo-Fallback |
| Zusatz-App fehlt links | Globale App-Auswahl und mögliche Administratorbeschränkung prüfen |
| KI-Button fehlt | Globale KI-Auswahl, aktive App, API-Betrieb; Standard nur Projektmanager |
| KI antwortet nicht | Server-Providerkonfiguration, Modellberechtigung, Quota und Limits; keine Schlüssel in den Chat kopieren |
| Hub startet nicht / 503 | Eigene DB-Verbindung, pgvector und Alembic-Migrationen prüfen; Health kann nur Prozessbereitschaft bedeuten |
| FlowPilot startet mit Import-/Pythonfehler | Das eigene, per uv eingerichtete Python-3.12-Venv verwenden |
| Änderungen verschwinden | Demo-/memory-/H2-Modus prüfen; diese speichern nicht wie produktives PostgreSQL |
| Speicher-Konflikt | Serverstand neu laden und Änderungen prüfen; nicht blind erneut überschreiben |
| Nach Deployment alte Oberfläche | Strg+F5, Assetname prüfen; Backendneustart allein aktualisiert keine Frontenddateien |
| SSH `Permission denied` | Gültiger Schlüssel oder interaktive Passwortanmeldung erforderlich; Paket ist dadurch noch nicht installiert |

## 11. Prüfungen und weitere Dokumentation

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd test
mvn.cmd -f backend/pom.xml test
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-postgres-isolated.ps1
```

Der PostgreSQL-Helfer verwendet einen eigenen temporären Cluster; keine produktive
Datenbank für Tests verwenden. Im eingeschränkten Agenten-PATH kann
`scripts/verify-backend.ps1` Java/Maven portabel vorbereiten; erstmalige Downloads
benötigen Netzwerkzugang. Build-/Testartefakte und Schlüssel nicht versionieren.

- [PDF-Handbücher mit Screenshots](docs/handbuecher/README.md)
- [Lokaler Betrieb, Ports und Sicherungen](docs/local-operation.md)
- [Gesamtdeployment und produktive Provider](docs/showcase-deployment.md)
- [Backend-Setup](backend/README.md) und [API-Vertrag](docs/backend-api.md)
- [Aktueller Stand und bekannte Grenzen](docs/HANDOFF.md)
- [Manuelle Browserprüfung](docs/browser-check.md)

## DataScout als lokale Zusatz-App

Der gemeinsame Start ergänzt DataScout aus ../data-scout über Docker Compose
(Docker Desktop, Linux-Container und eingerichtetes infra/.env vorausgesetzt).
UI: http://localhost:5176, API: http://127.0.0.1:8002. Ein eigenständiges DataScout
auf 5173/8000 zuerst stoppen, damit die Suite ihre bisherigen Ports verwenden kann.
Bestehende Daten und globale App-Auswahlen bleiben erhalten. Im API-Modus aktiviert
ein Administrator den Eintrag unter Einstellungen → Anwendungen; die Frontend-Demo
zeigt ihn direkt. Details und Stop-/Wechselbefehle: docs/local-operation.md.
Diese Anbindung gilt für die lokale gemeinsame Fixture-Demo. Im Produktionsbuild
bleibt DataScout bis zu serverseitiger SSO-/Kontotrennung deaktiviert; kein Deployment.
