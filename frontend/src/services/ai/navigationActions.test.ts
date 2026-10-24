import { isNavigationAction, sameNavigationTarget } from './navigationActions.js';
import type { NavigationAction } from './navigationActions.js';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const action: NavigationAction = { id: '11111111-1111-4111-8111-111111111111', type: 'project.open', projectId: 17, projectName: 'Alpha', projectTab: 'overview', expiresAt: '2099-01-01T00:00:00Z', status: 'proposed', resultCode: null };
export const navigationActionTests = [
    { name: 'Navigation akzeptiert nur geschlossene Typen und gültige unveränderliche Ziele', run() {
        assert(isNavigationAction(action), 'Projektöffnung fehlt');
        assert(isNavigationAction({ ...action, type: 'project.view', projectTab: 'board' }), 'Kanban fehlt');
        for (const invalid of [{ type: 'script' }, { projectTab: 'settings' }, { projectId: -1 }, { url: 'https://example.test' }, { resultCode: 'SECRET' }, { projectName: '' }, { expiresAt: 'bad' }, { status: 'executing' }]) {
            assert(!isNavigationAction({ ...action, ...invalid }), 'Unbekanntes/ungültiges Aktionsfeld wurde akzeptiert');
        }
        assert(sameNavigationTarget(action, { ...action, status: 'approved' }) && !sameNavigationTarget(action, { ...action, projectId: 18 }), 'Statusänderung darf das Ziel nicht austauschen');
    } }
];
