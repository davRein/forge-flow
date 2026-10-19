import { useState } from 'react';
import Dialog from '../../../components/ui/Dialog';
import type { useWiki } from '../hooks/useWiki';
import type { WikiCategory } from '../types/wiki.types';
import CategoryForm from './CategoryForm';
import { Actions, ButtonLink, Card, DangerButton, ErrorText, Field, FormActions, Grid, Input, Muted, PrimaryButton, SecondaryButton, Select, Toolbar } from '../styles/wikiStyles';

type Props = { wiki: ReturnType<typeof useWiki> };

function DeleteCategoryDialog({ category, wiki, onClose }: Props & { category: WikiCategory; onClose: () => void }) {
    const [targetId, setTargetId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const affected = wiki.data.articles.filter((article) => article.categoryId === category.id).length;
    return (
        <Dialog title="Kategorie löschen?" onClose={onClose}>
            <p>„{category.name}“ wirklich löschen? Die {affected} zugeordneten Artikel bleiben erhalten.</p>
            {affected > 0 && <Field style={{ marginTop: 16 }}>
                Artikel neu zuordnen
                <Select value={targetId ?? ''} onChange={(event) => { setTargetId(event.target.value ? Number(event.target.value) : null); setError(''); }}>
                    <option value="">Ohne Kategorie</option>
                    {wiki.data.categories.filter((entry) => entry.id !== category.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </Select>
            </Field>}
            {error && <ErrorText role="alert">{error}</ErrorText>}
            <FormActions>
                <SecondaryButton autoFocus onClick={onClose}>Abbrechen</SecondaryButton>
                <DangerButton onClick={() => { const message = wiki.removeCategory(category.id, targetId); if (message) setError(message); else onClose(); }}>Kategorie löschen</DangerButton>
            </FormActions>
        </Dialog>
    );
}

export default function CategoryDirectory({ wiki }: Props) {
    const [query, setQuery] = useState('');
    const [editor, setEditor] = useState<{ category: WikiCategory | null } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<WikiCategory | null>(null);
    const search = query.trim().normalize('NFC').toLocaleLowerCase('de');
    const categories = wiki.data.categories.filter((category) => `${category.name} ${category.description}`.normalize('NFC').toLocaleLowerCase('de').includes(search))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return (
        <section aria-label="Kategorien">
            <Toolbar><p>Ordne Artikel nach Themen und halte dein Wiki übersichtlich.</p><PrimaryButton onClick={() => setEditor({ category: null })}>+ Kategorie anlegen</PrimaryButton></Toolbar>
            <Field>Kategorien suchen<Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name oder Beschreibung" /></Field>
            <Muted aria-live="polite">{categories.length} von {wiki.data.categories.length} Kategorien</Muted>
            {categories.length === 0 && <Card>{wiki.data.categories.length === 0 ? 'Noch keine Kategorien vorhanden. Artikel können auch ohne Kategorie angelegt werden.' : 'Keine Kategorien für diese Suche gefunden.'}</Card>}
            <Grid>{categories.map((category) => {
                const count = wiki.data.articles.filter((article) => article.categoryId === category.id).length;
                return <Card as="article" key={category.id}>
                    <h2>{category.name}</h2>
                    <Muted>{category.description || 'Keine Beschreibung hinterlegt.'}</Muted>
                    <p>{count} Artikel</p>
                    <Actions style={{ marginTop: 16 }}>
                        <ButtonLink to={`/wiki/articles?category=${category.id}`}>Artikel anzeigen</ButtonLink>
                        <SecondaryButton onClick={() => setEditor({ category })}>Bearbeiten</SecondaryButton>
                        <DangerButton onClick={() => setDeleteTarget(category)}>Löschen</DangerButton>
                    </Actions>
                </Card>;
            })}</Grid>
            {editor && <CategoryForm category={editor.category} onSave={(draft, id) => {
                const message = wiki.saveCategory(draft, id);
                if (!message) setQuery('');
                return message;
            }} onClose={() => setEditor(null)} />}
            {deleteTarget && <DeleteCategoryDialog category={deleteTarget} wiki={wiki} onClose={() => setDeleteTarget(null)} />}
        </section>
    );
}
