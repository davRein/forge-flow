import { useRef, useState } from 'react';
import { useWorkspaceField } from '../../../hooks/workspaceContext';
import { useChatNavigationBlocker } from '../../../hooks/chatNavigationContext';
import type { WikiArticle, WikiArticleDraft, WikiCategoryDraft } from '../types/wiki.types';
import { removeWikiArticle, removeWikiCategory, saveWikiArticle, saveWikiCategory } from '../utils/wikiLogic';

const draftKey = (id: number | null) => id === null ? 'new' : String(id);
const version = (page?: WikiArticle) => JSON.stringify(page ? [page.id, page.title, page.content, page.categoryId, page.parentId ?? null, page.createdAt, page.updatedAt] : null);

export function useWiki() {
    const [data, setData] = useWorkspaceField('wiki');
    const [drafts, setDrafts] = useState<Record<string, WikiArticleDraft>>({});
    const originals = useRef(new Map<string, string>());
    useChatNavigationBlocker(Object.keys(drafts).length > 0);
    const nextArticleId = useRef(Math.max(0, ...data.articles.map((article) => article.id)) + 1);
    const nextCategoryId = useRef(Math.max(0, ...data.categories.map((category) => category.id)) + 1);

    function getArticleDraft(id: number | null): WikiArticleDraft {
        const saved = drafts[draftKey(id)];
        if (saved) return saved;
        const article = data.articles.find((entry) => entry.id === id);
        return article ? { title: article.title, content: article.content, categoryId: article.categoryId, parentId: article.parentId ?? null }
            : { title: '', content: '', categoryId: null, parentId: null };
    }

    function changeArticleDraft(id: number | null, draft: WikiArticleDraft) {
        if (id !== null && !originals.current.has(String(id))) originals.current.set(String(id), version(data.articles.find(page => page.id === id)));
        setDrafts((current) => ({ ...current, [draftKey(id)]: draft }));
    }

    function discardArticleDraft(id: number | null) {
        originals.current.delete(draftKey(id));
        setDrafts((current) => { const next = { ...current }; delete next[draftKey(id)]; return next; });
    }

    function saveArticle(id: number | null) {
        if (id !== null && originals.current.has(String(id)) && originals.current.get(String(id)) !== version(data.articles.find(page => page.id === id))) {
            return { error: 'Diese Seite wurde inzwischen geändert. Verwirf den Entwurf und lade die aktuelle Seite.', articleId: null };
        }
        nextArticleId.current = Math.max(nextArticleId.current, ...data.articles.map(article => article.id + 1));
        const result = saveWikiArticle(data, getArticleDraft(id), id, nextArticleId.current, new Date().toISOString());
        if (result.error) return { error: result.error, articleId: null };
        const articleId = id ?? nextArticleId.current++;
        setData(result.data);
        discardArticleDraft(id);
        return { error: null, articleId };
    }

    function removeArticle(id: number) {
        const result = removeWikiArticle(data, id);
        if (!result.error) { setData(result.data); discardArticleDraft(id); }
        return result.error;
    }

    function saveCategory(draft: WikiCategoryDraft, id: number | null) {
        nextCategoryId.current = Math.max(nextCategoryId.current, ...data.categories.map(category => category.id + 1));
        const result = saveWikiCategory(data, draft, id, nextCategoryId.current, new Date().toISOString());
        if (!result.error) { if (id === null) nextCategoryId.current++; setData(result.data); }
        return result.error;
    }

    function removeCategory(id: number, targetId: number | null) {
        const result = removeWikiCategory(data, id, targetId, new Date().toISOString());
        if (!result.error) {
            setData(result.data);
            setDrafts((current) => Object.fromEntries(Object.entries(current).map(([key, draft]) =>
                [key, draft.categoryId === id ? { ...draft, categoryId: targetId } : draft])));
        }
        return result.error;
    }

    return { data, drafts, getArticleDraft, changeArticleDraft, discardArticleDraft, saveArticle, removeArticle, saveCategory, removeCategory };
}
