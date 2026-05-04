# Kylrix Migration Log

## Status
Unified Next.js build restored. Shared compatibility exports are in place and the monolith now resolves the legacy app surfaces cleanly.

## Completed
- Unified route structure under `app/(auth)/accounts` and `app/(app)/{note,vault,flow,connect}`
- Consolidated shared `lib/`, `components/`, `context/`, `utils/`, `hooks/`, `constants/`, and `types/`
- Restored shared compatibility exports in `lib/appwrite`, `lib/sdk`, `lib/constants`, and `lib/profile-handoff`
- Patched legacy default/named export mismatches in `Logo`, `EcosystemPortal`, `SudoModal`, and `Navigation`
- Restored call-service compatibility helpers for public call routes (`getCallLink`, `getCallLinkByCode`, `cleanupLink`, `getActiveParticipants`, `createAnonymousSession`, `sendSignal`)
- Merged package dependencies
- Build now passes module resolution again

## Notes
- The remaining todo list is separate from the migration itself.
- Any future migration work should start by checking `lib/appwrite/` and `lib/sdk/` before touching route files.
