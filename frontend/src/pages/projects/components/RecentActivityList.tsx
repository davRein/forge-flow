import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import { useWorkspacePersistence } from '../../../hooks/workspaceContext';
import { useTranslation } from '../../../hooks/languageContext';
import { apiClient } from '../../../services/api/runtime';
import { decodeRecentActivity } from '../../../services/workspace/recentActivity';
import type { RecentActivityEntry } from '../../../services/workspace/recentActivity';
import { ErrorText, SecondaryButton } from '../../../components/ui/formStyles';

const History = styled.section`
    margin-top: 24px; padding: 16px;
    border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 8px;
    background: ${({ theme }) => theme.colors.header};
    h2 { margin: 0 0 12px; font-size: 16px; }
    p { color: ${({ theme }) => theme.colors.textSecondary}; font-size: 13px; }
    ol { list-style: none; margin: 0; padding: 0; }
    li + li { border-top: 1px solid ${({ theme }) => theme.colors.border}; }
    li > button { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 16px; width: 100%; padding: 12px 4px; border: 0; background: transparent; text-align: left; font: inherit; font-size: 13px; color: ${({ theme }) => theme.colors.text}; cursor: pointer; }
    li > button:hover:not(:disabled) { color: ${({ theme }) => theme.colors.primary}; }
    li > button:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
    li > button:disabled { opacity: .55; cursor: not-allowed; }
    span { overflow-wrap: anywhere; min-width: 0; }
    time { color: ${({ theme }) => theme.colors.textSecondary}; font-size: 12px; }
`;
export default function RecentActivityList({ onOpen, settingsStatus }: { onOpen: (entry: RecentActivityEntry) => void; settingsStatus: string }) {
    const { t, locale } = useTranslation(); const store = useWorkspacePersistence();
    const workspace = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const account = store.persistence === 'account';
    const [entries, setEntries] = useState<RecentActivityEntry[]>([]);
    const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [attempt, setAttempt] = useState(0);
    const epoch = useRef(apiClient.epoch);
    useEffect(() => {
        if (!account || workspace.status !== 'ready' || settingsStatus === 'saving') return;
        const controller = new AbortController(); setLoading(true); setError('');
        apiClient.request('/me/recent-activity', { signal: controller.signal, epoch: epoch.current }).then(value => {
            if (!controller.signal.aborted) setEntries(decodeRecentActivity(value));
        }).catch(() => { if (!controller.signal.aborted) setError('Die Historie konnte nicht geladen werden.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [account, workspace.status, workspace.saveNotice?.id, settingsStatus, attempt]);
    const current = account ? entries : workspace.recentActivity;
    return <History aria-label={t('Letzte Änderungen')}>
        <h2>{t('Letzte Änderungen')}</h2>
        {loading && <p role="status">{t('Historie wird geladen …')}</p>}
        {error && <><ErrorText role="alert">{t(error)}</ErrorText><SecondaryButton onClick={() => setAttempt(value => value + 1)}>{t('Erneut laden')}</SecondaryButton></>}
        {!loading && !error && current.length === 0 && <p>{t('Noch keine gespeicherten Änderungen vorhanden.')}</p>}
        <ol>{current.slice(0, 5).map(entry => {
            const available = entry.kind === 'settings' || workspace.data?.[entry.kind === 'project' ? 'projects' : 'customers'].some(value => value.id === entry.entityId);
            const label = entry.kind === 'settings' ? 'Einstellungen geändert' : entry.kind === 'project' ? entry.action === 'created' ? 'Projekt „{name}“ angelegt' : 'Projekt „{name}“ geändert' : entry.action === 'created' ? 'Kunde „{name}“ angelegt' : 'Kunde „{name}“ geändert';
            return <li key={entry.id}><button type="button" disabled={!available} onClick={() => onOpen(entry)}><span>{t(label, { name: entry.name })}</span><time dateTime={entry.at}>{new Date(entry.at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}</time></button></li>;
        })}</ol>
    </History>;
}
