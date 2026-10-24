import { useTranslation } from '../../hooks/languageContext';
import styled from 'styled-components';
import { AppModule, ModuleKey } from '../../config/moduleConfig';
import ModuleIcon from './ModuleIcon';

const Container = styled.aside`
    width: ${({ theme }) => theme.layout.sidebarWidth};
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.sidebar};
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    padding: 26px 14px 18px;
    @media (max-width: 760px) { width: 68px; padding-inline: 10px; }
`;

const Label = styled.p`
    margin: 0 12px 14px;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 11px;
    font-weight: 650;
    letter-spacing: 0.9px;
    text-transform: uppercase;
    @media (max-width: 760px) { display: none; }
`;

const Footer = styled.div`
    margin-top: auto;
    padding: 16px 12px 0;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 12px;
    @media (max-width: 760px) { display: none; }
`;

const NavItem = styled.button<{ $active: boolean }>`
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 42px;
    padding: 10px 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 6px;
    text-align: left;

    font-weight: ${({ $active }) => $active ? 600 : 450};
    color: ${({ theme, $active }) => $active ? theme.colors.primary : theme.colors.textSecondary};
    background: ${({ $active, theme }) =>
    $active ? theme.colors.primarySubtle : 'transparent'};

    &:hover {
        background: ${({ theme, $active }) => $active ? theme.colors.primarySubtle : theme.colors.surfaceHover};
        color: ${({ theme, $active }) => $active ? theme.colors.primary : theme.colors.text};
    }
    svg { flex-shrink: 0; }
    @media (max-width: 760px) { justify-content: center; padding-inline: 8px; span { display: none; } }
`;

type Props = {
    modules: AppModule[];
    activeModule: ModuleKey;
    onModuleChange: (moduleKey: ModuleKey) => void;
};

export default function Sidebar({ modules, activeModule, onModuleChange }: Props) {
    const { t, language } = useTranslation();
    return (
        <Container lang={language} aria-label={t('Module')}>
            <Label>{t('Arbeitsbereich')}</Label>
            {modules.map((module) => (
                <NavItem
                    key={module.key}
                    $active={module.key === activeModule}
                    aria-current={module.key === activeModule ? 'page' : undefined}
                    aria-label={t(module.label)}
                    title={t(module.label)}
                    onClick={() => onModuleChange(module.key)}
                >
                    <ModuleIcon moduleKey={module.key} /><span>{t(module.label)}</span>
                </NavItem>
            ))}
            <Footer>{t('Projekte. Wissen. Werkzeuge.')}</Footer>
        </Container>
    );
}
