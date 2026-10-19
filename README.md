# Dev Suite

Anwendung mit React 18, TypeScript, Vite und styled-components sowie vorbereitetem Java-/Spring-Boot-Backend.

## Entwicklung

Frontend und Backend liegen getrennt unter `frontend/` und `backend/`.
`frontend/` enthält React-Code, öffentliche Assets, Vite-/TypeScript-/ESLint-Konfiguration,
die Frontend-Umgebungsdateien und die Frontend-Tests. Gemeinsame Betriebsskripte bleiben
unter `scripts/`, Dokumentation unter `docs/`.

Die folgenden npm-Befehle werden weiterhin im Projektverzeichnis ausgeführt. npm Workspaces
verwalten die Frontend-Abhängigkeiten über die gemeinsame `package-lock.json` und
`node_modules/` im Hauptordner. Für eine Installation exakt nach Lockdatei `npm ci` verwenden.
Die Befehle `dev`, `lint`, `test`, `build` und `preview` funktionieren auch direkt in `frontend/`.

Frontend und Backend liegen getrennt unter `frontend/` und `backend/`.
`frontend/` enthält React-Code, öffentliche Assets, Vite-/TypeScript-/ESLint-Konfiguration,
die Frontend-Umgebungsdateien und die Frontend-Tests. Gemeinsame Betriebsskripte bleiben
unter `scripts/`, Dokumentation unter `docs/`.

Die folgenden npm-Befehle werden weiterhin im Projektverzeichnis ausgeführt. npm Workspaces
verwalten die Frontend-Abhängigkeiten über die gemeinsame `package-lock.json` und
`node_modules/` im Hauptordner. Für eine Installation exakt nach Lockdatei `npm ci` verwenden.
Die Befehle `dev`, `lint`, `test`, `build` und `preview` funktionieren auch direkt in `frontend/`.

- `npm install` installiert die Abhängigkeiten.
- `npm run dev` startet die lokale Entwicklungsumgebung.
- `npm run lint` prüft den Code mit ESLint.
- `npm test` prüft Sprint-Planung, Dateiaktionen, Wiki, Dev Tools, benutzerspezifische Einstellungen und Projektgrenzen mit dem Node-Test-Runner.
- `npm run build` prüft TypeScript und erstellt `frontend/dist/`.
- `npm run preview` zeigt den Produktionsbuild an.

Unter Windows kann `npm.cmd` verwendet werden, falls PowerShell `npm.ps1` blockiert.

Für den eingerichteten lokalen PostgreSQL-Betrieb: einmal `npm.cmd run setup:local`,
danach `npm.cmd run start:local`. `npm.cmd run backup:local` erstellt eine Datenbanksicherung.
Die [lokale Betriebsanleitung](docs/local-operation.md) beschreibt verschlüsselte
Verbindungseinstellungen, Start/Stop, Sicherung und Wiederherstellung in eine neue Datenbank.

## Backend-Vorbereitung

Der lokale Modus (`VITE_DATA_MODE=local`, Vorgabe) bleibt ohne Server mit Beispieldaten nutzbar.
Der API-Modus (`VITE_DATA_MODE=api` in `frontend/.env.local`) verwendet die zentrale HTTP-Schicht und
verlangt eine vom Backend bestätigte Anmeldung. Vite nach Änderungen an `frontend/.env.local` neu starten.

Das Gerüst unter `backend/` verwendet Java 21, Spring Boot, Spring Security und serverseitige
BCrypt-Prüfung. Es bietet Cookie-Sitzungen mit CSRF-Schutz, kontobezogene Einstellungen und
Workspace-Synchronisation für Projekte, Kunden, Aufgaben, Epics, Sprints, Aktivitäten, Dateien
und Wiki. Lade-/Speicherfehler und parallele Änderungen werden in der Oberfläche angezeigt.
Dev-Tools-Eingaben und offene Entwürfe bleiben lokal.

Unter Einstellungen stehen Profil- und Passwortänderung sowie für den Administrator
Benutzeranlage und Aktivierung/Deaktivierung bereit. Konto-Deaktivierung erhält die Daten.
Die [Browser-Prüfliste](docs/browser-check.md) enthält die noch offene visuelle Verifikation.

**Zwei Backend-Profile:** Ohne installierte Datenbank startet standardmäßig `memory` mit
flüchtigen Fachdaten und Dateien. Das optionale Profil `postgres` speichert Konten, Fachdaten,
Dateien und Einstellungen über JPA/Flyway in PostgreSQL. PostgreSQL kann später direkt auf
dem lokalen PC installiert werden; Docker ist nicht erforderlich. Sitzungen bleiben in beiden
Profilen flüchtig. Es gibt kein eingebautes Passwort; das erste Konto wird aus Startvariablen eingerichtet.

- [Backend starten und PostgreSQL später lokal einrichten](backend/README.md)
- [Endpunkte und Frontend-Architektur](docs/backend-api.md)
- [OpenAPI-Vertrag](docs/openapi.json)

`mvn -f backend/pom.xml test` prüft das Backend. Unter Windows kann alternativ
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-backend.ps1` verwendet werden;
dies lädt Java und Maven in einen temporären Projektordner und prüft deren Archiv-Prüfsummen.

## Aktueller Frontend-Stand

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
Die Anbindung je Benutzer ist in [docs/user-settings.md](docs/user-settings.md) beschrieben.

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

## Manuelle Funktionsprüfung

1. Zwischen Dashboard, Projekten, Kunden und den Modulen wechseln; Browser-Zurück/Vorwärts prüfen.
2. Ein Projekt anlegen, über die Suche finden und öffnen. Unter Einstellungen Namen, Kunden,
   Deadline und Planungsstand ändern; danach die Angaben in der Übersicht prüfen.
3. Beim Anlegen eines Projekts einen neuen Kunden erstellen. Prüfen, dass dieser ausgewählt
   wird und die übrigen Projektangaben erhalten bleiben. Den Vorgang auch abbrechen.
4. Direkt in der Kundenübersicht einen Kunden anlegen, suchen und bearbeiten. Pflichtfelder,
   ungültige E-Mail und reine Leerzeichen prüfen; Abbrechen darf keine Daten ändern.
5. Einen Kunden mit Projekten prüfen: Löschen ist gesperrt. Die Projekte von der Kundenkarte
   öffnen und über die Projekteinstellungen einem anderen Kunden zuordnen. Anschließend den
   nicht mehr verwendeten Kunden löschen; zuvor auch den Löschdialog abbrechen.
6. Eine Aufgabe anlegen oder ändern, zur Übersicht, zu einem anderen Projekt und zu einem
   anderen Modul wechseln, dann zurückkehren. Die Aufgabe muss erhalten bleiben; Aktivitäten
   dürfen nur beim zugehörigen Projekt erscheinen.
7. Ein Projekt mit Aufgaben löschen und ein neues anlegen. Aufgaben des gelöschten Projekts
   dürfen beim neuen Projekt nicht erscheinen. Auch den Fall ohne Projekte und Kunden prüfen.
8. Kundendialog per Escape schließen und Tastaturfokus/Tab-Reihenfolge prüfen. Eine unbekannte
   Hash-URL aufrufen: Die Anwendung muss zum Dashboard zurückkehren, ohne Sitzungsdaten zu verlieren.
9. Im Epics-Tab ein Epic mit Beschreibung und vorhandenen Aufgaben anlegen. Pflichtfeld, reine
   Leerzeichen, Suche, Abbrechen und Escape prüfen. Im Tasks-Tab die Epic-Zuordnung kontrollieren.
10. Eine Aufgabe über das Aufgabenformular einem anderen Epic zuordnen oder die Zuordnung lösen.
    Den Wechsel auch im Epic-Formular testen: Änderungen dürfen erst beim Speichern wirksam werden.
    Aufgaben anderer Projekte dürfen nicht auswählbar sein.
11. Aufgaben im Board auf erledigt setzen und den Epic-Fortschritt sowie den Fortschrittsfilter
    prüfen. Ein Epic ohne Aufgaben hat 0 Prozent; ein Epic mit ausschließlich erledigten Aufgaben
    ist abgeschlossen. Auch das Bearbeiten einer Aufgabe aus dem Board heraus prüfen.
12. Ein Epic bearbeiten und löschen; zuvor den Löschdialog abbrechen. Nach dem Löschen müssen
    seine Aufgaben ohne Epic erhalten bleiben. Epic-Aktivitäten müssen im richtigen Projekt
    erscheinen. Projekt-/Modulwechsel und Löschen eines ganzen Projekts auch mit Epics prüfen.
13. Einen Sprint mit Titel, Ziel und Zeitraum anlegen. Ein Enddatum vor dem Startdatum und reine
    Leerzeichen im Titel dürfen nicht gespeichert werden. Abbrechen und Escape dürfen nichts ändern.
14. Offene Aufgaben direkt aus dem Backlog und im Sprint-Formular einplanen. Zwischen geplanten
    Sprints verschieben; Epic-Zuordnungen müssen erhalten bleiben. Aufgaben anderer Projekte und
    Aufgaben eines anderen aktiven Sprints dürfen nicht zugeordnet werden.
15. Einen Sprint starten, einen zweiten Start im selben Projekt prüfen und im Board nach dem
    aktiven Sprint filtern. Ein leeres Sprint-Board und ein leeres Backlog müssen sinnvoll erscheinen.
16. Aufgaben teilweise erledigen und den Sprint abschließen; zuvor auch den Dialog abbrechen.
    Offene Aufgaben müssen ins Backlog zurückkehren. Erledigte Aufgaben bleiben im gespeicherten
    Sprint-Ergebnis sichtbar. Aufgaben anschließend ändern/löschen oder wieder öffnen: Das historische
    Ergebnis darf sich nicht verändern, wieder offene Aufgaben müssen neu planbar sein.
17. Geplante und abgeschlossene Sprints löschen; aktive Sprints müssen geschützt bleiben. Aufgaben
    bleiben erhalten. Projekt-/Modulwechsel, Projektlöschung und leere Zustände auch mit Sprints prüfen.
18. Mehrere Dateien über die Auswahl und per Drag-and-drop im Dateien-Tab hinzufügen. Leere Dateien,
    unbekannte Dateitypen und Umlaute im Namen prüfen. Doppelte Namen müssen ohne Überschreiben
    gemeldet werden. Derselbe Name muss in einem anderen Projekt möglich sein.
19. Dateisuche, Dateitypfilter und alle Sortierungen prüfen. Dateien herunterladen, umbenennen und
    erneut herunterladen: Inhalt und Dateiendung müssen erhalten bleiben. Beim Umbenennen leere
    Namen, Pfadtrenner und vorhandene Namen prüfen; Abbrechen und Escape dürfen nichts ändern.
20. Eine Datei nach abgebrochener Bestätigung entfernen und erneut hinzufügen. Die Originaldatei
    auf dem Gerät muss erhalten bleiben. Projekt-/Modulwechsel und Projektlöschung prüfen;
    Aktivitäten und Dateien dürfen nur im zugehörigen Projekt erscheinen. Beim Neuladen müssen
    alle hinzugefügten Dateien wie im Hinweis beschrieben aus der Anwendung verschwinden.
21. Unter Einstellungen zwischen hellem und dunklem Design wechseln. Navigation, Projektliste,
    Board, Formularfelder, Dialoge, Fehlermeldungen und Status-Badges in beiden Designs prüfen.
    Projekte, Aufgaben, Epics, Sprints und Dateien müssen erhalten bleiben.
22. Als Startansicht die Projektliste auswählen, zu Wiki und dann über die Seitenleiste zurück
    zum Project Manager wechseln. Die Projektliste muss erscheinen, auch wenn zuvor ein Projekt
    geöffnet war. Dashboard-Vorgabe, direkte Seitenlinks und unbekannte URLs ebenfalls prüfen.
23. Die Standardpriorität auf Hoch setzen und ein neues Aufgabenformular öffnen. Hoch muss
    vorbelegt sein. Eine vorhandene Aufgabe muss beim Bearbeiten ihre bisherige Priorität behalten.
    Einen offenen Entwurf manuell auf Niedrig setzen, die Standardpriorität ändern und zum Entwurf
    zurückkehren: Die manuelle Auswahl muss erhalten bleiben. Erst ein neu geöffnetes Formular
    verwendet die neue Vorgabe.
24. Die Einstellungen zurücksetzen. Dunkles Design, Dashboard und mittlere Priorität müssen
    wieder gelten, während sämtliche Sitzungsdaten erhalten bleiben. Einstellungen per Tastatur
    bedienen und anschließend das Verhalten beim Neuladen prüfen.
25. Beim Start prüfen, dass die Anwendung nach dem Laden der Einstellungen erscheint und die
    Navigation die geladene Startansicht verwendet. Mehrere Einstellungen schnell nacheinander ändern;
    der neueste Stand muss erhalten bleiben. Fehlerpfade und getrennte Benutzerkennungen werden
    derzeit über die automatisierten Tests mit austauschbaren Speicher-Implementierungen geprüft.
26. Im Wiki einen Artikel mit Titel, Kategorie und Inhalt anlegen. Leere Pflichtfelder und reine
    Leerzeichen dürfen nicht gespeichert werden. Vorschau mit Überschriften, Absätzen, Listen und
    Codeblöcken prüfen; HTML muss sichtbar bleiben und darf nicht ausgeführt werden. Nach dem
    Speichern müssen Artikelansicht, Übersicht und Startseite den neuen Stand zeigen.
27. Einen Artikel bearbeiten, zu Kategorien, zur Artikelliste und zum Project Manager wechseln.
    Zum Artikel zurückkehren und den Entwurf fortsetzen: Alle Eingaben müssen erhalten bleiben.
    Dasselbe mit einem neuen Artikel prüfen. Entwurf verwerfen darf den gespeicherten Artikel nicht
    ändern. Eine Artikel-Löschung zuerst abbrechen, dann bestätigen; der eigene Entwurf muss dabei
    ebenfalls entfernt werden. Die alte Artikeladresse muss danach einen Hinweis zeigen.
28. Kategorien anlegen, suchen und umbenennen. Gleiche Namen mit anderer Großschreibung oder
    Unicode-Schreibweise müssen abgelehnt werden. Löschen zuerst abbrechen, dann Artikel in eine
    andere Kategorie verschieben; Titel und Inhalte müssen erhalten bleiben. Auch Löschen ohne
    Zielkategorie und mit einem offenen Artikelentwurf prüfen.
29. Artikel nach mehreren Begriffen suchen und nach Kategorie filtern. Alle Sortierungen, Artikel
    ohne Kategorie und leere Ergebnisse prüfen. Einen Treffer öffnen und Browser-Zurück verwenden:
    Suche und Filter müssen wieder gelten. Direkte Artikel-/Bearbeitungsadressen sowie ungültige
    und gelöschte IDs prüfen. Wiki-Inhalte müssen beim Modulwechsel erhalten bleiben und beim
    Neuladen wie im Hinweis beschrieben auf die Beispieldaten zurückgesetzt werden.
30. Wiki-Karten, Editor, Vorschau, lange Texte, Codeblöcke und Dialoge im hellen und dunklen Design
    sowie bei schmalem Fenster prüfen. Tastaturbedienung, Pflichtfelder, Escape und Fokus nach dem
    Schließen eines Dialogs kontrollieren.
31. Im JSON Formatter verschachtelte Objekte, Arrays, leere Container, skalare Werte, Strings mit
    Escape-Sequenzen und Ganzzahlen größer als `9007199254740991` prüfen. Mit allen Einrückungen
    formatieren, komprimieren, validieren und kopieren. Ungültiges JSON muss einen Fehler ohne
    alte Ausgabe zeigen; Leeren muss Eingabe, Ausgabe und Meldungen zurücksetzen.
32. Im REST-Test einen eigenen Testserver mit CORS-Freigabe verwenden. GET/HEAD ohne Body und
    POST/PATCH mit JSON-/Text-Body und eigenen Headern prüfen. Ungültige Adresse, Header und
    JSON müssen vor dem Senden erkannt werden. HTTP-Fehlerstatus muss samt Body sichtbar bleiben.
    Antwort-Header, Rohtext, JSON-Formatierung, Kopieren und eine Antwort ohne Body prüfen.
33. REST-Anfragen an einen langsamen Test-Endpunkt abbrechen und mit kurzem Zeitlimit beenden.
    Netzwerk-/CORS-Fehler prüfen sowie Antworten über 2 MiB: Die Anzeige muss auf die Begrenzung
    hinweisen. Während einer Anfrage Ansichten und Module wechseln; es darf keine weitere Anfrage
    ausgelöst werden. Nach Rückkehr muss die laufende oder abgeschlossene Anfrage sichtbar sein.
34. Im Rechner `2 + 3 * 4`, `(2 + 3) * 4`, `2^3^2`, `-2^2`, `2^-3`, `17 % 5` und
    `(12,5 + 7.5) * .5` per Tastatur/Enter und Rechentasten prüfen. Division durch null,
    Klammerfehler und JavaScript-Ausdrücke müssen abgewiesen werden. Verlauf übernehmen,
    Ergebnisse kopieren, Eingabe leeren und Verlauf separat löschen.
35. Text mit Umlauten, Emoji, Zeilenumbrüchen und Sonderzeichen über Base64 und URL-Kodierung
    hin und zurück umwandeln. Ungültige Base64-/UTF-8-Daten und Prozent-Escapes müssen Fehler
    zeigen. Einheiten inklusive Celsius/Fahrenheit/Kelvin, absolutem Nullpunkt sowie MB/MiB
    prüfen. Große und negative Ganzzahlen zwischen Zahlensystemen umrechnen; falsche Ziffern
    dürfen kein Ergebnis liefern.
36. In allen vier Dev Tools Eingaben machen, Ansichten und Module wechseln und zurückkehren.
    Eingaben, Ergebnisse und Rechnerverlauf müssen erhalten bleiben. Helles/dunkles Design,
    schmale Fenster, lange Antworten und Tastaturbedienung prüfen. Beim Neuladen müssen die
    Werkzeuge wie angekündigt zurückgesetzt werden. Es darf keine HTTP-Anfrage automatisch starten.
37. Im API-Modus ohne gültige Sitzung starten: Die Anmeldung muss erscheinen. Falsche Anmeldedaten,
    ein nicht erreichbares Backend, korrektes Login, Seiten-Neuladen und Logout prüfen. Nach Logout
    oder Sitzungsablauf dürfen keine Daten des vorherigen Kontos mehr sichtbar sein.
38. Alle Fachfunktionen im API-Modus prüfen, speichern und neu laden. Eine kleine Datei hochladen,
    umbenennen und nach Neuladen herunterladen. Bytes müssen erhalten bleiben. Speicherfehler dürfen
    keine erfolgreiche Synchronisation anzeigen; Wiederholen muss möglich sein. Ohne Anmeldung darf
    der Datei-Endpunkt keinen Inhalt liefern.
39. Dasselbe Konto in zwei Fenstern öffnen. Im ersten speichern, im zweiten ändern: Das zweite Fenster
    muss einen Versionskonflikt melden. Serverstand laden zuerst abbrechen, danach bestätigen.
    Ungespeicherte Änderungen dürfen nur nach Bestätigung verworfen werden. Auch Abmelden während
    unbestätigter Änderungen prüfen.

Die Tests liegen als `sprintLogic.test.ts`, `fileLogic.test.ts`, `wikiLogic.test.ts`,
`jsonLogic.test.ts`, `calculatorLogic.test.ts`, `converterLogic.test.ts`, `restLogic.test.ts` und
`settingsStore.test.ts` neben der getesteten Logik. REST-Tests verwenden simulierte Antworten
einschließlich Streams, Fehlern und Abbruch; es werden keine externen Server kontaktiert.
Weitere Tests unter `frontend/src/services/` prüfen API-/CSRF-Verhalten, Sitzungswechsel, Synchronisation,
Dateiübertragung und Konflikte. Spring-Integrationstests liegen unter `backend/src/test/`.
`npm test` verwendet den vorhandenen TypeScript-Compiler und den eingebauten Node-Test-Runner ohne
weitere Abhängigkeiten. Temporäre JavaScript-Dateien werden unter `frontend/node_modules/.tmp/feature-tests/` erzeugt. `npm run build`
prüft auch die Typen der Tests. Vor der Abgabe sind zusätzlich ESLint, Produktionsbuild und eine
manuelle Browserprüfung vorgesehen.
