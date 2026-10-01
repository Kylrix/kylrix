-- Table: events
-- Purpose: Calendar events, scheduled deadlines, and community meetups.
-- Key strategy: ULID (26-character time-sortable).

CREATE TABLE IF NOT EXISTS "events" (
  "id" TEXT PRIMARY KEY, -- ULID
  "creator_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "location" TEXT,
  "is_all_day" INTEGER DEFAULT 0,
  "is_public" INTEGER DEFAULT 0,
  "is_workspace" INTEGER DEFAULT 0,
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE SET NULL,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_events_creator" ON "events"("creator_id");
CREATE INDEX IF NOT EXISTS "idx_events_timeline" ON "events"("start_time", "end_time");
CREATE INDEX IF NOT EXISTS "idx_events_project" ON "events"("project_id");
