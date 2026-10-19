import { useState } from 'react';
import Dialog from '../../../components/ui/Dialog';
import type { WikiCategory, WikiCategoryDraft } from '../types/wiki.types';
import { ErrorText, Field, FormActions, Input, PrimaryButton, Required, SecondaryButton, Textarea } from '../styles/wikiStyles';

type Props = {
    category: WikiCategory | null;
    onSave: (draft: WikiCategoryDraft, id: number | null) => string | null;
    onClose: () => void;
};

export default function CategoryForm({ category, onSave, onClose }: Props) {
    const [draft, setDraft] = useState<WikiCategoryDraft>({ name: category?.name ?? '', description: category?.description ?? '' });
    const [error, setError] = useState('');
    return (
        <Dialog title={category ? 'Kategorie bearbeiten' : 'Neue Kategorie'} onClose={onClose}>
            <form onSubmit={(event) => {
                event.preventDefault();
                const message = onSave(draft, category?.id ?? null);
                if (message) setError(message);
                else onClose();
            }}>
                <Field>
                    <span>Name <Required>*</Required></span>
                    <Input required autoFocus value={draft.name} onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setError(''); }} />
                </Field>
                <Field style={{ marginTop: 16 }}>
                    Beschreibung
                    <Textarea value={draft.description} onChange={(event) => { setDraft({ ...draft, description: event.target.value }); setError(''); }} />
                </Field>
                {error && <ErrorText role="alert">{error}</ErrorText>}
                <FormActions>
                    <SecondaryButton type="button" onClick={onClose}>Abbrechen</SecondaryButton>
                    <PrimaryButton type="submit" disabled={!draft.name.trim()}>Speichern</PrimaryButton>
                </FormActions>
            </form>
        </Dialog>
    );
}
