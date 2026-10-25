# Linux-Server: Domain und bisheriger IP-Zugriff

## Domain `forge-flow.de`

### Nextcloud als zusätzlicher Dienst

Für `cloud.forge-flow.de` sind ein separater Nextcloud-Installer, Offline-Prüfskript und
konsistente Sicherung vorbereitet. Die ForgeFlow-App ergänzt dafür Cloud → Dateien.
DNS-A-Record und interaktive SSH-/sudo-Installation sind noch auszuführen; eigene
Nextcloud-Anmeldung, kein SSO. [Vollständige Befehle und Betrieb](nextcloud.md).

Das aktuelle gemeinsame ForgeFlow-Paket enthält außerdem die Business-Erweiterung;
zuletzt geprüfter Einstiegspunkt **`index-B_Ba4uIu.js`**. Ältere Assetnamen weiter unten
beschreiben historische Updates.

### Aktuelles Update über die Domain

Direkter Agenten-Abruf am 25. Oktober: Domain liefert noch `index-v42BXDKf.js`, also den
Login-Icon-Stand vor Navigations-/Historienänderungen. Die Health-API antwortet mit
PostgreSQL/ok. Der IP-Zugriff scheitert inzwischen an der Zertifikats-Namensprüfung.
Deshalb beim aktuellen Update **forge-flow.de** als Prüfhost verwenden, nicht die IP.
Das Skript unterstützt jetzt validierte Domainnamen und IPv4 und prüft HTTPS mit dem
passenden SNI/Host. APP_ORIGIN und alle anderen Backend-Einstellungen bleiben erhalten.

In Windows-PowerShell ausführen:

```powershell
Set-Location 'D:\Projects\Vite\dev-suite'
scp scripts/update-linux-chat.sh scripts/test-linux-chat.sh `
  node_modules/.tmp/forgeflow-chat-backend.jar `
  node_modules/.tmp/forgeflow-chat-frontend.tar.gz `
  node_modules/.tmp/forgeflow-chat.sha256 `
  dreinerts@185.56.150.178:

ssh -t dreinerts@185.56.150.178 'bash ~/test-linux-chat.sh && sudo bash ~/update-linux-chat.sh forge-flow.de'

curl.exe -fsS 'https://forge-flow.de/?check=navigation-update' |
  Select-String 'index-.*\.js'
```

Erwarteter Assetname: **`index-BG_A8046.js`**. Dann Strg+F5 und neu anmelden.
Backend-Neustart allein veröffentlicht keine neuen Frontend-Dateien. Agenten-SSH mit
BatchMode wurde abgewiesen (`Permission denied (publickey,password)`); deshalb ist die
Installation weiterhin vom Anwender über dessen interaktive SSH-/sudo-Anmeldung auszuführen.

### Erlaubter Backend-Ursprung

Der Anwender hat die Domain `forge-flow.de` zugewiesen und einen zusätzlichen Nginx-
VirtualHost nach einer externen Anleitung eingerichtet. Der aktuelle Login-Screenshot
zeigt „Invalid request origin“. `SecurityConfig` prüft Schreibanfragen einschließlich
Login gegen exakt einen konfigurierten Ursprung (`forgeflow.origin` aus `APP_ORIGIN`).
Die bisherige öffentliche Einrichtung verwendet `https://185.56.150.178`.

Für den Betrieb unter `https://forge-flow.de` muss in `/etc/forgeflow/backend.env`
`APP_ORIGIN=https://forge-flow.de` stehen, ohne abschließenden Slash oder URL-Pfad.
`COOKIE_SECURE=true` bleibt für HTTPS erforderlich. Vor dem Bearbeiten die Datei mit
`sudo cp -p` in eine eigene, rootgeschützte Sicherung kopieren; anschließend den Dienst
`forgeflow` neu starten und die lokale Health-API prüfen. Kein Frontend-/Backend-Neubuild
und keine Änderung der Datenbank oder Konten erforderlich.

`https://www.forge-flow.de`, die IP-Adresse und HTTP sind andere Ursprünge. Der aktuelle
Backend-Vertrag akzeptiert keine kommagetrennte Origin-Liste. Als Hauptadresse die Domain
ohne www verwenden; weitere Namen gegebenenfalls in Nginx auf diese HTTPS-Adresse umleiten.
Parallel ausgelieferte IP-/Domain-Seiten bedeuten noch keine parallele Login-Unterstützung.
Origin-/CSRF-Prüfung nicht deaktivieren und den Origin-Header nicht im Proxy umschreiben.

Die vorhandene Installation verwendet bereits Certbot als Snap. Zusätzliche apt-
Installationen aus fremden Anleitungen sind für diesen Login-Fehler nicht nötig.
Nginx-/Zertifikatstatus und externe Domain-Erreichbarkeit wurden in diesem Schritt
nicht am Server verifiziert; die Anpassung muss der Anwender per SSH ausführen.

## Bisheriges Deployment

Das neue Navigations-/Historienpaket verwendet Flyway V10. Beide Artefakte zusammen
mit den vorhandenen Chat-Update-/Testskripten installieren. Keine neue Umgebungsvariable;
nach Update neu anmelden und Strg+F5. [Änderungen und Grenzen](navigation-and-history.md).

Das aktuelle Paket ergänzt kompakte Dev Tools und private REST-Collections. Beide
Artefakte zusammen mit dem bestehenden Chat-Update-Skript veröffentlichen; V9 läuft
automatisch. PostgreSQL-Konfiguration und KI-Einstellungen bleiben erhalten. Details:
[REST-Collections](rest-collections.md). Anschließend mit Strg+F5 neu laden und anmelden.

Ziel des Anwenders: Frontend und Backend laufen auf dem Ubuntu-Server und sind direkt
unter `https://185.56.150.178` erreichbar. Die neue Domain-Konfiguration steht oben.
SSH wird weiterhin für Administration und Dateiübertragung verwendet.

## Vorhandene Installation

Das Einrichtungsskript setzt die bisher eingerichtete Installation voraus:

- Java-Backend als Dienst `forgeflow`, erreichbar auf `127.0.0.1:3001`, Profil `postgres`.
- PostgreSQL mit eingerichtetem Anwendungskonto; keine neue Datenbankanlage durch das Skript.
- Frontend-Dateien unter `/var/www/forgeflow/` und aktivierte Nginx-Site `forgeflow`.
- Backend-Einstellungen unter `/etc/forgeflow/backend.env`.
- Certbot als Snap, mindestens Version 5.4, mit vorhandenem Erneuerungstimer.
- TCP-Ports 80 und 443 müssen vom Internet erreichbar sein. Eine zusätzliche
  Firewall des Serveranbieters gegebenenfalls dort freigeben. Vorhandene UFW-Regeln
  ergänzt das Skript um diese Web-Ports; es aktiviert UFW nicht und ändert keine SSH-Regeln.

IP-Zertifikate sind bei Let's Encrypt öffentlich verfügbar. Sie sind rund sechs Tage
gültig und benötigen automatische Erneuerung. Die Webroot-Methode benötigt Certbot 5.4+.
Quellen: [IP-Zertifikate](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability/),
[Certbot-Unterstützung](https://letsencrypt.org/2026/03/11/shorter-certs-certbot/).

## Umstellung ausführen

Auf dem Windows-PC in PowerShell:

```powershell
cd D:\Projects\Vite\dev-suite
scp scripts/enable-linux-public.sh dreinerts@185.56.150.178:enable-linux-public.sh
ssh -t dreinerts@185.56.150.178 'sudo snap refresh certbot && sudo bash ~/enable-linux-public.sh 185.56.150.178'
```

Bei SSH-/sudo-Abfragen das jeweilige Serverpasswort im Terminal eingeben. Certbot fragt
gegebenenfalls nach Kontaktangaben und der Zustimmung zu seinen Nutzungsbedingungen.

Das Skript prüft Voraussetzungen, sichert Nginx- und Backend-Konfiguration in einem
rootgeschützten Verzeichnis unter `/etc/forgeflow/public-backup.*` und fordert das Zertifikat
per HTTP-Webroot an. Während der Zertifikatsanforderung wird die bisherige ForgeFlow-Site
vorübergehend durch eine reine Challenge-Site ersetzt; danach folgt die öffentliche HTTPS-Site.
Vor Certbot setzt es die drei Webroot-Verzeichnisse explizit auf Modus 0755 und ruft
eine temporäre Prüfdatei mit Modus 0644 über Loopback und die öffentliche IP ab.
Nur bei exakt passendem Inhalt beginnt die Zertifikatsanforderung. Bei einem Fehler
erscheinen die betroffene Route und, falls `namei` vorhanden ist, die Pfadberechtigungen.
Ein Fehler der öffentlichen Prüfung kann auch an einer fehlenden Rückroute zur eigenen
öffentlichen IP liegen; die Ausgabe muss dann geprüft werden.

Es setzt ausschließlich `APP_ORIGIN=https://185.56.150.178` und `COOKIE_SECURE=true` neu;
die anderen Backend-Werte einschließlich Zugangsdaten bleiben erhalten. Das Backend wird
neu gestartet, Nginx neu geladen und ein Certbot-Erneuerungshook für Nginx eingerichtet.
Anschließend prüft es die Erneuerung per Dry-Run und Frontend/API lokal über den HTTPS-Endpunkt
mit echter Zertifikatsprüfung. Ein anderer vorhandener TLS-Standardserver auf Port 443
führt vor der Umstellung zum Abbruch, damit dessen Konfiguration zuerst geprüft werden kann.
Auskommentierte Listener werden dabei ignoriert. Bei einem aktiven Konflikt nennt das Skript
Datei und Zeile; diese Ausgabe zuerst prüfen, bevor eine vorhandene Site geändert wird.
Bei einem Abbruch mit einer älteren Skriptversion die aktuelle Datei erneut per `scp`
übertragen und denselben Einrichtungsbefehl ausführen.

Bei Fehler oder Unterbrechung stellt das Skript die vorherigen Nginx-/Backend-Dateien wieder
her und lädt die Dienste entsprechend neu. Bereits ausgestellte Zertifikate und ergänzte
Firewall-Freigaben werden dabei nicht entfernt. Nach erfolgreicher Umstellung bleiben die
Sicherungskopien erhalten. Die Zertifikatserneuerung übernimmt der Certbot-Snap-Timer.

Danach im Browser `https://185.56.150.178` öffnen. Vorhandene Konten und Passwörter bleiben gültig;
nach dem Backend-Neustart erneut anmelden. Ein Terminal muss für den Browserzugriff nicht
geöffnet bleiben. Backend-Port 3001 und PostgreSQL bleiben intern.

## Update: Einstellungsmenü und Sprachwahl

Dieses Update benötigt neue Frontend-Dateien und eine neue Backend-JAR. Die Sprache
wird je Konto gespeichert. Flyway V4 ergänzt `ff_settings.language` mit `de` für
vorhandene Einstellungen. Optik und Projektmanager-Vorgaben bleiben erhalten.
Die Sprachwahl wird inzwischen für Einstellungen, Wiki und Dev Tools gemeinsam verwendet.

Das vorbereitete Update auf dem Windows-PC übertragen und starten:

```powershell
scp scripts/update-linux-settings.sh node_modules/.tmp/forgeflow-settings-frontend.tar.gz node_modules/.tmp/forgeflow-settings-backend.jar dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'sudo bash ~/update-linux-settings.sh 185.56.150.178'
```

Das Skript setzt die bestehende Installation und die lokale PostgreSQL-Datenbank
`forgeflow` voraus. Es sichert JAR, Frontend und einen PostgreSQL-Custom-Dump in einem
rootgeschützten Verzeichnis `/opt/forgeflow/settings-update.*`, bevor es den Dienst stoppt.
Der Dump verwendet das Systemkonto `postgres` und lokale Peer-Anmeldung. Scheitert schon
die Sicherung, wird die laufende Anwendung nicht geändert.

Nach dem Backend-Start und erfolgreicher Health-Prüfung werden die Frontend-Dateien
aktualisiert und HTTPS geprüft. Im Fehlerfall stellt es die bisherigen Programmdateien
wieder her; die additive Datenbankmigration wird nicht automatisch zurückgenommen.
Eine fehlgeschlagene Wiederherstellung wird ausdrücklich gemeldet. Das Update-Skript
wurde lokal auf Bash-Syntax und ungültige IP-Argumente geprüft. Der Anwender führte es
anschließend auf Ubuntu erfolgreich aus; Sicherung unter
`/opt/forgeflow/settings-update.Xl7DaM`. Die anfänglichen Verbindungsfehler während des
Backend-Neustarts wurden überwunden. Der Agent bestätigte danach von außen die neue
Frontend-Datei `index-BiJ_2Lb7.js` und die Health-API mit PostgreSQL. Die Browserprüfung
des Menüs und der gespeicherten Sprachwahl bleibt offen.

Nach der Abschlussmeldung `Settings update ready` die Seite mit Strg+F5 neu laden und
erneut anmelden. Menüwechsel, Sprachwahl sowie Speicherung nach Neuanmeldung testen.

Falls die vorbereiteten Dateien fehlen, im Projekt neu bauen:

```powershell
npm.cmd run build
mvn.cmd -f backend/pom.xml package
New-Item -ItemType Directory -Path node_modules/.tmp -Force | Out-Null
tar.exe -czf node_modules/.tmp/forgeflow-settings-frontend.tar.gz -C frontend/dist .
Copy-Item backend/target/backend-0.1.0-SNAPSHOT.jar node_modules/.tmp/forgeflow-settings-backend.jar
```

## Frontend-Update: Wiki und Dev Tools auf Englisch

Die bestehende Sprachwahl wird weiterverwendet; Backend und Datenbank benötigen
hierfür kein Update. Das vorbereitete Frontend auf dem Windows-PC übertragen:

```powershell
scp node_modules/.tmp/forgeflow-frontend-language.tar.gz dreinerts@185.56.150.178:forgeflow-frontend-language.tar.gz
ssh -t dreinerts@185.56.150.178 'sudo tar --no-same-owner --no-same-permissions -xzf ~/forgeflow-frontend-language.tar.gz -C /var/www/forgeflow'
```

Danach Strg+F5 drücken. Ein Neustart von Backend oder Nginx ist für die statischen
Frontend-Dateien nicht erforderlich. Mit Sprache English Wiki und alle Dev Tools prüfen.
Artikelinhalte, JSON, Rechenverlauf und REST-Antworten bleiben beim Sprachwechsel erhalten.

Das Archiv lässt sich nach einem erfolgreichen `npm.cmd run build` neu erstellen:

```powershell
tar.exe -czf node_modules/.tmp/forgeflow-frontend-language.tar.gz -C frontend/dist .
```

## Frontend-Update: Speicherbenachrichtigungen

Dieses Frontend ersetzt das dauerhafte Synchronisationsfeld durch Erfolg-/Fehlerhinweise
und enthält auch die vorherigen Wiki-/Dev-Tools-Übersetzungen. Backend und Datenbank
benötigen keine Änderung. Im Projektordner auf dem Windows-PC ausführen:

```powershell
scp node_modules/.tmp/forgeflow-frontend-notifications.tar.gz dreinerts@185.56.150.178:forgeflow-frontend-notifications.tar.gz
ssh -t dreinerts@185.56.150.178 'sudo tar --no-same-owner --no-same-permissions -xzf ~/forgeflow-frontend-notifications.tar.gz -C /var/www/forgeflow'
```

Danach Strg+F5 drücken. Kein Neustart von Backend oder Nginx erforderlich.
Ein Projekt oder einen Wiki-Artikel ändern und den grünen Speicherhinweis prüfen;
Fehler und Versionskonflikte entsprechend `docs/browser-check.md` testen.
Das Archiv kann nach einem erfolgreichen Build neu erstellt werden:

```powershell
npm.cmd run build
tar.exe -czf node_modules/.tmp/forgeflow-frontend-notifications.tar.gz -C frontend/dist .
```

## KI-Backend auf dem Server testen

Die Backend-Grundlage kann vor dem Chat-Widget über die echte HTTPS-API getestet werden.
Auf Windows die vorbereitete JAR und das Backend-Update-Skript übertragen:

```powershell
scp scripts/update-linux-ai.sh node_modules/.tmp/forgeflow-ai-backend.jar dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'sudo bash ~/update-linux-ai.sh'
```

Das Skript setzt den bestehenden laufenden PostgreSQL-Dienst voraus, sperrt parallele
Deployments und sichert JAR, Backend-Umgebung und einen PostgreSQL-Dump unter
`/opt/forgeflow/ai-update.*`. Es aktualisiert nur die JAR und prüft die Backend-Health-API.
Bei einem Fehler stellt es die bisherige JAR wieder her und prüft deren Start ebenfalls.
Umgebung, Frontend und Nginx werden nicht geändert. Datenbankmigrationen würden wie bei
den anderen Updates nicht automatisch zurückgenommen; M2 ergänzt keine Migration.
Das Skript wurde auf Bash-Syntax und Ablehnung falscher Argumente geprüft; der echte
Ubuntu-Update-/Rollback-Lauf steht vor der Ausführung durch den Anwender noch aus.

Für den echten Modelltest die Serverkonfiguration öffnen:

```powershell
ssh -t dreinerts@185.56.150.178 'sudo nano /etc/forgeflow/backend.env'
```

Die folgenden Einträge genau einmal ergänzen oder vorhandene Werte bearbeiten. Die
Platzhalter durch den eigenen Schlüssel und die verfügbare Modellkennung ersetzen;
bestehende Datenbank-, Origin- und Cookie-Einstellungen beibehalten:

```dotenv
AI_ENABLED=true
OPENAI_API_KEY=DEIN_API_SCHLUESSEL
AI_MODEL=DEINE_MODELLKENNUNG
AI_TIMEOUT=20s
```

Danach neu starten und auf die Health-Antwort warten:

```powershell
ssh -t dreinerts@185.56.150.178 'sudo systemctl restart forgeflow && curl --fail --retry 15 --retry-connrefused --retry-delay 2 --max-time 5 http://127.0.0.1:3001/api/v1/health'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-ai-api.ps1
```

Der PowerShell-Test läuft auf Windows gegen `https://185.56.150.178`. Er fragt die
E-Mail und das Passwort des Anwendungskontos ab, erneuert CSRF nach der Anmeldung,
erstellt ein Gespräch und sendet eine Nachricht. Antwort und Tokenzahlen werden
angezeigt, die Testsitzung wird anschließend abgemeldet. Diese Modellanfrage kann
echte API-Kosten verursachen. Der API-Schlüssel wird nicht vom Testskript angefordert.
Backend-Neustarts beenden auch vorhandene Browsersitzungen: danach erneut anmelden.
Der JSON-Test bleibt auch mit M3 verfügbar. Für den Chat-Button und Streaming das
gemeinsame Update im nächsten Abschnitt verwenden.

Bei Startfehlern:

```powershell
ssh -t dreinerts@185.56.150.178 'sudo journalctl -u forgeflow -n 60 --no-pager'
```

Für eine Wiederherstellung der Konfiguration den vom Update-Skript ausgegebenen
Backup-Pfad verwenden. Der Test selbst lässt sich ohne Netzwerk prüfen:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/test-ai-api-script.ps1
```

Sechs Offline-Prüfgruppen bestanden: Anmeldung/erneuerter CSRF/UTF-8/Logout,
Logout nach Provider-Fehler, HTTP-Fehlerdiagnose für deaktivierte KI, Provider-Fehler
und ungültige Anmeldung sowie Ablehnung unsicherer/ungültiger Zieladressen vor den
Passwortabfragen. Das Skript nennt den fehlgeschlagenen Schritt, HTTP-Status und
strukturierten API-Fehlercode. Windows PowerShell 5.1 liest bei fehlenden `ErrorDetails`
den Body derselben HTTP-Antwort; es wird keine weitere Modellanfrage zur Diagnose gesendet.
Weitere Konfiguration und Grenzen: `docs/ai-assistant.md`.

## Chat-Widget und Streaming (Meilenstein 3)

Der lokale Build enthält jetzt das Widget und die Stream-/Abbruch-Endpunkte. Die
bereits aktivierte OpenAI-Konfiguration wird beibehalten. Kein neuer Schlüssel und
keine Änderung an Datenbank, Origin, Zertifikat oder Nginx sind erforderlich.

Vorbereitet sind die beiden Dateien und ihre SHA-256-Prüfsummen unter
`node_modules/.tmp/forgeflow-chat-*`. Aus dem Projektverzeichnis in PowerShell:

```powershell
scp scripts/update-linux-chat.sh `
    node_modules/.tmp/forgeflow-chat-backend.jar `
    node_modules/.tmp/forgeflow-chat-frontend.tar.gz `
    node_modules/.tmp/forgeflow-chat.sha256 `
    dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'sudo bash ~/update-linux-chat.sh 185.56.150.178'
```

Das Skript prüft die Prüfsummen und den vorhandenen PostgreSQL-Betrieb, sichert JAR,
Frontend, Backend-Konfiguration und Datenbank unter `/opt/forgeflow/chat-update.*`.
Es installiert beide Anwendungsteile, wartet auf die interne Health-Antwort und prüft
öffentliche Startseite, Health und den geschützten AI-Pfad. Fehlgeschlagene Updates
stellen die vorherigen Anwendungsdateien wieder her; additive Migrationen bleiben
erhalten. Der Nginx- und Backend-Konfigurationsinhalt wird nicht verändert. Die
Schreibrechte des Backups bleiben auf root beschränkt. Laufende Browsersitzungen
enden durch den Backend-Neustart. Das Skript selbst erzeugt keine Modellanfrage.

Danach `https://185.56.150.178` mit Strg+F5 laden, erneut anmelden und den Assistenten
rechts unten öffnen. Erst eine gesendete Nachricht kann API-Kosten auslösen.
Die vorhandene Nginx-Konfiguration berücksichtigt `X-Accel-Buffering: no`; der Stream
sendet sekündliche Herzschläge. Falls ein zusätzlicher Proxy vorgeschaltet wird,
muss auch dieser SSE ungepuffert weitergeben.

Offline-Prüfung des neuen Update-Skripts:

```bash
bash -n scripts/update-linux-chat.sh
bash scripts/test-linux-chat.sh
```

Unter Git Bash bestanden vier Gruppen: gültiges Archiv, defektes Archiv,
Parent-Verzeichnispfade und einmaliger Rollback beider Anwendungsteile nach einem
Unterprozessfehler. Die Prüfung echter Archiv-Symlinks benötigt Linux und wurde
unter Windows übersprungen. Diese Tests ersetzen kein Deployment auf dem Server.

## Lesende Projektwerkzeuge (Meilenstein 4)

Die neu vorbereiteten `forgeflow-chat-*`-Dateien enthalten zusätzlich die drei lesenden
Projektwerkzeuge und deren Ergebniskarten. Für dieses Update dieselben `scp`-/`ssh`-
Befehle aus dem Abschnitt „Chat-Widget und Streaming“ verwenden. Alle drei Dateien
einschließlich SHA-256-Liste erneut übertragen; kein alter Backend-Build mit einem
neuen Frontend mischen. Das bestehende Update-Skript kann auch direkt von M2 auf M4
aktualisieren. Konfiguration, Datenbank und Nginx benötigen dafür keine Änderung.

Nach dem Update Strg+F5 laden und erneut anmelden. Im Chat „Welche Projekte habe ich?“
fragen, danach einen vorhandenen Namen oder `#ID` für Projektstatus/offene Aufgaben
verwenden. Werkzeugkarten aufklappen und mit den gespeicherten Projektlisten vergleichen.
Projektabfragen können zwei kostenpflichtige Modellanfragen auslösen. Für `gpt-6-luna`
setzt die neue JAR den erforderlichen Chat-Completions-Modus `reasoning_effort=none`;
der Modellname bleibt erhalten. Andere Modelle müssen Chat Completions und Function
Calling unterstützen. Daten aus ungespeicherten Browserformularen sind noch nicht verfügbar.

Die lokale Prüfung verwendet Mock-Modelle und einen echten SDK-Transport gegen einen
lokalen HTTP-Server. Der M4-OpenAI-Live-Test und die visuelle Serverprüfung stehen aus.

Korrektur vom 23. Oktober: Die Upload-Dateien enthalten zusätzlich den Fix für
überschriebene Modelloptionen im Werkzeugpfad. Der vorherige Build verwendete dort
das Spring-AI-Standardmodell `gpt-5-mini` anstelle des konfigurierten Modells.
Beide Anfragephasen übernehmen jetzt die vorhandenen Optionen. Bei der allgemeinen
Chatmeldung „Der KI-Dienst ist derzeit nicht verfügbar“ nach dem ersten M4-Update
die aktuellen Dateien erneut übertragen und das Update-Skript ausführen. Die konkrete
erste Ablehnung war noch nicht genau eingegrenzt; der lokale Regressionstest belegt
den Modellwechsel vor und dessen Korrektur nach dem Fix.

Die anschließende Serverdiagnose zeigte mit dem Diagnose-Build `42cb3a5b5e6e…`:
`phase=final_answer`, HTTP 400, `parameter=tool_choice`. Die zweite Anfrage entfernte
die Werkzeugdefinitionen trotz `tool_choice=none`. Das neu vorbereitete Paket behebt
diesen zweiten Fehler: Beide Phasen behalten die Definitionen, die finale Antwort
sperrt weitere Aufrufe mit `none`. Der tatsächliche SDK-Request ist lokal geprüft;
die Live-Bestätigung des neuen Builds steht aus. Erneut alle drei Paketdateien hochladen
und dasselbe Update-Skript verwenden. Modell-/Schlüsselkonfiguration bleibt erhalten.

## Seitenkontext (Meilenstein 5)

Die aktuellen `node_modules/.tmp/forgeflow-chat-*`-Dateien ergänzen den Seitenbezug:
aktuelle Route und das geöffnete Projekt samt Tab. Dieselben Upload-/Update-Befehle
aus „Chat-Widget und Streaming“ verwenden; JAR, Frontend-Tar und Prüfsummenliste erneut
gemeinsam übertragen. Keine neue Datenbankmigration oder Serverkonfiguration erforderlich.

Nach Strg+F5 und erneuter Anmeldung ein gespeichertes Projekt öffnen. Der Chat zeigt
„Seitenbezug“ mit Projektkennung/Tab. „Welche Aufgaben sind hier offen?“ testen, danach
zu einem anderen Projekt und anschließend zu Wiki oder Dev Tools wechseln. Alte Nachrichten
behalten ihren damaligen Bezug. Ohne geöffnetes Projekt soll der Assistent bei relativen
Projektfragen nachfragen. Auf einer Wiki-/Dev-Tools-Seite „Was kann ich hier machen?“
fragen; private Editorinhalte werden nicht automatisch übermittelt. Weitere manuelle
Prüfungen: `docs/browser-check.md`. Diese Modellanfragen können echte Kosten verursachen.

Lokal wurden Kontextvalidierung, Inhabertrennung, Idempotenz, Routerwechsel, Snapshot und
SDK-Requestformat geprüft. Der Anwender hat M5 nach seinem Deployment als funktionierend bestätigt.

## Bestätigte Navigation (M6)

Das aktuelle Chat-Paket ergänzt Vorschläge für Projektübersicht, Aufgabenliste und Kanban.
Dieselben Upload-/Update-Befehle verwenden und das vollständige Paket gemeinsam ersetzen.
Keine neuen Servervariablen, PostgreSQL-Migrationen oder Nginx-Änderungen erforderlich.
Der Backend-Neustart beendet bestehende Browser-Sitzungen und flüchtige Chats.

Nach Strg+F5 und Anmeldung „Öffne Projekt #ID“ mit einer eigenen tatsächlichen Projektkennung
fragen. Die Karte muss das Projekt und „Projektübersicht“ zeigen. Erst „Bestätigen und öffnen“
darf navigieren; „Ablehnen“ darf nicht navigieren. Anschließend „Zeige die Aufgabenliste von
Projekt #ID“ und „Öffne Kanban von Projekt #ID“ testen. Bei Erfolg zeigt die Karte ein grünes
Häkchen. Offene Formulare müssen die Freigabe blockieren. Weitere Fälle unter
`docs/browser-check.md`. Nur die Chatfragen erzeugen Provider-Anfragen und mögliche Kosten.
Lokale Tests verwenden ausschließlich Mocks/Loopback. Der Anwender hat M6 nach eigenem
Deployment als funktionierend bestätigt; zusätzliche manuelle Detailfälle bleiben offen.

## Mehrstufige Ausführung (M7)

Das aktuelle Chat-Paket unterstützt standardmäßig bis zu vier aufeinanderfolgende
Werkzeugschritte und höchstens fünf Provider-Anfragen je Nachricht. Dasselbe vollständige
Uploadpaket und Update-Skript verwenden. Keine Migration, neue Pflichtvariable oder
Nginx-Änderung nötig. Optional setzt `AI_MAX_TOOL_STEPS` in der vorhandenen Backend-Umgebung
eine Grenze zwischen 1 und 6; die Vorgabe 4 funktioniert ohne Eintrag. Bestehende KI- und
Zugangseinstellungen werden vom Update nicht geändert. Das Gesamtzeitlimit bleibt `AI_TIMEOUT`.

Nach Strg+F5 und Anmeldung mit mindestens zwei gespeicherten eigenen Projekten testen:
„Zeige Titel und Prioritäten der offenen Aufgaben meiner ersten beiden Projekte.“ Der Assistent kann zunächst
die Projekte lesen und anschließend deren Aufgaben abfragen. Im Chat sollten mehrere
nummerierte Quellen und der aktuelle Werkzeugschritt sichtbar sein. Navigation bleibt
bestätigungspflichtig. „Stoppen“ beendet den ganzen Lauf. Bei Fehler/Abbruch werden keine
unbestätigten Ergebnisse fortgesetzt. Ein Lauf kann mehr Token verbrauchen als vor M7;
Details und Grenzen unter `docs/ai-assistant.md`. Der Anwender hat M7 nach seinem Deployment
als funktionierend bestätigt; zusätzliche manuelle Detailfälle bleiben offen.

## Gesprächspersistenz (M8)

Das aktuelle vollständige Chat-Paket ergänzt gespeicherte Unterhaltungen und Ausführungsläufe.
Dieselben Upload-/Update-Befehle verwenden. Flyway V5 legt die neuen Tabellen automatisch in
der vorhandenen PostgreSQL-Datenbank an. Das Update-Skript erstellt vorher die Datenbanksicherung.
Keine neuen Pflichtvariablen oder Nginx-Änderungen. Optional ist `AI_CONVERSATION_RETENTION=30d`
in `/etc/forgeflow/backend.env` einstellbar (1d–365d, Inaktivitätsfrist). Die physische
Bereinigung abgelaufener Chats erfolgt beim nächsten Anlegen; Sicherungen bleiben separat.
Der Neustart beendet Browser-Sitzungen. Vorher flüchtige Chats werden nicht übernommen.

Nach Strg+F5 und Anmeldung eine neue Unterhaltung senden, die Seite neu laden und den Chat
über „Unterhaltungen“ wieder öffnen. Anschließend den Backend-Dienst neu starten, erneut
anmelden und dieselbe Unterhaltung samt Ausführungshistorie öffnen. Mit einem zweiten
Anwendungskonto darf sie nicht sichtbar oder über ihre Kennung abrufbar sein.
Endgültiges Löschen muss bestätigt werden und auch die Ausführungshistorie entfernen.
Die Verwaltung selbst erzeugt keine OpenAI-Anfrage; das Senden einer neuen Nachricht kann
Kosten verursachen. Unterbrochene Läufe und alte Freigaben werden niemals automatisch
fortgesetzt. Diese PostgreSQL-/Browserprüfung des M8-Pakets steht noch aus.

## Qualität und Deployment (M9)

M9 ergänzt lokale PostgreSQL-HTTP-/Socket-Tests und eine reproduzierbare Zeitmessung.
Auf dem Server sind keine neuen Pakete, Pflichtvariablen oder Migrationen erforderlich.
Das Update-Skript veröffentlicht die fertige Startseite jetzt atomar nach den Assets und
prüft den Anmeldeschutz von Gesprächsliste, Verlauf und Ausführungshistorie.
Die bisherige Sicherung und Wiederherstellung des Anwendungspaars bleiben erhalten.

Aus dem lokalen PowerShell-Projektverzeichnis das vollständige Paket gemeinsam übertragen:

```powershell
scp scripts/update-linux-chat.sh scripts/test-linux-chat.sh `
  node_modules/.tmp/forgeflow-chat-backend.jar `
  node_modules/.tmp/forgeflow-chat-frontend.tar.gz `
  node_modules/.tmp/forgeflow-chat.sha256 `
  dreinerts@185.56.150.178:

ssh -t dreinerts@185.56.150.178 'bash ~/test-linux-chat.sh && sudo bash ~/update-linux-chat.sh 185.56.150.178'
```

Der erste Befehl auf dem Server prüft nur temporäre Dateien, keine Dienste und keine
Modellanfrage. Auf Linux wird zusätzlich die Archiv-Symlink-Prüfung ausgeführt, die unter
Git Bash auf Windows übersprungen wird. Erst danach führt das Update-Skript das gesicherte
Anwendungsupdate aus. Es bestätigt Health, den erwarteten Frontend-Einstieg und drei
öffentliche HTTP-401-Antworten. Bei Fehlern meldet es den Sicherungsordner und den
Wiederherstellungsstatus. Ein Datenbank-Restore wird dabei nicht automatisch ausgeführt.

Danach Strg+F5, erneut anmelden und einen vorhandenen Chat unter „Unterhaltungen“ öffnen.
Ausführungshistorie und Aktionsstatus müssen erhalten bleiben; bloßes Öffnen darf keine
neue Nachricht oder Navigation auslösen. Eine zusätzliche Chatfrage ist ein separater
Live-Test und kann Kosten verursachen. Visuelle und vollständige Server-Abnahme bleiben
manuelle Schritte; Details und lokale Messergebnisse unter [ai-quality.md](ai-quality.md).

## Erweiterte KI-Abfragen und Anlage

Dokumentationsupdate: Frontend und Backend gemeinsam über das bestehende Chat-Updatepaket
installieren. V8 ergänzt parent_id und den kontogebundenen Eltern-Fremdschlüssel automatisch;
bestehende Wiki-Seiten bleiben Wurzelseiten. Das Skript sichert zuvor Anwendung und Datenbank.
Danach Dokumentation öffnen und Bereich/Unterseite/Neuladen prüfen. Neue KI-Hierarchievorschläge
verwenden Format 5; ein alter Backend-Downgrade kann Hierarchie verlieren. Keine zusätzliche
Installation oder Pflichtvariable. [Bedienung, Vertrag und Grenzen](documentation.md).

Das aktuelle Paar ergänzt [Kundendetails, Ansprechpartner und Notizen](customer-details.md).
V7 läuft automatisch; keine neue Installation/Pflichtvariable. Nach Neustart/Strg+F5 einen
Kunden öffnen, Ansprechpartner/Notiz anlegen und erneut laden. Neue Chatfunktionen verwenden
Format 4; Downgrade auf alte JARs vorab mit Backup/Datenerhalt prüfen.

Das aktuelle vollständige Paket enthält außerdem das [Kundenformular mit PLZ und globalen
Branchen](customers.md). V6 ergänzt die PLZ-Spalte und `ff_global_settings` automatisch beim
Backendstart. Das Update-Skript erstellt vorher einen Datenbankdump. Danach als Administrator
unter Einstellungen → Globale Einstellungen die Branchenliste prüfen; gewöhnliche Nutzer
dürfen sie auswählen, aber nicht ändern. Keine neuen Pakete/Umgebungsvariablen nötig.

Das aktuelle Paket enthält zusätzlich [bestätigte Fachdatenänderungen](ai-updates.md).
Für die Prüfung beispielsweise „Setze Aufgabe #12 auf erledigt“ anfragen. Vor dem Klick
müssen alter/neuer Status sichtbar sein und die Aufgabe unverändert bleiben. Ablehnen
darf nicht speichern; Bestätigen ändert genau einmal. Neue Anlage weiterhin separat testen.
Änderungsgespräche verwenden Format 3; das aktuelle Backend liest 1–3, ältere JARs kein
Format 3. Vor manuellem Downgrade nach Nutzung Backup/Datenerhalt prüfen.

Das aktuelle vollständige Chat-Paket ergänzt die in [ai-workspace.md](ai-workspace.md)
aufgeführten Fachabfragen und bestätigten Anlagen. Dieselben oben dokumentierten
Upload-/Update-Befehle für update-linux-chat.sh, test-linux-chat.sh und die drei
zusammengehörigen forgeflow-chat-Dateien verwenden. Keine neue Pflichtvariable,
SQL-Migration oder Nginx-Änderung. Bestehende KI-Konfiguration bleibt erhalten.

Nach Strg+F5 und Anmeldung zunächst „Wie viele Kunden habe ich?“ fragen. Die Antwort muss
eine Quelle mit exakter Anzahl zeigen, auch für Kunden ohne Projekte. Danach einen
eindeutig benannten Testkunden anfordern: Die Vorschlagskarte muss alle Angaben zeigen,
vor der Bestätigung darf kein Kunde in der Anwendung entstehen. „Ablehnen“ verwirft den
Vorschlag. „Bestätigen und anlegen“ speichert einmalig und aktualisiert die Ansicht.
Einen zwischenzeitlich geänderten Workspace darf die alte Karte nicht überschreiben.

Als Administrator kann anschließend ein normales Testkonto vorgeschlagen werden.
Das Initialpasswort nur in das private Kartenfeld eingeben, niemals in die Chatnachricht.
Normale Benutzer müssen für Benutzerliste und Kontoanlage einen Berechtigungsfehler
erhalten. Textdateien und Wiki lassen sich mit eigenem kleinen Testinhalt prüfen.
Diese Chatfragen verursachen Modellanfragen und mögliche API-Kosten. Das Update-Skript
selbst erzeugt weiterhin keine Provider-Anfrage und führt keine Anlage aus.

Alte gespeicherte Gespräche bleiben im aktuellen Backend lesbar. Neue Workspace-/Anlage-
Gespräche verwenden Aggregatformat 2; ältere JARs können diese neuen Chats nicht lesen.
Bei einem späteren manuellen Downgrade nach Benutzung der neuen Funktionen zuerst
Sicherung und Datenerhalt prüfen; keine automatische Datenbank-Rücksicherung oder
Chatlöschung. Details und weitere manuelle Fälle stehen unter [browser-check.md](browser-check.md).

## Öffentliche Prüfung

### KI-Fehler aus vorhandenen Serverlogs eingrenzen

Bei einer allgemeinen KI-Fehlermeldung aus PowerShell im Projektverzeichnis:

```powershell
scp scripts/diagnose-linux-ai.py scripts/test-linux-ai-diagnostics.py dreinerts@185.56.150.178:
ssh -t dreinerts@185.56.150.178 'python3 ~/test-linux-ai-diagnostics.py && sudo python3 ~/diagnose-linux-ai.py'
```

Der erste Python-Aufruf prüft fünf Fälle der Ausgabebereinigung. Der zweite liest
JAR-Prüfsumme, `AI_MODEL` aus der Backend-Umgebungsdatei und bis zu 1200 vorhandene
Journaleinträge des aktuellen Boots. Er gibt höchstens 20 bereinigte Fehlerzeilen mit
bekannten Kategorien aus. Keine Rohmeldungen, Schlüssel oder Chat-Inhalte ausgeben;
keine Konfiguration ändern, keinen Dienst neu starten und keine OpenAI-Anfrage senden.
Diese Diagnose funktioniert auch vor Installation der neuen Fehlerklassifikation.
Python ist auf dem Windows-Arbeitsplatz nicht verfügbar; die Python-Prüfungen wurden
dort nicht ausgeführt. Der Anwender hat die fünf Tests auf Ubuntu erfolgreich ausgeführt.
Die erste Diagnose zeigte `gpt-6-luna`, eine frühere JAR-Prüfsumme (`be80d3be0d29…`)
und vorhandene Provider-HTTP-400-Fehler. Der folgende Diagnose-Build hatte die
Backend-Prüfsumme `42cb3a5b5e6e…`. Das neueste Paket enthält zusätzlich den oben
beschriebenen `tool_choice`-Fix; seine aktuelle Prüfsumme steht in
`node_modules/.tmp/forgeflow-chat.sha256`. Vor dem nächsten Update die Paketdateien
einschließlich Prüfsummenliste erneut hochladen.

Auf dem Windows-PC lässt sich der öffentliche API-Zugriff prüfen:

```powershell
curl.exe --fail https://185.56.150.178/api/v1/health
```

Erwartet: `{"status":"ok","storage":"postgresql"}`.

Der Agent hat lokal Bash-Syntax, Ablehnung ungültiger IP-Argumente und LF-Zeilenenden
geprüft; Frontend-Lint und API-Produktionsbuild waren erfolgreich. Die Regressionstests
sind mit `bash scripts/test-linux-public.sh` ausführbar: TLS-Konflikte einschließlich
kommentierter Listener, simulierte HTTP-Erfolge/404/falsche Inhalte sowie einmalige
Wiederherstellung nach einem Unterprozessfehler mit erhaltenem Exitcode und Probe-Cleanup.
Sie benötigen weder Root-Rechte noch Nginx. Zwölf Prüfungen bestanden unter Git Bash;
die POSIX-Verzeichnisrechte werden dort übersprungen und müssen unter Linux geprüft werden.
Der erste Lauf beim Anwender brach vor der Umstellung an der früheren Konfliktprüfung ab,
die auch Kommentare erfasste. Der nächste Lauf erreichte Certbot; die Zertifizierungsstelle
meldete HTTP 404 für die Challenge-Datei. Die Konfiguration wurde wiederhergestellt, wobei
die ERR-Behandlung in Haupt-/Unterprozess die Wiederherstellung doppelt ausführte.
Die Ursache des ursprünglichen 404 ist nicht abschließend bestätigt. Nach Ergänzung der
Selbstprüfung und einmaligen Wiederherstellung war der nächste Serverlauf erfolgreich:
IP-Zertifikat ausgestellt (Ablauf laut Ausgabe 29. Oktober 2026), simulierter
Erneuerungslauf einschließlich Nginx-Hook erfolgreich und Abschlussmeldung `Ready`.
Zwei vorübergehende HTTP-502-Antworten wurden dabei durch Wiederholungen überwunden.
Der Agent bestätigte anschließend von außen mit Zertifikatsprüfung HTTP 200 für die
Startseite und `status=ok`, `storage=postgresql` für die Health-API. Anmeldung und
Fachfunktionen im Browser sind noch vom Anwender zu bestätigen.
