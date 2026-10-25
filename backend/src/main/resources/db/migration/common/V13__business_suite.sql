ALTER TABLE ff_accounts ADD COLUMN portal_only BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE ff_business (
    owner_id VARCHAR(128) PRIMARY KEY REFERENCES ff_accounts(id),
    revision VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL
);
CREATE TABLE ff_portal_links (
    user_id VARCHAR(128) PRIMARY KEY REFERENCES ff_accounts(id),
    owner_id VARCHAR(128) NOT NULL REFERENCES ff_accounts(id),
    revision VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL
);
CREATE INDEX ff_portal_links_owner ON ff_portal_links(owner_id);
