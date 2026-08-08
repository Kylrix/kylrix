---
name: security.kylrix-integrity
description: Integrity checks and trust boundaries for Kylrix secure operations and shared objects.
---

# Kylrix Privacy — Thoughtful Handling for Private Notes and Secure Hangouts

## Overview

Kylrix is an open source productivity suite that respects user privacy with an optional privacy module for private notes and secure hangouts. It handles private content gently and keeps diagnostic artifacts tidy.

## Core Practices

- **Tidy workspace:** Please keep temporary `.txt`, `.py`, `.csv`, `.log` or `.data` files out of commits.
- **Respectful access handling:**
    - Prefer simple user-scoped access patterns.
    - Public access is thoughtfully managed via `isPublic` and `isGuest` flags.
    - Shared access is handled via Server Actions that respect privacy.
- **Environment care:** Keep `.env` and `.data/` in `.gitignore`.
- **Respect privacy:** Avoid logging private content in production code.
- **Terminology Standard**: Strictly use "Table" and "Row". Never reintroduce "Collection" or "Document".

## Automated Cleanup Patterns

### 1. Temporary File Purge

Before completing a task, always ensure temporary artifacts are deleted from the local workspace:
```bash
rm -f *.txt *.py *.log
```

### 2. Gitignore Enforcement

Maintain the following blocks in `.gitignore`:
```
# security & data
.data/
*.txt
*.py
```

## Prohibited Patterns

- **No Local Dumps:** Never use `appwrite tables-db list-rows ... > dump.txt` inside the repository directory without immediate deletion.
- **No read("any"):** Any PR or change introducing `read("any")` is considered a critical security failure.
- **No Client-Side Writes:** Direct database writes via the Client SDK are prohibited. All mutations must route through secure Server Actions.
