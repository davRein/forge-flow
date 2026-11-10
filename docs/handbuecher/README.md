# Benutzerhandbücher als PDF

Die Handbücher erklären Zweck, Voraussetzungen, Ansichten, Felder, typische Arbeitsabläufe
und häufige Probleme jeder App. Die Abbildungen zeigen die echten Oberflächen der lokalen
Builds mit synthetischen Beispieldaten, keinen Zugriff auf produktive Kundenkonten.
Stand: 6. November 2026. Die Handbücher sind auf Deutsch.

## Download

[Alle zwölf Handbücher als ZIP](../../output/pdf/ForgeFlow-Alle-Handbuecher.zip)

| Handbuch | Inhalt |
| --- | --- |
| [01 Projektmanager](../../output/pdf/01-Projektmanager.pdf) | Kunden, Projekte, Aufgaben, Board, Epics, Sprints, Dateien und KI |
| [02 Git](../../output/pdf/02-Git.pdf) | GitHub-Zugang, Repositoryauswahl und Server-Clones |
| [03 Dokumentation](../../output/pdf/03-Dokumentation.pdf) | Bereiche, Seiten, Hierarchie, Markdown und Suche |
| [04 Entwicklerwerkzeuge](../../output/pdf/04-Entwicklerwerkzeuge.pdf) | JSON, REST, Rechner, Konverter, Snippeter und DB Scripter |
| [05 Zeiterfassung](../../output/pdf/05-Zeiterfassung.pdf) | Kalender, Buchungen, Auswertung, Exporte und Stoppuhr |
| [06 Business](../../output/pdf/06-Business.pdf) | Budgets, Vorlagen, Angebote/Rechnungen und Portalverwaltung |
| [07 Cloud](../../output/pdf/07-Cloud.pdf) | Cloud-Einstieg, Nextcloud-Abgrenzung und getrennte Konten |
| [08 AI Knowledge Hub](../../output/pdf/08-Knowledge-Hub.pdf) | PDF-Bibliothek, Dokumentauswahl, Antworten und Quellen |
| [09 FlowPilot](../../output/pdf/09-FlowPilot.pdf) | Designer, Validierung, Ausführungen, Integrationen und Jobs |
| [10 PulseWatch](../../output/pdf/10-PulseWatch.pdf) | Monitore, Kennzahlen, Prüfergebnisse und Alarmgrenzen |
| [11 Einstellungen](../../output/pdf/11-Einstellungen.pdf) | Persönliche Vorgaben, Sprache und globale App-/KI-Auswahl |
| [12 Kundenportal](../../output/pdf/12-Kundenportal.pdf) | Freigegebene Inhalte aus Kundensicht und Betreiberfreigabe |

Die Cloud-Abbildung zeigt bewusst den ForgeFlow-Einstieg. Eine private Nextcloud-Instanz
wurde nicht geöffnet; deren Oberfläche und installierte Erweiterungen sind nicht Teil
dieses Softwarestands. Die Dokumentation verspricht keine noch nicht vorhandenen
Tickets, E-Mail-Zustellungen oder automatischen externen Aktionen.

## Technische Anleitungen

Die [Root-README](../../README.md) beschreibt Installation und Start. Vertiefend:
[lokaler Betrieb](../local-operation.md), [Deployment](../showcase-deployment.md),
[Backend](../../backend/README.md) und [API-Vertrag](../backend-api.md).

## Reproduzierbar aktualisieren

- Inhaltliche Quelle: [inhalte.json](inhalte.json).
- Screenshots und Aufnahmemanifest: `screenshots/`.
- Aufnahme: `node scripts/capture-manual-screenshots.mjs` aus der Suite-Wurzel.
  Benötigt gebaute Suite-/FlowPilot-/PulseWatch-Frontends mit den dokumentierten
  Produktionspfaden, Playwright aus dem FlowPilot-Projekt und einen lokalen
  Knowledge-Hub-Produktionsserver auf `127.0.0.1:5301` mit Base-Path `/knowledge-hub`.
  Der Aufnahmeserver bindet ausschließlich an `127.0.0.1:5521`. Alle API-Anfragen werden
  abgefangen; es werden keine Live-Provider oder Produktivkonten verwendet.
- PDF-Erzeugung: `python scripts/build-user-manuals.py` mit ReportLab, Pillow und PyMuPDF.
  Schriften: Arial unter `C:/Windows/Fonts/`; für andere Systeme den Schriftpfad im
  Generator anpassen. Finale Dateien liegen in `output/pdf/`.
- Der Generator öffnet jedes PDF erneut, prüft Text und Seitenränder und rendert alle
  Seiten nach `tmp/pdfs/`. Kontaktbögen und Einzelbilder anschließend visuell prüfen;
  die Textextraktion allein ist keine Layoutabnahme.

Die Quellen bleiben editierbar. Ein geänderter Softwarestand erfordert neue Aufnahmen
und eine erneute inhaltliche Prüfung der Bedienwege und Funktionsgrenzen.
