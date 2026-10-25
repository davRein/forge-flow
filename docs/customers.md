# Kundenformular und globale Branchen

Zusätzlich verfügbar: [Kundendetailseite mit Ansprechpartnern und internen Notizen](customer-details.md).
Die folgenden Abschnitte beschreiben Formular, PLZ und die globale Branchenliste.

Das Kundenformular gliedert die Eingaben in Unternehmen, Anschrift und Kontakt.
Beschriftungen/Pflichtsterne stehen zusammen, Anschrift und Kontakt sind logisch gruppiert,
PLZ/Ort stehen nebeneinander; schmale Fenster verwenden eine Spalte. Gemeinsame Theme-Tokens,
DE/EN-Beschriftungen, Formular-Autocomplete und das vorhandene Dialog-/Fokusverhalten bleiben erhalten.

## PLZ

`Customer.postalCode` ist ein Textfeld mit höchstens 32 Zeichen. Führende Nullen und
internationale Werte wie `SW1A 1AA` bleiben erhalten. Im Kundenformular ist es ein Pflichtfeld;
für bestehende API-Clients und gespeicherte Kunden bleibt eine leere PLZ zulässig.
Keine automatische Ergänzung erfundener Postleitzahlen. Beim Bearbeiten eines Kunden ohne
PLZ muss das Formular vervollständigt werden. Detailansicht und Suche berücksichtigen
die PLZ; die Übersicht zeigt nur Name, Branche und Ort. Die bisherigen übrigen Pflichtfelder bleiben erhalten.

Flyway **V6** ergänzt `ff_customers.postal_code VARCHAR(32) NOT NULL DEFAULT ''`.
Vorhandene Kunden erhalten einen leeren Wert; Mapper, DTO, Memory- und JPA-Speicher,
Workspace-Manifest, Frontend und KI-Anlage/Änderung/Filter verwenden dasselbe Feld.
Alte Requests/Chats ohne Feld bleiben lesbar. Für die KI ist PLZ weiterhin optional,
entsprechend dem bisherigen partiellen Kunden-Anlageprotokoll.

## Globale Auswahlliste

Unter **Einstellungen → Globale Einstellungen → Kundenbranchen** können Administratoren
Einträge hinzufügen, umbenennen und aus der Liste entfernen. Aktive angemeldete Nutzer
können die Liste lesen und im Kundenformular auswählen. Die Liste gilt anwendungsweit,
getrennt von persönlichen Einstellungen und Workspace-Revisionen.

Es sind 1–100 eindeutige Namen mit je höchstens 100 Zeichen erlaubt. Leerzeichen an den
Enden werden entfernt, Unicode normalisiert; Duplikate ohne Beachtung der Großschreibung
und Kontrollzeichen werden abgewiesen. Änderungen brauchen einen ausdrücklichen Klick auf
„Branchenliste speichern“. Fehler erhalten den Entwurf, Konflikte verlangen erneutes Laden;
„Neu laden und Entwurf verwerfen“ ist ausdrücklich beschriftet. Der lokale Modus hält die
Liste nur während der Sitzung. API-Fehler führen zu keiner Ersatzliste mit Beispieldaten.

Die Migration legt `ff_global_settings` mit einer einzigen versionierten Konfiguration und
zwölf anfänglichen Branchen an. PostgreSQL speichert sie dauerhaft. Memory hält sie nur bis
zum Backend-Neustart. Die neue eigene Revision schützt gegen paralleles Überschreiben.
Ein offener Listenentwurf blockiert die vorhandenen KI-Freigaben wie andere offene Formulare.

`GET /api/v1/settings/global` liefert `{revision, industries}` mit ETag für angemeldete Nutzer.
`PUT /api/v1/settings/global` verlangt aktuelle Administratorrechte, Origin/CSRF und
`If-Match: "revision"`; der Body enthält dieselbe Revision. Veraltete Revision: 409;
fehlender Header: 428; fehlerhafte Daten: 400/422. Keine automatische Schreibwiederholung.
`read_workspace(entity=industries)` kann die aktuelle Auswahlliste auch für KI-Fragen lesen;
globale Einstellungen ändern ist kein KI-Werkzeug.

Die bisherige Branche eines Kunden bleibt ein Textwert. Umbenennen/Entfernen eines
Katalogeintrags verändert keine Kunden. Ein bestehender Wert außerhalb der Liste bleibt
beim Bearbeiten als „Bisheriger Wert“ auswählbar. Der kompatible Workspace-/KI-Vertrag
akzeptiert weiterhin historische Branchentexte; keine neue Fremdschlüsselpflicht.

## Installation und Abnahme

Frontend und Backend gemeinsam mit dem vollständigen Updatepaket aktualisieren. V6 läuft
beim Backendstart automatisch; keine manuelle SQL-Ausführung, neue Installation oder
Pflichtvariable nötig. Das vorhandene Linux-Update-Skript erstellt vorab einen Datenbankdump.
Ein manueller Downgrade auf ein altes Backend kann neue PLZ-Werte beim Schreiben verlieren;
Migrationen nicht manuell löschen/zurücksetzen, Backup/Datenerhalt vorher prüfen.

Automatisierte Tests prüfen Migration mit Bestandskunden, dauerhaftes Lesen nach Start
einer zweiten Backend-Instanz, führende Nullen/internationale PLZ, Rollen/CSRF/Origin,
Versionskonflikte, Unicode-/Duplikatprüfung, API-Fehler ohne Ersatzdaten, Abbruch nach Logout,
Formulargliederung/Dropdown/DE-EN und Altwerte. Die Browserabnahme steht separat in
[browser-check.md](browser-check.md); in diesem Durchlauf war kein Browser verfügbar.
