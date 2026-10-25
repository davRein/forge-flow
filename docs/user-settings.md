# Benutzerspezifische Einstellungen

Die Einstellungen verwenden einen asynchronen, austauschbaren Speicher. Im lokalen Modus arbeitet
`sessionSettingsRepository` mit einer getrennten Map je Kennung. Im API-Modus verwendet
`apiSettingsRepository` die Endpunkte `GET /api/v1/me/settings` und `PUT /api/v1/me/settings`.
Die Kennung kommt aus der geprüften Anmeldung. Das Backend bestimmt den Eigentümer aus der
Serversitzung; der Client sendet keine frei wählbare Benutzerkennung an diese Endpunkte.

## Aufbau

- `settingsRepository.ts`: Vertrag mit `persistence: 'session' | 'account'`, `load` und `save`.
- `settingsSerialization.ts`: versioniertes Datenformat und Ergänzung fehlender gültiger Werte.
- `settingsStore.ts`: Laden, sofortige Anwendung, geordnete Schreibvorgänge, Fehler und Wiederholen.
- `apiSettingsRepository.ts`: HTTP-Adapter mit fester Konto- und Sitzungszuordnung. Alte Operationen
  dürfen nach einer erneuten Anmeldung nicht unter dem neuen Benutzer gesendet werden.
- `useAppSettings.ts`: React-Anbindung. Ein Kontowechsel erzeugt einen eigenen Store; verspätete
  Ladeantworten verändern den neuen Store nicht.

Die Anwendung lädt Einstellungen vor der ersten Seitenweiterleitung. Zurücksetzen schreibt die
Vorgaben über denselben Speicherweg. Ein Speicherfehler erhält die Auswahl und zeigt Wiederholen.

## Datenformat

`themeMode` unterstützt `dark`, `light`, `aurora` und `dune`. Aurora kombiniert dunkles
Petrol mit Mint, Dune helle Sandtöne mit Terrakotta. Unter Optik stehen vier kompakte
Vorschauen mit nativen Radiobuttons in zwei Spalten, auf schmalen Fenstern in einer
Spalte. Auswahl und Beschreibung sind auf Deutsch/Englisch verfügbar. Eine Auswahl
gilt sofort für die gesamte Anwendung und wird über den vorhandenen Kontospeicher
gesichert. Es gibt keine zusätzliche Browser- oder globale Theme-Einstellung.

```json
{
  "version": 1,
  "settings": {
    "themeMode": "dark",
    "defaultProjectView": "dashboard",
    "defaultTaskPriority": "medium",
    "language": "de"
  }
}
```

`GET` liefert JSON `null`, wenn noch keine Einstellungen existieren. Unbekannte Formatversionen
werden nicht überschrieben. `version` ist die Formatversion, keine Konfliktversion. Im Client
werden Schreibvorgänge einer Store-Instanz geordnet; gleichzeitige Einstellungen mehrerer Geräte
folgen derzeit der zuletzt beim Server eingegangenen Änderung.

`App` akzeptiert für Integration und Tests weiterhin `userId` und `settingsRepository` als Props.
Im normalen API-Betrieb werden beide aus der echten Sitzung und dem HTTP-Adapter abgeleitet.
Beim Abmelden während unbestätigter Änderungen wird vor dem Verwerfen lokaler Daten nachgefragt.

## Einstellungsmenü und Sprache

Der Einstellungstab hat ein eigenes Menü mit Nutzerverwaltung, Optik, Projektmanager
und Sprache. `?category=users|appearance|projects|language` erlaubt Direktlinks;
ohne gültige Kategorie wird Optik angezeigt. Kontoentwürfe bleiben beim Wechsel
zwischen den Kategorien erhalten. Auf schmalen Bildschirmen steht das Menü oben.

`settings.language` unterstützt `de` und `en`. Fehlende/ungültige Werte im gespeicherten
Client-Format übernehmen die aktuelle Browservorgabe, sonst `en`. Der Server akzeptiert ausschließlich diese
beiden Sprachcodes; alte Requests ohne Sprachfeld bleiben gültig und verwenden Deutsch.
Der Sprachwechsel übersetzt die Einstellungen einschließlich ihrer Kontoformulare,
Wiki und Dev Tools sowie gemeinsame Navigation und Statusmeldungen. Benutzereingaben, Wiki-Inhalte, JSON-Werte
und REST-Antworten werden nicht übersetzt. Alle Einstellungen zurücksetzen setzt auch
die Sprache auf Englisch zurück.

### Sprache vor der Anmeldung

Der Login einschließlich Sitzungsprüfung, Formularbeschriftungen, Fehlern und Hinweisen
verwendet denselben Übersetzungsdienst. Die zuletzt angewendete Kontosprache bzw. manuelle
Auswahl wird zusätzlich als `de` oder `en` unter `forgeflow.language` im Local Storage
dieses Browsers und dieser Website gespeichert. So bleibt insbesondere eine englische
Auswahl nach Abmeldung, Neuladen oder erneutem Browseraufruf erhalten. Es werden dort
keine Kontokennungen, Zugangsdaten oder Sitzungstokens abgelegt. Bei gesperrtem oder vollem
Browserspeicher funktioniert der Sprachwechsel für die laufende Seite weiter; nach deren
Schließen kann die Auswahl dann nicht dauerhaft erhalten bleiben.

Ohne gemerkte Sprache gilt Englisch. Nur wenn die primäre Browser-Locale eine explizite
Region `DE`, `AT` oder `CH` enthält, wird Deutsch vorausgewählt, auch beispielsweise bei
`fr-CH` oder `en-DE`. Ein bloßes `de` ohne Region reicht nicht; unbekannte/ungültige Angaben
führen zu Englisch. Dies ist ein Browserregionshinweis, keine Bestimmung des tatsächlichen
Aufenthaltsorts. Keine GPS-Freigabe, IP-Geolokalisierung oder zusätzliche Netzwerkanfrage.

Nach der Anmeldung hat eine gültige gespeicherte Kontosprache Vorrang und aktualisiert
auch die Vorgabe für den nächsten Login in diesem Browser. Ohne Kontoeinstellungen gilt
die Browserauswahl. Einstellungen werden beim Laden nicht automatisch zum Server geschrieben.
Das HTML-Attribut `lang` folgt der aktiven Sprache für Login und Anwendung. Bereits in
PostgreSQL gespeicherte deutsche Einstellungen bleiben bestehen; es gibt keine Migration.

## Speicherung im Backend

Die Endpunkte verwenden `WorkspaceStorage.loadSettings` und `saveSettings`. Das Memory-Profil
speichert nur bis zum Backend-Neustart. Das PostgreSQL-Profil speichert Einstellungen
kontogetrennt in `ff_settings`. Flyway V4 ergänzt die Sprachspalte mit Vorgabe `de` für
bestehende Zeilen; bisherige Optik- und Projektmanager-Vorgaben bleiben erhalten.
Einstellungen bleiben von Projekt-, Kunden-, Aufgaben-, Datei- und Wiki-Daten getrennt.

Flyway V11 erweitert die bestehende CHECK-Bedingung von `ff_settings.theme_mode` um
Aurora und Dune; vorhandene Werte, andere Einstellungen und Kontozuordnungen bleiben
erhalten. Eine Java-Migration ermittelt den durch PostgreSQL bzw. H2 erzeugten Namen
der alten Bedingung, da V1 keinen expliziten Namen vergeben hat. Keine neue Spalte,
Konfiguration oder Abhängigkeit. Frontend und Backend gemeinsam aktualisieren: Ein
alter Server lehnt die neuen Werte ab; ein alter Client kennt sie nicht und zeigt
stattdessen seine Vorgabe an. Vor einem Rückwechsel zu einem alten Client alle
betroffenen Konten mit dem neuen Client auf Hell/Dunkel zurückstellen.

Weitere Details: [Backend-Vertrag](backend-api.md), [Spring-Boot-Gerüst](../backend/README.md).

## Prüfung

`npm test` prüft Benutzertrennung, Versionen, Ladefehler, geordnete Schreibvorgänge, Wiederholung,
Zurücksetzen und verspätete Antworten. Spring-Tests prüfen die geschützten Settings-Endpunkte,
Kontozuordnung und Abmeldung. Lint und Build prüfen die TypeScript-Anbindung.
