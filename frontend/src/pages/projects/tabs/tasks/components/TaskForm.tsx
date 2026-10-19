import styled from 'styled-components';

import { taskStatuses } from '../../../../../data/taskStatuses';
import { taskPriorities } from '../../../../../data/taskPriorities';
import type { Epic } from '../../../types/epic.types';

import {
    TaskPriorityKey,
    TaskStatusKey
} from '../../../types/task.types';

const Form = styled.form`
    background: ${({ theme }) => theme.colors.content};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;
    padding: 16px;

    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
    gap: 12px;

    margin-bottom: 12px;
`;

const FormTitle = styled.h4`
    grid-column: 1 / -1;
    margin: 0;
`;

const Input = styled.input`
    grid-column: 1 / -1;

    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 10px;

    background: ${({ theme }) => theme.colors.header};
    color: ${({ theme }) => theme.colors.text};
`;

const Textarea = styled.textarea`
    grid-column: 1 / -1;

    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 10px;

    min-height: 90px;
    resize: vertical;

    background: ${({ theme }) => theme.colors.header};
    color: ${({ theme }) => theme.colors.text};
`;

const Select = styled.select`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 10px;

    background: ${({ theme }) => theme.colors.header};
    color: ${({ theme }) => theme.colors.text};
`;

const ButtonGroup = styled.div`
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
`;

const Button = styled.button`
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;

    color: ${({ theme }) => theme.colors.onPrimary};
    background: ${({ theme }) => theme.colors.primary};

    font-weight: 700;
`;

const SecondaryButton = styled.button`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;

    color: ${({ theme }) => theme.colors.text};
    background: transparent;
`;

type Props = {
    title: string;
    setTitle: (value: string) => void;

    description: string;
    setDescription: (value: string) => void;

    status: TaskStatusKey;
    setStatus: (value: TaskStatusKey) => void;

    priority: TaskPriorityKey;
    setPriority: (value: TaskPriorityKey) => void;

    onSave: () => void;
    onCancel: () => void;

    isEditing: boolean;
    epics: Epic[];
    epicId: number | undefined;
    setEpicId: (value: number | undefined) => void;
};

export default function TaskForm({
                                     title,
                                     setTitle,

                                     description,
                                     setDescription,

                                     status,
                                     setStatus,

                                     priority,
                                     setPriority,

                                     onSave,
                                     onCancel,

                                     isEditing,
                                     epics,
                                     epicId,
                                     setEpicId
                                 }: Props) {
    return (
        <Form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <FormTitle>
                {isEditing ? 'Task bearbeiten' : 'Neue Task'}
            </FormTitle>

            <Input
                aria-label="Task-Titel"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Task-Titel"
            />

            <Textarea
                aria-label="Beschreibung"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Beschreibung"
            />

            <Select
                aria-label="Status"
                value={status}
                onChange={(event) =>
                    setStatus(event.target.value as TaskStatusKey)
                }
            >
                {Object.values(taskStatuses).map((status) => (
                    <option key={status.key} value={status.key}>
                        {status.label}
                    </option>
                ))}
            </Select>

            <Select
                aria-label="Priorität"
                value={priority}
                onChange={(event) =>
                    setPriority(event.target.value as TaskPriorityKey)
                }
            >
                {Object.values(taskPriorities).map((priority) => (
                    <option key={priority.key} value={priority.key}>
                        {priority.label}
                    </option>
                ))}
            </Select>

            <Select aria-label="Epic" value={epicId ?? ''} onChange={(event) => setEpicId(event.target.value ? Number(event.target.value) : undefined)}>
                <option value="">Kein Epic</option>
                {epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.title}</option>)}
            </Select>

            <ButtonGroup>
                <SecondaryButton type="button" onClick={onCancel}>
                    Abbrechen
                </SecondaryButton>

                <Button type="submit" disabled={!title.trim()}>
                    {isEditing ? 'Aktualisieren' : 'Erstellen'}
                </Button>
            </ButtonGroup>
        </Form>
    );
}
