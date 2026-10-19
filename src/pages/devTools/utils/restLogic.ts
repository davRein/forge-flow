import { formatJson, validateJson } from './jsonLogic.js';

export const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = typeof httpMethods[number];
export type RequestDraft = { method: HttpMethod; url: string; headers: string; body: string; bodyType: 'none' | 'json' | 'text'; timeout: number };
export type RequestResult = { url: string; method: HttpMethod; status: number; statusText: string; ok: boolean; duration: number; headers: [string, string][]; body: string; bytes: number; truncated: boolean };
export const responseLimit = 2 * 1024 * 1024;

export function prepareRequest(draft: RequestDraft): { url: string; init: RequestInit } {
    let url: URL;
    try { url = new URL(draft.url.trim()); } catch { throw new Error('Bitte eine vollständige HTTP- oder HTTPS-Adresse eingeben.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Nur HTTP- und HTTPS-Adressen sind erlaubt.');
    if (url.username || url.password) throw new Error('Zugangsdaten bitte über einen Authorization-Header angeben.');
    if (!httpMethods.includes(draft.method)) throw new Error('Ungültige HTTP-Methode.');
    if (!Number.isInteger(draft.timeout) || draft.timeout < 1 || draft.timeout > 120) throw new Error('Das Zeitlimit muss zwischen 1 und 120 Sekunden liegen.');
    const headers = new Headers();
    for (const line of draft.headers.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const colon = line.indexOf(':');
        if (colon < 1) throw new Error('Header bitte als „Name: Wert“ pro Zeile eingeben.');
        try { headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim()); }
        catch { throw new Error('Ein Headername oder Headerwert ist ungültig.'); }
    }
    const hasBody = !['GET', 'HEAD'].includes(draft.method) && draft.bodyType !== 'none';
    if (hasBody && draft.bodyType === 'json') {
        const error = validateJson(draft.body);
        if (error) throw new Error(error);
        if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }
    if (hasBody && draft.bodyType === 'text' && !headers.has('Content-Type')) headers.set('Content-Type', 'text/plain;charset=UTF-8');
    url.hash = '';
    return { url: url.href, init: { method: draft.method, headers, body: hasBody ? draft.body : undefined, credentials: 'omit', referrerPolicy: 'no-referrer' } };
}

export async function executeRequest(draft: RequestDraft, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<RequestResult> {
    const prepared = prepareRequest(draft);
    const start = performance.now();
    const response = await fetcher(prepared.url, { ...prepared.init, signal });
    const reader = response.body?.getReader();
    let body = '';
    let bytes = 0;
    let truncated = false;
    const decoder = new TextDecoder();
    try {
        if (reader) {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                const remaining = responseLimit - bytes;
                const accepted = chunk.value.subarray(0, remaining);
                bytes += accepted.byteLength;
                body += decoder.decode(accepted, { stream: true });
                if (chunk.value.byteLength > remaining) { truncated = true; await reader.cancel(); break; }
            }
            body += decoder.decode();
        }
    } finally { reader?.releaseLock(); }
    return { url: response.url || prepared.url, method: draft.method, status: response.status, statusText: response.statusText,
        ok: response.ok, duration: Math.round(performance.now() - start), headers: [...response.headers.entries()], body, bytes, truncated };
}

export function formatResponseBody(body: string): string {
    return validateJson(body) === null ? formatJson(body, '  ') : body;
}
