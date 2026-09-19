# Post-Deployment & Database Index Tasks

## 1. Post-Deployment Configuration
- [x] Replace placeholder Function ID `goal-reminder-dispatch-placeholder-id` in `functions/appwrite.config.json` with the production Appwrite Cloud Function ID generated post-deployment (`goal-reminder-dispatch`).
- [x] Ensure environment variables `DATABASE_ID`, `TASKS_TABLE_ID`, `EVENTS_TABLE_ID`, `SUBSCRIPTIONS_TABLE_ID`, `UNORGANIC_EMAILS_TABLE_ID`, and `TELEGRAM_BOT_TOKEN` are set in the Appwrite Function environment settings.

---

## 2. Required Appwrite Console Indexes & Composite Queries (Completed)

Created via Appwrite CLI (`tablesdb create-index`):

### A. Goals Table (`tasks`)
- [x] **Single Index on Due Date:** `idx_tasks_dueDate` (`dueDate` ASC)
- [x] **Composite Index for Status Filtering:** `idx_tasks_dueDate_status` (`dueDate` ASC, `status` ASC)
- [x] **Composite Index for Deletion & Trash Flags:** `idx_tasks_dueDate_status_flags` (`dueDate` ASC, `status` ASC, `isDeleted` ASC, `isTrash` ASC)

### B. Events Table (`events`)
- [x] **Single Index on Start Time:** `idx_events_startTime` (`startTime` ASC)
- [x] **Composite Index for Status Filtering:** `idx_events_startTime_status` (`startTime` ASC, `status` ASC)
- [x] **Composite Index for Deletion & Trash Flags:** `idx_events_startTime_status_flags` (`startTime` ASC, `status` ASC, `isDeleted` ASC, `isTrash` ASC)

### C. Subscriptions Table (`subscriptions`)
- [x] **Single Index on Expiration Date:** `idx_subscriptions_currentPeriodEnd` (`currentPeriodEnd` ASC)
- [x] **Composite Index for Active Subscriptions:** `idx_sub_currPeriodEnd_status` (`currentPeriodEnd` ASC, `status` ASC)

### D. Unorganic Emails Table (`unorganic_emails`)
- [x] **Composite Index for Deduplication Check:** `idx_unorg_recipient_dedupe` (`recipientId` ASC, `dedupeKey` ASC)
- [x] **Composite Index for Monthly Quota Tracking:** `idx_unorg_recip_status_procAt` (`recipientId` ASC, `status` ASC, `processedAt` ASC)

