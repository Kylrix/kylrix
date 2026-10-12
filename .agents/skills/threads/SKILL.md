---
name: threads
description: Unified plaintext discussions, comments, thread messages, and reactions across notes, goals, workspaces, and objects.
---

# Unified Threads & Discussion Substrate

## 1. Discussion Substrate
- Replaces legacy comment implementations with a unified thread system: \`threads\`, \`thread_messages\`, \`thread_reactions\`.
- Unified scopeKey format: \`parentKind:parentId:channel\` (e.g. \`note:123:default\`, \`workspace:456:general\`).

## 2. Realtime Relay & Reactions
- Supports instant plaintext chat, mentions, and emoji reactions with SHA-256 base64url deduplicated reaction indexing.
