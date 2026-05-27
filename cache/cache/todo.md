# Todo: Hardening & Convergence

## Track 1: Abuse Mitigation
- [ ] **Infrastructure Setup**:
    - [ ] Create `usage_metrics` table in Appwrite to track resource consumption per `actorId` or `hashedIp`.
    - [ ] Add `dailyUploadCount`, `totalActiveBytes`, and `lastReset` columns.
- [ ] **Enforcement Logic**:
    - [ ] Implement `checkSendQuota(jwt?: string)` in `lib/api-key.ts`.
    - [ ] Integrate quota check into `createSendGhostObjectSecure` in `secure-ops.ts`.
    - [ ] Implement automatic daily reset for counters.
- [ ] **UX Feedback**:
    - [ ] Add `QUOTA_EXCEEDED` error code to `SendComposer.tsx`.
    - [ ] Display friendly upgrade prompt for Pro when limits are reached.

## Track 2: Architectural Convergence
- [ ] **Accounts API Migration**:
    - [ ] Refactor `api/permissions/route.ts` to use `mutateRowPermissionsSecure`.
    - [ ] Refactor `api/connect/join-requests/route.ts` to use new `resolveJoinRequestSecure`.
    - [ ] Refactor `api/notes/[noteid]/share/route.ts` to use `addNoteCollaboratorSecure`.
- [ ] **Registry Hardening**:
    - [ ] Audit all `secure-ops.ts` functions to ensure **none** pass a `jwt` to the database adapter for mutations.
    - [ ] Standardize all responses to follow the `{ success: boolean, result?: any }` pattern.
- [ ] **Verification**:
    - [ ] Ensure `middleware.ts` correctly blocks direct DB write attempts if users try to bypass the server actions.
