export type ModuleKey = 'projectManager' | 'wiki' | 'devTools';

export type AppModule = {
    key: ModuleKey;
    label: string;
    topbarItems: string[];
};

export const modules: AppModule[] = [
    {
        key: 'projectManager',
        label: 'Project Manager',
        topbarItems: ['Dashboard', 'Projects', 'Customer', 'Einstellungen']
    },
    {
        key: 'wiki',
        label: 'Wiki',
        topbarItems: ['Start', 'Artikel', 'Kategorien', 'Suche']
    },
    {
        key: 'devTools',
        label: 'Dev Tools',
        topbarItems: ['JSON Formatter', 'REST Test', 'Calculator', 'Converter']
    }
];