import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/languageContext';
import { useTimeTracking } from '../../hooks/timeTrackingContext';
import { useWorkspaceField, useWorkspacePersistence } from '../../hooks/workspaceContext';
import { useNavigationGuard, useUnsavedChanges } from '../../hooks/navigationGuard';
import { decodeTimeTracking, validDate } from '../../services/time/timeTracking';
import type { TimeEntry } from '../../services/time/timeTracking';
import { Field, Input, Select, PrimaryButton, SecondaryButton, DangerButton, FormActions } from '../../components/ui/formStyles';
import { SaveToast } from '../../components/ui/SaveToast';
import Dialog from '../../components/ui/Dialog';
import TimeEntryEditor from './TimeEntryEditor';
import TimerBar from './TimerBar';
import { timerInput } from '../../services/business/business';
import MonthlyTimesheet from './MonthlyTimesheet';
import { useBusiness } from '../../hooks/businessContext';
import { Page, Summary, Calendar, Day, Booking, Report, ToastViewport } from './timeStyles';
import { addDays, clock, duration, groupEntries, timeCsv, todayDate, weekEntries, weekStart } from './timeLogic';

type Editor = { draft: TimeEntry; baseline: string; existing: boolean };
export default function TimeTrackerPage({ active = true, section = 'calendar' }: { active?: boolean; section?: string }) {
    const { t, locale, language } = useTranslation();
    const { store, data, status, error, conflict } = useTimeTracking();
    const business = useBusiness(active);
    const [customers] = useWorkspaceField('customers'), [projects] = useWorkspaceField('projects');
    const workspace = useWorkspacePersistence(); const guard = useNavigationGuard();
    const [week, setWeek] = useState(() => weekStart(todayDate()));
    const [customerFilter, setCustomerFilter] = useState(''), [projectFilter, setProjectFilter] = useState(''), [billableFilter, setBillableFilter] = useState('');
    const [editor, setEditor] = useState<Editor | null>(null), [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ kind: 'success' | 'error'; id: number; message?: string } | null>(null);
    const dismiss = useCallback(() => setNotice(null), []);
    const discard = () => { setEditor(null); setDeleteTarget(null); setFormError(null); };
    useUnsavedChanges(!!editor && JSON.stringify(editor.draft) !== editor.baseline, discard, status === 'saving');
    useEffect(() => { if (active && status === 'idle') void store.load(); }, [active, status, store]);
    const entries = data?.entries ?? [];
    const filtered = weekEntries(entries, week, customerFilter, projectFilter, billableFilter);
    const total = filtered.reduce((sum, entry) => sum + entry.minutes, 0), billable = filtered.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.minutes, 0);
    const busy = status !== 'ready', blocked = conflict || workspace.getSnapshot().status !== 'ready';
    const customerNames = new Map(entries.filter(entry => entry.customerId !== null).map(entry => [entry.customerId!, entry.customerName]));
    customers.forEach(customer => customerNames.set(customer.id, customer.name));
    const projectNames = new Map(entries.filter(entry => entry.projectId !== null && (!customerFilter || String(entry.customerId) === customerFilter)).map(entry => [entry.projectId!, entry.projectName]));
    projects.filter(project => !customerFilter || String(project.customerId) === customerFilter).forEach(project => projectNames.set(project.id, project.name));
    const customerLabel = (entry: { customerId: number | null; customerName: string }) => entry.customerId === null ? t('Interne Tätigkeit') : entry.customerName;
    const projectLabel = (entry: { projectId: number | null; projectName: string }) => entry.projectId === null ? t('Ohne Projekt') : entry.projectName;
    const dateLabel = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
    function open(entry?: TimeEntry, date = todayDate()) {
        if (busy) return;
        const dayEntries = entries.filter(value => value.date === date);
        let start = 540;
        // Find the first free hour, including reserved breaks, for the day's add action.
        for (const value of [...dayEntries].sort((a, b) => a.startMinute - b.startMinute)) {
            if (value.startMinute + value.minutes + value.breakMinutes <= start) continue;
            if (start + 60 <= value.startMinute) break;
            start = value.startMinute + value.minutes + value.breakMinutes;
        }
        const draft: TimeEntry = entry ? { ...entry } : { id: crypto.randomUUID(), date, startMinute: Math.min(start, 1380), minutes: 60, breakMinutes: 0,
            customerId: null, projectId: null, customerName: '', projectName: '', comment: '', billable: false };
        setEditor({ draft, baseline: JSON.stringify(draft), existing: !!entry }); setFormError(null);
    }
    async function commit(values: TimeEntry[]) {
        setFormError(null);
        const success = await store.save(values);
        if (success) { if (editor?.draft.id === business.data?.timer?.id) await business.store.timer('complete', timerInput); discard(); setNotice({ kind: 'success', id: Date.now() }); }
        else { const message = store.getSnapshot().error ?? 'Zeiteinträge konnten nicht gespeichert werden.'; setFormError(message); setNotice({ kind: 'error', message, id: Date.now() }); }
    }
    function save() {
        if (!editor || busy || blocked || !data) return;
        const values = editor.existing ? entries.map(entry => entry.id === editor.draft.id ? editor.draft : entry) : [...entries, editor.draft];
        try { decodeTimeTracking({ ...data, entries: values }); } catch (failure) { setFormError(failure instanceof Error ? failure.message : 'Bitte gültige Zeiteinträge angeben.'); return; }
        void commit(values);
    }
    function exportCsv() {
        const csv = timeCsv(filtered, ['Datum', 'Kunde', 'Projekt', 'Beginn', 'Ende', 'Arbeitszeit (Minuten)', 'Pause (Minuten)', 'Abrechenbar', 'Kommentar'].map(value => t(value)), t('Interne Tätigkeit'), t('Ja'), t('Nein'));
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const link = document.createElement('a'); link.href = url; link.download = `forgeflow-time-${week}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    const move = (amount: number) => { const next = addDays(week, amount); if (validDate(next) && validDate(addDays(next, 7))) guard.request(() => setWeek(next)); };
    return <Page lang={language}>
        <div className="toolbar"><div><h1>TimeTracker</h1><p className="muted">{t('Deine Woche. Deine Zeit. Im Überblick.')}</p></div>
            <div className="actions"><SecondaryButton onClick={exportCsv} disabled={!filtered.length || busy}>{t('CSV exportieren')}</SecondaryButton><PrimaryButton disabled={busy || entries.length >= 10000} onClick={() => open(undefined, todayDate() >= week && todayDate() < addDays(week, 7) ? todayDate() : week)}>{t('+ Zeit erfassen')}</PrimaryButton></div></div>
        <div className="toolbar"><div className="actions">
            <SecondaryButton aria-label={t('Vorherige Woche')} onClick={() => move(-7)}>‹</SecondaryButton>
            <SecondaryButton onClick={() => guard.request(() => setWeek(weekStart(todayDate())))}>{t('Heute')}</SecondaryButton>
            <SecondaryButton aria-label={t('Nächste Woche')} onClick={() => move(7)}>›</SecondaryButton>
            <span className="week">{dateLabel(week, { day: '2-digit', month: 'short' })} – {dateLabel(addDays(week, 6), { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div><Field>{t('Woche auswählen')}<Input type="date" min="0001-01-08" max="9999-12-20" value={week} onChange={event => { const date = event.target.value; if (validDate(date) && date >= '0001-01-08' && date <= '9999-12-20') guard.request(() => setWeek(weekStart(date))); }} /></Field></div>
        <TimerBar active={active} entries={entries} onFinish={draft => { setEditor({ draft, baseline: '', existing: entries.some(value => value.id === draft.id) }); setFormError(null); }} />
        {store.persistence === 'session' && <p className="muted">{t('Lokaler Modus: Zeiten bleiben nur in dieser Sitzung erhalten.')}</p>}
        {error && <div role="alert"><p className="error">{t(error)}</p><SecondaryButton disabled={status === 'saving' || status === 'loading'} onClick={() => guard.request(() => { discard(); void store.load(); })}>{t('Serverstand laden')}</SecondaryButton></div>}
        {(status === 'idle' || status === 'loading') && <p role="status">{t('Zeiteinträge werden geladen …')}</p>}
        <div className="filters">
            <Field>{t('Kunde')}<Select value={customerFilter} onChange={event => { setCustomerFilter(event.target.value); setProjectFilter(''); }}><option value="">{t('Alle Kunden')}</option><option value="internal">{t('Interne Tätigkeit')}</option>{[...customerNames].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></Field>
            <Field>{t('Projekt')}<Select value={projectFilter} onChange={event => setProjectFilter(event.target.value)}><option value="">{t('Alle Projekte')}</option>{[...projectNames].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select></Field>
            <Field>{t('Abrechnung')}<Select value={billableFilter} onChange={event => setBillableFilter(event.target.value)}><option value="">{t('Alle Zeiten')}</option><option value="true">{t('Abrechenbar')}</option><option value="false">{t('Nicht abrechenbar')}</option></Select></Field>
        </div>
        {section === 'reports' && <MonthlyTimesheet />}
        <Summary aria-label={t('Wochensumme')}><div><span>{t('Arbeitszeit')}</span><strong>{duration(total)}</strong></div><div><span>{t('Abrechenbar')}</span><strong>{duration(billable)}</strong></div><div><span>{t('Einträge')}</span><strong>{filtered.length}</strong></div></Summary>
        {section === 'reports' ? <Report><table aria-label={t('Wochenauswertung')}><thead><tr>{['Kunde', 'Projekt', 'Arbeitszeit', 'Abrechenbar'].map(label => <th scope="col" key={label}>{t(label)}</th>)}</tr></thead>
            <tbody>{groupEntries(filtered).map(group => <tr key={JSON.stringify([group.customerId, group.projectId, group.customerName, group.projectName])}><td>{customerLabel(group)}</td><td>{projectLabel(group)}</td><td>{duration(group.minutes)}</td><td>{duration(group.billable)}</td></tr>)}{!filtered.length && <tr><td colSpan={4}>{t('Keine Zeiten für diese Auswahl.')}</td></tr>}</tbody></table></Report>
            : <Calendar aria-label={t('Wochenkalender')}>{Array.from({ length: 7 }, (_, index) => {
                const date = addDays(week, index), bookings = filtered.filter(entry => entry.date === date);
                return <Day key={date} $today={date === todayDate()} aria-label={date}><header><div><h2><time dateTime={date}>{dateLabel(date, { weekday: 'short', day: '2-digit', month: 'short' })}</time></h2><span className="day-total">{duration(bookings.reduce((sum, entry) => sum + entry.minutes, 0))}</span></div>
                    <button className="add" disabled={busy || entries.length >= 10000} aria-label={`${t('Zeit erfassen')}: ${date}`} onClick={() => open(undefined, date)}>+</button></header>
                    {bookings.map(entry => <Booking key={entry.id} $billable={entry.billable} onClick={() => open(entry)} disabled={busy}>
                        <span className="range">{clock(entry.startMinute)}–{clock(entry.startMinute + entry.minutes + entry.breakMinutes)}</span><strong>{customerLabel(entry)}</strong><span className="project">{projectLabel(entry)}</span>
                        <span className="duration">{duration(entry.minutes)}</span><span className="billable">{t(entry.billable ? 'Abrechenbar' : 'Nicht abrechenbar')}</span>{entry.comment && <span className="note">{entry.comment}</span>}
                    </Booking>)}{!bookings.length && <p className="empty">{t('Keine Einträge')}</p>}</Day>;
            })}</Calendar>}
        {editor && <TimeEntryEditor entry={editor.draft} existing={editor.existing} customers={customers} projects={projects} busy={status === 'saving'} blocked={busy || blocked} error={formError}
            onChange={draft => setEditor({ ...editor, draft })} onSave={save} onClose={() => { if (status !== 'saving') guard.request(discard); }} onDelete={() => setDeleteTarget(editor.draft.id)} />}
        {deleteTarget && <Dialog title={t('Zeiteintrag löschen?')} width={440} onClose={() => { if (status !== 'saving') setDeleteTarget(null); }}>
            <p>{t('Dieser Zeiteintrag wird dauerhaft entfernt.')}</p>{formError && <p role="alert">{t(formError)}</p>}<FormActions>
                <SecondaryButton disabled={status === 'saving'} onClick={() => setDeleteTarget(null)}>{t('Abbrechen')}</SecondaryButton><DangerButton disabled={busy || conflict} onClick={() => void commit(entries.filter(entry => entry.id !== deleteTarget))}>{t('Endgültig löschen')}</DangerButton>
            </FormActions></Dialog>}
        {notice && <ToastViewport role={notice.kind === 'error' ? 'alert' : 'status'}><SaveToast key={notice.id} kind={notice.kind} title={t(notice.kind === 'success' ? 'Änderungen gespeichert.' : 'Speichern fehlgeschlagen')} onDismiss={dismiss}>{notice.message && <p>{t(notice.message)}</p>}</SaveToast></ToastViewport>}
    </Page>;
}
