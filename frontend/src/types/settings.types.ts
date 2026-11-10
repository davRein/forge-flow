import type { TaskPriorityKey } from '../pages/projects/types/task.types';

export const themeModes = ['dark', 'light', 'aurora', 'dune', 'forest', 'ink', 'rose'] as const;
export type ThemeMode = typeof themeModes[number];
export type AppLanguage = 'de' | 'en' | 'fr';

export type AppSettings = {
    themeMode: ThemeMode;
    defaultProjectView: 'dashboard' | 'projects';
    defaultTaskPriority: TaskPriorityKey;
    language: AppLanguage;
};
