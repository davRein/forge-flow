# KI-Abfragen und bestätigte Anlage

Dokumentation: `articles` sind Seiten, `categories` sind Bereiche. ParentId-Filter lesen
Unterseiten; `parent` bei Anlage/Änderung verwendet exakten Seitennamen/#ID und verlangt
eine explizite Freigabe. Neue Unterseiten erben ohne category-Angabe den Bereich der
Elternseite. Keine Schleifen oder fremden Eltern; maximal zwölf Ebenen. Gesprächsformat 5
bei neuen Hierarchievorschlägen, Leser 1–5. [Details](documentation.md).

Ergänzt: Kontakte anlegen/lesen/ändern sowie Kundennotizen lesen/ändern, siehe
[Kundendetails](customer-details.md). Eigentümer-, Vorschlags- und Revisionsregeln bleiben erhalten.

Die Erweiterung vom 24. Oktober 2026 bindet die vorhandenen gespeicherten Fachbereiche
an den Assistenten an. Die bisherigen Projektwerkzeuge und Navigationsfreigaben bleiben
erhalten. Neues Framework, neue Abhängigkeiten oder Datenbankmigration sind nicht nötig.

Bestehende Datensätze können inzwischen ebenfalls nach Vorschau und ausdrücklicher
Bestätigung bearbeitet werden. Felder, Beispiele und Grenzen: [ai-updates.md](ai-updates.md).
Die folgenden Abschnitte beschreiben weiterhin das Lese- und Anlageprotokoll.

## Verfügbare Bereiche

| Bereich | Abfragen | Anlegen |
| --- | --- | --- |
| Kunden | Anzahl, Suche, Anschrift und Kontaktdaten des eigenen Kontos | Name; weitere Felder optional |
| Projekte | Anzahl, Kunde, Planung, Termin, Suche und Filter | Name, vorhandener Kunde, Deadline |
| Aufgaben | Alle Statuswerte, Priorität, Beschreibung, Epic, Suche und Filter | Projekt, Titel; Status, Priorität, Beschreibung und Epic optional |
| Epics | Projekt, Titel, Beschreibung | Projekt und Titel; Beschreibung optional |
| Sprints | Planung, Termine, Status, Aufgabenkennungen und Abschlussdaten | Geplanter Sprint mit Projekt, Titel und Zeitraum; Ziel/Aufgaben optional |
| Wiki-Kategorien | Anzahl, Suche, Beschreibung | Name; Beschreibung optional |
| Wiki-Artikel | Anzahl, Titel-/Inhaltssuche, Kategorie, Textabschnitte | Titel und Inhalt; Kategorie optional |
| Projektdateien | Metadaten; bei unterstütztem UTF-8-Text auch Inhalt | UTF-8-Textdatei mit Projekt, Name und Inhalt |
| Aktivitäten | Anzahl, Suche und Details | Entstehen automatisch bei Aufgaben-/Epic-/Sprint-Anlage |
| Eigenes Profil / Einstellungen | Gespeicherte Werte, ohne Hashes oder Sitzungsversionen | Keine neue Einstellungsschreibfunktion |
| Benutzerkonten | Nur für Administratoren: Name, E-Mail, Aktiv-/Administratorstatus | Nur für Administratoren: normales aktives Konto, Passwort separat |

Alle Fachzugriffe bleiben auf das angemeldete Konto beschränkt. Administratorrechte für
die Benutzerliste erlauben keinen Zugriff auf fremde Projekte, Dateien oder Chats.
Nicht gespeicherte Browserentwürfe und lokale Dev-Tools-Eingaben sind keine Backenddaten.
Privat gespeicherte REST-Collections liegen ebenfalls außerhalb des KI-Werkzeugumfangs.
Ihre Header, Bodies und URLs werden nicht für Fachabfragen oder KI-Vorschläge gelesen.
Bearbeiten unterstützt die in [ai-updates.md](ai-updates.md) aufgezählten Felder.
Löschen vorhandener Datensätze, Rollenänderungen, externe HTTP-Aufrufe, lokale
Dateisystemzugriffe und das zurückgestellte Ticketsystem werden nicht als Werkzeuge angeboten.

Beispiele:

- „Wie viele Kunden habe ich?“
- „Wie viele Aufgaben sind offen und haben eine hohe Priorität?“
- „Welche Projekte haben eine Deadline vor dem 1. Dezember 2026?“
- „Suche im Wiki nach dem Text deployment.“
- „Lege den Kunden Beispiel GmbH mit der E-Mail kontakt@example.test an.“
- „Lege für Kunde #1 das Projekt Website mit Deadline 2026-12-31 an.“
- „Erstelle im Projekt #1 eine Aufgabe Deployment testen mit hoher Priorität.“
- „Erstelle einen Wiki-Artikel Installation mit folgendem Inhalt: …“
- „Lege in Projekt #1 die Textdatei notes.md mit folgendem Inhalt an: …“
- Als Administrator: „Lege das Benutzerkonto Beispiel mit beispiel@example.test an.“

## Leseprotokoll

`read_workspace(entity, query, project, mode, offset, textOffset, filters)` verwendet feste
Bereichsnamen: customers, projects, tasks, activities, epics, sprints, files, articles,
categories, users, profile und settings. `mode=count` liefert die exakte passende Anzahl
ohne Datensatzinhalte. Die Kundenanzahl ist damit unabhängig davon, ob ein Kunde Projekte hat.

`list` liefert höchstens zehn Zusammenfassungen, `detail` einen Datensatz einschließlich
begrenzt langer Textfelder. Die Suche umfasst Name/Titel/Code/E-Mail sowie Beschreibung,
Ziel und Artikelinhalt. `#ID` wählt eine exakte Kennung. `project` ist leer oder eine eindeutige
eigene Projektkennung/ein exakter Name. Wiki, Profil, Einstellungen und Benutzerliste haben
keinen Projektfilter. Offset 0–10000 blättert Datensätze; textOffset 0–1000000 blättert Texte
in Abschnitten von höchstens 2000 UTF-16-Zeichen. Surrogatpaare werden nicht zerteilt.

`filters` ist eine AND-Liste von höchstens zehn `{ field, operator, value }`-Einträgen.
Erlaubt sind eq, contains, lt und gt auf freigegebenen gespeicherten Feldern, zum Beispiel
status/priority bei Aufgaben, customerId bei Projekten oder deadline für Termine.
Zahlen werden numerisch verglichen; ISO-Daten und sonstige Texte lexikalisch ohne
Groß-/Kleinschreibung. `taskIds eq` prüft Mitgliedschaft. Filter müssen zum gewählten Bereich
gehören; unbekannte oder sensible Felder werden abgewiesen statt als leere Anzahl ausgegeben. SQL, Regex,
Eigentümerkennungen, freie URLs und ausführbarer Code sind keine Filterparameter.

Ergebnisse enthalten weiterhin revision/readAt und ergänzen `workspace` mit Bereich,
Modus, Textoffset sowie Datensätzen `{ id, label, fields }`. Kennungen können Zeichenketten
sein, insbesondere für Konten. Die Oberfläche zeigt die tatsächliche Anzahl und sichere
Textquellen. Trunkierung und weitere Seiten werden gekennzeichnet. Die vorhandenen
Schritt-, Gesamtzeit- und Ergebnisgrenzen bleiben erhalten; die KI kann deshalb nicht
beliebig große Bestände in einer Antwort vollständig aufzählen.

## Anlageprotokoll und Transaktionen

`propose_workspace_create(entity, fields)` akzeptiert ausschließlich bekannte Bereiche
und eine Liste von `{ name, value }`-Zeichenketten. Unbekannte/doppelte Felder, Modell-
Kennungen, Passwörter, Rollen und Eigentümerangaben werden vor dem Protokollieren abgewiesen.
Verknüpfungen werden im eigenen Workspace eindeutig über Namen oder #ID aufgelöst.
Fehlende Pflichtangaben, ungültige Daten, doppelte Dateinamen, unzulässige Sprint-
Zuordnungen und Kapazitätsgrenzen führen zu Fehlern, ohne einen Datensatz zu speichern.

Ein Werkzeugaufruf baut nur einen unveränderlichen Vorschlag: UUID, workspace.create,
Bereich, vollständig geprüfte Daten mit serverseitiger Kennung/Zeitstempeln, Revision,
fünfminütige Gültigkeit und Status proposed. Er steht als `result.mutation` am Ende der
Werkzeugfolge. Erst ein vollständig bestätigtes Chatpaar registriert ihn. Eine Nachricht
wie „ja“ ist keine Freigabe. Pro Nachricht wird höchstens ein Anlagevorschlag erstellt;
weitere Anlagen werden nach der Bestätigung mit einer neuen Nachricht angefordert.

`POST /api/v1/ai/conversations/{id}/creations/{actionId}/decision` erhält nur
`{ decisionId, decision, initialPassword? }`. decision ist approve oder reject.
Die HTTP-Anfrage verlangt eigene Unterhaltung, aktuelle Kontoversion, aktive Sitzung,
Origin und CSRF. Änderbare Datensatzdaten werden nicht akzeptiert. Ablehnen schreibt keine
Fachdaten. Freigeben prüft die Vorschlagsgültigkeit und Fachregeln erneut. Bei Fachdaten
wird zusätzlich die Workspace-Revision geprüft; Konten verwenden die aktuelle
Administratorberechtigung und die bestehende E-Mail-Eindeutigkeit statt dieser Revision.
Eine inzwischen geänderte Workspace-Revision ergibt 409 AI_CREATE_CONFLICT; kein
stilles Zusammenführen oder Überschreiben. Normale Benutzer können keine Konten anlegen.

Im PostgreSQL-Profil werden der neue Datensatz, Dateibytes beziehungsweise ein neues Konto
und der Gesprächs-Aktionsstatus in derselben Transaktion gespeichert. Gesprächszeilensperren
verhindern parallele doppelte Freigaben; Kontosperren schützen den Workspace. Nach dessen
Bulk-Schreiben wird der durch EntityManager.clear abgelöste Chat erneut geladen, bevor der
Status geschrieben wird. Ein anschließender Statusfehler rollt die Fachänderung vollständig
zurück. Im Memory-Profil serialisiert der Gesprächsspeicher die Entscheidung und führt erst
die validierte Fachoperation aus. Erfolgreiche Freigabewiederholungen liefern das gespeicherte
Ergebnis ohne erneutes Anlegen. Fremde Kennungen liefern 404.

Status ist proposed, succeeded, rejected oder expired. Nur succeeded bestätigt Speicherung.
Eine verlorene HTTP-Antwort wird ausschließlich nachgelesen; es gibt keine automatische
Wiederholung des Schreib- oder Modellaufrufs. Bei neuer Nachricht erhält das Modell den
gespeicherten Status als Daten, niemals als Systemanweisung. Alte Chat-Aggregate ohne
mutations bleiben lesbar. Reine Legacy-Gespräche behalten Aggregatformat 1 und erhalten
keine neuen leeren JSON-Felder. Erst neue Workspace-Abfragen oder Anlagevorschläge
verwenden Format 2. Das aktuelle Backend liest beide Formate, ohne SQL-Migration.
Ein älteres Backend kann neue Format-2-Chats nicht lesen. Ein späterer manueller Downgrade
nach Benutzung der neuen Werkzeuge benötigt deshalb eine bewusste Daten-/Backupprüfung;
das Update-Skript konvertiert oder löscht keine Chatdaten und stellt keine Datenbank
automatisch zurück.

## Dateien und private Konto-Passwörter

Neue Dateien unterstützen text/plain, text/markdown, text/csv und application/json.
Zeichen und Einrückung bleiben erhalten; UTF-8-Bytes, Größe und Metadaten werden zusammen
gespeichert. Pfadseparatoren und unzulässige Dateinamen werden abgewiesen. Die bestehenden
20-MiB-Gesamtgrenzen gelten weiter. Lesezugriffe dekodieren unterstützte Textdateien streng
als UTF-8, maximal das erste MiB; binäre Anhänge liefern Metadaten statt erfundener Inhalte.
PDF-/Office-/Bildanalyse und Chat-Dateiupload sind nicht Bestandteil dieser Erweiterung.

Ein Konto-Anlagevorschlag enthält ausschließlich Kennung, Name, E-Mail und die fest
vorgegebenen Werte administrator=false und active=true. Das Initialpasswort wird erst
im separaten Passwortfeld der Karte eingegeben und direkt an den Bestätigungsendpunkt
gesendet. Es ist weder Modellargument noch Aktionsdatenfeld oder Chatnachricht. Eingabe und
Antwort werden nicht protokolliert; das DTO hat eine redigierte toString-Darstellung und
ein ausschließlich schreibbares Passwortfeld. BCrypt und die vorhandenen Regeln gelten:
mindestens zwölf Unicode-Zeichen, höchstens 72 UTF-8-Bytes, kein NUL. Nach dem Hashen wird
die Sitzung erneut geprüft. Erfolgsantworten, Gesprächs- und Ausführungshistorie enthalten
keinen Hash und kein Initialpasswort. Rollenänderungen sind kein Modellwerkzeug.

## Oberfläche und Prüfung

Die Karte zeigt alle zu speichernden Angaben und „Bestätigen und anlegen“/„Ablehnen“.
Offene Formulare und ausstehende lokale Speicherungen blockieren die Freigabe. Nach Erfolg
wird der Workspace ohne Aushängen der Komponenten nachgelesen. Lokale Änderungen während
dieses Nachladens werden nicht überschrieben. Die Benutzerliste erhält bei Kontoanlage
ein inhaltsloses Aktualisierungssignal. Status, Konflikte und unsichere Antworten bleiben
sichtbar; beim erneuten Laden wird keine Aktion ausgeführt. Darstellung und Hinweise
sind Deutsch/Englisch und verwenden die vorhandenen Theme-Tokens.

Die neuen Funktionsschemas behalten feste Eigenschaften und verpflichtende Schemafelder
für den bestehenden Strict-Modus. Grundlage: [offizielle OpenAI-Dokumentation zu Function Calling](https://developers.openai.com/api/docs/guides/function-calling).
Keine Änderung am konfigurierten Modell oder Provider erforderlich. Tests verwenden
Mock-Modelle und echte SDK-Anfragen ausschließlich an Loopback-Server. Der gesonderte
OpenAI-Live-Test bleibt opt-in. Automatisierte Prüfungen ersetzen keine visuelle Abnahme
oder einen tatsächlichen Serverupdate-Test.

Lange Wiki-/Dateiinhalte müssen außerdem in das konfigurierte Modell-Ausgabelimit passen.
`AI_MAX_OUTPUT_TOKENS` bleibt unverändert (Vorgabe 1024, höchstens 4096); bei Bedarf kann
der Betreiber es bewusst erhöhen. Das kann mehr API-Kosten verursachen. Abgeschnittene
oder ungültige Werkzeugargumente speichern keinen halben Datensatz. Die vorhandene
Begrenzung einer Chat-Eingabe auf 4000 Zeichen bleibt bestehen.
