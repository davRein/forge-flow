import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useWorkspacePersistence } from '../hooks/workspaceContext';
import { useTranslation } from '../hooks/languageContext';
import { useNavigationGuard } from '../hooks/navigationGuard';
import { globalSearch } from '../services/workspace/globalSearch';
import Dialog from './ui/Dialog';
import { Input, SecondaryButton } from './ui/formStyles';
const Result = styled.button`
    width: 100%; text-align: left; border: 0; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; padding: 12px 4px; background: transparent; color: ${({ theme }) => theme.colors.text}; cursor: pointer;
    &:hover, &:focus-visible { background: ${({ theme }) => theme.colors.surfaceHover}; } strong, small { display: block; } small { color: ${({ theme }) => theme.colors.textSecondary}; margin-top: 4px; }
`;
export default function GlobalSearch() {
    const { t } = useTranslation(); const workspace = useWorkspacePersistence(); const guard = useNavigationGuard(); const navigate = useNavigate();
    const [open, setOpen] = useState(false), [query, setQuery] = useState('');
    useEffect(() => { if (typeof window === 'undefined') return; const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen(true); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
    const data = workspace.getSnapshot().data; const results = data ? globalSearch(data, query) : [];
    return <><SecondaryButton type="button" aria-label={t('Globale Suche')} onClick={() => setOpen(true)}>⌕ <span>{t('Suchen')}</span> <kbd>Ctrl K</kbd></SecondaryButton>
        {open && <Dialog title={t('Globale Suche')} onClose={() => setOpen(false)} width={640}><Input type="search" autoFocus maxLength={200} aria-label={t('Kunden, Projekte, Aufgaben und Seiten suchen')} value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Mindestens zwei Zeichen eingeben …')} style={{ width: '100%' }} />
            <div role="status" style={{ fontSize: 12, margin: '10px 0' }}>{query.trim().length < 2 ? t('Durchsuche deinen gesamten Arbeitsbereich.') : `${results.length} ${t('Treffer')}`}</div>
            {results.map(result => <Result key={result.key} onClick={() => guard.request(() => { setOpen(false); navigate(result.path); })}><strong>{result.title}</strong><small>{t(result.kind)} · {result.detail}</small></Result>)}
        </Dialog>}
    </>;
}
