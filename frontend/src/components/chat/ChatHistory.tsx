import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useTranslation } from '../../hooks/languageContext';
import type { ChatStore } from '../../services/ai/chatStore';
import type { ConversationList, ConversationSummary, ExecutionRecord } from '../../services/ai/chatRepository';
import { Action, Confirm, Note } from './chatStyles';

const Surface = styled.div`
    flex: 1; min-height: 0; overflow: auto; padding: 16px; font-size: 12px; line-height: 1.6;
    h3 { font-size: 15px; margin: 0 0 12px; } ul { list-style: none; margin: 12px 0; padding: 0; }
    li { padding: 12px 0; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
    .title { overflow-wrap: anywhere; display: block; font-weight: 600; }
    .buttons { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    small { color: ${({ theme }) => theme.colors.textSecondary}; }
    details { padding: 8px; margin-top: 8px; background: ${({ theme }) => theme.colors.content}; border-radius: 8px; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 10px; }
    summary { cursor: pointer; } .error { color: ${({ theme }) => theme.colors.danger}; }
`;
const statusNames = { running: 'Läuft', succeeded: 'Erfolgreich', failed: 'Fehlgeschlagen', cancelled: 'Abgebrochen', interrupted: 'Unterbrochen' };
const names: Record<string, string> = { list_projects: 'Projektübersicht lesen', get_project_summary: 'Projektstatus lesen', list_open_tasks: 'Offene Aufgaben lesen', propose_project_navigation: 'Navigation vorbereiten', read_workspace: 'Fachdaten lesen', propose_workspace_create: 'Anlage vorbereiten', propose_workspace_update: 'Änderung vorbereiten' };
export default function ChatHistory({ store, busy, onClose }: { store: ChatStore; busy: boolean; onClose: () => void }) {
    const { t, locale } = useTranslation();
    const [list, setList] = useState<ConversationList | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<ConversationSummary | null>(null);
    const [switching, setSwitching] = useState<ConversationSummary | null>(null);
    const [runs, setRuns] = useState<{ id: string; items: ExecutionRecord[] } | null>(null);
    const controller = useRef<AbortController | null>(null);
    const active = useRef(false);
    const showError = useCallback((reason: unknown) => { if (active.current) setError(reason instanceof Error ? reason.message : 'Unterhaltungen konnten nicht geladen werden.'); }, []);
    const load = useCallback(async (signal: AbortSignal) => {
        setLoading(true); setError(null);
        try { const value = await store.list(signal); if (!signal.aborted) setList(value); }
        catch (reason) { if (!signal.aborted) showError(reason); }
        finally { if (!signal.aborted) setLoading(false); }
    }, [store, showError]);
    useEffect(() => {
        active.current = true; const abort = new AbortController(); controller.current = abort;
        void load(abort.signal);
        return () => { active.current = false; abort.abort(); };
    }, [load]);
    async function open(item: ConversationSummary) {
        const opened = await store.openConversation(item.id);
        if (!active.current) return;
        if (opened) onClose(); else setError(store.getSnapshot().notice ?? 'Unterhaltung konnte nicht geöffnet werden.');
    }
    const disabled = busy || loading;
    const format = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));
    return <Surface aria-label={t('Unterhaltungen')}>
        <h3>{t('Unterhaltungen')}</h3>
        <div className="buttons"><Action type="button" disabled={busy} onClick={onClose}>{t('Zurück zum Chat')}</Action>
            <Action type="button" disabled={disabled} onClick={() => controller.current && void load(controller.current.signal)}>{t('Aktualisieren')}</Action></div>
        {loading && <p role="status">{t('Unterhaltungen werden geladen …')}</p>}
        {error && <p className="error" role="alert">{t(error)}</p>}
        {list && <Note>{t(list.storage === 'postgresql' ? 'In PostgreSQL gespeichert. Aufbewahrung bei Inaktivität: {days} Tage.' : 'Nur im Backend-Arbeitsspeicher verfügbar. Inaktivitätsfrist: {minutes} Minuten.',
            { days: Math.round(list.retentionSeconds / 86400), minutes: Math.round(list.retentionSeconds / 60) })}</Note>}
        {switching && <Confirm role="alert"><p>{t('Unterhaltung wechseln? Der ungesendete Entwurf wird verworfen.')}</p>
            <Action type="button" disabled={disabled} onClick={() => void open(switching)}>{t('Unterhaltung öffnen')}</Action>
            <Action type="button" onClick={() => setSwitching(null)}>{t('Abbrechen')}</Action></Confirm>}
        {deleting && <Confirm role="alert"><p>{t('Unterhaltung und Ausführungshistorie endgültig löschen?')}</p><strong>{deleting.title || t('Neue Unterhaltung')}</strong>
            <div className="buttons"><Action type="button" disabled={disabled} onClick={async () => {
                const signal = controller.current?.signal; if (!signal) return;
                try { if (await store.deleteConversation(deleting.id, signal)) { setDeleting(null); setRuns(null); await load(signal); } }
                catch (reason) { showError(reason); }
            }}>{t('Endgültig löschen')}</Action><Action type="button" onClick={() => setDeleting(null)}>{t('Abbrechen')}</Action></div></Confirm>}
        {list?.items.length === 0 && <p>{t('Noch keine Unterhaltungen vorhanden.')}</p>}
        <ul>{list?.items.map(item => <li key={item.id}>
            <span className="title">{item.title || t('Neue Unterhaltung')}</span><small>{format(item.updatedAt)} · {item.language.toUpperCase()} · {item.messageCount} {t('Nachrichten')}{item.busy && ` · ${t('Läuft')}`}</small>
            <div className="buttons">
                <Action type="button" disabled={disabled} onClick={() => { if (store.getSnapshot().draft.trim()) setSwitching(item); else void open(item); }}>{t('Unterhaltung öffnen')}</Action>
                <Action type="button" disabled={disabled} onClick={async () => {
                    const signal = controller.current?.signal; if (!signal) return;
                    setLoading(true); setError(null);
                    try { const items = await store.executions(item.id, signal); if (!signal.aborted) setRuns({ id: item.id, items }); }
                    catch (reason) { if (!signal.aborted) showError(reason); }
                    finally { if (!signal.aborted) setLoading(false); }
                }}>{t('Ausführungshistorie')}</Action>
                <Action type="button" disabled={disabled || item.busy} onClick={() => setDeleting(item)}>{t('Löschen')}</Action>
            </div>
            {runs?.id === item.id && <div aria-label={t('Ausführungshistorie')}>
                <Note>{t('Die letzten 50 Läufe. Unterbrochene Schritte werden nicht automatisch fortgesetzt.')}</Note>
                {runs.items.length === 0 && <p>{t('Keine Läufe vorhanden.')}</p>}
                {runs.items.map(run => <details key={run.id}><summary>{t(statusNames[run.status])} · {format(run.startedAt)} · {run.steps.length} {t('Werkzeugschritte')}</summary>
                    {run.errorCode && <p>{run.errorCode}</p>}
                    {run.steps.map(step => <div key={step.number}><p>{step.number}. {t(names[step.name])} · {t(step.status === 'completed' ? 'Abgeschlossen' : 'Begonnen')}{step.outcome && ` · ${step.outcome}`}</p><pre>{step.arguments}</pre></div>)}
                </details>)}
            </div>}
        </li>)}</ul>
    </Surface>;
}
