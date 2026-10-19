import type { WikiArticle, WikiCategory } from '../types/wiki.types';
import ArticleContent from './ArticleContent';
import { Actions, ButtonLink, Card, DangerButton, Muted, TextLink, Toolbar } from '../styles/wikiStyles';

type Props = { article: WikiArticle; categories: WikiCategory[]; hasDraft: boolean; onDelete: () => void };

export default function ArticleReader({ article, categories, hasDraft, onDelete }: Props) {
    const category = categories.find((entry) => entry.id === article.categoryId);
    return (
        <Card as="article">
            <Toolbar>
                <ButtonLink to="/wiki/articles">← Zur Artikelliste</ButtonLink>
                <Actions>
                    <ButtonLink to={`/wiki/articles?edit=${article.id}`}>{hasDraft ? 'Entwurf fortsetzen' : 'Artikel bearbeiten'}</ButtonLink>
                    <DangerButton onClick={onDelete}>Artikel löschen</DangerButton>
                </Actions>
            </Toolbar>
            <h2>{article.title}</h2>
            <Muted><TextLink to={`/wiki/articles?category=${category?.id ?? 'none'}`}>{category?.name ?? 'Ohne Kategorie'}</TextLink></Muted>
            <Muted>Erstellt: {new Date(article.createdAt).toLocaleDateString('de-DE')} · Bearbeitet: <time dateTime={article.updatedAt}>{new Date(article.updatedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</time></Muted>
            <ArticleContent content={article.content} />
        </Card>
    );
}
