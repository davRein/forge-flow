import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { control, secondaryButton, surface } from '../../../styles/primitives';

export { Field, Input, Select, PrimaryButton, SecondaryButton, DangerButton, ErrorText, FormActions, FormCard, FormGrid, Required } from '../../../components/ui/formStyles';

export const Page = styled.div`
    padding: 30px 32px 40px;
    max-width: 1400px;
    margin: 0 auto;
    @media (max-width: 760px) { padding: 22px 16px; }
`;

export const Toolbar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 28px;
`;

export const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
`;

export const Grid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    gap: 16px;
    margin: 20px 0;
`;

export const Card = styled.div`
    padding: 20px;
    min-width: 0;
    ${surface}
    overflow-wrap: anywhere;
    p { line-height: 1.6; }
`;

export const Muted = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
    margin: 12px 0;
`;

export const Textarea = styled.textarea`
    ${control}
    padding: 12px;
    min-height: 100px;
    resize: vertical;
    line-height: 1.6;
`;

export const TextLink = styled(Link)`
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    overflow-wrap: anywhere;
    &:hover { text-decoration: underline; }
`;

export const ButtonLink = styled(Link)`
    ${secondaryButton}
    display: inline-block;
    text-decoration: none;
`;

export const PrimaryLink = styled(ButtonLink)`
    color: ${({ theme }) => theme.colors.onPrimary};
    background: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
    &:hover { background: ${({ theme }) => theme.colors.primaryHover}; border-color: ${({ theme }) => theme.colors.primaryHover}; }
`;

export const Filters = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: end;
    margin-bottom: 16px;
    label:first-child { flex: 1; min-width: 180px; }
`;
