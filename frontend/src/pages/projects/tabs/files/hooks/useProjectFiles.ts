import { useEffect, useRef } from 'react';
import { useWorkspaceField } from '../../../../../hooks/workspaceContext';
import type { useTasks } from '../../tasks/hooks/useTasks';
import { addProjectFiles, removeProjectFile, renameProjectFile } from '../utils/fileLogic';

type Download = { projectId: number; fileId: number; timer: number };

export function useProjectFiles(projectId: number, taskState: ReturnType<typeof useTasks>) {
    const [fileList, setFileList] = useWorkspaceField('files');
    const nextId = useRef(Math.max(0, ...fileList.map((file) => file.id)) + 1);
    const downloads = useRef(new Map<string, Download>());
    const projectFiles = fileList.filter((file) => file.projectId === projectId);

    useEffect(() => {
        const activeDownloads = downloads.current;
        return () => {
            for (const [url, download] of activeDownloads) {
                window.clearTimeout(download.timer);
                URL.revokeObjectURL(url);
            }
            activeDownloads.clear();
        };
    }, []);

    function releaseDownloads(matches: (download: Download) => boolean) {
        for (const [url, download] of downloads.current) {
            if (!matches(download)) continue;
            window.clearTimeout(download.timer);
            URL.revokeObjectURL(url);
            downloads.current.delete(url);
        }
    }

    function addFiles(incoming: File[]) {
        const result = addProjectFiles(fileList, projectId, incoming, nextId.current, new Date().toISOString());
        nextId.current = result.nextId;
        setFileList(result.files);
        for (const file of result.added) taskState.addActivity('file_added', `Datei „${file.name}“ wurde hinzugefügt`);
        return { addedCount: result.added.length, rejected: result.rejected };
    }

    function renameFile(id: number, name: string): string | null {
        const result = renameProjectFile(fileList, projectId, id, name, new Date().toISOString());
        if (result.error) return result.error;
        setFileList(result.files);
        if (result.changed) taskState.addActivity('file_renamed', `Datei „${projectFiles.find((file) => file.id === id)!.name}“ wurde in „${name.trim()}“ umbenannt`);
        return null;
    }

    function removeFile(id: number): string | null {
        const result = removeProjectFile(fileList, projectId, id);
        if (result.error) return result.error;
        const file = projectFiles.find((entry) => entry.id === id)!;
        releaseDownloads((download) => download.fileId === id && download.projectId === projectId);
        setFileList(result.files);
        taskState.addActivity('file_removed', `Datei „${file.name}“ wurde entfernt`);
        return null;
    }

    function downloadFile(id: number): string | null {
        const file = projectFiles.find((entry) => entry.id === id);
        if (!file) return 'Diese Datei ist nicht mehr in diesem Projekt vorhanden.';
        let url: string | undefined;
        let link: HTMLAnchorElement | undefined;
        try {
            url = URL.createObjectURL(file.content);
            link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            const objectUrl = url;
            const timer = window.setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
                downloads.current.delete(objectUrl);
            }, 1000);
            downloads.current.set(url, { projectId, fileId: file.id, timer });
            return null;
        } catch {
            if (url) URL.revokeObjectURL(url);
            return 'Der Download konnte nicht gestartet werden. Bitte erneut versuchen.';
        } finally {
            link?.remove();
        }
    }

    function removeProjectFiles(deletedProjectId: number) {
        releaseDownloads((download) => download.projectId === deletedProjectId);
        setFileList((current) => current.filter((file) => file.projectId !== deletedProjectId));
    }

    return { projectFiles, addFiles, renameFile, removeFile, downloadFile, removeProjectFiles };
}
