import styled, { keyframes } from 'styled-components';

const appear = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }`;
export const Dock = styled.div`
    position: fixed; bottom: max(24px, env(safe-area-inset-bottom)); right: 24px; z-index: 1100;
    @media (max-width: 560px) { right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); }
`;
export const Launcher = styled.button`
    width: 54px; height: 54px; border-radius: 18px; border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.primary}; color: ${({ theme }) => theme.colors.onPrimary};
    display: grid; place-items: center; cursor: pointer; box-shadow: ${({ theme }) => theme.shadows.raised}; position: relative;
    &:hover { background: ${({ theme }) => theme.colors.primaryHover}; }
    &:focus-visible { outline: 3px solid ${({ theme }) => theme.colors.primary}; outline-offset: 4px; }
    .busy { position: absolute; top: 0; right: 0; width: 12px; height: 12px; border-radius: 50%; background: ${({ theme }) => theme.colors.success}; border: 2px solid ${({ theme }) => theme.colors.content}; }
`;
export const Panel = styled.section`
    position: absolute; bottom: 70px; right: 0; width: min(430px, calc(100vw - 48px));
    height: min(660px, calc(100dvh - 180px)); min-height: 240px; display: flex; flex-direction: column; overflow: hidden;
    border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 18px; background: ${({ theme }) => theme.colors.header};
    color: ${({ theme }) => theme.colors.text}; box-shadow: ${({ theme }) => theme.shadows.overlay}; animation: ${appear} 150ms ease-out;
    @media (max-width: 560px) { width: calc(100vw - 24px); height: calc(100dvh - 164px); }
    @media (prefers-reduced-motion: reduce) { animation: none; }
    button, textarea { font: inherit; }
    button:disabled { opacity: .5; cursor: default; }
    button:focus-visible, textarea:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
`;
export const PanelHeader = styled.header`
    display: flex; align-items: center; gap: 10px; padding: 16px; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; flex-shrink: 0;
    .mark { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: ${({ theme }) => theme.colors.primarySubtle}; color: ${({ theme }) => theme.colors.primary}; }
    div { flex: 1; } h2 { margin: 0; font-size: 14px; font-weight: 650; } small { color: ${({ theme }) => theme.colors.textSecondary}; font-size: 11px; }
`;
export const IconButton = styled.button`
    width: 32px; height: 32px; border-radius: 8px; border: 0; background: transparent; color: ${({ theme }) => theme.colors.textSecondary}; cursor: pointer; font-size: 22px !important;
    &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; color: ${({ theme }) => theme.colors.text}; }
`;
export const Transcript = styled.div`flex: 1; min-height: 0; overflow-y: auto; padding: 18px; scroll-behavior: auto; overscroll-behavior: contain;`;
export const Bubble = styled.article<{ $user: boolean }>`
    padding: 12px 14px; border-radius: 12px; margin: 0 0 14px ${({ $user }) => $user ? '24px' : '0'};
    background: ${({ theme, $user }) => $user ? theme.colors.primarySubtle : theme.colors.content};
    border: 1px solid ${({ theme }) => theme.colors.border}; font-size: 13px; line-height: 1.65; overflow-wrap: anywhere;
    strong { display: block; font-size: 11px; margin-bottom: 5px; color: ${({ theme }) => theme.colors.textSecondary}; font-weight: 600; }
    div { white-space: pre-wrap; } small { font-size: 10px; color: ${({ theme }) => theme.colors.textSecondary}; }
`;
export const Welcome = styled.div`
    padding: 24px 6px; line-height: 1.65; color: ${({ theme }) => theme.colors.textSecondary}; font-size: 13px;
    .welcome-mark { display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 14px; color: ${({ theme }) => theme.colors.primary}; }
    h3 { color: ${({ theme }) => theme.colors.text}; font-size: 18px; line-height: 1.4; font-weight: 600; margin: 18px 0 10px; }
`;
export const Composer = styled.form`
    padding: 14px; border-top: 1px solid ${({ theme }) => theme.colors.border}; flex-shrink: 0;
    .page-reference { display: block; font-size: 11px; line-height: 1.5; color: ${({ theme }) => theme.colors.textSecondary}; margin-bottom: 8px; }
    textarea { box-sizing: border-box; width: 100%; resize: vertical; min-height: 68px; max-height: 140px; border-radius: 10px; border: 1px solid ${({ theme }) => theme.colors.borderStrong}; padding: 10px 12px; background: ${({ theme }) => theme.colors.content}; color: ${({ theme }) => theme.colors.text}; font-size: 13px; line-height: 1.5; }
    textarea::placeholder { color: ${({ theme }) => theme.colors.textSecondary}; }
    .controls { display: flex; align-items: center; justify-content: space-between; margin: 9px 0; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;
export const Action = styled.button<{ $primary?: boolean }>`
    display: inline-flex; gap: 12px; align-items: center; border-radius: 8px; padding: 7px 12px; cursor: pointer; font-size: 12px !important; font-weight: 600;
    border: 1px solid ${({ theme, $primary }) => $primary ? theme.colors.primary : theme.colors.border};
    color: ${({ theme, $primary }) => $primary ? theme.colors.onPrimary : theme.colors.text};
    background: ${({ theme, $primary }) => $primary ? theme.colors.primary : theme.colors.header};
    &:enabled:hover { background: ${({ theme, $primary }) => $primary ? theme.colors.primaryHover : theme.colors.surfaceHover}; }
`;
export const Note = styled.p`font-size: 10px; line-height: 1.5; color: ${({ theme }) => theme.colors.textSecondary}; margin: 5px 0 0;`;
export const Status = styled.span<{ $busy: boolean }>`
    display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: ${({ theme }) => theme.colors.textSecondary};
    span { width: 6px; height: 6px; border-radius: 50%; background: ${({ theme, $busy }) => $busy ? theme.colors.primary : theme.colors.success}; }
`;
export const ErrorBox = styled.div<{ $error: boolean }>`
    margin: 0 14px 10px; padding: 10px 12px; border: 1px solid ${({ theme, $error }) => $error ? theme.colors.dangerBorder : theme.colors.border}; border-radius: 10px; font-size: 12px; flex-shrink: 0;
    p { margin: 0 0 8px; line-height: 1.5; overflow-wrap: anywhere; }
`;
export const Confirm = styled.div`padding: 12px 16px; background: ${({ theme }) => theme.colors.primarySubtle}; font-size: 12px; p { margin: 0 0 10px; } button { margin-right: 6px; }`;
