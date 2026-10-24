export class ApiError extends Error {
    constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = 'ApiError'; }
}

type Options = { method?: string; body?: unknown; signal?: AbortSignal; headers?: HeadersInit; epoch?: number; auth?: boolean;
    responseType?: 'json' | 'blob' | 'stream'; timeoutMs?: number;
    consume?: (body: ReadableStream<Uint8Array>, signal: AbortSignal) => Promise<unknown> };
export function createApiClient(baseUrl: string, fetcher: typeof fetch = fetch, timeoutMs = 30000) {
    if (!/^\/(?!\/)/.test(baseUrl) || baseUrl.includes('\\') || baseUrl.includes('?') || baseUrl.includes('#')) throw new Error('Die API-Adresse muss ein relativer Pfad derselben Domain sein.');
    const base = baseUrl.replace(/\/$/, '');
    let csrfToken: string | null = null;
    let epoch = 0;
    let unauthorized: (() => void) | null = null;
    return {
        get epoch() { return epoch; },
        setSession(token: string | null) { csrfToken = token; epoch++; },
        onUnauthorized(callback: (() => void) | null) { unauthorized = callback; },
        async request<T>(path: string, options: Options = {}): Promise<T> {
            if (!/^\/(?!\/)/.test(path) || path.includes('\\')) throw new Error('Ungültiger API-Pfad.');
            const requestEpoch = options.epoch ?? epoch;
            if (requestEpoch !== epoch) throw new ApiError(401, 'STALE_SESSION', 'Diese Sitzung ist nicht mehr gültig.');
            const controller = new AbortController();
            const abort = () => controller.abort(options.signal?.reason);
            if (options.signal?.aborted) abort();
            else options.signal?.addEventListener('abort', abort, { once: true });
            const timer = setTimeout(() => controller.abort('timeout'), options.timeoutMs ?? timeoutMs);
            const execute = async (): Promise<T> => {
                const headers = new Headers(options.headers);
                headers.set('Accept', options.responseType === 'stream' ? 'text/event-stream, application/json' : 'application/json');
                const method = options.method ?? 'GET';
                if (!['GET', 'HEAD'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
                const isForm = options.body instanceof FormData;
                if (options.body !== undefined && !isForm) headers.set('Content-Type', 'application/json');
                let response: Response;
                try {
                    response = await fetcher(`${base}${path}`, { method, headers, signal: controller.signal, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
                        body: options.body === undefined ? undefined : isForm ? options.body as FormData : JSON.stringify(options.body) });
                } catch (error) {
                    if (options.signal?.aborted) throw error;
                    throw new ApiError(0, 'NETWORK_ERROR', 'Das Backend ist nicht erreichbar. Bitte die Verbindung prüfen.');
                }
                if (!response.ok) {
                    let message = `Die Anfrage ist fehlgeschlagen (HTTP ${response.status}).`;
                    let code = 'HTTP_ERROR';
                    try {
                        const payload: unknown = await response.json();
                        if (typeof payload === 'object' && payload !== null && 'error' in payload) {
                            const detail = payload.error;
                            if (typeof detail === 'object' && detail !== null) {
                                if ('message' in detail && typeof detail.message === 'string') message = detail.message;
                                if ('code' in detail && typeof detail.code === 'string') code = detail.code;
                            }
                        }
                    } catch { /* Non-JSON errors retain their HTTP status. */ }
                    throw new ApiError(response.status, code, message);
                }
                if (options.responseType === 'stream') {
                    if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('text/event-stream') || !response.body || !options.consume)
                        throw new ApiError(502, 'INVALID_RESPONSE', 'Das Backend hat keinen gültigen Antwortstream geliefert.');
                    if (requestEpoch !== epoch) throw new ApiError(401, 'STALE_SESSION', 'Diese Sitzung ist nicht mehr gültig.');
                    return await options.consume(response.body, controller.signal) as T;
                }
                if (options.responseType === 'blob') return await response.blob() as T;
                if (response.status === 204) return undefined as T;
                try { return await response.json() as T; }
                catch { throw new ApiError(response.status, 'INVALID_RESPONSE', 'Das Backend hat keine gültige JSON-Antwort geliefert.'); }
            };
            try {
                const result = await execute();
                if (requestEpoch !== epoch) throw new ApiError(401, 'STALE_SESSION', 'Diese Sitzung ist nicht mehr gültig.');
                return result;
            }
            catch (error) {
                if (controller.signal.reason === 'timeout') throw new ApiError(408, 'TIMEOUT', 'Das Backend hat nicht rechtzeitig geantwortet. Bitte erneut versuchen.');
                if (error instanceof ApiError && error.status === 401 && options.auth !== false && requestEpoch === epoch) unauthorized?.();
                throw error;
            } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
        }
    };
}
export type ApiClient = ReturnType<typeof createApiClient>;
