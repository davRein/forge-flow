import { useTranslation } from '../../hooks/languageContext';
import styled from 'styled-components';
import { GuardedNavLink } from '../navigation/GuardedLink';
import { AppModule, ModuleKey } from '../../config/moduleConfig';

const Container = styled.nav`
    min-height: 52px;
    flex-shrink: 0;
    overflow-x: auto;
    background: ${({ theme }) => theme.colors.header};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};

    display: flex;
    align-items: center;
    gap: 22px;

    padding: 0 32px;
    @media (max-width: 760px) { padding-inline: 16px; gap: 16px; }
`;

const NavItem = styled(GuardedNavLink)`
    text-decoration: none;
    background: transparent;
    border: none;
    color: ${({ theme }) => theme.colors.textSecondary};

    display: inline-flex;
    align-items: center;
    align-self: stretch;
    padding: 14px 2px 12px;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;

    &:hover { color: ${({ theme }) => theme.colors.text}; }
    &.active { color: ${({ theme }) => theme.colors.primary}; border-bottom-color: ${({ theme }) => theme.colors.primary}; }
`;

type Props = {
    items: AppModule['topbarItems'];
    moduleKey: ModuleKey;
};

export default function Topbar({ items, moduleKey }: Props) {
    const { t, language } = useTranslation();
    return (
        <Container lang={language} aria-label={t('Modulnavigation')}>
            {items.map((item) => (
                <NavItem key={item.key} to={`/${moduleKey}/${item.key}`} state={{ projectOverview: true }}>{t(item.label)}</NavItem>
            ))}
        </Container>
    );
}
