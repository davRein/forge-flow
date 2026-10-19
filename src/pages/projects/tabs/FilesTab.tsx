import { useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { useWorkspacePersistence } from '../../../hooks/workspaceContext';
import Dialog from '../components/Dialog';
import type { FileCategory, FileRejection, ProjectFile } from '../types/file.types';
import type { useProjectFiles } from './files/hooks/useProjectFiles';
import RenameFileDialog from './files/components/RenameFileDialog';
import { formatFileSize, getFileCategory } from './files/utils/fileLogic';
import {
    DangerButton, ErrorText, Field, FormActions, FormCard, Input, PrimaryButton, SecondaryButton, Select
} from '../styles/projectStyles';

const Toolbar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
`;

const DropZone = styled.section<{ $dragging: boolean }>`
    padding: 24px;
    text-align: center;
    border: 2px dashed ${({ theme, $dragging }) => $dragging ? theme.colors.primary : theme.colors.border};
    border-radius: 12px;
    background: ${({ theme, $dragging }) => $dragging ? `${theme.colors.primary}18` : theme.colors.content};

    h4 { margin-bottom: 12px; }
    p { margin: 12px 0; color: ${({ theme }) => theme.colors.textSecondary}; line-height: 1.5; }
`;

const Filters = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 20px 0;

    label:first-child { flex: 1; min-width: 180px; }
`;

const TableWrapper = styled.div`
    margin-top: 12px;
    overflow-x: auto;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: 12px;
`;

const Table = styled.table`
    width: 100%;
    min-width: 650px;
    border-collapse: collapse;
    text-align: left;
    background: ${({ theme }) => theme.colors.content};

    th, td { padding: 14px; border-bottom: 1px solid ${({ theme }) => theme.colors.border}; vertical-align: top; }
    th { background: ${({ theme }) => theme.colors.header}; color: ${({ theme }) => theme.colors.textSecondary}; }
    tbody tr:last-child td { border-bottom: 0; }
    td:first-child { min-width: 180px; max-width: 400px; overflow-wrap: anywhere; }
    small { display: block; margin-top: 6px; color: ${({ theme }) => theme.colors.textSecondary}; }
`;

const Actions = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
`;

const Notice = styled.div`
    margin-top: 16px;
    line-height: 1.5;
    overflow-wrap: anywhere;
    ul { margin: 8px 0 0 20px; }
`;

const categoryLabels: Record<FileCategory, string> = {
    image: 'Bilder', document: 'Dokumente', archive: 'Archive', code: 'Code & Daten', other: 'Sonstige'
};

type Props = { fileState: ReturnType<typeof useProjectFiles> };
type SortMode = 'newest' | 'name' | 'size';

export default function FilesTab({ fileState }: Props) {
    const input = useRef<HTMLInputElement>(null);
    const dragDepth = useRef(0);
    const noteId = useId();
    const persistence = useWorkspacePersistence().persistence;
    const [dragging, setDragging] = useState(false);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<'all' | FileCategory>('all');
    const [sortMode, setSortMode] = useState<SortMode>('newest');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [rejected, setRejected] = useState<FileRejection[]>([]);
    const [renameTarget, setRenameTarget] = useState<ProjectFile | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null);

    const search = query.trim().toLocaleLowerCase('de');
    const filtered = fileState.projectFiles.filter((file) =>
        `${file.name} ${file.content.type}`.toLocaleLowerCase('de').includes(search)
        && (category === 'all' || getFileCategory(file) === category))
        .sort((a, b) => sortMode === 'name' ? a.name.localeCompare(b.name, 'de')
            : sortMode === 'size' ? b.content.size - a.content.size || a.name.localeCompare(b.name, 'de')
            : b.addedAt.localeCompare(a.addedAt) || b.id - a.id);
    const totalBytes = fileState.projectFiles.reduce((total, file) => total + file.content.size, 0);

    function addFiles(files: File[]) {
        if (files.length === 0) return;
        const result = fileState.addFiles(files);
        setRejected(result.rejected);
        setError('');
        setMessage(result.addedCount > 0 ? `${result.addedCount} ${result.addedCount === 1 ? 'Datei hinzugefügt' : 'Dateien hinzugefügt'}.` : 'Keine Dateien hinzugefügt.');
        if (result.addedCount > 0) { setQuery(''); setCategory('all'); }
    }

    return (
        <section aria-label="Projektdateien">
            <Toolbar>
                <div><h3>Dateien</h3><p>{fileState.projectFiles.length} Dateien · {formatFileSize(totalBytes)}</p></div>
                <PrimaryButton onClick={() => input.current?.click()}>+ Dateien hinzufügen</PrimaryButton>
            </Toolbar>
            <input ref={input} type="file" multiple hidden onChange={(event) => {
                addFiles(Array.from(event.currentTarget.files ?? []));
                event.currentTarget.value = '';
            }} />
            <DropZone $dragging={dragging} aria-label="Dateien hinzufügen" aria-describedby={noteId}
                onDragEnter={(event) => {
                    event.preventDefault();
                    if (!Array.from(event.dataTransfer.types).includes('Files')) return;
                    dragDepth.current++;
                    setDragging(true);
                }}
                onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
                onDragLeave={(event) => {
                    event.preventDefault();
                    dragDepth.current = Math.max(0, dragDepth.current - 1);
                    if (dragDepth.current === 0) setDragging(false);
                }}
                onDrop={(event) => {
                    event.preventDefault();
                    dragDepth.current = 0;
                    setDragging(false);
                    addFiles(Array.from(event.dataTransfer.files));
                }}>
                <h4>{dragging ? 'Dateien hier loslassen' : 'Dateien hier ablegen'}</h4>
                <SecondaryButton onClick={() => input.current?.click()}>Dateien auswählen</SecondaryButton>
                <p id={noteId}>{persistence === 'session' ? 'Dateien sind nur in dieser Sitzung verfügbar. Beim Neuladen gehen die hinzugefügten Dateien verloren.'
                    : 'Dateien werden mit deinem Konto synchronisiert. Beachte den Speicherstatus und mögliche Upload-Fehler.'}</p>
            </DropZone>
            <Notice role="status" aria-live="polite">
                {message && <p>{message}</p>}
                {rejected.length > 0 && <><p>{rejected.length} Dateien wurden übersprungen:</p>
                    <ul>{rejected.map((item, index) => <li key={`${item.name}-${index}`}>{item.name}: {item.reason}</li>)}</ul>
                </>}
            </Notice>
            {error && <ErrorText role="alert">{error}</ErrorText>}
            <Filters>
                <Field>Dateien suchen<Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Dateiname oder Dateityp" /></Field>
                <Field>Dateityp<Select value={category} onChange={(event) => setCategory(event.target.value as 'all' | FileCategory)}>
                    <option value="all">Alle Dateitypen</option>
                    {Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </Select></Field>
                <Field>Sortierung<Select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
                    <option value="newest">Zuletzt hinzugefügt</option>
                    <option value="name">Dateiname A–Z</option>
                    <option value="size">Größte zuerst</option>
                </Select></Field>
            </Filters>
            <p aria-live="polite">{filtered.length} von {fileState.projectFiles.length} Dateien</p>
            {filtered.length === 0 ? <FormCard style={{ marginTop: 12 }}>{fileState.projectFiles.length === 0
                ? 'Noch keine Dateien vorhanden. Füge die ersten Projektdateien hinzu.'
                : 'Keine Dateien passen zur Suche und zum gewählten Dateityp.'}</FormCard> : (
                <TableWrapper>
                    <Table aria-label="Dateiliste">
                        <thead><tr><th scope="col">Dateiname</th><th scope="col">Typ & Größe</th><th scope="col">Hinzugefügt</th><th scope="col">Aktionen</th></tr></thead>
                        <tbody>{filtered.map((file) => (
                            <tr key={file.id}>
                                <td><strong>{file.name}</strong><small>{file.content.type || 'Dateityp nicht angegeben'}</small></td>
                                <td>{categoryLabels[getFileCategory(file)]}<small>{formatFileSize(file.content.size)}</small></td>
                                <td><time dateTime={file.addedAt}>{new Date(file.addedAt).toLocaleDateString('de-DE')}</time></td>
                                <td><Actions>
                                    <SecondaryButton aria-label={`${file.name} herunterladen`} onClick={() => {
                                        const failure = fileState.downloadFile(file.id);
                                        setError(failure ?? '');
                                        if (!failure) setMessage(`Download für „${file.name}“ gestartet.`);
                                    }}>Herunterladen</SecondaryButton>
                                    <SecondaryButton aria-label={`${file.name} umbenennen`} onClick={() => { setError(''); setRenameTarget(file); }}>Umbenennen</SecondaryButton>
                                    <DangerButton aria-label={`${file.name} entfernen`} onClick={() => { setError(''); setDeleteTarget(file); }}>Entfernen</DangerButton>
                                </Actions></td>
                            </tr>
                        ))}</tbody>
                    </Table>
                </TableWrapper>
            )}
            {renameTarget && <RenameFileDialog file={renameTarget} onSave={(id, name) => {
                const failure = fileState.renameFile(id, name);
                if (!failure) { setMessage('Dateiname gespeichert.'); setQuery(''); }
                return failure;
            }} onClose={() => setRenameTarget(null)} />}
            {deleteTarget && <Dialog title="Datei aus Projekt entfernen?" onClose={() => setDeleteTarget(null)}>
                <p style={{ overflowWrap: 'anywhere' }}>„{deleteTarget.name}“ aus diesem Projekt entfernen? Die Originaldatei auf deinem Gerät bleibt erhalten.</p>
                <FormActions>
                    <SecondaryButton autoFocus onClick={() => setDeleteTarget(null)}>Abbrechen</SecondaryButton>
                    <DangerButton onClick={() => {
                        const failure = fileState.removeFile(deleteTarget.id);
                        setError(failure ?? '');
                        if (!failure) setMessage(`Datei „${deleteTarget.name}“ entfernt.`);
                        setDeleteTarget(null);
                    }}>Datei entfernen</DangerButton>
                </FormActions>
            </Dialog>}
        </section>
    );
}
