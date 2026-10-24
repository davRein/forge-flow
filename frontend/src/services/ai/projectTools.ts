import { isNavigationAction } from './navigationActions.js';
import type { NavigationAction } from './navigationActions.js';
import { isWorkspaceMutation, workspaceEntities } from './workspaceActions.js';
import type { WorkspaceEntity, WorkspaceMutation } from './workspaceActions.js';
export type ProjectToolName = 'list_projects' | 'get_project_summary' | 'list_open_tasks' | 'propose_project_navigation' | 'read_workspace' | 'propose_workspace_create' | 'propose_workspace_update';
export type ProjectToolResult = {
    outcome: 'OK' | 'NOT_FOUND' | 'AMBIGUOUS' | 'INVALID_INPUT'; revision: string | null; readAt: string | null;
    projects: { id: number; name: string; planningCompleted: boolean; deadline: string; tasks: { todo: number; inProgress: number; done: number } }[];
    tasks: { id: number; code: string; title: string; status: 'todo' | 'inProgress'; priority: 'low' | 'medium' | 'high' }[];
    total: number; offset: number; more: boolean; textTruncated: boolean; action?: NavigationAction | null;
    workspace?: { entity: WorkspaceEntity; mode: 'count' | 'list' | 'detail'; textOffset: number; items: { id: number | string; label: string; fields: Record<string, string> }[]; message: string | null } | null;
    mutation?: WorkspaceMutation | null;
};
export type ProjectToolEvent = { id: string; name: ProjectToolName; status: 'started' | 'completed'; result: ProjectToolResult | null };
export type AgentExecutionProgress = { phase: 'thinking' | 'reading' | 'answering'; step: number; maxSteps: number };
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
export function isAgentExecutionProgress(value: unknown): value is AgentExecutionProgress {
    return record(value) && Object.keys(value).length === 3 && ['thinking', 'reading', 'answering'].includes(String(value.phase))
        && integer(value.maxSteps, 1, 6) && integer(value.step, value.phase === 'reading' ? 1 : 0, value.maxSteps)
        && (value.phase !== 'thinking' || value.step < value.maxSteps);
}
function result(value: unknown): value is ProjectToolResult {
    if (!record(value) || !['OK', 'NOT_FOUND', 'AMBIGUOUS', 'INVALID_INPUT'].includes(String(value.outcome))
        || !(value.revision === null || text(value.revision, 128)) || !(value.readAt === null || (text(value.readAt, 64) && Number.isFinite(Date.parse(value.readAt))))
        || !Array.isArray(value.projects) || value.projects.length > 10 || !Array.isArray(value.tasks) || value.tasks.length > 10
        || !integer(value.total, 0, record(value.workspace) && value.workspace.entity === 'users' ? 2147483647 : 10000) || !integer(value.offset, 0, 10000) || typeof value.more !== 'boolean' || typeof value.textTruncated !== 'boolean'
        || !(value.action == null || isNavigationAction(value.action)) || !(value.mutation == null || isWorkspaceMutation(value.mutation))
        || value.action != null && value.mutation != null) return false;
    if (value.workspace != null) {
        const view = value.workspace;
        if (!record(view) || !workspaceEntities.includes(view.entity as WorkspaceEntity) || !['count', 'list', 'detail'].includes(String(view.mode))
            || !integer(view.textOffset, 0, 1000000) || !(view.message === null || text(view.message, 1000)) || !Array.isArray(view.items) || view.items.length > 10
            || !view.items.every(item => record(item) && (integer(item.id, 1, Number.MAX_SAFE_INTEGER) || text(item.id, 128) && item.id.length > 0) && text(item.label, 200)
                && record(item.fields) && Object.keys(item.fields).length <= 20 && Object.values(item.fields).every(value => text(value, 2000)))) return false;
    }
    if (value.outcome !== 'INVALID_INPUT' && (value.revision === null || value.readAt === null)) return false;
    return value.projects.every(project => record(project) && integer(project.id, 1, Number.MAX_SAFE_INTEGER) && text(project.name, 200)
        && typeof project.planningCompleted === 'boolean' && text(project.deadline, 32) && record(project.tasks)
        && ['todo', 'inProgress', 'done'].every(key => integer((project.tasks as Record<string, unknown>)[key], 0, 10000)))
        && value.tasks.every(task => record(task) && integer(task.id, 1, Number.MAX_SAFE_INTEGER) && text(task.code, 40) && text(task.title, 200)
            && ['todo', 'inProgress'].includes(String(task.status)) && ['low', 'medium', 'high'].includes(String(task.priority)));
}
export function isProjectToolEvent(value: unknown): value is ProjectToolEvent {
    if (!record(value) || !text(value.id, 36) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)
        || !['list_projects', 'get_project_summary', 'list_open_tasks', 'propose_project_navigation', 'read_workspace', 'propose_workspace_create', 'propose_workspace_update'].includes(String(value.name))) return false;
    return value.status === 'started' ? value.result === null : value.status === 'completed' && result(value.result)
        && (value.result.action == null || value.name === 'propose_project_navigation' && value.result.outcome === 'OK')
        && (value.result.mutation == null || value.name === (value.result.mutation.type === 'workspace.update' ? 'propose_workspace_update' : 'propose_workspace_create') && value.result.outcome === 'OK');
}
