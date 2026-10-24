ALTER TABLE ff_wiki_articles ADD COLUMN parent_id BIGINT;
ALTER TABLE ff_wiki_articles ADD CONSTRAINT fk_wiki_article_parent
    FOREIGN KEY (owner_id, parent_id) REFERENCES ff_wiki_articles (owner_id, id);
CREATE INDEX idx_wiki_article_parent ON ff_wiki_articles (owner_id, parent_id);
