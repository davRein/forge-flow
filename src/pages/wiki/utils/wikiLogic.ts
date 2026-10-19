import type { WikiArticleDraft, WikiCategoryDraft, WikiCategoryFilter, WikiData, WikiSort } from '../types/wiki.types';

type Result = { data: WikiData; error: string | null };
const normalized = (value: string) => value.trim().normalize('NFC').toLocaleLowerCase('de');

export function saveWikiArticle(data: WikiData, draft: WikiArticleDraft, editingId: number | null, nextId: number, now: string): Result {
    if (!draft.title.trim() || !draft.content.trim()) return { data, error: 'Bitte Titel und Inhalt des Artikels ausfüllen.' };
    if (draft.categoryId !== null && !data.categories.some((category) => category.id === draft.categoryId)) {
        return { data, error: 'Die gewählte Kategorie ist nicht mehr vorhanden. Bitte eine andere Kategorie wählen.' };
    }
    const previous = data.articles.find((article) => article.id === editingId);
    if (editingId !== null && !previous) return { data, error: 'Dieser Artikel ist nicht mehr vorhanden.' };
    const article = {
        id: editingId ?? nextId, title: draft.title.trim(), content: draft.content.replace(/\r\n?/g, '\n'),
        categoryId: draft.categoryId, createdAt: previous?.createdAt ?? now, updatedAt: now
    };
    return { data: { ...data, articles: previous
        ? data.articles.map((entry) => entry.id === editingId ? article : entry) : [...data.articles, article] }, error: null };
}

export function removeWikiArticle(data: WikiData, id: number): Result {
    if (!data.articles.some((article) => article.id === id)) return { data, error: 'Dieser Artikel ist nicht mehr vorhanden.' };
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

export function searchWikiArticles(data: WikiData, query: string, category: WikiCategoryFilter = 'all', sort: WikiSort = 'updated') {
    const terms = normalized(query).split(/\s+/).filter(Boolean);
    return data.articles.filter((article) => {
        if (category === 'none' && article.categoryId !== null) return false;
        if (typeof category === 'number' && article.categoryId !== category) return false;
        const categoryName = data.categories.find((entry) => entry.id === article.categoryId)?.name ?? '';
        const text = normalized(`${article.title} ${article.content} ${categoryName}`);
        return terms.every((term) => text.includes(term));
    }).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title, 'de')
        : sort === 'created' ? b.createdAt.localeCompare(a.createdAt) || b.id - a.id
        : b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
}

export function parseWikiId(value: string | null) {
    if (!value || !/^[1-9]\d*$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}
