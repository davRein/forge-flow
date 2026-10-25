import type { ApiClient } from '../api/apiClient.js';
import { ApiError } from '../api/apiClient.js';
import { validDate } from '../time/timeTracking.js';

export type BusinessProfile = { company: string; address: string; email: string; taxId: string; bank: string; currency: string; taxBasisPoints: number; hourlyRateCents: number; paymentDays: number };
export type ProjectBudget = { projectId: number; minutes: number; hourlyRateCents: number };
export type ProjectTemplate = { id: string; name: string; description: string; tasks: { title: string; description: string; priority: 'low' | 'medium' | 'high' }[]; milestones: string[]; pages: { title: string; content: string }[] };
export type BusinessLine = { description: string; quantity: string; unitPriceCents: number; taxBasisPoints: number; minutes: number };
export type BusinessDocument = { id: string; kind: 'offer' | 'invoice'; customerId: number; projectId: number | null; title: string; date: string; dueDate: string;
    status: 'draft' | 'issued' | 'accepted' | 'rejected' | 'paid' | 'cancelled'; number: string; issuer: string; recipient: string; currency: string; lines: BusinessLine[]; timeEntryIds: string[]; notes: string };
export type RunningTimer = { id: string; startedAt: string | null; elapsedSeconds: number; originAt: string; zone: string; customerId: number | null; projectId: number | null; comment: string; billable: boolean };
export type BusinessData = { version: 1; revision: string; profile: BusinessProfile; budgets: ProjectBudget[]; templates: ProjectTemplate[]; documents: BusinessDocument[]; timer: RunningTimer | null };
export type PortalLink = { userId: string; ownerId: string; revision: string; customerId: number; active: boolean; projectIds: number[]; articleIds: number[]; fileIds: number[]; documentIds: string[]; reportMonths: string[] };
export type PortalAccount = { link: PortalLink; user: { id: string; name: string; email: string; active: boolean; portalOnly: boolean } };
export const emptyBusiness = (): BusinessData => ({ version: 1, revision: 'business-initial', profile: { company: '', address: '', email: '', taxId: '', bank: '', currency: 'EUR', taxBasisPoints: 0, hourlyRateCents: 0, paymentDays: 14 }, budgets: [], templates: [], documents: [], timer: null });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number, required = false): value is string => typeof value === 'string' && value.length <= max && (!required || !!value.trim());
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const optionalId = (value: unknown) => value === null || integer(value, 1);
const currency = (value: unknown) => ['EUR', 'USD', 'CHF', 'GBP'].includes(String(value));
const invalid = () => new Error('Bitte gültige Business-Daten angeben.');
export function lineTotals(line: BusinessLine) {
    if (!/^(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,3})?$/.test(line.quantity)) throw invalid();
    const [whole, decimal = ''] = line.quantity.split('.'); const quantity = BigInt(whole) * 1000n + BigInt(decimal.padEnd(3, '0'));
    if (!line.minutes && quantity === 0n) throw invalid();
    const price = BigInt(line.unitPriceCents); const net = line.minutes ? (BigInt(line.minutes) * price + 30n) / 60n : (quantity * price + 500n) / 1000n;
    const tax = (net * BigInt(line.taxBasisPoints) + 5000n) / 10000n; return { net: Number(net), tax: Number(tax), total: Number(net + tax) };
}
export function documentTotals(document: BusinessDocument) {
    const total = document.lines.reduce((sum, line) => { const value = lineTotals(line); return { net: sum.net + value.net, tax: sum.tax + value.tax, total: sum.total + value.total }; }, { net: 0, tax: 0, total: 0 });
    if (!Number.isSafeInteger(total.total) || total.total > 9000000000000) throw invalid(); return total;
}
export function decodeBusiness(value: unknown): BusinessData {
    if (!object(value) || value.version !== 1 || !text(value.revision, 128, true) || !object(value.profile) || !Array.isArray(value.budgets) || value.budgets.length > 10000
        || !Array.isArray(value.templates) || value.templates.length > 500 || !Array.isArray(value.documents) || value.documents.length > 1000) throw invalid();
    const profile = value.profile;
    if (!text(profile.company, 1000) || !text(profile.address, 3000) || !text(profile.email, 254) || !text(profile.taxId, 200) || !text(profile.bank, 1000) || !currency(profile.currency)
        || !integer(profile.taxBasisPoints, 0, 10000) || !integer(profile.hourlyRateCents, 0, 100000000) || !integer(profile.paymentDays, 0, 365)) throw invalid();
    const budgetIds = new Set<number>(), templateIds = new Set<string>(), documentIds = new Set<string>();
    for (const budget of value.budgets) {
        if (!object(budget) || !integer(budget.projectId, 1) || budgetIds.has(budget.projectId) || !integer(budget.minutes, 1, 10000000) || !integer(budget.hourlyRateCents, 0, 100000000)) throw invalid(); budgetIds.add(budget.projectId);
    }
    for (const template of value.templates) {
        if (!object(template) || !uuid(template.id) || templateIds.has(template.id) || !text(template.name, 200, true) || !text(template.description, 2000)
            || !Array.isArray(template.tasks) || template.tasks.length > 100 || !Array.isArray(template.milestones) || template.milestones.length > 30 || !Array.isArray(template.pages) || template.pages.length > 30) throw invalid();
        templateIds.add(template.id);
        for (const task of template.tasks) if (!object(task) || !text(task.title, 1000, true) || !text(task.description, 10000) || !['low', 'medium', 'high'].includes(String(task.priority))) throw invalid();
        for (const title of template.milestones) if (!text(title, 1000, true)) throw invalid();
        for (const page of template.pages) if (!object(page) || !text(page.title, 1000, true) || !text(page.content, 100000)) throw invalid();
    }
    for (const document of value.documents) {
        if (!object(document) || !uuid(document.id) || documentIds.has(document.id) || !['offer', 'invoice'].includes(String(document.kind)) || !integer(document.customerId, 1) || !optionalId(document.projectId)
            || !text(document.title, 300, true) || typeof document.date !== 'string' || !validDate(document.date) || typeof document.dueDate !== 'string' || !validDate(document.dueDate) || document.dueDate < document.date
            || !['draft', 'issued', 'accepted', 'rejected', 'paid', 'cancelled'].includes(String(document.status)) || !text(document.number, 100) || !text(document.issuer, 6000) || !text(document.recipient, 6000) || !currency(document.currency)
            || !Array.isArray(document.lines) || document.lines.length > 100 || !Array.isArray(document.timeEntryIds) || document.timeEntryIds.length > 10000 || document.timeEntryIds.some(id => !uuid(id)) || !text(document.notes, 10000)) throw invalid();
        documentIds.add(document.id);
        for (const line of document.lines) if (!object(line) || !text(line.description, 1000, true) || !text(line.quantity, 12) || !integer(line.unitPriceCents, 0, 100000000) || !integer(line.taxBasisPoints, 0, 10000) || !integer(line.minutes, 0, 10000000)) throw invalid();
        documentTotals(document as BusinessDocument);
    }
    if (value.timer !== null) {
        const timer = value.timer;
        if (!object(timer) || !uuid(timer.id) || !(timer.startedAt === null || typeof timer.startedAt === 'string' && Number.isFinite(Date.parse(timer.startedAt)))
            || typeof timer.originAt !== 'string' || !Number.isFinite(Date.parse(timer.originAt)) || !integer(timer.elapsedSeconds, 0) || !text(timer.zone, 100, true)
            || !optionalId(timer.customerId) || !optionalId(timer.projectId) || !text(timer.comment, 2000) || typeof timer.billable !== 'boolean') throw invalid();
    }
    const result = structuredClone(value) as BusinessData;
    if (new TextEncoder().encode(JSON.stringify(result)).length > 5 * 1024 * 1024) throw invalid(); return result;
}
export type TimerInput = { zone: string; customerId: number | null; projectId: number | null; comment: string; billable: boolean };
export const timerInput: TimerInput = { zone: 'UTC', customerId: null, projectId: null, comment: '', billable: false };
export type BusinessRepository = { persistence: 'account' | 'session'; load(signal: AbortSignal): Promise<BusinessData>; save(value: BusinessData, signal: AbortSignal): Promise<BusinessData>;
    timer(action: string, revision: string, input: TimerInput, signal: AbortSignal): Promise<BusinessData> };
export function createApiBusinessRepository(client: ApiClient): BusinessRepository {
    const epoch = client.epoch;
    return { persistence: 'account', async load(signal) { return decodeBusiness(await client.request('/me/business', { signal, epoch })); },
        async save(value, signal) { return decodeBusiness(await client.request('/me/business', { method: 'PUT', headers: { 'If-Match': `"${value.revision}"` }, body: value, signal, epoch })); },
        async timer(action, revision, input, signal) { return decodeBusiness(await client.request(`/me/business/timer/${action}`, { method: 'POST', headers: { 'If-Match': `"${revision}"` }, body: input, signal, epoch })); } };
}
export function createSessionBusinessRepository(): BusinessRepository {
    let data = emptyBusiness(), version = 0;
    const update = (revision: string, next: BusinessData) => { if (revision !== data.revision) throw new Error('Die Business-Daten wurden inzwischen geändert. Bitte neu laden.'); data = decodeBusiness({ ...next, revision: `business-session-${++version}` }); return decodeBusiness(data); };
    return { persistence: 'session', async load() { return decodeBusiness(data); }, async save(value) { return update(value.revision, { ...value, timer: data.timer }); },
        async timer(action, revision, input) {
            const now = new Date().toISOString(); let timer = data.timer;
            if (action === 'start') { if (timer) throw invalid(); timer = { ...input, id: crypto.randomUUID(), startedAt: now, elapsedSeconds: 0, originAt: now }; }
            else if (action === 'pause' && timer?.startedAt) timer = { ...timer, elapsedSeconds: timer.elapsedSeconds + Math.max(0, Math.floor((Date.now() - Date.parse(timer.startedAt)) / 1000)), startedAt: null };
            else if (action === 'resume' && timer) timer = { ...timer, startedAt: now };
            else if (['discard', 'complete'].includes(action)) timer = null;
            return update(revision, { ...data, timer });
        } };
}
type State = { data: BusinessData | null; status: 'idle' | 'loading' | 'ready' | 'saving' | 'error'; error: string | null; conflict: boolean };
export function createBusinessStore(repository: BusinessRepository) {
    let state: State = { data: null, status: 'idle', error: null, conflict: false }, disposed = false, generation = 0;
    let controller = new AbortController(); const listeners = new Set<() => void>();
    const publish = (value: State) => { if (!disposed) { state = value; listeners.forEach(listener => listener()); } };
    async function write(operation: (data: BusinessData, signal: AbortSignal) => Promise<BusinessData>) {
        if (disposed || state.status !== 'ready' || !state.data || state.conflict) return false;
        const previous = state.data, run = ++generation; controller.abort(); controller = new AbortController(); publish({ ...state, status: 'saving', error: null });
        try { const data = decodeBusiness(await operation(previous, controller.signal)); if (disposed || run !== generation) return false; publish({ data, status: 'ready', error: null, conflict: false }); return true; }
        catch (error) { if (!disposed && run === generation) publish({ data: previous, status: 'ready', error: error instanceof Error ? error.message : 'Speichern fehlgeschlagen', conflict: error instanceof ApiError && error.code === 'VERSION_CONFLICT' }); return false; }
    }
    return { persistence: repository.persistence, getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        async load() { if (disposed || state.status === 'saving' || state.status === 'loading') return; const run = ++generation; controller.abort(); controller = new AbortController(); publish({ ...state, status: 'loading', error: null });
            try { const data = decodeBusiness(await repository.load(controller.signal)); if (!disposed && run === generation) publish({ data, status: 'ready', error: null, conflict: false }); }
            catch (error) { if (!disposed && run === generation) publish({ ...state, status: 'error', error: error instanceof Error ? error.message : 'Laden fehlgeschlagen' }); } },
        save(value: BusinessData) { return write(() => repository.save(decodeBusiness(value), controller.signal)); },
        timer(action: string, input: TimerInput) { return write((data, signal) => repository.timer(action, data.revision, input, signal)); },
        accept(value: BusinessData) { if (state.status === 'ready') publish({ data: decodeBusiness(value), status: 'ready', error: null, conflict: false }); },
        connect() { disposed = false; }, dispose() { disposed = true; generation++; controller.abort(); listeners.clear(); state = { data: null, status: 'idle', error: null, conflict: false }; }
    };
}
export type BusinessStore = ReturnType<typeof createBusinessStore>;
