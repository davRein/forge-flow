import { ApiError } from '../api/apiClient.js';
import type { ChatConversation, ChatEvent, ChatMessage, ChatRepository } from './chatRepository.js';
import type { AgentExecutionProgress, ProjectToolEvent } from './projectTools.js';
import { copyPageContext, samePageContext } from './pageContext.js';
import type { ChatPageContext } from './pageContext.js';
import { isNavigationAction, isUuid, NavigationError, sameNavigationTarget } from './navigationActions.js';
import type { NavigationAction, NavigationExecutor, NavigationFailure } from './navigationActions.js';
import { isWorkspaceMutation, sameCreation } from './workspaceActions.js';
import type { WorkspaceMutation } from './workspaceActions.js';

type State = { messages: ChatMessage[]; draft: string; pending: { text: string; partial: string; tools: ProjectToolEvent[]; context: ChatPageContext | null; execution: AgentExecutionProgress | null } | null;
    status: 'idle' | 'connecting' | 'streaming' | 'stopping' | 'loading'; notice: string | null; noticeKind: 'error' | 'info'; truncated: boolean; conversationLanguage: 'de' | 'en' | null;
    actionBusy: string | null; actionErrors: Record<string, string>; conversationId: string | null; remoteBusy: boolean };
export function createChatStore(repository: ChatRepository, requestId = () => crypto.randomUUID()) {
    let state: State = { messages: [], draft: '', pending: null, status: 'idle', notice: null, noticeKind: 'info', truncated: false, conversationLanguage: null, actionBusy: null, actionErrors: {}, conversationId: null, remoteBusy: false };
    let current: ChatConversation | null = null;
    let active: { id: string; text: string; controller: AbortController; cancelled: boolean; completed: boolean } | null = null;
    let disposed = false;
    let actionController: AbortController | null = null;
    let readController: AbortController | null = null;
    const listeners = new Set<() => void>();
    const update = (change: Partial<State>) => { if (!disposed) { state = { ...state, ...change }; listeners.forEach(listener => listener()); } };
    const errorText = (error: unknown) => error instanceof ApiError ? error.message : 'Der KI-Dienst ist derzeit nicht verfügbar. Bitte später erneut versuchen.';
    async function reconcile(signal: AbortSignal) {
        if (!current) return;
        const loaded = await repository.load(current.id, signal);
        if (disposed) return;
        current = loaded; update({ messages: loaded.messages, remoteBusy: loaded.busy ?? false, actionErrors: {} });
    }
    function replaceAction(action: NavigationAction) {
        const messages = state.messages.map(message => ({ ...message, tools: message.tools?.map(tool => tool.result?.action?.id === action.id
            ? { ...tool, result: { ...tool.result, action } } : tool) }));
        if (current) current = { ...current, messages };
        update({ messages });
    }
    function replaceCreation(action: WorkspaceMutation) {
        const messages = state.messages.map(message => ({ ...message, tools: message.tools?.map(tool => tool.result?.mutation?.id === action.id
            ? { ...tool, result: { ...tool.result, mutation: action } } : tool) }));
        if (current) current = { ...current, messages }; update({ messages });
    }
    return {
        connect() { disposed = false; },
        subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
        getSnapshot: () => state,
        setDraft(draft: string) { if (state.status === 'idle') update({ draft: draft.slice(0, 4000) }); },
        newConversation() {
            if (state.status !== 'idle' || state.actionBusy) return;
            current = null; update({ messages: [], pending: null, notice: null, truncated: false, conversationLanguage: null, actionErrors: {}, conversationId: null, remoteBusy: false });
        },
        async list(signal: AbortSignal) { if (!repository.list) throw new Error('History unavailable'); return repository.list(signal); },
        async executions(id: string, signal: AbortSignal) { if (!repository.executions) throw new Error('History unavailable'); return repository.executions(id, signal); },
        async openConversation(id: string) {
            if (disposed || state.status !== 'idle' || state.actionBusy) return false;
            const controller = new AbortController(); readController = controller;
            update({ status: 'loading', notice: null });
            try {
                const loaded = await repository.load(id, controller.signal);
                if (disposed || controller.signal.aborted) return false;
                current = loaded; update({ messages: loaded.messages, draft: '', pending: null, conversationId: loaded.id, conversationLanguage: loaded.language,
                    remoteBusy: loaded.busy ?? false, truncated: false, actionErrors: {} }); return true;
            } catch (error) { update({ notice: errorText(error), noticeKind: 'error' }); return false; }
            finally { if (readController === controller) { readController = null; update({ status: 'idle' }); } }
        },
        async deleteConversation(id: string, signal: AbortSignal) {
            if (disposed || state.status !== 'idle' || state.actionBusy || !repository.remove) return false;
            update({ status: 'loading' });
            try {
                await repository.remove(id, signal);
                if (disposed || signal.aborted) return false;
                if (current?.id === id) { current = null; update({ messages: [], draft: '', conversationId: null, conversationLanguage: null, remoteBusy: false, notice: null, actionErrors: {} }); }
                return true;
            } finally { update({ status: 'idle' }); }
        },
        async refresh() {
            if (state.status !== 'idle' || state.actionBusy || !current) return;
            update({ status: 'loading', notice: null });
            try { await reconcile(new AbortController().signal); }
            catch (error) { update({ notice: errorText(error), noticeKind: 'error' }); }
            finally { update({ status: 'idle' }); }
        },
        async send(language: 'de' | 'en', page?: ChatPageContext | null) {
            const text = state.draft.trim();
            if (!text || state.status !== 'idle' || state.actionBusy || state.remoteBusy || disposed) return;
            const context = copyPageContext(page);
            const run = { id: requestId(), text, controller: new AbortController(), cancelled: false, completed: false };
            const originalCount = state.messages.length;
            active = run;
            update({ status: 'connecting', draft: '', pending: { text, partial: '', tools: [], context, execution: null }, notice: null, truncated: false });
            let completed = false;
            try {
                if (!current) {
                    const created = await repository.create(language, run.controller.signal);
                    if (disposed || run.cancelled) return;
                    current = created; update({ conversationLanguage: current.language, messages: current.messages, conversationId: current.id });
                }
                await repository.send(current.id, run.id, text, run.controller.signal, (event: ChatEvent) => {
                    if (disposed || run.cancelled || run.completed || active !== run) return;
                    if (event.kind === 'ready') update({ status: 'streaming' });
                    if (event.kind === 'delta') {
                        const partial = (state.pending?.partial ?? '') + event.text;
                        if (partial.length > 16000) throw new ApiError(502, 'AI_INVALID_RESPONSE', 'Der Antwortstream konnte nicht gelesen werden.');
                        update({ status: 'streaming', pending: { text, partial, tools: state.pending?.tools ?? [], context, execution: state.pending?.execution ?? null } });
                    }
                    if (event.kind === 'execution' && state.pending) {
                        const { tools, execution: previous } = state.pending;
                        const next = event.execution;
                        if (tools.some(tool => tool.status === 'started') || previous && previous.maxSteps !== next.maxSteps
                            || next.step !== tools.length + (next.phase === 'reading' ? 1 : 0))
                            throw new ApiError(502, 'AI_INVALID_RESPONSE', 'Der Antwortstream konnte nicht gelesen werden.');
                        update({ pending: { ...state.pending, execution: next } });
                    }
                    if (event.kind === 'tool') {
                        const tools = state.pending?.tools ?? [];
                        const last = tools[tools.length - 1];
                        if ((event.tool.status === 'started' && (tools.length >= (state.pending?.execution?.maxSteps ?? 6)
                            || tools.some(tool => tool.id === event.tool.id || tool.status !== 'completed' || tool.result?.action != null || tool.result?.mutation != null)))
                            || (event.tool.status === 'completed' && (!last || last.status !== 'started' || last.id !== event.tool.id || last.name !== event.tool.name)))
                            throw new ApiError(502, 'AI_INVALID_RESPONSE', 'Der Antwortstream konnte nicht gelesen werden.');
                        update({ status: 'streaming', pending: { text, partial: state.pending?.partial ?? '',
                            tools: event.tool.status === 'started' ? [...tools, event.tool] : [...tools.slice(0, -1), event.tool], context, execution: state.pending?.execution ?? null } });
                    }
                    if (event.kind === 'done') {
                        const tools = state.pending?.tools ?? [];
                        if (tools.length > 0 && (tools.some(tool => tool.status !== 'completed') || tools.length !== event.turn.assistant.tools?.length
                            || tools.some((tool, index) => event.turn.assistant.tools?.[index].id !== tool.id || event.turn.assistant.tools?.[index].name !== tool.name)))
                            throw new ApiError(502, 'AI_INVALID_RESPONSE', 'Der Antwortstream konnte nicht gelesen werden.');
                        completed = true; run.completed = true;
                        const messages = [...state.messages, event.turn.user, event.turn.assistant];
                        if (current) current = { ...current, messages };
                        update({ messages, pending: null, truncated: event.turn.truncated });
                    }
                    if (event.kind === 'cancelled') update({ notice: 'Antwort abgebrochen. Teilantworten wurden verworfen.', noticeKind: 'info' });
                }, context);
            } catch (error) {
                if (!disposed && !run.cancelled) {
                    update({ notice: errorText(error), noticeKind: 'error' });
                    // Read only: recover a committed turn after a broken connection; never resend a paid request.
                    try {
                        await reconcile(new AbortController().signal);
                        completed = state.messages.slice(-2)[0]?.role === 'user' && state.messages.slice(-2)[0]?.content === text
                            && samePageContext(state.messages.slice(-2)[0]?.context, context)
                            && state.messages.length === originalCount + 2;
                    } catch { /* Keep the diagnostic and offer an explicit reload. */ }
                }
            } finally {
                if (active === run && !run.cancelled) {
                    active = null; update({ status: 'idle', pending: null, draft: completed ? '' : text });
                }
            }
        },
        async decide(actionId: string, decision: 'approve' | 'reject', execute: NavigationExecutor) {
            if (disposed || state.status !== 'idle' || state.actionBusy || state.remoteBusy || !current || !repository.decide || !repository.report) return;
            const action = state.messages.filter(message => message.role === 'assistant').flatMap(message => message.tools ?? [])
                .map(tool => tool.result?.action).find(item => item?.id === actionId);
            if (!action || !isNavigationAction(action) || action.status !== 'proposed') return;
            if (Date.parse(action.expiresAt) <= Date.now()) { replaceAction({ ...action, status: 'expired' }); return; }
            const controller = new AbortController(); actionController = controller;
            const conversationId = current.id;
            update({ actionBusy: action.id, actionErrors: { ...state.actionErrors, [action.id]: '' } });
            try {
                const grant = await repository.decide(conversationId, action, requestId(), decision, controller.signal);
                if (disposed || controller.signal.aborted) return;
                if (!isNavigationAction(grant.action) || !sameNavigationTarget(action, grant.action)
                    || grant.action.status !== (decision === 'approve' ? 'approved' : 'rejected')
                    || !(decision === 'approve' ? isUuid(grant.executionId) : grant.executionId === null)) throw new NavigationError('NAVIGATION_UNAVAILABLE');
                replaceAction(grant.action);
                if (decision === 'reject' || !grant.executionId) return;
                let code: NavigationFailure | null = null;
                try { await execute(grant.action, controller.signal); }
                catch (error) { code = error instanceof NavigationError ? error.code : 'NAVIGATION_UNAVAILABLE'; }
                if (disposed || controller.signal.aborted) return;
                const result = await repository.report(conversationId, grant.action, grant.executionId, code ? 'failed' : 'succeeded', code, controller.signal);
                if (disposed || controller.signal.aborted) return;
                if (!isNavigationAction(result) || !sameNavigationTarget(action, result) || result.status !== (code ? 'failed' : 'succeeded') || result.resultCode !== code)
                    throw new NavigationError('NAVIGATION_UNAVAILABLE');
                replaceAction(result);
            } catch {
                if (!disposed) {
                    // Never repeat approval or navigation after an uncertain response. Recover status by reading only.
                    try { await reconcile(controller.signal); } catch { /* Retain the visible proposal and diagnostic. */ }
                    update({ actionErrors: { ...state.actionErrors, [action.id]: 'Der Aktionsstatus ist unklar. Verlauf erneut laden oder einen neuen Vorschlag anfordern.' } });
                }
            } finally {
                if (actionController === controller) { actionController = null; update({ actionBusy: null }); }
            }
        },
        async decideCreation(actionId: string, decision: 'approve' | 'reject', allowed: () => boolean, synchronize: () => Promise<boolean>, initialPassword?: string) {
            if (disposed || state.status !== 'idle' || state.actionBusy || state.remoteBusy || !current || !repository.createRecord) return;
            const action = state.messages.flatMap(message => message.tools ?? []).map(tool => tool.result?.mutation).find(item => item?.id === actionId);
            if (!action || !isWorkspaceMutation(action) || action.status !== 'proposed') return;
            if (Date.parse(action.expiresAt) <= Date.now()) { replaceCreation({ ...action, status: 'expired' }); return; }
            if (decision === 'approve' && !allowed()) { update({ actionErrors: { ...state.actionErrors, [actionId]: 'Bitte Formulare speichern oder schließen und ausstehende Speicherungen abwarten.' } }); return; }
            const controller = new AbortController(); actionController = controller;
            const sync = async () => { try { return await synchronize(); } catch { return false; } };
            update({ actionBusy: actionId, actionErrors: { ...state.actionErrors, [actionId]: '' } });
            try {
                const result = await repository.createRecord(current.id, action, requestId(), decision, controller.signal, initialPassword);
                if (disposed || controller.signal.aborted) return;
                if (!isWorkspaceMutation(result) || !sameCreation(action, result) || result.status !== (decision === 'approve' ? 'succeeded' : 'rejected')) throw new Error('Invalid creation result');
                replaceCreation(result);
                if (result.status === 'succeeded' && !await sync() && !disposed) update({ notice: 'Der Eintrag wurde gespeichert. Bitte den Datenstand der Anwendung neu laden.', noticeKind: 'info' });
            } catch (error) {
                if (!disposed && !controller.signal.aborted) {
                    try { await reconcile(controller.signal); } catch { /* Read-only recovery; never repeat a creation POST automatically. */ }
                    const recovered = state.messages.flatMap(message => message.tools ?? []).find(tool => tool.result?.mutation?.id === actionId)?.result?.mutation;
                    if (recovered?.status === 'succeeded') await sync();
                    update({ actionErrors: { ...state.actionErrors, [actionId]: error instanceof ApiError ? error.message : 'Der Anlagestatus ist unklar. Verlauf erneut laden, bevor du einen neuen Vorschlag anforderst.' } });
                }
            } finally { if (actionController === controller) { actionController = null; update({ actionBusy: null }); } }
        },
        async stop() {
            const run = active;
            if (!run || run.cancelled || run.completed || disposed) return;
            run.cancelled = true; update({ status: 'stopping' });
            let notice = 'Antwort abgebrochen. Teilantworten wurden verworfen.';
            let uncertain = false;
            try { if (current) await repository.cancel(current.id, run.id); }
            catch { notice = 'Abbruch konnte nicht bestätigt werden. Bitte den Verlauf erneut laden.'; uncertain = true; }
            finally { run.controller.abort(); }
            const before = state.messages.length;
            try { await reconcile(new AbortController().signal); }
            catch { notice = 'Abbruch konnte nicht bestätigt werden. Bitte den Verlauf erneut laden.'; uncertain = true; }
            if (active === run) {
                active = null;
                update({ status: 'idle', pending: null, draft: state.messages.length > before ? '' : run.text,
                    noticeKind: uncertain ? 'error' : 'info',
                    notice: state.messages.length > before ? 'Die Antwort war bereits abgeschlossen.' : notice });
            }
        },
        dispose() {
            disposed = true; listeners.clear();
            actionController?.abort();
            readController?.abort();
            if (active) {
                active.cancelled = true; active.controller.abort();
                if (current) void repository.cancel(current.id, active.id).catch(() => {});
            }
        }
    };
}
export type ChatStore = ReturnType<typeof createChatStore>;
