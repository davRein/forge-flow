import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import { useTranslation } from '../../hooks/languageContext';

const appear = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
`;
const Card = styled.div<{ $kind: 'success' | 'error' }>`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-left: 3px solid ${({ theme, $kind }) => $kind === 'success' ? theme.colors.success : theme.colors.danger};
    border-radius: 12px;
    background: ${({ theme }) => theme.colors.header};
    color: ${({ theme }) => theme.colors.text};
    box-shadow: ${({ theme }) => theme.shadows.overlay};
    pointer-events: auto;
    max-height: calc(100dvh - 96px);
    overflow: auto;
    animation: ${appear} 180ms ease-out;
    @media (prefers-reduced-motion: reduce) { animation: none; }
`;
const Icon = styled.span<{ $kind: 'success' | 'error' }>`
    display: grid;
    place-items: center;
    flex: 0 0 32px;
    height: 32px;
    border-radius: 50%;
    color: ${({ theme, $kind }) => $kind === 'success' ? theme.colors.success : theme.colors.danger};
    background: ${({ theme, $kind }) => $kind === 'success' ? theme.colors.successSubtle : theme.colors.surfaceHover};
`;
const Body = styled.div`
    flex: 1;
    min-width: 0;
    padding-top: 5px;
    font-size: 13px;
    line-height: 1.55;
    overflow-wrap: anywhere;
    > strong { display: block; font-size: 14px; line-height: 22px; font-weight: 650; }
    p { margin: 8px 0 0; color: ${({ theme }) => theme.colors.textSecondary}; }
`;
const Close = styled.button`
    display: grid;
    place-items: center;
    flex: 0 0 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;
    &:hover { color: ${({ theme }) => theme.colors.text}; background: ${({ theme }) => theme.colors.surfaceHover}; }
    &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
`;

export function SaveToast({ kind, title, children, onDismiss }: {
    kind: 'success' | 'error'; title: string; children?: ReactNode; onDismiss?: () => void;
}) {
    const { t } = useTranslation();
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    useEffect(() => {
        if (kind !== 'success' || !onDismiss || hovered || focused) return;
        const timeout = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timeout);
    }, [kind, onDismiss, hovered, focused]);

    return <Card $kind={kind} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)} onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}>
        <Icon $kind={kind} aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d={kind === 'success' ? 'M5 12.5 9.5 17 19 7' : 'M12 7v6m0 4h.01'} />
            </svg>
        </Icon>
        <Body><strong>{title}</strong>{children}</Body>
        {onDismiss && <Close type="button" aria-label={t('Benachrichtigung schließen')} onClick={onDismiss}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </Close>}
    </Card>;
}
