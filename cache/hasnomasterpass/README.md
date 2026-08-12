# Technical Analysis: Instant "Incorrect Master Password" Failure in SudoModal

## Executive Summary
When attempting to unlock the vault via `SudoModal.tsx`, entering a master password and submitting the form results in an immediate `"Incorrect master password"` toast error with zero apparent decryption delay or progress indicator. Passkey authentication on the same user account continues to succeed without issue.

---

## Technical Root Cause Analysis

### 1. The `hasMasterpass === false` Guard Trap
In `components/overlays/SudoModal.tsx`:

```typescript
const handlePasswordVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user?.$id) return;

    if (hasMasterpass === false) {
        handleRedirectToVaultSetup();
        return;
    }

    if (!password) return;
    setLoading(true);
    ...
}
```

When `hasMasterpass` resolves to `false` during component initialization, `handlePasswordVerify` invokes `handleRedirectToVaultSetup()` which switches the modal view or triggers error messaging instantly without invoking `masterPassCrypto.unlock()`.

### 2. State & Capability Probe Divergence
The capability probe in `SudoModal.tsx`:
```typescript
const probe = await SecurityEnclave.probeCapabilities(userId);
hasPass = probe.hasMasterpass || entriesRes.some((e: any) => e.type === 'password' || e.type === 'passkey');
```
If `SecurityEnclave.probeCapabilities(userId)` returns `hasMasterpass: false` and `entriesRes` is empty (due to local cache TTL expiration, cold-start race conditions, or network query timeouts), `hasPass` is evaluated as `false`.

### 3. Asymmetry Between Passkey & Password Verification
Passkey verification invokes `handlePasskeyVerify()`, which queries WebAuthn credentials and `verifyPasskeyLoginAction` directly, bypassing the `hasMasterpass` boolean check entirely. This explains why passkey authentication works smoothly for the user while password unlock fails instantly.

---

## Impacted Files & Architecture
- `components/overlays/SudoModal.tsx`: Lines 240-335 (`detect()`) and 376-412 (`handlePasswordVerify()`).
- `lib/security/enclave.ts`: Lines 203-224 (`probeCapabilities()`).
- `lib/masterpass-crypto.ts`: Lines 350-440 (`unlockWithKeychain()`).

---

## Recommended Next Steps & Remediation Guidelines
1. **Decouple Unlock Attempt from Probe State**:
   - `handlePasswordVerify` must always attempt `masterPassCrypto.unlock(password, userId, false)` if `password` is provided, regardless of the initial `hasMasterpass` capability probe state.
2. **Synchronize Enclave Probe on Successful Unlock**:
   - Upon successful unlock in `masterPassCrypto.unlock()`, update `SecurityEnclave` and `SUDO_DETECT_CACHE` so `hasMasterpass` is set to `true`.
3. **Preserve User Setup Routing**:
   - Only route to setup if `masterPassCrypto.unlock()` explicitly returns `false` AND `AppwriteService.listKeychainEntries(userId)` confirms 0 keychain rows exist.
