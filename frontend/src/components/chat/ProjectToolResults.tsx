import styled from 'styled-components';
import { useTranslation } from '../../hooks/languageContext';
import type { ProjectToolEvent, ProjectToolName } from '../../services/ai/projectTools';
import { entityLabels, fieldLabels } from './workspaceLabels';

const Card = styled.details<{ $done: boolean }>`
    border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 10px; margin: 10px 0; padding: 9px 11px;
    background: ${({ theme }) => theme.colors.header}; font-size: 11px; line-height: 1.6; overflow-wrap: anywhere;
    summary { cursor: pointer; font-weight: 600; color: ${({ theme, $done }) => $done ? theme.colors.success : theme.colors.primary}; }
    .source, .hint { color: ${({ theme }) => theme.colors.textSecondary}; font-size: 10px; }
    ul { padding-left: 17px; margin: 9px 0; } li { margin: 7px 0; } p { margin: 7px 0; }
    strong { display: inline; color: ${({ theme }) => theme.colors.text}; font-size: 11px; }
`;
const names: Record<ProjectToolName, string> = { list_projects: 'Projektübersicht lesen', get_project_summary: 'Projektstatus lesen', list_open_tasks: 'Offene Aufgaben lesen', propose_project_navigation: 'Navigation vorbereiten', read_workspace: 'Fachdaten lesen', propose_workspace_create: 'Anlage vorbereiten', propose_workspace_update: 'Änderung vorbereiten' };
export default function ProjectToolResults({ entries }: { entries: ProjectToolEvent[] }) {
    const { t, locale } = useTranslation();
    return <>{entries.map((entry, index) => {
        const result = entry.result;
        const proposal = entry.name === 'propose_project_navigation' || entry.name === 'propose_workspace_create' || entry.name === 'propose_workspace_update';
        return <Card key={entry.id} $done={entry.status === 'completed'}>
            <summary><span aria-hidden="true">{entry.status === 'completed' ? '✓ ' : '◌ '}</span>{entries.length > 1 && `${index + 1}. `}{t(names[entry.name])} · {t(proposal
                ? entry.status === 'completed' ? 'Geprüft' : 'Wird geprüft …' : entry.status === 'completed' ? 'Gelesen' : 'Wird gelesen …')}</summary>
            {result && <>
                {result.readAt && <p className="source">{t('Gespeicherte Daten · abgerufen {time}', { time: new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(result.readAt)) })}</p>}
                {result.outcome === 'NOT_FOUND' && <p>{t('Kein passendes Projekt im eigenen Konto gefunden.')}</p>}
                {result.outcome === 'AMBIGUOUS' && <p>{t('Bitte ein Projekt anhand seiner Kennung auswählen.')}</p>}
                {result.outcome === 'INVALID_INPUT' && <p>{t('Die Abfrage war ungültig. Bitte die Frage präzisieren.')}</p>}
                {result.workspace && <><p>{t(entityLabels[result.workspace.entity])} · {t('Gefunden: {total}', { total: result.total })}</p>
                    {result.workspace.items.map(row => <details key={row.id}><summary>#{row.id} · {row.label}</summary>
                        {Object.entries(row.fields).map(([key, value]) => <p key={key}><strong>{t(fieldLabels[key] ?? key)}: </strong><span style={{ whiteSpace: 'pre-wrap' }}>{value || '—'}</span></p>)}</details>)}
                    {result.workspace.mode === 'detail' && <p>{t('Textabschnitt ab Zeichen {offset}', { offset: result.workspace.textOffset })}</p>}
                </>}
                {result.outcome === 'OK' && result.total === 0 && !result.workspace && <p>{t(entry.name === 'list_open_tasks' ? 'Keine offenen Aufgaben gefunden.' : 'Keine Projekte gefunden.')}</p>}
                {result.projects.length > 0 && <ul>{result.projects.map(project => <li key={project.id}>
                    <strong>#{project.id} · {project.name}</strong><br />
                    {t(project.planningCompleted ? 'Planung abgeschlossen' : 'Planung offen')} · {t('Termin: {date}', { date: project.deadline })}<br />
                    {t('Aufgaben: {todo} offen · {active} in Bearbeitung · {done} erledigt', { todo: project.tasks.todo, active: project.tasks.inProgress, done: project.tasks.done })}
                </li>)}</ul>}
                {result.tasks.length > 0 && <ul>{result.tasks.map(task => <li key={task.id}>
                    <strong>{task.code} · {task.title}</strong><br />
                    {t(task.status === 'todo' ? 'Offen' : 'In Bearbeitung')} · {t('Priorität: {priority}', { priority: t({ low: 'Niedrig', medium: 'Mittel', high: 'Hoch' }[task.priority]) })}
                </li>)}</ul>}
                {result.total > 0 && !result.action && !result.mutation && result.workspace?.mode !== 'count' && <p className="hint">{t('Angezeigt: {shown} von {total}', { shown: result.workspace?.items.length ?? (entry.name === 'list_open_tasks' ? result.tasks.length : result.projects.length), total: result.total })}</p>}
                {result.more && <p className="hint">{t('Weitere Einträge vorhanden. Frage nach der nächsten Seite.')}</p>}
                {result.textTruncated && <p className="hint">{t('Texte wurden gekürzt. Details oder den nächsten Textabschnitt abfragen.')}</p>}
            </>}
        </Card>;
    })}</>;
}
