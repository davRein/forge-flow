# Gemeinsame Suite-Anmeldung und Standalone-Modus

Implementiert auf ausdrücklichen Anwenderwunsch vom 5. November 2026; korrigierte
Deployment-Konfiguration lokal geprüft. Nach Bereitstellung von
`20261105T120842Z-29291506` bestätigt der Anwender: Beide Apps laden remote.

- Bestehender origin-/quellengeprüfter Frame-Handshake wählt die Darstellung und den
  API-Modus. Die Benutzerkennung wird ausschließlich serverseitig über eine frische
  Dev-Suite-Sitzungsprüfung ermittelt; keine Passwörter/Identität über postMessage.
- Java liefert ein minimales Profil ohne CSRF-/Sessiontoken. Python leitet ausschließlich
  das HttpOnly-Sitzungscookie über eine feste Backchannel-URL weiter; Redirects/Proxys
  sind gesperrt. Abmelden, Ablauf und Deaktivieren wirken bei neuen Anfragen sofort.
- Knowledge Hub verknüpft stabile Suite-IDs mit eigenen privaten Eigentümern. Vorhandene
  Standalone-Konten/Dokumente bleiben unabhängig, kein automatisches Verknüpfen per E-Mail.
- FlowPilot erhält je Suite-ID ein eigenes PostgreSQL-Schema und einen eigenen Redis-
  Namensraum, einschließlich Ausführungen, Integrationen, Jobs und Zeitplänen. Kein
  Rückgriff auf globale Standalone-Tabellen bei Fehlern. Worker berücksichtigen dieselben
  Namensräume. Ein gemeinsames serverseitiges KI-Budget bleibt global begrenzt.
- Lokaler Standalone-Betrieb behält seine eigene App-Navigation/Anmeldung. Die öffentlichen
  Unterpfade auf forge-flow.de erzwingen dagegen den Suite-Modus für beide APIs, auch
  ohne oder mit manipuliertem Client-Header. Kein öffentlicher nativer FlowPilot-Zugang.
- Die bisherige pauschale Administrator-Sperre für eingebettete Apps wird ersetzt durch
  normale verifizierte Suite-Benutzersitzungen und echte Datentrennung.

Die erste Installation enthielt noch den alten Administrator-Check und startete die
native FlowPilot-API. Anwender meldet 403 bei beiden sichtbaren Modulen. Korrigiert:
Nginx prüft `/api/v1/auth/showcase-session`, beide API-Proxys erzwingen Suite-Modus,
FlowPilot startet Gateway/Worker mit Backchannel-Einstellungen, migriert vorhandene
Benutzerschemas und enthält die vertrauenswürdige Origin im Frontend-Build.

20 Offline-Deploymentprüfungen und 35 Backend-Integrationstests erfolgreich; drei neue
Deploymentprüfungen reproduzierten den Fehler vor der Korrektur. Lint und Produktionsbuilds
von Suite und FlowPilot erfolgreich. Anwenderbestätigung deckt den angemeldeten
Remote-Ladeweg ab, nicht sämtliche Funktionen oder eine vollständige Mehrbenutzerprüfung.
Bestehende Serverdaten/Geheimnisse bleiben erhalten.

Grundlagen: [PostgreSQL-Schemas](https://www.postgresql.org/docs/current/ddl-schemas.html),
[Nginx Basic Authentication](https://nginx.org/en/docs/http/ngx_http_auth_basic_module.html).
