# Kundendetails, Ansprechpartner und Notizen

Der Haupttab Kunden öffnet eine kompakte Tabelle mit Name, Branche und Ort für alle
Kunden des eigenen Kontos. Fehlende Branche/Ort erscheinen als Gedankenstrich. Die
Suche berücksichtigt weiterhin Name, E-Mail, PLZ, Ort und Branche. Kunden ohne Projekte
werden ebenfalls angezeigt. Spalten und Leerzustände sind auf Deutsch/Englisch verfügbar.

Ein Klick auf eine Zeile oder den per Tastatur erreichbaren Kundennamen führt zu
`#/projectManager/customers?customer=ID`. Die Seite zeigt Stammdaten/Anschrift,
zugeordnete Projekte, Ansprechpartner und interne Notizen. Projektbuttons öffnen die
vorhandene Projektdetailansicht. Zurück entfernt nur den customer-Parameter; andere
Parameter bleiben erhalten. Unbekannte Kennungen zeigen einen Fehler statt Ersatzdaten.
Bearbeiten und Löschen befinden sich in der Detailansicht. Bei zugeordneten Projekten
ist Löschen mit einem Hinweis gesperrt. Nach bestätigtem Löschen kehrt die Ansicht zur
Tabelle zurück; das vorhandene Speicher-/Fehlerverhalten bleibt erhalten.

## Bedienung und Speicherung

Ansprechpartner haben Name, Funktion/Jobtitel, E-Mail und Telefon. Nur der Name ist
verpflichtend; eine angegebene E-Mail muss gültig sein. Hinzufügen/Bearbeiten erfolgt
im Dialog, Entfernen nach Bestätigung. Pro Kunde höchstens 100 Kontakte, im gesamten
eigenen Workspace höchstens 10000. Kennungen sind innerhalb des Kontos eindeutig;
derselbe Zahlenwert in einem anderen Konto ist unabhängig. Name maximal 1000 Zeichen,
Funktion 200, E-Mail 254, Telefon 100. Funktion ist ein Geschäftstext, keine Benutzerrolle.

Interne Notizen sind Klartext mit höchstens 6000 Zeichen. Zeilenumbrüche, Leerzeichen und
Unicode bleiben erhalten; HTML wird niemals ausgeführt. Bearbeiten/Speichern/Abbrechen
verwendet einen eigenen Dialog. Leerer Text entfernt die Notiz. Veraltete Kontakt-/Notiz-
entwürfe überschreiben keine zwischenzeitlich geänderten Werte. Stammdatenbearbeitung
erhält Kontakte und Notizen. Offene Dialoge blockieren KI-Freigaben und bleiben im
vorhandenen Modulsystem als Zustand erhalten. Sitzungswechsel setzen Entwürfe zurück.

Alle Änderungen laufen weiterhin über `useWorkspaceField('customers')` und die bestehende
atomare Multipart-Workspace-API mit If-Match. Kunden erhalten optional `contacts` und `notes`;
gespeicherte Antworten liefern eine Liste und Text. **Fehlende/null Detailfelder eines alten
Clients erhalten die vorhandenen Werte.** Explizite `contacts=[]` beziehungsweise `notes=''`
löschen sie. Neue Kunden ohne Details erhalten leere Werte. Keine separaten CRUD-Endpunkte.

V7 ergänzt `ff_customers.notes` und die Tabelle `ff_customer_contacts` mit kontogebundener
Kennung und zusammengesetztem Fremdschlüssel `(owner_id,customer_id)` auf den Kunden.
Der Backendadapter lädt Kontakte gesammelt statt je Kunde einzeln und schreibt sie in
derselben Workspace-Transaktion. Kundenlöschen bleibt bei zugeordneten Projekten gesperrt;
ansonsten entfernt es nach UI-Bestätigung auch Kontakte/Notizen. Der Dialog weist darauf hin.

## KI

Die sieben vorhandenen Modellwerkzeuge bleiben erhalten; kein neuer Provider und keine
neue Abhängigkeit. Beispiele:

- „Welche Ansprechpartner hat Kunde #1?“
- „Lege für Kunde #1 den Ansprechpartner Beispiel mit der Funktion Projektleitung an.“
- „Ändere die Telefonnummer von Ansprechpartner #3 auf +49 12345.“
- „Welche internen Notizen gibt es zu Kunde #1?“
- „Ändere die Notiz von Kunde #1 in: …“

`read_workspace(entity=contacts)` unterstützt den Filter `customerId eq ID`, Suche,
Zählung und begrenzte Seiten. Kunden liefern `contactCount` statt einer unbeschränkten
Kontaktliste; Notizen nur in der Detailansicht mit vorhandener Textabschnittsbegrenzung.
`propose_workspace_create(entity=contacts)` verlangt customer und name, optional role,
email, phone. `propose_workspace_update(entity=contacts)` kann name/role/email/phone
ändern, niemals die Kundenzuordnung oder Kontorechte. Kundennotizen verwenden
`propose_workspace_update(entity=customers, fields=[{name:'notes',value:'…'}])`.
Kontakte löschen ist kein KI-Werkzeug.

Vorschläge speichern nichts. Erst die bestehende Bestätigungskarte schreibt nach erneuter
Prüfung von Konto/Sitzung, Revision, Gültigkeit und Vorherwerten. Fachänderung und Chatstatus
werden in PostgreSQL gemeinsam committed oder vollständig zurückgerollt. Wiederholungen
und verlorene Antworten erzeugen keine doppelten Kontakte. Andere Konten bleiben unzugänglich,
auch für Administratoren. Kontakt-/Notiztexte werden nur bei entsprechenden Werkzeugaufrufen
an den Modellanbieter übertragen und bleiben nicht vertrauenswürdige Daten.

Der Seitenkontext enthält weiterhin kein ausgewähltes customerId. Bei „diesem Kunden“ ohne
eindeutigen Namen/#ID muss das Modell nachfragen; eine Projektkennung ist keine Kundenkennung.

## Betrieb und Prüfung

Frontend/Backend gemeinsam aktualisieren; V7 läuft automatisch beim Start. Das bestehende
Update-Skript sichert die Datenbank vorher. Neue Kontakt-/Notizgespräche verwenden
Aggregatformat **4**, das Backend liest weiterhin 1–4. Alte reine Chats behalten ihr Format.
**Ein manuelles Downgrade kann neue Chats unlesbar machen und Kontakte/Notizen beim Schreiben
mit einem alten Backend verlieren.** Kein automatisches Datenbank-Restore oder SQL-Downgrade;
Sicherung und Datenerhalt vor einem solchen Wechsel prüfen.

Automatisiert geprüft: Direktlinks/Zurück/fehlende Kunden, Projekt-/Kontaktzuordnung,
Dialogverhalten und gezielte Änderungen, Klartext/Unicode, Altclient-Erhalt, Kontotrennung,
FK-Schutz, Persistenz über eine zweite Backend-Instanz, atomarer KI-Rollback, Wiederholung,
Origin/CSRF, Inhaber und echte SDK-Anfragen ausschließlich an Loopback. Echte OpenAI-Aufrufe
und visuelle/Remote-Abnahme sind separate Prüfungen; in diesem Durchlauf war kein Browser
verfügbar. Manuelle Fälle: [browser-check.md](browser-check.md).
