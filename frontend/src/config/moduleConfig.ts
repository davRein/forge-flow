export type ModuleKey = 'projectManager' | 'wiki' | 'devTools' | 'timeTracker' | 'business' | 'cloud' | 'settings' | 'git' | 'knowledgeHub' | 'flowPilot' | 'pulseWatch' | 'dataScout' | 'requestLab';

export type AppModule = {
    key: ModuleKey;
    label: string;
    topbarItems: { key: string; label: string }[];
};

export const modules: AppModule[] = [
    {
        key: 'projectManager',
        label: 'Project Manager',
        topbarItems: [{ key: 'dashboard', label: 'Dashboard' }, { key: 'today', label: 'Meine Arbeit' }, { key: 'projects', label: 'Projekte' }, { key: 'customers', label: 'Kunden' }]
    },
    {
        key: 'git', label: 'Git', topbarItems: [{ key: 'repositories', label: 'Repositories' }]
    },
    {
        key: 'wiki',
        label: 'Dokumentation',
        topbarItems: [{ key: 'home', label: 'Übersicht' }, { key: 'articles', label: 'Seiten' }, { key: 'categories', label: 'Bereiche' }, { key: 'search', label: 'Suche' }]
    },
    {
        key: 'devTools',
        label: 'Dev Tools',
        topbarItems: [{ key: 'json', label: 'JSON Formatter' }, { key: 'calculator', label: 'Rechner' }, { key: 'converter', label: 'Konverter' }, { key: 'snippeter', label: 'Snippeter' }, { key: 'dbScripter', label: 'DB Scripter' }]
    },
    {
        key: 'requestLab', label: 'RequestLab', topbarItems: [{ key: 'client', label: 'REST-Test' }]
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
    },
    {
        key: 'settings', label: 'Einstellungen', topbarItems: [{ key: 'general', label: 'Einstellungen' }]
    },
    {
        key: 'knowledgeHub', label: 'AI Knowledge Hub',
        topbarItems: [{ key: 'chat', label: 'Chat' }, { key: 'documents', label: 'Dokumente' }, { key: 'account', label: 'Konto & Datenschutz' }, { key: 'privacy', label: 'Datenschutz' }]
    },
    {
        key: 'flowPilot', label: 'FlowPilot',
        topbarItems: [{ key: 'overview', label: 'Übersicht' }, { key: 'workflows', label: 'Workflows' }, { key: 'runs', label: 'Ausführungen' }, { key: 'integrations', label: 'Integrationen' }, { key: 'jobs', label: 'Jobs & Zeitpläne' }]
    },
    {
        key: 'pulseWatch', label: 'PulseWatch',
        topbarItems: [{ key: 'overview', label: 'Übersicht' }]
    },
    {
        key: 'dataScout', label: 'DataScout',
        topbarItems: [{ key: 'dashboard', label: 'Dashboard' }, { key: 'collection', label: 'Erfassung' }, { key: 'jobs', label: 'Jobs & Zeitpläne' }]
    }
];
