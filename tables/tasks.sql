-- Table: tasks & goals
-- Purpose: Goal tracking, milestone tracking, and task lists.
-- Key strategy: ULID (26-character time-sortable).

CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT PRIMARY KEY, -- ULID
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'in_progress' | 'completed' | 'canceled'
  "priority" TEXT DEFAULT 'medium', -- 'low' | 'medium' | 'high' | 'urgent'
  "due_date" TEXT,
  "is_workspace" INTEGER DEFAULT 0,
  "project_id" TEXT REFERENCES "projects"("id") ON DELETE SET NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tasks_user_status" ON "tasks"("user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_tasks_project" ON "tasks"("project_id");
CREATE INDEX IF NOT EXISTS "idx_tasks_due_date" ON "tasks"("due_date");
