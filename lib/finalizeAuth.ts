"use client";

import { getMfaAuthenticationStatus } from "@/lib/appwrite";
import { useRouter } from "next/navigation";
import { useAppwriteVault } from "@/context/appwrite-context";

/**
 * Centralized post-auth finalization.
 * - Ensures Appwrite session is settled (post-MFA/OTP/password/passkey)
 * - Refreshes Auth context
 * - router.refresh() to refetch RSC and cookies
 * - Navigates to the correct next route (masterpass or dashboard) if requested
 */
export function useFinalizeAuth() {
  const router = useRouter();
  const { refresh, user, isVaultUnlocked } = useAppwriteVault();

  const finalize = async (options?: {
    redirect?: boolean;
    fallback?: string;
  }) => {
    // 1) Touch account to ensure cookies/session are applied
    try {
      await getMfaAuthenticationStatus();
    } catch {}

    // 2) Refresh app context
    await refresh();

    // 3) Refresh RSC tree so guards/topbar see new auth
    router.refresh();

    if (options?.redirect) {
      // Decide next route
      const u =
        user ||
        (await (async () => {
          await refresh();
          return null;
        })());
      // If no user after refresh, go to fallback/dashboard
      if (!u) {
        router.replace(options.fallback || "/dashboard");
        return;
      }
      // The vault crypto lock is the source of truth for local access.
      if (!isVaultUnlocked()) {
        router.replace("/dashboard");
      } else {
        router.replace("/dashboard");
      }
    }
  };

  return { finalizeAuth: finalize };
}
