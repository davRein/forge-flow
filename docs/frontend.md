# Frontend-Funktionen

Dev Tools sind kompakter: maximal 1160 px, kleinere Abstände und korrekt ausgerichtete
JSON-Aktionen. Der REST-Client hat eine Collection-Seitenleiste und Reiter für Header,
Body und Zeitlimit. Anfragen lassen sich privat im Konto speichern, laden, aktualisieren,
kopieren und nach Bestätigung löschen. Laden sendet keine Anfrage. [Details](rest-collections.md).

Projektliste und Dashboard haben eine kompakte Leiste innerhalb des Projektrahmens:
Projektmappen-Icon mit „Neu“, Lupe und kleiner Ergebniszähler. Die Lupe klappt das Suchfeld
nach rechts auf und fokussiert es; erneuter Klick oder Escape schließt es, leert den Filter
und setzt den Fokus zurück. Filterung nach Projektname/Kunde wie bisher. Übersichten maximal
1100 px breit, kleinere Abstände und neutrale Projektzeilen ohne flächige blaue Auswahl.
Die Animation berücksichtigt reduzierte Bewegung; Beschriftungen sind DE/EN.

Der frühere Wiki-Bereich heißt jetzt Dokumentation: Bereichsübersicht, Seitenbaum mit
Unterseiten, Breadcrumbs, Inhaltsverzeichnis, Lesezeit, Vorlagen und Markdown-Editor mit
Formatierungsleiste und Vorschau. Bestehende Inhalte/Links bleiben gültig. Suche, Bereiche,
Entwürfe und DE/EN sind integriert; Hierarchie dauerhaft in PostgreSQL über V8.
Bedienung und Grenzen: [documentation.md](documentation.md).

Kundennamen/„Details öffnen“ führen zu einer direkt verlinkbaren Detailseite mit Stammdaten,
zugeordneten Projekten, mehreren Ansprechpartnern und Klartextnotizen. Eigene Dialoge für
Kontakte/Notizen, Bestätigung beim Entfernen und Erhalt bei Stammdatenänderungen.
Die KI kann Kontakte und Notizen lesen sowie bestätigte Anlage/Änderung vorbereiten.
Details: [customer-details.md](customer-details.md).

Das Kundenformular verwendet Bereiche für Unternehmen, Anschrift und Kontakt inklusive
PLZ als Text. Branchen werden im Dropdown aus einer anwendungsweiten Liste gewählt;
Administratoren verwalten sie unter Einstellungen → Globale Einstellungen.
Vorhandene Branchenwerte bleiben erhalten. Details: [customers.md](customers.md).

Der Assistent kann bestehende Kunden, Projekte, Aufgaben, Epics, geplante Sprints und
Wiki-Inhalte nach Vorschau alter/neuer Werte ändern sowie Dateien umbenennen. Nur
„Bestätigen und ändern“ speichert. Neue Datensätze lassen sich weiterhin anlegen.
Umfang und Beispiele: [ai-updates.md](ai-updates.md).

Der KI-Assistent kann die gespeicherten Fachbereiche abfragen und neue Kunden, Projekte,
Aufgaben, Epics, Sprints, Wiki-Einträge, Textdateien und als Administrator normale Benutzerkonten
zur Anlage vorschlagen. Zählungen und Filter laufen im Backend. Eine Karte zeigt alle Angaben;
erst „Bestätigen und anlegen“ speichert. Offene Formulare/laufende Speicherungen blockieren
die Freigabe. Nach Erfolg werden Daten ohne Aushängen der Komponenten aktualisiert; lokale
Änderungen während des Nachladens bleiben erhalten. Benutzerpasswörter werden nur in einem
separaten privaten Feld direkt ans Backend gesendet. Umfang, Beispiele und Grenzen:
[ai-workspace.md](ai-workspace.md). Die älteren Beschreibungen der Projektwerkzeuge unten
bleiben als Teil dieses erweiterten Funktionsumfangs gültig.

Die Oberfläche verwendet eine gemeinsame helle/dunkle Farbpalette, abgestufte
Systemtypografie und dezente Hover-/Fokus-Übergänge. Dialoge und Aufgabenansichten
blenden kurz ein; die Systemeinstellung für reduzierte Bewegung wird berücksichtigt.
Modulnavigation und Tabs passen sich schmalen Fenstern an.

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

Im API-Modus erscheint nach bestätigtem Speichern von Workspace-Änderungen unten rechts
ein kompakter Hinweis mit grünem Häkchen. Er verschwindet nach fünf Sekunden;
Mauskontakt und Tastaturfokus pausieren den Timer. Beim bloßen Laden gibt es keine
Erfolgsmeldung und kein dauerhaftes Synchronisationsfeld. Speicherfehler bleiben mit
rotem Zeichen, Ursache und Wiederholungsaktion sichtbar. Bei Versionskonflikten muss
der Serverstand nach ausdrücklicher Bestätigung neu geladen werden. Ungespeicherte
Änderungen bleiben bis dahin in der Ansicht erhalten. Hinweise folgen der gewählten Sprache.

Die Einstellungen haben eine eigene Navigation für Nutzerverwaltung, Optik,
Projektmanager und Sprache. Die Kategorie steht im URL-Parameter `category`;
Kontoentwürfe bleiben beim Wechsel erhalten. Auf schmalen Fenstern rückt die Navigation
über den Inhalt. Deutsch/Englisch ist pro Konto gespeichert und übersetzt Einstellungen,
Wiki, Dev Tools und die gemeinsame Navigation. Die übrigen Projektmanager-Inhalte
bleiben Deutsch. Sprachwechsel erhalten Entwürfe, Rechenverlauf und technische Ein-/Ausgaben;
REST-Anfragen werden dadurch nicht erneut gesendet. Wiki-Datumsanzeigen und REST-Bytezahlen
verwenden das passende deutsche bzw. englische Format.

Im angemeldeten API-Modus ist rechts unten ein KI-Assistent integriert. Er verwendet
das bestehende Theme und die Sprachwahl, streamt Antworten und bietet „Stoppen“.
Öffnen allein erzeugt keinen Modellaufruf. Entwürfe und laufende Antworten bleiben
beim Schließen und beim Modulwechsel erhalten; Abmelden oder Neuladen entfernt
den Chat aus der Ansicht. Neue Gespräche verlangen bei vorhandenem Verlauf eine
Bestätigung. Fehler behalten den Entwurf und bieten das Nachladen des bestätigten
Verlaufs, ohne automatische Modellwiederholung. Antworten sind sicherer Text.
Der Assistent kann gespeicherte Projekte, deren Aufgabenstand und offene Aufgaben
des angemeldeten Kontos lesen. Aufklappbare Quellenkarten zeigen den tatsächlichen
Lesezugriff, Kennungen, begrenzte Ergebnisse und Abrufzeit. Die Oberfläche weist auf
die Weitergabe abgefragter Projektdaten an OpenAI hin. Mehrdeutige Projektnamen
werden zur Klärung angezeigt.

Der Chat berücksichtigt die aktuelle Modul-/Seitenroute und das sichtbar geöffnete Projekt
samt Tab. „Welche Aufgaben sind hier offen?“ kann sich damit auf dieses Projekt beziehen.
Das Eingabefeld zeigt den Seitenbezug; gesendete Nachrichten behalten ihren eigenen Bezug,
auch bei späterem Navigieren. Beim Wechsel zur Übersicht oder zu anderen Modulen wird das
alte Projekt nicht weitergegeben. Das Backend prüft Projektkennungen unter dem angemeldeten
Konto; bei nicht verfügbaren/noch ungespeicherten Projekten bleibt die Nachricht als Entwurf.
Suchparameter, Wiki-/Dev-Tools-Editoren und Formularinhalte werden nicht automatisch geteilt.
Wiki und Dev Tools erhalten damit Hilfe zur Seite, ohne Zugriff auf deren private Eingaben.
Der Hinweis nennt auch die Weitergabe des Seitenbezugs an OpenAI. Schreibaktionen folgen später.
Details: [ai-assistant.md](ai-assistant.md).

Der Assistent kann außerdem vorschlagen, ein eigenes Projekt, seine Aufgabenliste oder Kanban
zu öffnen. Eine Aktionskarte zeigt das konkrete Ziel; erst „Bestätigen und öffnen“ erteilt
die einmalige Backend-Freigabe. „Ablehnen“ verwirft den Vorschlag. Offene Formulare und
ungespeicherte Kontoeingaben blockieren den Wechsel. Die Karte zeigt Erfolg, Fehler oder
eine noch unbestätigte Ausführung. Vorschläge gelten fünf Minuten und werden beim Laden
nicht automatisch ausgeführt. Freigabe und Rückmeldung verursachen keine Modellanfrage.

Mehrstufige Fragen können mehrere lesende Werkzeugaufrufe verbinden, etwa Projektübersicht
und offene Aufgaben zweier Projekte. Der Chat zeigt den aktuellen Schritt und nummerierte
Ergebniskarten. Standardmäßig sind höchstens vier Werkzeugschritte erlaubt; anschließend
fasst der Assistent die tatsächlich gelesenen Daten zusammen. „Stoppen“ beendet die ganze
Folge. Bei Fehlern bleiben Eingabe und bestätigter Verlauf erhalten; unbestätigte Ergebnisse
werden verworfen und keine weiteren Anfragen automatisch ausgelöst.

Unter „Unterhaltungen“ können eigene gespeicherte Chats erneut geöffnet und ihre letzten
50 Ausführungsläufe mit Status und Werkzeugschritten angesehen werden. Die Liste nennt
Speicherart und Aufbewahrungsfrist. Ein Wechsel mit ungesendetem Entwurf und das endgültige
Löschen verlangen eine Bestätigung. Löschen entfernt auch die Ausführungshistorie.
Im PostgreSQL-Profil bleiben Chats nach Neuladen, Abmelden und Backend-Neustart gespeichert;
nach erneuter Anmeldung werden sie über die Liste geöffnet. Im Memory-Profil sind sie flüchtig.
Öffnen, Auflisten, Ausführungen ansehen und Löschen verursachen keine Modellanfrage.
Laufende Chats können gelesen werden; bis zum Ende und manuellen Nachladen bleiben neue
Nachrichten/Freigaben gesperrt. Unterbrochene Läufe werden nicht automatisch fortgesetzt,
alte Aktionskarten niemals automatisch ausgeführt. Es werden keine Chatdaten im Local Storage
oder Session Storage abgelegt. Vor dem M8-Update flüchtige Chats werden nicht importiert.
