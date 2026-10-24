-- Conversation memory and execution history have separate lifecycles, scoped to accounts.
CREATE TABLE ff_ai_store_lock (id integer PRIMARY KEY CHECK (id = 1));
INSERT INTO ff_ai_store_lock(id) VALUES (1);
CREATE TABLE ff_ai_conversations (
    id uuid PRIMARY KEY,
    owner_id varchar(128) NOT NULL REFERENCES ff_accounts(id),
    language varchar(2) NOT NULL CHECK (language IN ('de', 'en')),
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    pending_until timestamp with time zone,
    payload text NOT NULL,
    UNIQUE (owner_id, id)
);
CREATE INDEX ff_ai_conversations_owner_updated ON ff_ai_conversations(owner_id, updated_at);
CREATE INDEX ff_ai_conversations_retention ON ff_ai_conversations(updated_at);
CREATE TABLE ff_ai_executions (
    id uuid PRIMARY KEY,
    owner_id varchar(128) NOT NULL,
    conversation_id uuid NOT NULL,
    request_id uuid NOT NULL,
    sequence_number bigint NOT NULL,
    status varchar(16) NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled', 'interrupted')),
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone,
    error_code varchar(64),
    payload text NOT NULL,
    FOREIGN KEY (owner_id, conversation_id) REFERENCES ff_ai_conversations(owner_id, id) ON DELETE CASCADE
);
CREATE INDEX ff_ai_executions_conversation ON ff_ai_executions(owner_id, conversation_id, started_at);
