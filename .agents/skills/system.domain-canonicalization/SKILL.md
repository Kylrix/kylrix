---
name: system.domain-canonicalization
description: Enforce using the canonical www.kylrix.space subdomain for all outgoing URLs, email CTAs, Telegram push messages, share links, and public metadata assets. Use when writing URL generators, building notifications, or creating sharing links.
---

# Domain Canonicalization Standards (www.kylrix.space)

## 🏗️ Architectural Mandate

In order to guarantee brand integrity, cookie isolation, SEO consistency, and secure redirection, **all outgoing links and service-level references must use the canonical `www.` subdomain**.

### 🚫 NEVER USE NAKED DOMAINS
- **Incorrect**: `https://kylrix.space`
- **Correct**: `https://www.kylrix.space`

---

## ⚡ Implementation Guidelines

### 1. Unified Base URL
When building URLs dynamically on the server or client side:
- Prefer using the `process.env.NEXT_PUBLIC_APP_URL` environment variable if available.
- If the variable is not set, always fallback specifically to `https://www.kylrix.space` (never drop the `www.`).

### 2. Sharing & CTA Links
When generating invite or share links:
- **Projects**: `${baseUrl}/project/${projectId}`
- **Notes**: `${baseUrl}/note/shared/${noteId}`
- **Tasks**: `${baseUrl}/flow/tasks/${taskId}`

### 3. Verification & Email Deliverability
- All outbound template metadata (such as `iconUrl` in `EmailDispatchPayload`) must point to `https://www.kylrix.space/logo.svg` to maintain TLS/SSL certificate trust and secure static assets delivery.
