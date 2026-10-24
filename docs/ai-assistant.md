# KI-Assistent: Chat, Projektwerkzeuge und bestätigte Navigation

Aktuelle Ergänzung: [Ansprechpartner und Kundennotizen](customer-details.md) über dieselben
kontogebundenen Werkzeuge und Bestätigungskarten. Keine Kontaktlöschung als Modellwerkzeug.

Aktuell ergänzt: [bestätigte Änderungen bestehender Fachdaten](ai-updates.md), zusätzlich
zu den bereits verfügbaren Abfragen und Anlagen. Kein Löschen oder Ändern von Kontorechten.

Stand: 24. Oktober 2026. Zusätzlich zu M2–M9 sind fachbereichsübergreifende Abfragen und
bestätigte Anlagen implementiert. Aktueller Umfang und neues Protokoll:
[KI-Abfragen und Anlage](ai-workspace.md). Die nachfolgenden M4–M9-Abschnitte erläutern
die weiterhin vorhandenen Projektwerkzeuge, Navigation, Grenzen und Gesprächspersistenz:
geschützte JSON-Chat-API, integriertes Widget, Streaming, Abbruch und drei lesende
Werkzeuge für gespeicherte Projekte und offene Aufgaben des angemeldeten Kontos.
Übermittelt werden gesendete Nachrichten, eigener Gesprächsverlauf, die Systemanweisung
und bei einem Werkzeugaufruf dessen begrenztes Projektergebnis. Hinzu kommt ein begrenzter
Seitenbezug. Die erweiterte Anbindung kann auf ausdrückliche Abfrage außerdem eigene
Kundenkontakte, Wiki-/Textdateiinhalte, Profil/Einstellungen und als Administrator
freigegebene Kontoprofile lesen. Passwörter, Hashes und Browserentwürfe bleiben außerhalb
dieser Datenquellen. Initialpasswörter neuer Konten werden ausschließlich im separaten
Bestätigungsfeld direkt an das Backend übertragen.

## Architektur

`AgentController` verwendet die bestehende Cookie-Anmeldung, CSRF- und Origin-Prüfung.
`AgentService` prüft Identität, aktive Sitzung und Kontoversion vor und nach einem
Modellaufruf. Abmeldung, Passwortwechsel und Deaktivierung während einer Antwort
verhindern deren Übernahme in den Verlauf und die erfolgreiche Rückgabe.

`ConversationStore` trennt Gesprächszustand und Modellanbindung. Der aktuelle
`MemoryConversationStore` beziehungsweise `JpaConversationStore` gehört dem jeweiligen Benutzerkonto. Andere Konten erhalten
für fremde IDs denselben 404-Fehler wie für unbekannte oder abgelaufene Gespräche.
Auch Administratoren erhalten keinen Sonderzugriff. Mehrere gültige Sitzungen
desselben Kontos können dessen Gespräche fortsetzen.

`AiModelGateway` kapselt den Provider. `OpenAiModelGateway` verwendet Spring AI 2.0.1
und dessen offizielles OpenAI-Java-SDK. Das Modell kommt aus der Serverkonfiguration.
Werkzeugauswahl und finale Antwort kopieren die konfigurierten Modelloptionen, bevor
sie ihre Werkzeugoptionen ergänzen. Ein neu gebautes `OpenAiChatOptions` verwendet
sonst eigene Modell-/Timeout-/Retry-Vorgaben und kann die Serverkonfiguration überlagern.
Nachrichtenrollen, Systemanweisung und Werkzeugdefinitionen kann der Client nicht
vorgeben. `ProjectTools` registriert kontogebundene Spring-AI-`ToolCallback`s pro Lauf.
Die vorhandene `WorkspaceStorage`-Abstraktion liefert den gespeicherten Stand;
der Provider erhält ausschließlich begrenzte Projektionen daraus.

Die Integration nutzt `spring-ai-openai` mit Spring-AI-BOM und bedingter Bean-Erzeugung.
Der zunächst erwogene Starter wurde bewusst nicht eingebaut: Bei deaktivierter KI
sollen weder weitere OpenAI-Modalitäten noch ein Client durch Autokonfiguration
aktiviert werden. Das Backend bleibt eine Spring-MVC-Anwendung. Streaming verwendet
Spring AIs `Flux` und Spring MVCs `SseEmitter`; ein WebFlux-Webserver ist nicht erforderlich.

Die bestehende Workspace-API, Fachlogik, Datenbank und Anmeldung bleiben unverändert.
Ungültige Pfadparameter liefern nun wie ungültige JSON-Eingaben strukturierte API-Fehler.

## Lesende Projektwerkzeuge (M4)

| Werkzeug | Modellargumente | Ergebnis |
| --- | --- | --- |
| `list_projects` | `query: string`, `offset: integer` | Namensfilter, Projektkennung, Name, Planung, Termin und Aufgabenanzahlen; zehn Projekte pro Seite |
| `get_project_summary` | `project: string` | Ein exakter Projektname oder `#ID`; Planung, Termin, Anzahl todo/inProgress/done |
| `list_open_tasks` | `project: string`, `offset: integer` | Ein Projekt, bis zu zehn gespeicherte todo/inProgress-Aufgaben mit Kennung, Code, Titel, Status und Priorität |

Geeignete Fragen sind „Welche Projekte habe ich?“, „Wie ist der Stand von Alpha?“
und „Welche Aufgaben sind in #17 noch offen?“. Namen werden ohne Beachtung der
Groß-/Kleinschreibung exakt aufgelöst. Mehrdeutige oder nur teilweise passende Namen
liefern `AMBIGUOUS` mit Kandidaten zur Auswahl. Nicht vorhandene und fremde Kennungen
liefern `NOT_FOUND`. Der Assistent soll zur Klärung nachfragen. `#ID` vermeidet auch
bei gleichnamigen Projekten eine willkürliche Auswahl. `planningCompleted` bezeichnet
die Planung, nicht den Abschluss aller Aufgaben.

Das Modell entscheidet anhand der Frage, ob ein Werkzeug gebraucht wird. Gewöhnliche
Nachrichten lesen keinen Workspace und senden keine Projektdaten. Ein Chat-Versuch
darf standardmäßig vier aufeinanderfolgende Werkzeugaufrufe und höchstens fünf
Provider-Anfragen auslösen. M7 beschreibt die Grenzen unten. Ein Modellaufruf wählt
höchstens ein Werkzeug; dessen geprüftes Ergebnis geht in den nächsten Modellaufruf ein.
Nach Erreichen der Schrittgrenze oder einem Navigationsvorschlag behält die abschließende
Provider-Anfrage die gleichen Werkzeugdefinitionen und erhält `tool_choice=none`.
Die gemeinsame Optionsbildung erhält Modell-/Token-/Reasoning-Einstellungen und verhindert
die ungültige Kombination aus explizitem `tool_choice` und entfernter Werkzeugliste.
`none` sperrt weitere Aufrufe; zusätzlich weist das Backend sie selbst zurück, siehe
[Chat-Completions-Referenz](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).
Parallele Aufrufe oder ein Werkzeugaufruf trotz Abschlusssperre werden mit
`AI_TOOL_REJECTED` abgewiesen. Usage summiert alle Provider-Antworten; bei fehlenden
Werten bleibt die entsprechende Summe `null`. Das Gesamtzeitlimit gilt für den ganzen Lauf.

Die Schema-Definitionen sind strikt und verwenden `additionalProperties=false`.
Das Backend prüft zusätzlich erlaubte Namen, alle Argumentfelder, Typen, Textlängen,
Ganzzahl-Offsets von 0 bis 10000 und maximal 2048 JSON-Zeichen. Benutzerkennung,
SQL, URLs oder Schreibaktionen sind keine Argumente. Konto, Sitzung und Laufaktivität
werden vor und nach dem Lesen sowie vor der finalen Modellanfrage geprüft.
Abbruch während eines Datenbanklesens verhindert die Ergebnisweitergabe; daraus
folgt keine Zusicherung, dass der Datenbanktreiber eine laufende Abfrage sofort beendet.

Ergebnisse enthalten höchstens zehn Projekte bzw. Aufgaben und maximal 20000
JSON-Zeichen. Projektnamen/Aufgabentitel sind auf 200 UTF-16-Codeeinheiten, Aufgabencodes
auf 40 und Termine auf 32 begrenzt; `textTruncated` kennzeichnet Kürzung. Lange
Beschreibungen, Kundenkontakte, Wiki-Inhalte und Dateiinhalte werden nicht ausgegeben.
`total`, `offset` und `more` zeigen Seiten an. `revision` und `readAt` belegen den
gelesenen Stand; `readAt` ist der Abrufzeitpunkt, kein Änderungsdatum des Projekts.
Projekttexte gelten ausdrücklich als nicht vertrauenswürdige Daten, nicht als
Anweisungen. Die drei Lesefunktionen und das unten beschriebene Vorschlagswerkzeug bilden die geschlossene Allowlist.

Bei `gpt-6-luna` einschließlich Datumsvarianten setzt die Konfiguration
`reasoning_effort=none`, weil dessen Chat-Completions-Function-Calling diesen Modus
verlangt. Das konfigurierte Modell wird nicht ersetzt; andere Modellkennungen behalten
ihre bisherigen Optionen. Die Kompatibilität des gewählten Modells mit Chat Completions
und Function Calling muss gegeben sein. [Offizielle Modellbeschreibung](https://developers.openai.com/api/docs/models/gpt-6-luna).

Das Widget zeigt `tool`-Ereignisse als lesende Zugriffe mit aufklappbaren Ergebniskarten.
Nach erfolgreichem Abschluss liegen die Quellen unter `assistant.tools` und bleiben
beim Nachladen des bestätigten Gesprächs erhalten. Fehler und Abbruch speichern keine
halbe Antwort samt Werkzeugergebnis. M8 ergänzt eine dauerhafte Gesprächsliste im PostgreSQL-Profil.

## Seitenkontext (M5)

Jede neue Nachricht kann optional `context` enthalten:

```json
{ "route": "/projectManager/projects", "projectId": 17, "projectTab": "tasks" }
```

Erlaubt sind die zwölf vorhandenen Modul-/Seitenrouten aus `AiPageContext` in OpenAPI.
`projectId` gehört ausschließlich zu sichtbar geöffneten Projektdetails auf Dashboard
oder Projektliste. `projectTab` ist einer der acht vorhandenen Projekttabs; ohne Angabe
wird bei einer Projektkennung `overview` verwendet. Ohne Projektkennung ist kein Tab
erlaubt. Ohne `context` bleiben bestehende JSON-Clients und Testskripte kompatibel.

Der Router-/Auswahlprovider liefert beim Senden einen Snapshot. Der Chat zeigt den
Seitenbezug beim Eingabefeld und unter der jeweiligen Benutzernachricht. Projekt-/Tabwechsel
gelten für die nächste Nachricht, laufende Anfragen behalten ihren Bezug. Übersicht,
Modulwechsel und ungültige Routen entfernen die Projektauswahl aus dem Chat-Kontext.
Ein Sitzungswechsel setzt sowohl Kontext als auch Chat zurück.

Übertragen werden nur Route, Projektkennung und Tab, keine Query-Parameter, Artikelauswahl,
Aufgabendetails, Formularentwürfe, Editorinhalte, HTTP-Header/-Bodys oder Rollenbehauptungen.
Bei Wiki und Dev Tools ist daher Hilfe zur Seite möglich, keine Analyse unsichtbarer Inhalte.
Die Oberfläche weist auf die Weitergabe des Seitenbezugs hin. Öffnen und Navigieren allein
erzeugen keine Modellanfrage.

Das Backend prüft Route, Typen, Kennungsgrenze, Feldkombinationen und unbekannte Felder.
Bei einer Projektkennung lädt es den gespeicherten Workspace des authentifizierten Kontos
und prüft die Existenz vor der Modellanfrage, auch bei Administratoren. Fehlende und fremde
Projekte ergeben gleichermaßen `AI_PAGE_CONTEXT_UNAVAILABLE`. Der Entwurf bleibt erhalten;
bei einem neuen, noch ungespeicherten Projekt erst Speichern abwarten. Ein veralteter Bezug
wird nicht durch ein anderes Projekt ersetzt. Der Browserbezug ist eine Auswahlbehauptung,
kein Nachweis der tatsächlich sichtbaren Browserseite und keine Berechtigungserteilung.

Der Server ergänzt feste Erläuterungen zu Seite und Tab. Diese Metadaten werden als eigene
User-Nachricht vor dem zugehörigen Text übergeben, nicht in die Systemanweisung eingebaut.
Die Systemanweisung bindet „hier“ und „dieses Projekt“ an den jüngsten Kontext; aktuelle
Fakten müssen weiterhin mit einem lesenden Werkzeug geladen werden. Explizit genannte
andere Projekte bleiben abfragbar, sofern sie zum Konto gehören. Ohne ausgewähltes Projekt
soll der Assistent nachfragen. Die bloße Projektauswahl übermittelt keine Namen oder Daten.

Die Prüfung der Auswahl und das spätere Werkzeuglesen sind getrennte Lesevorgänge. Das
Werkzeug lädt erneut den gespeicherten Stand; ein zwischenzeitlich gelöschtes Projekt ergibt
`NOT_FOUND`. Sitzung/Laufaktivität werden nach dem Kontextlesen erneut geprüft. Ein Abbruch
verhindert dadurch die nachfolgende Modellanfrage, garantiert aber keinen sofortigen JDBC-Abbruch.

Bestätigte Benutzernachrichten enthalten den normalisierten `context`; Assistentennachrichten
haben `context:null`. Die Metadaten bleiben zusammen mit dem Paar im gespeicherten Verlauf und
werden beim Wiederholen mit `requestId` verglichen. Anderer Kontext bei gleicher Kennung
ergibt `AI_REQUEST_MISMATCH`. Kontextmetadaten zählen zum variablen Zeichenbudget. Die
Anzahl erlaubter Werkzeuge/Provider-Anfragen bleibt unverändert. M6 ergänzt ausschließlich die folgende Navigation.

## Bestätigte Navigation (M6)

Das vierte Werkzeug `propose_project_navigation(project, view)` schlägt das Öffnen eines
gespeicherten eigenen Projekts vor. `project` ist ein exakter Name oder `#ID`; mehrdeutige
Namen müssen wie bei den Lesewerkzeugen geklärt werden. `view` ist genau `overview`,
`tasks` oder `board`. Vorher können innerhalb des Schrittbudgets lesende Werkzeuge laufen.
Das Werkzeug navigiert nicht. Das Backend erzeugt das unveränderliche Ziel; das Modell
kann keine URL, Skripte, Kontokennung oder Berechtigungen vorgeben.

Ein erfolgreiches Ergebnis enthält `action`: UUID, `project.open`/`project.view`, Projektkennung,
begrenzter Projektname, Tab, Ablaufzeit und Status. Erst das atomar bestätigte Nachrichtenpaar
registriert die Aktion zur Freigabe; Teilantworten, fehlgeschlagene und abgebrochene Läufe
erzeugen keine freigebbare Aktion. Die DE-/EN-Aktionskarte zeigt Projekt und Ansicht mit
„Bestätigen und öffnen“ und „Ablehnen“. Eine Zustimmung im Chattext ist keine Freigabe.

`POST /ai/conversations/{id}/actions/{actionId}/decision` erhält nur
`{ decisionId: UUID, decision: "approve" | "reject" }`. Cookie, CSRF und Origin bleiben
verpflichtend. Das Backend prüft Inhaber, aktive Sitzung, ursprüngliche Kontoversion,
fünf Minuten Gültigkeit sowie bei Freigabe Projektkennung und angezeigten Namen im
gespeicherten eigenen Workspace erneut. Auch Administratoren dürfen nur eigene Aktionen
freigeben. Ablehnen liest den Workspace nicht. Nur die erste Entscheidung ist zulässig;
gleichzeitige oder wiederholte Freigaben liefern `409 AI_ACTION_DECIDED`.

Die erste Freigabe liefert eine einmalige `executionId` und genau das zuvor angezeigte Ziel.
Der Browser vergleicht es erneut, prüft Sitzung/Abbruch/Ablauf und navigiert über eine feste
Projektseiten-Brücke. Offene Projekt-, Kunden-, Aufgaben-, Epic-, Sprint-, Datei- und
Bestätigungsdialoge sowie geänderte Kontoeingaben blockieren den Wechsel. Der Workspace
muss vollständig geladen und gespeichert sein. Wiki-/Dev-Tools-Eingaben bleiben beim
Modulwechsel gemountet. Erfolg wird erst gemeldet, wenn Route, sichtbares Projekt und Tab
im Seitenkontext übereinstimmen; bereits geöffnete Zielansichten sind zulässig.

`POST /ai/conversations/{id}/actions/{actionId}/result` erhält
`{ executionId, status: "succeeded" | "failed", code }`. Bei Erfolg ist `code` null/fehlend,
bei Fehler genau `NAVIGATION_UNAVAILABLE`, `UNSAVED_CHANGES`, `CLIENT_CANCELLED` oder `EXPIRED`.
Keine privaten Fehlertexte. Der Status ist nach diesem Ergebnis unveränderlich; identische
Ergebniswiederholungen sind idempotent. Das ist eine Browsermeldung, kein serverseitiger
Nachweis einer sichtbaren Seite. Die Karte zeigt Ergebnis/Fehler; die nächste ausdrücklich
gesendete Nachricht erhält den aktuellen Status als separate User-Metadaten für das Modell.
Bestätigen, Ablehnen und Ergebnisrückmeldung erzeugen keine weiteren Provider-Anfragen.

Statusfolge: `proposed → approved → succeeded/failed` oder `proposed → rejected/expired`.
Eine verlorene Freigabe-/Ergebnisantwort kann `approved` mit ungewisser Ausführung hinterlassen.
Freigabe und Navigation werden niemals automatisch wiederholt. GET, Chat-Replay und erneutes
Öffnen der Karte lesen ausschließlich den Status; gegebenenfalls einen neuen Vorschlag anfordern.
Die Freigabe wird serverseitig höchstens einmal erteilt; dies ist keine Zusage einer verteilten
Exactly-once-Ausführung. Ausführungskennung wird nicht im öffentlichen Gespräch ausgeliefert.

Aktionen bleiben bei den begrenzten Gesprächen: flüchtig im Memory-Profil, dauerhaft im PostgreSQL-Profil.
Aktionsmetadaten zählen zum variablen Verlaufslimit. Kein neues Schema, keine Servervariable.
Fachdaten schreiben, Formulare ausfüllen, Editoränderungen und mehrstufige Pläne sind nicht umgesetzt.
API-Schemata und Fehlercodes: `docs/openapi.json`.

## Mehrstufige Ausführung (M7)

Die bestehende manuelle Spring-AI-Schleife wurde erweitert; Provider, Modell und API
bleiben gleich. Ein Lauf kann beispielsweise Projekte suchen und anschließend die offenen
Aufgaben zweier gefundener Kennungen lesen. Jeder Modellaufruf erhält die bisherigen
Assistant-Tool-Calls und zugehörigen Tool-Antworten mit passenden Kennungen. Pro Antwort
höchstens ein Werkzeug, keine parallelen Aufrufe. Es gibt keine zusätzlichen Fachfunktionen.

`AI_MAX_TOOL_STEPS` erlaubt 1–6 Schritte, Vorgabe 4. Bei N Schritten sind höchstens N+1
Provider-Anfragen möglich: bis zu N Werkzeugauswahlen und eine abschließende Textantwort.
Das Modell darf vorher mit einer Textantwort enden. Nach dem letzten erlaubten Schritt
erzwingt `tool_choice=none` die Zusammenfassung und ein fester Hinweis verlangt, nicht
geprüfte Teile der Anfrage offenzulegen. Ein dennoch angeforderter Werkzeugaufruf wird
abgewiesen. Die Grenze gilt unabhängig von Behauptungen in Benutzereingaben/Projektnamen.

Zusätzliche Grenzen: unverändert 16000 UTF-16-Codeeinheiten für den gesamten Antworttext,
maximal 24000 JSON-Codeeinheiten für alle Werkzeugergebnisse zusammen und weiterhin
maximal 20000 je Einzelergebnis. `AI_MAX_OUTPUT_TOKENS` gilt je Provider-Anfrage; ein Lauf
kann bei Standardkonfiguration bis zum Fünffachen dieses Ausgabelimits verbrauchen.
Eingabetoken werden ebenfalls je Modellaufruf abgerechnet. Diese Grenzen sind kein Euro-Budget.

Das vorhandene `AI_TIMEOUT` (Vorgabe 20s, höchstens 60s) begrenzt den gesamten Lauf inklusive
Modell- und Werkzeugphasen. Ein absoluter Timer wird durch neue Textabschnitte nicht verlängert.
Er cancelt die laufende Provider-Subscription. Der SSE-Besitzer prüft zusätzlich jede Sekunde
Sitzung und Zeitlimit. Abbruch/Logout/Passwortwechsel verhindern weitere Modell-/Werkzeugschritte.
Ein bereits laufender JDBC-Lesevorgang kann bis zur Rückkehr weiterlaufen; vor Weitergabe
seines Ergebnisses wird erneut geprüft. HTTP-Clients behalten keine automatische Wiederholung.

Das Backend verwirft identische Werkzeugaufrufe vor einem weiteren Datenlesen, auch bei
anderer JSON-Feldreihenfolge, Leerraum oder entsprechender Groß-/Kleinschreibung. Wiederverwendete
Tool-Call-Kennungen und parallele Aufrufe sind ebenfalls unzulässig. Ändert sich die gespeicherte
Workspace-Revision zwischen zwei Werkzeugschritten, wird die gesamte unbestätigte Folge verworfen.
`NOT_FOUND`, `AMBIGUOUS` und `INVALID_INPUT` führen direkt zur abschließenden Erklärung/Klärung.
Ein Navigationsvorschlag beendet die Werkzeugfolge; die M6-Aktionskarte bleibt separat freizugeben.

SSE ergänzt `execution: { phase, step, maxSteps }`: `thinking` vor dem nächsten Modellaufruf,
`reading` vor dem Werkzeuglesen, `answering` bei erzwungener Zusammenfassung.
`step` zählt bei reading den beginnenden Schritt, sonst die abgeschlossenen Werkzeugschritte.
Das Widget zeigt DE-/EN-Fortschritt sowie geordnete Werkzeugkarten; nur `done` bestätigt
das vollständige Nachrichtenpaar mitsamt allen Ergebnissen. Ältere erfolgreiche Antworten
ohne execution-Ereignisse bleiben lesbar; alte Frontend-Bundles müssen mit aktualisiert werden.

Recovery bleibt ausdrücklich manuell: Fehler/Abbruch verwerfen den unbestätigten Lauf samt
Vorschlägen, erhalten den Entwurf und geben die Laufkapazität frei. Bei Verbindungsfehlern
wird ausschließlich der bestätigte Verlauf gelesen. Ein verlorenes `done` kann so nachgeladen
werden. Erfolgreiche requestId-Replays geben den ganzen Turn ohne neue Provider-Anfrage zurück.
Kein automatisches Fortsetzen oder Wiederholen einzelner Schritte. Zusätzliche Fehlercodes:
`409 AI_EXECUTION_LOOP`, `409 AI_WORKSPACE_CHANGED`, `422 AI_EXECUTION_RESULT_LIMIT`.

Keine neuen Dependencies, Migrationen oder Hintergrundjobs. Gesprächs- und Ausführungsdaten
werden gemäß dem folgenden M8-Speichermodus verwaltet.

## Gesprächspersistenz und Ausführungshistorie (M8)

Im Profil `postgres` verwendet die aktivierte KI jetzt `JpaConversationStore`. Flyway V5
ergänzt `ff_ai_conversations`, `ff_ai_executions` und eine kleine Sperrtabelle für das globale
Gesprächslimit. Bestehende Fachdaten/Verträge bleiben gleich. Ein versioniertes internes
JSON-Aggregat speichert Sprache, Zeitstempel, bestätigte Nachrichtenpaare mit Kontext/Quellen,
Idempotenzkennungen und private Aktionsfreigaben. Ausführungsläufe liegen getrennt davon:
Beginn/Ende, Status, sichere Fehlercodes und geordnete validierte Werkzeugargumente/Outcomes.
Gelesene Ergebnisprojektionen stehen bei erfolgreichen Turns in den Quellen. Fehlgeschlagene
oder abgebrochene Läufe haben keine halben Gesprächsnachrichten und werden nicht in den
Modellverlauf übernommen. Systemprompts, API-Schlüssel und Sitzungstoken werden nicht als
Konfigurationsdaten gespeichert. Keine Passwörter/Secrets in Chattexte eingeben.

Die Memory-Implementierung liefert die gemeinsamen Aggregatregeln; der JPA-Adapter lädt
und speichert sie in kurzen gesperrten Transaktionen. Die Kontokennung stammt immer aus
der verifizierten Sitzung. Gesprächs- und Ausführungsabfragen sind auf diesen Inhaber
begrenzt; Administratoren haben keinen Sonderzugriff. Verwaltung löst keine Modellanfrage aus.

- `GET /ai/conversations` liefert `{ storage, retentionSeconds, items }`. Jedes Item enthält
  Kennung, Sprache, maximal 100 Zeichen der ersten Benutzernachricht als Titel, Erstell-/Änderungszeit,
  Nachrichtenanzahl und busy. Leer angelegte Chats haben leere Titel.
- `GET /ai/conversations/{id}` erhält das bisherige Format und ergänzt `busy`. Ein laufendes
  Gespräch kann gelesen werden; Senden/Freigabe bleiben bis zum Ende und manuellen Nachladen gesperrt.
- `GET /ai/conversations/{id}/executions` liefert höchstens die letzten 50 Läufe, neueste zuerst.
  Schritte enthalten Name, begrenztes kanonisches Argument-JSON, Beginn/Ende und Outcome.
  Nicht abgeschlossene Schritte bleiben bei einem fehlgeschlagenen Lauf als begonnen erkennbar.
- `DELETE /ai/conversations/{id}` löscht eigene Gesprächs- und Ausführungsdaten zusammen.
  Origin und CSRF sind Pflicht. Aktive Läufe verhindern Löschen mit 409; fremde/unbekannte
  Kennungen ergeben 404. Das Widget verlangt eine ausdrückliche Löschbestätigung.

Gesprächszahl, Nachrichten-/Zeichenlimits und Werkzeuggrenzen bleiben erhalten. Alte Chats
können gelöscht werden, um Kapazität freizugeben. `AI_CONVERSATION_RETENTION` legt im PostgreSQL-
Profil die Inaktivitätsfrist fest: Vorgabe 30d, zulässig 1d–365d. Nachrichten, Laufbeginn/-ende
und Aktionsentscheidungen gelten als Aktivität; bloßes Lesen verlängert die Frist nicht.
Abgelaufene Gespräche sind nicht mehr lesbar/listbar. Die physische Bereinigung erfolgt beim
Anlegen eines neuen Gesprächs; es gibt keinen Hintergrund-Löschjob. Backups haben eine eigene
Aufbewahrung. Im Profil memory bleibt `AI_CONVERSATION_TTL` (30m) maßgeblich; ein Backend-Neustart
verwirft diese Gespräche. Rate-/Parallelitätslimits und HTTP-Sitzungen bleiben in beiden
Profilen im Arbeitsspeicher.

Ein Run erhält eine kurze persistierte Laufzeitfreigabe bis AI_TIMEOUT+5s. Nach Absturz/Ablauf
markiert der nächste Zugriff ihn als interrupted. Die alte Kennung kann nicht mehr committen;
ein späterer expliziter Versuch erhält eine neue Kennung. Es wird nie automatisch fortgesetzt
oder wiederholt. Keine Datenbanktransaktion bleibt während Modell-/Werkzeuglesen offen.
Parallele Schreiber/Freigaben werden über Gesprächszeilensperren serialisiert.
`409 AI_RUN_EXPIRED` kennzeichnet eine veraltete Laufkennung. Verwaltung setzt Anmeldung und
aktivierte KI voraus. Ein aktiver Run kann nicht gelöscht werden.

Aktionszustände überleben Neustarts. Vorgeschlagene Karten gelten weiterhin fünf Minuten und
behalten die ursprüngliche Kontoversion. approved bleibt bei verlorener Rückmeldung ungewiss;
aus der Historie wird keine neue executionId erteilt und nichts automatisch ausgeführt.
Passwortwechsel/Deaktivierung schützen auch alte Vorschläge. HTTP-Verläufe liefern weder
interne Kontoversionen noch private Ausführungsnachweise.

Im Widget öffnet „Unterhaltungen“ die Liste und erklärt Speichermodus/Frist. Öffnen mit
ungesendetem Entwurf verlangt Bestätigung. Neue Unterhaltung entfernt nur die aktuelle Auswahl;
gespeicherte Chats bleiben in der Liste. Abmelden/Neuladen entfernt die Browseransicht;
nach Anmeldung können gespeicherte Gespräche erneut geöffnet werden. Kein Chat in Local/
Session Storage. Vor M8 flüchtige Chats werden beim Update nicht übernommen; V5 speichert neue Gespräche.

## Aktivierung und Konfiguration

Die drei lesenden Werkzeuge und der Navigationsvorschlag sind bei aktivierter KI verfügbar.
Das Chat-Update-Skript installiert das aktuelle Frontend-/Backend-Paar einschließlich M6-Navigation.

Ohne `AI_ENABLED=true` gibt es keinen Modellclient oder Gesprächsspeicher. Die normalen
Anwendungsfunktionen starten ohne KI-Schlüssel. Angemeldete Benutzer erhalten für die
Chat-API `503 / AI_DISABLED`; anonyme Zugriffe bleiben geschützt.

Bei Aktivierung sind `OPENAI_API_KEY` und `AI_MODEL` erforderlich. Fehlende Werte und
ungültige Limits verhindern den Start. Ein konkretes Modell ist nicht voreingestellt:
Der Betreiber wählt ein für sein API-Konto verfügbares Chat-Completions-Modell.

| Umgebungsvariable | Vorgabe | Bedeutung |
| --- | --- | --- |
| `AI_ENABLED` | `false` | KI-Funktion einschalten |
| `OPENAI_API_KEY` | leer | Ausschließlich serverseitiger API-Schlüssel |
| `AI_MODEL` | leer | Modellkennung, bei Aktivierung erforderlich |
| `AI_TIMEOUT` | `20s` | Provider-Request-Timeout, zulässig 1–60 Sekunden |
| `AI_OUTPUT_TOKEN_MODE` | `completion` | `completion`: `max_completion_tokens`; `legacy`: `max_tokens` |
| `AI_MAX_OUTPUT_TOKENS` | `1024` | Ausgabelimit pro Provider-Anfrage, zulässig 1–4096; je Lauf höchstens AI_MAX_TOOL_STEPS+1 Anfragen |
| `AI_MAX_TOOL_STEPS` | `4` | Aufeinanderfolgende Werkzeugschritte, zulässig 1–6; danach maximal eine Textantwort |
| `AI_REQUESTS_PER_15_MINUTES` | `20` | Neue Chat-Versuche je Konto in einem festen 15-Minuten-Fenster; kein Limit für einzelne Provider-Anfragen |
| `AI_MAX_CONCURRENT` | `2` | Gleichzeitige Modellaufrufe insgesamt, zulässig 1–16 |
| `AI_MAX_CONVERSATIONS_PER_USER` | `10` | Gespräche je Konto, zulässig 1–50 |
| `AI_MAX_CONVERSATIONS` | `200` | Gespräche insgesamt, zulässig 1–1000 |
| `AI_MAX_TURNS` | `10` | Erfolgreiche Nachrichtenpaare pro Gespräch, zulässig 1–50 |
| `AI_MAX_HISTORY_CHARACTERS` | `24000` | Bisheriger Verlauf plus neue Eingabe, zulässig 4000–100000 |
| `AI_CONVERSATION_TTL` | `30m` | Inaktivitätsfrist für Memory-Chats, zulässig 1 Minute–8 Stunden |
| `AI_CONVERSATION_RETENTION` | `30d` | Inaktivitätsfrist für PostgreSQL-Chats, zulässig 1d–365d; Bereinigung beim nächsten Anlegen |

Ein Konto kann höchstens einen Modellaufruf gleichzeitig ausführen, auch über mehrere
Gespräche hinweg. Es gibt keine Warteschlange; ausgelastete Kapazität führt zu `429`.
Provider-Retries sind deaktiviert. Provider-Fehler verbrauchen ebenfalls einen Versuch;
die Wiedergabe einer erfolgreich gespeicherten Anfrage nicht.

Eine Eingabe hat maximal 4000 UTF-16-Codeeinheiten und darf nicht nur Leerraum enthalten.
Verläufe werden nicht stillschweigend gekürzt: Beim Turn-/Kontextlimit ist ein neues
Gespräch erforderlich. Die Zeichengrenze ist keine exakte Modell-Tokenzählung. Eine
Textantwort wird zusätzlich auf 16000 UTF-16-Codeeinheiten begrenzt. Das letzte Paar
kann den Eingabe-Kontextgrenzwert überschreiten; die nächste Anfrage wird dann abgewiesen.
Der gespeicherte Bestand bleibt durch diese Grenzen endlich.

Beide Ausgabeparameter werden niemals gleichzeitig gesetzt. Für das gewählte Modell
den passenden Modus anhand der Provider-Dokumentation konfigurieren. `temperature`
wird nicht vorgegeben. Der Browser darf das Modell nicht überschreiben. Zieladresse
ist ausschließlich `https://api.openai.com/v1`. `store=false` verhindert angeforderte
Speicherung zur späteren API-Nutzung, ist aber keine Zusicherung von Zero Data Retention.

Schlüssel ausschließlich in die Backend-Prozessumgebung übernehmen, niemals in
`frontend/.env.local`, `VITE_*`, Sourcecode oder den Chat. Auf Ubuntu die bestehende
geschützte Datei mit `sudoedit /etc/forgeflow/backend.env` bearbeiten und den Dienst
nach dem JAR-Update neu starten. Datenbank-/Origin-Einstellungen beibehalten.

Lokales Beispiel für eine bereits vorhandene Backend-Startumgebung:

```powershell
$env:AI_ENABLED = 'true'
$env:AI_MODEL = Read-Host 'Modellkennung deines OpenAI-API-Kontos'
$taskAiSecret = Read-Host 'OpenAI API key' -AsSecureString
$env:OPENAI_API_KEY = [System.Net.NetworkCredential]::new('', $taskAiSecret).Password
mvn.cmd -f backend/pom.xml spring-boot:run
```

Dies ersetzt nicht die vorhandene PostgreSQL-/Anmeldekonfiguration. Ohne Live-Test
oder Chatnachricht erzeugt die Client-Erstellung keine Modellanfrage.

## HTTP-Vertrag

Basis `/api/v1`, JSON, bestehendes `FORGEFLOW_SESSION`-Cookie. POST benötigt den
gültigen `X-CSRF-TOKEN` und den konfigurierten `Origin`. Normale Benutzer dürfen die
eigene Chat-API verwenden. Bestehende Cache-Control-Sicherheitsheader gelten weiter.
Vollständige Schemas stehen in `docs/openapi.json`.

| Methode und Pfad | Anfrage | Ergebnis |
| --- | --- | --- |
| `POST /ai/conversations` | `{ "language": "de" }`, optional `en`, fehlend/null bedeutet `de` | `201`, neue ID, Sprache, Zeitstempel, leere Nachrichtenliste |
| `GET /ai/conversations/{id}` | Eigene UUID | `200`, bisherige vollständige Nachrichtenpaare |
| `POST /ai/conversations/{id}/messages` | `{ "requestId": "UUID", "message": "Text", "context"?: AiPageContext }` | `200`, Benutzer-/Assistentennachricht, Usage und `truncated` |
| `POST /ai/conversations/{id}/messages/stream` | Dieselbe Nachrichtenhülle; `Accept: text/event-stream, application/json` | UTF-8-SSE mit JSON-Ereignissen |
| `POST /ai/conversations/{id}/requests/{requestId}/cancel` | Kein Body | `204`, passende aktive Stream-Anfrage abbrechen |

`requestId` wird pro beabsichtigter Nachricht erzeugt. Derselbe erfolgreiche Request
mit identischem Text und normalisiertem Kontext liefert dasselbe Ergebnis ohne erneuten Provider-Aufruf. Gleiche
Kennung mit verändertem Text oder Kontext ergibt `409 / AI_REQUEST_MISMATCH`. Während einer laufenden
Antwort ergibt ein weiterer Versuch im selben Gespräch `409 / AI_CONVERSATION_BUSY`.

Nur vollständige erfolgreiche Paare werden gespeichert. Provider-Fehler hinterlassen
keine halbe Unterhaltung. Fehlgeschlagene, zeitlich unklare oder abgelaufene Anfragen
haben keine dauerhafte Idempotenzzusage: Erneutes Senden kann einen weiteren
kostenpflichtigen Versuch erzeugen. Der synchrone JSON-Endpunkt bleibt für bestehende
Clients erhalten; die gezielte Abbruchsteuerung gehört zum neuen Stream-Endpunkt.

Tokenzahlen stammen vom Provider und können `null` sein. `truncated=true` kennzeichnet
eine wegen Ausgabelimit beendete Textantwort. Leere, übergroße, blockierte oder unerwartete
Tool-Antworten werden nicht als Erfolg übernommen. Es gibt keine Freigabe durch Modelltext.

### Stream und Abbruch

Der Browser verwendet `fetch` statt `EventSource`, damit POST-Body und CSRF-Header
gesendet werden können. Ereignisse werden ausschließlich als Daten interpretiert:

| Ereignis | JSON-Daten | Bedeutung |
| --- | --- | --- |
| `ready` | `{ requestId }` | Anfrage angenommen, Antwort noch nicht bestätigt |
| `ping` | `{}` | Herzschlag jede Sekunde, zugleich erneute Sitzungs-/Kontoprüfung |
| `delta` | `{ text }` | Nächster unbestätigter Textabschnitt |
| `tool` | `{ id, name, status, result }` | `started` mit `result:null`, danach `completed` mit begrenztem Projektergebnis |
| `done` | Vollständiges `AiTurn` | Atomar gespeichertes Nachrichtenpaar; enthält Usage/`truncated` |
| `cancelled` | `{ requestId }` | Aktiver Lauf abgebrochen; keine Teilantwort gespeichert |
| `error` | `{ status, code, message }` | Bereinigter Fehler nach Streambeginn; HTTP bleibt `200` |

Vor Streambeginn liefern Validierungs-, Berechtigungs- und Limitfehler weiterhin
normale HTTP-Fehler mit JSON-Fehlerhülle. Ohne Abschlussereignis gilt ein Stream nicht
als bestätigt. Der Client lädt dann ausschließlich den vorhandenen Verlauf nach;
er wiederholt keine Modellanfrage automatisch. Erfolgreiche `requestId` werden auch
über den Stream ohne Provider-Aufruf als `done` wiedergegeben. Es gibt keinen
automatischen SSE-Reconnect und keine Fortsetzung per `Last-Event-ID`.

`AgentStreams` verwaltet begrenzte aktive Läufe und trägt Identität/Sitzung ausdrücklich
in asynchrone Callbacks. `AI_TIMEOUT` begrenzt die gesamte Stream-Laufzeit, auch wenn
ständig neue Token eintreffen. Fehler, Logout, Sitzungsversionswechsel, Dienstende
und Abbruch geben die Kapazitätsfreigabe genau einmal zurück. Ein Schreibfehler oder
der nächste erkannte Verbindungsabbruch beendet die Provider-Subscription; ein
sekündlicher Herzschlag erkennt auch stille Verbindungen. Bereits erzeugte Token
können trotz Abbruch Kosten verursachen.

Die Abbruch-API ist für nicht mehr aktive Request-IDs idempotent. Sie macht eine
bereits gespeicherte Antwort nicht rückgängig. Deshalb gleicht das Widget nach
„Stoppen“ den bestätigten Verlauf ab. Bei fehlender Bestätigung bleibt eine klare
Meldung mit „Verlauf erneut laden“ und der ursprüngliche Entwurf erhalten.

SSE-Antworten setzen `X-Accel-Buffering: no` und `Cache-Control: no-store`.
Die vorhandene, durch `enable-linux-public.sh` erzeugte Nginx-Konfiguration berücksichtigt
diesen Header. Der Herzschlag hält ihren 60-Sekunden-Proxy-Timeout offen. Eigene Proxys
dürfen den Header nicht ignorieren oder SSE bis zum Antwortende puffern.

### Widget

Im angemeldeten API-Modus erscheint rechts unten ein Assistenten-Button. Öffnen
allein sendet keine KI-Anfrage. Erst „Senden“ oder Enter ohne Shift startet eine
Nachricht; Shift+Enter fügt einen Zeilenumbruch ein. Antworten werden als sicherer
Text dargestellt. Lesezugriffe und ihre Ergebnisse sind aufklappbar sichtbar.

Schließen und Modulwechsel erhalten Entwurf, Verlauf und laufende Anfrage.
„Stoppen“ bricht die Anfrage ab. „Neue Unterhaltung“ verlangt bei vorhandenem Verlauf
Bestätigung und entfernt diesen nur aus der aktuellen Ansicht. Der aktuelle Verlauf
wird weder in Local Storage noch Session Storage gespeichert und verschwindet bei
Neuladen, Abmelden oder Kontowechsel. Über „Unterhaltungen“ lassen sich gespeicherte Chats
des angemeldeten Kontos erneut öffnen; im PostgreSQL-Profil auch nach Backend-Neustart.

Das Widget nutzt die bestehenden Hell-/Dunkel-Themes und Deutsch/Englisch einschließlich
Fehlermeldungen. Die Antwortsprache wird beim Anlegen des Gesprächs festgelegt;
nach einem Sprachwechsel zeigt das Widget bei Bedarf einen Hinweis auf eine neue
Unterhaltung. Escape schließt das fokussierte Widget. Tastaturfokus, Live-Regionen,
schmale Fenster und reduzierte Bewegung sind berücksichtigt; eine visuelle Prüfung
im Browser steht noch aus. Speicherbenachrichtigungen lassen neben dem Chat-Button Platz.

Deployment des vorbereiteten Frontend-/Backend-Paars: [linux-server.md](linux-server.md#chat-widget-und-streaming-meilenstein-3).

| Status | Wichtige Fehlercodes |
| --- | --- |
| 400 | `INVALID_INPUT`, einschließlich unbekannter Felder, ungültiger UUID und Sprache; `AI_INVALID_PAGE_CONTEXT` |
| 401 / 403 | Bestehende Anmelde-, Sitzungs-, CSRF- und Origin-Fehler |
| 404 | `AI_CONVERSATION_NOT_FOUND`, `AI_PAGE_CONTEXT_UNAVAILABLE` |
| 409 | `AI_CONVERSATION_BUSY`, `AI_REQUEST_MISMATCH` |
| 422 | `AI_CONTEXT_LIMIT` |
| 429 | `AI_BUSY`, `AI_CONVERSATION_LIMIT`, `RATE_LIMITED` |
| 502 | `AI_INVALID_RESPONSE`, `AI_TOOL_REJECTED` |
| 503 | `AI_DISABLED`, `AI_UNAVAILABLE`, `AI_PROVIDER_CONFIGURATION`, `AI_PROVIDER_AUTHENTICATION`, `AI_QUOTA_EXCEEDED`, `AI_RATE_LIMITED`, `AI_PROVIDER_LIMIT`, bestehende Speicherfehler |
| 504 | `AI_TIMEOUT` |

Provider-Fehlertexte werden nicht weitergereicht oder durch unseren Adapter protokolliert.
Der Adapter protokolliert stattdessen Phase, HTTP-Status und ausschließlich bekannte
Code-/Typ-/Parameterkategorien. Unbekannte Werte werden zu `other`, verschachtelte
Parameter zum bekannten Wurzelfeld. Bei internen Fehlern erscheinen nur Ausnahmeklassen
und eine Codestelle. Spring-AI-/OpenAI-Bibliothekslogs sind in `application.yml` deaktiviert,
weil Spring AIs interner `MessageAggregator` vollständige Provider-Ausnahmen protokolliert.
HTTP 400/404/422 beim Provider ergibt `AI_PROVIDER_CONFIGURATION`; HTTP 401/403 ergibt
`AI_PROVIDER_AUTHENTICATION`, jeweils als 503. Eine Provider-Anmeldeablehnung darf die
Anwendungssitzung nicht als HTTP 401 beenden. Hintergrund:
[OpenAI-Fehlerdokumentation](https://developers.openai.com/api/docs/guides/error-codes).
DTO- und Konfigurations-`toString()`-Methoden redigieren Inhalte/Schlüssel. Keine Secrets
in Nachrichten eingeben und keine HTTP-Body-Debuglogs aktivieren.

OpenAI kann bei HTTP 429 sowohl ein Guthaben-/Kontingentproblem als auch ein temporäres
Anfragelimit melden. Der Adapter unterscheidet anhand bekannter `error.code`-Werte und
gegebenenfalls `error.type`: `AI_QUOTA_EXCEEDED` verlangt eine Prüfung von API-Guthaben,
Abrechnung und Limits; `AI_RATE_LIMITED` bezeichnet bekannte temporäre Rate-Limit-Codes.
Unbekannte 429-Antworten bleiben `AI_PROVIDER_LIMIT` mit neutraler Erklärung. Diese drei
Fälle liefern HTTP 503, da die Begrenzung beim Provider liegt. Die lokalen Anwendungslimits
bleiben HTTP 429. Es werden keine Provider-Originaltexte ausgegeben oder automatisch
wiederholt. Warten allein behebt verbrauchtes Guthaben oder ein erreichtes Budget nicht.

Bei `AI_PROVIDER_LIMIT` auf einer älteren Server-JAR zunächst im richtigen OpenAI-Konto
prüfen: [API-Abrechnung](https://platform.openai.com/settings/organization/billing/overview)
und [Organisations-/Projektlimits](https://platform.openai.com/settings/organization/limits).
Nach einer Korrektur kann derselbe Test erneut ausgeführt werden, ohne die Anwendung
neu zu starten. Eine geänderte Schlüssel-/Modellkonfiguration benötigt weiterhin Neustart.
Die genaue Klassifikation der neuen JAR steht nach einem Backend-Update zur Verfügung.

## Lokal über die API ausprobieren

Nach Auswahl eines Modells und bewusster Aktivierung entstehen hier echte API-Kosten.
Das bestehende Anwendungskonto verwenden. Backend muss mit passendem `APP_ORIGIN`
laufen, bei lokalem HTTP mit `COOKIE_SECURE=false`.

```powershell
$taskAiOrigin = 'http://localhost:5173'
$taskAiApi = 'http://127.0.0.1:3001/api/v1'
$taskAiEmail = Read-Host 'E-Mail deines Anwendungskontos'
$taskAiPassword = Read-Host 'Anwendungspasswort' -AsSecureString
$taskAiCsrf = Invoke-RestMethod "$taskAiApi/auth/csrf" -SessionVariable taskAiSession
$taskAiHeaders = @{ Origin = $taskAiOrigin; 'X-CSRF-TOKEN' = $taskAiCsrf.csrfToken }
$taskAiLoginBody = @{
    email = $taskAiEmail
    password = [System.Net.NetworkCredential]::new('', $taskAiPassword).Password
} | ConvertTo-Json
$taskAiLogin = Invoke-RestMethod "$taskAiApi/auth/login" -Method Post -WebSession $taskAiSession -Headers $taskAiHeaders -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($taskAiLoginBody))
$taskAiHeaders['X-CSRF-TOKEN'] = $taskAiLogin.csrfToken
$taskAiConversation = Invoke-RestMethod "$taskAiApi/ai/conversations" -Method Post -WebSession $taskAiSession -Headers $taskAiHeaders -ContentType 'application/json' -Body '{"language":"de"}'
$taskAiBody = @{ requestId = [guid]::NewGuid().ToString(); message = 'Welche Unterstützung kannst du mir derzeit anbieten?' } | ConvertTo-Json
$taskAiRawReply = Invoke-WebRequest "$taskAiApi/ai/conversations/$($taskAiConversation.id)/messages" -UseBasicParsing -Method Post -WebSession $taskAiSession -Headers $taskAiHeaders -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($taskAiBody))
if ($taskAiRawReply.RawContentStream.CanSeek) { $taskAiRawReply.RawContentStream.Position = 0 }
$taskAiReader = [IO.StreamReader]::new($taskAiRawReply.RawContentStream, [Text.Encoding]::UTF8)
try { $taskAiReply = $taskAiReader.ReadToEnd() | ConvertFrom-Json }
finally { $taskAiReader.Dispose() }
$taskAiReply.assistant.content
Invoke-RestMethod "$taskAiApi/auth/logout" -Method Post -WebSession $taskAiSession -Headers $taskAiHeaders
Remove-Variable taskAi*
```

Für den öffentlichen Server ist `scripts/test-ai-api.ps1` die bequemere Variante.
Der Helfer liest JSON-Antworten ausdrücklich aus den UTF-8-Rohbytes. Dadurch bleiben
Umlaute und Emoji auch unter Windows PowerShell 5.1 korrekt, wenn `application/json`
keinen zusätzlichen `charset`-Parameter enthält. Es gibt keine nachträgliche
Zeichenersetzung oder heuristische Doppel-Dekodierung.

## Tests und bekannte Grenzen

M9 ergänzt den vollständigen KI-HTTP-Vertrag und echte Tomcat-Abbruch-/Logout-Tests für
den PostgreSQL-Adapter. Der isolierte Windows-Helfer kann diese Tests ohne vorhandene
Anwendungszugangsdaten mit echtem PostgreSQL ausführen. Eine optionale Messung erfasst
authentifizierte Verlaufszugriffe mit Mock-Modell. Reproduktion, Testmatrix,
Deployment-Konfiguration und Messgrenzen: [ai-quality.md](ai-quality.md).

`mvn.cmd -f backend/pom.xml test` verwendet simulierte Modelle und einen lokalen
HTTP-Testserver. Der lokale Server prüft das echte Spring-AI-/SDK-Requestformat,
fehlende Tools, `store=false`, das Tokenlimit, deaktivierte Provider-Retries und einen
Transport-Timeout. Hinzu kommen echte SDK-SSE-Abschnitte mit UTF-8/Usage/Finish-Reason
und die Schließung der Provider-Verbindung bei Abbruch. Echte lokale Tomcat-HTTP-Tests
prüfen sofortiges Flushen, JSON-Fehler vor Streambeginn, gezielten Abbruch, Browser-
Verbindungsabbruch und Logout ohne weitere Provider-Token. Kein Test sendet eine
Anfrage an OpenAI, sofern nicht ausdrücklich der separate Live-Test aktiviert wird.

Der echte Smoke-Test ist separat markiert und standardmäßig übersprungen:

```powershell
# OPENAI_API_KEY, AI_MODEL und gegebenenfalls AI_OUTPUT_TOKEN_MODE vorher sicher setzen.
# Dieser eine Test sendet eine echte kostenpflichtige Modellanfrage.
mvn.cmd -f backend/pom.xml '-Dtest=OpenAiLiveTest' '-Dforgeflow.ai.live-test=true' test
```

Gespräche und Ausführungshistorie liegen im PostgreSQL-Profil dauerhaft in der Datenbank;
Memory-Chats, HTTP-Sitzungen und Versuchslimits gehen beim Backend-Neustart verloren.
Aufbewahrung/Bereinigung sind im M8-Abschnitt beschrieben. Es gibt keine dauerhaften
Tagesbudgets. Die Versuch-/Parallelitätslimits
gelten für eine einzelne Backend-Instanz und sind kein garantiertes Euro-Limit beim
Provider. Vor öffentlicher KI-Aktivierung sind Budget-/Aufbewahrungsregeln und erlaubte
Daten gemeinsam festzulegen. Die später ergänzte bestätigte Fach-/Textdatei-/Kontoanlage
ist in [ai-workspace.md](ai-workspace.md) beschrieben. Externe Netzwerkwerkzeuge, binäre
Dateianalysen, RAG, pgvector und MCP bleiben außerhalb des implementierten Umfangs.

Offizielle Grundlagen:

- [Spring-AI-Kompatibilität](https://docs.spring.io/spring-ai/reference/getting-started.html)
- [OpenAI-Modul und manuelle Konfiguration](https://docs.spring.io/spring-ai/reference/api/chat/openai-chat.html)
- [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data)
- [Spring MVC: asynchrone Antworten und SSE](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html)
- [OpenAI-Streaming](https://developers.openai.com/api/docs/guides/streaming-responses)
- [OpenAI Function Calling: Anwendung führt Werkzeuge aus](https://developers.openai.com/api/docs/guides/function-calling)
