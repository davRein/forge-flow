import { globalSearch } from './globalSearch.js';
import type { Workspace } from './workspaceTypes';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const globalSearchTests = [{ name: 'Global search returns real customer/project/task/page routes and caps results', run() {
    const data: Workspace = { customers: [{ id: 1, name: 'Example company', street: '', city: 'Town', country: '', industry: 'IT', email: 'contact@example.test', phone: '' }], projects: [{ id: 1, customerId: 1, name: 'Example project', deadline: '2026-12-31', planningCompleted: false }], tasks: [{ id: 1, projectId: 1, code: 'EX-1', title: 'Example task', status: 'todo', priority: 'high', createdAt: '', updatedAt: '' }], activities: [], epics: [], sprints: [], files: [], wiki: { categories: [], articles: [{ id: 1, title: 'Example guide', content: '# Notes', categoryId: null, createdAt: '', updatedAt: '' }] } };
    const results = globalSearch(data, ' example '); assert(results.length === 4 && results[2].path === '/projectManager/projects?project=1&task=1' && results[3].path === '/wiki/articles?article=1', 'Search must cover real objects');
    assert(globalSearch(data, 'e').length === 0 && globalSearch(data, 'contact@example.test')[0].kind === 'Kunde', 'Search length and hidden email matching failed');
    data.customers = Array.from({ length: 60 }, (_, index) => ({ ...data.customers[0], id: index + 1 })); assert(globalSearch(data, 'example').length === 30, 'Results must remain bounded');
} }];
