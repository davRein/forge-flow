# Nextcloud auf dem ForgeFlow-Server

Ziel: `https://cloud.forge-flow.de` als eigener Dateibereich, erreichbar aus ForgeFlow über
**Cloud → Dateien → Nextcloud öffnen**. Nextcloud öffnet in einem neuen Tab. Es verwendet
eigene Konten und Berechtigungen; keine automatische Übernahme von ForgeFlow-, Portal- oder
Administratorrechten. Eine gemeinsame Anmeldung per SSO ist in diesem Schritt nicht eingerichtet.
Auch Office-Bearbeitung mit Collabora/OnlyOffice ist nicht Bestandteil dieser Installation.

## Vorbereitet, noch nicht installiert

Der Agent konnte sich nicht mit nichtinteraktivem SSH anmelden
(`Permission denied (publickey,password)`). Es wurden keine Serverpakete installiert,
keine Serverkonfigurationen verändert und keine Zertifikate angefordert. Die folgenden
Befehle führt der Anwender mit seiner vorhandenen interaktiven SSH-/sudo-Anmeldung aus.
Keine Passwörter in den Chat oder in Projektdateien kopieren.

## 1. DNS bei IONOS

Einen zusätzlichen **A-Record `cloud` → `185.56.150.178`** erstellen. Für diese Subdomain
keinen fremden AAAA-Record stehen lassen. Das Skript richtet ausschließlich IPv4 ein und
bricht bei vorhandenem AAAA ab. Die Hauptdomain und E-Mail-Einträge bleiben wie eingerichtet.

Voraussetzungen des Skripts:

- Ubuntu 22.04, 24.04, 26.04 oder 26.10, mindestens 2 GiB Gesamtspeicher und 10 GiB freier
  Platz unter `/var/lib`. Zusätzliche Dateien und Sicherungen benötigen zusätzlichen Platz.
- Vorhandenes Nginx und Certbot mit aktivem `snap.certbot.renew.timer` oder `certbot.timer`.
- Gesunde ForgeFlow-API auf `127.0.0.1:3001`, öffentliche Ports 80/443 und freier lokaler
  Port 8081. Die DNS-Auflösung muss ausschließlich die angegebene öffentliche IPv4 liefern.
- Internetzugang zu Docker-Paketquelle, Container-Registry, Let's Encrypt und Nextcloud.
- Falls Docker schon installiert ist: Compose v2 muss verfügbar sein. Konflikte mit anderen
  Containerpaketen werden gemeldet; das Skript entfernt diese Pakete nicht automatisch.

## 2. Übertragen und prüfen

Windows-PowerShell im Repository:

```powershell
scp scripts/install-linux-nextcloud.sh scripts/backup-linux-nextcloud.sh `
  scripts/test-linux-nextcloud.sh dreinerts@185.56.150.178:

ssh -t dreinerts@185.56.150.178 'bash ~/test-linux-nextcloud.sh && sudo bash ~/install-linux-nextcloud.sh cloud.forge-flow.de 185.56.150.178 --check'
```

Die Offline-Tests installieren nichts. `--check` prüft Server, DNS, Voraussetzungen und
Konflikte ohne Installation oder Konfigurationsänderung. Fehlt der DNS-Eintrag, zuerst
dessen Übernahme abwarten. Es wird weder Nginx noch PostgreSQL für ForgeFlow neu installiert.

Bei `socket.gaierror: Name or service not known` konnte der Server die Cloud-Subdomain
nicht auflösen. Das aktuelle Skript zeigt stattdessen einen erklärenden DNS-Hinweis.
Bei IONOS den A-Record `cloud` auf `185.56.150.178` setzen und auf Ubuntu prüfen:

```bash
getent ahostsv4 cloud.forge-flow.de
```

Erst wenn die erwartete IP erscheint, den Installationsbefehl wiederholen. Bleibt die
Ausgabe leer, ist der Eintrag noch nicht vorhanden/übernommen oder der Serverresolver
hat ein Problem. Keine Ersatzzuordnung in `/etc/hosts` anlegen: Let's Encrypt muss den
Namen auch öffentlich auflösen können. Die Passwortdatei entsteht erst später im Setup.

Beim Anwender ist der DNS-Eintrag inzwischen korrekt. Ubuntu nutzte noch IONOS-Resolver;
`sudo resolvectl dns ens6 1.1.1.1 8.8.8.8` mit anschließendem Cache-Leeren behob die
Auflösung zur Laufzeit. Eine dauerhafte Änderung der Netzwerkkonfiguration steht separat aus.

Bei `Local ACME self-check failed` noch kein Zertifikat anfordern oder Prüfungen umgehen.
Die aktuelle Skriptversion wartet bis zu 15 Abrufe auf exakt passende Prüfdatei und
eigenen Location-Header und umgeht für diese Direktprüfungen HTTP-Proxy-Umgebungsvariablen.
Damit wird ein verzögertes Aktivieren neuer Nginx-Worker abgefangen. Ein dauerhafter 404
ist damit nicht als Reload-Verzögerung bewiesen: Vor dem Rollback werden HTTP-Status,
Location-Erkennung, Pfadberechtigungen und ausschließlich Listener/Servernamen ausgegeben.
Diese Ausgabe zur weiteren Routingdiagnose verwenden. Es werden keine kompletten
Nginx-Konfigurationen mit möglichen Zugangsdaten ausgegeben.

Die aktualisierten Skripte von Windows erneut übertragen und dann auf Ubuntu starten:

```powershell
scp scripts/install-linux-nextcloud.sh scripts/test-linux-nextcloud.sh dreinerts@185.56.150.178:
```

```bash
bash ~/test-linux-nextcloud.sh && sudo bash ~/install-linux-nextcloud.sh cloud.forge-flow.de 185.56.150.178
```

## 3. Installieren

```powershell
ssh -t dreinerts@185.56.150.178 'sudo bash ~/install-linux-nextcloud.sh cloud.forge-flow.de 185.56.150.178'
```

Das Skript erstellt zunächst einen eigenen HTTP-Challenge-VirtualHost. Nach erfolgreicher
lokaler und öffentlicher Challenge-Prüfung fordert das vorhandene Certbot ein Zertifikat
`forgeflow-nextcloud` an. Certbot kann Kontakt-/Nutzungsbedingungen abfragen.

Docker Engine und Compose werden bei Bedarf aus dem signierten Docker-Ubuntu-Repository
installiert. Nextcloud 35 Apache, PostgreSQL 17 und Redis 8 laufen im eigenen Compose-Projekt
`forgeflow-nextcloud`. Heruntergeladene Images werden beim Installieren auf ihren Digest
festgeschrieben. Dateien/Konfiguration und Datenbank liegen in getrennten dauerhaften Volumes.
Die bestehende ForgeFlow-PostgreSQL-Datenbank wird nicht verwendet.

Nur `127.0.0.1:8081` wird für die App veröffentlicht. Datenbank und Redis besitzen keine
veröffentlichten Ports und liegen in einem privaten Container-Netz. Nginx terminiert HTTPS,
setzt Forwarding-Header neu und Nextcloud vertraut genau dem ermittelten Proxy-Gateway.
Uploadlimit: 1 GiB pro HTTP-Anfrage. Hintergrundjobs laufen über einen systemd-Timer alle
fünf Minuten. Ein eigener Zertifikats-Deploy-Hook lädt Nginx nach Erneuerung neu.

Die Installation verändert nur den neuen Cloud-VirtualHost, startet ForgeFlow nicht neu
und ändert dessen `APP_ORIGIN` nicht. Bei Fehlern wird der vorherige Cloud-VirtualHost
wiederhergestellt. Heruntergeladene Pakete, Zertifikate, Volumes und Geheimnisse bleiben
für Diagnose/Wiederaufnahme erhalten; es gibt keine automatische Datenlöschung. Nach einer
unvollständigen Installation denselben Befehl erneut ausführen. Eine fertige Installation
wird nicht überschrieben oder auf neue Passwörter zurückgesetzt.

## 4. Erster Zugang

Auf dem **Ubuntu-Server** das generierte Passwort lokal anzeigen:

```bash
sudo cat /opt/forgeflow-nextcloud/secrets/admin-password
```

`https://cloud.forge-flow.de` öffnen. Benutzername: **`forgeflow-admin`**.
Nach der ersten Anmeldung das Passwort ändern und normale Nextcloud-Konten für den
Alltag anlegen. Freigaben und Benutzer/Gruppen werden in Nextcloud verwaltet. Das initiale
Passwortfile wird bei späterer Passwortänderung nicht aktualisiert und ist kein Passwortreset.

Die Secret-Dateien sind im rootgeschützten Verzeichnis `/opt/forgeflow-nextcloud/secrets/`.
Einzelne Dateien sind für die Container-UIDs lesbar gemountet; auf dem Host verhindern die
0700-Elternverzeichnisse Zugriff anderer Benutzer. Dateien nicht ins Repository übertragen.

Kontrolle auf Ubuntu:

```bash
curl --fail https://cloud.forge-flow.de/status.php
curl --fail http://127.0.0.1:3001/api/v1/health
sudo docker compose --project-directory /opt/forgeflow-nextcloud --project-name forgeflow-nextcloud ps
sudo systemctl status forgeflow-nextcloud-cron.timer --no-pager
sudo certbot renew --cert-name forgeflow-nextcloud --dry-run
```

Status muss installiert, nicht im Wartungsmodus und ohne benötigtes Datenbankupgrade sein.
Zusätzlich im Browser Upload/Download, private Freigaben, Versionierung, Kontoabmeldung und
ein zweites Konto ohne Freigabe prüfen. Daten dürfen nicht nach außen öffentlich geteilt sein,
wenn keine entsprechende Nextcloud-Freigabe angelegt wurde. Nextcloud-Adminübersicht auf
weitere App-/E-Mail-Einrichtung prüfen; SMTP wurde nicht konfiguriert.

## 5. ForgeFlow veröffentlichen

Das vorbereitete aktuelle ForgeFlow-Programmpaar wie bisher mit
`scripts/update-linux-chat.sh forge-flow.de` installieren; dadurch erscheint der Cloud-Menüpunkt.
Der Backend-Seitenkatalog kennt nur die allgemeine neue Route `/cloud/files`, keine Cloud-Dateien
oder Zugangsdaten. Es gibt keine Nextcloud-KI-Werkzeuge oder WebDAV-Zugangsdaten im Frontend.
Portal-Konten bleiben ausschließlich in ihrer Portalansicht und erhalten keinen Cloudzugang.

Standardadresse ist `https://cloud.forge-flow.de`. Für eine andere Adresse vor dem Frontendbuild
`VITE_NEXTCLOUD_URL` als HTTPS-Origin setzen; siehe `frontend/.env.example`. Der Build akzeptiert
keine eingebetteten Zugangsdaten, Queryparameter, Fragmente oder Unterpfade. Ein leerer Wert
deaktiviert den Öffnen-Link. Die Seite meldet keine ungeprüfte Online-Verfügbarkeit.

## 6. Sichern und warten

Auf Ubuntu:

```bash
sudo bash ~/backup-linux-nextcloud.sh
```

Das Skript prüft den Ausgangszustand, pausiert Hintergrundjobs, setzt Wartungsmodus und
stoppt den App-Container für einen konsistenten PostgreSQL-Dump und ein vollständiges
Archiv von `/var/www/html` einschließlich Daten/Konfiguration. Anschließend werden App,
Wartungsmodus und zuvor aktiver Timer wiederhergestellt, auch nach Fehlern. Währenddessen
ist Nextcloud kurz nicht verfügbar. ForgeFlow läuft weiter.

Sicherungen liegen unter `/var/backups/forgeflow-nextcloud/backup.*`, mit `complete`-Marker
und SHA256-Prüfsummen. Ein unvollständiges Verzeichnis ist keine bestätigte Sicherung.
Die vorhandenen ForgeFlow-Sicherungen sichern diese Nextcloud-Volumes **nicht** mit.
Eine vollständige Nextcloud-Sicherung regelmäßig auf getrennten Datenträger kopieren;
sie enthält private Dateien, Konfiguration und Secrets. Es gibt keine automatische
Aufbewahrungs-/Löschregel oder bereits konfigurierte externe Sicherung.

Images sind absichtlich festgeschrieben; Nextcloud-/PostgreSQL-/Redis-Patches werden nicht
unbemerkt installiert. Vor einem Update sichern, Releasehinweise und App-Kompatibilität
prüfen. Für einen Patch im Nextcloud-35-Zweig in `/opt/forgeflow-nextcloud/.env` vorübergehend
`NEXTCLOUD_IMAGE=nextcloud:35-apache` setzen, dann als root im Verzeichnis:

```bash
docker compose pull app
docker compose up -d app
docker compose exec -T --user www-data app php occ status
docker image inspect nextcloud:35-apache --format '{{index .RepoDigests 0}}'
```

Nach erfolgreicher Prüfung den ausgegebenen Digest wieder als `NEXTCLOUD_IMAGE` eintragen.
Weitere Updates analog im bestehenden Hauptversionszweig. Hauptversionswechsel von
Nextcloud bzw. PostgreSQL brauchen einen gesonderten Upgradeplan; kein Überspringen von
Nextcloud-Hauptversionen. Kein `docker compose down -v` verwenden: das entfernt die Daten.
Eine Wiederherstellung muss zusammenpassende App-Version, Dateivolume, Datenbank und
Secrets aus derselben Sicherung verwenden; kein ungeprüftes Entpacken über den Livebestand.

## Prüfstand

Lokal geprüft: ungültige Hostnamen, Compose-Topologie/Secrets/Loopback-Bindung, HTTP-Challenge-
und HTTPS-Proxy-Generierung, Wiederherstellung des eigenen VirtualHosts, Bash-Syntax und
YAML-Parsing. Frontend-Tests prüfen Konfiguration und bestehende Navigation. Keine echte
Containerinstallation, Nginx-Laufzeitprüfung, DNS-/Zertifikatsausstellung oder Browserprüfung
auf Ubuntu durch den Agenten; diese Abnahme steht nach den obigen Befehlen aus.
Zusätzlich wurden verzögerte 404→Erfolg-Antworten sowie falsche Location und falscher
Antwortinhalt mit begrenzten Wiederholungen simuliert; insgesamt sieben Offline-Prüfungen.

Quellen: [Nextcloud-Container](https://github.com/nextcloud/docker),
[Systemvoraussetzungen](https://docs.nextcloud.com/server/stable/admin_manual/installation/system_requirements.html),
[Reverse Proxy](https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/reverse_proxy_configuration.html),
[Docker auf Ubuntu](https://docs.docker.com/engine/install/ubuntu/).
