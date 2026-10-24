import { isUuid } from './navigationActions.js';

export const workspaceEntities = ['customers', 'projects', 'tasks', 'activities', 'epics', 'sprints', 'files', 'articles', 'categories', 'users', 'profile', 'settings', 'industries', 'contacts'] as const;
export type WorkspaceEntity = typeof workspaceEntities[number];
export type WorkspaceMutation = {
    id: string; type: 'workspace.create' | 'workspace.update'; entity: WorkspaceEntity; data: Record<string, unknown>; before?: Record<string, unknown> | null; revision: string;
    expiresAt: string; status: 'proposed' | 'succeeded' | 'rejected' | 'expired'; resultRevision: string | null;
};
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const fields: Record<string, readonly string[]> = {
    customers: ['id', 'name', 'street', 'postalCode', 'city', 'country', 'email', 'website', 'phone', 'industry', 'notes', 'contacts'],
    contacts: ['id', 'customerId', 'name', 'role', 'email', 'phone'],
    projects: ['id', 'customerId', 'name', 'planningCompleted', 'deadline'], tasks: ['id', 'projectId', 'epicId', 'code', 'title', 'description', 'status', 'priority', 'createdAt', 'updatedAt'],
    epics: ['id', 'projectId', 'title', 'description', 'createdAt', 'updatedAt'],
    sprints: ['id', 'projectId', 'title', 'goal', 'startDate', 'endDate', 'status', 'taskIds', 'createdAt', 'updatedAt', 'startedAt', 'completion'],
    articles: ['id', 'title', 'content', 'categoryId', 'parentId', 'createdAt', 'updatedAt'], categories: ['id', 'name', 'description', 'createdAt', 'updatedAt'],
    files: ['id', 'projectId', 'name', 'size', 'mediaType', 'lastModified', 'addedAt', 'updatedAt', 'content'], users: ['id', 'name', 'email', 'administrator', 'active']
};
export function isWorkspaceMutation(value: unknown): value is WorkspaceMutation {
    if (!record(value) || !isUuid(value.id) || !['workspace.create', 'workspace.update'].includes(String(value.type)) || typeof value.entity !== 'string' || !fields[value.entity]
        || !record(value.data) || !Object.keys(value.data).every(key => fields[String(value.entity)].includes(key))
        || !(value.entity === 'users' ? isUuid(value.data.id) && value.data.administrator === false && value.data.active === true
            : typeof value.data.id === 'number' && Number.isSafeInteger(value.data.id) && value.data.id > 0)
        || JSON.stringify(value.data).length > 12000 || typeof value.revision !== 'string' || !value.revision || value.revision.length > 128
        || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
        || !['proposed', 'succeeded', 'rejected', 'expired'].includes(String(value.status))
        || !(value.resultRevision === null || typeof value.resultRevision === 'string' && value.resultRevision.length <= 128)) return false;
    if (value.type === 'workspace.update') {
        const allowed: Record<string, readonly string[]> = {
            customers: ['name', 'street', 'postalCode', 'city', 'country', 'email', 'website', 'phone', 'industry', 'notes'], contacts: ['name', 'role', 'email', 'phone'], projects: ['name', 'customerId', 'deadline', 'planningCompleted'],
            tasks: ['title', 'description', 'status', 'priority', 'epicId', 'updatedAt'], epics: ['title', 'description', 'updatedAt'],
            sprints: ['title', 'goal', 'startDate', 'endDate', 'taskIds', 'updatedAt'], articles: ['title', 'content', 'categoryId', 'parentId', 'updatedAt'],
            categories: ['name', 'description', 'updatedAt'], files: ['name', 'updatedAt']
        };
        const changed = Object.keys(value.data).filter(key => key !== 'id');
        if (!allowed[value.entity] || !record(value.before) || JSON.stringify(value.before).length > 12000 || changed.length === 0
            || changed.length !== Object.keys(value.before).length || !changed.every(key => allowed[value.entity as string].includes(key) && Object.prototype.hasOwnProperty.call(value.before, key))) return false;
    } else if (value.before != null || value.entity === 'customers' && value.data.contacts !== undefined && (!Array.isArray(value.data.contacts) || value.data.contacts.length !== 0)) return false;
    return [...Object.values(value.data), ...Object.values(record(value.before) ? value.before : {})].every(item => item === null || typeof item === 'string' && item.length <= 6000 || typeof item === 'boolean'
        || typeof item === 'number' && Number.isSafeInteger(item) && item >= 0 || Array.isArray(item) && item.length <= 10000 && item.every(id => typeof id === 'number' && Number.isSafeInteger(id) && id > 0));
}
export function sameCreation(first: WorkspaceMutation, second: WorkspaceMutation) {
    const canonical = (data: Record<string, unknown>) => JSON.stringify(Object.keys(data).sort().map(key => [key, data[key]]));
    return first.id === second.id && first.type === second.type && first.entity === second.entity && first.revision === second.revision
        && first.expiresAt === second.expiresAt && canonical(first.data) === canonical(second.data) && canonical(first.before ?? {}) === canonical(second.before ?? {});
}
