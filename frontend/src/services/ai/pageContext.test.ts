import { chatPages, copyPageContext, isChatPageContext, pageContextForRoute, samePageContext } from './pageContext.js';
import { modules } from '../../config/moduleConfig.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const pageContextTests = [
    { name: 'Chat-Seitenkatalog deckt echte Routen ab und schließt URLs, Suchwerte und unbekannte Felder aus', run() {
        assert(Object.keys(chatPages).length === modules.flatMap(module => module.topbarItems).length, 'Katalog muss alle Seiten abdecken');
        for (const module of modules) for (const page of module.topbarItems)
            assert(isChatPageContext({ route: `/${module.key}/${page.key}` }), 'Bekannte Route fehlt');
        for (const value of [{ route: '/wiki/search?query=test-only-secret' }, { route: 'https://example.test' }, { route: '/wiki/home', editor: 'private' },
            { route: '/projectManager/projects', projectId: 0 }, { route: '/wiki/home', projectId: 1 }, { route: '/projectManager/projects', projectTab: 'tasks' },
            { route: '/projectManager/projects', projectId: 1, projectTab: 'unknown' }, { route: '/projectManager/projects', projectId: Number.MAX_SAFE_INTEGER + 1 }])
            assert(!isChatPageContext(value), 'Ungültiger/zu umfangreicher Kontext darf nicht akzeptiert werden');
    } },
    { name: 'Chat kopiert nur Kennung und Tab und übernimmt kein ausgewähltes Projekt in fremde Module', run() {
        const selection = { projectId: 17, projectTab: 'tasks' as const, locationKey: 'private-key', editor: 'private-draft' };
        const page = pageContextForRoute('/projectManager/projects', selection);
        assert(page?.projectId === 17 && !JSON.stringify(page).includes('private'), 'Navigation darf nur die freigegebenen Felder liefern');
        assert(pageContextForRoute('/wiki/articles', selection)?.projectId == null, 'Wiki darf keinen alten Projektbezug erben');
        assert(pageContextForRoute('/invalid', selection) === null, 'Ungültige Route muss ohne Kontext bleiben');
        const snapshot = copyPageContext(page); selection.projectId = 42;
        assert(snapshot?.projectId === 17 && samePageContext(snapshot, page), 'Snapshot muss unveränderlich gegenüber Auswahländerungen sein');
        assert(!samePageContext(snapshot, { route: '/projectManager/projects', projectId: 42, projectTab: 'tasks' }), 'Andere Projekte dürfen nicht gleichgesetzt werden');
    } }
];
