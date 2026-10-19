import styled from 'styled-components';
import { AppModule, ModuleKey } from '../../config/moduleConfig';

const Container = styled.aside`
    width: ${({ theme }) => theme.layout.sidebarWidth};
    background: ${({ theme }) => theme.colors.sidebar};
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    padding: 20px;
`;

const NavItem = styled.button<{ $active: boolean }>`
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 10px;
    text-align: left;

    color: ${({ theme, $active }) => $active ? theme.colors.onPrimary : theme.colors.text};
    background: ${({ $active, theme }) =>
    $active ? theme.colors.primary : 'transparent'};

    &:hover {
        background: ${({ theme }) => theme.colors.primary};
        color: ${({ theme }) => theme.colors.onPrimary};
    }
`;

type Props = {
    modules: AppModule[];
    activeModule: ModuleKey;
    onModuleChange: (moduleKey: ModuleKey) => void;
};

export default function Sidebar({ modules, activeModule, onModuleChange }: Props) {
    return (
        <Container>
            {modules.map((module) => (
                <NavItem
                    key={module.key}
                    $active={module.key === activeModule}
                    aria-current={module.key === activeModule ? 'page' : undefined}
                    onClick={() => onModuleChange(module.key)}
                >
                    {module.label}
                </NavItem>
            ))}
        </Container>
    );
}
