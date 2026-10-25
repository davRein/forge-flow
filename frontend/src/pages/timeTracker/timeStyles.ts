import styled from 'styled-components';
import { surface } from '../../styles/primitives';

export const Page = styled.div`
    max-width: 1200px; margin: 0 auto; padding: 24px 28px 40px;
    h1 { font-size: 24px; margin: 0; } h2 { font-size: 16px; margin: 0; }
    .muted { color: ${({ theme }) => theme.colors.textSecondary}; font-size: 12px; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
    .actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
    .filters { display: flex; flex-wrap: wrap; gap: 12px; margin: 18px 0; }
    .filters label { flex: 1; min-width: min(180px, 100%); }
    .week { font-size: 14px; font-weight: 600; }
    button { font-size: 13px; } .error { color: ${({ theme }) => theme.colors.danger}; }
    @media (max-width: 760px) { padding: 22px 16px; }
`;
export const Summary = styled.div`
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 20px 0;
    > div { ${surface} padding: 14px 16px; min-width: 0; }
    span { display: block; color: ${({ theme }) => theme.colors.textSecondary}; font-size: 12px; margin-bottom: 5px; }
    strong { font-size: 20px; font-variant-numeric: tabular-nums; }
    @media (max-width: 580px) { gap: 6px; > div { padding: 12px 8px; } strong { font-size: 16px; } }
`;
export const Calendar = styled.div`
    display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; align-items: stretch;
    @media (max-width: 1100px) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    @media (max-width: 760px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    @media (max-width: 460px) { grid-template-columns: minmax(0, 1fr); }
`;
export const Day = styled.section<{ $today: boolean }>`
    ${surface} min-width: 0; min-height: 220px; padding: 10px;
    border-color: ${({ theme, $today }) => $today ? theme.colors.primary : theme.colors.border};
    > header { display: flex; justify-content: space-between; gap: 6px; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
    h2 { font-size: 12px; line-height: 1.6; } time { display: block; }
    .day-total { font-size: 12px; font-weight: 600; color: ${({ theme }) => theme.colors.textSecondary}; font-variant-numeric: tabular-nums; }
    .add { border: 0; background: transparent; color: ${({ theme }) => theme.colors.primary}; border-radius: 4px; width: 26px; height: 28px; padding: 0; font-size: 20px; cursor: pointer; }
    .add:hover { background: ${({ theme }) => theme.colors.primarySubtle}; } .add:disabled { opacity: .4; cursor: not-allowed; }
    .empty { color: ${({ theme }) => theme.colors.textSecondary}; font-size: 12px; padding: 18px 0; }
`;
export const Booking = styled.button<{ $billable: boolean }>`
    display: block; width: 100%; margin-top: 10px; padding: 10px 8px; border: 1px solid ${({ theme }) => theme.colors.border};
    border-left: 3px solid ${({ theme, $billable }) => $billable ? theme.colors.primary : theme.colors.borderStrong};
    border-radius: 5px; background: ${({ theme }) => theme.colors.content}; color: ${({ theme }) => theme.colors.text}; text-align: left; cursor: pointer; overflow-wrap: anywhere;
    &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; border-color: ${({ theme }) => theme.colors.borderStrong}; }
    &:disabled { cursor: wait; opacity: .6; }
    strong, span { display: block; } strong { font-size: 12px; margin: 6px 0 3px; line-height: 1.4; }
    .range, .note, .project, .billable { font-size: 11px; line-height: 1.5; color: ${({ theme }) => theme.colors.textSecondary}; }
    .duration { font-size: 13px; margin-top: 7px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .note { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 6px; white-space: pre-wrap; }
`;
export const Report = styled.div`
    ${surface} overflow-x: auto;
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; overflow-wrap: anywhere; }
    th { font-size: 12px; color: ${({ theme }) => theme.colors.textSecondary}; background: ${({ theme }) => theme.colors.content}; }
    tr:last-child td { border-bottom: 0; } td:nth-last-child(-n+2) { white-space: nowrap; font-variant-numeric: tabular-nums; }
`;
export const ToastViewport = styled.div`
    position: fixed; right: 96px; bottom: 24px; z-index: 1300; width: min(380px, calc(100vw - 110px));
`;
