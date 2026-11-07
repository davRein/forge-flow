import { decodeUserApps } from './userAccess.js';
import type { ApiClient } from '../api/apiClient';

export type ManagedAccount = { id: string; name: string; email: string; administrator: boolean; active: boolean; username?: string; allowedApps?: string[]; sessionVersion?: number };
export const ACCOUNT_LIST_CHANGED_EVENT = 'forgeflow:accounts-changed';

function account(value: unknown): ManagedAccount {
    if (!value || typeof value !== 'object' || !('id' in value) || !('name' in value) || !('email' in value)
        || !('administrator' in value) || !('active' in value) || typeof value.id !== 'string' || !value.id
        || typeof value.name !== 'string' || typeof value.email !== 'string'
        || typeof value.administrator !== 'boolean' || typeof value.active !== 'boolean') throw new Error('Ungültige Kontoantwort.');
    const data = value as Record<string, unknown>;
    if (data.username !== undefined && (typeof data.username !== 'string' || !data.username)) throw new Error('Ungültige Kontoantwort.');
    if (data.sessionVersion !== undefined && (!Number.isSafeInteger(data.sessionVersion) || (data.sessionVersion as number) < 0)) throw new Error('Ungültige Kontoantwort.');
    return { username: data.username as string | undefined, allowedApps: decodeUserApps(data.allowedApps), sessionVersion: data.sessionVersion as number | undefined, id: value.id, name: value.name, email: value.email, administrator: value.administrator, active: value.active };
}

export function passwordError(password: string, confirmation: string): string | null {
    if (password !== confirmation) return 'Die neuen Passwörter stimmen nicht überein.';
    if (Array.from(password).length < 12 || new TextEncoder().encode(password).length > 72 || password.includes('\0')) {
        return 'Das Passwort muss mindestens 12 Zeichen und höchstens 72 UTF-8-Bytes enthalten.';
    }
    return null;
}

export function createAccountRepository(client: ApiClient, epoch = client.epoch) {
    return {
        async list(signal?: AbortSignal) {
            const result = await client.request<unknown>('/users', { signal, epoch });
            if (!Array.isArray(result)) throw new Error('Ungültige Kontoliste.');
            return result.map(account);
        },
        async create(input: { name: string; email: string; password: string; username?: string; allowedApps?: string[] }, signal?: AbortSignal) {
            return account(await client.request('/users', { method: 'POST', body: input, signal, epoch }));
        },
        async setAccess(id: string, value: { username: string; allowedApps: string[]; sessionVersion: number }, signal?: AbortSignal) {
            return account(await client.request(`/users/${encodeURIComponent(id)}/access`, { method: 'PUT', body: value, signal, epoch }));
        },
        async setActive(id: string, active: boolean, signal?: AbortSignal) {
            return account(await client.request(`/users/${encodeURIComponent(id)}/active`, { method: 'PUT', body: { active }, signal, epoch }));
        }
    };
}
