# Business, Stoppuhr und persönliche Übersicht

Die Erweiterung ergänzt acht zusammenhängende Funktionen: Projektbudgets, Stoppuhr,
monatliche PDF-Leistungsnachweise, Angebote/Rechnungen, globale Suche, Projektvorlagen,
„Meine Arbeit“ und ein Kundenportal. Bestehende Workspace-Daten und Zeiten bleiben erhalten.

## Einstieg

Links unter TimeTracker steht die App **Business**. Ihre Reiter sind Budgets,
Angebote & Rechnungen, Vorlagen, Kundenportal und Abrechnungseinstellungen.
Zuerst die Abrechnungseinstellungen mit Unternehmen, Anschrift, Zahlungsinformationen,
Währung, Stundensatz, Steuer und Zahlungsziel speichern. Es gibt keine vorausgesetzten
Steuerdaten: Standardsteuer und Stundensatz sind zunächst null. Die Oberflächen sind DE/EN
und verwenden die vorhandenen Themes, Dialoge und den Schutz ungespeicherter Änderungen.

- **Budgets:** Minutenbudget und Stundensatz je Projekt; erfasste Netto-Minuten, Restzeit
  und Verbrauchsbalken. Auch die Projekt-Detailseite zeigt das Zeitbudget. Grundlage sind
  die privaten Buchungen dieses Kontos, nicht Teamzeiten. Budget und Rechnungsbetrag sind
  unabhängig; es gibt keine automatische Fakturierung oder Währungsumrechnung.
- **Stoppuhr:** Im TimeTracker Kunde/Projekt, Kommentar und Abrechenbar wählen, starten,
  pausieren oder fortsetzen. Eine Messung je Konto bleibt im API-Modus auch nach Browser-
  und Backend-Neustart erhalten. „Stoppen und prüfen“ öffnet den normalen Eintragseditor.
  Erst dessen Speichern bucht Zeit; Verwerfen löscht nur die Messung. Angefangene Minuten
  werden aufgerundet, Pausen separat vorgeschlagen. Datum/Uhrzeit folgen der beim Start
  gewählten Browser-Zeitzone. Mitternachtsüberschreitungen weiterhin manuell aufteilen.
  Bei Fehler nach erfolgreicher Buchung bleibt die Messung mit derselben UUID wieder
  abschließbar; eine Wiederholung darf keinen zweiten Eintrag mit anderer Kennung anlegen.
- **Leistungsnachweise:** TimeTracker → Auswertung bietet Monat, Kunden-/Projektfilter
  und optional Kommentare für ein PDF mit Netto-Zeiten, Pausen und Summen. Dies ist ein
  eigener Monatsfilter, nicht der CSV-Export der aktuell gefilterten Woche.
- **Angebote/Rechnungen:** Entwürfe mit Kunde, optional Projekt, Datum/Fälligkeit,
  Positionen, Steuersätzen, Hinweisen und Vorschau. Rechnungspositionen können aus noch
  nicht abgerechneten Zeiten eines Monats übernommen werden. Der Import ersetzt vorhandene
  Positionen. Entwürfe löschen oder ausdrücklich freigeben; Freigabe fixiert Inhalte,
  Absender-/Empfängeranschrift und fortlaufende Nummer `OFF-JAHR-00001` bzw.
  `INV-JAHR-00001` je Konto. Angebote lassen sich annehmen/ablehnen und in einen neuen
  Rechnungsentwurf übernehmen; Rechnungen als bezahlt oder storniert markieren.
- **Suche:** Kopfzeile oder Strg/Cmd+K, mindestens zwei Zeichen. Durchsucht eigene Kunden,
  Projekte, Aufgaben und Dokumentationsseiten. Treffer öffnen das konkrete Objekt über
  die bestehende Navigation einschließlich Entwurfsschutz; keine externen Suchanfragen.
- **Vorlagen:** Aufgaben, Meilensteine und Dokumentationsseiten speichern. Aufgaben und
  Meilensteine können aus einem vorhandenen Projekt übernommen werden. Anwendung auf
  einen Kunden erzeugt ein neues Projekt mit frischen Kennungen, Aufgaben, Epics und einem
  Dokumentationsbereich. Es entstehen keine Kunden-, Datei- oder Zeitkopien. Im API-Modus
  prüft der Server sowohl Business- als auch Workspace-Revision vor der Transaktion.
- **Meine Arbeit:** Eigener Reiter im Projektmanager und kompakte Dashboard-Karte mit
  heutigen Zeiten, vergangenen Werktagen dieser Woche ohne Buchung, offenen Aufgaben und
  anstehenden/überfälligen Projektterminen. Aufgaben werden nach **Projekttermin** und
  Priorität sortiert; individuelle Aufgabenfälligkeiten wurden nicht neu eingeführt.
- **Kundenportal:** Unter Business ein eigenes Portal-Konto mit E-Mail und initialem
  Passwort anlegen. Zugangsdaten werden manuell weitergegeben, nicht per E-Mail versendet.
  Der Kunde meldet sich am selben Login an und erhält automatisch nur die Portalansicht
  mit eigener Passwortänderung und Abmelden.

## Portal: ausdrücklich veröffentlichen

Ein neues Portal-Konto sieht zunächst keine Inhalte. „Freigaben bearbeiten“ erlaubt eigene
Projekte dieses Kunden, einzelne Dokumentationsseiten, Dateien freigegebener Projekte,
freigegebene Angebote/Rechnungen und ausgewählte Monatsnachweise. Dokumentationsseiten
werden einzeln gewählt; Eltern-/Unterseiten werden nicht automatisch mitveröffentlicht.

**Speichern veröffentlicht eine Momentaufnahme.** Spätere interne Änderungen bleiben privat,
bis die Freigaben erneut gespeichert werden. Projektfortschritt umfasst nur Zähler, keine
internen Aufgabenbeschreibungen. Zeitkommentare sind im Portal immer entfernt; Monatsnachweise
enthalten nur den zugeordneten Kunden und ausgewählte Projekte. Bestehende Veröffentlichungen
werden durch das Löschen interner Objekte nicht automatisch zurückgenommen: Freigaben ändern
und speichern oder „Zugang aktiv“ abwählen. Dateiabrufe prüfen zusätzlich den veröffentlichten
Inhalts-Hash; eine entfernte/ersetzte Datei wird nicht unter gleicher Kennung ausgeliefert.

Die Einschränkung gilt serverseitig, auch für direkte HTTP-Anfragen: Portal-Konten dürfen
keinen Workspace, keine internen Einstellungen, Kontoverwaltung, Business-Daten oder KI-APIs
aufrufen. Ein inaktiver Besitzer oder ein widerrufener Portalzugang verhindert den Abruf.
Die normale Administrator-Kontoverwaltung kann Portal-Konten zusätzlich deaktivieren.

## Beträge, PDFs und Grenzen

Beträge werden als ganze Cent, Steuersätze als Basispunkte gespeichert. Positionsnetto und
Steuer runden jeweils HALF_UP auf Cent. Zeitpositionen rechnen direkt `Minuten × Cent / 60`,
ohne gerundete Zwischenwerte für Dezimalstunden. Bereits freigegebene/bezahlte Rechnungen
blockieren die erneute Abrechnung derselben Zeitkennung. Eine stornierte Rechnung gibt diese
Zuordnung wieder frei. Eingefrorene Rechnungen ändern sich nicht durch spätere Zeitkorrekturen.

EUR, USD, CHF und GBP sind auswählbar; die Auswahl führt keine Umrechnung durch. Diese Version
erstellt PDFs und verwaltet Status. Sie enthält keine E-Rechnungsformate, E-Mail-Zustellung,
Zahlungsabwicklung, Buchhaltung oder automatische Prüfung aller steuerlichen Pflichtangaben.
Absender, Steuer und rechtlich erforderliche Angaben müssen zum eigenen Anwendungsfall passen.

PDFs werden nach Anmeldung serverseitig mit PDFBox 3.0.8 und eingebetteter Liberation Sans
erzeugt, mit Umbruch und Seitenzahlen. Deutsche Umlaute bleiben lesbar; Zeichen außerhalb
des eingebetteten Fontumfangs erscheinen als `?`. Die gespeicherten Texte und CSV-Daten
werden dadurch nicht verändert. Mehrseitige Angebote, Rechnungen und Monatsnachweise wurden
automatisiert erzeugt und als gerenderte Bilder geprüft; eine Browser-Sichtprüfung ist separat.

Limits: 5 MiB Business-JSON je Konto, 10000 Budgets, 500 Vorlagen, 1000 Dokumente, maximal
100 Positionen je Dokument. Je Vorlage bis 100 Aufgaben, 30 Meilensteine und 30 Seiten.
Maximal 100 Portal-Konten je Besitzer; eine Veröffentlichung umfasst höchstens 5 MiB JSON,
2 Millionen Dokumentationszeichen und insgesamt 25 MiB Dateiinhalte.

Im lokalen Beispieldatenmodus bleiben Budget-, Entwurfs-, Vorlagen- und Timerdaten nur in
der Sitzung. PDF-Downloads und Portal-Konten benötigen den API-Modus. Die verbindliche
Nummernvergabe und Unveränderlichkeit freigegebener Inhalte werden vom Backend garantiert;
der lokale Adapter ist für eine produktive Rechnungsablage nicht geeignet.

## Speicher und Betrieb

Flyway **V13** ergänzt `ff_accounts.portal_only`, `ff_business` und `ff_portal_links`.
Business-Daten und Portal-Veröffentlichungen liegen außerhalb des Workspace, mit privaten
Eigentümern, atomaren Schreibzugriffen unter Kontosperre und Revisionen. Veraltete Revisionen
ergeben 409, keine automatische Zusammenführung. Normales Business-PUT verändert die Stoppuhr
nicht; ihre Aktionen besitzen eigene Endpunkte. Sessions bleiben wie bisher im Arbeitsspeicher.
Der Memory-Backendadapter ist nicht dauerhaft; PostgreSQL erhält diese Daten bei Neustarts.

Frontend und Backend gemeinsam aktualisieren; es gibt keine neue Pflicht-Umgebungsvariable.
Die bestehende vollständige Datenbanksicherung enthält die neuen Tabellen. Ein Rückwechsel
auf Backend-Versionen **vor V13** ist nach Anlage von Portal-Konten kein regulärer Rollback:
alte Authentifizierung kennt die Portalrolle nicht. Vor einem solchen Downgrade Portal-Konten
deaktivieren und den Datenbank-/Anwendungsstand gemeinsam prüfen bzw. aus der passenden
Sicherung wiederherstellen.

Die KI kennt die neuen Seitennamen und allgemeine Bedienhinweise. Diese Erweiterung fügt
keine KI-Werkzeuge für Business, Zeiten oder das Portal hinzu; diese Inhalte werden dem Chat
nicht automatisch übergeben. Bestehende, ausdrücklich freigegebene Workspace-Werkzeuge bleiben.

HTTP-Pfade und Schemas: [backend-api.md](backend-api.md), [openapi.json](openapi.json).
Manuelle Prüfung: Punkt 43 in [manual-check.md](manual-check.md).
