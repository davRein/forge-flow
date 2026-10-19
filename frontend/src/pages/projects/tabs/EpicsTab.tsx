import { useState } from 'react';
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
    const [editor, setEditor] = useState<{ epic: Epic | null } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Epic | null>(null);
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
        <section aria-label="Epics">
            <Toolbar>
                <div>
                    <h3>Epics</h3>
                    <p>Größere Ziele planen und den Fortschritt ihrer Aufgaben verfolgen.</p>
                </div>
                <PrimaryButton onClick={() => setEditor({ epic: null })}>+ Epic anlegen</PrimaryButton>
            </Toolbar>
            <p>{items.length} Epics · {tasks.length - unassigned} Aufgaben zugeordnet · {unassigned} ohne Epic</p>
            <Filters>
                <Field>
                    Epics suchen
                    <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Titel oder Beschreibung" />
                </Field>
                <Field>
                    Fortschritt
                    <Select value={filter} onChange={(event) => setFilter(event.target.value as ProgressFilter)}>
                        <option value="all">Alle Epics</option>
                        <option value="unstarted">Nicht begonnen</option>
                        <option value="active">In Bearbeitung</option>
                        <option value="done">Abgeschlossen</option>
                    </Select>
                </Field>
            </Filters>
            <p aria-live="polite">{filtered.length} von {items.length} Epics</p>
            {filtered.length === 0 && <FormCard>{items.length === 0
                ? 'Noch keine Epics vorhanden. Lege das erste Epic an und ordne Aufgaben zu.'
                : 'Keine Epics passen zur Suche und zum gewählten Fortschritt.'}</FormCard>}
            <Grid>
                {filtered.map(({ epic, tasks: epicTasks, done, status, progress }) => (
                    <Card as="article" key={epic.id}>
                        <CardHeader>
                            <h4>{epic.title}</h4>
                            <StatusBadge label={status === 'done' ? 'Abgeschlossen' : status === 'active' ? 'In Bearbeitung' : 'Nicht begonnen'}
                                color={status === 'done' ? '#22c55e' : status === 'active' ? '#4f8cff' : '#b7bcc8'} />
                        </CardHeader>
                        <p>{epic.description || 'Keine Beschreibung hinterlegt.'}</p>
                        <div>
                            <p>{done} von {epicTasks.length} Aufgaben erledigt · {progress}%</p>
                            <progress value={progress} max={100} aria-label={`Fortschritt ${epic.title}`} />
                        </div>
                        {epicTasks.length > 0 ? (
                            <details>
                                <summary>Zugeordnete Aufgaben ({epicTasks.length})</summary>
                                <ul>{epicTasks.map((task) => <li key={task.id}>{task.code} · {task.title}<br />{taskStatuses[task.status].label}</li>)}</ul>
                            </details>
                        ) : <p>Noch keine Aufgaben zugeordnet.</p>}
                        <CardActions>
                            <SecondaryButton onClick={() => setEditor({ epic })}>Bearbeiten & zuordnen</SecondaryButton>
                            <DangerButton onClick={() => setDeleteTarget(epic)}>Löschen</DangerButton>
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
                <Dialog title="Epic löschen?" onClose={() => setDeleteTarget(null)}>
                    <p>„{deleteTarget.title}“ wirklich löschen? Die zugeordneten Aufgaben bleiben erhalten und werden vom Epic gelöst.</p>
                    <FormActions>
                        <SecondaryButton autoFocus onClick={() => setDeleteTarget(null)}>Abbrechen</SecondaryButton>
                        <DangerButton onClick={() => { epicState.deleteEpic(deleteTarget.id); setDeleteTarget(null); }}>Epic löschen</DangerButton>
                    </FormActions>
                </Dialog>
            )}
        </section>
    );
}
