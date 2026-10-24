import type { ProjectTab } from '../../pages/projects/types/projectTabs.types.js';

export const chatPages: Readonly<Record<string, string>> = {
    '/projectManager/dashboard': 'Projekt Dashboard', '/projectManager/projects': 'Projekte',
    '/projectManager/customers': 'Kunden', '/projectManager/settings': 'Einstellungen',
    '/wiki/home': 'Dokumentationsübersicht', '/wiki/articles': 'Dokumentationsseiten', '/wiki/categories': 'Dokumentationsbereiche', '/wiki/search': 'Dokumentationssuche',
    '/devTools/json': 'JSON Formatter', '/devTools/rest': 'REST-Test', '/devTools/calculator': 'Rechner', '/devTools/converter': 'Konverter'
};
export const chatProjectTabs: Readonly<Record<ProjectTab, string>> = {
    overview: 'Projektübersicht', tasks: 'Projektaufgaben', board: 'Kanban-Board', tickets: 'Tickets (Platzhalter)',
    epics: 'Epics', sprints: 'Sprints', files: 'Projektdateien', settings: 'Projekteinstellungen'
};
export type ChatPageContext = { route: string; projectId?: number | null; projectTab?: ProjectTab | null };
const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
export function isChatPageContext(value: unknown): value is ChatPageContext {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const page = value as Record<string, unknown>;
    if (Object.keys(page).some(key => !['route', 'projectId', 'projectTab'].includes(key))
        || typeof page.route !== 'string' || !own(chatPages, page.route)) return false;
    if (page.projectId == null) return page.projectTab == null;
    return typeof page.projectId === 'number' && Number.isSafeInteger(page.projectId) && page.projectId > 0
        && ['/projectManager/dashboard', '/projectManager/projects'].includes(page.route)
        && (page.projectTab == null || typeof page.projectTab === 'string' && own(chatProjectTabs, page.projectTab));
}
export function pageContextForRoute(route: string, project?: { projectId: number; projectTab: ProjectTab } | null): ChatPageContext | null {
    if (!own(chatPages, route)) return null;
    const page = { route, ...(project && ['/projectManager/dashboard', '/projectManager/projects'].includes(route)
        ? { projectId: project.projectId, projectTab: project.projectTab } : {}) };
    return isChatPageContext(page) ? page : { route };
}
export function copyPageContext(page: ChatPageContext | null | undefined): ChatPageContext | null {
    return page == null ? null : { route: page.route, ...(page.projectId == null ? {} : { projectId: page.projectId, projectTab: page.projectTab ?? 'overview' }) };
}
export function samePageContext(first: ChatPageContext | null | undefined, second: ChatPageContext | null | undefined) {
    return first == null || second == null ? first == null && second == null
        : first.route === second.route && (first.projectId ?? null) === (second.projectId ?? null)
            && (first.projectId == null || (first.projectTab ?? 'overview') === (second.projectTab ?? 'overview'));
}
