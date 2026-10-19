import type { Sprint, SprintDraft } from '../../../types/sprint.types';
import type { Task } from '../../../types/task.types';
import { completeSprint, deleteSprint, getBacklogTasks, getSprintTasks, planSprint, startSprint } from './sprintLogic.js';

const now = '2026-10-18T12:00:00.000Z';
const draft: SprintDraft = { title: 'Sprint 1', goal: 'Portal', startDate: '2026-10-19', endDate: '2026-11-01', taskIds: [1] };
const task = (id: number, overrides: Partial<Task> = {}): Task => ({
    id, projectId: 1, code: `FF-${id}`, title: `Aufgabe ${id}`, status: 'todo', priority: 'medium',
    createdAt: now, updatedAt: now, ...overrides
});
const sprint = (id: number, overrides: Partial<Sprint> = {}): Sprint => ({
    ...draft, id, projectId: 1, status: 'planned', createdAt: now, updatedAt: now, ...overrides
});

function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

function equal(actual: unknown, expected: unknown) {
    assert(JSON.stringify(actual) === JSON.stringify(expected), `Erwartet ${JSON.stringify(expected)}, erhalten ${JSON.stringify(actual)}`);
}

export const sprintTests = [
    { name: 'Planung validiert Titel, echte Kalenderdaten und den Zeitraum', run() {
        for (const invalid of [
            { ...draft, title: '   ' }, { ...draft, startDate: '' },
            { ...draft, startDate: '2026-02-30' }, { ...draft, endDate: '2026-10-01' }
        ]) {
            const result = planSprint([], [task(1)], 1, invalid, 1, now);
            assert(result.error, 'Ungültige Planung muss abgelehnt werden');
            equal(result.sprints, []);
        }
        assert(!planSprint([], [task(1)], 1, { ...draft, startDate: draft.endDate }, 1, now).error, 'Ein Sprint darf einen Tag dauern');
    } },
    { name: 'Umplanung verschiebt Aufgaben genau einmal und lässt andere Projekte und Epics unverändert', run() {
        const original = [sprint(1), sprint(2, { taskIds: [2] }), sprint(3, { projectId: 2, taskIds: [3] })];
        const tasks = [task(1, { epicId: 5 }), task(2), task(3, { projectId: 2 })];
        const before = JSON.stringify({ original, tasks });
        const result = planSprint(original, tasks, 1, { ...draft, taskIds: [1, 2, 1] }, 2, now);
        assert(!result.error, 'Umplanung muss möglich sein');
        equal(result.sprints.map((entry) => entry.taskIds), [[], [1, 2], [3]]);
        assert(result.sprints[2] === original[2], 'Anderes Projekt bleibt unverändert');
        equal(JSON.stringify({ original, tasks }), before);
        equal(tasks[0].epicId, 5);
    } },
    { name: 'Fremde und gelöschte Aufgaben sowie fremde Sprint-IDs werden abgelehnt', run() {
        const tasks = [task(1), task(2, { projectId: 2 })];
        assert(planSprint([], tasks, 1, { ...draft, taskIds: [2] }, 1, now).error, 'Fremde Aufgabe muss gesperrt sein');
        assert(planSprint([], tasks, 1, { ...draft, taskIds: [99] }, 1, now).error, 'Gelöschte Aufgabe muss gesperrt sein');
        assert(planSprint([sprint(1, { projectId: 2 })], tasks, 1, draft, 1, now).error, 'Fremder Sprint darf nicht überschrieben werden');
    } },
    { name: 'Aufgaben eines aktiven Sprints können nicht in einen anderen Sprint verschoben werden', run() {
        const original = [sprint(1, { status: 'active' }), sprint(2, { taskIds: [] })];
        const result = planSprint(original, [task(1)], 1, draft, 2, now);
        assert(result.error, 'Aktiver Sprint muss geschützt sein');
        assert(result.sprints === original, 'Fehler darf keine Teiländerung verursachen');
    } },
    { name: 'Bereits erledigte Aufgaben werden nicht neu eingeplant, bestehende Zuordnungen bleiben bearbeitbar', run() {
        const tasks = [task(1, { status: 'done' })];
        assert(planSprint([], tasks, 1, draft, 1, now).error, 'Neue Planung erledigter Aufgaben muss gesperrt sein');
        assert(!planSprint([sprint(1)], tasks, 1, draft, 1, now).error, 'Bestehende erledigte Aufgabe darf im Sprint bleiben');
    } },
    { name: 'Pro Projekt kann genau ein Sprint aktiv sein', run() {
        const original = [sprint(1, { status: 'active' }), sprint(2, { taskIds: [2] })];
        assert(startSprint(original, [task(1), task(2)], 1, 2, now).error, 'Zweiter aktiver Sprint im selben Projekt muss gesperrt sein');
        const otherProject = [sprint(1, { projectId: 2, status: 'active' }), sprint(2, { taskIds: [2] })];
        const result = startSprint(otherProject, [task(2)], 1, 2, now);
        assert(!result.error, 'Aktiver Sprint eines anderen Projekts darf nicht blockieren');
        equal(result.sprints[1].status, 'active');
        equal(result.sprints[1].startedAt, now);
    } },
    { name: 'Leere Sprints und Sprints ohne offene Aufgaben lassen sich nicht starten', run() {
        assert(startSprint([sprint(1, { taskIds: [] })], [], 1, 1, now).error, 'Leerer Sprint muss gesperrt sein');
        assert(startSprint([sprint(1)], [task(1, { status: 'done' })], 1, 1, now).error, 'Sprint ohne offene Aufgaben muss gesperrt sein');
        assert(startSprint([sprint(1, { status: 'completed' })], [task(1)], 1, 1, now).error, 'Abgeschlossener Sprint darf nicht neu starten');
    } },
    { name: 'Abschluss gibt offene Aufgaben frei und bewahrt das Ergebnis auch nach späteren Änderungen', run() {
        const tasks = [task(1, { status: 'done' }), task(2, { status: 'inProgress' }), task(3, { projectId: 2 })];
        const original = [sprint(1, { status: 'active', taskIds: [1, 2] })];
        const result = completeSprint(original, tasks, 1, 1, now);
        assert(!result.error, 'Abschluss muss funktionieren');
        equal(result.sprints[0].taskIds, []);
        equal(getBacklogTasks(result.sprints, tasks, 1).map((entry) => entry.id), [2]);
        equal(original[0].status, 'active');
        tasks[0].status = 'todo';
        tasks[0].title = 'Geändert';
        equal(getSprintTasks(result.sprints[0], [])[0].status, 'done');
        equal(getSprintTasks(result.sprints[0], [])[0].title, 'Aufgabe 1');
        equal(getBacklogTasks(result.sprints, tasks, 1).map((entry) => entry.id), [1, 2]);
        assert(!planSprint(result.sprints, tasks, 1, draft, 2, now).error, 'Wieder geöffnete Aufgabe muss neu planbar sein');
    } },
    { name: 'Nur aktive Sprints des gewählten Projekts können abgeschlossen werden', run() {
        assert(completeSprint([sprint(1)], [task(1)], 1, 1, now).error, 'Geplanter Sprint darf nicht abgeschlossen werden');
        assert(completeSprint([sprint(1, { status: 'active', projectId: 2 })], [task(1)], 1, 1, now).error, 'Fremdes Projekt muss geschützt sein');
    } },
    { name: 'Abgeschlossene Planung ist schreibgeschützt und aktive Sprints können nicht gelöscht werden', run() {
        assert(planSprint([sprint(1, { status: 'completed' })], [task(1)], 1, draft, 1, now).error, 'Abgeschlossener Sprint muss schreibgeschützt sein');
        const original = [sprint(1, { status: 'active' }), sprint(2, { taskIds: [2] })];
        assert(deleteSprint(original, 1, 1).error, 'Aktiver Sprint darf nicht gelöscht werden');
        const result = deleteSprint(original, 1, 2);
        assert(!result.error, 'Geplanter Sprint darf gelöscht werden');
        equal(result.sprints.map((entry) => entry.id), [1]);
        equal(getBacklogTasks(result.sprints, [task(1), task(2)], 1).map((entry) => entry.id), [2]);
    } }
];
