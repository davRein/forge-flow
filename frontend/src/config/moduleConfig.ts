export type ModuleKey = 'projectManager' | 'wiki' | 'devTools' | 'timeTracker' | 'business' | 'cloud';

export type AppModule = {
    key: ModuleKey;
    label: string;
    topbarItems: { key: string; label: string }[];
};

export const modules: AppModule[] = [
    {
        key: 'projectManager',
        label: 'Project Manager',
        topbarItems: [{ key: 'dashboard', label: 'Dashboard' }, { key: 'today', label: 'Meine Arbeit' }, { key: 'projects', label: 'Projekte' }, { key: 'customers', label: 'Kunden' }, { key: 'settings', label: 'Einstellungen' }]
    },
    {
        key: 'wiki',
        label: 'Dokumentation',
        topbarItems: [{ key: 'home', label: 'Übersicht' }, { key: 'articles', label: 'Seiten' }, { key: 'categories', label: 'Bereiche' }, { key: 'search', label: 'Suche' }]
    },
    {
        key: 'devTools',
        label: 'Dev Tools',
        topbarItems: [{ key: 'json', label: 'JSON Formatter' }, { key: 'rest', label: 'REST-Test' }, { key: 'calculator', label: 'Rechner' }, { key: 'converter', label: 'Konverter' }]
    },
    {
        key: 'timeTracker',
        label: 'TimeTracker',
        topbarItems: [{ key: 'calendar', label: 'Kalender' }, { key: 'reports', label: 'Auswertung' }]
    },
    {
        key: 'business', label: 'Business',
        topbarItems: [{ key: 'budgets', label: 'Budgets' }, { key: 'documents', label: 'Angebote & Rechnungen' }, { key: 'templates', label: 'Vorlagen' }, { key: 'portal', label: 'Kundenportal' }, { key: 'profile', label: 'Abrechnungseinstellungen' }]
    },
    {
        key: 'cloud', label: 'Cloud', topbarItems: [{ key: 'files', label: 'Dateien' }]
    }
];
