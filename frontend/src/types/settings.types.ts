import type { TaskPriorityKey } from '../pages/projects/types/task.types';

export const themeModes = ['dark', 'light', 'aurora', 'dune'] as const;
export type ThemeMode = typeof themeModes[number];
export type AppLanguage = 'de' | 'en';

export type AppSettings = {
    themeMode: ThemeMode;
    defaultProjectView: 'dashboard' | 'projects';
    defaultTaskPriority: TaskPriorityKey;
    language: AppLanguage;
};
