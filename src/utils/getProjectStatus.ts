type ProjectStatus = {
    label: string;
    color: string;
    pulse: boolean;
};

type Project = {
    planningCompleted: boolean;
    deadline: string;
};

export function getProjectStatus(project: Project): ProjectStatus {
    const today = new Date();
    const deadline = new Date(project.deadline);

    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);

    const deadlineReached = deadline <= today;

    // Grün
    if (project.planningCompleted && !deadlineReached) {
        return {
            label: 'On Track',
            color: '#22c55e',
            pulse: false
        };
    }

    // Gelb
    if (!project.planningCompleted && !deadlineReached) {
        return {
            label: 'Planning',
            color: '#eab308',
            pulse: false
        };
    }

    // Orange pulsierend
    if (!project.planningCompleted && deadlineReached) {
        return {
            label: 'Planning overdue',
            color: '#f97316',
            pulse: true
        };
    }

    // Rot pulsierend
    return {
        label: 'Deadline reached',
        color: '#ef4444',
        pulse: true
    };
}