-- Table: forms & form_responses
-- Purpose: Dynamic forms, surveys, and ecosystem feedback collectors.
-- Key strategy: ULID (26-character time-sortable).

CREATE TABLE IF NOT EXISTS "forms" (
  "id" TEXT PRIMARY KEY, -- ULID
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "schema_json" TEXT NOT NULL, -- JSON array of form field definitions
  "is_public" INTEGER DEFAULT 1,
  "is_closed" INTEGER DEFAULT 0,
  "is_workspace" INTEGER DEFAULT 0,
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE SET NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_forms_user" ON "forms"("user_id");
CREATE INDEX IF NOT EXISTS "idx_forms_project" ON "forms"("project_id");

CREATE TABLE IF NOT EXISTS "form_responses" (
  "id" TEXT PRIMARY KEY, -- ULID
  "form_id" TEXT NOT NULL REFERENCES "forms"("id") ON DELETE CASCADE,
  "respondent_id" TEXT,
  "data_json" TEXT NOT NULL, -- JSON submission payload
  "created_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_form_responses_form" ON "form_responses"("form_id", "created_at" DESC);
