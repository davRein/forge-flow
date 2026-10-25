# TimeTracker

Die eigenständige App steht im Arbeitsbereich unter Dev Tools. Routen:
`#/timeTracker/calendar` und `#/timeTracker/reports`. Die Module bleiben beim Wechsel
gemountet; ein Kontowechsel entfernt den alten Zeitspeicher und offene Entwürfe.

## Bedienung

- Wochenkalender Montag–Sonntag mit Datumsauswahl, Heute und Vor-/Zurück-Navigation.
  Tages- und Wochensummen zeigen Netto-Arbeitszeit, zusätzlich abrechenbare Zeit und
  Anzahl der Einträge. Auf schmalen Fenstern werden die Tage untereinander angeordnet.
- Plus am Tag öffnet einen Eintrag für diesen Tag; die erste freie Stunde ab 09:00 Uhr
  wird vorgeschlagen. Beginn, Arbeitszeit in Minuten und separate Pause bestimmen die
  belegte Zeitspanne. Der Vorschlag kann geändert werden; volle Tage erzeugen keine
  automatische Buchung. Überlappungen einschließlich Pausen und Mitternachtsüberschreitungen
  werden abgewiesen. Für Arbeit über Mitternacht zwei Einträge anlegen.
- Optional Kunde und dessen Projekt auswählen; ohne Kunde gilt der Eintrag als interne
  Tätigkeit, ohne Projekt bleibt er kundengebunden. Projekte anderer Kunden werden nicht
  angeboten. Kommentar als Klartext bis 2000 Zeichen und Kennzeichnung abrechenbar.
- Klick auf einen Eintrag öffnet den Editor. Speichern erfolgt ausdrücklich, Löschen
  nach Bestätigung. Erfolgs-Popup erscheint erst nach bestätigtem Speichern. Bei Fehlern
  bleiben Entwurf und zuletzt bestätigte Daten erhalten; Ursache erscheint am Formular.
- Kunden-/Projekt-/Abrechenbar-Filter gelten für Kalender, Summen, Auswertung und Export
  derselben Woche. Auswertung gruppiert nach gespeicherter Kunden-/Projektzuordnung und
  Namensstand. Abrechenbare Minuten werden getrennt summiert, ohne Rechnungsbeträge.
- CSV exportiert nur die gefilterte Woche: Datum, Kunde, Projekt, Beginn, Ende,
  Netto-Minuten, Pause, Abrechenbar und Kommentar. UTF-8 mit BOM, Semikolon, zitierte
  Felder/Zeilenumbrüche und Neutralisierung von Tabellenkalkulations-Formelpräfixen.
- Oberfläche, Formulare und Meldungen sind DE/EN und verwenden alle vier Themes.
  Native Buttons, beschriftete Felder und das bestehende Dialog-/Fokusverhalten bleiben.

Zeiten sind lokale Kalenderdaten und Uhrzeiten, keine UTC-Zeitstempel. Ein Eintrag von
09:00 Uhr bleibt bei einem Zeitzonenwechsel 09:00 Uhr. Wochenberechnung verwendet reine
Kalenderdaten und bleibt über Sommerzeitwechsel stabil. Pausen werden als Gesamtdauer
angegeben, ohne einzelne Pausenintervalle. Zusätzlich gibt es eine persistente Stoppuhr
mit Start/Pause/Fortsetzen und Prüfung vor dem Speichern sowie monatliche PDF-Nachweise.
Bedienung und Wiederanlauf: [Business-Erweiterung](business-suite.md). Team-Freigaben sind
weiterhin nicht Bestandteil dieser Version.

## Speicher und Beziehungen

Im API-Modus ist der Speicher privat je authentifiziertem Konto. Im lokalen Modus sind
die Einträge leer beim Start und bleiben nur in der Sitzung; keine Backendanfragen und
kein stiller Rückfall auf Beispieldaten. Laden startet erst beim ersten Öffnen der App.

Eigener Endpunkt `GET/PUT /api/v1/me/time-tracking`, außerhalb des Workspace-Dokuments.
Ein alter Workspace-Client kann dadurch keine Zeiten entfernen. Version 1 enthält
`revision` und `entries`, maximal 10000 Einträge und 5 MiB serialisiertes UTF-8-JSON.
Der Server ersetzt die Revision bei jeder erfolgreichen Speicherung. PUT benötigt
aktive Sitzung, normalen Origin-/CSRF-Schutz und exakt zitiertes If-Match, passend zur
Body- und aktuellen Serverrevision. Veraltete Schreiber erhalten 409; vor erneutem
Speichern ausdrücklich den Serverstand laden. Keine automatische Schreibwiederholung.

Neue/geänderte Kunden-/Projektzuordnungen werden anhand des eigenen Workspace geprüft;
übergebene Anzeigenamen sind nicht vertrauenswürdig. Der Server speichert echte Namen
als Momentaufnahme. Unveränderte bestehende Zuordnungen behalten diese Namen auch nach
Umbenennung, Projektverschiebung oder Löschung. Historische Buchungen bleiben bearbeitbar,
neue Buchungen auf gelöschte Zuordnungen werden abgewiesen. Interne Buchungen haben leere
Namensfelder. Auswertungen unterscheiden verschiedene gespeicherte Namensstände.

Flyway **V12** erstellt `ff_time_tracking(owner_id, revision, payload)` mit Eigentümer-
Fremdschlüssel. JPA speichert atomar unter einer Kontosperre, einschließlich des ersten
Schreibens. Der Memory-Adapter verwendet dasselbe Datenformat, verliert es beim Neustart.
Keine neue Pflichtkonfiguration oder Abhängigkeit. Bestehende Kunden/Projekte und frühere
Migrationen bleiben erhalten; Frontend und Backend gemeinsam installieren. Vorherige
Clients ignorieren diese zusätzliche Tabelle. Die vorhandenen vollständigen PostgreSQL-
Backups enthalten sie automatisch.

Der Assistent erhält nur die zwei neuen Routennamen und allgemeine Bedienhinweise.
Zeitbuchungen, Wochenwahl, Filter und Kommentare werden nicht automatisch in den Chat
übernommen und sind über die bestehenden KI-Werkzeuge nicht les- oder veränderbar.

## Prüfung

Automatisiert: Datums-/Wochen-/Sommerzeitlogik, Minuten, Pausen, Überlappung, Revisionen,
Kontotrennung, fremde Referenzen, historische Namen, Speichern/Fehler/Navigation/Löschen,
Wochen-Auswertung, CSV-Quoting und Formelpräfixe, Migration und Neustarterhalt.
Echte PostgreSQL-Prüfung über `scripts/test-postgres-isolated.ps1 -Performance`.
Manuell offen: alle Themes, schmale Fenster, native Tastatur-/Dialogbedienung und Export
in einer Tabellenkalkulation; siehe `manual-check.md`.
