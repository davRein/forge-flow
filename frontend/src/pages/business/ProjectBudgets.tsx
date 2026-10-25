import { useState } from 'react';
import { useBusiness } from '../../hooks/businessContext';
import { useTimeTracking } from '../../hooks/timeTrackingContext';
import { useEffect } from 'react';
import { useWorkspaceField } from '../../hooks/workspaceContext';
import { useTranslation } from '../../hooks/languageContext';
import { useNavigationGuard, useUnsavedChanges } from '../../hooks/navigationGuard';
import { Field, Input, Select, FormGrid, FormActions, PrimaryButton, SecondaryButton } from '../../components/ui/formStyles';
import Dialog from '../../components/ui/Dialog';
import { Panel, TableFrame, Meter } from './businessStyles';
import { duration } from '../timeTracker/timeLogic';
import type { ProjectBudget } from '../../services/business/business';

export function ProjectBudgetSummary({ projectId }: { projectId: number }) {
    const { data } = useBusiness(); const times = useTimeTracking(); const { t } = useTranslation();
    useEffect(() => { if (times.status === 'idle') void times.store.load(); }, [times.status, times.store]);
    const budget = data?.budgets.find(value => value.projectId === projectId); if (!budget) return null;
    const used = times.data?.entries.filter(value => value.projectId === projectId).reduce((sum, value) => sum + value.minutes, 0) ?? 0;
    return <Panel style={{ marginTop: 16, marginBottom: 0 }} aria-label={t('Projektbudget')}><div className="toolbar"><strong>{t('Projektbudget')}</strong><span>{duration(used)} / {duration(budget.minutes)}</span></div>
        <Meter max={budget.minutes} value={Math.min(used, budget.minutes)} aria-label={t('Budgetverbrauch')} />
        <p>{used > budget.minutes ? t('Budget überschritten') : `${t('Verbleibend')}: ${duration(budget.minutes - used)}`}</p></Panel>;
}
export default function ProjectBudgets() {
    const { data, store, status, conflict, error } = useBusiness(); const times = useTimeTracking(); const [projects] = useWorkspaceField('projects'); const { t, locale } = useTranslation(); const guard = useNavigationGuard();
    const [draft, setDraft] = useState<ProjectBudget | null>(null), [baseline, setBaseline] = useState('');
    useUnsavedChanges(!!draft && JSON.stringify(draft) !== baseline, () => setDraft(null), status === 'saving');
    useEffect(() => { if (times.status === 'idle') void times.store.load(); }, [times.status, times.store]);
    return <><div className="toolbar"><h2>{t('Projektbudgets')}</h2><SecondaryButton disabled={!projects.length || status !== 'ready'} onClick={() => { const value = { projectId: projects[0].id, minutes: 2400, hourlyRateCents: data!.profile.hourlyRateCents }; setDraft(value); setBaseline(JSON.stringify(value)); }}>{t('+ Budget')}</SecondaryButton></div>
        <TableFrame><table><thead><tr>{['Projekt', 'Geplant', 'Erfasst', 'Verbleibend', 'Stundensatz', 'Aktionen'].map(value => <th key={value}>{t(value)}</th>)}</tr></thead><tbody>
            {data!.budgets.map(budget => { const used = times.data?.entries.filter(value => value.projectId === budget.projectId).reduce((sum, value) => sum + value.minutes, 0) ?? 0; return <tr key={budget.projectId}><td>{projects.find(value => value.id === budget.projectId)?.name ?? `#${budget.projectId}`}</td><td>{duration(budget.minutes)}</td><td>{duration(used)}</td><td>{used > budget.minutes ? t('Budget überschritten') : duration(budget.minutes - used)}<Meter aria-label={t('Budgetverbrauch')} max={budget.minutes} value={Math.min(used, budget.minutes)} /></td><td>{new Intl.NumberFormat(locale, { style: 'currency', currency: data!.profile.currency }).format(budget.hourlyRateCents / 100)}</td><td><SecondaryButton onClick={() => { setDraft({ ...budget }); setBaseline(JSON.stringify(budget)); }}>{t('Bearbeiten')}</SecondaryButton></td></tr>; })}
            {!data!.budgets.length && <tr><td colSpan={6}>{t('Noch keine Budgets angelegt.')}</td></tr>}
        </tbody></table></TableFrame>
        {draft && <Dialog title={t('Projektbudget')} width={520} onClose={() => guard.request(() => setDraft(null))}><form onSubmit={event => { event.preventDefault(); void store.save({ ...data!, budgets: [...data!.budgets.filter(value => value.projectId !== draft.projectId), draft] }).then(success => { if (success) setDraft(null); }); }}>
            <FormGrid><Field>{t('Projekt')}<Select value={draft.projectId} onChange={event => setDraft({ ...draft, projectId: Number(event.target.value) })}>{projects.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</Select></Field><Field>{t('Budget (Minuten)')}<Input type="number" min={1} max={10000000} required value={draft.minutes} onChange={event => setDraft({ ...draft, minutes: event.target.valueAsNumber })} /></Field><Field>{t('Stundensatz')}<Input type="number" min={0} max={1000000} step="0.01" required value={draft.hourlyRateCents / 100} onChange={event => setDraft({ ...draft, hourlyRateCents: Math.round(event.target.valueAsNumber * 100) })} /></Field></FormGrid>
            {error && <p role="alert">{t(error)}</p>}<FormActions><SecondaryButton type="button" disabled={status === 'saving'} onClick={() => guard.request(() => setDraft(null))}>{t('Abbrechen')}</SecondaryButton><PrimaryButton disabled={status !== 'ready' || conflict}>{t('Speichern')}</PrimaryButton></FormActions>
        </form></Dialog>}
    </>;
}
