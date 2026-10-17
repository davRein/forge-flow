import styled from 'styled-components';

import { taskPriorities } from '../../../../../data/taskPriorities';
import { taskStatuses } from '../../../../../data/taskStatuses';

import { Task } from '../../../types/task.types';

const Backdrop = styled.div`
    position: fixed;
    inset: 0;

    background: rgba(0, 0, 0, 0.45);

    z-index: 200;
`;

const Drawer = styled.aside`
    position: fixed;
    top: 0;
    right: 0;

    width: 440px;
    height: 100vh;

    background: ${({ theme }) => theme.colors.header};
    border-left: 1px solid ${({ theme }) => theme.colors.border};

    padding: 24px;

    z-index: 201;
`;

const Header = styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
`;

const Code = styled.div`
    color: ${({ theme }) => theme.colors.primary};

    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.5px;
`;

const Title = styled.h2`
    margin-top: 6px;
`;

const CloseButton = styled.button`
    border: none;
    background: transparent;

    color: #ef4444;

    cursor: pointer;

    font-size: 28px;
    line-height: 1;
`;

const Section = styled.section`
    margin-top: 24px;
`;

const SectionTitle = styled.h4`
    margin-bottom: 10px;
`;

const Description = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};

    line-height: 1.5;
`;

const MetaGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
`;

const MetaBox = styled.div`
    background: ${({ theme }) => theme.colors.content};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 10px;

    padding: 12px;
`;

const Label = styled.div`
    color: ${({ theme }) => theme.colors.textSecondary};

    font-size: 12px;
    margin-bottom: 6px;
`;

const Badge = styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;

    padding: 5px 9px;
    border-radius: 999px;

    font-size: 12px;
    font-weight: 700;

    color: ${({ $color }) => $color};
    background: ${({ $color }) => `${$color}20`};

    border: 1px solid ${({ $color }) => `${$color}55`};
`;

type Props = {
    task: Task;
    onClose: () => void;
};

export default function TaskDrawer({ task, onClose }: Props) {
    const taskStatus = taskStatuses[task.status];
    const taskPriority = taskPriorities[task.priority];

    return (
        <>
            <Backdrop onClick={onClose} />

            <Drawer>
                <Header>
                    <div>
                        <Code>{task.code}</Code>
                        <Title>{task.title}</Title>
                    </div>

                    <CloseButton onClick={onClose}>
                        ×
                    </CloseButton>
                </Header>

                <Section>
                    <SectionTitle>Beschreibung</SectionTitle>

                    <Description>
                        {task.description || 'Keine Beschreibung vorhanden.'}
                    </Description>
                </Section>

                <Section>
                    <SectionTitle>Details</SectionTitle>

                    <MetaGrid>
                        <MetaBox>
                            <Label>Status</Label>
                            <Badge $color={taskStatus.color}>
                                {taskStatus.label}
                            </Badge>
                        </MetaBox>

                        <MetaBox>
                            <Label>Priorität</Label>
                            <Badge $color={taskPriority.color}>
                                {taskPriority.label}
                            </Badge>
                        </MetaBox>

                        <MetaBox>
                            <Label>Erstellt</Label>
                            {task.createdAt}
                        </MetaBox>

                        <MetaBox>
                            <Label>Aktualisiert</Label>
                            {task.updatedAt}
                        </MetaBox>
                    </MetaGrid>
                </Section>
            </Drawer>
        </>
    );
}