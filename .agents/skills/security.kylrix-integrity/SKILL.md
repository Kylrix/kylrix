---
name: security.kylrix-integrity
description: Integrity checks and trust boundaries for Kylrix secure operations and shared objects.
---

# Kylrix Security Integrity — Architectural Guardrails

## Overview

The Kylrix Security Integrity skill ensures that no sensitive data, cryptographic metadata, or temporary diagnostic artifacts are ever committed to the repository. It enforces a strict **Zero-Leak Policy** and mandates the use of server-side identity management.

## Core Mandates

- **Zero-Commit Policy:** Never `git add` or `commit` files with `.txt`, `.py`, `.csv`, `.log`, or `.data` extensions. These are strictly diagnostic and must be purged before completion.
- **Strict Permission Guardrails (CRITICAL):**
    - **Prohibited Permissions:** Never use `read("any")` or `read("users")` Appwrite permissions.
    - **Maximum Permission:** The absolute maximum Appwrite-level permission ever granted is `read("user:[ID]")` for the creator and specific collaborators.
    - **Native Visibility Flags:** Public or Guest access is controlled EXCLUSIVELY via the `isPublic` and `isGuest` boolean columns.
    - **Server-Side Enforcement:** Retrieval of public/shared resources is handled via Server Actions using the system client with explicit `isPublic` filters, bypassing client-side SDK limitations.
- **Environment Isolation:** Ensure `.env` and `.data/` folders are always in `.gitignore`.
- **Sensitive Metadata Protection:** Prohibit the logging or printing of `wrappedKey`, `salt`, `masterPassword`, or `userId` in production-bound code.
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
