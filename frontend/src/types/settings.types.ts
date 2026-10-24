import type { TaskPriorityKey } from '../pages/projects/types/task.types';

export type ThemeMode = 'dark' | 'light';
export type AppLanguage = 'de' | 'en';

export type AppSettings = {
    themeMode: ThemeMode;
    defaultProjectView: 'dashboard' | 'projects';
    defaultTaskPriority: TaskPriorityKey;
    language: AppLanguage;
};
