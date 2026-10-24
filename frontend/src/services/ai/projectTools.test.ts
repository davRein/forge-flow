import { isAgentExecutionProgress, isProjectToolEvent } from './projectTools.js';
import type { ProjectToolEvent } from './projectTools.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const id = '11111111-1111-4111-8111-111111111111';
const valid: ProjectToolEvent = { id, name: 'get_project_summary', status: 'completed', result: {
    outcome: 'OK', revision: '1', readAt: '2026-10-23T12:00:00Z', projects: [{ id: 1, name: 'Alpha', planningCompleted: false,
        deadline: '2026-12-31', tasks: { todo: 2, inProgress: 1, done: 3 } }], tasks: [], total: 1, offset: 0, more: false, textTruncated: false
} };
export const projectToolTests = [
    { name: 'Ausführungsfortschritt akzeptiert nur geschlossene Phasen und serverseitig begrenzte Schrittzahlen', run() {
        assert(isAgentExecutionProgress({ phase: 'thinking', step: 0, maxSteps: 4 }) && isAgentExecutionProgress({ phase: 'reading', step: 4, maxSteps: 4 })
            && isAgentExecutionProgress({ phase: 'answering', step: 4, maxSteps: 4 }), 'Gültige Grenzen fehlen');
        for (const value of [{ phase: 'script', step: 0, maxSteps: 4 }, { phase: 'reading', step: 0, maxSteps: 4 }, { phase: 'thinking', step: 4, maxSteps: 4 },
            { phase: 'thinking', step: 0, maxSteps: 7 }, { phase: 'thinking', step: -1, maxSteps: 4 }, { phase: 'reading', step: 1.5, maxSteps: 4 },
            { phase: 'thinking', step: 0, maxSteps: 4, url: 'https://example.test' }]) assert(!isAgentExecutionProgress(value), 'Ungültiger Fortschritt muss verworfen werden');
    } },
    { name: 'Projektwerkzeug-Schema akzeptiert ausschließlich bekannte lesende Werkzeuge und begrenzte Daten', run() {
        assert(isProjectToolEvent(valid) && isProjectToolEvent({ id, name: 'list_projects', status: 'started', result: null }), 'Gültiger Fortschritt und Ergebnis müssen lesbar sein');
        for (const value of [{ ...valid, name: 'delete_project' }, { ...valid, id: 'bad' }, { ...valid, status: 'execute' },
            { ...valid, result: { ...valid.result, total: 10001 } }, { ...valid, result: { ...valid.result, readAt: 'bad date' } },
            { ...valid, result: { ...valid.result, projects: Array(11).fill(valid.result?.projects[0]) } },
            { ...valid, result: { ...valid.result, tasks: [{ id: 1, code: 'AL-1', title: 'Task', status: 'done', priority: 'high' }] } }]) {
            assert(!isProjectToolEvent(value), 'Unbekannte oder übergroße Werkzeugdaten müssen verworfen werden');
        }
    } },
    { name: 'Unfertige und unbestätigte Projektergebnisse dürfen nicht als gelesen gelten', run() {
        assert(!isProjectToolEvent({ ...valid, status: 'started' }), 'Beginn darf kein Ergebnis mitliefern');
        assert(!isProjectToolEvent({ ...valid, result: null }), 'Abschluss braucht ein Ergebnis');
        assert(isProjectToolEvent({ ...valid, result: { outcome: 'INVALID_INPUT', revision: null, readAt: null, projects: [], tasks: [], total: 0, offset: 0, more: false, textTruncated: false } }), 'Abgewiesene Parameter dürfen als begrenztes Ergebnis dargestellt werden');
    } }
];
