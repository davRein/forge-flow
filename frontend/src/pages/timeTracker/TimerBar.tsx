import { useEffect, useState } from 'react';
import { useBusiness } from '../../hooks/businessContext';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { useTranslation } from '../../hooks/languageContext';
import { useUnsavedChanges } from '../../hooks/navigationGuard';
import type { TimeEntry } from '../../services/time/timeTracking';
import { timerInput } from '../../services/business/business';
import { timerDraft, timerSeconds } from '../business/businessLogic';
import { Panel } from '../business/businessStyles';
import { Field, Input, Select, PrimaryButton, SecondaryButton, CheckboxRow } from '../../components/ui/formStyles';
import Dialog from '../../components/ui/Dialog';
export default function TimerBar({ active, entries, onFinish }: { active: boolean; entries: TimeEntry[]; onFinish: (entry: TimeEntry) => void }) {
    const { data, store, status, error, conflict } = useBusiness(active); const workspace = useWorkspacePersistence().getSnapshot().data!; const { t } = useTranslation();
    const [customer, setCustomer] = useState(''), [project, setProject] = useState(''), [comment, setComment] = useState(''), [billable, setBillable] = useState(false), [now, setNow] = useState(Date.now()), [discard, setDiscard] = useState(false);
    const reset = () => { setCustomer(''); setProject(''); setComment(''); setBillable(false); };
    useUnsavedChanges(!data?.timer && !!(customer || project || comment || billable), reset, status === 'saving');
    useEffect(() => { if (!active || !data?.timer?.startedAt) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [active, data?.timer?.startedAt]);
    if (!data) return null;
    const timer = data.timer, seconds = timer ? timerSeconds(timer, now) : 0, saved = timer && entries.some(entry => entry.id === timer.id);
    const busy = status !== 'ready' || conflict;
    return <Panel aria-label={t('Stoppuhr')}><div className="toolbar" style={{ marginBottom: 10 }}><h2>{t('Stoppuhr')}</h2>{timer && <strong style={{ fontVariantNumeric: 'tabular-nums', fontSize: 22 }}>{String(Math.floor(seconds / 3600)).padStart(2, '0')}:{String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</strong>}</div>
        {timer ? <div className="actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {saved ? <PrimaryButton disabled={busy} onClick={() => void store.timer('complete', timerInput)}>{t('Stoppuhr abschließen')}</PrimaryButton> : <><SecondaryButton disabled={busy} onClick={() => void store.timer(timer.startedAt ? 'pause' : 'resume', timerInput)}>{t(timer.startedAt ? 'Pausieren' : 'Fortsetzen')}</SecondaryButton><PrimaryButton disabled={busy} onClick={async () => { if (timer.startedAt && !await store.timer('pause', timerInput)) return; const current = store.getSnapshot().data?.timer; if (current) onFinish(timerDraft(current, workspace.customers, workspace.projects)); }}>{t('Stoppen und prüfen')}</PrimaryButton></>}
            <SecondaryButton disabled={busy} onClick={() => setDiscard(true)}>{t('Messung verwerfen')}</SecondaryButton><span>{workspace.customers.find(value => value.id === timer.customerId)?.name ?? t('Interne Tätigkeit')} · {timer.comment}</span>
        </div> : <form onSubmit={event => { event.preventDefault(); void store.timer('start', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone, customerId: customer ? Number(customer) : null, projectId: project ? Number(project) : null, comment, billable }).then(success => { if (success) reset(); }); }}><fieldset disabled={busy} style={{ border: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end' }}>
            <Field>{t('Kunde')}<Select value={customer} onChange={event => { setCustomer(event.target.value); setProject(''); }}><option value="">{t('Interne Tätigkeit')}</option>{workspace.customers.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field>
            <Field>{t('Projekt')}<Select value={project} disabled={!customer} onChange={event => setProject(event.target.value)}><option value="">{t('Ohne Projekt')}</option>{workspace.projects.filter(value => value.customerId === Number(customer)).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field>
            <Field style={{ flex: 1, minWidth: 150 }}>{t('Kommentar')}<Input maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} /></Field><CheckboxRow><input type="checkbox" checked={billable} onChange={event => setBillable(event.target.checked)} />{t('Abrechenbar')}</CheckboxRow><PrimaryButton>{t('Starten')}</PrimaryButton>
        </fieldset></form>}
        {error && <p role="alert">{t(error)} <SecondaryButton onClick={() => void store.load()} disabled={status === 'saving'}>{t('Serverstand laden')}</SecondaryButton></p>}
        {discard && <Dialog title={t('Messung verwerfen?')} onClose={() => setDiscard(false)} width={440}><p>{t('Die Stoppuhr wird entfernt. Gespeicherte Zeiteinträge bleiben erhalten.')}</p><PrimaryButton disabled={busy} onClick={() => void store.timer('discard', timerInput).then(success => { if (success) setDiscard(false); })}>{t('Bestätigen')}</PrimaryButton></Dialog>}
    </Panel>;
}
