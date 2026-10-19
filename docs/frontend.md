# Frontend-Funktionen

Die Navigation nutzt Hash-URLs, zum Beispiel `#/projectManager/customers`.
Unter Project Manager → Einstellungen lassen sich das helle oder dunkle Design, die Startansicht
(Dashboard oder Projektliste) und die Standardpriorität neuer Aufgaben ändern. Die Einstellungen
wirken sofort und lassen sich auf ihre Vorgaben zurücksetzen. Die Startansicht wird beim Öffnen
über die Seitenleiste sowie bei der Weiterleitung unbekannter URLs verwendet; direkte Seitenlinks
bleiben gültig. Die Priorität wird beim Öffnen eines neuen Aufgabenformulars vorbelegt. Bereits
vorhandene Aufgaben und offene Entwürfe werden dadurch nicht verändert. Das Design gilt für
die gesamte Anwendung einschließlich Dialogen, Status-Badges und nativen Formularfeldern.
Einstellungen verwenden einen austauschbaren, asynchronen Speicher mit getrennter Zuordnung je
Benutzerkennung, Lade-/Speicherstatus und Wiederholen bei Fehlern. Im lokalen Modus ist die Anwendung anonym
und nutzt einen Speicher für die laufende Sitzung; beim Neuladen werden die Einstellungen zurückgesetzt.
Im API-Modus werden Einstellungen über die geprüfte Serversitzung geladen und gespeichert.
Die Anbindung je Benutzer ist in [Benutzereinstellungen](user-settings.md) beschrieben.

Projekt-Dashboard, Projektliste, durchsuchbare Kundenübersicht und Projektdetails sind erreichbar.
Projekte und Kunden lassen sich anlegen und bearbeiten. Projekte werden einschließlich ihrer
Aufgaben, Epics, Sprints, Dateien und Aktivitäten nach einer Bestätigung gelöscht. Kunden lassen sich erst löschen,
wenn ihnen keine Projekte mehr zugeordnet sind. Die Projekteinstellungen enthalten die Aktionen
zum Bearbeiten und Löschen sowie den aktuellen Kunden, die Deadline und den Planungsstand.

Aufgaben bieten Liste und Kanban-Board. Epics lassen sich anlegen, bearbeiten, durchsuchen,
nach Fortschritt filtern und löschen. Bestehende Aufgaben können beim Bearbeiten eines Epics oder
im Aufgabenformular zugeordnet werden. Jede Aufgabe gehört höchstens zu einem Epic desselben
Projekts. Beim Löschen eines Epics bleiben seine Aufgaben erhalten. Fortschritt und Status ergeben
sich aus den zugeordneten Aufgaben; Epic-Änderungen erscheinen im Aktivitätsverlauf.

Sprints bieten Titel, Ziel, Zeitraum, Suche und Statusfilter. Aufgaben werden im Sprint-Formular oder
direkt aus dem Backlog eingeplant. Aufgaben können zwischen geplanten Sprints verschoben werden;
Aufgaben eines anderen aktiven Sprints bleiben geschützt. Pro Projekt kann ein Sprint aktiv sein.
Ein Sprint startet erst mit mindestens einer offenen Aufgabe. Beim Abschluss wird eine Momentaufnahme
aller Sprint-Aufgaben gespeichert. Offene Aufgaben gehen zurück ins Backlog. Abgeschlossene Sprints
sind schreibgeschützt; spätere Aufgabenänderungen verändern das Abschluss-Ergebnis nicht.
Sprint-Zuordnungen werden in Aufgabenliste und Detailansicht angezeigt. Das Board kann nach Sprint
oder Backlog gefiltert werden. Aktive Sprints müssen vor dem Löschen abgeschlossen werden.

Projektdateien können über eine Mehrfachauswahl oder Drag-and-drop hinzugefügt werden. Die Dateiliste
bietet Suche, Dateitypfilter, Sortierung, Größenangaben, Downloads, Umbenennen und Entfernen mit
Bestätigung. Gleiche Dateinamen werden innerhalb eines Projekts ohne Überschreiben übersprungen;
Groß-/Kleinschreibung und Unicode-Normalisierung werden dabei berücksichtigt. Beim Umbenennen
bleiben Dateiendung und Dateiinhalte erhalten. Dateiaktionen erscheinen im Aktivitätsverlauf.
Im lokalen Modus bleiben Dateien nur in der laufenden Sitzung verfügbar. Im API-Modus werden
neue Dateiinhalte als Multipart-Upload mit dem Workspace gespeichert und über geschützte Endpunkte geladen.
Temporäre Download-URLs werden nach dem Download-Start, beim Entfernen und beim Beenden der
Anwendung freigegeben. Projektlöschungen entfernen auch die zugehörigen Dateien aus der Sitzung.

Das Wiki bietet eine Startseite mit Kennzahlen und zuletzt bearbeiteten Artikeln, eine Artikelliste,
eine Kategorienverwaltung und eine Suche über Titel, Inhalte und Kategorien. Artikel lassen sich
anlegen, lesen, bearbeiten und nach Bestätigung löschen. Der Editor bietet eine Vorschau und
einfache Markdown-Formatierung: Überschriften bis Ebene 3, Absätze, geordnete und ungeordnete Listen
sowie Codeblöcke. HTML wird als Text dargestellt. Ungespeicherte Artikelentwürfe bleiben beim Wechsel
zwischen Ansichten und Modulen erhalten und lassen sich fortsetzen oder verwerfen.
Kategorien lassen sich anlegen, bearbeiten und löschen. Ihre Namen sind unabhängig von
Groß-/Kleinschreibung und Unicode-Schreibweise eindeutig. Beim Löschen können vorhandene Artikel
einer anderen Kategorie zugeordnet werden oder ohne Kategorie erhalten bleiben; offene
Artikelentwürfe erhalten dieselbe neue Zuordnung. Suche, Kategorie und Sortierung stehen in der URL,
zum Beispiel `#/wiki/articles?q=Projekt&category=1&sort=title`. Artikel sind über
`#/wiki/articles?article=1` direkt erreichbar. Ungültige oder gelöschte Artikel zeigen einen Hinweis.

Die Dev Tools enthalten vier Werkzeuge:

- JSON Formatter: Syntaxprüfung, Einrückung mit 2/4 Leerzeichen oder Tabulator, Komprimierung und
  Kopieren. Die ursprünglichen Zahlen, Zeichenfolgen und doppelten Schlüssel bleiben beim Formatieren
  erhalten; große Ganzzahlen werden dabei nicht gerundet.
- REST-Test: GET, POST, PUT, PATCH, DELETE, HEAD und OPTIONS mit eigener Adresse, Headern,
  optionalem JSON-/Text-Body und einem Zeitlimit von 1–120 Sekunden. Anfragen werden ausschließlich
  durch die Schaltfläche gesendet. Antworten zeigen HTTP-Status, Dauer, Bytezahl, verfügbare Header
  und Inhalt als UTF-8-Text; JSON kann formatiert oder als Rohtext angezeigt und kopiert werden.
  HTTP-Fehlerantworten bleiben lesbar. Laufende Anfragen lassen sich abbrechen. Nach 2 MiB wird
  die Anzeige begrenzt und der restliche Download abgebrochen. Die Anfragen laufen direkt im Browser
  ohne Proxy und ohne Cookies; CORS, Mixed-Content-Regeln und eingeschränkte Header gelten daher
  weiterhin. Beim Modulwechsel läuft eine gestartete Anfrage bis zum Abschluss, Abbruch oder Zeitlimit weiter.
- Rechner: Klammern, Vorzeichen, Grundrechenarten, Potenzen, Modulo, wissenschaftliche Schreibweise,
  Dezimalpunkt/-komma und ein Verlauf der letzten zehn erfolgreichen Berechnungen. Der Parser führt
  keinen JavaScript-Code aus. Potenzen sind rechtsassoziativ; `-2^2` ergibt `-4`. Der Rechner verwendet
  JavaScript-Gleitkommazahlen, sodass Dezimalergebnisse Rundungsabweichungen enthalten können.
- Konverter: UTF-8-Text und Base64, URL-Komponenten, Länge, Masse, Temperatur, dezimale/binäre
  Datenmengen sowie ganze Zahlen zwischen Binär-, Oktal-, Dezimal- und Hexadezimalsystem.
  Zahlensysteme verwenden `BigInt` und erhalten auch große Ganzzahlen exakt. Einheitenergebnisse
  werden mit 14 signifikanten Stellen angezeigt. Base64-Dekodierung prüft gültiges UTF-8;
  URL-Dekodierung behandelt `+` als Pluszeichen, da einzelne URL-Komponenten verarbeitet werden.

Eingaben, Ergebnisse und Rechnerverlauf der Dev Tools bleiben beim Ansichts- und Modulwechsel
erhalten. Sie liegen ausschließlich im Sitzungsspeicher. Kopieren setzt eine verfügbare
Browser-Zwischenablage voraus; andernfalls wird auf manuelles Kopieren hingewiesen.

Aufgaben, Epics, Sprints, Dateien, Aktivitäten, Wiki-Inhalte und Artikelentwürfe bleiben innerhalb der laufenden
Sitzung beim Wechsel zwischen Projekten, Ansichten und Modulen erhalten. Alle Änderungen liegen
im lokalen Modus im Frontend-Speicher und werden beim Neuladen verworfen. Im API-Modus werden
gespeicherte Fachdaten vom Backend geladen. Dauerhafte Speicherung verlangt das Backend-Profil
`postgres` und einen eingerichteten PostgreSQL-Server; im Standardprofil `memory` bleiben die Daten flüchtig.

Das Ticketsystem ist auf Wunsch vorerst zurückgestellt.
