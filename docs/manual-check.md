# Manuelle Funktionsprüfung

Für kompakte Dev Tools und private REST-Collections siehe die zusätzliche Prüfliste
in [browser-check.md](browser-check.md) und [Funktionsbeschreibung](rest-collections.md).

Diese Liste beschreibt manuell auszuführende Prüfungen; sie bestätigt keine durchgeführte Browserprüfung.

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
