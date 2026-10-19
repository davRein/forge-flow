import type { Sprint, SprintDraft, SprintTaskSnapshot } from '../../../types/sprint.types';
import type { Task } from '../../../types/task.types';

type Result = { sprints: Sprint[]; error: string | null };

function validDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function getSprintTasks(sprint: Sprint, tasks: Task[]): SprintTaskSnapshot[] {
    if (sprint.completion) return sprint.completion.tasks;
    return tasks.filter((task) => task.projectId === sprint.projectId && sprint.taskIds.includes(task.id));
}

export function getTaskSprint(sprints: Sprint[], projectId: number, taskId: number) {
    return sprints.find((sprint) => sprint.projectId === projectId && sprint.status !== 'completed' && sprint.taskIds.includes(taskId));
}

export function getBacklogTasks(sprints: Sprint[], tasks: Task[], projectId: number) {
    return tasks.filter((task) => task.projectId === projectId && task.status !== 'done' && !getTaskSprint(sprints, projectId, task.id));
}

export function planSprint(sprints: Sprint[], tasks: Task[], projectId: number, draft: SprintDraft, id: number, now: string): Result {
    const fail = (error: string): Result => ({ sprints, error });
    const previous = sprints.find((sprint) => sprint.id === id);
    if (previous && previous.projectId !== projectId) return fail('Dieser Sprint gehört nicht zu diesem Projekt.');
    if (previous?.status === 'completed') return fail('Abgeschlossene Sprints können nicht mehr bearbeitet werden.');
    if (!draft.title.trim()) return fail('Bitte einen Sprint-Titel angeben.');
    if (!validDate(draft.startDate) || !validDate(draft.endDate)) return fail('Bitte ein gültiges Start- und Enddatum angeben.');
    if (draft.endDate < draft.startDate) return fail('Das Enddatum darf nicht vor dem Startdatum liegen.');

    const taskIds = [...new Set(draft.taskIds)];
    for (const taskId of taskIds) {
        const task = tasks.find((entry) => entry.id === taskId && entry.projectId === projectId);
        if (!task) return fail('Eine ausgewählte Aufgabe ist nicht mehr in diesem Projekt vorhanden.');
        const assignedSprint = getTaskSprint(sprints, projectId, taskId);
        if (assignedSprint?.id !== id && assignedSprint?.status === 'active') {
            return fail('Aufgaben eines anderen aktiven Sprints können nicht verschoben werden.');
        }
        if (task.status === 'done' && !previous?.taskIds.includes(taskId)) {
            return fail('Bereits erledigte Aufgaben können nicht neu eingeplant werden.');
        }
    }

    const sprint: Sprint = {
        ...previous, id, projectId, title: draft.title.trim(), goal: draft.goal.trim(),
        startDate: draft.startDate, endDate: draft.endDate, taskIds,
        status: previous?.status ?? 'planned', createdAt: previous?.createdAt ?? now, updatedAt: now
    };
    const updated = sprints.map((entry) => {
        if (entry.id === id) return sprint;
        if (entry.projectId !== projectId || entry.status !== 'planned') return entry;
        const remainingIds = entry.taskIds.filter((taskId) => !taskIds.includes(taskId));
        return remainingIds.length === entry.taskIds.length ? entry : { ...entry, taskIds: remainingIds, updatedAt: now };
    });
    return { sprints: previous ? updated : [...updated, sprint], error: null };
}

export function startSprint(sprints: Sprint[], tasks: Task[], projectId: number, id: number, now: string): Result {
    const fail = (error: string): Result => ({ sprints, error });
    const sprint = sprints.find((entry) => entry.id === id && entry.projectId === projectId);
    if (!sprint || sprint.status !== 'planned') return fail('Nur ein geplanter Sprint kann gestartet werden.');
    if (sprints.some((entry) => entry.projectId === projectId && entry.status === 'active')) {
        return fail('Bitte zuerst den aktiven Sprint dieses Projekts abschließen.');
    }
    if (!getSprintTasks(sprint, tasks).some((task) => task.status !== 'done')) {
        return fail('Zum Starten mindestens eine offene Aufgabe zuordnen.');
    }
    return { sprints: sprints.map((entry) => entry.id === id
        ? { ...entry, status: 'active', startedAt: now, updatedAt: now } : entry), error: null };
}

export function completeSprint(sprints: Sprint[], tasks: Task[], projectId: number, id: number, now: string): Result {
    const sprint = sprints.find((entry) => entry.id === id && entry.projectId === projectId);
    if (!sprint || sprint.status !== 'active') return { sprints, error: 'Nur ein aktiver Sprint kann abgeschlossen werden.' };
    const snapshot = getSprintTasks(sprint, tasks).map(({ id: taskId, code, title, status }) => ({ id: taskId, code, title, status }));
    return { sprints: sprints.map((entry) => entry.id === id ? {
        ...entry, status: 'completed', taskIds: [], updatedAt: now,
        completion: { completedAt: now, tasks: snapshot }
    } : entry), error: null };
}

export function deleteSprint(sprints: Sprint[], projectId: number, id: number): Result {
    const sprint = sprints.find((entry) => entry.id === id && entry.projectId === projectId);
    if (!sprint) return { sprints, error: 'Dieser Sprint ist nicht mehr vorhanden.' };
    if (sprint.status === 'active') return { sprints, error: 'Bitte den aktiven Sprint vor dem Löschen abschließen.' };
    return { sprints: sprints.filter((entry) => entry.id !== id), error: null };
}
