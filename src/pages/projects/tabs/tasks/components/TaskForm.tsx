import styled from 'styled-components';

import { taskStatuses } from '../../../../../data/taskStatuses';
import { taskPriorities } from '../../../../../data/taskPriorities';

import {
    TaskPriorityKey,
    TaskStatusKey
} from '../../../types/task.types';

const Form = styled.div`
    background: ${({ theme }) => theme.colors.content};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;
    padding: 16px;

    display: grid;
    grid-template-columns: 1fr 180px 180px;
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
    display: flex;
    justify-content: flex-end;
    gap: 8px;
`;

const Button = styled.button`
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;

    color: ${({ theme }) => theme.colors.text};
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

                                     isEditing
                                 }: Props) {
    return (
        <Form>
            <FormTitle>
                {isEditing ? 'Task bearbeiten' : 'Neue Task'}
            </FormTitle>

            <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Task-Titel"
            />

            <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Beschreibung"
            />

            <Select
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

            <ButtonGroup>
                <SecondaryButton type="button" onClick={onCancel}>
                    Abbrechen
                </SecondaryButton>

                <Button type="button" onClick={onSave}>
                    {isEditing ? 'Aktualisieren' : 'Erstellen'}
                </Button>
            </ButtonGroup>
        </Form>
    );
}