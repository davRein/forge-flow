import type { Workspace } from './workspaceTypes';
export type SearchResult = { key: string; kind: 'Kunde' | 'Projekt' | 'Aufgabe' | 'Seite'; title: string; detail: string; path: string };
export function globalSearch(data: Workspace, query: string): SearchResult[] {
    const search = query.trim().toLocaleLowerCase(); if (search.length < 2) return [];
    const result: SearchResult[] = [];
    const add = (entry: SearchResult, extra = '') => { if (result.length < 30 && `${entry.title} ${entry.detail} ${extra}`.toLocaleLowerCase().includes(search)) result.push(entry); };
    for (const value of data.customers) add({ key: `customer-${value.id}`, kind: 'Kunde', title: value.name, detail: [value.industry, value.city].filter(Boolean).join(' · '), path: `/projectManager/customers?customer=${value.id}` }, value.email);
    for (const value of data.projects) add({ key: `project-${value.id}`, kind: 'Projekt', title: value.name, detail: data.customers.find(customer => customer.id === value.customerId)?.name ?? '', path: `/projectManager/projects?project=${value.id}` });
    for (const value of data.tasks) add({ key: `task-${value.id}`, kind: 'Aufgabe', title: value.title, detail: `${value.code} · ${data.projects.find(project => project.id === value.projectId)?.name ?? ''}`, path: `/projectManager/projects?project=${value.projectId}&task=${value.id}` }, value.description);
    for (const value of data.wiki.articles) add({ key: `page-${value.id}`, kind: 'Seite', title: value.title, detail: data.wiki.categories.find(category => category.id === value.categoryId)?.name ?? '', path: `/wiki/articles?article=${value.id}` }, value.content);
    return result;
}
