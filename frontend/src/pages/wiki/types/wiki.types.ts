export type WikiCategory = {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
};

export type WikiArticle = {
    id: number;
    title: string;
    content: string;
    categoryId: number | null;
    parentId?: number | null;
    createdAt: string;
    updatedAt: string;
};

export type WikiData = { articles: WikiArticle[]; categories: WikiCategory[] };
export type WikiArticleDraft = Pick<WikiArticle, 'title' | 'content' | 'categoryId' | 'parentId'>;
export type WikiCategoryDraft = Pick<WikiCategory, 'name' | 'description'>;
export type WikiCategoryFilter = 'all' | 'none' | number;
export type WikiSort = 'updated' | 'created' | 'title';
