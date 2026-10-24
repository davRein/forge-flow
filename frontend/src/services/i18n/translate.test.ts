import { translate } from './translate.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

export const translationTests = [
    { name: 'Chat-Oberfläche sowie Anbieter-, Limit- und Abbruchdiagnosen werden übersetzt', run() {
        for (const key of ['KI-Assistent öffnen', 'Antwort wird erstellt …', 'Antwort abgebrochen. Teilantworten wurden verworfen.',
            'Zu viele Versuche. Bitte später erneut versuchen.', 'Das API-Guthaben oder Nutzungskontingent bei OpenAI reicht nicht aus. Bitte Abrechnung und Limits prüfen.']) {
            assert(translate(key, 'de') === key && translate(key, 'en') !== key, 'Chatdiagnose oder Originaltext fehlt');
        }
    } },
    { name: 'Übersetzungen decken Einstellungen, Wiki, Dev Tools und Navigation ab', run() {
        assert(translate('Nutzerverwaltung', 'en') === 'User management', 'Bestehende Einstellungen müssen weiterhin übersetzt werden');
        assert(translate('Artikel', 'en') === 'Articles', 'Wiki-Navigation fehlt');
        assert(translate('Rechner', 'en') === 'Calculator', 'Dev-Tools-Navigation fehlt');
        assert(translate('Arbeitsbereich', 'en') === 'Workspace', 'Gemeinsame Navigation fehlt');
        assert(translate('Artikel', 'de') === 'Artikel', 'Deutsch bleibt die Originalsprache');
    } },
    { name: 'Dynamische Diagnosen werden übersetzt und behalten Positionen und Quelldetails', run() {
        assert(translate('Zahl oder Klammer an Position 7 erwartet.', 'en') === 'Expected a number or parenthesis at position 7.', 'Parserposition muss erhalten bleiben');
        assert(translate('Unerwartetes Zeichen an Position 3.', 'en') === 'Unexpected character at position 3.', 'Zeichenposition fehlt');
        assert(translate('Die Ziffer „f“ ist in Basis 10 nicht erlaubt.', 'en') === 'The digit “f” is not valid in base 10.', 'Ziffer und Basis dürfen nicht geändert werden');
        assert(translate('Zeitlimit von 30 Sekunden erreicht.', 'en') === 'Request timed out after 30 seconds.', 'Timeout muss übersetzt werden');
        const detail = 'Unexpected token in "Artikel {count}"';
        assert(translate(`Ungültiges JSON: ${detail}`, 'en') === `Invalid JSON: ${detail}`, 'Native Parserdetails dürfen nicht übersetzt oder erneut interpoliert werden');
        assert(translate('Failed to fetch. Adresse, Verbindung und CORS-Freigabe des Zielservers prüfen.', 'en').endsWith('Check the target URL, connection, and CORS permissions.'), 'Netzwerkhinweis muss übersetzt werden');
    } },
    { name: 'Zähler und Platzhalter erhalten Benutzerwerte ohne erneute Auswertung', run() {
        assert(translate('{count} Artikel', 'en', { count: 1 }) === '1 article', 'Englische Einzahl fehlt');
        assert(translate('{count} Artikel', 'en', { count: 2 }) === '2 articles', 'Englische Mehrzahl fehlt');
        assert(translate('{count} von {total} Kategorien', 'de', { count: 1, total: 4 }) === '1 von 4 Kategorien', 'Deutsche Parameter müssen eingesetzt werden');
        const title = 'Artikel {title} <script>';
        const result = translate('„{title}“ wirklich löschen? Ein ungespeicherter Entwurf dieses Artikels wird ebenfalls entfernt.', 'en', { title });
        assert(result.includes(`“${title}”`), 'Benutzertitel muss exakt erhalten bleiben');
        assert(translate('Unbekannter Originaltext', 'en') === 'Unbekannter Originaltext', 'Unbekannte technische Details dürfen nicht verschwinden');
        for (const key of ['constructor', 'toString', '__proto__']) {
            assert(translate(key, 'en') === key, 'Unbekannte Texte dürfen nicht als geerbte Objekteigenschaften behandelt werden');
        }
    } }
];
