import { createApiClient } from '../api/apiClient.js';
import { createApiBusinessRepository, createBusinessStore, createSessionBusinessRepository, decodeBusiness, emptyBusiness, lineTotals, documentTotals, timerInput } from './business.js';
import type { BusinessDocument } from './business';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const id = '00000000-0000-0000-0000-000000000001';
export const documentFixture = (): BusinessDocument => ({ id, kind: 'invoice', customerId: 1, projectId: null, title: 'Test invoice', date: '2026-10-25', dueDate: '2026-11-08', status: 'draft', number: '', issuer: '', recipient: '', currency: 'EUR', lines: [{ description: 'Test', quantity: '1.5', minutes: 0, unitPriceCents: 15000, taxBasisPoints: 1900 }], timeEntryIds: [], notes: '' });
export const businessTests = [
    { name: 'Business totals use integer rounding for fractional quantities, minutes and tax', run() {
        const value = documentFixture(); assert(documentTotals(value).total === 26775, 'Incorrect decimal calculation');
        assert(lineTotals({ ...value.lines[0], minutes: 2, unitPriceCents: 15, taxBasisPoints: 0 }).net === 1, 'Two minutes at 15 cents/hour must round half up');
        assert(lineTotals({ ...value.lines[0], quantity: '0.001', unitPriceCents: 500, taxBasisPoints: 5000 }).total === 2, 'Fractional quantity and tax rounding must be exact');
    } },
    { name: 'Business decoding rejects invalid drafts, duplicates and malformed server data without falling back', run() {
        const value = { ...emptyBusiness(), documents: [documentFixture()] }; const decoded = decodeBusiness(value); value.documents[0].title = 'Changed'; assert(decoded.documents[0].title === 'Test invoice', 'Decoded data must be cloned');
        for (const input of [{ ...emptyBusiness(), documents: [documentFixture(), documentFixture()] }, { ...emptyBusiness(), profile: { ...emptyBusiness().profile, taxBasisPoints: 10001 } }, { ...emptyBusiness(), documents: [{ ...documentFixture(), dueDate: '2026-02-30' }] }, { ...emptyBusiness(), documents: [{ ...documentFixture(), lines: [{ ...documentFixture().lines[0], quantity: '-1' }] }] }]) {
            let failed = false; try { decodeBusiness(input); } catch { failed = true; } assert(failed, 'Invalid business data was accepted');
        }
    } },
    { name: 'Business API captures account epoch and requires exact revision and CSRF for timer and document writes', async run() {
        let calls = 0; const client = createApiClient('/api/v1', async (path, options) => { calls++; assert(String(path).startsWith('/api/v1/me/business'), 'Incorrect private endpoint'); if (options?.method !== 'GET') assert(new Headers(options?.headers).get('If-Match') === '"business-initial"', 'Missing revision'); return new Response(JSON.stringify(emptyBusiness())); });
        client.setSession('test-token'); const repository = createApiBusinessRepository(client), signal = new AbortController().signal;
        await repository.load(signal); await repository.save(emptyBusiness(), signal); await repository.timer('start', 'business-initial', timerInput, signal);
        client.setSession('new-account-token'); let blocked = false; try { await repository.load(signal); } catch { blocked = true; } assert(blocked && calls === 3, 'Old account requests must be blocked');
    } },
    { name: 'Business stores retain confirmed state on failure and clear private data after disposal', async run() {
        const repository = createSessionBusinessRepository(); let fail = false;
        const store = createBusinessStore({ ...repository, async save(value, signal) { if (fail) throw new Error('Offline'); return repository.save(value, signal); } }); await store.load();
        assert(await store.save({ ...store.getSnapshot().data!, documents: [documentFixture()] }), 'Initial save failed'); fail = true;
        assert(!await store.save({ ...store.getSnapshot().data!, documents: [] }) && store.getSnapshot().data!.documents.length === 1, 'Failed write lost confirmed documents');
        store.dispose(); assert(store.getSnapshot().data === null, 'Disposed account data must be cleared');
        assert((await createSessionBusinessRepository().load(new AbortController().signal)).documents.length === 0, 'New accounts must start separately');
    } }
];
