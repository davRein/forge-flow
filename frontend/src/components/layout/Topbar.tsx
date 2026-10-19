import styled from 'styled-components';
import { NavLink } from 'react-router-dom';
import { AppModule, ModuleKey } from '../../config/moduleConfig';

const Container = styled.nav`
    height: 50px;
    background: ${({ theme }) => theme.colors.header};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};

    display: flex;
    align-items: center;
    gap: 10px;

    padding: 0 20px;
`;

const NavItem = styled(NavLink)`
    text-decoration: none;
    background: transparent;
    border: none;
    color: ${({ theme }) => theme.colors.textSecondary};

    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;

    &.active, &:hover {
        background: ${({ theme }) => theme.colors.primary};
        color: ${({ theme }) => theme.colors.onPrimary};
    }
`;

type Props = {
    items: AppModule['topbarItems'];
    moduleKey: ModuleKey;
};

export default function Topbar({ items, moduleKey }: Props) {
    return (
        <Container>
            {items.map((item) => (
                <NavItem key={item.key} to={`/${moduleKey}/${item.key}`}>{item.label}</NavItem>
            ))}
        </Container>
    );
}
