# Autonomic RxDB Sync Pattern

## Intent
Establish guidelines for mapping high-frequency real-time user inputs to the local RxDB context database and cache layers, while decoupling database server updates asynchronously in the background.

## Core Sync Rules
1. **Separation of Concerns**: 
   - The user interface interacts exclusively with the local cache/RxDB state layer. Keystroke updates route synchronously to this local copy.
   - Remote database writes are scheduled independently by a background worker (Sync Engine) based on user activity intensity.
2. **Autonomic Activity Scheduling**:
   - High activity levels (such as continuous typing) automatically decrease the sync interval to merge changes frequently.
   - Idle or reading periods increase the sleep interval to reduce database traffic.
3. **Draft Isolation**:
   - Unsaved drafts are marked using unpersisted draft IDs (`isUnpersistedComposeDraft`).
   - If database updates encounter validation errors or schema mismatch failures, the target item is isolated, allowing other changes to proceed.
4. **Single Source of Truth**:
   - Sidebar item lists, detail views, and active composers must map metadata from the same context memory object rather than invoking independent fetches.
