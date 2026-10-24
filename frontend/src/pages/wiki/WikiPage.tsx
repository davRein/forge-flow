import { useTranslation } from '../../hooks/languageContext';
import { useState } from 'react';
import { useWorkspacePersistence } from '../../hooks/workspaceContext';
import { useChatNavigationBlocker } from '../../hooks/chatNavigationContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Dialog from '../../components/ui/Dialog';
import { useWiki } from './hooks/useWiki';
import type { WikiArticle, WikiCategoryFilter, WikiSort } from './types/wiki.types';
import { parseWikiId, searchWikiArticles } from './utils/wikiLogic';
import ArticleEditor from './components/ArticleEditor';
import ArticleList from './components/ArticleList';
import ArticleReader from './components/ArticleReader';
import CategoryDirectory from './components/CategoryDirectory';
import DocumentationSidebar from './components/DocumentationSidebar';
import DocumentationHome from './components/DocumentationHome';
import { DocumentationLayout, Eyebrow, Main } from './styles/documentationStyles';
import { ButtonLink, Card, DangerButton, ErrorText, Field, Filters, FormActions, Input, Muted, Page, PrimaryLink, SecondaryButton, Select, Toolbar } from './styles/wikiStyles';

export default function WikiPage({ section = 'home', active = true }: { section?: string; active?: boolean }) {
    const { t, language } = useTranslation();
    const wiki = useWiki();
    const persistence = useWorkspacePersistence().persistence;
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [deleteTarget, setDeleteTarget] = useState<WikiArticle | null>(null);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const articleParam = active && section === 'articles' ? params.get('article') : null;
    const editorParam = active && section === 'articles' ? params.get('edit') : null;
    useChatNavigationBlocker(editorParam !== null || deleteTarget !== null);
    const articleId = parseWikiId(articleParam);
    const editingId = editorParam === 'new' ? null : parseWikiId(editorParam);
    const article = wiki.data.articles.find((entry) => entry.id === articleId);
    const parentParam = editorParam === 'new' ? params.get('parent') : null;
    const parent = wiki.data.articles.find(page => page.id === parseWikiId(parentParam));
    const editorValid = editorParam === 'new' && (parentParam === null || !!parent) || (editingId !== null && wiki.data.articles.some((entry) => entry.id === editingId));
    const query = params.get('q') ?? '';
    const categoryId = parseWikiId(params.get('category'));
    const category: WikiCategoryFilter = params.get('category') === 'none' ? 'none'
        : categoryId !== null && wiki.data.categories.some((entry) => entry.id === categoryId) ? categoryId : 'all';
    const requestedSort = params.get('sort');
    const sort: WikiSort = requestedSort === 'title' || requestedSort === 'created' ? requestedSort : 'updated';
    const articles = searchWikiArticles(wiki.data, query, category, sort, language);
    const title = section === 'categories' ? 'Bereiche' : section === 'search' ? 'Dokumentation durchsuchen' : section === 'articles' ? 'Seiten' : 'Dokumentation';
    const baseDraft = wiki.getArticleDraft(editingId);
    const draft = editorParam === 'new' && !wiki.drafts.new ? { ...baseDraft, parentId: parent?.id ?? null, categoryId: parent ? parent.categoryId : typeof category === 'number' ? category : null } : baseDraft;
    const scope: WikiCategoryFilter = editorParam !== null ? draft.categoryId ?? 'none' : article ? article.categoryId ?? 'none' : category;
    const space = typeof category === 'number' ? wiki.data.categories.find(entry => entry.id === category) : null;

    function setFilter(key: string, value: string) {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    }

    const missingArticle = <Card><h2>{t('Seite nicht gefunden')}</h2><Muted>{t('Die Seite wurde gelöscht oder die Adresse ist ungültig.')}</Muted><ButtonLink to="/wiki/articles">{t('Alle Seiten')}</ButtonLink></Card>;

    return (
        <Page lang={language}>
            <Toolbar>
                <div><Eyebrow>{t('Wissensbasis')}</Eyebrow><h1>{t(title)}</h1></div>
                {editorParam === null && <PrimaryLink to={`/wiki/articles?edit=new${typeof scope === 'number' ? `&category=${scope}` : ''}`}>{wiki.drafts.new ? t('Neuen Entwurf fortsetzen') : t('+ Seite erstellen')}</PrimaryLink>}
            </Toolbar>
            <DocumentationLayout>
            <DocumentationSidebar data={wiki.data} selectedId={articleId ?? editingId} category={scope} onCategory={value => navigate(`/wiki/articles${value === 'all' ? '' : `?category=${value}`}`)} />
            <Main>
            <p role="status" aria-live="polite">{t(message)}</p>
            {error && <ErrorText role="alert">{t(error)}</ErrorText>}

            {section === 'home' && <DocumentationHome data={wiki.data} />}

            {section === 'categories' && <CategoryDirectory wiki={wiki} />}

            {editorParam !== null && (editorValid ? <ArticleEditor key={editorParam}
                draft={draft} articles={wiki.data.articles} editingId={editingId} categories={wiki.data.categories} isEditing={editingId !== null}
                onChange={(draft) => wiki.changeArticleDraft(editingId, draft)}
                onSave={() => {
                    const result = wiki.saveArticle(editingId);
                    if (!result.error) { setMessage('Seite gespeichert.'); setError(''); navigate(`/wiki/articles?article=${result.articleId}`); }
                    return result.error;
                }}
                onDiscard={() => { wiki.discardArticleDraft(editingId); navigate(editingId === null ? '/wiki/articles' : `/wiki/articles?article=${editingId}`); }}
            /> : missingArticle)}

            {editorParam === null && articleParam !== null && (article ? <ArticleReader article={article} articles={wiki.data.articles} categories={wiki.data.categories}
                hasDraft={!!wiki.drafts[String(article.id)]} onDelete={() => { setError(''); setDeleteTarget(article); }} /> : missingArticle)}

            {(section === 'articles' || section === 'search') && editorParam === null && articleParam === null && <>
                {space && <Card style={{ marginBottom: 24 }}><Eyebrow>{t('Dokumentationsbereich')}</Eyebrow><h2>{space.name}</h2><Muted>{space.description || t('Wissen, das zusammengehört.')}</Muted></Card>}
                <Filters>
                    <Field>{section === 'search' ? t('Suchbegriff') : t('Seite suchen')}<Input type="search" value={query} onChange={(event) => setFilter('q', event.target.value)} placeholder={t('Titel, Inhalt oder Bereich')} /></Field>
                    <Field>{t('Bereich')}<Select value={category} onChange={(event) => setFilter('category', event.target.value === 'all' ? '' : event.target.value)}>
                        <option value="all">{t('Alle Bereiche')}</option><option value="none">{t('Ohne Bereich')}</option>
                        {wiki.data.categories.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                    </Select></Field>
                    <Field>{t('Sortierung')}<Select value={sort} onChange={(event) => setFilter('sort', event.target.value)}>
                        <option value="updated">{t('Zuletzt bearbeitet')}</option><option value="created">{t('Zuletzt erstellt')}</option><option value="title">{t('Titel A–Z')}</option>
                    </Select></Field>
                </Filters>
                {section === 'search' && !query.trim() ? <Card>{t('Gib einen Suchbegriff ein, um Titel, Inhalte und Bereiche zu durchsuchen.')}</Card> : <>
                    <Muted aria-live="polite">{t('{count} von {total} Seiten', { count: articles.length, total: wiki.data.articles.length })}</Muted>
                    <ArticleList articles={articles} categories={wiki.data.categories} emptyMessage={wiki.data.articles.length === 0 ? t('Noch keine Seiten vorhanden. Erstelle deine erste Seite.') : t('Keine Seiten passen zur Suche und zum gewählten Bereich.')} />
                </>}
            </>}
            {editorParam !== null && <Muted>{persistence === 'session' ? t('Wiki-Inhalte und Artikelentwürfe bleiben in dieser Sitzung erhalten. Beim Neuladen werden sie zurückgesetzt.')
                : t('Gespeicherte Wiki-Inhalte werden mit deinem Konto synchronisiert. Ungespeicherte Entwürfe bleiben bis zum Neuladen in dieser Sitzung erhalten.')}</Muted>}
            </Main>
            </DocumentationLayout>

            {deleteTarget && active && <Dialog title={t('Seite löschen?')} onClose={() => setDeleteTarget(null)}>
                <p>{t('„{title}“ wirklich löschen? Ein ungespeicherter Entwurf dieser Seite wird ebenfalls entfernt.', { title: deleteTarget.title })}</p>
                <FormActions><SecondaryButton autoFocus onClick={() => setDeleteTarget(null)}>{t('Abbrechen')}</SecondaryButton>
                    <DangerButton onClick={() => {
                        const failure = wiki.removeArticle(deleteTarget.id);
                        setError(failure ?? '');
                        if (!failure) { setMessage('Seite gelöscht.'); navigate('/wiki/articles'); }
                        setDeleteTarget(null);
                    }}>{t('Seite löschen')}</DangerButton>
                </FormActions>
            </Dialog>}
        </Page>
    );
}
