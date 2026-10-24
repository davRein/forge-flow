# PROJECT HANDOFF — AI Agent Integration for Existing React / Spring Boot Application

## 1. Rolle und Zielsetzung

Du agierst als erfahrener Senior Fullstack Software Architect und AI Engineer mit Schwerpunkt auf:

- React und TypeScript
- Java und Spring Boot
- Spring AI
- LLM Integration
- Agentic AI und Tool Calling
- Softwarearchitektur und Design Patterns
- REST APIs und Server-Sent Events
- Security, Testing und Performance

Deine Aufgabe ist es, einen modernen, erweiterbaren KI-Assistenten in die bereits existierende React-/Spring-Boot-Anwendung zu integrieren.

**WICHTIG:** Dieses Projekt existiert bereits. Es soll kein neues Projekt angelegt und keine bestehende Architektur ohne Notwendigkeit ersetzt werden.

Analysiere zunächst die vorhandene Codebasis, bevor du Architekturentscheidungen triffst oder Änderungen durchführst.

Das Ziel ist ein produktionsnaher, sicherer und modular erweiterbarer KI-Agent, der Benutzer bei der Bedienung der Anwendung unterstützt und über kontrollierte Tool-Aufrufe mit deren Funktionalität interagieren kann.

---

## 2. Verbindliche Arbeitsweise

Arbeite in zwei Phasen.

### Phase A — Bestandsaufnahme und Architekturplanung

Untersuche zunächst das gesamte Projekt und ermittle:

1. Projektstruktur und vorhandene Module.
2. Verwendete Java-Version.
3. Spring-Boot-Version und Dependency Management.
4. Vorhandene React-Version und TypeScript-Konfiguration.
5. Frontend-Build-System und Package Manager.
6. Eingesetzte UI-Komponentenbibliotheken.
7. Bestehende REST-Endpunkte und Service-Klassen.
8. Vorhandene Authentifizierung und Autorisierung.
9. Verwendete Datenbanken und Persistenztechnologien.
10. Vorhandene Frontend-State-Management-Lösung.
11. Bereits existierende Funktionen, die als Agent-Tools geeignet wären.
12. Vorhandene Tests, Konfigurationen und Deployment-Mechanismen.

Berücksichtige vorhandene Konventionen, Abstraktionen und Design Patterns.

Lies gegebenenfalls vorhandene `AGENTS.md`-Dateien und projektspezifische Entwicklungsrichtlinien.

Prüfe vorhandene Dateien, bevor du neue Services, Komponenten oder Dependencies einführst.

**Ergebnis von Phase A:**

Erstelle einen kurzen Architekturbericht mit:

- Zusammenfassung des Ist-Zustands.
- Empfohlener Integrationsarchitektur.
- Wiederverwendbaren Komponenten.
- Notwendigen neuen Komponenten.
- Geplanten Dependencies.
- Sicherheits- und Integrationsrisiken.
- Konkretem Implementierungsplan mit Meilensteinen.

Warte nach dem Architekturbericht auf meine Freigabe, bevor du Phase B startest.

### Phase B — Schrittweise Implementierung

Nach meiner Freigabe implementierst du den KI-Agenten in kleinen, nachvollziehbaren Schritten.

Führe nach jedem Meilenstein geeignete Builds und Tests aus. Berichte, welche Dateien verändert wurden, welche Tests erfolgreich waren und welche Probleme noch bestehen.

Vermeide unnötige Refactorings bestehender Anwendungsteile.

---

## 3. Zielarchitektur

Die bevorzugte Architektur besteht aus:

**Frontend:**
- React
- TypeScript
- Vorhandenes UI-Framework
- Wiederverwendbares Chat-Widget
- Streaming der Antworten
- Anzeige von Tool-Ausführungen
- Benutzerbestätigung für kritische Aktionen

**Backend:**
- Bestehendes Spring Boot
- Spring AI, sofern mit der vorhandenen Spring-Boot-Version kompatibel
- LLM-Anbindung über einen austauschbaren Provider
- Agent Orchestration Service
- Tool Registry
- Tool Execution Layer
- Authorization Layer
- Conversation Management

**Persistenz:**
- Vorhandene Datenbank bevorzugen
- Speicherung von Konversationen
- Speicherung relevanter Tool-Ausführungen
- Benutzerbezogene Trennung der Daten

Neue Technologien dürfen nur eingeführt werden, wenn sie technisch begründet und mit der bestehenden Architektur kompatibel sind.

Die Architektur sollte zunächst als modularer Monolith umgesetzt werden. Keine Microservices nur um der Microservices willen.

---

## 4. LLM Integration

Implementiere eine abstrahierte LLM-Anbindung.

Bevorzugt:

- Spring AI
- OpenAI als initialer Provider
- Möglichkeit, später Claude oder andere Anbieter einzubinden

Das konkrete Modell soll konfigurierbar sein und nicht fest im Quellcode stehen.

Wichtige Anforderungen:

- API-Schlüssel nur serverseitig verwalten.
- Keine Secrets im Repository.
- Externe Konfiguration über Umgebungsvariablen.
- Konfigurierbare Modellparameter.
- Timeouts und Fehlerbehandlung.
- Nutzungs- und Tokenlimits.
- Streaming-Unterstützung.
- Strukturierte Fehlerantworten.

Verwende offizielle, zu den Projektversionen kompatible APIs. Überprüfe aktuelle Spring-AI-Methoden und Dependencies, bevor du Code erzeugst.

---

## 5. React AI Chat Interface

Entwickle eine wiederverwendbare Chat-Komponente, die sich in das vorhandene Layout integriert.

Anforderungen:

- Chat über einen Button öffnen und schließen.
- Chat soll die eigentliche Anwendung nicht blockieren.
- Nachrichtenverlauf darstellen.
- Benutzernachrichten senden.
- Streaming-Antworten anzeigen.
- Lade- und Fehlerzustände darstellen.
- Requests abbrechen können.
- Neue Konversation beginnen.
- Bestehende Konversation später fortsetzen.
- Tool-Aufrufe und deren Status visualisieren.
- Kritische Aktionen bestätigen oder ablehnen.
- Responsive Darstellung.
- Tastaturbedienbarkeit und grundlegende Barrierefreiheit.
- Bestehendes Theme und Designsystem übernehmen.

Vermeide unnötige externe UI-Abhängigkeiten.

Verwende vorhandenes State Management, sofern geeignet. Falls keines vorhanden ist, entscheide begründet zwischen React Context, Custom Hooks und einer kleinen State-Management-Bibliothek.

---

## 6. Context Awareness

Der Agent soll erkennen können, wo sich der Benutzer innerhalb der Anwendung befindet.

Dafür soll ein strukturierter Application Context bereitgestellt werden.

Mögliche Informationen:

- Aktuelle Route.
- Aktiver Anwendungsbereich.
- Geöffnete Komponente.
- Aktuell ausgewähltes Objekt.
- Verfügbare Aktionen.
- Relevanter Editorinhalt.
- Benutzerrolle und Berechtigungen.

Übertrage nur die für den konkreten Auftrag erforderlichen Daten.

Berechtigungen müssen serverseitig aus der authentifizierten Identität ermittelt werden. Vom Frontend übermittelte Rollen und Berechtigungen dürfen nicht als vertrauenswürdig gelten.

Kontextbezogene Daten können sich zwischen zwei Anfragen ändern. Berücksichtige daher veraltete Zustände und führe bei Aktionen erforderliche erneute Prüfungen durch.

Der Agent soll beispielsweise auf Fragen reagieren können wie:

- „Was kann ich auf dieser Seite machen?“
- „Erkläre mir diese Funktion.“
- „Analysiere die aktuell ausgewählten Daten.“
- „Bereite die passende Aktion dafür vor.“

---

## 7. Agentic AI und Tool Calling

Der zentrale Bestandteil der Implementierung ist ein Agent, der geeignete Funktionen der Anwendung selbstständig auswählen und über kontrollierte Schnittstellen ausführen kann.

Implementiere dafür eine klare Trennung zwischen:

1. LLM Reasoning und Tool-Auswahl.
2. Tool-Definition.
3. Eingabevalidierung.
4. Autorisierung.
5. Ausführung.
6. Ergebnisrückgabe.
7. Protokollierung.

Bevorzugt wird Spring AI Tool Calling.

Verfügbare Tools sollen anhand der tatsächlich existierenden Anwendungsfunktionen entwickelt werden.

Erfinde keine Fachfunktionen, die in der Anwendung nicht existieren.

### Tool Registry

Jedes Tool soll mindestens definieren:

- Eindeutigen Namen.
- Beschreibung.
- Eingabeparameter.
- Eingabevalidierung.
- Zugriffsberechtigung.
- Ob das Tool lesend oder schreibend arbeitet.
- Ob eine Benutzerbestätigung erforderlich ist.
- Fehlerbehandlung.
- Ausführungsstatus.

Bevorzuge typsichere Java-Implementierungen.

### Tool-Ausführung

Der Agent soll Aufgaben mit mehreren Tool-Aufrufen bearbeiten können.

Beispiel:

1. Benutzer stellt eine Anfrage.
2. LLM wählt ein geeignetes Tool.
3. Backend überprüft Parameter und Berechtigung.
4. Tool wird ausgeführt.
5. Ergebnis wird an das LLM zurückgegeben.
6. LLM entscheidet, ob weitere Tools benötigt werden.
7. Benutzer erhält eine nachvollziehbare Antwort.

Begrenze die maximale Anzahl der Agenten-Iterationen sowie Laufzeit und Ressourcenverbrauch.

---

## 8. Human-in-the-Loop

Kritische Aktionen dürfen nicht ohne ausdrückliche Benutzerfreigabe ausgeführt werden.

Dazu gehören insbesondere:

- Datensätze löschen.
- Datensätze verändern.
- Externe Daten übertragen.
- Externe Requests mit potenziellen Seiteneffekten.
- Konfigurationen verändern.
- Irreversible Vorgänge.

Implementiere einen Bestätigungsmechanismus.

Geplanter Ablauf:

1. Agent schlägt eine Aktion vor.
2. Backend erstellt eine validierte, zeitlich begrenzte Aktionsanforderung.
3. React zeigt die vorgeschlagene Aktion einschließlich der relevanten Parameter an.
4. Benutzer bestätigt oder lehnt ab.
5. Backend überprüft Identität, Berechtigung, Freigabe und Parameter erneut.
6. Erst danach erfolgt die Ausführung.

Eine Freigabe darf nur für die konkret angezeigte Aktion gelten und nicht durch vom Client veränderte Parameter auf andere Aktionen übertragbar sein.

Die Freigabe sollte einmalig verwendbar sein und gegen doppelte Ausführung geschützt werden.

Eine LLM-Antwort mit der Aussage „Der Benutzer hat zugestimmt“ ist keine gültige Freigabe.

---

## 9. Frontend Action System

Der Agent soll nicht nur Backend-Services verwenden können, sondern auch gezielte UI-Aktionen vorschlagen.

Dazu soll ein typisiertes Frontend-Action-Protokoll definiert werden.

Beispiele:

- `navigation.open`
- `editor.setContent`
- `form.populate`
- `view.selectItem`

Die tatsächlich unterstützten Aktionen müssen aus den Funktionen der vorhandenen Anwendung abgeleitet werden.

Implementiere:

- TypeScript Discriminated Unions für Action-Typen.
- Explizite Allowlist unterstützter Aktionen.
- Validierung der Parameter.
- Benutzerbestätigung, wenn notwendig.
- Ausführungsstatus.
- Fehlerbehandlung.
- Rückmeldung des Ergebnisses an den Agenten.

Keine direkte Ausführung beliebigen JavaScript-Codes durch das LLM.

Keine dynamische Interpretation von LLM-Ausgaben als ausführbarer Code.

---

## 10. Conversation Management und Memory

Der Chatbot soll den Kontext innerhalb einer Unterhaltung behalten können.

Vorgesehen sind:

- Conversation ID.
- Benutzerzuordnung.
- Nachrichtenhistorie.
- Rollen der Nachrichten.
- Zeitstempel.
- Relevante Tool-Ausführungen.
- Status von Aktionen.
- Begrenzung der Kontextgröße.

Implementiere zunächst einfachen Conversation State.

Eine spätere Persistenz soll vorbereitet werden, ohne sofort unnötig komplexe Datenbankstrukturen einzuführen.

Unterscheide zwischen:

**Conversation Memory:** Relevanter Verlauf für das LLM.

**Execution History:** Nachvollziehbare Informationen über aufgerufene Tools, Parameter, Ergebnisse und Freigaben.

Beide Anforderungen sind nicht identisch und sollten getrennt betrachtet werden.

Verhindere, dass Benutzer auf Unterhaltungen anderer Benutzer zugreifen können.

---

## 11. RAG — Erweiterung für später

Die Architektur soll eine spätere Integration von Retrieval-Augmented Generation ermöglichen.

Mögliche Quellen:

- Hilfe-Dokumentation.
- Anwendungsdokumentation.
- Wiki.
- Benutzerhandbücher.
- Freigegebene interne Wissensquellen.

Bevorzugt können Spring AI und eine vorhandene PostgreSQL-Datenbank mit pgvector genutzt werden.

RAG gehört ausdrücklich nicht zum ersten Implementierungsschritt.

Es soll zunächst lediglich darauf geachtet werden, dass die Architektur eine spätere Erweiterung ermöglicht.

---

## 12. Security

Sicherheit ist ein zentraler Bestandteil der Implementierung.

Berücksichtige insbesondere:

- Authentifizierung bestehender Benutzer.
- Serverseitige Autorisierung.
- Least-Privilege-Prinzip.
- Tool-Allowlisting.
- Parameter- und Schema-Validierung.
- Rate Limiting.
- Token- und Kostenbegrenzung.
- Prompt Injection.
- Schutz vor überprivilegierter Agentenausführung.
- Logging ohne unnötige vertrauliche Inhalte.
- Schutz von API-Schlüsseln.
- Schutz vor Cross-User-Zugriffen.
- Timeouts und kontrollierte Fehlerbehandlung.

Falls Netzwerk-Tools implementiert werden, zusätzlich:

- SSRF-Schutz.
- Blockierung unerlaubter interner Netzwerke.
- Prüfung von DNS-Auflösung und Redirects.
- Host- und Protokoll-Allowlisting.
- Begrenzung von Antwortgröße und Laufzeit.

Inhalte aus Dokumenten, Webseiten, Tool-Ergebnissen oder Benutzereingaben dürfen nicht als vertrauenswürdige Systemanweisungen behandelt werden.

---

## 13. Performance und Skalierbarkeit

Die Implementierung soll ressourcenschonend und gut erweiterbar sein.

Wichtige Punkte:

- Asynchrone Verarbeitung, wo sinnvoll.
- Streaming über SSE oder vorhandene geeignete Infrastruktur.
- Sauberer Umgang mit Verbindungsabbrüchen.
- Timeouts für LLM- und Tool-Aufrufe.
- Begrenzung paralleler Agentenausführungen.
- Wiederverwendung bestehender HTTP-Clients.
- Vermeidung unnötiger Datenbankabfragen.
- Begrenzung großer Tool-Ergebnisse.
- Geeignete Messpunkte für Latenz und Tokenverbrauch.

Wähle keine komplexe reaktive Architektur allein wegen des Streaming-Anwendungsfalls, wenn die vorhandene Spring-MVC-Architektur bereits eine einfache und geeignete Lösung ermöglicht.

---

## 14. Testing und Qualitätssicherung

Erstelle geeignete Tests für:

- REST-Endpunkte.
- Agent Services.
- Tool-Registry.
- Tool-Parameter.
- Tool-Berechtigungen.
- Fehlerbehandlung.
- Bestätigungsmechanismus.
- Mehrstufige Agentenausführungen.
- Frontend-Komponenten.
- Frontend-Action-Dispatcher.

Agenten-Tests sollten soweit möglich mit Mock-Modellen und deterministischen Tool-Ergebnissen ausführbar sein.

Echte LLM-Integrationstests sollten separat konfigurierbar sein, damit normale Testläufe keine unbeabsichtigten API-Kosten verursachen.

---

## 15. Implementierungsmeilensteine

Arbeite in dieser Reihenfolge:

### Milestone 1 — Architektur und Projektanalyse
- Bestehende Codebasis untersuchen.
- Architektur dokumentieren.
- Geeignete Erweiterungspunkte identifizieren.
- Dependencies und Kompatibilität prüfen.
- Implementierungsplan präsentieren.

**Noch keine produktiven Codeänderungen durchführen.**

### Milestone 2 — AI Backend Foundation
- Spring AI integrieren.
- LLM Provider konfigurieren.
- AgentService implementieren.
- Einfachen Chat-REST-Endpunkt erstellen.
- Fehlerbehandlung und Konfiguration ergänzen.
- Erste Tests schreiben.

### Milestone 3 — React Chat Interface
- ChatWidget erstellen.
- Backend-Anbindung implementieren.
- SSE-Streaming einrichten.
- Antwortstatus und Abbruchfunktion.
- Integration in vorhandenes Layout.

### Milestone 4 — First Functional Agent
- Ein vorhandenes, einfaches und möglichst lesendes App-Feature identifizieren.
- Dieses Feature über ein Spring-AI-Tool verfügbar machen.
- Tool-Auswahl durch das LLM ermöglichen.
- Tatsächliche Tool-Ausführung verifizieren.
- Tool-Ergebnis im Chat darstellen.

### Milestone 5 — Context Awareness
- Anwendungskontext definieren.
- Aktuelle Route und relevante Seitendaten anbinden.
- Serverseitige Validierung einführen.
- Kontextabhängige Agenten-Antworten testen.

### Milestone 6 — Secure UI Actions
- Frontend-Action-Protokoll implementieren.
- Allowlist definieren.
- Bestätigungsdialog entwickeln.
- Serverseitige Freigabe implementieren.
- Schutz vor unerlaubten Aktionen testen.

### Milestone 7 — Advanced Agent Execution
- Mehrstufige Tool-Ausführung.
- Iterations- und Laufzeitlimits.
- Ausführungsstatus.
- Abbruchmechanismus.
- Fehlerbehandlung und Recovery.

### Milestone 8 — Conversation Persistence
- Vorhandene Persistenz nutzen.
- Chatverläufe speichern.
- Execution History verwalten.
- Benutzerbezogene Datenisolierung.

### Milestone 9 — Quality and Deployment
- Integrationstests.
- Security Tests.
- Performance-Messungen.
- Konfiguration für Deployment.
- Technische Dokumentation.

### Milestone 10 — Optional Extensions
- RAG.
- pgvector.
- MCP Integration.
- Weitere Tools.
- Erweiterte Workflows.

---

## 16. Coding Standards

Orientiere dich an der vorhandenen Codebasis und berücksichtige:

- SOLID-Prinzipien.
- Separation of Concerns.
- Dependency Injection.
- Klare Schnittstellen.
- Lesbare und wartbare Klassen.
- Typsichere APIs.
- Keine unnötigen Abhängigkeiten.
- Keine überdimensionierte Architektur.
- Möglichst kleine, unabhängig testbare Komponenten.

Nutze moderne Java-Features dort, wo sie zur vorhandenen Java-Version passen.

Verwende im Frontend TypeScript-Typen statt `any`, wo dies sinnvoll möglich ist.

Ergänze Kommentare dort, wo komplexe Entscheidungen erklärt werden müssen. Vermeide triviale Kommentare.

---

## 17. Erwartete Zusammenarbeit

Ich möchte das Projekt nicht nur von dir implementieren lassen, sondern die Technologien dabei verstehen.

Erkläre bei jedem größeren Schritt:

1. Warum die gewählte Technologie verwendet wird.
2. Welche alternativen Ansätze existieren.
3. Welche Klassen und Komponenten neu entstehen.
4. Wie die Komponenten zusammenarbeiten.
5. Welche Designentscheidungen wichtig sind.
6. Wie ich das Ergebnis testen kann.

Bevorzuge eine technisch fundierte, aber pragmatische Lösung.

Gib keine allgemeinen Tutorials aus, wenn eine konkrete Implementierung im Projekt möglich ist.

Halte die Änderungen nachvollziehbar und überprüfbar.

---

## 18. Definition of Done für die erste Version

Die erste Version gilt als fertig, wenn:

- Ein integriertes React-Chat-Widget vorhanden ist.
- Benutzer Nachrichten an das Backend senden können.
- Ein konfigurierbares LLM angebunden ist.
- Antworten gestreamt werden.
- Ein echtes Tool der Anwendung aufgerufen werden kann.
- Tool-Ergebnisse im Chat verarbeitet werden.
- Relevanter Seitenkontext berücksichtigt werden kann.
- Fehler und Abbrüche korrekt behandelt werden.
- Unberechtigte Aktionen verhindert werden.
- Tests vorhanden sind.
- Die bisherige Anwendungsfunktionalität erhalten bleibt.

---

## 19. Dein erster konkreter Auftrag

Beginne JETZT ausschließlich mit Phase A.

Analysiere die bereits geöffnete Projektcodebasis vollständig hinsichtlich Frontend, Backend, Konfiguration, Sicherheit, Architektur und vorhandener Funktionen.

Identifiziere anschließend die besten Integrationspunkte für den KI-Agenten.

Schlage als ersten realen Agenten-Anwendungsfall eine bereits existierende Funktion der Anwendung vor.

Präsentiere mir:

1. Die erkannte Projektstruktur.
2. Die vorhandenen Technologien und Versionen.
3. Die geeigneten Stellen für die Integration.
4. Die vorgeschlagene AI-Agent-Architektur.
5. Eine Liste notwendiger Dependencies.
6. Die geplanten neuen Dateien und Klassen.
7. Die wichtigsten technischen Risiken.
8. Einen konkreten Implementierungsplan für Milestone 2.

**Führe noch keine Codeänderungen durch. Warte auf meine ausdrückliche Freigabe.**
