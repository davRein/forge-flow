import styled from 'styled-components';
import { surface, control } from '../../styles/primitives';
export const Page = styled.div`
    max-width: 1180px; padding: 24px 28px 40px; margin: 0 auto;
    h1 { font-size: 24px; margin: 0 0 8px; } h2 { font-size: 17px; margin: 0 0 12px; } h3 { font-size: 14px; }
    .muted { color: ${({ theme }) => theme.colors.textSecondary}; font-size: 12px; line-height: 1.6; }
    .toolbar, .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; } .toolbar { justify-content: space-between; margin-bottom: 18px; }
    .error { color: ${({ theme }) => theme.colors.danger}; } .success { color: ${({ theme }) => theme.colors.success}; }
    button { font-size: 13px; } .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    @media (max-width: 760px) { padding: 20px 16px; .grid { grid-template-columns: minmax(0, 1fr); } }
`;
export const Panel = styled.section`${surface} padding: 18px; min-width: 0; margin-bottom: 16px; overflow-wrap: anywhere; p { line-height: 1.6; }`;
export const Textarea = styled.textarea`${control} min-height: 90px; resize: vertical;`;
export const TableFrame = styled.div`
    ${surface} overflow-x: auto; margin: 14px 0;
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 11px 13px; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; overflow-wrap: anywhere; }
    th { font-size: 12px; color: ${({ theme }) => theme.colors.textSecondary}; background: ${({ theme }) => theme.colors.content}; }
    tr:last-child td { border: 0; } .number { white-space: nowrap; font-variant-numeric: tabular-nums; }
`;
export const Meter = styled.progress`
    width: 100%; height: 8px; accent-color: ${({ theme }) => theme.colors.primary}; border: 0; margin-top: 8px;
`;
