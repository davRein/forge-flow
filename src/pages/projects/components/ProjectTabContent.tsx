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

type TaskState = ReturnType<typeof useTasks>;

type Props = {
    activeTab: ProjectTab;
    project: Project;
    customer: Customer | undefined;
    taskState: TaskState;
};

export default function ProjectTabContent({
                                              activeTab,
                                              project,
                                              customer,
                                              taskState
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
                    taskState={taskState}
                />
            );

        case 'tickets':
            return <TicketsTab />;

        case 'tasks':
            return (
                <TasksTab
                    project={project}
                    taskState={taskState}
                />
            );

        case 'epics':
            return <EpicsTab />;

        case 'sprints':
            return <SprintsTab />;

        case 'files':
            return <FilesTab />;

        case 'settings':
            return <SettingsTab />;

        default:
            return null;
    }
}