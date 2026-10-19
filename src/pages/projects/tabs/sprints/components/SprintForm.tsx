import { useState } from 'react';
import styled from 'styled-components';
import Dialog from '../../../components/Dialog';
import type { Sprint, SprintDraft } from '../../../types/sprint.types';
import type { Task } from '../../../types/task.types';
import { getTaskSprint } from '../utils/sprintLogic';
import { ErrorText, Field, FormActions, FormGrid, Input, PrimaryButton, Required, SecondaryButton } from '../../../styles/projectStyles';

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;
const Textarea = styled.textarea`
    min-height: 80px;
    resize: vertical;
    padding: 10px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.content};
    color: ${({ theme }) => theme.colors.text};
    font: inherit;
`;
const TaskGroup = styled.fieldset`
    min-width: 0;
    padding: 14px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    legend { padding: 0 6px; }
    p { margin: 10px 0; line-height: 1.5; color: ${({ theme }) => theme.colors.textSecondary}; }
`;
const TaskOptions = styled.div`
    max-height: 240px;
    overflow-y: auto;
    margin-top: 12px;
`;
const TaskOption = styled.label`
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 0;
    cursor: pointer;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    overflow-wrap: anywhere;
    input { margin-top: 3px; }
    span { line-height: 1.5; }
    small { display: block; color: ${({ theme }) => theme.colors.textSecondary}; }
`;

type Props = {
    sprint: Sprint | null;
    sprints: Sprint[];
    tasks: Task[];
    onSave: (draft: SprintDraft, id: number | null) => string | null;
    onClose: () => void;
};

export default function SprintForm({ sprint, sprints, tasks, onSave, onClose }: Props) {
    const [draft, setDraft] = useState<SprintDraft>(() => {
        const end = new Date();
        end.setDate(end.getDate() + 13);
        return {
            title: sprint?.title ?? '', goal: sprint?.goal ?? '',
            startDate: sprint?.startDate ?? new Date().toLocaleDateString('sv-SE'),
            endDate: sprint?.endDate ?? end.toLocaleDateString('sv-SE'),
            taskIds: sprint?.taskIds.filter((id) => tasks.some((task) => task.id === id)) ?? []
        };
    });
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');
    const available = tasks.filter((task) => {
        if (sprint?.taskIds.includes(task.id)) return true;
        return task.status !== 'done' && getTaskSprint(sprints, task.projectId, task.id)?.status !== 'active';
    });
    const search = query.trim().toLocaleLowerCase('de');
    const filtered = available.filter((task) => `${task.code} ${task.title}`.toLocaleLowerCase('de').includes(search));

    function change(next: SprintDraft) {
        setDraft(next);
        setError('');
    }

    return (
        <Dialog title={sprint ? 'Sprint bearbeiten' : 'Neuer Sprint'} onClose={onClose}>
            <Form onSubmit={(event) => {
                event.preventDefault();
                const message = onSave(draft, sprint?.id ?? null);
                if (message) setError(message);
                else onClose();
            }}>
                <Field>
                    <span>Titel <Required>*</Required></span>
                    <Input required autoFocus value={draft.title} onChange={(event) => change({ ...draft, title: event.target.value })} placeholder="z. B. Sprint 1 – Kundenportal" />
                </Field>
                <Field>
                    Sprint-Ziel
                    <Textarea value={draft.goal} onChange={(event) => change({ ...draft, goal: event.target.value })} placeholder="Was soll am Ende des Sprints erreicht sein?" />
                </Field>
                <FormGrid>
                    <Field>
                        <span>Startdatum <Required>*</Required></span>
                        <Input required type="date" value={draft.startDate} onChange={(event) => change({ ...draft, startDate: event.target.value })} />
                    </Field>
                    <Field>
                        <span>Enddatum <Required>*</Required></span>
                        <Input required type="date" min={draft.startDate || undefined} value={draft.endDate} onChange={(event) => change({ ...draft, endDate: event.target.value })} />
                    </Field>
                </FormGrid>
                <TaskGroup>
                    <legend>Aufgaben einplanen ({draft.taskIds.length})</legend>
                    <p>Offene Aufgaben aus dem Backlog oder geplanten Sprints können zugeordnet werden. Aufgaben anderer aktiver Sprints bleiben dort. Änderungen werden beim Speichern übernommen.</p>
                    <Field>
                        Aufgaben suchen
                        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Task-Code oder Titel" />
                    </Field>
                    <TaskOptions>
                        {filtered.map((task) => {
                            const assigned = getTaskSprint(sprints, task.projectId, task.id);
                            const selected = draft.taskIds.includes(task.id);
                            return (
                                <TaskOption key={task.id}>
                                    <input type="checkbox" checked={selected} onChange={(event) => change({ ...draft,
                                        taskIds: event.target.checked ? [...draft.taskIds, task.id] : draft.taskIds.filter((id) => id !== task.id)
                                    })} />
                                    <span>{task.code} · {task.title}
                                        {assigned && assigned.id !== sprint?.id && <small>{selected ? 'Wird verschoben aus' : 'Eingeplant in'}: {assigned.title}</small>}
                                        {task.status === 'done' && <small>Bereits erledigt</small>}
                                    </span>
                                </TaskOption>
                            );
                        })}
                        {filtered.length === 0 && <p>{available.length === 0 ? 'Keine offenen Aufgaben zur Planung verfügbar.' : 'Keine Aufgaben für diese Suche gefunden.'}</p>}
                    </TaskOptions>
                </TaskGroup>
                {error && <ErrorText role="alert">{error}</ErrorText>}
                <FormActions>
                    <SecondaryButton type="button" onClick={onClose}>Abbrechen</SecondaryButton>
                    <PrimaryButton type="submit" disabled={!draft.title.trim()}>Speichern</PrimaryButton>
                </FormActions>
            </Form>
        </Dialog>
    );
}
