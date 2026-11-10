import { ApiError } from '../api/apiClient.js';
import type { ApiClient } from '../api/apiClient.js';

export const globalAppKeys = ['projectManager', 'git', 'wiki', 'devTools', 'timeTracker', 'business', 'cloud', 'knowledgeHub', 'flowPilot', 'pulseWatch', 'dataScout', 'requestLab'] as const;
export type GlobalAppKey = typeof globalAppKeys[number];
export type GlobalSettings = { revision: string; industries: string[]; visibleApps: GlobalAppKey[]; aiApps: GlobalAppKey[] };
export type GlobalSettingsPatch = Partial<Pick<GlobalSettings, 'industries' | 'visibleApps' | 'aiApps'>>;
export const defaultIndustries = ['IT & Software', 'Handel & E-Commerce', 'Industrie & Produktion', 'Handwerk & Bau', 'Beratung & Dienstleistungen',
    'Gesundheit & Soziales', 'Bildung & Forschung', 'Finanzen & Versicherungen', 'Medien & Kommunikation', 'Transport & Logistik', 'Öffentlicher Dienst', 'Sonstige'];
export const defaultVisibleApps: GlobalAppKey[] = [...globalAppKeys];
export const defaultAiApps: GlobalAppKey[] = ['projectManager'];
export type GlobalSettingsRepository = { load(signal: AbortSignal): Promise<GlobalSettings>; save(value: GlobalSettings, signal: AbortSignal): Promise<GlobalSettings> };
export function normalizeIndustries(values: string[]) {
    const result = values.map(value => value.trim().normalize('NFC'));
    if (!result.length || result.length > 100 || result.some(value => !value || value.length > 100 || Array.from(value).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159))
        || new Set(result.map(value => value.toLowerCase())).size !== result.length) throw new Error('Bitte 1 bis 100 eindeutige Branchen mit jeweils höchstens 100 Zeichen angeben.');
    return result;
}
function decode(value: unknown): GlobalSettings {
    if (!value || typeof value !== 'object') throw new Error('Ungültige globale Einstellungen.');
    const data = value as Record<string, unknown>;
    if (typeof data.revision !== 'string' || !data.revision || data.revision.length > 128
        || !Array.isArray(data.industries) || !data.industries.every(item => typeof item === 'string')
        || !Array.isArray(data.visibleApps) || !Array.isArray(data.aiApps)) throw new Error('Ungültige globale Einstellungen.');
    const visibleApps = normalizeApps(data.visibleApps, false);
    const aiApps = normalizeApps(data.aiApps, true);
    return { revision: data.revision, industries: normalizeIndustries(data.industries), visibleApps, aiApps };
}
function normalizeApps(values: unknown[], allowEmpty: boolean): GlobalAppKey[] {
    if ((!allowEmpty && values.length === 0) || values.length > globalAppKeys.length
        || !values.every((value): value is GlobalAppKey => typeof value === 'string' && (globalAppKeys as readonly string[]).includes(value))
        || new Set(values).size !== values.length) throw new Error('Ungültige globale App-Auswahl.');
    return [...values];
}
export function createGlobalSettingsRepository(client: ApiClient): GlobalSettingsRepository {
    const epoch = client.epoch;
    return {
        async load(signal) { return decode(await client.request('/settings/global', { signal, epoch })); },
        async save(value, signal) { return decode(await client.request('/settings/global', { method: 'PUT', signal, epoch, headers: { 'If-Match': `"${value.revision}"` }, body: normalizeGlobalSettings(value) })); }
    };
}
export function createSessionGlobalSettingsRepository(): GlobalSettingsRepository {
    let current: GlobalSettings = { revision: 'session-1', industries: [...defaultIndustries], visibleApps: [...defaultVisibleApps], aiApps: [...defaultAiApps] }; let version = 1;
    return { async load() { return { ...current, industries: [...current.industries] }; }, async save(value) {
        if (value.revision !== current.revision) throw new Error('Die Branchenliste wurde inzwischen geändert. Bitte neu laden.');
        current = { ...normalizeGlobalSettings(value), revision: `session-${++version}` }; return { ...current };
    } };
}
function normalizeGlobalSettings(value: GlobalSettings): GlobalSettings {
    return { revision: value.revision, industries: normalizeIndustries(value.industries),
        visibleApps: normalizeApps(value.visibleApps, false), aiApps: normalizeApps(value.aiApps, true) };
}
export function createGlobalSettingsStore(repository: GlobalSettingsRepository) {
    let state: { data: GlobalSettings | null; status: 'loading' | 'ready' | 'saving' | 'error'; error: string | null } = { data: null, status: 'loading', error: null };
    let controller: AbortController | null = null, generation = 0, disposed = false;
    const listeners = new Set<() => void>();
    const update = (next: typeof state) => { if (!disposed) { state = next; listeners.forEach(listener => listener()); } };
    const failure = (error: unknown) => error instanceof ApiError || error instanceof Error ? error.message : 'Die Branchenliste konnte nicht geladen werden.';
    return {
        getSnapshot: () => state,
        subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        async load() {
            if (disposed || state.status === 'saving') return;
            controller?.abort(); const request = new AbortController(); controller = request; const ticket = ++generation;
            update({ ...state, status: 'loading', error: null });
            try { const data = decode(await repository.load(request.signal)); if (!disposed && ticket === generation) update({ data, status: 'ready', error: null }); }
            catch (error) { if (!disposed && ticket === generation) update({ ...state, status: 'error', error: failure(error) }); }
        },
        async save(patch: GlobalSettingsPatch) {
            if (disposed || state.status !== 'ready' || !state.data) return false;
            const request = new AbortController(); controller = request; const ticket = ++generation; const original = state.data;
            update({ ...state, status: 'saving', error: null });
            try {
                const next = normalizeGlobalSettings({ ...original, ...patch });
                const data = decode(await repository.save(next, request.signal));
                if (disposed || ticket !== generation) return false;
                update({ data, status: 'ready', error: null }); return true;
            } catch (error) { if (!disposed && ticket === generation) update({ data: original, status: 'ready', error: failure(error) }); return false; }
        },
        connect() { disposed = false; },
        dispose() { disposed = true; generation++; controller?.abort(); listeners.clear(); }
    };
}
export type GlobalSettingsStore = ReturnType<typeof createGlobalSettingsStore>;
