export type ModuleKey = 'projectManager' | 'wiki' | 'devTools';

export type AppModule = {
    key: ModuleKey;
    label: string;
    topbarItems: { key: string; label: string }[];
};

export const modules: AppModule[] = [
    {
        key: 'projectManager',
        label: 'Project Manager',
        topbarItems: [{ key: 'dashboard', label: 'Dashboard' }, { key: 'projects', label: 'Projekte' }, { key: 'customers', label: 'Kunden' }, { key: 'settings', label: 'Einstellungen' }]
    },
    {
        key: 'wiki',
        label: 'Wiki',
        topbarItems: [{ key: 'home', label: 'Start' }, { key: 'articles', label: 'Artikel' }, { key: 'categories', label: 'Kategorien' }, { key: 'search', label: 'Suche' }]
    },
    {
        key: 'devTools',
        label: 'Dev Tools',
        topbarItems: [{ key: 'json', label: 'JSON Formatter' }, { key: 'rest', label: 'REST-Test' }, { key: 'calculator', label: 'Rechner' }, { key: 'converter', label: 'Konverter' }]
    }
];
