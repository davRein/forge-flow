import { ApiError } from '../api/apiClient.js';
import type { ApiClient } from '../api/apiClient.js';
import { readEventStream } from './eventStream.js';
import { isAgentExecutionProgress, isProjectToolEvent } from './projectTools.js';
import type { AgentExecutionProgress, ProjectToolEvent } from './projectTools.js';
import { copyPageContext, isChatPageContext, samePageContext } from './pageContext.js';
import type { ChatPageContext } from './pageContext.js';
import { isNavigationAction, isUuid, sameNavigationTarget } from './navigationActions.js';
import type { NavigationAction, NavigationDecision, NavigationFailure } from './navigationActions.js';
import { isWorkspaceMutation, sameCreation } from './workspaceActions.js';
import type { WorkspaceMutation } from './workspaceActions.js';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; tools?: ProjectToolEvent[]; context?: ChatPageContext | null };
export type ChatConversation = { id: string; language: 'de' | 'en'; messages: ChatMessage[]; busy?: boolean };
export type ConversationSummary = { id: string; language: 'de' | 'en'; title: string; createdAt: string; updatedAt: string; messageCount: number; busy: boolean };
export type ConversationList = { storage: 'memory' | 'postgresql'; retentionSeconds: number; items: ConversationSummary[] };
export type ExecutionRecord = { id: string; requestId: string; status: 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted'; startedAt: string; finishedAt: string | null; errorCode: string | null;
    steps: { number: number; name: string; arguments: string; status: 'started' | 'completed'; outcome: string | null; startedAt: string; finishedAt: string | null }[] };
export type ChatTurn = { requestId: string; user: ChatMessage; assistant: ChatMessage; truncated: boolean };
export type ChatEvent = { kind: 'ready' } | { kind: 'delta'; text: string } | { kind: 'done'; turn: ChatTurn } | { kind: 'cancelled' } | { kind: 'tool'; tool: ProjectToolEvent }
    | { kind: 'execution'; execution: AgentExecutionProgress };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const invalid = () => new ApiError(502, 'AI_INVALID_RESPONSE', 'Der Antwortstream konnte nicht gelesen werden.');
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
function list(value: unknown): value is ConversationList {
    return record(value) && ['memory', 'postgresql'].includes(String(value.storage)) && typeof value.retentionSeconds === 'number'
        && Number.isSafeInteger(value.retentionSeconds) && value.retentionSeconds > 0 && value.retentionSeconds <= 365 * 86400
        && Array.isArray(value.items) && value.items.length <= 50 && value.items.every(item => record(item) && uuid(item.id) && ['de', 'en'].includes(String(item.language))
            && typeof item.title === 'string' && item.title.length <= 100 && date(item.createdAt) && date(item.updatedAt) && typeof item.busy === 'boolean'
            && typeof item.messageCount === 'number' && Number.isInteger(item.messageCount) && item.messageCount >= 0 && item.messageCount <= 100 && item.messageCount % 2 === 0);
}
function execution(value: unknown): value is ExecutionRecord {
    return record(value) && uuid(value.id) && uuid(value.requestId) && ['running', 'succeeded', 'failed', 'cancelled', 'interrupted'].includes(String(value.status))
        && date(value.startedAt) && (value.finishedAt === null || date(value.finishedAt)) && (value.errorCode === null || typeof value.errorCode === 'string' && /^[A-Z0-9_]{1,64}$/.test(value.errorCode))
        && Array.isArray(value.steps) && value.steps.length <= 6 && value.steps.every((step, index) => record(step) && step.number === index + 1
            && ['list_projects', 'get_project_summary', 'list_open_tasks', 'propose_project_navigation', 'read_workspace', 'propose_workspace_create', 'propose_workspace_update'].includes(String(step.name))
            && typeof step.arguments === 'string' && step.arguments.length <= 16000 && ['started', 'completed'].includes(String(step.status))
            && (step.outcome === null || ['OK', 'NOT_FOUND', 'AMBIGUOUS', 'INVALID_INPUT'].includes(String(step.outcome)))
            && date(step.startedAt) && (step.finishedAt === null || date(step.finishedAt)));
}
function message(value: unknown, role?: ChatMessage['role']): value is ChatMessage {
    return record(value) && uuid(value.id) && (value.role === 'user' || value.role === 'assistant') && (!role || role === value.role)
        && typeof value.content === 'string' && value.content.length <= (value.role === 'user' ? 4000 : 16000)
        && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
        && (value.context == null || value.role === 'user' && isChatPageContext(value.context))
        && (value.tools === undefined || (Array.isArray(value.tools) && value.tools.length <= (value.role === 'user' ? 0 : 6)
            && value.tools.every((tool, index, tools) => isProjectToolEvent(tool) && tool.status === 'completed'
                && tools.findIndex(other => record(other) && other.id === tool.id) === index
                && (tool.result?.action == null && tool.result?.mutation == null || index === tools.length - 1))));
}
function conversation(value: unknown): ChatConversation {
    if (!record(value) || !uuid(value.id) || !['de', 'en'].includes(String(value.language)) || !Array.isArray(value.messages)
        || value.busy !== undefined && typeof value.busy !== 'boolean' || value.messages.length > 100 || value.messages.length % 2 !== 0
        || !value.messages.every((item, index) => message(item, index % 2 === 0 ? 'user' : 'assistant'))) throw invalid();
    return value as ChatConversation;
}
export function createChatRepository(client: ApiClient) {
    const epoch = client.epoch;
    const path = (id: string) => { if (!uuid(id)) throw invalid(); return `/ai/conversations/${id}`; };
    return {
        async create(language: 'de' | 'en', signal: AbortSignal) {
            return conversation(await client.request('/ai/conversations', { method: 'POST', body: { language }, signal, epoch }));
        },
        async load(id: string, signal: AbortSignal) { return conversation(await client.request(path(id), { signal, epoch })); },
        async list(signal: AbortSignal) {
            const data = await client.request('/ai/conversations', { signal, epoch });
            if (!list(data)) throw invalid(); return data;
        },
        async remove(id: string, signal: AbortSignal) { await client.request(path(id), { method: 'DELETE', signal, epoch }); },
        async executions(id: string, signal: AbortSignal) {
            const data = await client.request(`${path(id)}/executions`, { signal, epoch });
            if (!Array.isArray(data) || data.length > 50 || !data.every(execution)) throw invalid(); return data as ExecutionRecord[];
        },
        async decide(id: string, action: NavigationAction, decisionId: string, decision: 'approve' | 'reject', signal: AbortSignal): Promise<NavigationDecision> {
            if (!isNavigationAction(action) || !isUuid(decisionId)) throw invalid();
            const data = await client.request(`${path(id)}/actions/${action.id}/decision`, { method: 'POST', epoch, signal, body: { decisionId, decision } });
            if (!record(data) || !isNavigationAction(data.action) || !sameNavigationTarget(action, data.action)
                || data.action.status !== (decision === 'approve' ? 'approved' : 'rejected')
                || !(decision === 'approve' ? isUuid(data.executionId) : data.executionId === null)) throw invalid();
            return { action: data.action, executionId: data.executionId as string | null };
        },
        async createRecord(id: string, action: WorkspaceMutation, decisionId: string, decision: 'approve' | 'reject', signal: AbortSignal, initialPassword?: string) {
            if (!isWorkspaceMutation(action) || !isUuid(decisionId)) throw invalid();
            const data = await client.request(`${path(id)}/creations/${action.id}/decision`, { method: 'POST', epoch, signal, body: { decisionId, decision, ...(initialPassword === undefined ? {} : { initialPassword }) } });
            if (!isWorkspaceMutation(data) || !sameCreation(action, data) || data.status !== (decision === 'approve' ? 'succeeded' : 'rejected')) throw invalid();
            return data;
        },
        async report(id: string, action: NavigationAction, executionId: string, status: 'succeeded' | 'failed', code: NavigationFailure | null, signal: AbortSignal) {
            if (!isNavigationAction(action) || !isUuid(executionId)) throw invalid();
            const data = await client.request(`${path(id)}/actions/${action.id}/result`, { method: 'POST', epoch, signal, body: { executionId, status, code } });
            if (!isNavigationAction(data) || !sameNavigationTarget(action, data) || data.status !== status || data.resultCode !== code) throw invalid();
            return data;
        },
        async cancel(id: string, requestId: string) {
            if (!uuid(requestId)) throw invalid();
            await client.request(`${path(id)}/requests/${requestId}/cancel`, { method: 'POST', epoch, timeoutMs: 5000 });
        },
        async send(id: string, requestId: string, text: string, signal: AbortSignal, receive: (event: ChatEvent) => void, context?: ChatPageContext | null) {
            if (context != null && !isChatPageContext(context)) throw new ApiError(400, 'AI_INVALID_PAGE_CONTEXT', 'Der Seitenkontext ist ungültig. Bitte die Seite neu öffnen.');
            await client.request(`${path(id)}/messages/stream`, { method: 'POST', epoch, signal, body: { requestId, message: text, ...(context == null ? {} : { context: copyPageContext(context) }) },
                responseType: 'stream', timeoutMs: 90000, consume: (body, streamSignal) => readEventStream(body, streamSignal, (event, data) => {
                    if (client.epoch !== epoch) throw new ApiError(401, 'STALE_SESSION', 'Diese Sitzung ist nicht mehr gültig.');
                    if (event === 'ping') return false;
                    if (!record(data)) throw invalid();
                    if (event === 'error') {
                        if (typeof data.code !== 'string' || typeof data.message !== 'string' || typeof data.status !== 'number') throw invalid();
                        throw new ApiError(data.status, data.code, data.message);
                    }
                    if (event === 'ready' && data.requestId === requestId) receive({ kind: 'ready' });
                    else if (event === 'execution' && isAgentExecutionProgress(data)) receive({ kind: 'execution', execution: data });
                    else if (event === 'tool' && isProjectToolEvent(data)) receive({ kind: 'tool', tool: data });
                    else if (event === 'delta' && typeof data.text === 'string' && data.text.length <= 16000) receive({ kind: 'delta', text: data.text });
                    else if (event === 'cancelled' && data.requestId === requestId) { receive({ kind: 'cancelled' }); return true; }
                    else if (event === 'done' && data.requestId === requestId && message(data.user, 'user') && message(data.assistant, 'assistant')
                        && data.user.content === text && samePageContext(data.user.context, context) && typeof data.truncated === 'boolean') {
                        receive({ kind: 'done', turn: data as ChatTurn }); return true;
                    } else throw invalid();
                    return false;
                }) });
        }
    };
}
type Repository = ReturnType<typeof createChatRepository>;
type OptionalMethods = 'decide' | 'report' | 'list' | 'remove' | 'executions' | 'createRecord';
export type ChatRepository = Omit<Repository, OptionalMethods> & Partial<Pick<Repository, OptionalMethods>>;
