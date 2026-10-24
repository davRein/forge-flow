import styled from 'styled-components';

import ProjectListItem from './ProjectListItem';

import { Project } from '../types/project.types';

const Container = styled.div`
    min-width: 0;
`;

type Props = {
    projects: Project[];
    selectedProjectId: number;
    onSelectProject: (projectId: number) => void;
};

export default function ProjectList({
                                        projects,
                                        selectedProjectId,
                                        onSelectProject
                                    }: Props) {
    return (
        <Container>
            {projects.map((project) => (
                <ProjectListItem
                    key={project.id}
                    project={project}
                    active={project.id === selectedProjectId}
                    onClick={() => onSelectProject(project.id)}
                />
            ))}
        </Container>
    );
}
