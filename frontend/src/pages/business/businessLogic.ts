import type { BusinessData, BusinessDocument, BusinessProfile, ProjectTemplate, RunningTimer } from '../../services/business/business';
import type { TimeEntry } from '../../services/time/timeTracking';
import type { Workspace } from '../../services/workspace/workspaceTypes';
import { addDays, todayDate } from '../timeTracker/timeLogic.js';
export function documentStatusLabel(status: string): string {
    return ({ draft: 'Entwurf', issued: 'Freigegeben', accepted: 'Angenommen', rejected: 'Abgelehnt', paid: 'Bezahlt', cancelled: 'Storniert' } as Record<string, string>)[status] ?? status;
}
export function newDocument(kind: 'offer' | 'invoice', profile: BusinessProfile, customerId: number, now = todayDate()): BusinessDocument {
    return { id: crypto.randomUUID(), kind, customerId, projectId: null, title: kind === 'offer' ? 'Angebot' : 'Rechnung', date: now, dueDate: addDays(now, profile.paymentDays), status: 'draft', number: '',
        issuer: [profile.company, profile.address, profile.email, profile.taxId, profile.bank].filter(Boolean).join('\n'), recipient: '', currency: profile.currency, lines: [], timeEntryIds: [], notes: '' };
}
export function invoiceable(entries: TimeEntry[], business: BusinessData, customer: number, project: number | null, month: string, currentId: string) {
    const billed = new Set(business.documents.filter(value => value.id !== currentId && value.kind === 'invoice' && ['issued', 'paid'].includes(value.status)).flatMap(value => value.timeEntryIds));
    return entries.filter(value => value.customerId === customer && (project === null || value.projectId === project) && value.date.startsWith(month + '-') && value.billable && !billed.has(value.id));
}
export function timerSeconds(timer: RunningTimer, now = Date.now()) { return timer.elapsedSeconds + (timer.startedAt === null ? 0 : Math.max(0, Math.floor((now - Date.parse(timer.startedAt)) / 1000))); }
export function timerDraft(timer: RunningTimer, customers: Workspace['customers'], projects: Workspace['projects'], now = Date.now()): TimeEntry {
    const origin = new Date(timer.originAt), parts = new Intl.DateTimeFormat('en-CA', { timeZone: timer.zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(origin);
    const part = (key: string) => parts.find(value => value.type === key)!.value;
    const minutes = Math.max(1, Math.ceil(timerSeconds(timer, now) / 60));
    return { id: timer.id, date: `${part('year')}-${part('month')}-${part('day')}`, startMinute: Number(part('hour')) * 60 + Number(part('minute')), minutes,
        breakMinutes: Math.max(0, Math.floor((now - origin.getTime()) / 60000) - minutes), customerId: timer.customerId, projectId: timer.projectId,
        customerName: customers.find(value => value.id === timer.customerId)?.name ?? '', projectName: projects.find(value => value.id === timer.projectId)?.name ?? '', comment: timer.comment, billable: timer.billable };
}
export function applyLocalTemplate(data: Workspace, template: ProjectTemplate, name: string, customerId: number, deadline: string, now = new Date().toISOString()) {
    const projectId = Math.max(0, ...data.projects.map(value => value.id)) + 1;
    let taskId = Math.max(0, ...data.tasks.map(value => value.id)) + 1, epicId = Math.max(0, ...data.epics.map(value => value.id)) + 1, pageId = Math.max(0, ...data.wiki.articles.map(value => value.id)) + 1;
    const categoryId = Math.max(0, ...data.wiki.categories.map(value => value.id)) + 1;
    const codes = new Set(data.tasks.map(value => value.code));
    const tasks = template.tasks.map(value => { const id = taskId++; let code = `FF-${id}`; while (codes.has(code)) code += 'N'; codes.add(code); return { id, projectId, code, title: value.title, description: value.description, priority: value.priority, status: 'todo' as const, createdAt: now, updatedAt: now }; });
    return { projectId, data: { ...data, projects: [...data.projects, { id: projectId, customerId, name, deadline, planningCompleted: false }], tasks: [...data.tasks, ...tasks],
        epics: [...data.epics, ...template.milestones.map(title => ({ id: epicId++, projectId, title, description: '', createdAt: now, updatedAt: now }))],
        wiki: { categories: template.pages.length ? [...data.wiki.categories, { id: categoryId, name, description: 'Project documentation', createdAt: now, updatedAt: now }] : data.wiki.categories,
            articles: [...data.wiki.articles, ...template.pages.map(value => ({ id: pageId++, title: value.title, content: value.content, categoryId, parentId: null, createdAt: now, updatedAt: now }))] } } };
}
