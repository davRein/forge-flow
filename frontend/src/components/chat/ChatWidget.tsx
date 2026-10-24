import { useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from '../../hooks/languageContext';
import { apiClient } from '../../services/api/runtime';
import { createChatRepository } from '../../services/ai/chatRepository';
import { createChatStore } from '../../services/ai/chatStore';
import type { ChatStore } from '../../services/ai/chatStore';
import ProjectToolResults from './ProjectToolResults';
import PageContextLabel from './PageContextLabel';
import { useChatPageContext } from '../../hooks/chatPageContext';
import { useChatNavigation } from '../../hooks/chatNavigationContext';
import NavigationActionCard from './NavigationActionCard';
import ChatHistory from './ChatHistory';
import WorkspaceCreationCard from './WorkspaceCreationCard';
import { WorkspaceContext } from '../../hooks/workspaceContext';
import { ACCOUNT_LIST_CHANGED_EVENT } from '../../services/auth/accountRepository';
import { Dock, Launcher, Panel, PanelHeader, IconButton, Transcript, Bubble, Welcome, Composer, Action, Note, Status, ErrorBox, Confirm } from './chatStyles';

function Spark() {
    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}
const noWorkspace = () => null;
const noSubscribe = () => () => {};

export default function ChatWidget({ store: suppliedStore }: { store?: ChatStore }) {
    const store = useMemo(() => suppliedStore ?? createChatStore(createChatRepository(apiClient)), [suppliedStore]);
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    const { t, language } = useTranslation();
    const page = useChatPageContext();
    const navigation = useChatNavigation();
    const workspace = useContext(WorkspaceContext);
    const workspaceState = useSyncExternalStore(workspace?.subscribe ?? noSubscribe, workspace?.getSnapshot ?? noWorkspace, noWorkspace);
    const creationBlocked = navigation.blocked || !workspaceState || workspaceState.status !== 'ready' || !!workspaceState.error;
    const [open, setOpen] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const input = useRef<HTMLTextAreaElement>(null);
    const launcher = useRef<HTMLButtonElement>(null);
    const transcript = useRef<HTMLDivElement>(null);
    const follow = useRef(true);
    const busy = state.status !== 'idle' || !!state.actionBusy;
    useEffect(() => { store.connect(); return () => store.dispose(); }, [store]);
    useEffect(() => { if (open) { input.current?.focus(); follow.current = true; } }, [open]);
    useEffect(() => {
        if (open && follow.current && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
    }, [open, state.messages.length, state.pending?.partial, state.pending?.tools]);
    const close = () => { setOpen(false); launcher.current?.focus(); };
    const send = () => { if (confirm) return; follow.current = true; void store.send(language, page); };
    const status = state.status === 'connecting' ? 'Verbindung wird aufgebaut …' : state.status === 'streaming' ? 'Antwort wird erstellt …'
        : state.status === 'stopping' ? 'Antwort wird gestoppt …' : state.status === 'loading' ? 'Verlauf wird geladen …' : state.actionBusy ? 'Aktion wird geprüft …' : 'Bereit';
    return <Dock lang={language}>
        {open && <Panel id="forgeflow-chat" role="region" aria-labelledby="forgeflow-chat-title" onKeyDown={event => {
            if (event.key === 'Escape') { event.stopPropagation(); close(); }
        }}>
            <PanelHeader>
                <span className="mark"><Spark /></span>
                <div><h2 id="forgeflow-chat-title">{t('KI-Assistent')}</h2><small>ForgeFlow</small></div>
                <IconButton type="button" disabled={busy} title={t('Unterhaltungen')} aria-label={t('Unterhaltungen')} onClick={() => { setHistoryOpen(value => !value); setConfirm(false); }}>≡</IconButton>
                <IconButton type="button" disabled={busy} title={t('Neue Unterhaltung')} aria-label={t('Neue Unterhaltung')}
                    onClick={() => { if (state.messages.length) setConfirm(true); else store.newConversation(); }}>＋</IconButton>
                <IconButton type="button" title={t('Chat schließen')} aria-label={t('Chat schließen')} onClick={close}>×</IconButton>
            </PanelHeader>
            {historyOpen ? <ChatHistory store={store} busy={busy} onClose={() => setHistoryOpen(false)} /> : <>
            {confirm && <Confirm role="alert">
                <p>{t('Neue Unterhaltung beginnen? Der bisherige Verlauf wird aus dieser Ansicht entfernt.')}</p>
                <Action type="button" onClick={() => { store.newConversation(); setConfirm(false); input.current?.focus(); }}>{t('Neue Unterhaltung')}</Action>
                <Action type="button" onClick={() => setConfirm(false)}>{t('Abbrechen')}</Action>
            </Confirm>}
            <Transcript ref={transcript} role="log" aria-label={t('Chatverlauf')} aria-live="polite" aria-relevant="additions" onScroll={() => {
                const element = transcript.current;
                if (element) follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 72;
            }}>
                {state.messages.length === 0 && !state.pending && <Welcome>
                    <span className="welcome-mark"><Spark /></span><h3>{t('Wie kann ich dir helfen?')}</h3>
                    <p>{t('Frage nach deinen gespeicherten Fachdaten. Neue Einträge lege ich nach deiner Bestätigung an.')}</p>
                </Welcome>}
                {state.messages.map(message => <Bubble key={message.id} $user={message.role === 'user'}>
                    <strong>{t(message.role === 'user' ? 'Du' : 'KI-Assistent')}</strong><div>{message.content}</div>
                    {message.role === 'user' && <PageContextLabel page={message.context} />}
                    {message.tools && <ProjectToolResults entries={message.tools} />}
                    {message.role === 'assistant' && message.tools?.map(tool => tool.result?.mutation && <WorkspaceCreationCard key={tool.result.mutation.id}
                        action={tool.result.mutation} busy={busy || state.remoteBusy} blocked={creationBlocked} error={state.actionErrors[tool.result.mutation.id]}
                        onDecision={(decision, initialPassword) => void store.decideCreation(tool.result!.mutation!.id, decision, () => !navigation.blocked && workspace?.getSnapshot().status === 'ready',
                            async () => { const refreshed = workspace ? await workspace.refreshExternal() : false;
                                if (tool.result!.mutation!.entity === 'users' && typeof window !== 'undefined') window.dispatchEvent(new Event(ACCOUNT_LIST_CHANGED_EVENT));
                                return refreshed; }, initialPassword)} />)}
                    {message.role === 'assistant' && message.tools?.map(tool => tool.result?.action && <NavigationActionCard key={tool.result.action.id}
                        action={tool.result.action} busy={busy || state.remoteBusy} available={navigation.available} blocked={navigation.blocked}
                        error={state.actionErrors[tool.result.action.id]}
                        onDecision={decision => void store.decide(tool.result!.action!.id, decision, navigation.execute)} />)}
                </Bubble>)}
                {state.pending && <div>
                    {state.pending.execution && <Note role="status">{t('Werkzeugschritte: {step} von höchstens {max}', { step: state.pending.execution.step, max: state.pending.execution.maxSteps })}
                        {' · '}{t({ thinking: 'Nächster Schritt wird geprüft …', reading: 'Daten werden gelesen …', answering: 'Antwort wird zusammengefasst …' }[state.pending.execution.phase])}</Note>}
                    <Bubble $user aria-hidden="true"><strong>{t('Du')}</strong><div>{state.pending.text}</div><PageContextLabel page={state.pending.context} /></Bubble>
                    <div aria-live="polite"><ProjectToolResults entries={state.pending.tools} /></div>
                    <Bubble $user={false} aria-hidden="true"><strong>{t('KI-Assistent')}</strong><div>{state.pending.partial || t('Einen Moment …')}</div><small>{t('Noch nicht bestätigt')}</small></Bubble>
                </div>}
            </Transcript>
            {state.remoteBusy && <ErrorBox $error={false} role="status"><p>{t('Für diese Unterhaltung läuft noch eine Anfrage. Verlauf nach Abschluss erneut laden.')}</p>
                <Action type="button" disabled={busy} onClick={() => void store.refresh()}>{t('Verlauf erneut laden')}</Action></ErrorBox>}
            {state.truncated && <Note>{t('Die Antwort hat das Ausgabelimit erreicht und kann unvollständig sein.')}</Note>}
            {state.notice && <ErrorBox $error={state.noticeKind === 'error'} role={state.noticeKind === 'error' ? 'alert' : 'status'}><p>{t(state.notice)}</p>
                <Action type="button" disabled={busy || !state.conversationLanguage} onClick={() => void store.refresh()}>{t('Verlauf erneut laden')}</Action>
            </ErrorBox>}
            <Composer onSubmit={event => { event.preventDefault(); send(); }}>
                <PageContextLabel page={page} />
                <label className="sr-only" htmlFor="forgeflow-chat-input">{t('Nachricht an den KI-Assistenten')}</label>
                <textarea id="forgeflow-chat-input" ref={input} value={state.draft} maxLength={4000} rows={3} disabled={busy || confirm}
                    placeholder={t('Schreibe eine Nachricht …')} onChange={event => store.setDraft(event.target.value)}
                    onKeyDown={event => {
                        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
                    }} />
                <div className="controls"><Status role="status" $busy={busy}><span aria-hidden="true" />{t(status)}</Status>
                    {busy && state.status !== 'loading' && !state.actionBusy ? <Action type="button" disabled={state.status === 'stopping'} onClick={() => void store.stop()}>{t('Stoppen')}</Action>
                        : <Action $primary type="submit" disabled={busy || state.remoteBusy || confirm || !state.draft.trim()}>{t('Senden')} <span aria-hidden="true">↑</span></Action>}
                </div>
                <Note>{t('KI kann Fehler machen. Antworten prüfen. Frühere Chats unter Unterhaltungen öffnen.')}
                    {state.conversationLanguage && state.conversationLanguage !== language && <span> {t('Für Antworten in der gewählten Sprache eine neue Unterhaltung beginnen.')}</span>}
                </Note>
                <Note>{t('Nachrichten, Seitenbezug und abgefragte Fachdaten werden an OpenAI übermittelt. Keine Passwörter oder Schlüssel in den Chat eingeben.')}</Note>
            </Composer>
            </>}
        </Panel>}
        <Launcher ref={launcher} type="button" aria-label={t(open ? 'Chat schließen' : 'KI-Assistent öffnen')} aria-expanded={open}
            aria-controls={open ? 'forgeflow-chat' : undefined} title={t(open ? 'Chat schließen' : 'KI-Assistent öffnen')}
            onClick={() => open ? close() : setOpen(true)}><Spark />{busy && <span className="busy" />}</Launcher>
    </Dock>;
}
