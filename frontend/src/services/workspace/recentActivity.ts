import type { Workspace } from './workspaceTypes';
export type RecentActivityEntry = { id: string; kind: 'customer' | 'project' | 'settings'; action: 'created' | 'updated'; entityId: number | null; name: string; at: string };
export function decodeRecentActivity(input: unknown): RecentActivityEntry[] {
    if (!input || typeof input !== 'object' || !('entries' in input) || !Array.isArray(input.entries) || input.entries.length > 5) throw new Error('Die Historie konnte nicht geladen werden.');
    const ids = new Set<string>();
    return input.entries.map((value: unknown) => {
        if (!value || typeof value !== 'object') throw new Error('Die Historie konnte nicht geladen werden.');
        const entry = value as Record<string, unknown>;
        if (typeof entry.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entry.id) || ids.has(entry.id) || !['customer', 'project', 'settings'].includes(String(entry.kind)) || !['created', 'updated'].includes(String(entry.action))
            || typeof entry.name !== 'string' || entry.name.length > 200 || typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at))
            || (entry.kind === 'settings' ? entry.entityId !== null : typeof entry.entityId !== 'number' || !Number.isSafeInteger(entry.entityId) || entry.entityId <= 0)) throw new Error('Die Historie konnte nicht geladen werden.');
        ids.add(entry.id); return { id: entry.id, kind: entry.kind as RecentActivityEntry['kind'], action: entry.action as RecentActivityEntry['action'], entityId: entry.entityId as number | null, name: entry.name, at: entry.at };
    });
}
export function recentActivityPath(entry: RecentActivityEntry) {
    return entry.kind === 'settings' ? '/projectManager/settings' : entry.kind === 'project' ? `/projectManager/projects?project=${entry.entityId}` : `/projectManager/customers?customer=${entry.entityId}`;
}
export function recordRecentActivity(history: RecentActivityEntry[], before: Workspace, after: Workspace): RecentActivityEntry[] {
    const additions: RecentActivityEntry[] = [];
    const affected = new Set<number>();
    for (const key of ['tasks', 'epics', 'sprints', 'files'] as const) {
        const old = new Map(before[key].map(value => [value.id, JSON.stringify(value)]));
        const next = new Set(after[key].map(value => value.id));
        after[key].forEach(value => { if (old.get(value.id) !== JSON.stringify(value)) affected.add(value.projectId); });
        before[key].forEach(value => { if (!next.has(value.id)) affected.add(value.projectId); });
    }
    for (const [key, kind] of [['customers', 'customer'], ['projects', 'project']] as const) {
        const old = new Map(before[key].map(value => [value.id, JSON.stringify(value)]));
        after[key].forEach(value => {
            if (old.get(value.id) !== JSON.stringify(value) || kind === 'project' && affected.has(value.id)) additions.unshift({ id: crypto.randomUUID(), kind, action: old.has(value.id) ? 'updated' : 'created', entityId: value.id, name: value.name.slice(0, /[\uD800-\uDBFF]/.test(value.name[199] ?? '') ? 199 : 200), at: new Date().toISOString() });
        });
    }
    return [...additions, ...history.filter(entry => entry.kind === 'settings' || after[entry.kind === 'project' ? 'projects' : 'customers'].some(value => value.id === entry.entityId))].slice(0, 5);
}
