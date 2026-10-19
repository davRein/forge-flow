import { useRef } from 'react';
import { useWorkspaceField } from '../../../../../hooks/workspaceContext';
import type { Epic, EpicDraft } from '../../../types/epic.types';
import type { useTasks } from '../../tasks/hooks/useTasks';

type TaskState = ReturnType<typeof useTasks>;

export function useEpics(projectId: number, taskState: TaskState) {
    const [epicList, setEpicList] = useWorkspaceField('epics');
    const nextId = useRef(Math.max(0, ...epicList.map((epic) => epic.id)) + 1);
    const projectEpics = epicList.filter((epic) => epic.projectId === projectId);

    function saveEpic(draft: EpicDraft, editingId: number | null): string | null {
        if (!draft.title.trim()) return 'Bitte einen Titel für das Epic angeben.';
        if (editingId !== null && !projectEpics.some((epic) => epic.id === editingId)) {
            return 'Dieses Epic ist nicht mehr vorhanden.';
        }
        if (draft.taskIds.some((id) => !taskState.projectTasks.some((task) => task.id === id))) {
            return 'Eine der ausgewählten Aufgaben ist nicht mehr in diesem Projekt vorhanden.';
        }

        const now = new Date().toISOString().split('T')[0];
        const previous = projectEpics.find((epic) => epic.id === editingId);
        const epic: Epic = {
            id: editingId ?? nextId.current++,
            projectId,
            title: draft.title.trim(),
            description: draft.description.trim(),
            createdAt: previous?.createdAt ?? now,
            updatedAt: now
        };
        setEpicList((current) => editingId === null ? [...current, epic]
            : current.map((entry) => entry.id === editingId ? epic : entry));
        taskState.assignTasksToEpic(epic, draft.taskIds);
        taskState.addActivity(editingId === null ? 'epic_created' : 'epic_updated',
            `Epic „${epic.title}“ wurde ${editingId === null ? 'erstellt' : 'aktualisiert'}`);
        return null;
    }

    function deleteEpic(id: number) {
        const epic = projectEpics.find((entry) => entry.id === id);
        if (!epic) return;
        setEpicList((current) => current.filter((entry) => entry.id !== id));
        taskState.clearEpicAssignments(id);
        taskState.addActivity('epic_deleted', `Epic „${epic.title}“ wurde gelöscht`);
    }

    function removeProjectEpics(deletedProjectId: number) {
        setEpicList((current) => current.filter((epic) => epic.projectId !== deletedProjectId));
    }

    return { projectEpics, saveEpic, deleteEpic, removeProjectEpics };
}
