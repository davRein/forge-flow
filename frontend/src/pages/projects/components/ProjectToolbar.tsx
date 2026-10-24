import { useEffect, useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from '../../../hooks/languageContext';
import { control } from '../../../styles/primitives';

const Bar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    min-height: 43px;
    padding: 5px 10px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surfaceHover};
    border-radius: 7px 7px 0 0;
`;
const Action = styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 30px;
    padding: 5px 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    font-size: 12px;
    font-weight: 500;
    line-height: 1.4;
    cursor: pointer;
    &:hover, &[aria-expanded='true'] { background: ${({ theme }) => theme.colors.header}; border-color: ${({ theme }) => theme.colors.border}; }
    svg { width: 16px; height: 16px; flex-shrink: 0; }
`;
const Search = styled.div`
    display: flex;
    align-items: center;
    min-width: 0;
    border-left: 1px solid ${({ theme }) => theme.colors.border};
    padding-left: 4px;
`;
const SearchReveal = styled.div<{ $open: boolean }>`
    width: ${({ $open }) => $open ? '240px' : '0'};
    opacity: ${({ $open }) => $open ? 1 : 0};
    overflow: hidden;
    transition: width var(--motion-normal) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
    @media (max-width: 560px) { width: ${({ $open }) => $open ? 'min(150px, 37vw)' : '0'}; }
    @media (prefers-reduced-motion: reduce) { transition: none; }
`;
const SearchInput = styled.input`
    ${control}
    width: 100%;
    min-width: 0;
    min-height: 30px;
    height: 30px;
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 4px;
`;
const Count = styled.span`
    margin-left: auto;
    padding: 4px 6px;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
`;

type Props = { query: string; onQueryChange: (query: string) => void; onNew: () => void; count: number; total: number };

export default function ProjectToolbar({ query, onQueryChange, onNew, count, total }: Props) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(!!query);
    const inputId = useId();
    const input = useRef<HTMLInputElement>(null);
    const toggle = useRef<HTMLButtonElement>(null);
    useEffect(() => { if (expanded) input.current?.focus(); }, [expanded]);

    function closeSearch() { setExpanded(false); onQueryChange(''); toggle.current?.focus(); }
    const searchLabel = t(expanded ? 'Projektsuche schließen' : 'Projektsuche öffnen');
    return <Bar role="group" aria-label={t('Projektaktionen')}>
        <Action type="button" onClick={onNew} title={t('Neues Projekt')} aria-label={t('Neues Projekt')}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7h18M12 11v6m-3-3h6" />
            </svg><span>{t('Neu')}</span>
        </Action>
        <Search role="search" aria-label={t('Projekte suchen')}>
            <Action ref={toggle} type="button" title={searchLabel} aria-label={searchLabel} aria-expanded={expanded} aria-controls={inputId}
                onClick={() => { if (expanded) closeSearch(); else setExpanded(true); }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
            </Action>
            <SearchReveal $open={expanded} aria-hidden={!expanded}>
                <SearchInput ref={input} id={inputId} type="search" disabled={!expanded} tabIndex={expanded ? 0 : -1} aria-label={t('Projekte suchen')} placeholder={t('Projektname oder Kunde')}
                    value={query} onChange={event => onQueryChange(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch(); } }} />
            </SearchReveal>
        </Search>
        <Count role="status" aria-live="polite" aria-label={t('{count} von {total} Projekten', { count, total })}>{count} / {total}</Count>
    </Bar>;
}
