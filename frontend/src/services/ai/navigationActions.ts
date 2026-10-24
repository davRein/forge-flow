export type NavigationAction = {
    id: string; projectId: number; projectName: string; expiresAt: string;
    status: 'proposed' | 'approved' | 'rejected' | 'succeeded' | 'failed' | 'expired'; resultCode: NavigationFailure | null;
} & ({ type: 'project.open'; projectTab: 'overview' } | { type: 'project.view'; projectTab: 'tasks' | 'board' });
export type NavigationFailure = 'NAVIGATION_UNAVAILABLE' | 'UNSAVED_CHANGES' | 'CLIENT_CANCELLED' | 'EXPIRED';
export type NavigationDecision = { action: NavigationAction; executionId: string | null };
export type NavigationExecutor = (action: NavigationAction, signal: AbortSignal) => Promise<void>;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function isNavigationAction(value: unknown): value is NavigationAction {
    if (typeof value !== 'object' || value === null) return false;
    const a = value as Record<string, unknown>;
    return Object.keys(a).every(key => ['id', 'type', 'projectId', 'projectName', 'projectTab', 'expiresAt', 'status', 'resultCode'].includes(key))
        && isUuid(a.id) && typeof a.projectId === 'number' && Number.isSafeInteger(a.projectId) && a.projectId > 0
        && typeof a.projectName === 'string' && a.projectName.trim().length > 0 && a.projectName.length <= 200
        && typeof a.expiresAt === 'string' && Number.isFinite(Date.parse(a.expiresAt))
        && (a.type === 'project.open' && a.projectTab === 'overview' || a.type === 'project.view' && ['tasks', 'board'].includes(String(a.projectTab)))
        && ['proposed', 'approved', 'rejected', 'succeeded', 'failed', 'expired'].includes(String(a.status))
        && (a.status === 'failed' ? ['NAVIGATION_UNAVAILABLE', 'UNSAVED_CHANGES', 'CLIENT_CANCELLED', 'EXPIRED'].includes(String(a.resultCode)) : a.resultCode === null);
}
export function sameNavigationTarget(a: NavigationAction, b: NavigationAction) {
    return a.id === b.id && a.type === b.type && a.projectId === b.projectId && a.projectName === b.projectName
        && a.projectTab === b.projectTab && a.expiresAt === b.expiresAt;
}
export class NavigationError extends Error {
    constructor(readonly code: NavigationFailure) { super(code); }
}
