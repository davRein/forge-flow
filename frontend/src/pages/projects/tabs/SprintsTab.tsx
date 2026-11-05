import { useTranslation as useUiTranslation } from '../../../hooks/languageContext';
import { useState } from 'react';
import { useChatNavigationBlocker } from '../../../hooks/chatNavigationContext';
import styled from 'styled-components';
import { sprintStatuses } from '../../../data/sprintStatuses';
import { taskStatuses } from '../../../data/taskStatuses';
import Dialog from '../components/Dialog';
import StatusBadge from '../components/StatusBadge';
import type { Sprint, SprintStatus } from '../types/sprint.types';
import type { Task } from '../types/task.types';
import SprintForm from './sprints/components/SprintForm';
import type { useSprints } from './sprints/hooks/useSprints';
import { getSprintTasks } from './sprints/utils/sprintLogic';
import { DangerButton, ErrorText, Field, FormActions, FormCard, Input, PrimaryButton, SecondaryButton, Select } from '../styles/projectStyles';

const Toolbar = styled.div`
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: end;
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
    margin-top: 12px;
`;
const Card = styled(FormCard)`
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    display: flex;
    flex-direction: column;
    gap: 14px;
    h4 { font-size: 18px; }
    p { line-height: 1.5; white-space: pre-wrap; }
    progress { width: 100%; accent-color: ${({ theme }) => theme.colors.primary}; }
    summary { cursor: pointer; }
    ul { list-style: none; }
    li { margin-top: 10px; line-height: 1.5; }
`;
const Actions = styled(FormActions)`
    flex-wrap: wrap;
    margin-top: auto;
`;
const Backlog = styled(FormCard)`
    margin: 24px 0 0;
    h4 { margin-bottom: 10px; }
`;
const BacklogRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    margin-top: 10px;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    span { min-width: 0; overflow-wrap: anywhere; line-height: 1.5; }
`;

type Props = { sprintState: ReturnType<typeof useSprints>; tasks: Task[]; onOpenTasks: () => void };

export default function SprintsTab({ sprintState, tasks, onOpenTasks }: Props) {
    const { t: tx } = useUiTranslation();

    const [editor, setEditor] = useState<{ sprint: Sprint | null } | null>(null);
    const [confirmation, setConfirmation] = useState<{ sprint: Sprint; action: 'complete' | 'delete' } | null>(null);
    useChatNavigationBlocker(!!editor || !!confirmation);
    const [query, setQuery] = useState('');
    const [backlogQuery, setBacklogQuery] = useState('');
    const [filter, setFilter] = useState<'all' | SprintStatus>('all');
    const [error, setError] = useState('');
    const active = sprintState.projectSprints.find((sprint) => sprint.status === 'active');
    const availableSprints = sprintState.projectSprints.filter((sprint) => sprint.status !== 'completed');
    const search = query.trim().toLocaleLowerCase('de');
    const backlogSearch = backlogQuery.trim().toLocaleLowerCase('de');
    const statusOrder = { active: 0, planned: 1, completed: 2 };
    const filtered = sprintState.projectSprints.filter((sprint) => (filter === 'all' || sprint.status === filter)
        && `${sprint.title} ${sprint.goal}`.toLocaleLowerCase('de').includes(search))
        .sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || a.startDate.localeCompare(b.startDate));
    const backlogTasks = sprintState.backlogTasks.filter((task) => `${task.code} ${task.title}`.toLocaleLowerCase('de').includes(backlogSearch));

    function confirm() {
        if (!confirmation) return;
        const message = confirmation.action === 'complete' ? sprintState.changeStatus(confirmation.sprint.id, 'complete') : sprintState.removeSprint(confirmation.sprint.id);
        setError(message ?? '');
        setConfirmation(null);
    }

    return (
        <section aria-label={tx('Sprints')}>
            <Toolbar>
                <div><h3>{tx('Sprints')}</h3><p>{tx('Zeiträume planen, Aufgaben bündeln und Sprint-Ziele verfolgen.')}</p></div>
                <PrimaryButton onClick={() => { setError(''); setEditor({ sprint: null }); }}>{tx('+ Sprint anlegen')}</PrimaryButton>
            </Toolbar>
            <p>{active ? tx('Aktiver Sprint: {value0}', { value0: active.title }) : tx('Kein Sprint aktiv.')} {tx(' Pro Projekt kann ein Sprint aktiv sein.')}</p>
            <Filters>
                <Field>{tx('Sprints suchen')}<Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tx('Titel oder Sprint-Ziel')} /></Field>
                <Field>{tx('Status')}<Select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | SprintStatus)}>
                    <option value="all">{tx('Alle Sprints')}</option>
                    {Object.entries(sprintStatuses).map(([key, value]) => <option key={key} value={key}>{tx(value.label)}</option>)}
                </Select></Field>
            </Filters>
            {error && <ErrorText role="alert">{tx(error)}</ErrorText>}
            <p aria-live="polite">{filtered.length} {tx(' von ')}{sprintState.projectSprints.length} {tx(' Sprints')}</p>
            {filtered.length === 0 && <FormCard>{sprintState.projectSprints.length === 0 ? tx('Noch keine Sprints vorhanden. Lege den ersten Sprint an und plane Aufgaben ein.') : tx('Keine Sprints für diese Suche und diesen Status gefunden.')}</FormCard>}
            <Grid>
                {filtered.map((sprint) => {
                    const sprintTasks = getSprintTasks(sprint, tasks);
                    const done = sprintTasks.filter((task) => task.status === 'done').length;
                    const open = sprintTasks.length - done;
                    const progress = sprintTasks.length > 0 ? Math.round(done / sprintTasks.length * 100) : 0;
                    const status = sprintStatuses[sprint.status];
                    return (
                        <Card as="article" key={sprint.id}>
                            <Toolbar><h4>{sprint.title}</h4><StatusBadge label={tx(status.label)} color={status.color} /></Toolbar>
                            <p>{sprint.startDate} {tx(' bis ')}{sprint.endDate}</p>
                            <p>{sprint.goal || tx('Kein Sprint-Ziel hinterlegt.')}</p>
                            <div><p>{done} {tx(' von ')}{sprintTasks.length} {tx(' Aufgaben erledigt · ')}{progress}%</p><progress max={100} value={progress} aria-label={tx('Fortschritt {value0}', { value0: sprint.title })} /></div>
                            {sprint.completion && <p>{tx('Ergebnis beim Abschluss: ')}{open} {tx(' offene Aufgaben gingen zurück ins Backlog. Spätere Aufgabenänderungen verändern dieses Ergebnis nicht.')}</p>}
                            {sprintTasks.length > 0 ? <details><summary>{sprint.completion ? tx('Aufgaben beim Abschluss') : tx('Eingeplante Aufgaben')} ({sprintTasks.length})</summary>
                                <ul>{sprintTasks.map((task) => <li key={task.id}>{task.code} · {task.title}<br />{tx(taskStatuses[task.status].label)}</li>)}</ul>
                            </details> : <p>{tx('Noch keine Aufgaben eingeplant.')}</p>}
                            {sprint.status === 'planned' && (active || open === 0) && <p>{active ? tx('Zum Starten zuerst den aktiven Sprint abschließen.') : tx('Zum Starten mindestens eine offene Aufgabe einplanen.')}</p>}
                            <Actions>
                                {sprint.status !== 'completed' && <SecondaryButton onClick={() => { setError(''); setEditor({ sprint }); }}>{tx('Bearbeiten & planen')}</SecondaryButton>}
                                {sprint.status === 'planned' && <PrimaryButton disabled={!!active || open === 0} onClick={() => setError(sprintState.changeStatus(sprint.id, 'start') ?? '')}>{tx('Starten')}</PrimaryButton>}
                                {sprint.status === 'active' && <PrimaryButton onClick={() => { setError(''); setConfirmation({ sprint, action: 'complete' }); }}>{tx('Abschließen')}</PrimaryButton>}
                                <DangerButton disabled={sprint.status === 'active'} title={sprint.status === 'active' ? tx('Aktiven Sprint zuerst abschließen') : undefined} onClick={() => { setError(''); setConfirmation({ sprint, action: 'delete' }); }}>{tx('Löschen')}</DangerButton>
                            </Actions>
                        </Card>
                    );
                })}
            </Grid>
            <Backlog>
                <Toolbar><div><h4>{tx('Backlog (')}{sprintState.backlogTasks.length})</h4><p>{tx('Offene Aufgaben ohne Sprint-Zuordnung.')}</p></div><SecondaryButton onClick={onOpenTasks}>{tx('Aufgaben verwalten')}</SecondaryButton></Toolbar>
                <Field>{tx('Backlog durchsuchen')}<Input type="search" value={backlogQuery} onChange={(event) => setBacklogQuery(event.target.value)} placeholder={tx('Task-Code oder Titel')} /></Field>
                {backlogTasks.map((task) => <BacklogRow key={task.id}>
                    <span>{task.code} · {task.title}<br />{tx(taskStatuses[task.status].label)}</span>
                    <Select aria-label={tx('Sprint für {value0}', { value0: task.code })} value="" disabled={availableSprints.length === 0} onChange={(event) => {
                        const target = availableSprints.find((sprint) => sprint.id === Number(event.target.value));
                        if (!target) return;
                        setError(sprintState.saveSprint({ title: target.title, goal: target.goal, startDate: target.startDate, endDate: target.endDate, taskIds: [...target.taskIds.filter((id) => tasks.some((entry) => entry.id === id)), task.id] }, target.id) ?? '');
                    }}>
                        <option value="">{tx('In Sprint einplanen …')}</option>
                        {availableSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.title} ({tx(sprintStatuses[sprint.status].label)})</option>)}
                    </Select>
                </BacklogRow>)}
                {backlogTasks.length === 0 && <p>{sprintState.backlogTasks.length === 0 ? tx('Keine offenen Aufgaben im Backlog.') : tx('Keine Aufgaben für diese Suche gefunden.')}</p>}
            </Backlog>
            {editor && <SprintForm sprint={editor.sprint} sprints={sprintState.projectSprints} tasks={tasks} onSave={(draft, id) => {
                const message = sprintState.saveSprint(draft, id);
                if (!message) { setQuery(''); setFilter('all'); }
                return message;
            }} onClose={() => setEditor(null)} />}
            {confirmation && <Dialog title={confirmation.action === 'complete' ? tx('Sprint abschließen?') : tx('Sprint löschen?')} onClose={() => setConfirmation(null)}>
                <p>„{confirmation.sprint.title}“ {confirmation.action === 'complete' ? tx('abschließen') : tx('wirklich löschen')}?</p>
                <p>{confirmation.action === 'complete' ? tx('Das Ergebnis wird festgehalten. Offene Aufgaben gehen zurück ins Backlog; die Aufgaben selbst bleiben erhalten.') : tx('Die Sprint-Planung und ein vorhandenes Abschluss-Ergebnis werden entfernt. Die Aufgaben bleiben erhalten.')}</p>
                <FormActions><SecondaryButton autoFocus onClick={() => setConfirmation(null)}>{tx('Abbrechen')}</SecondaryButton>
                    {confirmation.action === 'complete' ? <PrimaryButton onClick={confirm}>{tx('Sprint abschließen')}</PrimaryButton> : <DangerButton onClick={confirm}>{tx('Sprint löschen')}</DangerButton>}
                </FormActions>
            </Dialog>}
        </section>
    );
}
