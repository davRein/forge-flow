import type { WikiArticle, WikiCategory } from '../types/wiki.types';
import { Card, Grid, Muted, TextLink, Actions, ButtonLink } from '../styles/wikiStyles';

type Props = { articles: WikiArticle[]; categories: WikiCategory[]; emptyMessage?: string };

export default function ArticleList({ articles, categories, emptyMessage = 'Keine Artikel gefunden.' }: Props) {
    if (articles.length === 0) return <Card><p>{emptyMessage}</p></Card>;

    return (
        <Grid>
            {articles.map((article) => {
                const category = categories.find((entry) => entry.id === article.categoryId);
                const excerpt = article.content.replace(/[#*`]/g, '').replace(/\s+/g, ' ').trim();
                return (
                    <Card as="article" key={article.id}>
                        <h2><TextLink to={`/wiki/articles?article=${article.id}`}>{article.title}</TextLink></h2>
                        <Muted>
                            <TextLink to={`/wiki/articles?category=${category?.id ?? 'none'}`}>{category?.name ?? 'Ohne Kategorie'}</TextLink>
                        </Muted>
                        <p>{excerpt.slice(0, 180)}{excerpt.length > 180 ? ' …' : ''}</p>
                        <Muted>Bearbeitet: <time dateTime={article.updatedAt}>{new Date(article.updatedAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}</time></Muted>
                        <Actions>
                            <ButtonLink to={`/wiki/articles?article=${article.id}`}>Lesen</ButtonLink>
                            <ButtonLink to={`/wiki/articles?edit=${article.id}`}>Bearbeiten</ButtonLink>
                        </Actions>
                    </Card>
                );
            })}
        </Grid>
    );
}
