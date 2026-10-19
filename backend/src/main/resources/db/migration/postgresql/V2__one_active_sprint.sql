-- Enforce the project rule even if a future writer bypasses the application.
CREATE UNIQUE INDEX ff_one_active_sprint ON ff_sprints(owner_id, project_id) WHERE status = 'active';

