import { executeRequest, formatResponseBody, prepareRequest, responseLimit } from './restLogic.js';
import type { RequestDraft } from './restLogic';

const fixture = (changes: Partial<RequestDraft> = {}): RequestDraft => ({ method: 'GET', url: 'https://example.test/api?name=Grüße#abschnitt', headers: '', body: '', bodyType: 'none', timeout: 30, ...changes });
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function equal(actual: unknown, expected: unknown) { assert(actual === expected, `Erwartet ${String(expected)}, erhalten ${String(actual)}`); }
function rejects(action: () => unknown) { let failed = false; try { action(); } catch { failed = true; } assert(failed, 'Ungültige Anfrage muss abgelehnt werden'); }

export const restTests = [
    { name: 'REST-Anfragen normalisieren URLs, entfernen Fragmente und senden keine Cookies', run() {
        const result = prepareRequest(fixture());
        equal(result.url, 'https://example.test/api?name=Gr%C3%BC%C3%9Fe');
        equal(result.init.credentials, 'omit');
        equal(result.init.referrerPolicy, 'no-referrer');
        equal(result.init.method, 'GET');
    } },
    { name: 'HTTP-Adressen, Zugangsdaten, Header und Zeitlimits werden vor dem Senden validiert', run() {
        for (const url of ['', '/api', 'file:///secret', 'javascript:alert(1)', 'https://user:pass@example.test']) rejects(() => prepareRequest(fixture({ url })));
        for (const headers of ['Kein Doppelpunkt', ': Wert', 'Bad Name: Wert', 'Name: Wert\rInjected: Nein']) rejects(() => prepareRequest(fixture({ headers })));
        for (const timeout of [0, -1, 121, 2.5, NaN]) rejects(() => prepareRequest(fixture({ timeout })));
    } },
    { name: 'JSON-Bodies werden validiert und Header mit Doppelpunkten und Wiederholungen bleiben erhalten', run() {
        const body = '{"id":900719925474099312345}';
        const result = prepareRequest(fixture({ method: 'POST', bodyType: 'json', body, headers: 'X-Link: https://example.test:443/api\nX-Tag: A\nX-Tag: B' }));
        const headers = new Headers(result.init.headers);
        equal(result.init.body, body);
        equal(headers.get('Content-Type'), 'application/json');
        equal(headers.get('X-Link'), 'https://example.test:443/api');
        equal(headers.get('X-Tag'), 'A, B');
        const custom = prepareRequest(fixture({ method: 'PATCH', bodyType: 'json', body: '{}', headers: 'Content-Type: application/merge-patch+json' }));
        equal(new Headers(custom.init.headers).get('Content-Type'), 'application/merge-patch+json');
        rejects(() => prepareRequest(fixture({ method: 'POST', bodyType: 'json', body: '{kaputt}' })));
    } },
    { name: 'GET, HEAD und Kein Body senden auch bei vorhandenem Entwurf keinen Inhalt', run() {
        for (const method of ['GET', 'HEAD'] as const) {
            equal(prepareRequest(fixture({ method, bodyType: 'json', body: 'ungültiger Entwurf' })).init.body, undefined);
        }
        equal(prepareRequest(fixture({ method: 'DELETE', bodyType: 'none', body: 'Entwurf' })).init.body, undefined);
        const text = prepareRequest(fixture({ method: 'PUT', bodyType: 'text', body: 'Text' }));
        equal(text.init.body, 'Text');
        equal(new Headers(text.init.headers).get('Content-Type'), 'text/plain;charset=UTF-8');
    } },
    { name: 'HTTP-Fehler liefern weiterhin Status, Header und lesbaren Antwortinhalt', async run() {
        let calls = 0;
        const fetcher: typeof fetch = async (url, init) => {
            calls++;
            equal(String(url), prepareRequest(fixture()).url);
            equal(init?.method, 'GET');
            return new Response('{"error":"Nicht gefunden"}', { status: 404, statusText: 'Not Found', headers: { 'X-Test': 'sichtbar' } });
        };
        const result = await executeRequest(fixture(), new AbortController().signal, fetcher);
        equal(calls, 1); equal(result.status, 404); equal(result.ok, false); equal(result.statusText, 'Not Found');
        equal(result.body, '{"error":"Nicht gefunden"}');
        assert(result.headers.some(([key, value]) => key === 'x-test' && value === 'sichtbar'), 'Header müssen verfügbar bleiben');
        assert(result.duration >= 0, 'Die Dauer muss erfasst werden');
    } },
    { name: 'Antworten werden bei UTF-8-Zeichen über mehrere Chunks korrekt gelesen', async run() {
        const body = 'Grüße 🌍';
        const bytes = new TextEncoder().encode(body);
        const fetcher: typeof fetch = async () => new Response(new ReadableStream<Uint8Array>({ start(controller) {
            for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
            controller.close();
        } }));
        const result = await executeRequest(fixture(), new AbortController().signal, fetcher);
        equal(result.body, body); equal(result.bytes, bytes.length); equal(result.truncated, false);
    } },
    { name: 'Große Antworten werden nach 2 MiB begrenzt und der Rest des Streams abgebrochen', async run() {
        let cancelled = false;
        const fetcher: typeof fetch = async () => new Response(new ReadableStream<Uint8Array>({
            start(controller) { controller.enqueue(new Uint8Array(responseLimit + 10).fill(120)); },
            cancel() { cancelled = true; }
        }));
        const result = await executeRequest(fixture(), new AbortController().signal, fetcher);
        equal(result.bytes, responseLimit); equal(result.body.length, responseLimit); equal(result.truncated, true);
        assert(cancelled, 'Restlicher Download muss abgebrochen werden');
    } },
    { name: 'Abbruchsignal erreicht die Anfrage und Netzwerkfehler bleiben erkennbar', async run() {
        const controller = new AbortController();
        const fetcher: typeof fetch = async (_url, init) => new Promise<Response>((_resolve, reject) => {
            assert(init?.signal === controller.signal, 'Abbruchsignal muss unverändert weitergereicht werden');
            init.signal.addEventListener('abort', () => reject(new DOMException('Abgebrochen', 'AbortError')), { once: true });
        });
        const promise = executeRequest(fixture(), controller.signal, fetcher);
        controller.abort();
        let failed = false;
        try { await promise; } catch (error) { failed = error instanceof DOMException && error.name === 'AbortError'; }
        assert(failed, 'Abbruch muss die Anfrage beenden');
        const networkFailure: typeof fetch = async () => { throw new TypeError('Netzwerkfehler'); };
        failed = false;
        try { await executeRequest(fixture(), new AbortController().signal, networkFailure); }
        catch (error) { failed = error instanceof TypeError; }
        assert(failed, 'Netzwerkfehler dürfen nicht als erfolgreiche Antwort erscheinen');
    } },
    { name: 'Leere Antworten und Rohtext bleiben erhalten, JSON wird ohne Zahlenverlust dargestellt', async run() {
        const fetcher: typeof fetch = async () => new Response(null, { status: 204 });
        const result = await executeRequest(fixture({ method: 'HEAD' }), new AbortController().signal, fetcher);
        equal(result.body, ''); equal(result.bytes, 0); equal(result.ok, true);
        equal(formatResponseBody('<html>Fehler</html>'), '<html>Fehler</html>');
        equal(formatResponseBody(''), '');
        equal(formatResponseBody('{"id":900719925474099312345}'), '{\n  "id": 900719925474099312345\n}');
    } }
];
