# Duplicated logic inventory

Current scan found these exact copies and path-level wrappers.

## Exact duplicate implementations

- `components/EcosystemClient.tsx`
  - `components/ecosystem/EcosystemClient.tsx`
  - `app/(app)/(auth)/accounts/components/EcosystemClient.tsx`
- `components/ActivityLogs.tsx`
  - `app/(app)/(auth)/accounts/components/ActivityLogs.tsx`
- `components/AuthForm.tsx`
  - `app/(app)/(auth)/accounts/components/AuthForm.tsx`
- `components/ConnectedIdentities.tsx`
  - `app/(app)/(auth)/accounts/components/ConnectedIdentities.tsx`
- `components/LogoutDialog.tsx`
  - `app/(app)/(auth)/accounts/components/LogoutDialog.tsx`
- `components/PasskeyList.tsx`
  - `app/(app)/(auth)/accounts/components/PasskeyList.tsx`
- `components/PinManager.tsx`
  - `app/(app)/(auth)/accounts/components/PinManager.tsx`
- `components/ReferralInfoDrawer.tsx`
  - `app/(app)/(auth)/accounts/components/ReferralInfoDrawer.tsx`
- `components/ReferralManager.tsx`
  - `app/(app)/(auth)/accounts/components/ReferralManager.tsx`
- `components/RenamePasskeyModal.tsx`
  - `app/(app)/(auth)/accounts/components/RenamePasskeyModal.tsx`
- `components/SessionsManager.tsx`
  - `app/(app)/(auth)/accounts/components/SessionsManager.tsx`
- `components/TwoFactorReminderHost.tsx`
  - `app/(app)/(auth)/accounts/components/TwoFactorReminderHost.tsx`
- `components/overlays/MfaChallengeDrawer.tsx`
  - `app/(app)/(auth)/accounts/components/overlays/MfaChallengeDrawer.tsx`
- `components/overlays/TwoFactorDrawer.tsx`
  - `app/(app)/(auth)/accounts/components/overlays/TwoFactorDrawer.tsx`
- `lib/actions/admin/check-admin.ts`
  - `app/(app)/(auth)/accounts/actions/admin/check-admin.ts`
- `app/(app)/flow/not-found.tsx`
  - `app/(app)/connect/not-found.tsx`

## Thin wrappers that duplicate entry points

- `components/Logo.tsx` is only a pass-through to `components/common/Logo.tsx`.
- `components/EcosystemClient.tsx` and `components/ecosystem/EcosystemClient.tsx` both expose the same logic, so the repo keeps two public paths for one implementation.
- `app/(app)/connect/hangouts/invite/[conversationId]/page.tsx` is a direct re-export of `app/(app)/connect/groups/invite/[conversationId]/page.tsx`.

## Structural note

The largest duplication cluster sits under `app/(app)/(auth)/accounts/components`, which mirrors root-level components almost one-for-one. That makes the accounts tree feel like a second codebase instead of a route-specific composition layer.

## Additional near-duplicate clusters

- `components/common/SudoModal.tsx`
  - `components/overlays/SudoModal.tsx`
  - `app/(app)/(auth)/accounts/components/overlays/SudoModal.tsx`
- `components/common/PasskeySetup.tsx`
  - `components/overlays/PasskeySetup.tsx`
- `components/common/EcosystemPortal.tsx`
  - `components/EcosystemPortal.tsx`
- `components/common/DynamicIsland.tsx`
  - `components/ui/DynamicIsland.tsx`
- `components/common/SudoGuard.tsx`
  - `components/ui/SudoGuard.tsx`
- `components/ui/AuthContext.tsx`
  - `context/auth/AuthContext.tsx`
- `components/ui/GlobalSearch.tsx`
  - `components/GlobalSearch.tsx`
- `components/overlays/TwoFAModal.tsx`
  - `components/overlays/TwoFactorDrawer.tsx`
- `components/overlays/MasterPassModal.tsx`
  - `components/overlays/MasterPassDrawer.tsx`
- `components/ui/EmailVerificationReminder.tsx`
  - `components/overlays/VerifyEmailModal.tsx`
- `constants/ecosystem.ts`
  - `lib/constants/ecosystem.ts`

These are not always byte-for-byte copies, but they repeat the same feature and often differ only in container type, styling, or incremental refactors.
