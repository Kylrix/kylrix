---
name: kylrix-appwrite-audit
description: Audits table/index usage against live schema config without proposing schema edits. Use when validating data flow, query alignment, and stale table assumptions.
disable-model-invocation: true
---

# Appwrite Audit

## Rules

1. Treat root `appwrite.config.json` as schema truth.
2. Compare query patterns to indexes before suggesting data-path changes.
3. Report usage drift as implementation issues, not schema failures.
4. Do not propose schema modifications unless user explicitly asks.

