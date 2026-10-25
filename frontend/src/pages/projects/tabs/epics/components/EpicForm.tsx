import { useState } from 'react';
import styled from 'styled-components';
import { useRef } from 'react';
import { useUnsavedChanges } from '../../../../../hooks/navigationGuard';
import Dialog from '../../../components/Dialog';
import type { Epic, EpicDraft } from '../../../types/epic.types';
import type { Task } from '../../../types/task.types';
import {
    ErrorText, Field, FormActions, Input, PrimaryButton, Required, SecondaryButton
} from '../../../styles/projectStyles';

const Form = styled.form`
    display: flex;
    flex-direction: column;
    gap: 16px;
`;

const Textarea = styled.textarea`
    min-height: 100px;
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
    p { margin: 10px 0; color: ${({ theme }) => theme.colors.textSecondary}; }
`;

const TaskOptions = styled.div`
    max-height: 260px;
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
    span { display: block; line-height: 1.5; }
    small { display: block; color: ${({ theme }) => theme.colors.textSecondary}; }
`;

type Props = {
    epic: Epic | null;
    epics: Epic[];
    tasks: Task[];
    onSave: (draft: EpicDraft, editingId: number | null) => string | null;
    onClose: () => void;
};

export default function EpicForm({ epic, epics, tasks, onSave, onClose }: Props) {
    const [draft, setDraft] = useState<EpicDraft>(() => ({
        title: epic?.title ?? '',
        description: epic?.description ?? '',
        taskIds: epic ? tasks.filter((task) => task.epicId === epic.id).map((task) => task.id) : []
    }));
    const [query, setQuery] = useState('');
    const initial = useRef(JSON.stringify(draft));
    useUnsavedChanges(JSON.stringify(draft) !== initial.current, onClose);
    const [error, setError] = useState('');
    const search = query.trim().toLocaleLowerCase('de');
    const filteredTasks = tasks.filter((task) => `${task.code} ${task.title}`.toLocaleLowerCase('de').includes(search));

    function changeDraft(next: EpicDraft) {
        setDraft(next);
        setError('');
    }

    return (
        <Dialog title={epic ? 'Epic bearbeiten' : 'Neues Epic'} onClose={onClose}>
            <Form onSubmit={(event) => {
                event.preventDefault();
                const message = onSave(draft, epic?.id ?? null);
                if (message) setError(message);
                else onClose();
            }}>
                <Field>
                    <span>Titel <Required>*</Required></span>
                    <Input required autoFocus value={draft.title} onChange={(event) => changeDraft({ ...draft, title: event.target.value })} placeholder="z. B. Kundenportal umsetzen" />
                </Field>
                <Field>
                    Beschreibung
                    <Textarea value={draft.description} onChange={(event) => changeDraft({ ...draft, description: event.target.value })} placeholder="Ziel und Umfang des Epics" />
                </Field>
                <TaskGroup>
                    <legend>Aufgaben zuordnen ({draft.taskIds.length})</legend>
                    <p>Jede Aufgabe gehört höchstens zu einem Epic. Eine bestehende Zuordnung wird erst beim Speichern geändert.</p>
                    <Field>
                        Aufgaben suchen
                        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Task-Code oder Titel" />
                    </Field>
                    <TaskOptions>
                        {filteredTasks.map((task) => {
                            const assignedEpic = epics.find((entry) => entry.id === task.epicId);
                            const selected = draft.taskIds.includes(task.id);
                            return (
                                <TaskOption key={task.id}>
                                    <input type="checkbox" checked={selected} onChange={(event) => changeDraft({
                                        ...draft,
                                        taskIds: event.target.checked ? [...draft.taskIds, task.id] : draft.taskIds.filter((id) => id !== task.id)
                                    })} />
                                    <span>
                                        {task.code} · {task.title}
                                        {assignedEpic && assignedEpic.id !== epic?.id && <small>{selected ? 'Wird verschoben aus' : 'Aktuell in'}: {assignedEpic.title}</small>}
                                    </span>
                                </TaskOption>
                            );
                        })}
                        {tasks.length === 0 && <p>Noch keine Aufgaben vorhanden. Du kannst sie später im Tasks-Tab anlegen und zuordnen.</p>}
                        {tasks.length > 0 && filteredTasks.length === 0 && <p>Keine Aufgaben für diese Suche gefunden.</p>}
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
