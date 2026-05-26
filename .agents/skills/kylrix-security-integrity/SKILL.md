# Kylrix Security Integrity — Architectural Guardrails

## Overview

The Kylrix Security Integrity skill ensures that no sensitive data, cryptographic metadata, or temporary diagnostic artifacts are ever committed to the repository. It enforces the **Zero-Leak Policy**.

## Core Mandates

- **Zero-Commit Policy:** Never `git add` or `commit` files with `.txt`, `.py`, `.csv`, `.log`, or `.data` extensions unless explicitly part of the application source (e.g., `README.md` is fine, but `debug_dump.txt` is prohibited).
- **Environment Isolation:** Ensure `.env` and `.data/` folders are always in `.gitignore`.
- **Sensitive Metadata Protection:** Prohibit the logging or printing of `wrappedKey`, `salt`, `masterPassword`, or `userId` in production-bound code.
- **Isomorphic Consistency:** Standardize all security-critical operations (encryption, decryption, key derivation) within the `MasterPassCrypto` and `EcosystemSecurity` services.

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
- **No Hardcoded Keys:** Prohibit embedding any cryptographic keys or secrets directly in the source code.
- **No Admin-Only Bypasses:** Ensure all client-facing secure actions utilize the user-scoped client to respect Row Level Security.
- **No Terminology Regression:** Strictly use "Table" and "Row". Never reintroduce "Collection" or "Document".
