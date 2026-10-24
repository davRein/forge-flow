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
Mit Strg+C werden nur die von diesem Aufruf gestarteten Prozessbäume beendet.
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
