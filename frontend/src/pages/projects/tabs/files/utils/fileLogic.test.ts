import { addProjectFiles, getFileCategory, removeProjectFile, renameProjectFile, splitFileName, validateFileName } from './fileLogic.js';

const now = '2026-10-18T12:00:00.000Z';
const later = '2026-10-18T13:00:00.000Z';

function assert(value: unknown, message: string): asserts value {
    if (!value) throw new Error(message);
}

function equal(actual: unknown, expected: unknown) {
    assert(JSON.stringify(actual) === JSON.stringify(expected), `Erwartet ${JSON.stringify(expected)}, erhalten ${JSON.stringify(actual)}`);
}

export const fileTests = [
    { name: 'Mehrere Dateien einschließlich leerer Dateien behalten ihren Inhalt und eindeutige IDs', async run() {
        const binary = new File([new Uint8Array([0, 1, 128, 255])], 'daten.bin', { type: 'application/octet-stream' });
        const empty = new File([], '.gitkeep');
        const result = addProjectFiles([], 1, [binary, empty], 1, now);
        equal(result.added.map((file) => file.id), [1, 2]);
        equal(result.rejected, []);
        equal(result.nextId, 3);
        assert(result.added[0].content === binary, 'Originaler Dateiinhalt muss erhalten bleiben');
        equal(Array.from(new Uint8Array(await result.added[0].content.arrayBuffer())), [0, 1, 128, 255]);
        equal(result.added[1].content.size, 0);
    } },
    { name: 'Gleiche Namen werden innerhalb des Projekts und derselben Auswahl ohne Überschreiben erkannt', run() {
        const initial = addProjectFiles([], 1, [new File(['alt'], 'Plan.PDF')], 1, now);
        const result = addProjectFiles(initial.files, 1, [new File(['neu'], 'plan.pdf'), new File(['a'], 'neu.txt'), new File(['b'], 'NEU.TXT')], initial.nextId, now);
        equal(result.files.map((file) => file.name), ['Plan.PDF', 'neu.txt']);
        equal(result.rejected.length, 2);
        assert(result.files[0] === initial.files[0], 'Vorhandene Datei darf nicht ersetzt werden');
        const otherProject = addProjectFiles(result.files, 2, [new File(['neu'], 'plan.pdf')], result.nextId, now);
        equal(otherProject.added.length, 1);
        equal(otherProject.files.filter((file) => file.projectId === 1).length, 2);
    } },
    { name: 'Unicode-Namen werden für die Duplikatprüfung normalisiert', run() {
        const result = addProjectFiles([], 1, [new File(['a'], 'Präsentation.pdf'), new File(['b'], 'Pra\u0308sentation.pdf')], 1, now);
        equal(result.added.length, 1);
        equal(result.rejected.length, 1);
    } },
    { name: 'Ungültige Namen und Hinzufügen ohne ausgewähltes Projekt werden abgelehnt', run() {
        for (const name of ['', '   ', '.', '..', '../plan.pdf', 'ordner\\plan.pdf', 'datei\u0000.txt', 'datei\n.txt']) {
            assert(validateFileName(name), `Ungültiger Name muss abgelehnt werden: ${name}`);
        }
        assert(!validateFileName('.gitignore'), 'Versteckte Dateien sind gültig');
        const result = addProjectFiles([], 0, [new File(['x'], 'plan.txt')], 1, now);
        equal(result.files, []);
        equal(result.rejected.length, 1);
    } },
    { name: 'Umbenennen ändert weder Dateibytes noch ursprüngliche Metadaten', async run() {
        const content = new File(['Grüße aus Köln'], 'original.txt', { type: 'text/plain', lastModified: 12345 });
        const initial = addProjectFiles([], 1, [content], 1, now);
        const result = renameProjectFile(initial.files, 1, 1, ' neuer-name.txt ', later);
        assert(!result.error && result.changed, 'Umbenennen muss möglich sein');
        equal(result.files[0].name, 'neuer-name.txt');
        assert(result.files[0].content === content, 'Originale Datei muss unverändert bleiben');
        equal(await result.files[0].content.text(), 'Grüße aus Köln');
        equal(result.files[0].content.lastModified, 12345);
        equal(result.files[0].addedAt, now);
        equal(result.files[0].updatedAt, later);
        equal(initial.files[0].name, 'original.txt');
    } },
    { name: 'Dateien fremder Projekte und gelöschte IDs können nicht geändert oder entfernt werden', run() {
        const initial = addProjectFiles([], 1, [new File(['x'], 'plan.txt')], 1, now);
        assert(renameProjectFile(initial.files, 2, 1, 'neu.txt', later).error, 'Projektgrenze muss beim Umbenennen gelten');
        assert(removeProjectFile(initial.files, 2, 1).error, 'Projektgrenze muss beim Entfernen gelten');
        assert(removeProjectFile(initial.files, 1, 99).error, 'Fehlende Datei muss erkannt werden');
        equal(initial.files.length, 1);
    } },
    { name: 'Namenskollisionen beim Umbenennen werden abgewiesen, erneutes Speichern desselben Namens bleibt unverändert', run() {
        const initial = addProjectFiles([], 1, [new File(['a'], 'eins.txt'), new File(['b'], 'zwei.txt')], 1, now);
        const conflict = renameProjectFile(initial.files, 1, 1, 'ZWEI.TXT', later);
        assert(conflict.error, 'Kollision muss erkannt werden');
        assert(conflict.files === initial.files, 'Kollision darf keine Teiländerung verursachen');
        const unchanged = renameProjectFile(initial.files, 1, 1, 'eins.txt', later);
        assert(!unchanged.error && !unchanged.changed, 'Unveränderter Name darf kein Änderungsereignis erzeugen');
    } },
    { name: 'Entfernen gibt den Namen wieder frei und erhält Dateien anderer Projekte', run() {
        const first = addProjectFiles([], 1, [new File(['a'], 'plan.txt')], 1, now);
        const second = addProjectFiles(first.files, 2, [new File(['b'], 'plan.txt')], first.nextId, now);
        const removed = removeProjectFile(second.files, 1, 1);
        assert(!removed.error, 'Entfernen muss möglich sein');
        equal(removed.files.map((file) => file.projectId), [2]);
        const readded = addProjectFiles(removed.files, 1, [new File(['neu'], 'plan.txt')], second.nextId, later);
        equal(readded.added[0].id, 3);
        equal(readded.rejected, []);
    } },
    { name: 'Dateien ohne MIME-Angabe bleiben nach Endung filterbar und Sondernamen behalten ihre Endung', run() {
        const files = addProjectFiles([], 1, [new File([], 'BILD.PNG'), new File([], 'notizen.pdf'), new File([], 'daten.json'), new File([], 'paket.tar.gz')], 1, now).files;
        equal(files.map(getFileCategory), ['image', 'document', 'code', 'archive']);
        equal(splitFileName('.gitignore'), { stem: '.gitignore', extension: '' });
        equal(splitFileName('paket.tar.gz'), { stem: 'paket.tar', extension: '.gz' });
    } }
];
