import type { ApiClient } from '../api/apiClient';

export const languages = ['typescript', 'javascript', 'java', 'python', 'sql', 'html', 'css', 'json', 'bash', 'csharp', 'go', 'rust', 'php', 'plaintext'] as const;
export type CodeLanguage = typeof languages[number];
export type Snippet = { id: string; title: string; language: CodeLanguage; prompt: string; code: string; kind: 'snippet' | 'sql'; updatedAt: string };
export type Connection = { id: string; name: string; host: string; port: number; database: string; username: string; sslMode: string; hasPassword: boolean };
export type Clone = { repositoryId: number; name: string; status: string; path: string; at: string };
export type DeveloperView = { revision: string; snippets: Snippet[]; connections: Connection[]; githubConnected: boolean; githubLogin: string; clones: Clone[]; integrationsConfigured: boolean };
export type Repository = { id: number; name: string; privateRepo: boolean; description: string; size: number; url: string };
export type Repositories = { items: Repository[]; page: number; hasMore: boolean };
export type PreparedSql = { ticket: string; sql: string; readOnly: boolean; target: { name: string; host: string; port: number; database: string; username: string }; expiresAt: string };
export type SqlResult = { columns: string[]; rows: (string | null)[][]; affected: number; truncated: boolean };
export const emptyDeveloper = (): DeveloperView => ({ revision: 'local', snippets: [], connections: [], githubConnected: false, githubLogin: '', clones: [], integrationsConfigured: false });

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültige Entwicklerdaten.');
    return value as Record<string, unknown>;
}
function string(value: unknown): string { if (typeof value !== 'string') throw new Error('Ungültige Entwicklerdaten.'); return value; }
function bool(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('Ungültige Entwicklerdaten.'); return value; }
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Ungültige Entwicklerdaten.'); return value; }
function array<T>(value: unknown, parse: (item: Record<string, unknown>) => T): T[] {
    if (!Array.isArray(value)) throw new Error('Ungültige Entwicklerdaten.'); return value.map(item => parse(record(item)));
}
// Explicit copies prevent credentials or unexpected provider fields entering client state.
export function decodeDeveloper(value: unknown): DeveloperView {
    const source = record(value);
    return { revision: string(source.revision), githubConnected: bool(source.githubConnected), githubLogin: string(source.githubLogin), integrationsConfigured: bool(source.integrationsConfigured),
        snippets: array(source.snippets, item => {
            const language = string(item.language); const kind = string(item.kind);
            if (!languages.includes(language as CodeLanguage) || !['sql', 'snippet'].includes(kind)) throw new Error('Ungültige Entwicklerdaten.');
            return { id: string(item.id), title: string(item.title), language: language as CodeLanguage, prompt: string(item.prompt), code: string(item.code), kind: kind as Snippet['kind'], updatedAt: string(item.updatedAt) };
        }),
        connections: array(source.connections, item => ({ id: string(item.id), name: string(item.name), host: string(item.host), port: number(item.port), database: string(item.database), username: string(item.username), sslMode: string(item.sslMode), hasPassword: bool(item.hasPassword) })),
        clones: array(source.clones, item => ({ repositoryId: number(item.repositoryId), name: string(item.name), status: string(item.status), path: string(item.path), at: string(item.at) })) };
}

export function createDeveloperRepository(client: ApiClient) {
    return {
        async load() { return decodeDeveloper(await client.request<unknown>('/me/developer')); },
        async request<T>(path: string, body: unknown, method: string, revision?: string): Promise<T> {
            return client.request<T>(`/me/developer${path}`, { method, body, headers: revision ? { 'If-Match': `"${revision}"` } : undefined, timeoutMs: 65000 });
        }
    };
}
