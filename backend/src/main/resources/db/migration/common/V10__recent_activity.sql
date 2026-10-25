CREATE TABLE ff_recent_activity (
    owner_id VARCHAR(128) PRIMARY KEY REFERENCES ff_accounts(id),
    payload TEXT NOT NULL
);
