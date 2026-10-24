import { ApiError } from '../api/apiClient.js';

export async function readEventStream(body: ReadableStream<Uint8Array>, signal: AbortSignal,
    receive: (event: string, data: unknown) => boolean): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '', event = '', data: string[] = [], size = 0, total = 0;
    const invalid = () => new ApiError(502, 'AI_INVALID_RESPONSE', 'Der Antwortstream konnte nicht gelesen werden.');
    const abort = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', abort, { once: true });
    try {
        if (signal.aborted) throw signal.reason;
        while (true) {
            const chunk = await reader.read();
            if (signal.aborted) throw signal.reason;
            if (chunk.done) throw new ApiError(502, 'AI_STREAM_INTERRUPTED', 'Die Verbindung wurde unterbrochen. Der Verlauf wird erneut geladen.');
            total += chunk.value.byteLength;
            if (total > 1000000) throw invalid();
            buffer += decoder.decode(chunk.value, { stream: true });
            let boundary: number;
            while ((boundary = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, boundary).replace(/\r$/, '');
                buffer = buffer.slice(boundary + 1);
                size += line.length;
                if (size > 200000) throw invalid();
                if (line === '') {
                    if (data.length) {
                        let parsed: unknown;
                        try { parsed = JSON.parse(data.join('\n')); } catch { throw invalid(); }
                        if (receive(event || 'message', parsed)) return;
                    }
                    event = ''; data = []; size = 0;
                } else if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
            }
            if (buffer.length + size > 200000) throw invalid();
        }
    } finally {
        signal.removeEventListener('abort', abort);
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }
}
