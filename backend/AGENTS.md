# Backend-Arbeitskontext

Dieses Verzeichnis gehört zum Gesamtprojekt `D:\Projects\Vite\dev-suite`.
Lies zu Beginn `../AGENTS.md`, `../docs/HANDOFF.md`, `README.md` und `../docs/backend-api.md`.
Der OpenAPI-Vertrag liegt unter `../docs/openapi.json`. Falls nur das Backend in IntelliJ
sichtbar ist, muss der Zusammenhang mit dem React-Frontend unter `../frontend/` erhalten bleiben.

Java 21, Spring Boot 4.1.1, Maven und Spring Security sind bereits eingerichtet. Es gibt eine
BCrypt-Anmeldung mit Cookie-Sitzung/CSRF und einen kontogetrennten Referenzspeicher.
PostgreSQL 18.6 ist lokal auf dem Windows-PC installiert und angebunden.
Das Standardprofil `memory` braucht keine Datenbank; `postgres` aktiviert JPA-/Flyway-Adapter
für Konten, Fachdaten, Dateien und Einstellungen. Der Anwender hat Speichern und Erhalt von
Kunden/Projekten nach einem Backend-Neustart bestätigt. Der Anwender hat auch die automatisierte
Suite gegen die separate PostgreSQL-Datenbank `forgeflow_test` bestätigt:
23 Tests erfolgreich, keine Fehler und keine übersprungenen Tests.
Eigentümerzuordnung, atomare Commits, API-Vertrag und Revisionsprüfung bleiben erhalten.
Seitdem ergänzt: Kontoverwaltung mit stabiler Sitzungskennung, Passwort-/Profiländerung und
Administrator-Kontoanlage/Aktivierung. Migration V3 vergibt dem bisherigen Konto einmalig
Administratorrechte. Neue Funktionalität ist bisher mit H2/Memory getestet; der aktuelle
PostgreSQL-Lauf steht noch aus. Feinere Rollen und Team-Workspaces bleiben offen.
Lokale Start-/Sicherungsskripte und DPAPI-Konfiguration: `../docs/local-operation.md`.
Backups liegen ignoriert unter `../backups/`, Verbindungseinstellungen unter `.local/`.
Restore darf nur eine neue Datenbank mit Präfix `forgeflow_restore_` erstellen.

Vom Backend-Verzeichnis aus: `mvn test`, `mvn package`, `mvn spring-boot:run`.
Benötigte Startvariablen und Passwort-Hash-Erzeugung stehen in `README.md`.
Keine echten Passwörter oder Hashes in Quellcode, Dokumentation oder Logs aufnehmen.
Die Anwendung hat kein eingebautes Standardpasswort. Das Ticketsystem bleibt vorerst zurückgestellt.
