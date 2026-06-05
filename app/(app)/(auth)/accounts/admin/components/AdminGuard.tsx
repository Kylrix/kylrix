"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { isUserAdmin } from '@/lib/actions/admin/check-admin';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const checkedRef = useRef(false);

  // Derive whether we have a "real" user (not a pulse-cached stub without email)
  const isPulseOnly = !!(user && (user as any).isPulse && !user.email);
  const isRealUser = !!(user && user.email && !isPulseOnly);
  const isStillLoading = isLoading || isPulseOnly;

  useEffect(() => {
    // Reset check state when user identity changes
    if (!isRealUser) {
      checkedRef.current = false;
      return;
    }

    // Prevent duplicate checks for the same user session
    if (checkedRef.current) return;

    const checkStatus = async () => {
      if (isStillLoading) return;

      if (!isRealUser) {
        router.push('/accounts/login');
        return;
      }

      checkedRef.current = true;

      try {
        // Server-side check reads session cookies directly via getActor()
        const result = await isUserAdmin();
        console.log('[AdminGuard] isUserAdmin result:', result, 'for email:', user!.email);
        setIsAdmin(result);

        if (!result) {
          console.warn('[AdminGuard] User is not admin, redirecting. Email:', user!.email);
          router.push('/');
        }
      } catch (err) {
        console.error('[AdminGuard] Admin check failed with exception:', err);
        setIsAdmin(false);
        router.push('/');
      }
    };

    checkStatus();
  }, [isRealUser, isStillLoading, user, router]);

  // Show spinner while loading, pulse-resolving, or waiting for admin check result
  if (isStillLoading || isAdmin === null) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0A0908]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  if (isAdmin === false) {
    return null;
  }

  return <>{children}</>;
}
