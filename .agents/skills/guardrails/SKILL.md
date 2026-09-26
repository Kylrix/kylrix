---
name: guardrails
description: Core architectural guardrails, routing policies, shipping velocity, and code hygiene for Kylrix. Read before making architecture, route, or app modifications.
---

# Kylrix Guardrails & System Directives

## 1. Architectural Mandates
- **Single Database**: All tables exist in \`passwordManagerDb\`. Never introduce other database IDs.
- **Terminology Mandate**: Use **"Table"** (never Collection) and **"Row"** (never Document) in all code, comments, logs, and internal documentation.
- **Canonical App Directory**: All work happens in \`kylrix/\`. Root folders outside \`kylrix/\` are reference or tooling.
- **Package Manager**: Strictly use \`pnpm\`. Never use npm or yarn.
- **No Direct Appwrite Admin API Usage**: Do not invoke raw Appwrite admin endpoints or bypass the product API layer. Use the official Appwrite CLI for schema inspection/migrations, and the Kylrix HTTP API (\`/api/v1\`) for all resource operations.
- **No New In-App HTTP APIs**: Do not create new \`app/api/*\` endpoints for product UI flows. Use Server Actions or internal service methods. Exception: public developer API surface \`app/api/v1/*\`.
- **Data Access Pattern**: New domain code uses \`@/lib/data\` (\`systemTables\`, \`q.*\`) rather than direct SDK instantiation in services.

## 2. Routing & Navigation Policy
- **Workflow Engine**: Located at \`/flows\` (never \`/flow\`).
- **Workspaces**: Main UI is \`/app\` with sharing at \`/workspace/[id]\`. Never use \`/workspaces\` routes.
- **Same-Tab Navigation**: All intra-app routing uses standard Next.js \`<Link>\` or \`router.push\` within the same tab. Avoid unexpected window/tab popping.
- **Canonical Domain**: Enforce \`https://www.kylrix.space\` for outbound share links, emails, and OAuth redirects.

## 3. Shipping & Development Discipline
- **Surgical Execution**: Prioritize direct, high-precision code modifications. Skip build/lint/test cycles unless explicitly instructed.
- **Zero Speculation**: When fixing a specific error, fix only that error and stop. Do not refactor adjacent files without prompt request.
- **Strict Scope Enforcement**: Do not edit files outside the user request.
- **Dead Code Cleanup**: Use Knip for locating unused exports/files. Do not leave stray files or commented blocks.
