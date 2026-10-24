# Browserprüfung des lokalen PostgreSQL-Betriebs

## Kompakte Dev Tools und REST-Collections

Manuell offen, keine automatisierte visuelle Abnahme:

- JSON Formatter bei 1440, 1024 und 390 px in hell/dunkel prüfen. Kleinere Schrift und
  kürzere Editoren, Einrückungswahl und Buttons bündig, auf Mobilgeräten kein Überlauf.
  JSON mit großen Zahlen/Unicode formatieren, komprimieren und kopieren.
- REST öffnen: Collection-Leiste links (mobil oben), Methode/URL/Senden kompakt.
  Header/Body/Optionen per Mausklick, Tab und Pfeiltasten wechseln. Versteckte Panels
  sind nicht per Tab erreichbar; Fokus bleibt sichtbar. DE und EN prüfen.
- Collection anlegen, umbenennen und suchen. Eine POST-Anfrage samt Header, JSON-Body
  und Zeitlimit speichern, grünen Hinweis abwarten. Neu laden/anmelden und aus der
  Collection öffnen. Dabei darf im Browser-Netzwerk kein Aufruf des Zielservers erfolgen.
- Geladene Anfrage ändern/speichern; „Speichern unter …“ legt eine eigene Kopie an.
  Neue Anfrage/andere Anfrage bei ungespeicherten Änderungen: Abbrechen erhält Eingaben,
  bestätigtes Verwerfen lädt. Löschdialog für Anfrage/ganze Collection ebenfalls abbrechen
  und bestätigen. Nach dem Löschen gespeicherte Datensätze erneut laden und prüfen.
- Zwei Browser-Sitzungen desselben Kontos: eine speichert, zweite meldet beim Speichern
  Versionskonflikt und erhält Eingaben. Explizit neu laden, geänderte Anfrage laden oder
  Kopie speichern. Offline/503: Grund sichtbar, kein Erfolgshinweis, kein automatischer PUT.
- Abmelden und mit anderem Konto anmelden: keine alten Collections, Header oder Bodies.
  Workspace ändern und Backend neu starten: PostgreSQL-Collections bleiben erhalten.
  Memory-Profil und lokale Vorschau sind ausdrücklich flüchtig.
- Erst „Anfrage senden“ führt Browser-HTTP aus; CORS-Fehler, Abbruch und Zeitlimit bleiben
  sichtbar. Ausschließlich eigene Testziele und synthetische Header verwenden.

## Kompakte Projektleiste

- Projektliste und Dashboard: kein großer „Projekt anlegen“-Button oder dauerhaftes
  Suchfeld oberhalb des Rahmens. Leicht aufgehellte Leiste mit Mappen-Icon/„Neu“, Lupe,
  Zähler und kompakteren Abständen; auch hell/dunkel und schmale Fenster prüfen.
- Lupe per Maus/Tastatur öffnen: Suchfeld klappt nach rechts auf, Cursor steht im Feld.
  Suche nach Projektname und Kunde; Zähler/leere Trefferliste stimmen. „Neu“ bleibt erreichbar.
- Escape oder erneuter Lupenklick schließt/leert die Suche und fokussiert die Lupe;
  alle Projekte sind wieder sichtbar. Eingeklapptes Feld ist nicht per Tab erreichbar.
- Neu öffnet das vorhandene Projektformular. Öffnen/Schließen/Filtern verändert keine
  Projektdaten. KI-Navigation bleibt bei offenem Formular blockiert. DE/EN prüfen:
  der Button heißt „Neu“/„New“, KI-Änderungskarten „Bisher“/„Nachher“ bzw. Before/After.
- Reduzierte Bewegung deaktiviert die Aufklappanimation. Sichtbare Fokusringe und lange
  Projektnamen prüfen. Diese Liste ist keine bereits durchgeführte visuelle Abnahme.

## Dokumentationsbereiche und Seiten

Manuelle Prüfliste; keine bereits durchgeführte visuelle Abnahme. [Details](documentation.md).

- Bestehende Wiki-Artikel/Kategorien und alte Direktlinks öffnen; Daten bleiben erhalten.
  Dokumentationsübersicht, Bereichsauswahl, Suche und Sortierung in DE/EN prüfen.
- Bereich erstellen/bearbeiten. Seite und Unterseite anlegen; Bereich/Elternseite korrekt
  vorbelegen. Seitenbaum auf-/zuklappen, Direktlink neu laden, ausgewählten Pfad anzeigen.
- Breadcrumbs, Unterseitenlinks, Inhaltsverzeichnis und Lesezeit prüfen. Inhaltsverzeichnis
  darf die Hashroute nicht ändern. Lange Titel/Inhalte, schmale Fenster und beide Themes testen.
- Jede Vorlage auf leerer neuer Seite ausprobieren. Formatierungsbuttons, Auswahl im Text,
  Tabelle, Vorschau, Code-Einrückung, HTML-Text und ungültige Linkschemata prüfen.
- Modul-/Sprachwechsel erhält Artikelentwurf und Text. Zwischenzeitliche Änderung verhindert
  Überschreiben. ID-Vergabe nach KI-Anlage, Abmeldung und Entwurfsverwerfen prüfen.
- Schleifen/zu tiefe/fremde Eltern ablehnen. Seite mit Unterseiten nicht löschen; zuerst
  Unterseiten verschieben. Bereich löschen ordnet alle Seiten mit ihrer Hierarchie neu zu.
- Speichern/Neuladen/Backend-Neustart erhält Hierarchie und Inhalte; anderes Konto bleibt
  getrennt. KI-Unterseite und Elternänderung erst nach Kartenfreigabe, Replay ohne Duplikat.
- Tastaturbedienung, Fokus, zugängliche Beschriftungen und globale Speicherfehler/-toasts prüfen.

## Sprache bei Login und erneutem Aufruf

- Ohne `forgeflow.language` und ohne Kontoeinstellungen: primäre Browserregion DE/AT/CH
  ergibt Deutsch; andere oder fehlende Region Englisch. `de` ohne Region ergibt Englisch.
- In Einstellungen auf Englisch wechseln, abmelden und Website erneut öffnen: Login,
  Sitzungsprüfung und Fehler bleiben Englisch. Danach Deutsch wählen und wiederholen.
- Gespeicherte Kontosprache nach Login übernehmen; ein anderes Konto behält seine eigene
  Sprache. Ohne gespeicherte Kontoeinstellungen die Browservorgabe verwenden.
- Gesperrten Local Storage prüfen: Login/Sprachwechsel funktionieren weiter; Persistenz
  über das Schließen der Seite hinaus ist dann nicht zugesichert. Dokument-`lang` prüfen.
- Dies ist eine manuelle Prüfliste, keine durchgeführte visuelle Browserabnahme.

## Kundendetails, Ansprechpartner und Notizen

Manuelle Prüfliste, keine visuelle Abnahme durch den Agenten. [Details](customer-details.md).

- Kunde per Name/„Details öffnen“ öffnen. Direktlink neu laden, Zurück und unbekannte Kennung prüfen.
  Nur Projekte und Kontakte dieses Kunden zeigen; Projekt öffnen führt zur vorhandenen Detailansicht.
- Zwei Ansprechpartner anlegen, einen bearbeiten und nach Bestätigung entfernen. Leerer Name/
  ungültige E-Mail werden abgewiesen, optionale Felder dürfen leer sein. Andere Kunden unverändert.
- Notiz mit Zeilenumbrüchen, Unicode und HTML-Text speichern; Text unverändert, kein HTML ausführen.
  Stammdaten bearbeiten darf Kontakte/Notiz nicht entfernen. Leere Notiz löscht den Text ausdrücklich.
- Neuladen und Backend-Neustart erhalten Details. Anderes Konto erhält keinen Zugriff.
  Aktiver Dialog blockiert KI-Freigaben; Sitzung wechseln entfernt offene Entwürfe.
- KI-Kontaktvorschlag ablehnen/bestätigen; vor Klick keine Datenanlage, Wiederholung keine Duplikate.
  Telefon/Notiz ändern: exakte Vorher-/Nachherkarte, zwischenzeitliche Revision meldet Konflikt.
  „Dieser Kunde“ ohne eindeutige Kennung verlangt Rückfrage, kein Projekt als Kunde behandeln.
- DE/EN, hell/dunkel, schmale Fenster, Tastaturfokus, Dialog-Scrollen und Notizlängen prüfen.


## Kundenformular und globale Branchen: manuelle Abnahme

Diese Punkte sind eine Prüfliste, keine bereits erfolgte visuelle Abnahme. Details: [customers.md](customers.md).

- Als Administrator globale Einstellungen öffnen, Branche hinzufügen/umbenennen und speichern.
  Die Kundenanlage bietet den gespeicherten Wert im Dropdown; ungespeicherte Entwürfe nicht.
- Normale Nutzer können auswählen/lesen, aber die globale Liste weder in der UI noch per API ändern.
- Kunde mit PLZ `01234` anlegen, neu laden, bearbeiten und nach Backend-Neustart prüfen;
  führende Null bleibt erhalten. Internationalen Wert `SW1A 1AA` ebenfalls prüfen.
- Bei Bestandskunde ohne PLZ bleibt der Datensatz lesbar; Bearbeitungsformular verlangt die PLZ.
- Branchenwert aus Katalog entfernen: gespeicherter Kunde unverändert, bisheriger Wert sichtbar.
- Parallele globale Listenänderung meldet Konflikt; keine automatische Wiederholung. Neu laden
  verwirft einen offenen Entwurf nur über den entsprechend beschrifteten Button.
- Katalog-Ladefehler bietet Wiederholen und keine Beispielwerte. Ausloggen während einer Anfrage
  darf keine Antworten ins nächste Konto übernehmen.
- DE/EN, hell/dunkel, schmale Fenster, Scrollen, Tastaturfokus und Pflichtstern auf einer Zeile prüfen.


## Neue KI-Änderungen: manuelle Abnahme

Diese Fälle sind eine Prüfliste, keine Behauptung einer visuellen Abnahme durch den Agenten.
Umfang: [ai-updates.md](ai-updates.md). Nach vollständigem Update Strg+F5 und neu anmelden.

- Neue Kunden/Projekte weiterhin über „Bestätigen und anlegen“ erstellen; ohne Klick keine Anlage.
- Vorhandenen Kundenort, Projektdeadline und Aufgabenstatus ändern lassen. Karte zeigt alte/neue
  Werte und Kennung; Ablehnen verändert nichts, Bestätigen speichert genau einmal.
- Nicht genannte Felder erhalten: etwa Aufgabenbeschreibung beim Statuswechsel und lange
  Wiki-Inhalte beim reinen Umbenennen. Keine vollständige Datenersetzung durch Teiländerungen.
- Zwischen Vorschlag und Freigabe denselben Workspace regulär bearbeiten: alte Karte meldet
  Konflikt und überschreibt nichts. Offene Formulare/ausstehende Speicherungen blockieren Freigaben.
- Epic/Sprint-Aufgaben aus anderem Projekt, Kontoänderung, aktiven/abgeschlossenen Sprint und
  ungültige Status-/Datumswerte abweisen. Doppelte Namen verlangen #ID.
- Datei umbenennen und anschließend herunterladen: gleiche Bytes, neuer Name; vorhandene
  Dateinamen, Pfadseparatoren und Überschreiben von Inhalten bleiben geschützt.
- DE/EN und beide Themes prüfen. Texte mit HTML als Text darstellen. Kein Passwortfeld bei Updates.
- Verlauf erneut öffnen, Seite neu laden und Entscheidung wiederholen: gespeicherten Status zeigen,
  keine neue Änderung/Modellanfrage. Verbindung beim Bestätigen unterbrechen und nur nachlesen.
- Alter Chat bleibt lesbar. Neue Änderungschats verwenden Format 3; alte JARs lesen sie nicht.


Status beim Implementierungsdurchlauf vom 19. Oktober 2026:
Der Benutzer hat Speicherung und Neustartfestigkeit von Kunden/Projekten bestätigt.
Für diesen Durchlauf war kein Browser mit dem Agenten verbunden; der Versuch, einen
In-App-Browser zu öffnen, meldete "Browser is not available: iab".
Die nachstehenden Punkte sind deshalb eine offene manuelle Prüfliste, keine ausgeführten
visuellen Tests. API-/Fachlogiktests sind separat in HANDOFF.md dokumentiert.

Vorbereitung: Ein Administrator meldet sich an und legt in den Einstellungen ein
eigenes Testkonto an. Die Fachprüfungen mit diesem Konto durchführen, damit der eigene
Arbeitsbereich unverändert bleibt. Die vollständige bisherige Prüfliste steht zusätzlich
in [manual-check.md](manual-check.md).

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

- Einstellungstab öffnen: eigenes Menü mit Nutzerverwaltung, Optik, Projektmanager,
  Sprache. Es ist jeweils nur der gewählte Bereich sichtbar. Direktlinks mit `category`
  und Browser-Zurück/Vor prüfen; unbekannte Kategorie muss Optik anzeigen.
- Unfertige Kontoeingaben beim Wechsel Optik → Nutzerverwaltung erhalten; keine
  unbeabsichtigte Formularübermittlung beim Menüwechsel.
- Sprache auf English stellen: Menü und Einstellungsformulare wechseln sofort;
  Benutzerinhalte bleiben unverändert. Sprache nach Neuanmeldung und Backend-Neustart
  prüfen. Wiki und Dev Tools wechseln ebenfalls; andere Projektmanager-Inhalte bleiben Deutsch.
- Projektmanager-Vorgaben und Theme nach dem Sprachwechsel unverändert; Zurücksetzen
  setzt auch Sprache auf Deutsch. Menüposition und Formulare im schmalen Fenster prüfen.
- Profilname ändern; Header muss den bestätigten Namen zeigen.
- E-Mail mit falschem aktuellem Passwort ändern: Fehler, keine Änderung.
- E-Mail mit richtigem Passwort ändern: eigenes Konto und eigene Daten bleiben erhalten.
  Eine vorher geöffnete zweite Sitzung muss ungültig werden.
- Passwort mit weniger als 12 Unicode-Zeichen, mehr als 72 UTF-8-Bytes, falscher
  Bestätigung oder falschem aktuellem Passwort: Fehler direkt im Passwortformular.
  Bei weit nach unten gescrollter Seite muss die Fehlermeldung sichtbar werden und
  Tastaturfokus erhalten, auch beim wiederholten Absenden derselben ungültigen Eingabe.
  Bei lokaler Validierung darf keine Passwort-Anfrage gesendet werden.
- Während der Passwort-Anfrage steht am deaktivierten Button „Passwort wird geändert …“.
  Bei einem Serverfehler bleiben die Eingaben zur Korrektur erhalten. Blockieren ausstehende
  Fach-/Einstellungsänderungen die Aktion, muss der Grund auch am Passwortformular stehen.
- Passwort erfolgreich ändern: alle alten Sitzungen verlieren Zugriff; neues Passwort
  ermöglicht Login, altes Passwort nicht. Fachbestand bleibt unverändert.
- Als normaler Benutzer dürfen weder Kontoliste noch Administratoraktionen sichtbar oder
  über direkte API-Aufrufe erlaubt sein.
- Als Administrator ein weiteres Testkonto anlegen. Doppelte E-Mail muss abgewiesen werden.
- Bei zu kurzem Passwort oder abweichender Bestätigung beim Anlegen muss eine fokussierte
  Fehlermeldung direkt im Benutzerformular stehen; es darf keine Anlage-Anfrage erfolgen.
  Auch eine später eintreffende Kontoliste darf den Fehler nicht entfernen.
  Bei Serverfehlern bleiben die Eingaben erhalten; erfolgreiche Anlage wird direkt am
  Formular bestätigt. Während der Anfrage ist „Benutzer wird angelegt …“ sichtbar.
- Das Testkonto deaktivieren: dessen bestehende Sitzung verliert Zugriff. Reaktivieren:
  Login funktioniert wieder und die bisherigen Daten bleiben vorhanden.
- Das Administratorkonto darf nicht über die Oberfläche deaktiviert werden.
- Während unbestätigter Fach-/Einstellungsänderungen dürfen Kontodaten nicht geändert werden.
- Mit hellem und dunklem Theme sowie schmalem Fenster die neuen Formulare und Dialoge prüfen.

## Sprachwechsel in Wiki und Dev Tools

- Sprache in den Einstellungen auf Englisch stellen. Wiki- und Dev-Tools-Navigation,
  Titel, Formulare, Platzhalter, Meldungen und Dialoge prüfen; auf Deutsch zurückwechseln.
- Eigenen Wiki-Artikel mit deutschem Titel/Inhalt sowie eigenem Kategorienamen öffnen.
  Nur die Oberfläche darf übersetzt werden. Datumsanzeigen müssen die gewählte Sprache nutzen.
- Artikelentwurf ausfüllen, Vorschau öffnen, Sprache wechseln und Entwurf fortsetzen:
  Inhalt, Titel, Kategorie und Vorschauzustand müssen erhalten bleiben.
- JSON mit großen Zahlen und deutschen Zeichenfolgen formatieren und Sprache wechseln:
  Eingabe und Ausgabe dürfen sich nicht ändern. Auch nach einem Wechsel zum Rechner und zurück.
- Rechner mit Fehler und Verlauf, Konverter mit ungültigem Base64 bzw. ungültiger Ziffer
  prüfen. Vorhandene Fehler sollen sofort übersetzt werden, Eingaben und Ergebnisse bleiben erhalten.
- REST-Anfrage nur an einen eigenen Testendpunkt senden. Sprache wechseln: kein erneutes
  Senden, keine Veränderung von Headern, Body oder Antwortdaten. Antwortstatus, Fehlermeldungen,
  Bytezahl und Kopiermeldungen müssen zur Sprache passen. Abbruch und Timeout zusätzlich manuell prüfen.

## Speicherbenachrichtigungen

- Im API-Modus neu anmelden: kein dauerhaftes Synchronisationsfeld und kein Erfolgshinweis
  allein durch das Laden. Projekt/Kunde oder Wiki-Artikel ändern: nach bestätigter
  Speicherung grünes Häkchen mit Text unten rechts, ohne Layoutverschiebung.
- Nach fünf Sekunden verschwindet der Erfolg. Maus darüber oder Schließen-Button mit
  Tastatur fokussieren: Timer pausiert. Nach Verlassen läuft die Anzeigezeit erneut.
  Manuelles Schließen, mehrere schnelle Änderungen und Modulwechsel prüfen.
- Verbindung im Browser für einen Speicherversuch unterbrechen: roter Hinweis mit
  Ursache und Wiederholungsaktion. Er bleibt über fünf Sekunden hinaus sichtbar.
  Verbindung wiederherstellen und „Speichern wiederholen“: erst die Bestätigung des
  Backends ersetzt den Fehler durch Erfolg. Ungespeicherte Inhalte vorher erhalten.
- Dasselbe Konto in zwei Sitzungen bearbeiten: Versionskonflikt mit Ursache, ohne
  Wiederholungsaktion. „Serverstand laden“ verlangt Bestätigung. Abbrechen erhält
  den Entwurf, bestätigtes Verwerfen lädt ohne falsche Speicher-Erfolgsmeldung neu.
- Deutsch/Englisch, beide Themes, schmales Fenster, Tastatur und reduzierte Bewegung
  prüfen. Screenreader sollen neue Erfolge höflich und Fehler sofort ankündigen.
  Abmelden/Neuanmelden darf keine alten Hinweise übernehmen. Lokaler Datenmodus:
  keine behauptete Backend-Speicherung.

## KI-Chat-Widget (M3, manuell noch offen)

Diese Prüfungen nach dem gemeinsamen Chat-Update auf dem Server durchführen.
Gesendete Nachrichten können echte API-Kosten verursachen. Automatische lokale
Tests verwenden ausschließlich simulierte Modelle und lokale HTTP-Testserver.

- Nach Anmeldung rechts unten öffnen: kein Modellaufruf allein durch Öffnen.
  Eine kurze Nachricht senden: schrittweiser Text, Status, abschließend bestätigter
  Verlauf. Enter sendet, Shift+Enter erzeugt einen Zeilenumbruch.
- Während einer längeren Antwort schließen, das Modul wechseln und wieder öffnen:
  dieselbe Anfrage und Teilantwort bleiben erhalten. Keine zweite Modellanfrage.
  Mit „Stoppen“ abbrechen: Teilantwort verschwindet, Entwurf bleibt zum Bearbeiten.
  Bei einer bereits abgeschlossenen Antwort bleibt deren bestätigter Verlauf sichtbar.
- Während einer Antwort Verbindung unterbrechen: Fehlermeldung, keine automatisch
  erneut gesendete Nachricht. Verbindung herstellen und „Verlauf erneut laden“.
  Abmelden in einer zweiten Registerkarte muss die laufende Anfrage beenden.
- Neue Unterhaltung bestätigen/abbrechen; Sprachwahl Deutsch/Englisch in beiden
  Themes prüfen. Bei Sprachwechsel in einem vorhandenen Gespräch erscheint der
  Hinweis, für die neue Antwortsprache ein neues Gespräch zu beginnen.
- Schmales Fenster und Tastatur prüfen: Formular und Stoppen erreichbar, Escape
  schließt das fokussierte Widget, Fokus zurück zum Launcher. Speicherhinweise und
  Launcher sollen nebeneinander erreichbar sein. Reduzierte Bewegung respektieren.
- Seite neu laden und mit anderem Konto anmelden: keine alten Chatdaten anzeigen.
  Lokaler Datenmodus: kein Chat-Widget und keine KI-Anfragen.

## Lesende Projektwerkzeuge (M4, manuell noch offen)

- Nach dem gemeinsamen Update ein Konto mit gespeicherten Projekten verwenden.
  „Welche Projekte habe ich?“ fragen. Werkzeugzugriff und Quellenkarte aufklappen:
  ausschließlich eigene gespeicherte Projekte, richtige Kennungen und Aufgabenanzahlen.
- „Wie steht es um #ID?“ und „Welche Aufgaben sind in #ID noch offen?“ prüfen.
  Planung, Termin, todo/inProgress/done mit der Oberfläche vergleichen. Erledigte
  Aufgaben dürfen nicht in der Liste offener Aufgaben auftauchen. Quelle zeigt Abrufzeit.
- Bei mehr als zehn Einträgen nach der nächsten Seite fragen. Bei gleichem oder
  unvollständigem Projektnamen muss eine Auswahl/Klärung erfolgen. Eine unbekannte
  Kennung darf kein erfundenes Projekt liefern. Auch ein Administratorkonto sieht
  ausschließlich seine eigenen Daten.
- Während einer Abfrage stoppen oder abmelden: keine späteren Ergebnisse einer alten
  Sitzung übernehmen. Fehler erhalten den Entwurf. Keine automatische neue Modellanfrage.
- Normale Wissensfrage stellen: kein Werkzeugzugriff. Änderungen an Projekten anfragen:
  keine Schreibaktion ausführen. Relevanten Text mit HTML-Zeichen im Projektnamen prüfen:
  die Quellenkarte stellt ihn als Text dar. Deutsch/Englisch und beide Themes prüfen.
- Ein Formular vorübergehend ungespeichert lassen: die Abfrage verwendet weiterhin
  den gespeicherten Backend-Stand. Der Hinweis zur Weitergabe abgefragter Projektdaten
  an OpenAI muss sichtbar sein. Diese Modellanfragen können echte API-Kosten verursachen.

## Seitenkontext (M5, vom Anwender grundsätzlich bestätigt; Detailfälle noch offen)

- Nach dem gemeinsamen Update Strg+F5 laden und erneut anmelden. Ein gespeichertes
  Projekt öffnen und in Aufgaben oder Kanban wechseln: Chat zeigt Projektkennung und Tab.
  „Welche Aufgaben sind hier offen?“ und „Wie ist der Stand dieses Projekts?“ fragen.
  Quellen und Ergebnisse mit genau diesem gespeicherten Projekt vergleichen.
- Zum zweiten Projekt wechseln und dieselbe Frage stellen: neuer Seitenbezug und richtige
  Kennung. Der Bezug unter alten Benutzernachrichten bleibt unverändert. Während einer
  laufenden Antwort navigieren: die Antwort behält den beim Senden sichtbaren Bezug.
- Zur Projektübersicht zurückkehren, dann Wiki/JSON/REST öffnen: kein altes Projekt im
  Eingabefeld. „Was kann ich hier machen?“ soll die aktuelle Seite erklären; bei einer
  projektbezogenen Frage ohne Auswahl muss der Assistent nachfragen.
- Tickets-Tab erklären lassen: Platzhalter, keine vorhandenen Ticketfunktionen behaupten.
  Bearbeiten/Schreiben anfragen: weiterhin keine Aktion durch den Assistenten.
- Wiki- oder REST-Entwurf mit ausschließlich künstlichen Testwerten öffnen. Im Netzwerk
  prüfen: `context` enthält nur Route/Projektkennung/Tab, keine Suchwerte, Artikel-/Editor-
  oder Formularinhalte, Berechtigungen oder HTTP-Header. Keine echten Secrets für Tests eingeben.
- Ein neues Projekt vor abgeschlossenem Speichern auswählen oder ein Projekt zwischen
  Auswahl und Senden löschen: klare Fehlermeldung, Entwurf bleibt erhalten, kein Ersetzen
  durch ein anderes Projekt. DE/EN, Hell/Dunkel und schmale Fenster prüfen.
- Abmelden und mit anderem Konto anmelden: kein alter Chat-/Seitenbezug. Öffnen und
  Navigation alleine erzeugen keine Modellanfragen. Diese manuellen Chatfragen können
  echte API-Kosten auslösen; keine visuelle Prüfung durch den Agenten behaupten.

## Bestätigte Navigation (M6, grundsätzlich bestätigt; Detailfälle noch offen)

- Im angemeldeten API-Modus mit einem gespeicherten eigenen Projekt „Öffne Projekt #ID“
  fragen. Vor Ende der Antwort darf keine bestätigbare Karte erscheinen. Danach Projektname,
  Kennung und Zielansicht prüfen. Erst „Bestätigen und öffnen“ darf die Ansicht wechseln.
- Für Aufgabenliste und Kanban wiederholen. Die Karte muss nach sichtbarem Wechsel Erfolg
  mit grünem Häkchen melden. Anschließend „Hat es geklappt?“ fragen: der Assistent muss
  die gemeldete Ausführung von einer bloßen Freigabe unterscheiden.
- Einen Vorschlag ablehnen: keine Navigation. Chat schließen/öffnen und Verlauf nachladen:
  keine automatische Freigabe/Navigation. Doppelklick darf höchstens eine Freigabe erteilen.
- Projekt-/Kunden-/Aufgabenformular, Epic-/Sprint-/Dateidialog oder ungespeicherte
  Kontoeingabe offen lassen: Bestätigen gesperrt, Entwurf bleibt erhalten. Formular speichern
  oder schließen: Freigabe wieder möglich, sofern Vorschlag noch gültig.
- Projekt nach Vorschlag umbenennen oder löschen: Backend lehnt die Freigabe ab, kein
  anderes Projekt wird geöffnet. Fremde IDs dürfen kein Ziel freigeben. Vorschlag fünf
  Minuten liegen lassen: „abgelaufen“, keine Ausführung. Passwortwechsel/Abmelden
  während Freigabe: spätere Antwort darf die alte Oberfläche nicht steuern.
- Mit Browser-Netzwerkwerkzeugen Verbindung während Freigabe/Ergebnisrückmeldung
  unterbrechen: Status unklar oder freigegeben/unbestätigt; niemals automatisch erneut
  navigieren. Verlauf nachladen oder neuen Vorschlag anfordern. Es wird kein garantierter
  serverseitiger UI-Ausführungsnachweis behauptet.
- DE/EN, Hell/Dunkel, Tastatur und schmale Fenster prüfen. Netzwerkanfragen für decision/result
  enthalten nur Kennungen, Entscheidung/Status und erlaubten Fehlercode; keine URLs/Skripte,
  Formulareingaben oder Berechtigungen. Bestätigen/Ablehnen allein erzeugen keine OpenAI-Anfrage.

Chatfragen können API-Kosten verursachen. Diese Liste ist keine Bestätigung einer visuellen
Prüfung oder eines Live-Deployments durch den Agenten.

## Erweiterte KI-Abfragen und Anlage (manuell offen)

- Exakte Kundenanzahl mit Kunden ohne Projekte prüfen. Aufgaben mit Status/Priorität
  zählen, Projekte nach Termin/Kunde filtern, Wiki-Inhalt suchen. Quellen müssen die
  passende Anzahl und gegebenenfalls Seiten-/Textgrenzen anzeigen. Keine fremden Fachdaten.
- Je einen Kunden, ein Projekt, eine Aufgabe, ein Epic, einen geplanten Sprint, eine
  Wiki-Kategorie und einen Artikel vorschlagen. Vor Bestätigung nichts speichern.
  Pflichtfelder/Verknüpfungen anzeigen, Fehler bei unbekannten oder mehrdeutigen Namen.
- Ablehnen, Ablauf nach fünf Minuten, geänderte Datenrevision, doppelte Bestätigung,
  Netzverlust bei Bestätigung und Logout währenddessen prüfen. Nie doppelt anlegen.
  Nach verlorenem Commit nur Status lesen. Alte/regeöffnete Karten nicht ausführen.
- Offene Formulare und laufende Speicherungen blockieren Anlage. Nach Erfolg neue Daten
  ohne Modulwechsel/Verlust des Chats zeigen. Lokale Änderungen während Nachladen erhalten.
- Textdatei mit Umlauten, Emoji, Einrückung und Zeilenumbruch erzeugen; herunterladen
  und Inhalt vergleichen. Gleicher Dateiname/Pfadseparatoren abweisen. Bestehende Anhänge
  bleiben erhalten. Textdetails lesen; Binärdateien dürfen keine erfundenen Inhalte liefern.
- Als Administrator normalen Benutzer vorschlagen. Passwort nur im separaten privaten
  Feld: nicht im Chattext, Karten-Datensatz, Gesprächs-/Ausführungshistorie oder API-Antwort.
  Unter zwölf Zeichen/über 72 UTF-8-Bytes sperren. Nach Erfolg Kontoliste aktualisiert.
  Normale Benutzer können weder Konten abfragen noch anlegen. Rollenfelder abweisen.
- Eigenes Profil/Einstellungen ohne Hash/Sitzungsversion abfragen. Auch Administratoren
  erhalten über diese Werkzeuge keine fremden Workspaces. Tickets bleiben zurückgestellt.
- Deutsch/Englisch, hell/dunkel, schmale Fenster, Kartenscrollen, Tastatur und Passwortfeld
  prüfen. Keine visuelle Prüfung durch den Agenten behaupten; diese Liste bleibt manuell.
- Legacy-Chats nach Update öffnen; neue Format-2-Chats nach Neustart erneut öffnen.
  Manuelle Downgrades benötigen die in ai-workspace.md beschriebene Backup-/Datenprüfung.

## Qualität und Deployment (M9, Serverprüfung manuell offen)

- Auf Ubuntu `bash ~/test-linux-chat.sh` ausführen: Archiv-, Symlink-, Rollback- und
  Veröffentlichungsfälle müssen erfolgreich sein. Dieser Test verändert keine Installation.
- Vollständiges geprüftes Chat-Paket aktualisieren. Das Skript muss den Sicherungsordner
  nennen, Health/Frontend bestätigen und Gesprächsliste, Verlauf sowie Ausführungshistorie
  ohne Sitzung mit HTTP 401 abweisen. Keine Modellanfrage während des Updates.
- Nach Strg+F5 und Anmeldung alten PostgreSQL-Chat mit Quellen/Aktionsstatus wieder öffnen.
  Kein automatisches Senden/Navigieren, kein Verlust bereits gespeicherter Nachrichten.
- Einen bereits vor dem Update offenen Browser-Tab nachladen: alte Asset-Dateien bleiben
  vorhanden; ein weiterer vollständiger Seitenaufruf lädt das neue vollständige Paket.
- Ein absichtlicher Ausfalltest der produktiven Installation ist nicht erfolgt. Rollback
  wurde offline mit temporären Dateien und simulierten Diensten geprüft. Für eine echte
  Ausfallprobe eine separate Testinstallation und deren eigene Sicherung verwenden.
- Lokale Zeitmessung ist kein Server-/Internet-/Provider-Benchmark; Dokumentation unter
  `docs/ai-quality.md`. Die bisherigen visuellen Fälle weiterhin separat prüfen.

## Gesprächspersistenz (M8, manuell noch offen)

Diese Fälle sind eine manuelle Prüfliste; die automatisierten Adapter-/Komponententests
ersetzen keine echte PostgreSQL- und Browserprüfung des neuen Uploadpakets.

- Im PostgreSQL-Profil neuen Chat senden, „Unterhaltungen“ öffnen: Titel, Sprache,
  Nachrichtenanzahl, letzte Aktivität und 30-Tage-Aufbewahrung anzeigen. Leer angelegte
  Gespräche heißen „Neue Unterhaltung“. Liste sortiert sich nach Aktivität.
- Seite neu laden, erneut anmelden und Gespräch über die Liste öffnen. Danach Backend
  neu starten, erneut anmelden und denselben bestätigten Verlauf samt Quellen/Aktionsstatus öffnen.
  Nicht automatisch senden oder navigieren. Vor M8 flüchtige Chats fehlen erwartungsgemäß.
- Eigene Ausführungshistorie zeigt neueste Läufe zuerst, Status, Zeit und geordnete Schritte.
  Fehler/Stoppen erzeugen keine halben Chatpaare. Unterbrochene Schritte bleiben erkennbar.
  Lesen/Öffnen/Löschen erzeugen im Netzwerk keine Provider-/Nachrichtenanfrage.
- Mit anderem Anwendungskonto keine fremden Gespräche sehen; fremde Chat-/History-/Delete-
  Kennungen ergeben 404. Auch Administratoren erhalten keine fremden Gesprächsinhalte.
- Entwurf schreiben, anderes Gespräch wählen: ausdrückliche Verwerfbestätigung; Abbrechen
  erhält den Entwurf. Auflisten und Ausführungen ansehen erhalten ihn ebenfalls.
- Löschen verlangt Bestätigung und entfernt Gespräch sowie Ausführungsläufe. Abbrechen
  erhält alles. Nach dem Löschen der geöffneten Unterhaltung beginnt eine leere Ansicht.
- In zweitem Browserfenster laufenden Chat öffnen: Nachrichten/Freigaben gesperrt, Reload-
  Hinweis sichtbar. Nach Abschluss manuell nachladen. Verwaiste Läufe nach AI_TIMEOUT+5s
  als unterbrochen markieren; kein automatisches Fortsetzen oder erneutes Erteilen alter Freigaben.
- Netzwerk-/Sitzungsfehler sichtbar behandeln; fehlgeschlagenes Öffnen erhält die bisherige
  Ansicht. Abmelden verhindert das Übernehmen verspäteter Antworten in ein anderes Konto.
- Deutsch/Englisch, hell/dunkel, schmales Fenster, Tastaturfokus und scrollbare Listen prüfen.
  Im Memory-Profil korrekten Hinweis auf flüchtige Speicherung und kurze Frist anzeigen.

## Mehrstufige Ausführung (M7, vom Anwender grundsätzlich bestätigt; Detailfälle offen)

- Mit zwei gespeicherten eigenen Projekten „Zeige Titel und Prioritäten der offenen Aufgaben
  meiner ersten beiden Projekte“ fragen. Projektübersicht und Aufgabenabfragen müssen als getrennte,
  nummerierte Quellen erscheinen. Mit gespeicherten Projekten/Listen vergleichen.
- Eine große Anfrage nach mehr Projekten/Seiten als das Schrittbudget erlaubt stellen:
  höchstens vier Werkzeugschritte bei Vorgabe, anschließend Textzusammenfassung mit
  offenen Teilen. Keine erfundenen Daten oder weiteren versteckten Leseaufrufe behaupten.
- Während des zweiten Schritts stoppen, abmelden oder die Verbindung trennen: keine
  Übernahme einer halben Folge, keine bestätigbare Aktionskarte, keine automatische
  Wiederholung. Eingabe bleibt bei Fehler/Abbruch erhalten. Ein verlorenes done lässt
  sich nur durch Nachladen des bestätigten Verlaufs wiederfinden.
- Zwischen zwei Werkzeugschritten in einem zweiten Fenster Projektdaten ändern und
  speichern: bei unterschiedlicher gelesener Revision klare Meldung, manuelles erneutes
  Senden statt Zusammenmischen alter und neuer Ergebnisse. Das Verhalten kann wegen
  kurzer Lesezeiten im Browser schwer gezielt auszulösen sein; automatisiert geprüft.
- „Finde mein Projekt … und öffne seine Aufgabenliste“: Lesen kann dem Vorschlag vorangehen,
  dieser muss die Werkzeugfolge beenden. Erst die M6-Karte darf navigieren. Kein automatisches
  Öffnen, Fortsetzen oder Schreiben. Mehrdeutige Projektnamen müssen eine Rückfrage auslösen.
- DE/EN, schmale Fenster, Hell/Dunkel und Tastatur prüfen. Im Netzwerk execution-Ereignisse
  mit begrenzten Phasen/Zählern und mehrere geordnete tool-Ereignisse prüfen. Sämtliche
  Teilresultate bleiben bis done unbestätigt. Chatfragen können mehr API-Kosten als vor M7 verursachen.

Keine visuelle oder Liveprüfung durch den Agenten behaupten; lokal dienen deterministische
Modelle und Loopback-Provider zur Prüfung von Schrittgrenze, Dauer und echtem Verbindungsabbruch.

## Abschluss

Nur tatsächlich ausgeführte Punkte als geprüft dokumentieren, mit Datum und Datenmodus.
Das Testkonto kann anschließend deaktiviert werden; eine automatische Löschung seiner Daten
ist nicht vorgesehen. Ticketsystem bleibt zurückgestellt.
