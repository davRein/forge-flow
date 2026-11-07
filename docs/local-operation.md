# Lokaler Betrieb, Sicherung und Kontoverwaltung

Java-Backend, PostgreSQL 18 und Vite laufen lokal auf dem Windows-PC.
Der Frontend-Start erfolgt aus `frontend/`; Vite liest dort `frontend/.env.local`.
Die folgenden gemeinsamen npm-Befehle werden im Hauptordner ausgeführt.
Die Skripte verwenden Windows PowerShell; auf Linux bleibt die direkte Konfiguration über
Prozessvariablen aus der Backend-README verfügbar.

## Einmalige lokale Einrichtung

Im Projektverzeichnis:

```powershell
npm.cmd run setup:local
```

Ohne npm im PATH alternativ:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure-local.ps1
```

Das Skript verwendet ein bereits gesetztes DB_PASSWORD oder fragt das Datenbankpasswort
verdeckt ab. Es prüft die Anmeldung an der vorhandenen Datenbank, bevor es Einstellungen speichert.
PostgreSQL, die Datenbank und das erste Anwendungskonto müssen bereits eingerichtet sein.

Unter backend/.local/ entstehen eine nicht geheime config.json und eine mit Windows-DPAPI
verschlüsselte Passwortdatei. Nur derselbe Windows-Benutzer auf demselben PC kann sie entschlüsseln.
Keine Passwörter in `frontend/.env.local` eintragen. `backend/.local/` ist in Git ausgeschlossen.
Nach einem Datenbankpasswortwechsel die Einrichtung erneut ausführen.

Vorgaben: 127.0.0.1:5432, Datenbank forgeflow, Datenbankkonto forgeflow.
Andere lokale Ports und Namen können über die Parameter -DatabasePort, -DatabaseName,
-DatabaseUser und -PostgresBin eingerichtet werden. Entfernte Server werden bewusst abgewiesen.
Wenn das bestehende Anwendungskonto eine andere Kennung als initial-admin besitzt,
bei der Einrichtung -BootstrapUserId mit seiner stabilen Kennung angeben. Eine vorhandene
AUTH_USER_ID aus dem Terminal wird sonst übernommen.

Die erste Einrichtung der neuen Kontoverwaltung vergibt diesem bestehenden Konto einmalig
Administratorrechte. Eine Datenbankmarkierung verhindert spätere automatische Rechtevergabe.
Normalstarts lesen anschließend die vorhandenen Konten aus der Datenbank und überschreiben
keine Profile oder Passwort-Hashes mit alten Startvariablen.

## Anwendung starten und stoppen

Zuvor manuell gestartetes Backend und Vite mit Strg+C beenden; die Ports müssen frei sein.

```powershell
npm.cmd run start:local
```

Alternativ:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1
```

Das Skript startet Backend und Frontend in verborgenen Hilfsprozessen, prüft ihre Erreichbarkeit
und meldet anschließend http://localhost:5173 als bereit. Ausgabe liegt in backend/.local/logs/.
Es startet außerdem automatisch die beiden Frontends und Python-Backends von Knowledge Hub
und FlowPilot im lokalen Fake-/Mock-Modus. Die Nachbarprojekte müssen eingerichtet sein.
Mit Strg+C werden nur die von diesem Aufruf gestarteten Prozessbäume beendet.
Für die Anmeldung exakt `http://localhost:5173` verwenden. `Invalid request origin` bedeutet,
dass die Browseradresse nicht zum konfigurierten `APP_ORIGIN` passt; das ist kein Passwortfehler.
Vite leitet lokale Dokumentaufrufe über `127.0.0.1:5173` auf `localhost:5173` weiter.
Bereits belegte Ports werden gemeldet; fremde Prozesse werden nicht beendet.
Die Prüfung berücksichtigt IPv4 und IPv6. Falls `localhost:5173` HTTP 404 liefert,
obwohl `127.0.0.1:5173` funktioniert, kann noch ein alter Vite-Prozess auf IPv6 laufen.
Diesen im ursprünglichen Terminal mit Strg+C beenden und anschließend gemeinsam neu starten.

Java und Maven werden zuerst aus der Umgebung, ersatzweise aus den bereits vorhandenen
portablen Werkzeugen unter node_modules/.tmp/backend-tools verwendet.
Das Frontend erhält keine Datenbankpasswörter aus der Startumgebung.
Die ursprüngliche Umgebung des aufrufenden Terminals wird nach Ende der Einzelstartskripte
wiederhergestellt.

Für getrennte Terminals:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-frontend.ps1
```

Diese beiden Befehle nacheinander in zwei verschiedenen Terminals ausführen.
Das erste läuft bis zum Stoppen im Vordergrund. Das Backend nutzt das Profil postgres;
Vite nutzt den API-Modus und einen festen Port 5173.

## Suite-Demo mit allen Zusatz-Apps

`npm.cmd run start:demo` startet eine flüchtige Suite-Sitzung plus Knowledge Hub
(3000/8000, Fake-Provider), FlowPilot (5174/8001, Mock), PulseWatch (5177/8082,
H2-Demo/Fixtures) und DataScout (5176/8002, Offline-Fixtures). Docker Desktop und
die eingerichteten Nachbarprojekte werden benötigt. Kein Suite-Login erforderlich.
Die lokalen Startskripte setzen explizite lokale App-URLs im Prozess, auch wenn
`frontend/.env.local` noch Produktions-URLs enthält. Die Datei wird nicht geändert.

Bei bereits laufendem Offline-DataScout: `npm.cmd run start:demo -- -UseExistingDataScout`.
Seine Container bleiben nach dem Stoppen erhalten. Ohne diesen Schalter prüft der
Launcher alle Ports und verwaltet nur seine selbst gestarteten Dienste. Lokale
Bereitschaftsprüfungen umgehen Systemproxies und erlauben nur HTTP-Loopback-Ziele.
Falls PulseWatch beim Maven-Start an Spotless scheitert, zuerst im PulseWatch-Backend
`mvn.cmd spotless:apply` ausführen und danach die Tests prüfen.

## Vergessenes lokales Anwendungspasswort zuruecksetzen

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/reset-local-password.ps1
```

Der Helfer verwendet ausschliesslich die lokale PostgreSQL-Konfiguration und das bereits
mit Windows-DPAPI geschuetzte Datenbankpasswort. Er zeigt aktive normale Konten an und fragt
die E-Mail sowie zweimal verdeckt ein neues Passwort ab (mindestens 12 Zeichen, maximal
72 UTF-8-Bytes). Das Passwort wird mit BCrypt gehasht; Passwort und Hash werden nicht ausgegeben.
Nur Passwort-Hash und Sitzungsversion des gewaehlten Kontos werden atomar aktualisiert.
Vorhandene Sitzungen werden dadurch ungueltig; keine Reaktivierung oder Rollenveraenderung.
Abbruch oder fehlerhafte Eingaben vor der Aktualisierung lassen das Konto unveraendert.
Die Erfolgsanzeige bestaetigt den abgeschlossenen Reset. Danach normal im Browser anmelden.
Mit `-CheckConnection` kann zuerst ausschliesslich die JDBC-Verbindung und die Anzahl aktiver
normaler Konten geprueft werden, ohne Passworteingabe oder Aenderung. Der Helfer erzeugt bei
Bedarf eine eigene Runtime-Abhaengigkeitsliste unter `backend/target/password-reset-classpath.txt`;
eine alte `target/classpath.txt` ohne PostgreSQL-Treiber wird nicht verwendet.

## Integrierte Apps und Standalone-Betrieb

Knowledge Hub und FlowPilot sind reguläre Module der linken Navigation mit ihren vorhandenen
Schriftlogos. Die obere Suite-Navigation steuert Chat/Dokumente/Konto/Datenschutz bzw.
Übersicht/Workflows/Ausführungen/Integrationen/Jobs. Beide Apps laufen in eigenen Frames;
ihre Navigation wird erst nach einem validierten Handshake mit der Suite ausgeblendet.
Der Standalone-Aufruf behält die eigene Navigation. Frames bleiben bei Modulwechseln
gemountet; die Entwurfswarnung des FlowPilot-Designers gilt auch für Suite-Tabs.

Die Suite-Sprachwahl (Deutsch/Englisch) synchronisiert auch bereits geöffnete, gerade
ausgeblendete Zusatz-Apps über den geprüften Elternkanal. Das lädt die Frames nicht neu
und verändert keine Dokumente, Arbeitsabläufe oder Formulareingaben. Standalone haben
beide Apps eine eigene Sprachwahl im Kopfbereich, gespeichert pro Browser-Origin;
eine eingebettete Sitzung überschreibt diese Standalone-Voreinstellung nicht.

`start-frontend.ps1` startet und überwacht über `start-showcase.ps1` die sechs Zusatzdienste;
somit gilt der automatische Start sowohl für getrennte Terminals als auch `start-local.ps1`.
Strg+C beendet die zu diesem Start gehörenden Kindprozesse. Bereits belegte Ports werden
gemeldet; vorhandene Standalone-Prozesse werden nicht übernommen oder beendet.

| Anwendung | Frontend | Backend | Suite-Testbetrieb |
| --- | --- | --- | --- |
| ForgeFlow | localhost:5173 | 127.0.0.1:3001 | Bestehendes PostgreSQL-Profil und Login |
| Knowledge Hub | localhost:3000 | 127.0.0.1:8000 | local-demo, fake, eigener Demo-Workspace |
| FlowPilot | localhost:5174 | 127.0.0.1:8001 | demo, Mock-AI und Mock-HTTP, keine Redis-Queue |
| PulseWatch | localhost:5177 | 127.0.0.1:8082 | demo, flüchtiges H2, nur lokale Fixtures |

Voraussetzungen sind die Nachbarordner `../ai-knowledge-hub`,
`../flowpilot-codex-starter` und `../pulse-watch`, deren Abhängigkeiten sowie JDK 21/Maven
für PulseWatch. Python-Umgebungen der Python-Apps liegen unter `backend/.venv`.
Knowledge Hub benötigt weiterhin seine eingerichtete PostgreSQL-/pgvector-Datenbank und
Migrationen. PulseWatch verwendet nur flüchtiges H2 und den eingebauten Fixture-Modus; es
braucht keine lokale PostgreSQL-Einrichtung und versendet keine E-Mails. Konfigurationsdateien
der Nachbarprojekte werden beim Start nicht verändert.
Knowledge Hub verwendet den gesonderten Demo-Workspace
`6c7b62be-707f-4ca3-90fa-8126ea17d894`, FlowPilot separate Dateien unter
`backend/.local/showcase/flowpilot/`. Diese lokalen Demo-Daten sind nicht an ForgeFlow-Konten
gebunden und gehören nicht zum ForgeFlow-Datenbankbackup. Normale private Knowledge-Hub-
Konten und bisherige FlowPilot-Daten bleiben außerhalb dieses Demo-Bereichs.

Eigene Logs pro Zusatzdienst: `knowledge-backend`, `knowledge-frontend`, `flow-backend`,
`flow-frontend`, `pulse-backend` und `pulse-frontend` jeweils `.log` und `-error.log` unter
`backend/.local/logs/`.
Bereitschaft wird mit echten Health-, Frontend- und Datenbank-Leseanfragen geprüft.
Die internen Probes verwenden IPv4, damit Windows-IPv6-Fallbacks nicht zum Starttimeout führen.

Für einen gezielten Start ohne Zusatzdienste vor `start-frontend.ps1` setzen:
`$env:FORGEFLOW_SKIP_SHOWCASE = 'true'`. Zum Wiederherstellen
`Remove-Item Env:FORGEFLOW_SKIP_SHOWCASE`. Der direkte Vite-Aufruf `npm.cmd run dev` startet
weiterhin nur die Suite-Oberfläche; der gemeinsame Start erfolgt über die genannten Skripte.

Die App-Adressen sind über `VITE_KNOWLEDGE_HUB_URL`, `VITE_FLOWPILOT_URL` und
`VITE_PULSEWATCH_URL` in `frontend/.env.local` überschreibbar (lokale Vorgaben
3000/5174/5177). Produktionsbuilds benötigen explizite HTTPS-Adressen. Fehlende/ungültige
Ziele zeigen einen Konfigurationshinweis.
Die Einbettungsadapter akzeptieren ausschließlich das konfigurierte Elternfenster und
bekannte Routen; es werden weder Passwörter noch Sitzungs-Token über postMessage übertragen.
PulseWatch übernimmt alle sieben Suite-Farbpaletten sofort und behält standalone sein eigenes
Design. Sein Demo-Backend verwendet keine Suite-Anmeldedaten; dort erfolgt die Anmeldung über
die vorhandenen Demo-Konten.
Für eine eigene Suite-Bereitstellung müssen zusätzlich die Frontends der Nachbarprojekte
mit `NEXT_PUBLIC_SUITE_ORIGIN` (Knowledge Hub) bzw. `VITE_SUITE_ORIGIN` (FlowPilot) auf die
exakte Suite-Origin gebaut werden. PulseWatch akzeptiert lokal ausschließlich
`http://localhost:5173` und kann für eine HTTPS-Bereitstellung explizit mit
`VITE_SUITE_ORIGIN` auf die exakte Suite-Origin gebaut werden. Das PulseWatch-Docker-Frontend
setzt weiterhin `X-Frame-Options: DENY` und `frame-ancestors 'none'`; ein Produktiv-Einbetten
erfordert eine explizite, auf die Suite-Origin begrenzte CSP-Änderung. Knowledge Hubs Standard
bleibt ebenfalls X-Frame-Options DENY; der Suite-Modus erlaubt nur die konfigurierte Origin
über CSP frame-ancestors.
Der lokale Knowledge-Hub-Start verwendet einen Same-Origin-API-Proxy unter `/suite-api`.

Für Standalone beide Apps mit ihren bisherigen README-Befehlen und eigenen Umgebungen starten.
Die bestehenden Authentifizierungsverfahren bleiben erhalten; es wurde kein produktives SSO
eingeführt. Demo-Backends werden nur auf Loopback gestartet. Keine öffentliche Bereitstellung.

Reproduzierbare Browserprüfung nach dem gemeinsamen Start:
`node scripts/test-showcase-browser.mjs` (benötigt FlowPilots installierten Playwright/Edge).
Sie simuliert nur die ForgeFlow-Konto-/Workspace-APIs, verwendet echte lokale Zusatzdienste
und prüft eingebettete/Standalone-Navigation, Entwurfsschutz, Modulwechsel und Mobilansicht.

Zusätzliche Sprachregression: `node scripts/test-showcase-language.mjs`. Sie simuliert
die API-Antworten aller drei Apps mit synthetischen Daten und prüft Deutsch → Englisch,
Menüs, Diagnosen, unveränderte Eingaben, erhaltene Frames und unabhängige Standalone-Wahl.
Andere bereits konfigurierte Testserver lassen sich über `TEST_SUITE_URL`, `TEST_HUB_URL`
und `TEST_FLOW_URL` angeben. Die Server müssen untereinander dieselben URLs/Eltern-Origin
konfiguriert haben. Screenshots liegen unter `node_modules/.tmp/suite-language-de-*.png`.

## Sicherungen erstellen

Beim Backend-Start wird eine Sicherung angelegt, wenn keine intakte Sicherung der gewählten
Datenbank aus den letzten 24 Stunden vorhanden ist. Ein fehlgeschlagenes erforderliches Backup
stoppt den normalen Start. Es gibt keinen dauerhaft laufenden Zeitplan: Bleibt die Anwendung
mehrere Tage ununterbrochen geöffnet, zusätzlich manuell sichern.

```powershell
npm.cmd run backup:local
```

Die Sicherung umfasst Tabellen, Konten mit Passwort-Hashes, Einstellungen und Dateiinhalte
derselben Datenbank als konsistentes PostgreSQL-Custom-Archiv. Datenbankrollen des Servers
und das PostgreSQL-Administratorkennwort gehören nicht zum Archiv.

Dateien liegen unter backups/ als datierter Name mit zufälligem Zusatz und .dump-Endung.
Eine .sha256-Datei prüft die Integrität. Zunächst wird in eine .partial-Datei geschrieben;
nur ein erfolgreicher Dump mit lesbarem Inhaltsverzeichnis wird als vollständiges Archiv veröffentlicht.
Alte Sicherungen werden nicht automatisch gelöscht.

Der Ordner ist in Git ausgeschlossen. **Die Sicherungsarchive selbst sind nicht verschlüsselt.**
Sie enthalten die gespeicherten Anwendungsdaten und Passwort-Hashes und müssen entsprechend
aufbewahrt werden. Windows-DPAPI schützt ausschließlich das lokal gespeicherte
Verbindungspasswort. Für Schutz vor einem Defekt des PCs zusätzlich eine Kopie auf einem
anderen Datenträger aufbewahren; das Skript lädt keine Daten zu einem externen Dienst hoch.

## Wiederherstellung ausprobieren

Nach dem Erstellen einer Sicherung die jüngste Datei wählen:

```powershell
$taskBackup = Get-ChildItem -LiteralPath backups -Filter '*.dump' -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
if (-not $taskBackup) { throw 'Zuerst eine Sicherung erstellen.' }
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restore-local.ps1 -BackupFile $taskBackup.FullName -Verify
```

Das Skript fragt das PostgreSQL-Administratorkennwort verdeckt ab und speichert es nicht.
Es prüft SHA256 und erstellt eine neue Datenbank mit dem Präfix forgeflow_restore_.
Die vorhandene Anwendung und ihre Datenbank forgeflow werden nicht umgestellt oder überschrieben.
Existiert die Zieldatenbank bereits, wird abgebrochen.

pg_restore schreibt die Kopie in einer Transaktion und bricht beim ersten Fehler ab.
Danach werden Anwendungs-/Dateitabellen, gespeicherte Dateigrößen, validierte Constraints und
erfolgreiche Flyway-Migrationen geprüft. Die Ausgabe enthält lediglich Datensatzanzahlen.
Mit -Verify wird ausschließlich die in diesem Aufruf erstellte Kopie danach wieder entfernt.

Ohne -Verify bleibt die neue Datenbank als Wiederherstellungskopie erhalten.
Ein eigener Zielname muss ebenfalls mit forgeflow_restore_ beginnen.
Die Skripte unterstützen absichtlich kein Überschreiben einer bestehenden Datenbank.
Ein tatsächlicher Wechsel auf die wiederhergestellte Kopie ist ein eigener, bewusster Schritt.

## Konto bedienen

Unter Project Manager -> Einstellungen stehen nach einem Backend-Neustart bereit:

- Mein Profil: Name und E-Mail ändern. Eine neue E-Mail benötigt das aktuelle Passwort.
- Passwort ändern: aktuelles Passwort bestätigen, neues Passwort zweimal eingeben.
  Danach sind alle alten Sitzungen ungültig; erneut anmelden.
- Als Administrator: Benutzer auflisten, neue Konten anlegen und normale Konten
  deaktivieren oder wieder aktivieren. Neue Konten starten mit leeren Daten.
- Deaktivierung sperrt den Zugriff und widerruft Sitzungen, erhält aber sämtliche Kontodaten.
  Das Administratorkonto ist gegen Deaktivieren über diese Oberfläche geschützt.

Kontoänderungen sind gesperrt, solange Fach- oder Einstellungsänderungen unbestätigt sind.
Es gibt keine öffentliche Registrierung, keine automatische E-Mail-Zustellung, keine Oberfläche
zum Löschen von Konten, keine Rollenvergabe und keine Passwort-zurücksetzen-per-E-Mail-Funktion.
Ein weiteres Benutzerkonto erhält keine Administratorrechte.
Die vorhandene Kontotrennung bleibt auch gegenüber dem Administrator erhalten.

## Prüfungen

```powershell
npm.cmd run test:local-scripts
```

Prüft Skriptsyntax, IPv4-/IPv6-Portkonflikte, einen DPAPI-Roundtrip mit erzeugten Testdaten, Ablehnung entfernter
Datenbankziele, beschädigte Archive und den Schutz vorhandener Datenbanken.
Ein echter Dump-/Restore-Test wird damit nicht ersetzt; dafür die Schritte oben verwenden.

Die Backend-Suite prüft zusätzlich Profiländerungen, E-Mail-Konflikte, stabiles Eigentum
bei wiederverwendeten E-Mail-Adressen, Passwortänderung/Sitzungswiderruf, CSRF,
Administratorrechte, Deaktivierung/Reaktivierung und Rate-Limits.
Ein eigener Migrationstest prüft den Umstieg eines vorhandenen Kontos und vorhandener
Kundendaten ohne Änderung des gespeicherten Passwort-Hashes.

Mit eingerichteter lokaler Verbindung prüft `npm.cmd run test:postgres` die separate
Datenbank `forgeflow_test` (allgemein: konfigurierter Datenbankname plus `_test`).
Diese Datenbank muss bereits existieren und dem konfigurierten Datenbankkonto gehören.
Der Helfer setzt und entfernt Testvariablen nur für den eigenen Aufruf.
Direkte `TEST_POSTGRES_URL`-Werte müssen auf eine Datenbank mit Suffix `_test` zeigen.

Für den aktuellen Stand: [HANDOFF.md](HANDOFF.md).
Visuelle Prüfung: [browser-check.md](browser-check.md).

## DataScout in der lokalen Suite (7. November 2026)

DataScout ist als lokales Demo-Modul mit Dashboard, Erfassung und Jobs eingebunden.
Sein Frontend verwendet localhost:5176, die API 127.0.0.1:8002, PostgreSQL weiter
127.0.0.1:55432. Der gemeinsame Start in start-showcase.ps1 baut/startet dafür die
Container mit DataScouts compose.yaml plus compose.suite.yaml. Docker Desktop muss
laufen; ../data-scout/infra/.env muss laut dessen README bereits eingerichtet sein.
Vorhandene .env-Dateien und das PostgreSQL-Volume werden nicht ersetzt.

Ein zuvor eigenständig gestartetes DataScout belegt 5173/8000. Vor dem erstmaligen
Suite-Start dessen backend/worker/frontend stoppen; sonst greifen die normalen
Portprüfungen. Keine fremden Prozesse werden automatisch beendet. Der gemeinsame
Start meldet belegte Ports; beim regulären Stop beendet er seine DataScout-Appcontainer,
erhält PostgreSQL und alle Volumes. Eigentumsmarker ermöglichen auch den übergeordneten Startskripten die gezielte
Docker-Bereinigung nach dem Beenden ihrer Kindprozesse. Bei hartem Kill des gesamten
Hauptprozesses ist keine Bereinigung möglich; dann die drei Appdienste gezielt stoppen.

```powershell
# Im DataScout-Ordner, vor dem erstmaligen Wechsel aus dem Standalone-Betrieb:
docker compose --env-file infra/.env -f infra/compose.yaml stop backend worker frontend
# Im Dev-Suite-Ordner:
npm.cmd run start:local
```

In der flüchtigen Frontend-Demo erscheint DataScout standardmäßig. Bei bestehendem
API-Betrieb bleiben gespeicherte globale App-Auswahlen erhalten: Ein Administrator
aktiviert DataScout unter Einstellungen → Anwendungen. Die App-Key-Allowlist und der
API-Vertrag unterstützen nun elf Anwendungen; keine bestehenden Migrationen geändert.
Die Auswahl wird über den vorhandenen geschützten, revisionierten Endpunkt gespeichert.
Nach Backendänderungen muss auch das Suite-Backend neu gebaut/gestartet werden.

Die Einbettung verwendet den bestehenden hello/init/ready/navigate-Handshake. DataScout
prüft exakte lokale Eltern-Origin UND Elternfenster, akzeptiert nur drei bekannte
Bereiche und validierte Hex-Farbwerte, behält seine Komponenten beim Tabwechsel und
sendet keine Tokens oder Identität. Es übernimmt die Suite-Farbpalette; seine UI ist
derzeit Englisch. Der Host sendet dafür explizit Englisch, auch bei deutscher/französischer Suite.

Dies ist dieselbe gemeinsame lokale Fixture-Demo für alle lokalen Suite-Konten,
keine SSO-/Kontotrennung. Ein Hinweis steht in der eingebetteten App. Beide DataScout-
Prozesse erzwingen den Offline-Modus. Produktionsbuilds der Suite verstecken das Modul
und erlauben keine DataScout-URL, selbst bei gesetzter VITE_DATASCOUT_URL; DataScouts
Produktionsbridge ist ebenfalls aus. Keine neue öffentliche Route oder Bereitstellung.
Serveranbindung benötigt zusätzlich serverseitige Anmeldung und Daten-/Jobtrennung.

Direktaufruf ohne Suite: http://localhost:5176. Dann bleiben DataScouts eigene Kopfzeile
und alle Bereiche sichtbar. Für den alten Standalone-Modus ohne Suite-Override wieder
DataScouts normales Compose up ausführen; zuerst die Suite stoppen (Port 5173).
DataScouts allgemeines check.ps1 startet ebenfalls den Standalone-Modus; bei laufender
Suite stattdessen seine Tests per Compose exec und die Suite-Integrationsprüfung verwenden.

## Benutzernamen und persönliche App-Rechte

Siehe [Kontoverwaltung und sichere Administrator-Einrichtung](account-access.md). Anmeldung mit Benutzername oder E-Mail; Konten und App-Zuweisungen können nur Administratoren verwalten.
