import type { ApiClient } from '../api/apiClient';
import type { SettingsRepository } from './settingsRepository';

export function createApiSettingsRepository(client: ApiClient, ownerId: string): SettingsRepository {
    const epoch = client.epoch;
    const owner = (userId: string | null) => { if (userId !== ownerId) throw new Error('Die Einstellungen gehören zu einer anderen Sitzung.'); };
    return { persistence: 'account',
        async load(userId) { owner(userId); return client.request('/me/settings', { epoch }); },
        async save(userId, record) { owner(userId); await client.request('/me/settings', { method: 'PUT', body: record, epoch }); }
    };
}
