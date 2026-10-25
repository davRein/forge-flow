CREATE TABLE ff_time_tracking (
    owner_id VARCHAR(128) PRIMARY KEY REFERENCES ff_accounts(id),
    revision VARCHAR(128) NOT NULL,
    payload TEXT NOT NULL
);
