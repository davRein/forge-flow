# Backend-Arbeitskontext

Dieses Verzeichnis gehört zum Gesamtprojekt `D:\Projects\Vite\dev-suite`.
Lies zu Beginn `../AGENTS.md`, `../docs/HANDOFF.md`, `README.md` und `../docs/backend-api.md`.
Der OpenAPI-Vertrag liegt unter `../docs/openapi.json`. Falls nur das Backend in IntelliJ
sichtbar ist, muss der Zusammenhang mit dem vorhandenen React-Frontend erhalten bleiben.

Java 21, Spring Boot 4.1.1, Maven und Spring Security sind bereits eingerichtet. Es gibt eine
BCrypt-Anmeldung mit Cookie-Sitzung/CSRF und einen kontogetrennten Referenzspeicher. Eine Datenbank
ist noch nicht angebunden. Ersetze bei der späteren Anbindung die `Accounts`-/`WorkspaceStorage`-
Adapter unter Erhalt von Eigentümerzuordnung, atomaren Commits und Revisionsprüfung.

Vom Backend-Verzeichnis aus: `mvn test`, `mvn package`, `mvn spring-boot:run`.
Benötigte Startvariablen und Passwort-Hash-Erzeugung stehen in `README.md`.
Keine echten Passwörter oder Hashes in Quellcode, Dokumentation oder Logs aufnehmen.
Die Anwendung hat kein eingebautes Standardpasswort. Das Ticketsystem bleibt vorerst zurückgestellt.
