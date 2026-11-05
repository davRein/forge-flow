import { useTranslation as useUiTranslation } from '../../../../../hooks/languageContext';
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
    const { t: tx } = useUiTranslation();

    const { stem, extension } = splitFileName(file.name);
    const [name, setName] = useState(stem);
    const [error, setError] = useState('');
    useUnsavedChanges(name !== stem, onClose);

    return (
        <Dialog title={tx('Datei umbenennen')} onClose={onClose}>
            <form onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim()) { setError('Bitte einen Dateinamen angeben.'); return; }
                const message = onSave(file.id, `${name.trim()}${extension}`);
                if (message) setError(message);
                else onClose();
            }}>
                <p style={{ marginBottom: 16, overflowWrap: 'anywhere' }}>{tx('Bisheriger Name: ')}{file.name}</p>
                <Field>
                    {tx('Neuer Dateiname')}{extension ? tx(' (ohne {value0})', { value0: extension }) : ''}
                    <Input required autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(''); }} />
                </Field>
                {extension && <p style={{ marginTop: 12 }}>{tx('Die Dateiendung ')}{extension} {tx(' bleibt erhalten.')}</p>}
                {error && <ErrorText role="alert">{tx(error)}</ErrorText>}
                <FormActions>
                    <SecondaryButton type="button" onClick={onClose}>{tx('Abbrechen')}</SecondaryButton>
                    <PrimaryButton type="submit" disabled={!name.trim()}>{tx('Speichern')}</PrimaryButton>
                </FormActions>
            </form>
        </Dialog>
    );
}
