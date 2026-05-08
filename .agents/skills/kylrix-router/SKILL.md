---
name: kylrix-router
description: Routes broad Kylrix tasks to the right local skill (accounts, notes, vault, flow, calls, HUD, navigation). Use when requests are cross-cutting or ambiguous.
disable-model-invocation: true
---

# Kylrix Router

## Routing

- Auth/session/server routes -> `accounts-api`
- Calls/huddles/realtime signaling/activity -> `calls-realtime`
- Notes/sharing/collaboration/metadata -> `note-intelligence`
- Tasks/forms/events integration -> `flow-tasks`
- Masterpass/passkeys/keychain/TOTP -> `vault-security`
- Cross-app object pointers/metadata -> `cross-app-linking`
- Global activity UI + unread/read pointers -> `kylrix-global-hud`
- Shell and route behavior -> `kylrix-navigation-policy`
- Drawer interaction patterns -> `kylrix-drawer-ui`
- Visual system + branding -> `kylrix-brand`
- Table/index usage audit -> `kylrix-appwrite-audit`
- Shared sdk/service contracts -> `kylrix-sdk-consistency`

Always apply `kylrix-guardrails` with the domain skill.

