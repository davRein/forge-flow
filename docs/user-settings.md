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

```json
{
  "version": 1,
  "settings": {
    "themeMode": "dark",
    "defaultProjectView": "dashboard",
    "defaultTaskPriority": "medium"
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

## Spätere Datenbank-Anbindung

Das Spring-Gerüst implementiert die Endpunkte bereits über `WorkspaceStorage.loadSettings` und
`saveSettings`. Aktuell speichert der Referenzadapter im Backend-Arbeitsspeicher. Beim Neustart
gehen diese Werte verloren. Für dauerhafte Speicherung wird dieser Adapter durch ein Spring-Data-
Repository mit eindeutiger `user_id`, Formatversion, Einstellungswerten und Änderungszeitpunkt ersetzt.
Einstellungen bleiben von Projekt-, Kunden-, Aufgaben-, Datei- und Wiki-Daten getrennt.

Weitere Details: [Backend-Vertrag](backend-api.md), [Spring-Boot-Gerüst](../backend/README.md).

## Prüfung

`npm test` prüft Benutzertrennung, Versionen, Ladefehler, geordnete Schreibvorgänge, Wiederholung,
Zurücksetzen und verspätete Antworten. Spring-Tests prüfen die geschützten Settings-Endpunkte,
Kontozuordnung und Abmeldung. Lint und Build prüfen die TypeScript-Anbindung.
