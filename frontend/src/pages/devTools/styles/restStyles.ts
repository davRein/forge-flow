import styled from 'styled-components';

export const RestLayout = styled.div`
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
    margin-top: 16px;
    > div { min-width: 0; }
    > div > section { margin-top: 0; }
    @media (max-width: 850px) { grid-template-columns: minmax(0, 1fr); }
`;
export const Library = styled.aside`
    padding: 12px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 8px;
    background: ${({ theme }) => theme.colors.header};
    min-width: 0;
    h2 { font-size: 13px; margin: 0; }
    header { display: flex; justify-content: space-between; gap: 6px; align-items: center; margin-bottom: 10px; }
    > input { width: 100%; }
    ul { list-style: none; padding: 0; margin: 8px 0; }
    ul ul { border-left: 1px solid ${({ theme }) => theme.colors.border}; padding-left: 7px; margin-left: 5px; }
    .collection-row { display: flex; align-items: center; gap: 3px; min-width: 0; margin-top: 8px; }
    .collection-row > button:first-child { flex: 1; min-width: 0; text-align: left; overflow-wrap: anywhere; }
    button { border: 1px solid transparent; border-radius: 4px; background: transparent; color: ${({ theme }) => theme.colors.textSecondary}; cursor: pointer; padding: 5px; font: inherit; font-size: 12px; }
    button:hover:not(:disabled), button[aria-current='page'] { background: ${({ theme }) => theme.colors.surfaceHover}; color: ${({ theme }) => theme.colors.text}; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .request { display: flex; width: 100%; gap: 7px; align-items: baseline; text-align: left; padding: 7px 5px; }
    .request span:first-child { font-size: 10px; font-family: monospace; min-width: 40px; color: ${({ theme }) => theme.colors.primary}; }
    .request span:last-child { min-width: 0; overflow-wrap: anywhere; }
    .request-row { display: flex; align-items: center; }
    .collection-list { max-height: 60dvh; overflow: auto; }
`;
export const RequestLine = styled.div`
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: end;
    label { min-width: 0; }
    input, select { width: 100%; }
    @media (max-width: 580px) { grid-template-columns: 85px minmax(0, 1fr); > button { grid-column: 1 / -1; justify-self: end; } }
`;
export const RequestHeader = styled.div`
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: 14px;
    h2 { margin: 0; font-size: 14px; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
`;
export const RequestTabs = styled.div`
    display: flex;
    gap: 14px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    margin: 16px 0 12px;
    button { padding: 7px 1px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: transparent; color: ${({ theme }) => theme.colors.textSecondary}; cursor: pointer; font: inherit; font-size: 12px; }
    button[aria-selected='true'] { border-bottom-color: ${({ theme }) => theme.colors.primary}; color: ${({ theme }) => theme.colors.text}; }
`;
export const ToastPosition = styled.div`
    position: fixed;
    right: 24px;
    bottom: 24px;
    width: min(390px, calc(100vw - 32px));
    z-index: 1200;
`;
