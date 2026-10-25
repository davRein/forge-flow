# Navigation, offene Entwürfe und Dashboard-Historie

Die Haupttabs Dashboard, Projekte, Kunden und Einstellungen öffnen bei jedem Klick
ihre Hauptansicht. Projekt-/Kundenauswahl und Einstellungskategorie sind nicht Teil
dieser Hauptlinks. Auch ein Klick auf den bereits aktiven Haupttab setzt die Ansicht
zurück. Einstellungen starten wie bisher mit Optik.

Ein Projekt wird immer unter `#/projectManager/projects?project=ID` geöffnet, auch aus
dem Dashboard oder einem Kunden heraus. Damit wird Projekte zum aktiven Haupttab.
Kundendetails bleiben unter `#/projectManager/customers?customer=ID` erreichbar.
Beide Objektansichten lassen sich direkt verlinken. Die Hauptnavigation entfernt
die Objektparameter; gewöhnliche Kunden-Detail-/Zurücklinks erhalten andere Parameter.

## Ungespeicherte Änderungen

Ein gemeinsamer Guard schützt Wechsel über Haupttabs, die Modulnavigation,
Einstellungskategorien, Projektuntertabs und Objekt-/Historienaktionen. Veränderte
Projekt-/Kundenformulare, Ansprechpartner/Notizen, Aufgabenformulare, Epic-/Sprint-
Formulare, Dateiumbenennung sowie Profil-, Passwort-, Benutzeranlage- und Branchen-
Entwürfe melden ihren Zustand. Ein nur geöffnetes, unverändertes Formular warnt nicht.

Das kleine Dialogfenster bietet:

- **Auf dieser Seite bleiben:** Zielwechsel abbrechen und Eingaben erhalten.
- **Änderungen verwerfen und wechseln:** gemeldete Entwürfe zurücksetzen/schließen
  und erst anschließend die gewählte Ansicht öffnen. Es erfolgt kein Formular-Submit.

Das Schließen der Rückfrage oder Escape entspricht Bleiben. Offene Entwürfe sperren
weiterhin die bestätigte KI-Navigation. Beim Neuladen/Schließen des Browserfensters
verwendet der Guard die browserübliche Warnung.

Allgemeine Einstellungen sowie gespeicherte Fachänderungen werden weiterhin
automatisch übertragen. Während einer laufenden Übertragung lässt sich diese nicht
als verworfen behandeln: Die Navigation wartet; nach bestätigtem Erfolg wird der
angeforderte Wechsel automatisch fortgesetzt. Scheitert das Speichern, bleibt die
Rückfrage erforderlich. Explizites Verwerfen stellt den zuletzt bestätigten lokalen
Stand wieder her und sendet keinen erneuten Schreibaufruf. Workspace-Revisionen
verhindern ein unbemerktes Überschreiben, falls eine verlorene Antwort tatsächlich
zu einem bereits erfolgten Server-Commit gehört; nötigenfalls Serverstand neu laden.
Keine zusätzlichen Speichern-Buttons für bereits automatisch gespeicherte Vorgaben.

## Letzte Änderungen

Das Dashboard zeigt höchstens **fünf** Einträge, neueste zuerst, mit übersetzter
Aktionsbeschreibung und Datum/Uhrzeit. Ein Klick öffnet das aktuelle Objekt im passenden
Haupttab. Es handelt sich um eine Navigationshilfe, keine Wiederherstellung alter Stände.

Aufgezeichnet werden erfolgreiche:

- Kundenanlagen und -änderungen, einschließlich Ansprechpartner und Notizen.
- Projektanlagen und -änderungen. Aufgaben-, Epic-, Sprint- und Dateiänderungen
  erzeugen eine Projektänderung; mehrere Änderungen desselben Projekts innerhalb
  eines gemeinsamen Commits ergeben einen Projektevent.
- Änderungen der persönlichen allgemeinen Einstellungen; der Eintrag öffnet die
  Hauptseite der Einstellungen. Profil-/Passwort-/Kontoverwaltung und globale
  Branchenliste haben keinen eigenen Historieneintrag.

Lesen, Navigieren, unverändertes Speichern, fehlgeschlagene oder verworfene Änderungen
erzeugen keine Einträge. Wird ein Objekt gelöscht, verschwinden seine bisherigen
Einträge, damit keine Links zu entfernten Objekten angezeigt werden. Einträge können
denselben Datensatz mehrfach nennen. Namen sind auf 200 UTF-16-Zeichen begrenzt;
Kontaktdaten, Notizen, Passwörter, Dateien und private REST-Anfragen werden nicht kopiert.

Die Historie ist pro Benutzerkonto getrennt und bleibt mit PostgreSQL nach Abmeldung,
Neuladen und Backend-Neustart erhalten. KI-Änderungen verwenden dieselbe Speicher-
transaktion und werden ebenfalls erfasst. In lokaler Vorschau erscheinen bestätigte
Fachänderungen nur in der laufenden Sitzung; Memory-Backenddaten bleiben bis Neustart.

## API und Migration

`GET /api/v1/me/recent-activity` benötigt eine aktive authentifizierte Sitzung und
liefert `{ "entries": [...] }`. Ein Eintrag enthält `id` (UUID), `kind`
(`customer`, `project`, `settings`), `action` (`created`, `updated`), `entityId`
(positive Kennung; bei Einstellungen null), `name` und `at` (ISO-Zeitstempel).
Es gibt keinen schreibbaren Historienendpunkt. Daten-/Ladefehler werden angezeigt;
API-Modus wechselt nicht auf eine lokale Ersatzhistorie.

Flyway **V10** erstellt `ff_recent_activity` mit Konto-Fremdschlüssel und JSON-Payload.
Die Aktualisierung erfolgt unter derselben Kontosperre und Datenbanktransaktion wie
Workspace bzw. persönliche Einstellungen. Schlägt eine der beiden Ablagen fehl,
werden beide zurückgerollt. `GET/PUT /workspace` und Einstellungen behalten ihren
bisherigen Vertrag; keine neuen Felder im Workspace oder im KI-Gesprächsformat.

Die Migration startet bestehende Konten mit leerer Historie und erzeugt keine
nachträglichen Ereignisse aus vorhandenen Fachdaten. Keine neue Konfiguration oder
Abhängigkeit erforderlich. Beide Update-Artefakte gemeinsam installieren; bestehendes
Update-Skript sichert die Datenbank. Migrationen bei Downgrades nicht manuell löschen.

Automatisierte Tests prüfen reale Tab-/Objektwechsel, Entwurf behalten/verwerfen,
Speicherfehler und laufende Übertragungen, fünf Einträge/Links, Kontoisolation,
No-op-/Revisionsschutz, atomaren Rollback und Persistenz in einer neuen Backend-Instanz.
Die visuelle Browserprüfung bleibt unter [browser-check.md](browser-check.md) offen.
