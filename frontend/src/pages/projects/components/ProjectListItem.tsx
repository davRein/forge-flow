import styled from 'styled-components';

import StatusBadge from './StatusBadge';

import { Project } from '../types/project.types';
import { getProjectStatus } from '../../../utils/getProjectStatus';

const Container = styled.button<{ $active: boolean }>`
    width: 100%;
    border: 1px solid ${({ theme, $active }) => $active ? theme.colors.primary : 'transparent'};
    cursor: pointer;

    padding: 14px;
    margin-bottom: 8px;
    border-radius: 8px;

    color: ${({ theme }) => theme.colors.text};

    background: ${({ $active, theme }) =>
    $active ? `${theme.colors.primary}15` : 'transparent'};

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    &:hover {
        background: ${({ theme }) => `${theme.colors.primary}25`};
    }
`;

type Props = {
    project: Project;
    active: boolean;
    onClick: () => void;
};

export default function ProjectListItem({
                                            project,
                                            active,
                                            onClick
                                        }: Props) {

    const status = getProjectStatus(project);

    return (
        <Container $active={active} onClick={onClick}>
            <div>
                <strong>{project.name}</strong>
            </div>

            <StatusBadge
                label={status.label}
                color={status.color}
                pulse={status.pulse}
            />
        </Container>
    );
}
