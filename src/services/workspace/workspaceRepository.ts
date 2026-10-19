import type { ApiClient } from '../api/apiClient';
import { decodeWorkspace } from './workspaceSchema.js';
import type { Workspace, WorkspaceManifest, WorkspaceRepository } from './workspaceTypes';
import { createInitialWorkspace } from './initialWorkspace.js';

export const localWorkspaceRepository: WorkspaceRepository = {
    persistence: 'session',
    async load() { return { data: createInitialWorkspace(), revision: 'local' }; },
    async save() { return 'local'; }
};

export function workspaceManifest(data: Workspace): WorkspaceManifest {
    return { ...data, files: data.files.map(({ content, ...file }) => ({ ...file, size: content.size, mediaType: content.type, lastModified: content.lastModified })) };
}

export function createApiWorkspaceRepository(client: ApiClient): WorkspaceRepository {
    const epoch = client.epoch;
    const uploaded = new WeakSet<File>();
    return {
        persistence: 'account',
        async load(signal) {
            const record = decodeWorkspace(await client.request('/workspace', { signal, epoch }));
            const files: Workspace['files'] = [];
            // Fetch bounded batches so large workspaces do not open one connection per attachment.
            for (let index = 0; index < record.data.files.length; index += 4) {
                const batch = await Promise.all(record.data.files.slice(index, index + 4).map(async (metadata) => {
                    const blob = await client.request<Blob>(`/projects/${metadata.projectId}/files/${metadata.id}/content`, { responseType: 'blob', signal, epoch });
                    if (blob.size !== metadata.size) throw new Error('Die Dateigröße stimmt nicht mit den gespeicherten Metadaten überein.');
                    const content = new File([blob], metadata.name, { type: metadata.mediaType, lastModified: metadata.lastModified });
                    uploaded.add(content);
                    return { id: metadata.id, projectId: metadata.projectId, name: metadata.name, addedAt: metadata.addedAt, updatedAt: metadata.updatedAt, content };
                }));
                files.push(...batch);
            }
            return { data: { ...record.data, files }, revision: record.revision };
        },
        async save(data, revision, signal) {
            const form = new FormData();
            form.append('manifest', JSON.stringify({ version: 1, revision, data: workspaceManifest(data) }));
            const incoming = data.files.filter((file) => !uploaded.has(file.content));
            for (const file of incoming) form.append(`file-${file.id}`, file.content, file.name);
            const result = await client.request<unknown>('/workspace', { method: 'PUT', body: form, headers: { 'If-Match': `"${revision}"` }, signal, epoch });
            if (!result || typeof result !== 'object' || !('revision' in result) || typeof result.revision !== 'string') throw new Error('Die Speicherbestätigung des Backends ist ungültig.');
            incoming.forEach((file) => uploaded.add(file.content));
            return result.revision;
        }
    };
}
