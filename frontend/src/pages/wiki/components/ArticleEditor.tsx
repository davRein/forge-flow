import { useState } from 'react';
import type { WikiArticleDraft, WikiCategory } from '../types/wiki.types';
import ArticleContent from './ArticleContent';
import {
    Actions, ButtonLink, Card, ErrorText, Field, FormGrid, Input, Muted, PrimaryButton,
    Required, SecondaryButton, Select, Textarea, Toolbar
} from '../styles/wikiStyles';

type Props = {
    draft: WikiArticleDraft;
    categories: WikiCategory[];
    isEditing: boolean;
    onChange: (draft: WikiArticleDraft) => void;
    onSave: () => string | null;
    onDiscard: () => void;
};

export default function ArticleEditor({ draft, categories, isEditing, onChange, onSave, onDiscard }: Props) {
    const [preview, setPreview] = useState(false);
    const [error, setError] = useState('');
    const missingCategory = draft.categoryId !== null && !categories.some((category) => category.id === draft.categoryId);

    function change(next: WikiArticleDraft) {
        setError('');
        onChange(next);
    }

    return (
        <Card as="form" onSubmit={(event) => { event.preventDefault(); setError(onSave() ?? ''); }}>
            <Toolbar>
                <h2>{isEditing ? 'Artikel bearbeiten' : 'Neuer Artikel'}</h2>
                <Actions>
                    <SecondaryButton type="button" onClick={onDiscard}>Entwurf verwerfen</SecondaryButton>
                    <PrimaryButton type="submit" disabled={!draft.title.trim() || !draft.content.trim()}>Artikel speichern</PrimaryButton>
                </Actions>
            </Toolbar>
            <FormGrid>
                <Field>
                    <span>Titel <Required>*</Required></span>
                    <Input required autoFocus value={draft.title} onChange={(event) => change({ ...draft, title: event.target.value })} placeholder="Worum geht es in diesem Artikel?" />
                </Field>
                <Field>
                    Kategorie
                    <Select value={draft.categoryId ?? ''} onChange={(event) => change({ ...draft, categoryId: event.target.value ? Number(event.target.value) : null })}>
                        <option value="">Ohne Kategorie</option>
                        {missingCategory && <option value={draft.categoryId!} disabled>Kategorie nicht mehr vorhanden – bitte neu wählen</option>}
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </Select>
                </Field>
            </FormGrid>
            <Muted>Der Entwurf bleibt beim Wechsel zwischen Ansichten und Modulen in dieser Sitzung erhalten. <ButtonLink to="/wiki/categories">Kategorien verwalten</ButtonLink></Muted>
            <Toolbar>
                <Actions>
                    <SecondaryButton type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Inhalt bearbeiten</SecondaryButton>
                    <SecondaryButton type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Vorschau</SecondaryButton>
                </Actions>
            </Toolbar>
            {preview ? <section aria-label="Artikelvorschau"><ArticleContent content={draft.content || 'Noch kein Inhalt vorhanden.'} /></section> : (
                <Field>
                    <span>Inhalt <Required>*</Required></span>
                    <Textarea required value={draft.content} style={{ minHeight: 360, fontFamily: "Consolas, 'Courier New', monospace" }}
                        onChange={(event) => change({ ...draft, content: event.target.value })} placeholder="Wissen, Anleitungen und Entscheidungen festhalten …" />
                </Field>
            )}
            <Muted>{'Formatierung: # / ## / ### für Überschriften, - oder 1. für Listen und ``` für Codeblöcke.'}</Muted>
            {error && <ErrorText role="alert">{error}</ErrorText>}
        </Card>
    );
}
