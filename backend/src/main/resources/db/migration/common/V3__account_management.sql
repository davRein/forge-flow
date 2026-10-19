ALTER TABLE ff_accounts ADD COLUMN administrator boolean NOT NULL DEFAULT false;
ALTER TABLE ff_accounts ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE ff_accounts ADD COLUMN session_version bigint NOT NULL DEFAULT 0 CHECK (session_version >= 0);

-- The existing configured account receives administrator status once during bootstrap.
-- Persisting this marker prevents normal application starts from restoring revoked privileges.
CREATE TABLE ff_account_setup (
    id integer PRIMARY KEY CHECK (id = 1),
    administrator_assigned boolean NOT NULL
);
INSERT INTO ff_account_setup(id, administrator_assigned) VALUES (1, false);
