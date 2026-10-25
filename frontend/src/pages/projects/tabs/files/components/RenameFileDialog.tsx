import { useState } from 'react';
import Dialog from '../../../components/Dialog';
import { useUnsavedChanges } from '../../../../../hooks/navigationGuard';
import type { ProjectFile } from '../../../types/file.types';
import { ErrorText, Field, FormActions, Input, PrimaryButton, SecondaryButton } from '../../../styles/projectStyles';
import { splitFileName } from '../utils/fileLogic';

type Props = {
    file: ProjectFile;
    onSave: (id: number, name: string) => string | null;
    onClose: () => void;
};

export default function RenameFileDialog({ file, onSave, onClose }: Props) {
    const { stem, extension } = splitFileName(file.name);
    const [name, setName] = useState(stem);
    const [error, setError] = useState('');
    useUnsavedChanges(name !== stem, onClose);

    return (
        <Dialog title="Datei umbenennen" onClose={onClose}>
            <form onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim()) { setError('Bitte einen Dateinamen angeben.'); return; }
                const message = onSave(file.id, `${name.trim()}${extension}`);
                if (message) setError(message);
                else onClose();
            }}>
                <p style={{ marginBottom: 16, overflowWrap: 'anywhere' }}>Bisheriger Name: {file.name}</p>
                <Field>
                    Neuer Dateiname{extension ? ` (ohne ${extension})` : ''}
                    <Input required autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(''); }} />
                </Field>
                {extension && <p style={{ marginTop: 12 }}>Die Dateiendung {extension} bleibt erhalten.</p>}
                {error && <ErrorText role="alert">{error}</ErrorText>}
                <FormActions>
                    <SecondaryButton type="button" onClick={onClose}>Abbrechen</SecondaryButton>
                    <PrimaryButton type="submit" disabled={!name.trim()}>Speichern</PrimaryButton>
                </FormActions>
            </form>
        </Dialog>
    );
}
