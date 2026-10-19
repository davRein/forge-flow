import type { AppSettings } from '../types/settings.types';

export const defaultSettings: Readonly<AppSettings> = Object.freeze({
    themeMode: 'dark',
    defaultProjectView: 'dashboard',
    defaultTaskPriority: 'medium'
});
