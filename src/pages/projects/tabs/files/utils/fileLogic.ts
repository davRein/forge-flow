import type { FileCategory, FileRejection, ProjectFile } from '../../../types/file.types';

function nameKey(name: string) {
    return name.trim().normalize('NFC').toLocaleLowerCase('de');
}

export function validateFileName(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed || trimmed === '.' || trimmed === '..') return 'Bitte einen gültigen Dateinamen angeben.';
    if (trimmed.includes('/') || trimmed.includes('\\') || [...trimmed].some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
    })) return 'Dateinamen dürfen keine Pfadtrenner oder Steuerzeichen enthalten.';
    return null;
}

export function splitFileName(name: string) {
    const dot = name.lastIndexOf('.');
    return dot > 0 ? { stem: name.slice(0, dot), extension: name.slice(dot) } : { stem: name, extension: '' };
}

export function formatFileSize(bytes: number) {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
    return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${units[unit]}`;
}

export function getFileCategory(file: ProjectFile): FileCategory {
    const extension = splitFileName(file.name).extension.toLowerCase();
    if (file.content.type.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif', '.ico'].includes(extension)) return 'image';
    if (['.zip', '.7z', '.rar', '.gz', '.tar', '.bz2', '.xz'].includes(extension)) return 'archive';
    if (['.js', '.ts', '.jsx', '.tsx', '.json', '.html', '.css', '.scss', '.py', '.sh', '.sql', '.xml', '.yaml', '.yml', '.java', '.cs', '.php', '.go', '.rs'].includes(extension)) return 'code';
    if (file.content.type.startsWith('text/') || file.content.type === 'application/pdf'
        || ['.pdf', '.txt', '.md', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.ppt', '.pptx', '.odt', '.ods', '.rtf'].includes(extension)) return 'document';
    return 'other';
}

export function addProjectFiles(files: ProjectFile[], projectId: number, incoming: File[], nextId: number, now: string) {
    const names = new Set(files.filter((file) => file.projectId === projectId).map((file) => nameKey(file.name)));
    const added: ProjectFile[] = [];
    const rejected: FileRejection[] = [];
    let id = nextId;
    for (const content of incoming) {
        const reason = projectId <= 0 ? 'Bitte zuerst ein Projekt auswählen.' : validateFileName(content.name);
        if (reason) { rejected.push({ name: content.name, reason }); continue; }
        const key = nameKey(content.name);
        if (names.has(key)) {
            rejected.push({ name: content.name, reason: 'Dieser Dateiname ist bereits im Projekt vorhanden. Die vorhandene Datei kann zuerst umbenannt werden.' });
            continue;
        }
        names.add(key);
        added.push({ id: id++, projectId, name: content.name.trim(), content, addedAt: now, updatedAt: now });
    }
    return { files: [...files, ...added], added, rejected, nextId: id };
}

export function renameProjectFile(files: ProjectFile[], projectId: number, id: number, name: string, now: string) {
    const previous = files.find((file) => file.id === id && file.projectId === projectId);
    if (!previous) return { files, error: 'Diese Datei ist nicht mehr in diesem Projekt vorhanden.', changed: false };
    const error = validateFileName(name);
    if (error) return { files, error, changed: false };
    const trimmed = name.trim();
    if (files.some((file) => file.projectId === projectId && file.id !== id && nameKey(file.name) === nameKey(trimmed))) {
        return { files, error: 'Dieser Dateiname ist bereits im Projekt vorhanden.', changed: false };
    }
    if (previous.name === trimmed) return { files, error: null, changed: false };
    return {
        files: files.map((file) => file.id === id ? { ...file, name: trimmed, updatedAt: now } : file),
        error: null, changed: true
    };
}

export function removeProjectFile(files: ProjectFile[], projectId: number, id: number) {
    if (!files.some((file) => file.id === id && file.projectId === projectId)) {
        return { files, error: 'Diese Datei ist nicht mehr in diesem Projekt vorhanden.' };
    }
    return { files: files.filter((file) => file.id !== id), error: null };
}
