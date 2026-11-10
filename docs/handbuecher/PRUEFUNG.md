# Prüfung der README und PDF-Handbücher

Stand: 6. November 2026.

## Inhalt und Umfang

- Root-README vollständig neu gegliedert und gegen die tatsächlichen Konfigurations-,
  Start-, Sicherungs- und Paketierungsskripte abgeglichen.
- Getrennte Wege für Frontend-Demo, ForgeFlow mit PostgreSQL, vollständige lokale Suite,
  bestehendes Ubuntu-Deployment und die Voraussetzungen einer neuen Serverinstallation.
- Voraussetzungen und Abhängigkeiten aller drei Nachbarprojekte aufgenommen, einschließlich
  Python-3.12-Venv für FlowPilot, pgvector/Alembic für den Hub und H2-Demo für PulseWatch.
- Acht lokale Ports, Herkunftsprüfung, Kontobootstrap, kein Standardpasswort, globale
  App-/KI-Auswahl, Französisch-Fallback, optionale Integrationen und Sicherungsgrenzen erklärt.
- Zwölf getrennte deutsche PDFs: zehn Suite-Apps sowie Einstellungen und Kundenportal.
  Insgesamt **83 Seiten**, **34 unterschiedliche UI-Aufnahmen**; die Portalverwaltung
  wird zur Einordnung in zwei Handbüchern gezeigt.

## Screenshot-Herkunft

Die Aufnahmen stammen aus den echten lokalen Produktionsfrontends mit einem isolierten
Headless-Edge-Browser. Alle API-Routen sind abgefangen und verwenden synthetische Daten.
Unbekannte API-Routen werden abgewiesen, externe Ziele nicht aufgerufen. Das finale
Aufnahmemanifest enthält keine Browserlaufzeitfehler und keine fehlenden API-Fixtures.
Eine Antwort im Knowledge Hub und sämtliche Messwerte sind ausdrücklich Beispiele,
kein Live-Modelltest und keine Verfügbarkeitsprüfung eines echten Endpunkts.

Die Cloud-Abbildung zeigt den Suite-Einstieg. Eine private Nextcloud-Oberfläche wurde
nicht geöffnet oder durch erfundene Screenshots ersetzt. Das Handbuch benennt diese Grenze.

## Ausgeführte Prüfungen

- Alle zwölf PDFs nach Erzeugung erneut geöffnet; Text auf jeder Seite vorhanden.
- Textblöcke innerhalb der vorgesehenen Seitenränder automatisiert geprüft.
- Alle 83 Seiten gerendert und anhand der Kontaktbögen visuell geprüft; ausgewählte
  Detailseiten zusätzlich in voller Auflösung betrachtet.
- Dabei die FlowPilot-Jobansicht nach einem überlagernden Entwurf korrigiert und die
  sichtbaren PulseWatch-Messwerte ergänzt; anschließend alle PDFs erneut erzeugt.
- Keine erkannten Überlagerungen, abgeschnittenen PDF-Texte oder fehlerhaften Glyphen.
- Alle lokalen Markdown-Links der README und des Handbuchindexes auf Existenz geprüft.
- Sämtliche PowerShell-Befehlsblöcke der README syntaktisch geparst; keine Parsefehler.
- JavaScript-Aufnahmeskript mit `node --check` geprüft; JSON-Quellen erfolgreich gelesen.
- ZIP-Integrität geprüft: zwölf separat lesbare PDF-Dateien und ein Inhaltsmanifest.
- Frontend-Lint und Produktionsbuild erfolgreich. Keine fachliche App-Implementierung
  geändert; bestehende Funktionstests wurden für diesen Dokumentationsauftrag nicht erneut
  ausgeführt.

Die Einrichtung wurde anhand des Codes und vorhandener Betriebswege überprüft, nicht als
komplette Neuinstallation auf einem frischen PC oder leeren Server ausgeführt. Laufende
Produktivdienste und Konten wurden nicht verändert. Die zwei lokalen Screenshot-Server
wurden beendet; temporäre PDF-Renderbilder nach der Sichtprüfung entfernt. Finale PDFs,
Screenshots, Quellen und Generatoren bleiben erhalten.
