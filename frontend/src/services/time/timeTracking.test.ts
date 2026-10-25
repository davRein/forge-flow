import { ApiError, createApiClient } from '../api/apiClient.js';
import { createApiTimeTrackingRepository, createSessionTimeTrackingRepository, createTimeTrackingStore, decodeTimeTracking } from './timeTracking.js';
import type { TimeEntry, TimeTracking } from './timeTracking.js';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export const entry = (patch: Partial<TimeEntry> = {}): TimeEntry => ({ id: '00000000-0000-0000-0000-000000000001', date: '2026-10-26', startMinute: 540, minutes: 90, breakMinutes: 15, customerId: null, projectId: null, customerName: '', projectName: '', comment: 'Private notes 😀\nSecond line', billable: false, ...patch });
const document = (entries = [entry()]): TimeTracking => ({ version: 1, revision: 'time-initial', entries });
function rejects(run: () => unknown) { let rejected = false; try { run(); } catch { rejected = true; } assert(rejected, 'Invalid booking was accepted'); }
export const timeTrackingTests = [
    { name: 'Time entries preserve Unicode, clone data and reject bad dates, duration, references and overlaps including breaks', run() {
        const value = document(); const decoded = decodeTimeTracking(value); value.entries[0].comment = 'changed'; assert(decoded.entries[0].comment.includes('😀'), 'Decoded documents must be independent');
        for (const patch of [{ date: '2026-02-30' }, { date: '0000-01-01' }, { date: '2026-2-01' }, { minutes: 0 }, { minutes: 1.5 }, { startMinute: -1 }, { breakMinutes: -1 }, { startMinute: 1430, minutes: 20 }, { projectId: 1 }, { comment: 'x'.repeat(2001) }]) rejects(() => decodeTimeTracking(document([entry(patch)])));
        rejects(() => decodeTimeTracking(document([entry(), entry()])));
        rejects(() => decodeTimeTracking(document([entry(), entry({ id: '00000000-0000-0000-0000-000000000002', startMinute: 640 })])));
        assert(decodeTimeTracking(document([entry(), entry({ id: '00000000-0000-0000-0000-000000000002', startMinute: 645 })])).entries.length === 2, 'Adjacent intervals must be accepted');
        assert(decodeTimeTracking(document([entry({ date: '2028-02-29', startMinute: 0, minutes: 1440, breakMinutes: 0 })])).entries.length === 1, 'Leap days and a full day must be valid');
    } },
    { name: 'Time repository uses same-session API, If-Match and detects stale authentication', async run() {
        let calls = 0;
        const client = createApiClient('/api/v1', async (url, options) => { calls++; assert(url === '/api/v1/me/time-tracking', 'Wrong endpoint');
            if (options?.method === 'PUT') { assert(new Headers(options.headers).get('If-Match') === '"time-initial"' && new Headers(options.headers).get('X-CSRF-Token') === 'test-token', 'Writes need revision and CSRF'); }
            return new Response(JSON.stringify(document())); });
        client.setSession('test-token'); const repository = createApiTimeTrackingRepository(client); const signal = new AbortController().signal;
        await repository.load(signal); await repository.save(document(), signal); client.setSession('other-token');
        let stale = false; try { await repository.load(signal); } catch { stale = true; } assert(stale && calls === 2, 'Old account requests must never execute');
    } },
    { name: 'Failed time writes keep the saved document; conflicts require reload and disposed stores ignore late responses', async run() {
        const session = createSessionTimeTrackingRepository(); let fail = false;
        const store = createTimeTrackingStore({ persistence: 'account', load: session.load, async save(value, signal) { if (fail) throw new ApiError(409, 'VERSION_CONFLICT', 'conflict'); return session.save(value, signal); } });
        await store.load(); assert(await store.save([entry()]), 'Initial save failed'); fail = true;
        assert(!await store.save([entry({ comment: 'unsaved' })]) && store.getSnapshot().data!.entries[0].comment.includes('😀') && store.getSnapshot().conflict, 'Conflict must retain confirmed entries');
        fail = false; assert(!await store.save([]), 'Conflicts must block blind retries'); await store.load(); assert(await store.save([]), 'Reload must unlock writes');
        let finish!: (value: TimeTracking) => void;
        const late = createTimeTrackingStore({ persistence: 'account', load() { return new Promise(resolve => { finish = resolve; }); }, save: session.save });
        const loading = late.load(); late.dispose(); finish(document()); await loading; assert(late.getSnapshot().data === null, 'Late responses must not leak to another account'); store.dispose();
    } },
    { name: 'Session time repositories are independent and reject stale revisions without losing bookings', async run() {
        const first = createSessionTimeTrackingRepository(), second = createSessionTimeTrackingRepository(), signal = new AbortController().signal;
        const saved = await first.save(document(), signal); const reloaded = await first.load(signal);
        assert(reloaded.entries[0].comment === entry().comment && (await second.load(signal)).entries.length === 0, 'Sessions must be isolated');
        let rejected = false; try { await first.save(document([]), signal); } catch { rejected = true; }
        assert(rejected && (await first.load(signal)).revision === saved.revision, 'Stale saves must not change data');
    } }
];
