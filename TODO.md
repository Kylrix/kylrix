# Post-Deployment & Database Index Tasks

## 1. Post-Deployment Configuration
- [ ] Replace placeholder Function ID `goal-reminder-dispatch-placeholder-id` in `functions/appwrite.config.json` with the production Appwrite Cloud Function ID generated post-deployment.
- [ ] Ensure environment variables `DATABASE_ID`, `TASKS_TABLE_ID`, `EVENTS_TABLE_ID`, `SUBSCRIPTIONS_TABLE_ID`, `UNORGANIC_EMAILS_TABLE_ID`, and `TELEGRAM_BOT_TOKEN` are set in the Appwrite Function environment settings.

---

## 2. Required Appwrite Console Indexes & Composite Queries

To ensure strict server-side Appwrite `Query` execution without full table scans, create the following indexes in the Appwrite Console for database `passwordManagerDb`:

### A. Goals Table (`tasks`)
- **Single Index on Due Date:**
  - Index Key: `idx_tasks_dueDate`
  - Type: `key`
  - Attributes: `dueDate` (ASC or DESC)
- **Composite Index for Status Filtering:**
  - Index Key: `idx_tasks_dueDate_status`
  - Type: `key`
  - Attributes: `dueDate`, `status`
- **Composite Index for Deletion & Trash Flags:**
  - Index Key: `idx_tasks_dueDate_status_flags`
  - Type: `key`
  - Attributes: `dueDate`, `status`, `isDeleted`, `isTrash`

### B. Events Table (`events`)
- **Single Index on Start Time:**
  - Index Key: `idx_events_startTime`
  - Type: `key`
  - Attributes: `startTime` (ASC or DESC)
- **Composite Index for Status Filtering:**
  - Index Key: `idx_events_startTime_status`
  - Type: `key`
  - Attributes: `startTime`, `status`
- **Composite Index for Deletion & Trash Flags:**
  - Index Key: `idx_events_startTime_status_flags`
  - Type: `key`
  - Attributes: `startTime`, `status`, `isDeleted`, `isTrash`

### C. Subscriptions Table (`subscriptions`)
- **Single Index on Expiration Date:**
  - Index Key: `idx_subscriptions_currentPeriodEnd`
  - Type: `key`
  - Attributes: `currentPeriodEnd` (ASC or DESC)
- **Composite Index for Active Subscriptions:**
  - Index Key: `idx_subscriptions_currentPeriodEnd_status`
  - Type: `key`
  - Attributes: `currentPeriodEnd`, `status`

### D. Unorganic Emails Table (`unorganic_emails`)
- **Composite Index for Deduplication Check:**
  - Index Key: `idx_unorganic_emails_recipient_dedupe`
  - Type: `key`
  - Attributes: `recipientId`, `dedupeKey`
- **Composite Index for Monthly Quota Tracking:**
  - Index Key: `idx_unorganic_emails_recipient_status_processedAt`
  - Type: `key`
  - Attributes: `recipientId`, `status`, `processedAt`
