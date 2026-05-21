# ARCHITECTURAL BRIEF: TELEGRAM NOTIFICATION DEEP-LINKING PIPELINE
**Target Audience:** Senior AI Implementation Agent
**Context:** Kylrix Production Ecosystem
**Database Guardrails:** Strict Configuration Isolation
## 1. STRATEGIC OVERVIEW & PARADIGM
You are tasked with building the Telegram Notification subsystem for the Kylrix suite. This system functions as a high-velocity, lightweight **catch-all notification proxy**.
Unlike the organic email pipeline, which enforces a strict filtering heuristic based on high-priority activities, the Telegram ecosystem captures all secondary interaction streams. It acts as an immediate, less restrictive push layer.
### Core Trigger Triggers Include:
 * **Idle Follow-ups:** Sending a subsequent chat message to User B if they have not replied to a previous message within a 24-hour window.
 * **Real-time Call Dispatches:** Instant notification when an audio/video call is initiated, or when a user is explicitly added to an active session.
 * **Direct Chat Pings:** Low-overhead notifications for active chat mentions or new direct message threads.
### Security & Privacy Isolation Model:
To maintain data-blind protocol compliance, the sender of an event (e.g., User A) must never gain visibility into the recipient’s (User B) Telegram routing identifiers.
The entire mapping layer is abstracted behind Next.js Server Actions and the Appwrite Server SDK. Permissions are strictly locked down to absolute zero public read/write access. Only the owning user can read or delete their specific mapping profile from the client UI.
## 2. APPWRITE CONFIGURATION SPECIFICATION (CRITICAL)
> [!CAUTION]
> **CRITICAL INFRASTRUCTURE WARNING:** You are authorized to modify appwrite.config.json **EXACTLY ONCE**. The production database schema is highly fragile. Do not modify, reorder, or delete any existing database, collection, or attribute configurations. Append the new collection configuration to the end of the appropriate database collection array. Do not execute any Appwrite CLI deployment commands (appwrite deploy); schema application will be handled manually by a human operator.
> 
### Schema Validation Invariants:
 * Every attribute configuration must map cleanly to Appwrite JSON constraints.
 * **Rule:** Attributes marked as "required": true **MUST NOT** possess a "default" key/value pair. Doing so violates Appwrite validation engines and breaks migration pipelines.
### New Collection JSON Specification
Append this object directly inside your existing database's collections array within appwrite.config.json:
```json
{
  "$id": "telegram_connections",
  "name": "Telegram Connections",
  "enabled": true,
  "documentSecurity": true,
  "attributes": [
    {
      "key": "pair_code",
      "type": "string",
      "size": 6,
      "required": false,
      "array": false
    },
    {
      "key": "tg_chat_id",
      "type": "string",
      "size": 255,
      "required": false,
      "array": false
    },
    {
      "key": "tg_username",
      "type": "string",
      "size": 255,
      "required": false,
      "array": false
    },
    {
      "key": "is_verified",
      "type": "boolean",
      "required": true,
      "array": false
    }
  ],
  "indexes": []
}

```
## 3. LIFECYCLE IMPLEMENTATION FLOWS
You must implement three distinct architectural stages within Next.js Server Actions using the Appwrite Server SDK (node-appwrite).
### Stage 1: Initial Connect (The 3-Minute Pairing Window)
Executed when a user opens the Telegram connection drawer in the Kylrix Web UI settings.
 1. **State Initialization:** Generate a high-entropy, 6-digit numeric string (pair_code).
 2. **Document Creation:** Write to the telegram_connections collection.
   * **Invariant:** The Document ID ($id) **MUST** be set explicitly to the authenticated user's Kylrix userId. This enforces a strict 1:1 mapping layer at the database level.
   * Set pair_code to the generated 6-digit string.
   * Set is_verified to false.
 3. **Access Control Policy:** You must explicitly inject client-side permissions using the Appwrite Server SDK during document creation. Provide access *only* to the resource owner:
   * Permission.read(Role.user([USER_ID]))
   * Permission.delete(Role.user([USER_ID]))
   * No write or update permissions are given to the user. No public roles are defined.
 4. **UI Exposure:** Expose the deep-link button using Telegram's start-parameter parameterization:
   https://t.me/[BOT_USERNAME]?start=[USER_ID]_[PAIR_CODE]
### Stage 2: Subsequent Interact (The Telegram Webhook Handler)
Executed when Telegram invokes your Next.js Server Action endpoint via an inbound HTTPS Webhook payload.
 1. **Payload Extraction:** Parse the incoming message text parameter. If a user clicks the deep-linked "Start" button, Telegram dispatches a text string matching /start [USER_ID]_[PAIR_CODE]. Extract both identifiers via regex or string splitting.
 2. **Record Retrieval:** Query the telegram_connections document using the extracted userId as the Document ID.
 3. **Time-Window Validation:** Use Appwrite's native metadata attribute $updatedAt. Calculate the delta: \Delta t = t_{now} - t_{updatedAt}.
   * If is_verified is already true, terminate early with a success notification.
   * If \Delta t > 180\text{ seconds} (3 minutes), reject the pairing request. Send an error message back via the Bot API indicating expiration.
 4. **Cryptographic Verification:** Compare the extracted code with the pair_code stored in the retrieved document.
 5. **State Promotion:** If valid and within the 3-minute window, update the document using the administrative Server SDK:
   * Set tg_chat_id to the sender's unique numeric Telegram message.chat.id.
   * Set tg_username to the user's Telegram handle (message.from.username).
   * Set pair_code to null or clear it.
   * Flip is_verified to true.
 6. **Confirmation:** Send a localized validation success message to the user via the Telegram Bot UI.
### Stage 3: Active Notification Push (Blind Lookup Engine)
Executed when application-level events (calls, mentions, 24-hour unreplied messages) occur.
 1. **Target Resolution:** When an action targets a recipient (User B), the application trigger invokes the internal notification dispatcher, passing User B's userId.
 2. **Blind Lookup:** The dispatcher uses the Appwrite Server SDK to attempt to fetch the document in telegram_connections where $id === Target_UserID.
 3. **Assertion Check:**
   * If the document does not exist, or if is_verified === false, silently drop the execution loop.
   * If is_verified === true, retrieve the tg_chat_id.
 4. **Bot Dispatch:** Forward the compiled notification text payload alongside the retrieved tg_chat_id directly to the official Telegram Bot API endpoint (/sendMessage). The initiating actor never receives access to this routing data.
### Stage 4: Disconnect Lifecycle
 1. **Client-Driven Eviction:** Because the document was created with native client-side delete permissions tied specifically to the owner's userId, disconnecting requires no intermediary server action code.
 2. **Execution:** The Kylrix client UI invokes the standard client SDK method:
   databases.deleteDocument('database_id', 'telegram_connections', currentUserId);
 3. **Outcome:** The row is instantly purged from the system, terminating all passive routing tunnels immediately.
