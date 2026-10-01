-- Table: projects & project_objects
-- Purpose: Workspaces, collaboration spaces, invite codes, and join mapping relations.
-- Key strategy: ULID (26-character time-sortable).

CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT PRIMARY KEY, -- ULID
  "creator_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "invite_code" TEXT UNIQUE,
  "is_public" INTEGER DEFAULT 0,
  "is_agentic" INTEGER DEFAULT 0,
  "is_locked" INTEGER DEFAULT 0,
  "privacy_mode" INTEGER DEFAULT 0,
  "metadata" TEXT, -- JSON configuration
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_projects_creator" ON "projects"("creator_id");
CREATE INDEX IF NOT EXISTS "idx_projects_invite_code" ON "projects"("invite_code");

CREATE TABLE IF NOT EXISTS "project_objects" (
  "id" TEXT PRIMARY KEY, -- ULID
  "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "entity_kind" TEXT NOT NULL, -- 'note' | 'goal' | 'task' | 'form' | 'event'
  "entity_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_project_objects_lookup" ON "project_objects"("project_id", "entity_kind", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_project_objects_user" ON "project_objects"("user_id");
