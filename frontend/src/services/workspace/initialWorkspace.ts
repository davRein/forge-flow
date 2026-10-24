import { projects } from '../../data/projects.js';
import { customers } from '../../data/customers.js';
import { tasks } from '../../data/tasks.js';
import { initialWiki } from '../../data/wiki.js';
import type { Workspace } from './workspaceTypes';

export function createInitialWorkspace(): Workspace {
    return { projects: projects.map((entry) => ({ ...entry })),
        customers: customers.map((entry) => ({ ...entry, street: '', postalCode: '', city: '', country: '', email: '', website: '', phone: '', industry: '' })),
        tasks: tasks.map((entry) => ({ ...entry })) as Workspace['tasks'], activities: [], epics: [], sprints: [], files: [],
        wiki: { articles: initialWiki.articles.map((entry) => ({ ...entry })), categories: initialWiki.categories.map((entry) => ({ ...entry })) } };
}
