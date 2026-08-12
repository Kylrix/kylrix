# Communicative Object Detail (chats → calls)

Reuse `CommObjectDetail` + `FusedSecondarySidebar` + `ConnectCommRail` for any real-time communicative surface:

- **Chats** (secure) — shipped
- **Threads** (public thread notes) — same shell via `kind: 'thread'`
- **Calls / huddles** — plug call UI into `CommObjectDetail` with `kind: 'call'` (marked; do not invent a second fullscreen fixed shell)

Rules:
1. Desktop: fused in-page secondary rail (never overlay that covers the topbar).
2. Mobile: object-detail style mural UI (`layout="fill"`).
3. Hydrate from LocalEngine (`f_chats_list`, `f_chat_messages_*`) before network.
4. Canonical routes live under `/connect/chats` and `/connect/chats/[id]`. Legacy `/connect/chat/[id]` only redirects.
