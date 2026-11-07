# Benutzerkonten und App-Rechte

Stand: 7. November 2026. Gilt für den authentifizierten API-Modus der Dev Suite.

## Bedienung

Unter **Einstellungen → Nutzerverwaltung** können Administratoren Benutzer anlegen sowie deren Benutzername und App-Zuweisungen bearbeiten. Beim Anlegen sind Name, eindeutiger Benutzername, eindeutige E-Mail und ein Passwort mit Bestätigung erforderlich. Neue Konten haben im Formular zunächst keine Apps ausgewählt. Eine leere Auswahl erlaubt nur die eigenen Einstellungen. Administratoren besitzen immer alle App-Rechte; diese Rolle lässt sich nicht über das normale Benutzerformular vergeben oder entziehen.

Die Navigation zeigt die Schnittmenge aus global sichtbaren Apps und persönlich zugewiesenen Apps. Globale Sichtbarkeit bleibt eine Navigationseinstellung; die persönliche Zuweisung wird zusätzlich im Backend geprüft. Nicht zugewiesene Module werden nicht geladen. Benutzer können keine Konten anlegen oder App-Rechte ändern. Öffentliche Testkonto-Registrierung ist entfernt; der bestehende Testkonto-Endpunkt verlangt jetzt eine gültige Administratorsitzung, CSRF und den erlaubten Origin.

Die Anmeldung akzeptiert Benutzername oder E-Mail im selben Feld. Beide werden ohne Beachtung der Groß-/Kleinschreibung geprüft. Benutzernamen haben 3–64 ASCII-Zeichen (Buchstaben/Ziffern, danach auch Punkt, Unterstrich und Bindestrich), enthalten kein `@` und sind eindeutig. Der Anzeigename ist davon unabhängig. Der Name `Administrator` ist für das explizit eingerichtete Administratorkonto reserviert. Passwörter werden unverändert als BCrypt-Hash gespeichert, niemals im Browser dauerhaft gespeichert.

Änderungen von Benutzername oder App-Rechten widerrufen alle bestehenden Sitzungen des betroffenen Kontos. Erneute Anmeldung ist erforderlich. Die Rechte-API verlangt die zuletzt gelesene `sessionVersion`; parallele Änderungen ergeben 409 und überschreiben sich nicht. Bestehende Kontodaten bleiben erhalten.

## Bestehende Konten und Grenzen

Flyway V20 ergänzt Benutzername und App-Zuweisungen. Bestehende Konten behalten Kennung, E-Mail, Passwort, Daten und bisherigen App-Zugriff. Ihr anfänglicher Benutzername ist ein eindeutiges `u_…` aus der stabilen Kennung; ein Administrator kann normale Konten umbenennen. Die Anmeldung per bisheriger E-Mail funktioniert weiter. Die zusätzlichen DB-Spalten bleiben für ältere Schreibprogramme nullable; der neue Adapter interpretiert solche Legacy-Zeilen kompatibel. Ein Downgrade auf ein Backend ohne App-Rechte darf nach einer Einschränkung von Benutzern nicht als Sicherheitsgrenze betrieben werden.

Suite-Endpunkte prüfen RequestLab, Git, Dev Tools, Business, TimeTracker und Project Manager serverseitig. Gemeinsame Workspace-Lesezugriffe liefern nur erlaubte Bereiche; Business und TimeTracker erhalten notwendige Projekt-/Kundenreferenzen ohne Kontakt- und Adressdaten. Diese Referenzen sind ohne Project-Manager-Recht nicht schreibbar. Wiki-Schreibzugriffe erhalten versteckte Projektbereiche unverändert. KI-Anfragen und bestätigte Projektaktionen prüfen ebenfalls die aktuelle App-Berechtigung. Frühere Chatverläufe mit inzwischen entzogenen Apps werden ausgeblendet und ihr direkter Abruf verweigert; die gespeicherten Verläufe werden nicht gelöscht.

Die eingebundenen Apps prüfen ihre feste App-Kennung bei der Suite-Sitzungsprüfung. Öffentliche Nginx-Locations wählen den App-Schlüssel nach normalisierter Route, standardmäßig wird verweigert. Standalone-Konten der einzelnen Apps sowie das eigenständige Nextcloud-Konto bleiben eigenständige Anmeldungen. Das Cloud-Recht steuert den Nextcloud-Einstieg in der Suite.

## Konto Administrator sicher einrichten

Es gibt kein voreingestelltes Passwort und keinen öffentlichen Bootstrap-Endpunkt. Vor jeder Einrichtung wird eine Datenbanksicherung erstellt und geprüft. Bereits vorhandene Konten werden weder übernommen noch zurückgesetzt; eine bereits verwendete E-Mail wird abgelehnt. Ein bestehendes aktives, unbefristetes Administratorkonto mit Benutzername `administrator` bleibt unverändert.

Lokal im Projekt `dev-suite`, nach erfolgreichem Backend-Build und vorhandener lokaler PostgreSQL-Konfiguration:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local-administrator.ps1
```

Das Terminal fragt E-Mail und Passwort ab. Die Passworteingabe bleibt unsichtbar. Das Konto heißt **Administrator**, Benutzername **administrator**, und besitzt alle Apps. Keine Zugangsdaten werden in Git oder Ausgabedateien geschrieben. Anschließend das aktuelle Backend im API-Modus starten (`scripts/start-local.ps1`); normales Frontend: `http://localhost:5173`. Der Modus `-LocalDemo` hat keine echte Kontoverwaltung.

Auf Linux nach Installation des aktuellen Releases:

```bash
sudo python3 /pfad/zum/release/scripts/setup-linux-administrator.py
```

Der Befehl verwendet ausschließlich das installierte `/opt/forgeflow/backend.jar`, die geschützte `/etc/forgeflow/backend.env` und die lokale PostgreSQL-Verbindung. Er erstellt einen privaten Dump unter `/var/backups/forgeflow/`, prüft ihn und öffnet anschließend die interaktive Eingabe. Ein Remote-Deployment ist eine separate Aktion.

## API und Prüfung

- `POST /auth/login`: bestehendes JSON-Feld `email` transportiert Benutzername oder E-Mail.
- `GET /users`: nur Administratoren; enthält `username`, `allowedApps` und die erwartete `sessionVersion`.
- `POST /users`: zusätzlich `username` und `allowedApps`; die Oberfläche sendet beide explizit. Für bestehende administrative API-Clients bleiben ausgelassene Werte kompatibel (generierter Benutzername, bisherige Apps).
- `PUT /users/{id}/access`: `{ "username": "user.name", "allowedApps": ["requestLab"], "sessionVersion": 0 }`; nur normale Konten, keine Rollenänderung; Version wird erhöht.
- `GET /auth/showcase-session?app=dataScout`: prüft neben der Sitzung die konkrete App. Der parameterlose bestehende Identitätsvertrag bleibt kompatibel; alle App-Gateways geben ihren festen Schlüssel an.

Automatisiert: `npm test`, `npm run lint`, `npm run build`, `scripts/test-postgres-isolated.ps1`, `node scripts/test-user-access-browser.mjs`, `python scripts/test-suite-app-access.py` und `python scripts/test-showcase-deploy.py`. Browserprüfungen verwenden ausschließlich synthetische API-Antworten, darunter Rechtekonflikte, leere Zuweisung, direkte Navigation und mobile Breite. Reale E-Mail-/KI-Dienste werden nicht aufgerufen.

## Deployment-Verifikation

Die Deployment-Rollbacks prüfen vor dem Start eines älteren Backends, ob persönliche App-Einschränkungen verloren gingen. In diesem Fall bleibt das Backend gestoppt. Eine bereits kompatible JAR kann normal wiederhergestellt werden. Die lokale Administrator-Einrichtung wurde erfolgreich abgeschlossen; der Server legt ein eigenes Konto interaktiv an und übernimmt keine lokalen Zugangsdaten.
