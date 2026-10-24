import { readEventStream } from './eventStream.js';
import { ApiError } from '../api/apiClient.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function bytes(text: string, bytewise = false) {
    const encoded = new TextEncoder().encode(text);
    return new ReadableStream<Uint8Array>({ start(controller) {
        if (bytewise) for (const value of encoded) controller.enqueue(new Uint8Array([value]));
        else controller.enqueue(encoded);
        controller.close();
    } });
}
export const eventStreamTests = [
    { name: 'SSE erhält UTF-8 über beliebige Bytegrenzen, CRLF und mehrzeilige JSON-Daten', async run() {
        const seen: unknown[] = [];
        await readEventStream(bytes(': heartbeat\r\nevent: delta\r\ndata: {\r\ndata: "text":"Grüße 👋"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n', true), new AbortController().signal,
            (event, data) => { seen.push([event, data]); return event === 'done'; });
        assert(JSON.stringify(seen) === JSON.stringify([['delta', { text: 'Grüße 👋' }], ['done', {}]]), 'Dekodierung oder SSE-Grenzen sind falsch');
    } },
    { name: 'SSE benötigt ein bestätigtes Abschlussereignis, EOF reicht nicht', async run() {
        let code = '';
        try { await readEventStream(bytes('event: delta\ndata: {"text":"Teil"}\n\n'), new AbortController().signal, () => false); }
        catch (error) { if (error instanceof ApiError) code = error.code; }
        assert(code === 'AI_STREAM_INTERRUPTED', 'Ein abgeschnittener Stream darf nicht erfolgreich wirken');
    } },
    { name: 'SSE verwirft defektes JSON, ungültiges UTF-8 und übergroße Ereignisse', async run() {
        for (const stream of [bytes('data: broken\n\n'), bytes(`data: ${'x'.repeat(200001)}`),
            new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([255])); controller.close(); } })]) {
            let failed = false;
            try { await readEventStream(stream, new AbortController().signal, () => false); } catch { failed = true; }
            assert(failed, 'Fehlerhafte Daten müssen abgewiesen werden');
        }
    } },
    { name: 'SSE-Abbruch beendet auch einen stillen Reader und gibt dessen Sperre frei', async run() {
        let cancelled = false;
        const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
        const controller = new AbortController();
        const waiting = readEventStream(stream, controller.signal, () => false).catch(() => {});
        controller.abort(); await waiting;
        assert(cancelled && !stream.locked, 'Abbruch muss den Transport freigeben');
    } }
];
