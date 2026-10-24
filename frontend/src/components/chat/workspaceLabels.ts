import type { WorkspaceEntity } from '../../services/ai/workspaceActions';
export const entityLabels: Record<WorkspaceEntity, string> = {
    customers: 'Kunden', projects: 'Projekte', tasks: 'Aufgaben', activities: 'Aktivitäten', epics: 'Epics', sprints: 'Sprints', files: 'Dateien', articles: 'Dokumentationsseiten', categories: 'Dokumentationsbereiche',
    users: 'Benutzerkonten', profile: 'Eigenes Profil', settings: 'Eigene Einstellungen', industries: 'Verfügbare Branchen', contacts: 'Ansprechpartner'
};
export const fieldLabels: Record<string, string> = {
    id: 'Kennung', name: 'Name', title: 'Titel', street: 'Straße', postalCode: 'PLZ', city: 'Ort', country: 'Land', email: 'E-Mail', website: 'Website', phone: 'Telefon', industry: 'Branche',
    customerId: 'Kundenkennung', projectId: 'Projektkennung', epicId: 'Epic-Kennung', categoryId: 'Bereichskennung', parentId: 'Übergeordnete Seitenkennung', planningCompleted: 'Planung abgeschlossen', deadline: 'Deadline',
    code: 'Aufgabencode', description: 'Beschreibung', status: 'Status', priority: 'Priorität', createdAt: 'Erstellt am', updatedAt: 'Geändert am',
    goal: 'Sprint-Ziel', startDate: 'Startdatum', endDate: 'Enddatum', taskIds: 'Aufgabenkennungen', startedAt: 'Gestartet am', completion: 'Sprint-Abschluss',
    content: 'Inhalt', message: 'Meldung', type: 'Typ', size: 'Größe', mediaType: 'Dateityp', lastModified: 'Letzte Änderung', addedAt: 'Hinzugefügt am',
    notes: 'Interne Notizen', contactCount: 'Anzahl Ansprechpartner', role: 'Funktion',
    administrator: 'Administrator', active: 'Aktiv', themeMode: 'Darstellung', defaultProjectView: 'Startansicht', defaultTaskPriority: 'Standardpriorität', language: 'Sprache'
};
