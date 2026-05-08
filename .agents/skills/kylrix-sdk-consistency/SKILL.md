---
name: kylrix-sdk-consistency
description: Keeps shared sdk/service contracts consistent across the single codebase. Use when editing `lib/sdk`, shared exports, or broad consumer callsites.
disable-model-invocation: true
---

# SDK Consistency

## Rules

1. Update shared `lib/sdk/**` contracts first, then consumer callsites.
2. Keep exports stable or update imports in the same change.
3. Avoid duplicating shared helper logic in random feature modules.
4. Do not patch generated artifacts manually.

