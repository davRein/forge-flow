import styled from 'styled-components';

const Container = styled.nav`
    height: 50px;
    background: ${({ theme }) => theme.colors.header};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};

    display: flex;
    align-items: center;
    gap: 10px;

    padding: 0 20px;
`;

const NavItem = styled.button`
    background: transparent;
    border: none;
    color: ${({ theme }) => theme.colors.textSecondary};

    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;

    &:hover {
        background: ${({ theme }) => theme.colors.primary};
        color: ${({ theme }) => theme.colors.text};
    }
`;

type Props = {
    items: string[];
};

export default function Topbar({ items }: Props) {
    return (
        <Container>
            {items.map((item) => (
                <NavItem key={item}>{item}</NavItem>
            ))}
        </Container>
    );
}