# Migration & Build Handoff: Sovereign Stack & PartyKit Realtime

> **ATTENTION AGENT / DEVELOPER**: Read this document completely before attempting to modify, fix, or introduce dependencies.

---

## 1. Executive Summary: What Just Happened & Why Appwrite Was Phased Out

### Why Appwrite Was Replaced
- **Vendor Lock-in & Schema Fragility**: Appwrite introduced strict schema drift, CLI overhead (`appwrite push` risks wiping database records), and non-standard query languages.
- **Single Source of Truth**: The ecosystem migrated entirely to **Turso (LibSQL / SQLite)** with **Drizzle ORM** for local/remote persistence, plus **Better-Auth** for authentication.
- **Sovereign Shims (`lib/shims/`)**: The official `appwrite` and `node-appwrite` npm dependencies were **completely removed from `package.json`**. Instead, local sovereign shims (`lib/shims/shared.ts`, `lib/shims/appwrite.ts`, `lib/shims/node-appwrite.ts`) emulate necessary Appwrite types, models, queries (`Query.*`), and service interfaces (`TablesDB`, `Account`, `Realtime`, `OAuthProvider`, etc.) to keep existing UI components functional without the heavy SDK.

> [!CAUTION]
> **DO NOT REINTRODUCE APPWRITE**:
> - Never run `pnpm add appwrite` or `pnpm add node-appwrite`.
> - Never add Appwrite back to `package.json`.
> - Never write direct Appwrite REST calls or SDK operations. All database operations must strictly go through Turso/Drizzle (`lib/core/adapters/turso/database.adapter.ts` or `lib/db/`).

---

## 2. Realtime Architecture: Cloudflare PartyKit Durable Objects

When Appwrite was removed, Appwrite Realtime was lost. We replaced it with an ultra-low-latency sovereign WebSocket layer powered by **Cloudflare PartyKit (Durable Objects)**:

- **Worker URI**: `kylrix-party.kylrix.workers.dev` (configured in Vercel & `.env.local` via `NEXT_PUBLIC_PARTY_HOST` and `NEXT_PUBLIC_PARTYKIT_HOST`).
- **Client Engine** (`lib/realtime/partykit.ts`):
  - Connects to `wss://${NEXT_PUBLIC_PARTY_HOST}/room/global`.
  - Automatically handles reconnects with exponential backoff.
  - Implements wildcard and prefix channel subscription matching (`databases.*`, `collections.*`, `tables.*`, `rows.*`, `${table}.${action}`).
- **Client Hooks** (`lib/appwrite/client.ts` & `lib/shims/shared.ts`):
  - `realtime.subscribe(channels, callback)` delegates directly to `partyRealtime.subscribe(...)`.
  - All stores (Notes, Tasks/Goals, Activity/Notifications, Chat, Telegram, Ideas) immediately receive cross-device instant updates.
- **Server Broadcaster** (`lib/core/adapters/turso/database.adapter.ts`):
  - Every mutation (`createRow`, `updateRow`, `deleteRow`, `incrementRowColumn`) asynchronously fires `broadcastRealtimeEvent()` via HTTP POST to the Cloudflare Durable Object worker, relaying to all connected browser WebSockets in microseconds without blocking database execution.

---

## 3. What We Are Trying to Do: Next.js / TypeScript Build Verification

The objective is to achieve **zero errors on `pnpm build` (Next.js Turbopack + TypeScript type-checking)** so Vercel can deploy cleanly to Production.

### Current Build Error Caught by Vercel
In deployment `dpl_EZMerZ3vZSAwuYKT5JapHpnuqLUM`:

```
./app/(app)/forms/page.tsx:258:38
Type error: Property 'subscribe' does not exist on type 'Client'.

  256 | const tableId = APPWRITE_CONFIG.TABLES.FLOW.FORMS;
  257 | const channel = `databases.${dbId}.collections.${tableId}.documents`;
> 258 | unsubscribe = client.subscribe(channel, (response: any) => {
      |                      ^^^^^^^^^
```

#### Why This Occurred:
In legacy code, developers occasionally called `client.subscribe()` on the raw Appwrite `Client` instance rather than `realtime.subscribe()` or `subscribeToTable()`.
In our sovereign `Client` shim (`lib/shims/shared.ts` and `lib/appwrite/client.ts`), `client` is an instance of `Client` which only manages endpoint/project settings, while `subscribe()` lives on `Realtime` (`realtime.subscribe`).

#### How to Fix It:
1. In `app/(app)/forms/page.tsx` line 258:
   - Change `client.subscribe(...)` to `realtime.subscribe(...)` (imported from `@/lib/appwrite/client`).
   - Or add a forwarding helper `subscribe(channels, callback)` onto the `Client` class in `lib/shims/shared.ts` that delegates to `partyRealtime.subscribe(channels, callback)` so any legacy `client.subscribe()` calls in other files will also resolve cleanly.
2. Search for any other instances of `client.subscribe` across `app/` and `components/`:
   ```bash
   grep -rn "client\.subscribe" app/ components/
   ```
3. Run `pnpm build` to find any other downstream TypeScript type errors until `pnpm build` completes with exit code 0.
4. When `pnpm build` passes, commit the fix with a pure commit message and push to `origin/master`:
   ```bash
   git add -A
   git commit -m "fix(build): resolve client.subscribe type error and align with partyRealtime"
   # Note: use active VSCODE_GIT_IPC_HANDLE if pushing in current shell
   VSCODE_GIT_IPC_HANDLE=$(ls /tmp/vscode-git-*.sock 2>/dev/null | tail -n 1) git push origin master
   ```
