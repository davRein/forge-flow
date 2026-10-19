import { ProjectTab } from '../types/projectTabs.types';
import { Customer, Project } from '../types/project.types';

import OverviewTab from '../tabs/OverviewTab';
import BoardTab from '../tabs/BoardTab';
import TicketsTab from '../tabs/TicketsTab';
import TasksTab from '../tabs/tasks/TasksTab';
import EpicsTab from '../tabs/EpicsTab';
import SprintsTab from '../tabs/SprintsTab';
import FilesTab from '../tabs/FilesTab';
import SettingsTab from '../tabs/SettingsTab';

import { useTasks } from '../tabs/tasks/hooks/useTasks';
import type { useEpics } from '../tabs/epics/hooks/useEpics';
import type { useSprints } from '../tabs/sprints/hooks/useSprints';
import type { useProjectFiles } from '../tabs/files/hooks/useProjectFiles';

type TaskState = ReturnType<typeof useTasks>;

type Props = {
    activeTab: ProjectTab;
    onTabChange: (tab: ProjectTab) => void;
    project: Project;
    customer: Customer | undefined;
    taskState: TaskState;
    epicState: ReturnType<typeof useEpics>;
    sprintState: ReturnType<typeof useSprints>;
    fileState: ReturnType<typeof useProjectFiles>;
    onEdit: () => void;
    onDelete: () => void;
};

export default function ProjectTabContent({
                                              activeTab,
                                              onTabChange,
                                              project,
                                              customer,
                                              taskState,
                                              epicState,
                                              sprintState,
                                              fileState,
                                              onEdit,
                                              onDelete
                                          }: Props) {
    switch (activeTab) {
        case 'overview':
            return (
                <OverviewTab
                    project={project}
                    customer={customer}
                    tasks={taskState.projectTasks}
                    activities={taskState.activityList}
                />
            );

        case 'board':
            return (
                <BoardTab
                    key={project.id}
                    taskState={taskState}
                    epics={epicState.projectEpics}
                    sprints={sprintState.projectSprints}
                />
            );

        case 'tickets':
            return <TicketsTab />;

        case 'tasks':
            return (
                <TasksTab
                    project={project}
                    taskState={taskState}
                    epics={epicState.projectEpics}
                    sprints={sprintState.projectSprints}
                />
            );

        case 'epics':
            return <EpicsTab key={project.id} epicState={epicState} tasks={taskState.projectTasks} />;

        case 'sprints':
            return <SprintsTab key={project.id} sprintState={sprintState} tasks={taskState.projectTasks} onOpenTasks={() => onTabChange('tasks')} />;

        case 'files':
            return <FilesTab key={project.id} fileState={fileState} />;

        case 'settings':
            return <SettingsTab project={project} customer={customer} onEdit={onEdit} onDelete={onDelete} />;

        default:
            return null;
    }
}
