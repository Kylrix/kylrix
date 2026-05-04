"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppwriteVault } from "@/context/appwrite-context";

/**
 * VaultGuard: Wrap protected pages/components with this to enforce
 * that the vault (crypto module) is unlocked. If not, the drawer in
 * the dashboard will automatically show the master password modal.
 *
 * Usage:
 *   <VaultGuard>
 *     ...protected content...
 *   </VaultGuard>
 */
export default function VaultGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isVaultUnlocked, needsMasterPassword, isAuthReady } = useAppwriteVault();
  const router = useRouter();
  const pathname = usePathname();
  const verbose =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_LOGGING_VERBOSE === "true"
      : false;

  useEffect(() => {
    if (!isAuthReady) return;

    const locked = needsMasterPassword || !isVaultUnlocked();
    if (verbose)
      console.log("[vault-guard] ready, locked?", locked, "path", pathname);

    if (locked) {
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("masterpass_return_to", pathname);
        } catch {}
      }
      // Note: The master password drawer is now handled by the dashboard
      // No redirect needed; the drawer will show automatically
    }
  }, [
    isAuthReady,
    needsMasterPassword,
    isVaultUnlocked,
    pathname,
    router,
    verbose,
  ]);

  if (!isAuthReady) {
    return null; // or a skeleton
  }

  if (needsMasterPassword || !isVaultUnlocked()) {
    // Still render children, but let the drawer handle the unlock flow
    // in the dashboard context
    return <>{children}</>;
  }

  return <>{children}</>;
}
