import styled from 'styled-components';

import { ProjectTab } from '../types/projectTabs.types';

const Container = styled.div`
    display: flex;
    gap: 18px;
    overflow-x: auto;

    margin-top: 24px;

    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Tab = styled.button<{ $active: boolean }>`
    background: transparent;
    border: none;

    color: ${({ $active, theme }) =>
            $active ? theme.colors.primary : theme.colors.textSecondary};

    padding: 12px 2px;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;

    cursor: pointer;

    border-bottom: 2px solid
    ${({ $active, theme }) =>
            $active ? theme.colors.primary : 'transparent'};

    &:hover {
        color: ${({ theme }) => theme.colors.text};
    }
`;

type TabItem = {
    key: ProjectTab;
    label: string;
};

const tabs: TabItem[] = [
    { key: 'overview', label: 'Übersicht' },
    { key: 'board', label: 'Board' },
    { key: 'tickets', label: 'Tickets' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'epics', label: 'Epics' },
    { key: 'sprints', label: 'Sprints' },
    { key: 'files', label: 'Dateien' },
    { key: 'settings', label: 'Einstellungen' }
];

type Props = {
    activeTab: ProjectTab;
    onTabChange: (tab: ProjectTab) => void;
};

export default function ProjectTabs({
                                        activeTab,
                                        onTabChange
                                    }: Props) {
    return (
        <Container>
            {tabs.map((tab) => (
                <Tab
                    key={tab.key}
                    $active={tab.key === activeTab}
                    aria-current={tab.key === activeTab ? 'page' : undefined}
                    onClick={() => onTabChange(tab.key)}
                >
                    {tab.label}
                </Tab>
            ))}
        </Container>
    );
}
