# RequestLab

RequestLab ist eine eigene App innerhalb von ForgeFlow. Sie übernimmt den bisherigen
REST-Client aus Dev Tools mit eigener Navigation, eigenem Symbol und eigenem
Seitenkontext. Sie benötigt keinen zusätzlichen Prozess, Port oder separaten Login.

- Lokal: <http://localhost:5173/#/requestLab/client>
- Nach einem späteren Release: `https://forge-flow.de/#/requestLab/client`.
- Alte Direktlinks `#/devTools/rest` werden inklusive Suchparametern weitergeleitet.

## Anfragen und Collections

Methoden, URL, Header, JSON/Text-Body und Zeitlimit werden weiterhin manuell eingegeben.
Erst **Anfrage senden** führt HTTP aus. Laden, Speichern, Navigation und Sprachwechsel
senden keine Anfrage. Antworten zeigen Status, Dauer, Header und begrenzten Inhalt.
Ungespeicherte Entwürfe und Antworten bleiben beim App-Wechsel erhalten und enden beim
Neuladen. Collections können angelegt, durchsucht, umbenannt und gelöscht werden;
Anfragen lassen sich aktualisieren oder als Kopie speichern. Ersetzen und Löschen
werden weiter bestätigt. Antworten werden nicht gespeichert.

Im API-Betrieb verwendet RequestLab dieselben privaten `/api/v1/me/rest-collections`
und dieselbe Kontenspeicherung wie vorher. Es gibt weder Datenkopie noch neue Collection-
IDs oder Datenmigration. CSRF, Revisionsprüfung, Logout-/Kontowechsel-Isolation und
Fehlerbehandlung bleiben erhalten. Die lokale Vorschau bleibt auf ihre Sitzung begrenzt.

## App-Auswahl und Sicherheit

V19 ergänzt RequestLab in einer bestehenden globalen Auswahl direkt hinter Dev Tools,
wenn Dev Tools bisher sichtbar war. Wer Dev Tools ausgeblendet hatte, erhält keine neue
sichtbare App. Administratoren können RequestLab unabhängig ein-/ausblenden. Alle anderen
App-Auswahlen und KI-Freigaben bleiben unverändert; neue Installationen zeigen zwölf Apps.

Anfragen laufen direkt im Browser mit `credentials: omit` und ohne Referrer. Zielserver
müssen CORS erlauben; es gibt keinen neuen Serverproxy. Gespeicherte Header/Body-Inhalte
werden nur ausdrücklich vom Benutzer gespeichert. Der KI-Seitenkontext enthält keine
URLs, Header, Zugangsdaten, Request-Bodies oder Antworten. Die App erhält keine Werkzeuge
zur HTTP-Ausführung durch den Assistenten. Browser-Direktanfragen sind keine SSRF-Funktion
des ForgeFlow-Servers. Bestehende Größen-, Header- und Zeitlimits bleiben unverändert.

## Prüfung

`npm.cmd test` umfasst RequestLab-Komponenten, Sammlungen, HTTP-Grenzen, Sprachen und
Navigation. `scripts/test-postgres-isolated.ps1` prüft das Backend und V19 mit einer
separaten temporären PostgreSQL-Instanz. Die V19-Erhaltungstests prüfen auch ausgeblendete
Dev Tools und unveränderte KI-Freigaben.

Bei laufender lokaler Suite:

```powershell
node scripts/test-requestlab-browser.mjs
```

Der isolierte Edge-Test verwendet synthetische APIs und abgefangene HTTP-Antworten.
Er prüft manuelles Senden, Speichern, erhaltene Entwürfe/Antworten, alte Links und
Mobilbreite. Screenshots liegen unter `node_modules/.tmp/requestlab-*.png`.
Es werden keine echten Konten, Ziele oder kostenpflichtigen Dienste verwendet.
