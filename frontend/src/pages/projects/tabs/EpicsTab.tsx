import { useTranslation as useUiTranslation } from '../../../hooks/languageContext';
import { useState } from 'react';
import { useChatNavigationBlocker } from '../../../hooks/chatNavigationContext';
import styled from 'styled-components';
import Dialog from '../components/Dialog';
import StatusBadge from '../components/StatusBadge';
import { taskStatuses } from '../../../data/taskStatuses';
import type { Epic } from '../types/epic.types';
import type { Task } from '../types/task.types';
import type { useEpics } from './epics/hooks/useEpics';
import EpicForm from './epics/components/EpicForm';
import {
    DangerButton, Field, FormActions, FormCard, Input, PrimaryButton, SecondaryButton, Select
} from '../styles/projectStyles';

const Toolbar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
`;

const Filters = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 20px 0;

    label:first-child { flex: 1; min-width: 180px; }
`;

const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
    gap: 16px;
`;

const Card = styled(FormCard)`
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
    display: flex;
    flex-direction: column;
    gap: 16px;

    h4 { font-size: 18px; }
    p { line-height: 1.5; white-space: pre-wrap; color: ${({ theme }) => theme.colors.textSecondary}; }
    progress { width: 100%; height: 12px; accent-color: ${({ theme }) => theme.colors.primary}; }
    summary { cursor: pointer; line-height: 1.5; }
    ul { list-style: none; margin-top: 10px; }
    li { padding: 8px 0; border-top: 1px solid ${({ theme }) => theme.colors.border}; line-height: 1.5; }
`;

const CardHeader = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
`;

const CardActions = styled(FormActions)`
    margin-top: auto;
    flex-wrap: wrap;
`;

type ProgressFilter = 'all' | 'unstarted' | 'active' | 'done';
type Props = { epicState: ReturnType<typeof useEpics>; tasks: Task[] };

export default function EpicsTab({ epicState, tasks }: Props) {
    const { t: tx } = useUiTranslation();

    const [editor, setEditor] = useState<{ epic: Epic | null } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Epic | null>(null);
    useChatNavigationBlocker(!!editor || !!deleteTarget);
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<ProgressFilter>('all');
    const search = query.trim().toLocaleLowerCase('de');
    const items = epicState.projectEpics.map((epic) => {
        const epicTasks = tasks.filter((task) => task.epicId === epic.id);
        const done = epicTasks.filter((task) => task.status === 'done').length;
        const status = epicTasks.length > 0 && done === epicTasks.length ? 'done'
            : epicTasks.some((task) => task.status !== 'todo') ? 'active' : 'unstarted';
        return { epic, tasks: epicTasks, done, status, progress: epicTasks.length > 0 ? Math.round(done / epicTasks.length * 100) : 0 };
    });
    const filtered = items.filter(({ epic, status }) => (filter === 'all' || filter === status)
        && `${epic.title} ${epic.description}`.toLocaleLowerCase('de').includes(search));
    const unassigned = tasks.filter((task) => !epicState.projectEpics.some((epic) => epic.id === task.epicId)).length;

    return (
        <section aria-label={tx('Epics')}>
            <Toolbar>
                <div>
                    <h3>{tx('Epics')}</h3>
                    <p>{tx('Größere Ziele planen und den Fortschritt ihrer Aufgaben verfolgen.')}</p>
                </div>
                <PrimaryButton onClick={() => setEditor({ epic: null })}>{tx('+ Epic anlegen')}</PrimaryButton>
            </Toolbar>
            <p>{items.length} {tx(' Epics · ')}{tasks.length - unassigned} {tx(' Aufgaben zugeordnet · ')}{unassigned} {tx(' ohne Epic')}</p>
            <Filters>
                <Field>
                    {tx('Epics suchen')}<Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx('Titel oder Beschreibung')} />
                </Field>
                <Field>
                    {tx('Fortschritt')}<Select value={filter} onChange={(event) => setFilter(event.target.value as ProgressFilter)}>
                        <option value="all">{tx('Alle Epics')}</option>
                        <option value="unstarted">{tx('Nicht begonnen')}</option>
                        <option value="active">{tx('In Bearbeitung')}</option>
                        <option value="done">{tx('Abgeschlossen')}</option>
                    </Select>
                </Field>
            </Filters>
            <p aria-live="polite">{filtered.length} {tx(' von ')}{items.length} {tx(' Epics')}</p>
            {filtered.length === 0 && <FormCard>{items.length === 0
                ? tx('Noch keine Epics vorhanden. Lege das erste Epic an und ordne Aufgaben zu.')
                : tx('Keine Epics passen zur Suche und zum gewählten Fortschritt.')}</FormCard>}
            <Grid>
                {filtered.map(({ epic, tasks: epicTasks, done, status, progress }) => (
                    <Card as="article" key={epic.id}>
                        <CardHeader>
                            <h4>{epic.title}</h4>
                            <StatusBadge label={status === 'done' ? tx('Abgeschlossen') : status === 'active' ? tx('In Bearbeitung') : tx('Nicht begonnen')}
                                color={status === 'done' ? '#22c55e' : status === 'active' ? '#4f8cff' : '#b7bcc8'} />
                        </CardHeader>
                        <p>{epic.description || tx('Keine Beschreibung hinterlegt.')}</p>
                        <div>
                            <p>{done} {tx(' von ')}{epicTasks.length} {tx(' Aufgaben erledigt · ')}{progress}%</p>
                            <progress value={progress} max={100} aria-label={tx('Fortschritt {value0}', { value0: epic.title })} />
                        </div>
                        {epicTasks.length > 0 ? (
                            <details>
                                <summary>{tx('Zugeordnete Aufgaben (')}{epicTasks.length})</summary>
                                <ul>{epicTasks.map((task) => <li key={task.id}>{task.code} · {task.title}<br />{tx(taskStatuses[task.status].label)}</li>)}</ul>
                            </details>
                        ) : <p>{tx('Noch keine Aufgaben zugeordnet.')}</p>}
                        <CardActions>
                            <SecondaryButton onClick={() => setEditor({ epic })}>{tx('Bearbeiten & zuordnen')}</SecondaryButton>
                            <DangerButton onClick={() => setDeleteTarget(epic)}>{tx('Löschen')}</DangerButton>
                        </CardActions>
                    </Card>
                ))}
            </Grid>
            {editor && <EpicForm epic={editor.epic} epics={epicState.projectEpics} tasks={tasks}
                onSave={(draft, id) => {
                    const error = epicState.saveEpic(draft, id);
                    if (!error) { setQuery(''); setFilter('all'); }
                    return error;
                }} onClose={() => setEditor(null)} />}
            {deleteTarget && (
                <Dialog title={tx('Epic löschen?')} onClose={() => setDeleteTarget(null)}>
                    <p>„{deleteTarget.title}{tx('“ wirklich löschen? Die zugeordneten Aufgaben bleiben erhalten und werden vom Epic gelöst.')}</p>
                    <FormActions>
                        <SecondaryButton autoFocus onClick={() => setDeleteTarget(null)}>{tx('Abbrechen')}</SecondaryButton>
                        <DangerButton onClick={() => { epicState.deleteEpic(deleteTarget.id); setDeleteTarget(null); }}>{tx('Epic löschen')}</DangerButton>
                    </FormActions>
                </Dialog>
            )}
        </section>
    );
}
