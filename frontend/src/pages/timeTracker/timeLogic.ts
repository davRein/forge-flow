import type { TimeEntry } from '../../services/time/timeTracking';

export function todayDate(now = new Date()): string { return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
export function addDays(date: string, amount: number): string {
    const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + amount); return value.toISOString().slice(0, 10);
}
export function weekStart(date: string): string { return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)); }
export function clock(minutes: number): string { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
export function duration(minutes: number): string { return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`; }
export function weekEntries(entries: TimeEntry[], week: string, customer = '', project = '', billable = ''): TimeEntry[] {
    const end = addDays(week, 7);
    return entries.filter(entry => entry.date >= week && entry.date < end && (!customer || (customer === 'internal' ? entry.customerId === null : String(entry.customerId) === customer))
        && (!project || String(entry.projectId) === project) && (!billable || String(entry.billable) === billable))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute);
}
export function groupEntries(entries: TimeEntry[]) {
    const groups = new Map<string, { customerId: number | null; projectId: number | null; customerName: string; projectName: string; minutes: number; billable: number }>();
    for (const entry of entries) {
        const key = JSON.stringify([entry.customerId, entry.projectId, entry.customerName, entry.projectName]);
        const group = groups.get(key) ?? { customerId: entry.customerId, projectId: entry.projectId, customerName: entry.customerName, projectName: entry.projectName, minutes: 0, billable: 0 };
        group.minutes += entry.minutes; if (entry.billable) group.billable += entry.minutes; groups.set(key, group);
    }
    return [...groups.values()];
}
// Quote every cell and neutralize spreadsheet formula prefixes in untrusted text.
function csvCell(value: string | number) {
    let text = String(value);
    if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
}
export function timeCsv(entries: TimeEntry[], headers: string[], internal: string, yes: string, no: string): string {
    return '\uFEFF' + [headers, ...entries.map(entry => [entry.date, entry.customerName || internal, entry.projectName, clock(entry.startMinute), clock(entry.startMinute + entry.minutes + entry.breakMinutes), entry.minutes, entry.breakMinutes, entry.billable ? yes : no, entry.comment])]
        .map(row => row.map(csvCell).join(';')).join('\r\n');
}
