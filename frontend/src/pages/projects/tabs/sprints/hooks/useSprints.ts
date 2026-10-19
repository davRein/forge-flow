import { useRef } from 'react';
import { useWorkspaceField } from '../../../../../hooks/workspaceContext';
import type { SprintDraft } from '../../../types/sprint.types';
import type { useTasks } from '../../tasks/hooks/useTasks';
import { completeSprint, deleteSprint, getBacklogTasks, planSprint, startSprint } from '../utils/sprintLogic';

export function useSprints(projectId: number, taskState: ReturnType<typeof useTasks>) {
    const [sprintList, setSprintList] = useWorkspaceField('sprints');
    const nextId = useRef(Math.max(0, ...sprintList.map((sprint) => sprint.id)) + 1);
    const projectSprints = sprintList.filter((sprint) => sprint.projectId === projectId);

    function saveSprint(draft: SprintDraft, editingId: number | null): string | null {
        if (editingId !== null && !projectSprints.some((sprint) => sprint.id === editingId)) {
            return 'Dieser Sprint ist nicht mehr vorhanden.';
        }
        const result = planSprint(sprintList, taskState.projectTasks, projectId, draft,
            editingId ?? nextId.current, new Date().toISOString());
        if (result.error) return result.error;
        if (editingId === null) nextId.current++;
        setSprintList(result.sprints);
        taskState.addActivity(editingId === null ? 'sprint_created' : 'sprint_updated',
            `Sprint „${draft.title.trim()}“ wurde ${editingId === null ? 'erstellt' : 'aktualisiert'}`);
        return null;
    }

    function changeStatus(id: number, action: 'start' | 'complete'): string | null {
        const sprint = projectSprints.find((entry) => entry.id === id);
        if (!sprint) return 'Dieser Sprint ist nicht mehr vorhanden.';
        const transition = action === 'start' ? startSprint : completeSprint;
        const result = transition(sprintList, taskState.projectTasks, projectId, id, new Date().toISOString());
        if (result.error) return result.error;
        setSprintList(result.sprints);
        taskState.addActivity(action === 'start' ? 'sprint_started' : 'sprint_completed',
            `Sprint „${sprint.title}“ wurde ${action === 'start' ? 'gestartet' : 'abgeschlossen'}`);
        return null;
    }

    function removeSprint(id: number): string | null {
        const result = deleteSprint(sprintList, projectId, id);
        if (result.error) return result.error;
        const sprint = projectSprints.find((entry) => entry.id === id)!;
        setSprintList(result.sprints);
        taskState.addActivity('sprint_deleted', `Sprint „${sprint.title}“ wurde gelöscht`);
        return null;
    }

    function removeProjectSprints(deletedProjectId: number) {
        setSprintList((current) => current.filter((sprint) => sprint.projectId !== deletedProjectId));
    }

    return {
        projectSprints,
        backlogTasks: getBacklogTasks(sprintList, taskState.projectTasks, projectId),
        saveSprint, changeStatus, removeSprint, removeProjectSprints
    };
}
