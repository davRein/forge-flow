import { useTranslation } from '../../../hooks/languageContext';
import { useEffect, useRef, useState } from 'react';
import type { WikiArticle, WikiArticleDraft, WikiCategory } from '../types/wiki.types';
import { wikiDescendants } from '../utils/wikiLogic';
import { FormattingBar } from '../styles/documentationStyles';
import ArticleContent from './ArticleContent';
import {
    Actions, ButtonLink, Card, ErrorText, Field, FormGrid, Input, Muted, PrimaryButton,
    Required, SecondaryButton, Select, Textarea, Toolbar
} from '../styles/wikiStyles';

type Props = {
    draft: WikiArticleDraft;
    categories: WikiCategory[];
    isEditing: boolean;
    articles?: WikiArticle[];
    editingId?: number | null;
    onChange: (draft: WikiArticleDraft) => void;
    onSave: () => string | null;
    onDiscard: () => void;
};

export default function ArticleEditor({ draft, categories, articles = [], editingId = null, isEditing, onChange, onSave, onDiscard }: Props) {
    const { t } = useTranslation();
    const [preview, setPreview] = useState(false);
    const [error, setError] = useState('');
    const textarea = useRef<HTMLTextAreaElement>(null);
    const selection = useRef<number | null>(null);
    const excluded = editingId === null ? new Set<number>() : wikiDescendants(articles, editingId);
    const parents = articles.filter(page => page.id !== editingId && !excluded.has(page.id) && page.categoryId === draft.categoryId);
    const hasChildren = editingId !== null && articles.some(page => page.parentId === editingId);
    useEffect(() => {
        if (selection.current !== null && textarea.current) { textarea.current.focus(); textarea.current.setSelectionRange(selection.current, selection.current); selection.current = null; }
    }, [draft.content]);
    const missingCategory = draft.categoryId !== null && !categories.some((category) => category.id === draft.categoryId);

    function change(next: WikiArticleDraft) {
        setError('');
        onChange(next);
    }

    function insert(before: string, after = '', example = '') {
        const start = textarea.current?.selectionStart ?? draft.content.length;
        const end = textarea.current?.selectionEnd ?? start;
        const selected = draft.content.slice(start, end) || example;
        selection.current = start + before.length + selected.length;
        change({ ...draft, content: draft.content.slice(0, start) + before + selected + after + draft.content.slice(end) });
    }

    function template(kind: string) {
        const content = kind === 'guide' ? `# ${t('Ziel')}\n\n${t('Beschreibe das gewünschte Ergebnis.')}\n\n## ${t('Voraussetzungen')}\n\n- \n\n## ${t('Schritt für Schritt')}\n\n1. \n\n## ${t('Ergebnis prüfen')}\n\n`
            : kind === 'decision' ? `# ${t('Kontext')}\n\n\n## ${t('Entscheidung')}\n\n\n## ${t('Alternativen')}\n\n- \n\n## ${t('Konsequenzen')}\n\n`
            : `# ${t('Teilnehmende')}\n\n- \n\n## ${t('Agenda')}\n\n1. \n\n## ${t('Ergebnisse')}\n\n\n## ${t('Nächste Schritte')}\n\n- `;
        if (!draft.content.trim()) change({ ...draft, content });
    }

    return (
        <Card as="form" onSubmit={(event) => { event.preventDefault(); setError(onSave() ?? ''); }}>
            <Toolbar>
                <h2>{isEditing ? t('Seite bearbeiten') : t('Neue Seite')}</h2>
                <Actions>
                    <SecondaryButton type="button" onClick={onDiscard}>{t('Entwurf verwerfen')}</SecondaryButton>
                    <PrimaryButton type="submit" disabled={!draft.title.trim() || !draft.content.trim()}>{t('Seite speichern')}</PrimaryButton>
                </Actions>
            </Toolbar>
            <FormGrid>
                <Field>
                    <span>{t('Titel')} <Required>*</Required></span>
                    <Input required maxLength={1000} autoFocus value={draft.title} onChange={(event) => change({ ...draft, title: event.target.value })} placeholder={t('Worum geht es auf dieser Seite?')} />
                </Field>
                <Field>
                    {t('Bereich')}
                    <Select disabled={hasChildren} value={draft.categoryId ?? ''} onChange={(event) => change({ ...draft, categoryId: event.target.value ? Number(event.target.value) : null, parentId: null })}>
                        <option value="">{t('Ohne Bereich')}</option>
                        {missingCategory && <option value={draft.categoryId!} disabled>{t('Kategorie nicht mehr vorhanden – bitte neu wählen')}</option>}
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </Select>
                </Field>
                <Field>{t('Übergeordnete Seite')}<Select value={draft.parentId ?? ''} onChange={event => change({ ...draft, parentId: event.target.value ? Number(event.target.value) : null })}>
                    <option value="">{t('Auf oberster Ebene')}</option>
                    {draft.parentId != null && !parents.some(page => page.id === draft.parentId) && <option disabled value={draft.parentId}>{t('Übergeordnete Seite nicht mehr verfügbar')}</option>}
                    {parents.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}
                </Select></Field>
            </FormGrid>
            {hasChildren && <Muted>{t('Seiten mit Unterseiten bleiben in ihrem Bereich. Verschiebe die Unterseiten zuerst, um den Bereich zu ändern.')}</Muted>}
            <Muted>{t('Der Entwurf bleibt beim Wechsel zwischen Ansichten und Modulen in dieser Sitzung erhalten.')} <ButtonLink to="/wiki/categories">{t('Bereiche verwalten')}</ButtonLink></Muted>
            {!isEditing && !draft.content.trim() && <FormattingBar aria-label={t('Seitenvorlagen')}><span>{t('Mit Vorlage starten:')}</span>
                <button type="button" onClick={() => template('guide')}>{t('Anleitung')}</button><button type="button" onClick={() => template('decision')}>{t('Entscheidung')}</button><button type="button" onClick={() => template('meeting')}>{t('Besprechung')}</button>
            </FormattingBar>}
            <Toolbar>
                <Actions>
                    <SecondaryButton type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>{t('Inhalt bearbeiten')}</SecondaryButton>
                    <SecondaryButton type="button" aria-pressed={preview} onClick={() => setPreview(true)}>{t('Vorschau')}</SecondaryButton>
                </Actions>
            </Toolbar>
            {!preview && <FormattingBar aria-label={t('Textformatierung')}>
                <button type="button" onClick={() => insert('\n## ', '\n', t('Überschrift'))}>{t('Überschrift')}</button>
                <button type="button" onClick={() => insert('**', '**', t('Text'))}><strong>{t('Fett')}</strong></button>
                <button type="button" onClick={() => insert('*', '*', t('Text'))}><em>{t('Kursiv')}</em></button>
                <button type="button" onClick={() => insert('\n- ', '\n', t('Listeneintrag'))}>{t('Liste')}</button>
                <button type="button" onClick={() => insert('\n1. ', '\n', t('Listeneintrag'))}>{t('Nummerierte Liste')}</button>
                <button type="button" onClick={() => insert('\n> ', '\n', t('Hinweis'))}>{t('Zitat')}</button>
                <button type="button" onClick={() => insert('\n```\n', '\n```\n', t('Code'))}>{t('Codeblock')}</button>
                <button type="button" onClick={() => insert('[', '](https://example.com)', t('Linktext'))}>{t('Link')}</button>
                <button type="button" onClick={() => insert(`\n| ${t('Spalte')} 1 | ${t('Spalte')} 2 |\n| --- | --- |\n|  |  |\n`)}>{t('Tabelle')}</button>
            </FormattingBar>}
            {preview ? <section aria-label={t('Artikelvorschau')}><ArticleContent content={draft.content || t('Noch kein Inhalt vorhanden.')} /></section> : (
                <Field>
                    <span>{t('Inhalt')} <Required>*</Required></span>
                    <Textarea ref={textarea} maxLength={1000000} required value={draft.content} style={{ minHeight: 420, fontFamily: "Consolas, 'Courier New', monospace" }}
                        onChange={(event) => change({ ...draft, content: event.target.value })} placeholder={t('Wissen, Anleitungen und Entscheidungen festhalten …')} />
                </Field>
            )}
            <Muted>{t('Formatierung: # / ## / ### für Überschriften, - oder 1. für Listen und ``` für Codeblöcke.')}</Muted>
            {error && <ErrorText role="alert">{t(error)}</ErrorText>}
        </Card>
    );
}
