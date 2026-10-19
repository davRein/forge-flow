import styled from 'styled-components';

export { Field, Input, Select, PrimaryButton, SecondaryButton, DangerButton, ErrorText, FormGrid } from '../../../components/ui/formStyles';

export const Page = styled.div`
    padding: 24px;
    max-width: 1440px;
    margin: 0 auto;
    min-width: 0;
    h1 { margin-bottom: 12px; }
    h2 { margin-bottom: 16px; font-size: 20px; }
`;

export const Card = styled.section`
    padding: 20px;
    margin: 20px 0;
    min-width: 0;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;
    background: ${({ theme }) => theme.colors.header};
    overflow-wrap: anywhere;
`;

export const Columns = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    @media (max-width: 1000px) { grid-template-columns: minmax(0, 1fr); }
`;

export const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 16px 0;
`;

export const Muted = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.6;
    margin: 12px 0;
`;

export const Textarea = styled.textarea`
    width: 100%;
    min-width: 0;
    min-height: 200px;
    padding: 12px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.content};
    color: ${({ theme }) => theme.colors.text};
    resize: vertical;
    tab-size: 4;
    line-height: 1.6;
    font-family: Consolas, 'Courier New', monospace;
`;

export const Result = styled.pre`
    padding: 16px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.content};
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.6;
    margin: 12px 0;
`;

export const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    th, td { padding: 10px; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; text-align: left; overflow-wrap: anywhere; }
    th { color: ${({ theme }) => theme.colors.textSecondary}; }
`;

export const Keypad = styled.div`
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    max-width: 440px;
    margin-top: 16px;
    button { min-height: 44px; }
`;
