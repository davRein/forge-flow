import type { WorkspaceManifest, WorkspaceRecord } from './workspaceTypes';
import { wikiHierarchyError } from '../../pages/wiki/utils/wikiLogic.js';

type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ungültiges Datenobjekt.');
    return value as ObjectValue;
}
function text(value: unknown, max = 1000000): string { if (typeof value !== 'string' || value.length > max) throw new Error('Ungültiger Textwert.'); return value; }
function id(value: unknown): number { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('Ungültige Kennung.'); return value; }
function number(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Ungültiger Zahlenwert.'); return value; }
function date(value: unknown): string { const result = text(value, 64); if (!Number.isFinite(Date.parse(result))) throw new Error('Ungültiges Datum.'); return result; }
function choice<T extends string>(value: unknown, values: readonly T[]): T { if (!values.includes(value as T)) throw new Error('Ungültiger Status.'); return value as T; }
function list<T>(value: unknown, parse: (entry: ObjectValue) => T): T[] {
    if (!Array.isArray(value) || value.length > 10000) throw new Error('Ungültige Datensammlung.');
    const result = value.map((entry) => parse(object(entry)));
    const ids = result.map((entry) => (entry as { id?: number }).id).filter((entry) => entry !== undefined);
    if (new Set(ids).size !== ids.length) throw new Error('Doppelte Kennungen.');
    return result;
}
const taskStatus = ['todo', 'inProgress', 'done'] as const;
const taskPriority = ['low', 'medium', 'high'] as const;
const stamps = (entry: ObjectValue) => ({ createdAt: date(entry.createdAt), updatedAt: date(entry.updatedAt) });

export function decodeWorkspace(value: unknown): WorkspaceRecord {
    const record = object(value);
    if (record.version !== 1) throw new Error('Unbekannte Workspace-Version.');
    const revision = text(record.revision, 128);
    if (!revision) throw new Error('Workspace-Version fehlt.');
    const raw = object(record.data);
    const wiki = object(raw.wiki);
    const data: WorkspaceManifest = {
        projects: list(raw.projects, (entry) => {
            if (typeof entry.planningCompleted !== 'boolean') throw new Error('Ungültiger Planungsstand.');
            return { id: id(entry.id), customerId: id(entry.customerId), name: text(entry.name, 1000), deadline: date(entry.deadline), planningCompleted: entry.planningCompleted };
        }),
        customers: list(raw.customers, (entry) => {
            const customerId = id(entry.id);
            const contacts = list(entry.contacts ?? [], contact => ({ id: id(contact.id), customerId: id(contact.customerId), name: text(contact.name, 1000), role: text(contact.role, 200), email: text(contact.email, 254), phone: text(contact.phone, 100) }));
            if (contacts.length > 100 || contacts.some(contact => contact.customerId !== customerId || !contact.name.trim() || contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))) throw new Error('Ungültige Ansprechpartnerdaten.');
            return { id: customerId, name: text(entry.name, 1000), street: text(entry.street, 1000), postalCode: text(entry.postalCode ?? '', 32), city: text(entry.city, 1000), country: text(entry.country, 1000), email: text(entry.email, 1000), website: text(entry.website ?? '', 2000), phone: text(entry.phone, 1000), industry: text(entry.industry, 1000), contacts, notes: text(entry.notes ?? '', 6000) };
        }),
        tasks: list(raw.tasks, (entry) => ({ id: id(entry.id), projectId: id(entry.projectId), code: text(entry.code, 100), title: text(entry.title, 1000), description: text(entry.description ?? ''),
            status: choice(entry.status, taskStatus), priority: choice(entry.priority, taskPriority), ...(entry.epicId == null ? {} : { epicId: id(entry.epicId) }), ...stamps(entry) })),
        activities: list(raw.activities, (entry) => ({ id: id(entry.id), projectId: id(entry.projectId), type: choice(entry.type, ['task_created', 'task_updated', 'task_moved', 'task_deleted', 'epic_created', 'epic_updated', 'epic_deleted', 'sprint_created', 'sprint_updated', 'sprint_started', 'sprint_completed', 'sprint_deleted', 'file_added', 'file_renamed', 'file_removed']), message: text(entry.message, 4000), createdAt: date(entry.createdAt) })),
        epics: list(raw.epics, (entry) => ({ id: id(entry.id), projectId: id(entry.projectId), title: text(entry.title, 1000), description: text(entry.description), ...stamps(entry) })),
        sprints: list(raw.sprints, (entry) => {
            if (!Array.isArray(entry.taskIds)) throw new Error('Sprint-Aufgaben fehlen.');
            const completion = entry.completion == null ? undefined : object(entry.completion);
            return { id: id(entry.id), projectId: id(entry.projectId), title: text(entry.title, 1000), goal: text(entry.goal), startDate: date(entry.startDate), endDate: date(entry.endDate), status: choice(entry.status, ['planned', 'active', 'completed']),
                taskIds: entry.taskIds.map(id), ...stamps(entry), ...(entry.startedAt == null ? {} : { startedAt: date(entry.startedAt) }),
                ...(completion ? { completion: { completedAt: date(completion.completedAt), tasks: list(completion.tasks, (task) => ({ id: id(task.id), code: text(task.code, 100), title: text(task.title, 1000), status: choice(task.status, taskStatus) })) } } : {}) };
        }),
        files: list(raw.files, (entry) => ({ id: id(entry.id), projectId: id(entry.projectId), name: text(entry.name, 1000), size: number(entry.size), mediaType: text(entry.mediaType, 200), lastModified: number(entry.lastModified), addedAt: date(entry.addedAt), updatedAt: date(entry.updatedAt) })),
        wiki: {
            categories: list(wiki.categories, (entry) => ({ id: id(entry.id), name: text(entry.name, 1000), description: text(entry.description), ...stamps(entry) })),
            articles: list(wiki.articles, (entry) => ({ id: id(entry.id), title: text(entry.title, 1000), content: text(entry.content), categoryId: entry.categoryId === null ? null : id(entry.categoryId), parentId: entry.parentId == null ? null : id(entry.parentId), ...stamps(entry) }))
        }
    };
    const projectExists = (projectId: number) => data.projects.some((project) => project.id === projectId);
    const hierarchyError = wikiHierarchyError(data.wiki.articles);
    if (hierarchyError) throw new Error(hierarchyError);
    const contacts = data.customers.flatMap(customer => customer.contacts ?? []);
    if (contacts.length > 10000 || new Set(contacts.map(contact => contact.id)).size !== contacts.length) throw new Error('Doppelte oder zu viele Ansprechpartnerkennungen.');
    if (data.projects.some((project) => !data.customers.some((customer) => customer.id === project.customerId))) throw new Error('Ein Projekt verweist auf einen fehlenden Kunden.');
    if ([...data.tasks, ...data.epics, ...data.sprints, ...data.files, ...data.activities].some((entry) => !projectExists(entry.projectId))) throw new Error('Ein Datensatz verweist auf ein fehlendes Projekt.');
    if (data.tasks.some((task) => task.epicId !== undefined && !data.epics.some((epic) => epic.id === task.epicId && epic.projectId === task.projectId))) throw new Error('Ungültige Epic-Zuordnung.');
    if (data.wiki.articles.some((article) => article.categoryId !== null && !data.wiki.categories.some((category) => category.id === article.categoryId))) throw new Error('Ungültige Wiki-Kategorie.');
    if (data.sprints.some((sprint) => new Set(sprint.taskIds).size !== sprint.taskIds.length || sprint.endDate < sprint.startDate || (sprint.status === 'completed') !== !!sprint.completion)) throw new Error('Ungültige Sprint-Planung.');
    const activeProjects = data.sprints.filter((sprint) => sprint.status === 'active').map((sprint) => sprint.projectId);
    if (new Set(activeProjects).size !== activeProjects.length) throw new Error('Mehrere aktive Sprints im selben Projekt.');
    return { version: 1, revision, data };
}

export function emptyWorkspace(): WorkspaceManifest {
    return { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } };
}
