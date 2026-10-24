import styled from 'styled-components';
import { getBadgeTextColor } from '../../../../../styles/colorUtils';
import { useDraggable } from '@dnd-kit/core';

import { taskPriorities } from '../../../../../data/taskPriorities';
import { taskStatuses } from '../../../../../data/taskStatuses';

import { Task } from '../../../types/task.types';

const Card = styled.div<{ $isDragging?: boolean }>`
    background: ${({ theme }) => theme.colors.header};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 14px;

    opacity: ${({ $isDragging }) => ($isDragging ? 0.55 : 1)};
    cursor: pointer;

    transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;

    &:hover {
        border-color: ${({ theme }) => theme.colors.primary};
        box-shadow: ${({ theme }) => theme.shadows.raised};
    }
`;

const Header = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
`;

const Left = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 10px;
`;

const DragHandle = styled.button`
    border: none;
    background: transparent;

    color: ${({ theme }) => theme.colors.textSecondary};

    cursor: grab;

    font-size: 16px;
    line-height: 1;

    padding: 0;
    margin-top: 2px;

    &:active {
        cursor: grabbing;
    }
`;

const TitleWrapper = styled.div`
    display: flex;
    flex-direction: column;
`;

const Code = styled.span`
    color: ${({ theme }) => theme.colors.primary};

    font-size: 12px;
    font-weight: 600;

    letter-spacing: 0.5px;
`;

const Title = styled.strong`
    display: block;
    margin-top: 4px;

    line-height: 1.35;
`;

const Actions = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;

    flex-shrink: 0;
`;

const EditButton = styled.button`
    border: none;
    background: transparent;

    color: ${({ theme }) => theme.colors.primary};

    cursor: pointer;

    font-size: 16px;

    &:hover {
        opacity: 0.8;
    }
`;

const DeleteButton = styled.button`
    border: none;
    background: transparent;

    color: ${({ theme }) => theme.colors.danger};

    cursor: pointer;

    font-size: 18px;

    &:hover {
        color: ${({ theme }) => theme.colors.dangerHover};
    }
`;

const Description = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};

    margin-top: 8px;
    margin-bottom: 0;

    font-size: 14px;
    line-height: 1.4;

    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;

    overflow: hidden;
`;

const Meta = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    margin-top: 12px;
`;

const Badge = styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;

    padding: 5px 9px;
    border-radius: 4px;

    font-size: 11px;
    font-weight: 600;

    color: ${({ $color, theme }) => getBadgeTextColor($color, theme.mode)};

    background: ${({ $color }) => `${$color}20`};

    border: 1px solid ${({ $color }) => `${$color}55`};
`;

const Footer = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 10px;

    margin-top: 12px;
    padding-top: 10px;

    border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const DateText = styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};

    font-size: 11px;
`;

type Props = {
    task: Task;
    onDelete: () => void;
    onEdit: () => void;
    onOpen: () => void;
};

export default function TaskCard({
                                     task,
                                     onDelete,
                                     onEdit,
                                     onOpen
                                 }: Props) {

    const taskStatus =
        taskStatuses[task.status];

    const taskPriority =
        taskPriorities[task.priority];

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        isDragging
    } = useDraggable({
        id: task.id
    });

    const style = transform
        ? {
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`
        }
        : undefined;

    return (
        <Card
            ref={setNodeRef}
            style={style}
            $isDragging={isDragging}
            onClick={onOpen}
        >

            <Header>

                <Left>

                    <DragHandle
                        aria-label={`Aufgabe ${task.code} verschieben`}
                        {...listeners}
                        {...attributes}
                        onClick={(event) =>
                            event.stopPropagation()
                        }
                    >
                        ⋮⋮
                    </DragHandle>

                    <TitleWrapper>

                        <Code>
                            {task.code}
                        </Code>

                        <Title>
                            {task.title}
                        </Title>

                    </TitleWrapper>

                </Left>

                <Actions>

                    <EditButton
                        aria-label={`Aufgabe ${task.code} bearbeiten`}
                        onClick={(event) => {
                            event.stopPropagation();
                            onEdit();
                        }}
                    >
                        ✎
                    </EditButton>

                    <DeleteButton
                        aria-label={`Aufgabe ${task.code} löschen`}
                        onClick={(event) => {
                            event.stopPropagation();
                            onDelete();
                        }}
                    >
                        ×
                    </DeleteButton>

                </Actions>

            </Header>

            {task.description && (
                <Description>
                    {task.description}
                </Description>
            )}

            <Meta>

                <Badge $color={taskStatus.color}>
                    {taskStatus.label}
                </Badge>

                <Badge $color={taskPriority.color}>
                    {taskPriority.label}
                </Badge>

            </Meta>

            <Footer>

                <DateText>
                    Created: {task.createdAt}
                </DateText>

                <DateText>
                    Updated: {task.updatedAt}
                </DateText>

            </Footer>

        </Card>
    );
}
