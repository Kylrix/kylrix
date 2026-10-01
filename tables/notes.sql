-- Table: notes
-- Purpose: Unified storage for personal notes, published posts, and workspace articles.
-- Key strategy: ULID (26-character time-sortable).

CREATE TABLE IF NOT EXISTS "notes" (
  "id" TEXT PRIMARY KEY, -- ULID
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "is_locked" INTEGER DEFAULT 0,
  "is_published" INTEGER DEFAULT 0,
  "is_pinned" INTEGER DEFAULT 0,
  "is_trashed" INTEGER DEFAULT 0,
  "is_workspace" INTEGER DEFAULT 0,
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE SET NULL,
  "category" TEXT,
  "tags" TEXT, -- JSON string array
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_notes_user_feed" ON "notes"("user_id", "is_trashed", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_notes_project" ON "notes"("project_id");
CREATE INDEX IF NOT EXISTS "idx_notes_published" ON "notes"("is_published", "created_at" DESC);
