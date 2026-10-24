import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../../hooks/languageContext';
import type { WikiCategoryFilter, WikiData } from '../types/wiki.types';
import { wikiAncestors } from '../utils/wikiLogic';
import { Field, Muted, Select } from '../styles/wikiStyles';
import { Eyebrow, Sidebar, SidebarLink, TreeRow } from '../styles/documentationStyles';

type Props = { data: WikiData; selectedId: number | null; category: WikiCategoryFilter; onCategory: (value: string) => void };

export default function DocumentationSidebar({ data, selectedId, category, onCategory }: Props) {
    const { t, language } = useTranslation();
    const [tree, setTree] = useState<{ selection: number | null; collapsed: Set<number> }>({ selection: selectedId, collapsed: new Set() });
    const path = new Set(selectedId === null ? [] : wikiAncestors(data.articles, selectedId).map(page => page.id));
    const collapsed = tree.selection === selectedId ? tree.collapsed : new Set([...tree.collapsed].filter(id => !path.has(id)));
    const pages = data.articles.filter(page => category === 'all' || (category === 'none' ? page.categoryId === null : page.categoryId === category));
    const children = new Map<number | null, typeof pages>();
    for (const page of pages) { const parent = page.parentId ?? null; const group = children.get(parent) ?? []; group.push(page); children.set(parent, group); }
    let shown = 0;
    function branch(parent: number | null, depth = 0): ReactNode {
        if (depth >= 12 || shown >= 250) return null;
        return <ul>{(children.get(parent) ?? []).slice().sort((a, b) => Number(path.has(b.id)) - Number(path.has(a.id)) || a.title.localeCompare(b.title, language)).map(page => {
            if (shown++ >= 250) return null;
            const hasChildren = !!children.get(page.id)?.length;
            const open = !collapsed.has(page.id);
            return <li key={page.id}><TreeRow>
                {hasChildren ? <button type="button" aria-label={t(open ? 'Unterseiten einklappen: {title}' : 'Unterseiten aufklappen: {title}', { title: page.title })} aria-expanded={open}
                    onClick={() => { const next = new Set(collapsed); if (open) next.add(page.id); else next.delete(page.id); setTree({ selection: selectedId, collapsed: next }); }}>{open ? '⌄' : '›'}</button> : <span aria-hidden="true">▤</span>}
                <SidebarLink to={`/wiki/articles?article=${page.id}`} title={page.title} aria-current={selectedId === page.id ? 'page' : undefined}>{page.title}</SidebarLink>
            </TreeRow>{hasChildren && open && branch(page.id, depth + 1)}</li>;
        })}</ul>;
    }
    return <Sidebar aria-label={t('Dokumentationsnavigation')}>
        <Eyebrow>{t('Wissensbasis')}</Eyebrow>
        <SidebarLink to="/wiki/home">{t('Übersicht')}</SidebarLink>
        <SidebarLink to="/wiki/categories">{t('Bereiche verwalten')}</SidebarLink>
        <SidebarLink to="/wiki/search">{t('Dokumentation durchsuchen')}</SidebarLink>
        <Field>{t('Bereich')}<Select value={category} onChange={event => onCategory(event.target.value)}>
            <option value="all">{t('Alle Bereiche')}</option><option value="none">{t('Ohne Bereich')}</option>
            {data.categories.map(space => <option key={space.id} value={space.id}>{space.name}</option>)}
        </Select></Field>
        <h2>{t('Seitenbaum')}</h2>
        <nav aria-label={t('Seitenbaum')}>{branch(null)}</nav>
        {pages.length === 0 && <Muted>{t('Noch keine Seiten in diesem Bereich.')}</Muted>}
        {pages.length > 250 && <Muted>{t('Weitere Seiten findest du über die Suche.')}</Muted>}
    </Sidebar>;
}
