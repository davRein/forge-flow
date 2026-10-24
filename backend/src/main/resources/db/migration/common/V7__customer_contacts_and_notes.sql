ALTER TABLE ff_customers ADD COLUMN notes TEXT NOT NULL DEFAULT '';

CREATE TABLE ff_customer_contacts (
    owner_id VARCHAR(128) NOT NULL,
    id BIGINT NOT NULL CHECK (id > 0),
    customer_id BIGINT NOT NULL,
    sort_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    role VARCHAR(200) NOT NULL,
    email VARCHAR(254) NOT NULL,
    phone VARCHAR(100) NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, customer_id) REFERENCES ff_customers(owner_id, id) ON DELETE CASCADE
);
CREATE INDEX ff_customer_contacts_customer ON ff_customer_contacts(owner_id, customer_id);
