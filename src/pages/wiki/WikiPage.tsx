import { useState } from 'react';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Dialog from '../../components/ui/Dialog';
import { useWiki } from './hooks/useWiki';
import type { WikiArticle, WikiCategoryFilter, WikiSort } from './types/wiki.types';
import { parseWikiId, searchWikiArticles } from './utils/wikiLogic';
import ArticleEditor from './components/ArticleEditor';
import ArticleList from './components/ArticleList';
import ArticleReader from './components/ArticleReader';
import CategoryDirectory from './components/CategoryDirectory';
import { ButtonLink, Card, DangerButton, ErrorText, Field, Filters, FormActions, Grid, Input, Muted, Page, PrimaryLink, SecondaryButton, Select, TextLink, Toolbar } from './styles/wikiStyles';

export default function WikiPage({ section = 'home', active = true }: { section?: string; active?: boolean }) {
    const wiki = useWiki();
    const persistence = useWorkspacePersistence().persistence;
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [deleteTarget, setDeleteTarget] = useState<WikiArticle | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const articleParam = active && section === 'articles' ? params.get('article') : null;
    const editorParam = active && section === 'articles' ? params.get('edit') : null;
    const articleId = parseWikiId(articleParam);
    const editingId = editorParam === 'new' ? null : parseWikiId(editorParam);
    const article = wiki.data.articles.find((entry) => entry.id === articleId);
    const editorValid = editorParam === 'new' || (editingId !== null && wiki.data.articles.some((entry) => entry.id === editingId));
    const query = params.get('q') ?? '';
    const categoryId = parseWikiId(params.get('category'));
    const category: WikiCategoryFilter = params.get('category') === 'none' ? 'none'
        : categoryId !== null && wiki.data.categories.some((entry) => entry.id === categoryId) ? categoryId : 'all';
    const requestedSort = params.get('sort');
    const sort: WikiSort = requestedSort === 'title' || requestedSort === 'created' ? requestedSort : 'updated';
    const articles = searchWikiArticles(wiki.data, query, category, sort);
    const title = section === 'categories' ? 'Kategorien' : section === 'search' ? 'Wiki durchsuchen' : section === 'articles' ? 'Artikel' : 'Wiki';

    function setFilter(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    }

    const missingArticle = <Card><h2>Artikel nicht gefunden</h2><Muted>Der Artikel wurde gelöscht oder die Adresse ist ungültig.</Muted><ButtonLink to="/wiki/articles">Zur Artikelliste</ButtonLink></Card>;

    return (
        <Page>
            <Toolbar>
                <h1>{title}</h1>
                {editorParam === null && <PrimaryLink to="/wiki/articles?edit=new">{wiki.drafts.new ? 'Neuen Entwurf fortsetzen' : '+ Artikel anlegen'}</PrimaryLink>}
            </Toolbar>
            <Muted>{persistence === 'session' ? 'Wiki-Inhalte und Artikelentwürfe bleiben in dieser Sitzung erhalten. Beim Neuladen werden sie zurückgesetzt.'
                : 'Gespeicherte Wiki-Inhalte werden mit deinem Konto synchronisiert. Ungespeicherte Entwürfe bleiben bis zum Neuladen in dieser Sitzung erhalten.'}</Muted>
            <p role="status" aria-live="polite">{message}</p>
            {error && <ErrorText role="alert">{error}</ErrorText>}

            {section === 'home' && <>
                <Grid>
                    <Card><h2>{wiki.data.articles.length}</h2><p>Artikel</p><TextLink to="/wiki/articles">Alle Artikel ansehen</TextLink></Card>
                    <Card><h2>{wiki.data.categories.length}</h2><p>Kategorien</p><TextLink to="/wiki/categories">Kategorien verwalten</TextLink></Card>
                    <Card><h2>{wiki.data.articles.filter((entry) => entry.categoryId === null).length}</h2><p>Artikel ohne Kategorie</p><TextLink to="/wiki/articles?category=none">Artikel zuordnen</TextLink></Card>
                </Grid>
                <Toolbar><h2>Zuletzt bearbeitet</h2><ButtonLink to="/wiki/search">Wiki durchsuchen</ButtonLink></Toolbar>
                <ArticleList articles={searchWikiArticles(wiki.data, '').slice(0, 5)} categories={wiki.data.categories} emptyMessage="Noch keine Artikel vorhanden. Lege den ersten Artikel an." />
            </>}

            {section === 'categories' && <CategoryDirectory wiki={wiki} />}

            {editorParam !== null && (editorValid ? <ArticleEditor key={editorParam}
                draft={wiki.getArticleDraft(editingId)} categories={wiki.data.categories} isEditing={editingId !== null}
                onChange={(draft) => wiki.changeArticleDraft(editingId, draft)}
                onSave={() => {
                    const result = wiki.saveArticle(editingId);
                    if (!result.error) { setMessage('Artikel gespeichert.'); setError(''); navigate(`/wiki/articles?article=${result.articleId}`); }
                    return result.error;
                }}
                onDiscard={() => { wiki.discardArticleDraft(editingId); navigate(editingId === null ? '/wiki/articles' : `/wiki/articles?article=${editingId}`); }}
            /> : missingArticle)}

            {editorParam === null && articleParam !== null && (article ? <ArticleReader article={article} categories={wiki.data.categories}
                hasDraft={!!wiki.drafts[String(article.id)]} onDelete={() => { setError(''); setDeleteTarget(article); }} /> : missingArticle)}

            {(section === 'articles' || section === 'search') && editorParam === null && articleParam === null && <>
                <Filters>
                    <Field>{section === 'search' ? 'Suchbegriff' : 'Artikel suchen'}<Input type="search" value={query} onChange={(event) => setFilter('q', event.target.value)} placeholder="Titel, Inhalt oder Kategorie" /></Field>
                    <Field>Kategorie<Select value={category} onChange={(event) => setFilter('category', event.target.value === 'all' ? '' : event.target.value)}>
                        <option value="all">Alle Kategorien</option><option value="none">Ohne Kategorie</option>
                        {wiki.data.categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                    </Select></Field>
                    <Field>Sortierung<Select value={sort} onChange={(event) => setFilter('sort', event.target.value)}>
                        <option value="updated">Zuletzt bearbeitet</option><option value="created">Zuletzt erstellt</option><option value="title">Titel A–Z</option>
                    </Select></Field>
                </Filters>
                {section === 'search' && !query.trim() ? <Card>Gib einen Suchbegriff ein, um Titel, Inhalte und Kategorien zu durchsuchen.</Card> : <>
                    <Muted aria-live="polite">{articles.length} von {wiki.data.articles.length} Artikeln</Muted>
                    <ArticleList articles={articles} categories={wiki.data.categories} emptyMessage={wiki.data.articles.length === 0 ? 'Noch keine Artikel vorhanden. Lege den ersten Artikel an.' : 'Keine Artikel passen zur Suche und zur gewählten Kategorie.'} />
                </>}
            </>}

            {deleteTarget && active && <Dialog title="Artikel löschen?" onClose={() => setDeleteTarget(null)}>
                <p>„{deleteTarget.title}“ wirklich löschen? Ein ungespeicherter Entwurf dieses Artikels wird ebenfalls entfernt.</p>
                <FormActions><SecondaryButton autoFocus onClick={() => setDeleteTarget(null)}>Abbrechen</SecondaryButton>
                    <DangerButton onClick={() => {
                        const failure = wiki.removeArticle(deleteTarget.id);
                        setError(failure ?? '');
                        if (!failure) { setMessage('Artikel gelöscht.'); navigate('/wiki/articles'); }
                        setDeleteTarget(null);
                    }}>Artikel löschen</DangerButton>
                </FormActions>
            </Dialog>}
        </Page>
    );
}
