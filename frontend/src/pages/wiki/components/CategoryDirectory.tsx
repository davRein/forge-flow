import { useTranslation } from '../../../hooks/languageContext';
import { useState } from 'react';
import { useChatNavigationBlocker } from '../../../hooks/chatNavigationContext';
import Dialog from '../../../components/ui/Dialog';
import type { useWiki } from '../hooks/useWiki';
import type { WikiCategory } from '../types/wiki.types';
import CategoryForm from './CategoryForm';
import { Actions, ButtonLink, Card, DangerButton, ErrorText, Field, FormActions, Grid, Input, Muted, PrimaryButton, SecondaryButton, Select, Toolbar } from '../styles/wikiStyles';

type Props = { wiki: ReturnType<typeof useWiki> };

function DeleteCategoryDialog({ category, wiki, onClose }: Props & { category: WikiCategory; onClose: () => void }) {
    const { t } = useTranslation();
    const [targetId, setTargetId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const affected = wiki.data.articles.filter((article) => article.categoryId === category.id).length;
    return (
        <Dialog title={t('Bereich löschen?')} onClose={onClose}>
            <p>{t('„{name}“ wirklich löschen? Die {count} zugeordneten Seiten und ihre Hierarchie bleiben erhalten.', { name: category.name, count: affected })}</p>
            {affected > 0 && <Field style={{ marginTop: 16 }}>
                {t('Seiten neu zuordnen')}
                <Select value={targetId ?? ''} onChange={(event) => { setTargetId(event.target.value ? Number(event.target.value) : null); setError(''); }}>
                    <option value="">{t('Ohne Bereich')}</option>
                    {wiki.data.categories.filter((entry) => entry.id !== category.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </Select>
            </Field>}
            {error && <ErrorText role="alert">{t(error)}</ErrorText>}
            <FormActions>
                <SecondaryButton autoFocus onClick={onClose}>{t('Abbrechen')}</SecondaryButton>
                <DangerButton onClick={() => { const message = wiki.removeCategory(category.id, targetId); if (message) setError(message); else onClose(); }}>{t('Bereich löschen')}</DangerButton>
            </FormActions>
        </Dialog>
    );
}

export default function CategoryDirectory({ wiki }: Props) {
    const { t, language } = useTranslation();
    const [query, setQuery] = useState('');
    const [editor, setEditor] = useState<{ category: WikiCategory | null } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<WikiCategory | null>(null);
    useChatNavigationBlocker(editor !== null || deleteTarget !== null);
    const search = query.trim().normalize('NFC').toLocaleLowerCase('de');
    const categories = wiki.data.categories.filter((category) => `${category.name} ${category.description}`.normalize('NFC').toLocaleLowerCase('de').includes(search))
        .sort((a, b) => a.name.localeCompare(b.name, language));
    return (
        <section aria-label={t('Bereiche')}>
            <Toolbar><p>{t('Organisiere dein Wissen nach Projekten, Themen und Abläufen.')}</p><PrimaryButton onClick={() => setEditor({ category: null })}>{t('+ Bereich anlegen')}</PrimaryButton></Toolbar>
            <Field>{t('Bereiche suchen')}<Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Name oder Beschreibung')} /></Field>
            <Muted aria-live="polite">{t('{count} von {total} Bereichen', { count: categories.length, total: wiki.data.categories.length })}</Muted>
            {categories.length === 0 && <Card>{wiki.data.categories.length === 0 ? t('Noch keine Bereiche vorhanden. Seiten können auch ohne Bereich angelegt werden.') : t('Keine Bereiche für diese Suche gefunden.')}</Card>}
            <Grid>{categories.map((category) => {
                const count = wiki.data.articles.filter((article) => article.categoryId === category.id).length;
                return <Card as="article" key={category.id}>
                    <h2>{category.name}</h2>
                    <Muted>{category.description || t('Keine Beschreibung hinterlegt.')}</Muted>
                    <p>{t('{count} Seiten', { count })}</p>
                    <Actions style={{ marginTop: 16 }}>
                        <ButtonLink to={`/wiki/articles?category=${category.id}`}>{t('Seiten anzeigen')}</ButtonLink>
                        <SecondaryButton onClick={() => setEditor({ category })}>{t('Bearbeiten')}</SecondaryButton>
                        <DangerButton onClick={() => setDeleteTarget(category)}>{t('Löschen')}</DangerButton>
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
