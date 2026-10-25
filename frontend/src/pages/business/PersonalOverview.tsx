import { useEffect } from 'react';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { useTimeTracking } from '../../hooks/timeTrackingContext';
import { useTranslation } from '../../hooks/languageContext';
import { GuardedLink } from '../../components/navigation/GuardedLink';
import { Panel } from './businessStyles';
import { addDays, duration, todayDate, weekStart } from '../timeTracker/timeLogic';
export default function PersonalOverview({ compact = false }: { compact?: boolean }) {
    const { t } = useTranslation(); const data = useWorkspacePersistence().getSnapshot().data!; const times = useTimeTracking(); const today = todayDate(), monday = weekStart(today);
    useEffect(() => { if (times.status === 'idle') void times.store.load(); }, [times.status, times.store]);
    const near = data.projects.filter(value => value.deadline <= addDays(today, 7) && data.tasks.some(task => task.projectId === value.id && task.status !== 'done')).sort((a, b) => a.deadline.localeCompare(b.deadline));
    const deadline = (projectId: number) => data.projects.find(value => value.id === projectId)?.deadline ?? '9999-12-31';
    const tasks = data.tasks.filter(value => value.status !== 'done').sort((a, b) => deadline(a.projectId).localeCompare(deadline(b.projectId)) || ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]) || b.updatedAt.localeCompare(a.updatedAt));
    const entries = times.data?.entries ?? [], todayMinutes = entries.filter(value => value.date === today).reduce((sum, value) => sum + value.minutes, 0);
    const missing = Array.from({ length: 5 }, (_, index) => addDays(monday, index)).filter(date => date < today && !entries.some(value => value.date === date));
    const content = <Panel aria-label={t('Meine Arbeit')}><div className="toolbar"><h2>{t('Meine Arbeit')}</h2><GuardedLink to={compact ? '/projectManager/today' : '/timeTracker/calendar'}>{t(compact ? 'Alles anzeigen' : 'Zeiten erfassen')}</GuardedLink></div>
        <p><strong>{duration(todayMinutes)}</strong> {t('heute erfasst')} · {tasks.length} {t('offene Aufgaben')}</p>
        {!!missing.length && times.status === 'ready' && <p className="muted">{t('Werktage dieser Woche ohne Zeiteintrag')}: {missing.join(', ')}</p>}
        <div className="grid"><div><h3>{t('Anstehende Projekttermine')}</h3>{near.slice(0, compact ? 3 : 20).map(value => <p key={value.id}><GuardedLink to={`/projectManager/projects?project=${value.id}`}>{value.name}</GuardedLink> · {value.deadline}</p>)}{!near.length && <p className="muted">{t('Keine offenen Projekte mit naher Deadline.')}</p>}</div>
            <div><h3>{t('Nächste Aufgaben')}</h3>{tasks.slice(0, compact ? 3 : 20).map(value => <p key={value.id}><GuardedLink to={`/projectManager/projects?project=${value.projectId}&task=${value.id}`}>{value.code} · {value.title}</GuardedLink><small className="muted"> · {t('Projekttermin')}: {deadline(value.projectId)}</small></p>)}{!tasks.length && <p className="muted">{t('Keine offenen Aufgaben.')}</p>}</div></div>
    </Panel>;
    return content;
}
