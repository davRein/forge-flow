import styled from 'styled-components';

import StatusBadge from './StatusBadge';

import { Project } from '../types/project.types';
import { getProjectStatus } from '../../../utils/getProjectStatus';

const Container = styled.button<{ $active: boolean }>`
    width: 100%;
    border: 1px solid transparent;
    border-left: 2px solid ${({ theme, $active }) => $active ? theme.colors.borderStrong : 'transparent'};
    cursor: pointer;

    min-height: 40px;
    padding: 8px 10px;
    border-radius: 4px;
    font-size: 13px;
    > div { min-width: 0; overflow-wrap: anywhere; }
    strong { font-weight: 500; }

    color: ${({ theme }) => theme.colors.text};
    text-align: left;

    background: ${({ $active, theme }) =>
    $active ? theme.colors.content : 'transparent'};

    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;

    &:hover {
        background: ${({ theme }) => theme.colors.surfaceHover};
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
        <Container type="button" $active={active} aria-pressed={active} onClick={onClick}>
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
