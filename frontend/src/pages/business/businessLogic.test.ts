import { applyLocalTemplate, invoiceable, timerDraft, timerSeconds } from './businessLogic.js';
import { emptyBusiness } from '../../services/business/business.js';
import type { BusinessDocument, ProjectTemplate, RunningTimer } from '../../services/business/business';
import type { TimeEntry } from '../../services/time/timeTracking';
import type { Workspace } from '../../services/workspace/workspaceTypes';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const businessLogicTests = [
    { name: 'Invoiceable selection excludes foreign, nonbillable, other-month and already invoiced times', run() {
        const entry: TimeEntry = { id: 'one', date: '2026-10-25', startMinute: 540, minutes: 60, breakMinutes: 0, customerId: 1, projectId: 1, customerName: 'A', projectName: 'B', comment: '', billable: true };
        const business = emptyBusiness(); business.documents = [{ id: 'issued', kind: 'invoice', status: 'paid', timeEntryIds: ['paid'] } as BusinessDocument];
        const selected = invoiceable([entry, { ...entry, id: 'paid' }, { ...entry, id: 'foreign', customerId: 2 }, { ...entry, id: 'free', billable: false }, { ...entry, id: 'old', date: '2026-09-25' }], business, 1, 1, '2026-10', 'current');
        assert(selected.length === 1 && selected[0].id === 'one', 'Incorrect invoiceable selection');
    } },
    { name: 'Timer review retains stable booking identity, local start and separate pause minutes', run() {
        const timer: RunningTimer = { id: 'stable-id', startedAt: null, elapsedSeconds: 120, originAt: '2026-10-25T10:00:00Z', zone: 'Europe/Berlin', customerId: null, projectId: null, comment: 'Reviewed work', billable: true };
        const draft = timerDraft(timer, [], [], Date.parse('2026-10-25T10:03:00Z'));
        assert(draft.id === timer.id && draft.startMinute === 660 && draft.minutes === 2 && draft.breakMinutes === 1 && draft.comment === timer.comment, 'Timer review must be stable and timezone aware');
        assert(timerSeconds({ ...timer, startedAt: '2026-10-25T10:03:00Z' }, Date.parse('2026-10-25T10:03:30Z')) === 150, 'Resume must add only elapsed running seconds');
    } },
    { name: 'Local project templates add fresh tasks, milestones and documentation without mutating originals', run() {
        const data: Workspace = { projects: [], customers: [], tasks: [], activities: [], epics: [], sprints: [], files: [], wiki: { articles: [], categories: [] } };
        const template: ProjectTemplate = { id: 'template', name: 'Template', description: '', tasks: [{ title: 'Plan', description: 'Task text', priority: 'high' }], milestones: ['Launch'], pages: [{ title: 'Guide', content: '# Read me' }] };
        const result = applyLocalTemplate(data, template, 'New project', 1, '2026-12-31');
        assert(data.projects.length === 0 && result.data.projects.length === 1 && result.data.tasks[0].projectId === result.projectId && result.data.epics.length === 1 && result.data.wiki.articles[0].categoryId === result.data.wiki.categories[0].id, 'Template relationships must be complete and immutable');
    } }
];
