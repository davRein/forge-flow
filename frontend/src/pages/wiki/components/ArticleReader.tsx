import { useTranslation } from '../../../hooks/languageContext';
import type { WikiArticle, WikiCategory } from '../types/wiki.types';
import ArticleContent from './ArticleContent';
import { Actions, ButtonLink, Card, DangerButton, Muted, TextLink, Toolbar } from '../styles/wikiStyles';
import { Breadcrumbs, ReadingCard, ReadingLayout } from '../styles/documentationStyles';
import { wikiAncestors } from '../utils/wikiLogic';
import { parseMarkdown } from '../utils/markdown';

type Props = { article: WikiArticle; articles?: WikiArticle[]; categories: WikiCategory[]; hasDraft: boolean; onDelete: () => void };

export default function ArticleReader({ article, articles = [article], categories, hasDraft, onDelete }: Props) {
    const { t, locale } = useTranslation();
    const category = categories.find((entry) => entry.id === article.categoryId);
    const ancestors = wikiAncestors(articles, article.id).slice(0, -1);
    const children = articles.filter(page => page.parentId === article.id);
    const headings = parseMarkdown(article.content).flatMap((block, index) => block.type === 'heading' ? [{ text: block.text, level: block.level, id: `wiki-${article.id}-${index}` }] : []);
    const words = article.content.trim().split(/\s+/).length;
    return (
        <ReadingCard>
            <Breadcrumbs aria-label={t('Brotkrumennavigation')}><TextLink to="/wiki/home">{t('Dokumentation')}</TextLink><span aria-hidden="true">/</span>
                <TextLink to={`/wiki/articles?category=${category?.id ?? 'none'}`}>{category?.name ?? t('Ohne Bereich')}</TextLink>
                {ancestors.map(page => <span key={page.id}> / <TextLink to={`/wiki/articles?article=${page.id}`}>{page.title}</TextLink></span>)}
                <span aria-hidden="true">/</span><span aria-current="page">{article.title}</span>
            </Breadcrumbs>
            <Toolbar>
                <ButtonLink to={`/wiki/articles?category=${category?.id ?? 'none'}`}>{t('← Alle Seiten im Bereich')}</ButtonLink>
                <Actions>
                    <ButtonLink to={`/wiki/articles?edit=new&parent=${article.id}`}>{t('+ Unterseite')}</ButtonLink>
                    <ButtonLink to={`/wiki/articles?edit=${article.id}`}>{hasDraft ? t('Entwurf fortsetzen') : t('Seite bearbeiten')}</ButtonLink>
                    <DangerButton onClick={onDelete}>{t('Seite löschen')}</DangerButton>
                </Actions>
            </Toolbar>
            <h2>{article.title}</h2>
            <Muted>{t('Erstellt:')} {new Date(article.createdAt).toLocaleDateString(locale)} · {t('Bearbeitet:')} <time dateTime={article.updatedAt}>{new Date(article.updatedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</time> · {t('{count} Min. Lesezeit', { count: Math.max(1, Math.ceil(words / 200)) })}</Muted>
            <ReadingLayout><article aria-label={t('Seiteninhalt')}><ArticleContent content={article.content} idPrefix={`wiki-${article.id}`} /></article>
                {headings.length > 0 && <nav aria-label={t('Auf dieser Seite')}><h3>{t('Auf dieser Seite')}</h3>{headings.map(heading => <button key={heading.id} type="button" style={{ paddingLeft: (heading.level - 1) * 8 }}
                    onClick={() => document.getElementById(heading.id)?.scrollIntoView({ behavior: 'auto', block: 'start' })}>{heading.text}</button>)}</nav>}
            </ReadingLayout>
            {children.length > 0 && <section style={{ marginTop: 30 }}><h3>{t('Unterseiten')}</h3>{children.map(page => <Card key={page.id} style={{ marginTop: 10, padding: 14 }}><TextLink to={`/wiki/articles?article=${page.id}`}>{page.title} →</TextLink></Card>)}</section>}
        </ReadingCard>
    );
}
