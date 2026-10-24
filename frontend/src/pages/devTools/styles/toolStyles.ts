import styled from 'styled-components';
import { control, surface } from '../../../styles/primitives';

export { Field, Input, Select, PrimaryButton, SecondaryButton, DangerButton, ErrorText, FormGrid } from '../../../components/ui/formStyles';

export const Page = styled.div`
    padding: 24px 28px 32px;
    max-width: 1160px;
    margin: 0 auto;
    min-width: 0;
    @media (max-width: 760px) { padding: 22px 16px; }
    h1 { margin-bottom: 8px; font-size: 24px; letter-spacing: -.4px; }
    h2 { margin-bottom: 10px; font-size: 16px; }
    button { min-height: 30px; padding: 5px 10px; font-size: 12px; }
    input, select { min-height: 32px; padding: 5px 8px; font-size: 12px; }
    label { font-size: 12px; }
`;

export const Card = styled.section`
    padding: 16px;
    margin: 16px 0;
    min-width: 0;
    ${surface}
    border-radius: 8px;
    box-shadow: none;
    overflow-wrap: anywhere;
`;

export const Columns = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    @media (max-width: 1000px) { grid-template-columns: minmax(0, 1fr); }
`;

export const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px;
    margin: 12px 0;
`;

export const Muted = styled.p`
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.5;
    font-size: 12px;
    margin: 8px 0;
`;

export const Textarea = styled.textarea`
    ${control}
    width: 100%;
    min-width: 0;
    min-height: 160px;
    padding: 10px;
    resize: vertical;
    tab-size: 4;
    line-height: 1.6;
    font-family: 'Cascadia Code', 'SFMono-Regular', Consolas, monospace;
    font-size: 12px;
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
