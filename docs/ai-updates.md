# KI: bestehende Daten bearbeiten

Zusätzlich können Ansprechpartner (Name/Funktion/E-Mail/Telefon) und Kundennotizen geändert
werden. Details, Bestätigung und Aggregatformat 4: [customer-details.md](customer-details.md).

Die [Anlage neuer Datensätze](ai-workspace.md) bleibt erhalten. Die Erweiterung vom
24. Oktober ergänzt Änderungen mit einer Vorschau vollständiger alter und neuer Werte.

| Bereich | Änderbare Felder |
| --- | --- |
| Kunden | Name, Straße, Ort, Land, E-Mail, Website, Telefon, Branche |
| Projekte | Name, vorhandener Kunde, Deadline, Planungsstatus |
| Aufgaben | Titel, Beschreibung, Status, Priorität, Epic im selben Projekt |
| Epics | Titel, Beschreibung |
| Geplante Sprints | Titel, Ziel, Zeitraum, Aufgaben aus demselben Projekt |
| Wiki-Artikel | Titel, Inhalt, Kategorie |
| Wiki-Kategorien | Name, Beschreibung |
| Projektdateien | Name; Bytes und sonstige Metadaten bleiben erhalten |

Beispiele: „Ändere den Ort von Kunde #1 auf Köln“, „Setze Aufgabe #12 auf erledigt“,
„Verschiebe die Deadline von Projekt #1 auf 2026-11-30“, „Benenne Datei #4 in notes.txt um“.
Nicht genannte Felder bleiben unverändert. Leere Epic-/Kategoriewerte entfernen die
Zuordnung; eine leere Aufgabenliste leert den geplanten Sprint. Pflichttexte bleiben Pflicht.
Kennungen, Projektzugehörigkeit, Codes und Erstellungsdaten sind unveränderlich. Aktive/
abgeschlossene Sprints, Sprintstart/-abschluss, Konto-/Passwort-/Rollenänderungen,
Einstellungen schreiben, Dateiinhalte überschreiben und Löschen gehören nicht dazu.

## Protokoll und Bestätigung

`propose_workspace_update(entity, target, fields)` verlangt eine eigene eindeutige
Kennung (#ID) oder exakten Namen/Titel und eine Liste von `{ name, value }`-Zeichenketten.
Mehrdeutige Namen verlangen eine Kennung. Unbekannte, doppelte und sensible Felder werden
vor dem Protokollieren abgewiesen. Fachregeln/DTO-Prüfung laufen bereits ohne Speicherung.
Unveränderte Werte ergeben keine leere Aktion. Nur ausdrücklich gewünschte Felder vorschlagen.

`type=workspace.update`, `data={id, ...geänderteFelder}` und `before={...bisherigeWerte}`
bilden die unveränderliche Karte. Schlüssel stimmen bis auf id exakt überein. Alte/neue
Werte einschließlich Änderungszeitstempel werden vollständig angezeigt. Erst **Bestätigen
und ändern** speichert, **Ablehnen** verwirft. Chattext ist keine Bestätigung.

Vorschläge gelten fünf Minuten und stehen am Ende einer bestätigten Werkzeugfolge.
Der bestehende Pfad `POST /api/v1/ai/conversations/{id}/creations/{actionId}/decision`
bedient beide Typen. Im Request steht nur die Entscheidung, niemals Ersatzdaten oder
austauschbare Vorherwerte. Anlage bleibt `workspace.create` ohne before.

Bestätigung prüft Sitzung, Inhaber, Gültigkeit, Workspace-Revision, Vorherwerte und Fachregeln
erneut. Zwischenzeitliche Änderungen ergeben `409 AI_CREATE_CONFLICT`; der bestehende Code
gilt auch für Updates. Kein stilles Überschreiben/Zusammenführen. Erfolgswiederholungen
schreiben nicht erneut. Aufgaben-/Epic-/Sprintänderungen und Dateiumbenennungen erzeugen
passende Aktivitäten. PostgreSQL speichert Fachänderung und Chatstatus gemeinsam; Fehler
beim nachgelagerten Statusschreiben rollen die Änderung zurück. Memory serialisiert Freigaben.
Verlorene Antworten werden nur nachgelesen, niemals automatisch erneut geschrieben.

Offene Formulare und ausstehende Speicherungen blockieren Freigaben. Nach Erfolg wird der
Workspace ohne Aushängen nachgeladen; zwischenzeitliche lokale Änderungen bleiben erhalten.

## Grenzen und Betrieb

Ungeänderte lange Texte bleiben vollständig erhalten. Ein geänderter Text und sein bisheriger
Wert dürfen jeweils höchstens 6000 Zeichen haben; keine still gekürzte Änderungsvorschau.
Größere Texte im normalen Editor bearbeiten. Beide Datenobjekte höchstens je 12000 JSON-Zeichen,
Werkzeugergebnis weiterhin höchstens 20000. Bestehende Modell-, Schritt- und Zeitlimits bleiben
erhalten, höchstens ein Vorschlag pro Nachricht. Dateiumbenennen verändert keine Bytes.

Gespräche mit Updates verwenden Aggregatformat **3**. Dieses Backend liest 1–3; ältere Chats
behalten ihr Format, solange keine Änderung hinzukommt. Ältere JARs können Format 3 nicht lesen.
Vor manuellem Downgrade nach Nutzung Sicherung/Datenerhalt prüfen; kein automatisches
Datenbank-Restore. Keine neue SQL-Migration, Pflichtvariable oder Abhängigkeit.

Strict-Schemas behalten Pflichtfelder und `additionalProperties=false` gemäß der
[offiziellen OpenAI-Dokumentation zu Function Calling](https://developers.openai.com/api/docs/guides/function-calling).
Modell und Anbindung bleiben erhalten. Tests verwenden Mock-Modelle und SDK-Loopback,
keine echte Provider-Anfrage. Browser- und Serverabnahme bleiben separate Prüfungen.
