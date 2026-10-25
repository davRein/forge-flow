import { addDays, weekStart, weekEntries, groupEntries, timeCsv, duration } from './timeLogic.js';
import type { TimeEntry } from '../../services/time/timeTracking';
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const first: TimeEntry = { id: 'one', date: '2026-10-26', startMinute: 540, minutes: 90, breakMinutes: 15, customerId: 1, projectId: 2, customerName: '=malicious()', projectName: 'Project; "quoted"', comment: '+formula\nUnicode 😀', billable: true };
export const timeLogicTests = [
    { name: 'Calendar weeks start on Monday across year and daylight-saving boundaries', run() {
        assert(weekStart('2026-10-25') === '2026-10-19' && addDays('2026-10-25', 1) === '2026-10-26', 'DST Sunday must not shift dates');
        assert(weekStart('2027-01-01') === '2026-12-28' && addDays('2026-12-31', 1) === '2027-01-01', 'Year boundaries must retain whole weeks');
        assert(duration(90) === '1h 30m', 'Duration must use integer minutes');
    } },
    { name: 'Weekly filters and reports count net minutes and separate internal and billable work', run() {
        const entries = [first, { ...first, id: 'two', date: '2026-10-27', minutes: 30, billable: false }, { ...first, id: 'outside', date: '2026-11-02' }, { ...first, id: 'internal', customerId: null, projectId: null, minutes: 10 }];
        const filtered = weekEntries(entries, '2026-10-26', '1', '2');
        assert(filtered.length === 2 && groupEntries(filtered)[0].minutes === 120 && groupEntries(filtered)[0].billable === 90, 'Breaks must not count as working time');
        assert(weekEntries(entries, '2026-10-26', 'internal').length === 1 && weekEntries(entries, '2026-10-26', '', '', 'false').length === 1, 'Internal/billable filtering failed');
        assert(groupEntries([first, { ...first, id: 'renamed', customerName: 'Renamed customer' }]).length === 2, 'Different historical names must not be merged into one report row');
    } },
    { name: 'Time CSV preserves Unicode and quoting while neutralizing spreadsheet formulas', run() {
        const csv = timeCsv([first], ['Date', 'Customer', 'Project', 'Start', 'End', 'Minutes', 'Break', 'Billable', 'Comment'], 'Internal', 'Yes', 'No');
        assert(csv.startsWith('\uFEFF') && csv.includes('"\'=malicious()"') && csv.includes('"\'+formula\nUnicode 😀"') && csv.includes('"Project; ""quoted"""') && csv.includes('"10:45";"90";"15"'), 'CSV must retain data safely and include net work and separate breaks');
    } }
];
