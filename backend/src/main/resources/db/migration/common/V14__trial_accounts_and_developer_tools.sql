ALTER TABLE ff_accounts ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX ff_accounts_expiry ON ff_accounts(expires_at);
CREATE TABLE ff_developer_data (
    owner_id VARCHAR(128) PRIMARY KEY REFERENCES ff_accounts(id),
    revision VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL
);
