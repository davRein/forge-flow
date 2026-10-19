# Browserprüfung des lokalen PostgreSQL-Betriebs

Status beim Implementierungsdurchlauf vom 19. Oktober 2026:
Der Benutzer hat Speicherung und Neustartfestigkeit von Kunden/Projekten bestätigt.
Für diesen Durchlauf war kein Browser mit dem Agenten verbunden; der Versuch, einen
In-App-Browser zu öffnen, meldete "Browser is not available: iab".
Die nachstehenden Punkte sind deshalb eine offene manuelle Prüfliste, keine ausgeführten
visuellen Tests. API-/Fachlogiktests sind separat in HANDOFF.md dokumentiert.

Vorbereitung: Ein Administrator meldet sich an und legt in den Einstellungen ein
eigenes Testkonto an. Die Fachprüfungen mit diesem Konto durchführen, damit der eigene
Arbeitsbereich unverändert bleibt. Die vollständige bisherige Prüfliste steht zusätzlich
in der Haupt-README.

## Fachfunktionen

- Kunde und Projekt anlegen, bearbeiten und über Suche wiederfinden.
- Aufgaben anlegen, Status/Priorität bearbeiten, Liste und Kanban verwenden.
  Drag-and-drop muss Status und Aktivität gemeinsam speichern.
- Epic anlegen, Aufgaben zuordnen und Fortschritt prüfen.
- Sprint planen, starten und abschließen. Ein zweiter aktiver Sprint muss verhindert werden.
  Offene Aufgaben gehen ins Backlog; spätere Aufgabenänderungen ändern keine Abschlussmomentaufnahme.
- Eine kleine UTF-8-Datei hochladen, umbenennen und herunterladen. Nach Seitenneuladen und
  Backend-Neustart müssen Dateiname und Inhalt unverändert sein.
- Wiki-Kategorie und Artikel anlegen, suchen und bearbeiten. Vorschau mit Markdown und
  HTML-Text prüfen; Artikel und Kategorie müssen nach Neustart vorhanden sein.
- Theme, Startansicht und Aufgabenpriorität ändern; nach Neuanmeldung und Backend-Neustart prüfen.
- Zwei Sitzungen mit demselben Testkonto öffnen, denselben Ausgangsstand laden und nacheinander
  ändern. Die zweite Sitzung muss einen Versionskonflikt anzeigen, ihre Änderungen behalten
  und vor dem Laden des Serverstands das Verwerfen bestätigen lassen.
- Dev Tools aufrufen und zwischen Modulen wechseln. Keine automatische REST-Anfrage;
  Eingaben bleiben innerhalb derselben Anmeldung erhalten und werden beim Logout entfernt.

## Neue Kontoverwaltung

- Profilname ändern; Header muss den bestätigten Namen zeigen.
- E-Mail mit falschem aktuellem Passwort ändern: Fehler, keine Änderung.
- E-Mail mit richtigem Passwort ändern: eigenes Konto und eigene Daten bleiben erhalten.
  Eine vorher geöffnete zweite Sitzung muss ungültig werden.
- Passwort mit falscher Bestätigung oder falschem aktuellem Passwort: Fehler.
- Passwort erfolgreich ändern: alle alten Sitzungen verlieren Zugriff; neues Passwort
  ermöglicht Login, altes Passwort nicht. Fachbestand bleibt unverändert.
- Als normaler Benutzer dürfen weder Kontoliste noch Administratoraktionen sichtbar oder
  über direkte API-Aufrufe erlaubt sein.
- Als Administrator ein weiteres Testkonto anlegen. Doppelte E-Mail muss abgewiesen werden.
- Das Testkonto deaktivieren: dessen bestehende Sitzung verliert Zugriff. Reaktivieren:
  Login funktioniert wieder und die bisherigen Daten bleiben vorhanden.
- Das Administratorkonto darf nicht über die Oberfläche deaktiviert werden.
- Während unbestätigter Fach-/Einstellungsänderungen dürfen Kontodaten nicht geändert werden.
- Mit hellem und dunklem Theme sowie schmalem Fenster die neuen Formulare und Dialoge prüfen.

## Abschluss

Nur tatsächlich ausgeführte Punkte als geprüft dokumentieren, mit Datum und Datenmodus.
Das Testkonto kann anschließend deaktiviert werden; eine automatische Löschung seiner Daten
ist nicht vorgesehen. Ticketsystem bleibt zurückgestellt.

