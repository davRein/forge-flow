-- All owner IDs come from authenticated accounts. Client IDs are scoped to an owner.
CREATE TABLE ff_accounts (
    id varchar(128) PRIMARY KEY,
    email varchar(254) NOT NULL UNIQUE,
    name text NOT NULL,
    password_hash varchar(60) NOT NULL,
    CONSTRAINT account_email_normalized CHECK (email = lower(trim(email))),
    CONSTRAINT account_hash_length CHECK (length(password_hash) = 60)
);
CREATE TABLE ff_workspaces (
    owner_id varchar(128) PRIMARY KEY REFERENCES ff_accounts(id),
    revision varchar(128) NOT NULL
);
CREATE TABLE ff_settings (
    owner_id varchar(128) PRIMARY KEY REFERENCES ff_accounts(id),
    theme_mode varchar(10) NOT NULL CHECK (theme_mode IN ('dark', 'light')),
    default_project_view varchar(20) NOT NULL CHECK (default_project_view IN ('dashboard', 'projects')),
    default_task_priority varchar(10) NOT NULL CHECK (default_task_priority IN ('low', 'medium', 'high'))
);

CREATE TABLE ff_customers (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    name text NOT NULL,
    street text NOT NULL,
    city text NOT NULL,
    country text NOT NULL,
    email text NOT NULL,
    website text,
    phone text NOT NULL,
    industry text NOT NULL,
    PRIMARY KEY (owner_id, id)
);

CREATE TABLE ff_projects (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    customer_id bigint NOT NULL,
    name text NOT NULL,
    planning_completed boolean NOT NULL,
    deadline text NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, customer_id) REFERENCES ff_customers(owner_id, id)
);

CREATE TABLE ff_epics (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    project_id bigint NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, project_id) REFERENCES ff_projects(owner_id, id),
    UNIQUE (owner_id, id, project_id)
);

CREATE TABLE ff_tasks (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    project_id bigint NOT NULL,
    epic_id bigint,
    code text NOT NULL,
    title text NOT NULL,
    description text,
    status text NOT NULL,
    priority text NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, project_id) REFERENCES ff_projects(owner_id, id),
    FOREIGN KEY (owner_id, epic_id, project_id) REFERENCES ff_epics(owner_id, id, project_id),
    CHECK (status IN ('todo', 'inProgress', 'done')),
    CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE TABLE ff_activities (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    project_id bigint NOT NULL,
    type text NOT NULL,
    message text NOT NULL,
    created_at text NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, project_id) REFERENCES ff_projects(owner_id, id)
);

CREATE TABLE ff_sprints (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    project_id bigint NOT NULL,
    title text NOT NULL,
    goal text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    status text NOT NULL,
    task_ids text NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    started_at text,
    completion text,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, project_id) REFERENCES ff_projects(owner_id, id),
    CHECK (status IN ('planned', 'active', 'completed')),
    CHECK ((status = 'completed' AND completion IS NOT NULL) OR (status <> 'completed' AND completion IS NULL))
);

CREATE TABLE ff_files (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    project_id bigint NOT NULL,
    name text NOT NULL,
    size bigint NOT NULL,
    media_type text NOT NULL,
    last_modified bigint NOT NULL,
    added_at text NOT NULL,
    updated_at text NOT NULL,
    content bytea NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, project_id) REFERENCES ff_projects(owner_id, id),
    CHECK (size >= 0 AND size <= 20971520),
    CHECK (octet_length(content) = size)
);

CREATE TABLE ff_wiki_categories (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    name text NOT NULL,
    description text NOT NULL,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    PRIMARY KEY (owner_id, id)
);

CREATE TABLE ff_wiki_articles (
    owner_id varchar(128) NOT NULL REFERENCES ff_workspaces(owner_id),
    id bigint NOT NULL CHECK (id > 0 AND id <= 9007199254740991),
    sort_order integer NOT NULL CHECK (sort_order >= 0),
    title text NOT NULL,
    content text NOT NULL,
    category_id bigint,
    created_at text NOT NULL,
    updated_at text NOT NULL,
    PRIMARY KEY (owner_id, id),
    FOREIGN KEY (owner_id, category_id) REFERENCES ff_wiki_categories(owner_id, id)
);

