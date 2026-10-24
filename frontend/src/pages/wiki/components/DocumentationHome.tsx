import { useTranslation } from '../../../hooks/languageContext';
import type { WikiData } from '../types/wiki.types';
import { searchWikiArticles } from '../utils/wikiLogic';
import { Actions, ButtonLink, Card, Grid, Muted, PrimaryLink, TextLink, Toolbar } from '../styles/wikiStyles';
import { Eyebrow, Hero, SpaceBadge } from '../styles/documentationStyles';
import ArticleList from './ArticleList';

export default function DocumentationHome({ data }: { data: WikiData }) {
    const { t, language } = useTranslation();
    return <>
        <Hero><Eyebrow>{t('Gemeinsam Wissen strukturieren')}</Eyebrow><h2>{t('Ein Zuhause für dein Wissen.')}</h2>
            <Muted>{t('Dokumentiere Projekte, halte Entscheidungen fest und mache Wissen in klaren Bereichen und Seiten auffindbar.')}</Muted>
            <Actions><PrimaryLink to="/wiki/articles?edit=new">{t('+ Seite erstellen')}</PrimaryLink><ButtonLink to="/wiki/categories">{t('Bereiche verwalten')}</ButtonLink></Actions>
        </Hero>
        <Toolbar><h2>{t('Deine Bereiche')}</h2><TextLink to="/wiki/categories">{t('Alle Bereiche')}</TextLink></Toolbar>
        <Grid>{data.categories.map(space => <Card key={space.id} as="article"><SpaceBadge aria-hidden="true">{space.name.slice(0, 1).toLocaleUpperCase(language)}</SpaceBadge>
            <h3><TextLink to={`/wiki/articles?category=${space.id}`}>{space.name}</TextLink></h3><Muted>{space.description || t('Wissen, das zusammengehört.')}</Muted>
            <TextLink to={`/wiki/articles?category=${space.id}`}>{t('{count} Seiten', { count: data.articles.filter(page => page.categoryId === space.id).length })} →</TextLink>
        </Card>)}</Grid>
        {data.categories.length === 0 && <Card><h3>{t('Dein erster Dokumentationsbereich')}</h3><Muted>{t('Lege einen Bereich für ein Projekt, ein Thema oder deine Arbeitsabläufe an.')}</Muted><ButtonLink to="/wiki/categories">{t('Bereich anlegen')}</ButtonLink></Card>}
        <Toolbar><h2>{t('Zuletzt bearbeitet')}</h2><TextLink to="/wiki/articles">{t('Alle Seiten')}</TextLink></Toolbar>
        <ArticleList articles={searchWikiArticles(data, '', 'all', 'updated', language).slice(0, 6)} categories={data.categories} emptyMessage={t('Noch keine Seiten vorhanden. Erstelle deine erste Seite.')} />
    </>;
}
