import type { WikiArticleDraft, WikiCategoryDraft, WikiCategoryFilter, WikiData, WikiSort } from '../types/wiki.types';

type Result = { data: WikiData; error: string | null };
const normalized = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('de');

export function wikiHierarchyError(articles: WikiData['articles']): string | null {
    const pages = new Map(articles.map(page => [page.id, page]));
    for (const page of articles) {
        const seen = new Set<number>();
        let current: typeof page | undefined = page;
        while (current) {
            if (seen.has(current.id)) return 'Die Seitenhierarchie darf keine Schleifen enthalten.';
            seen.add(current.id);
            if (seen.size > 12) return 'Höchstens zwölf Seitenebenen sind erlaubt.';
            if (current.parentId == null) break;
            const parent = pages.get(current.parentId);
            if (!parent || parent.categoryId !== page.categoryId) return 'Die übergeordnete Seite muss im selben Bereich vorhanden sein.';
            current = parent;
        }
    }
    return null;
}

export function wikiAncestors(articles: WikiData['articles'], id: number): WikiData['articles'] {
    const pages = new Map(articles.map(page => [page.id, page]));
    const path: WikiData['articles'] = [];
    let page = pages.get(id);
    const seen = new Set<number>();
    while (page && !seen.has(page.id) && path.length < 12) {
        path.unshift(page); seen.add(page.id); page = page.parentId == null ? undefined : pages.get(page.parentId);
    }
    return path;
}

export function wikiDescendants(articles: WikiData['articles'], id: number): Set<number> {
    const children = new Map<number, number[]>();
    for (const page of articles) if (page.parentId != null) { const group = children.get(page.parentId) ?? []; group.push(page.id); children.set(page.parentId, group); }
    const result = new Set<number>();
    const queue = [id];
    for (let index = 0; index < queue.length; index++) {
        for (const child of children.get(queue[index]) ?? []) if (child !== id && !result.has(child)) { result.add(child); queue.push(child); }
    }
    return result;
}

export function saveWikiArticle(data: WikiData, draft: WikiArticleDraft, editingId: number | null, nextId: number, now: string): Result {
    if (!draft.title.trim() || !draft.content.trim()) return { data, error: 'Bitte Titel und Inhalt des Artikels ausfüllen.' };
    if (draft.categoryId !== null && !data.categories.some((category) => category.id === draft.categoryId)) {
        return { data, error: 'Die gewählte Kategorie ist nicht mehr vorhanden. Bitte eine andere Kategorie wählen.' };
    }
    const previous = data.articles.find((article) => article.id === editingId);
    if (editingId !== null && !previous) return { data, error: 'Dieser Artikel ist nicht mehr vorhanden.' };
    const article = {
        id: editingId ?? nextId, title: draft.title.trim(), content: draft.content.replace(/\r\n?/g, '\n'),
        categoryId: draft.categoryId, parentId: draft.parentId ?? null, createdAt: previous?.createdAt ?? now, updatedAt: now
    };
    if (!Number.isSafeInteger(article.id) || article.id <= 0 || !previous && data.articles.some(page => page.id === article.id)) return { data, error: 'Ungültige oder bereits verwendete Seitenkennung.' };
    if (article.title.length > 1000 || article.content.length > 1000000) return { data, error: 'Titel oder Inhalt ist zu lang.' };
    const articles = previous ? data.articles.map(entry => entry.id === editingId ? article : entry) : [...data.articles, article];
    const error = wikiHierarchyError(articles);
    return error ? { data, error } : { data: { ...data, articles }, error: null };
}

export function removeWikiArticle(data: WikiData, id: number): Result {
    if (!data.articles.some((article) => article.id === id)) return { data, error: 'Dieser Artikel ist nicht mehr vorhanden.' };
    if (data.articles.some(article => article.parentId === id)) return { data, error: 'Diese Seite hat Unterseiten. Bitte diese zuerst verschieben oder entfernen.' };
    return { data: { ...data, articles: data.articles.filter((article) => article.id !== id) }, error: null };
}

export function saveWikiCategory(data: WikiData, draft: WikiCategoryDraft, editingId: number | null, nextId: number, now: string): Result {
    if (!draft.name.trim()) return { data, error: 'Bitte einen Kategorienamen angeben.' };
    const previous = data.categories.find((category) => category.id === editingId);
    if (editingId !== null && !previous) return { data, error: 'Diese Kategorie ist nicht mehr vorhanden.' };
    if (data.categories.some((category) => category.id !== editingId && normalized(category.name) === normalized(draft.name))) {
        return { data, error: 'Eine Kategorie mit diesem Namen ist bereits vorhanden.' };
    }
    const category = { id: editingId ?? nextId, name: draft.name.trim(), description: draft.description.trim(), createdAt: previous?.createdAt ?? now, updatedAt: now };
    return { data: { ...data, categories: previous
        ? data.categories.map((entry) => entry.id === editingId ? category : entry) : [...data.categories, category] }, error: null };
}

export function removeWikiCategory(data: WikiData, id: number, targetCategoryId: number | null, now: string): Result {
    if (!data.categories.some((category) => category.id === id)) return { data, error: 'Diese Kategorie ist nicht mehr vorhanden.' };
    if (targetCategoryId === id || (targetCategoryId !== null && !data.categories.some((category) => category.id === targetCategoryId))) {
        return { data, error: 'Bitte eine andere vorhandene Kategorie oder „Ohne Kategorie“ wählen.' };
    }
    return { data: {
        categories: data.categories.filter((category) => category.id !== id),
        articles: data.articles.map((article) => article.categoryId === id
            ? { ...article, categoryId: targetCategoryId, updatedAt: now } : article)
    }, error: null };
}

export function searchWikiArticles(data: WikiData, query: string, category: WikiCategoryFilter = 'all', sort: WikiSort = 'updated', language = 'de') {
    const terms = normalized(query).split(/\s+/).filter(Boolean);
    return data.articles.filter((article) => {
        if (category === 'none' && article.categoryId !== null) return false;
        if (typeof category === 'number' && article.categoryId !== category) return false;
        const categoryName = data.categories.find((entry) => entry.id === article.categoryId)?.name ?? '';
        const text = normalized(`${article.title} ${article.content} ${categoryName}`);
        return terms.every((term) => text.includes(term));
    }).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, language)
        : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) || b.id - a.id
        : b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

export function parseWikiId(value: string | null) {
    if (!value || !/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}
