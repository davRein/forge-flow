import styled from 'styled-components';
import { Link } from 'react-router-dom';

export { Field, Input, Select, PrimaryButton, SecondaryButton, DangerButton, ErrorText, FormActions, FormCard, FormGrid, Required } from '../../../components/ui/formStyles';

export const Page = styled.div`
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
`;

export const Toolbar = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 20px;
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
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;
    background: ${({ theme }) => theme.colors.header};
    overflow-wrap: anywhere;
    p { line-height: 1.6; }
`;

export const Muted = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
    margin: 12px 0;
`;

export const Textarea = styled.textarea`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    padding: 12px;
    min-height: 100px;
    resize: vertical;
    background: ${({ theme }) => theme.colors.content};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.6;
`;

export const TextLink = styled(Link)`
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: none;
    overflow-wrap: anywhere;
    &:hover { text-decoration: underline; }
`;

export const ButtonLink = styled(Link)`
    display: inline-block;
    padding: 10px 14px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    text-decoration: none;
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.header};
`;

export const PrimaryLink = styled(ButtonLink)`
    color: ${({ theme }) => theme.colors.onPrimary};
    background: ${({ theme }) => theme.colors.primary};
    border-color: ${({ theme }) => theme.colors.primary};
`;

export const Filters = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: end;
    margin-bottom: 16px;
    label:first-child { flex: 1; min-width: 180px; }
`;
