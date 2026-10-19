import { CustomerDraft } from '../types/project.types';
import Dialog from './Dialog';
import { ErrorText, Field, FormActions, FormGrid, Input, PrimaryButton, Required, SecondaryButton } from '../styles/projectStyles';

type Props = {
    draft: CustomerDraft;
    isEditing: boolean;
    error: string;
    onChange: (draft: CustomerDraft) => void;
    onSave: () => void;
    onClose: () => void;
};

const fields: { key: keyof CustomerDraft; label: string; type?: string; required: boolean }[] = [
    { key: 'name', label: 'Kundenname', required: true },
    { key: 'street', label: 'Straße + Nr.', required: true },
    { key: 'city', label: 'Ort', required: true },
    { key: 'country', label: 'Land', required: true },
    { key: 'email', label: 'E-Mail', type: 'email', required: true },
    { key: 'website', label: 'Internetadresse', required: false },
    { key: 'phone', label: 'Telefonnummer', type: 'tel', required: true },
    { key: 'industry', label: 'Branche', required: true }
];

export default function CustomerModal({ draft, isEditing, error, onChange, onSave, onClose }: Props) {
    return (
        <Dialog title={isEditing ? 'Kunde bearbeiten' : 'Neuer Kunde'} onClose={onClose}>
            <form onSubmit={(event) => { event.preventDefault(); onSave(); }}>
                <FormGrid>
                    {fields.map(({ key, label, type, required }, index) => (
                        <Field key={key}>
                            {label} {required && <Required>*</Required>}
                            <Input type={type ?? 'text'} required={required} autoFocus={index === 0} value={draft[key] ?? ''} onChange={(event) => onChange({ ...draft, [key]: event.target.value })} />
                        </Field>
                    ))}
                </FormGrid>
                {error && <ErrorText role="alert">{error}</ErrorText>}
                <FormActions>
                    <SecondaryButton type="button" onClick={onClose}>Abbrechen</SecondaryButton>
                    <PrimaryButton type="submit">Speichern</PrimaryButton>
                </FormActions>
            </form>
        </Dialog>
    );
}
