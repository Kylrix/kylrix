"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { isUserAdmin } from '@/lib/actions/admin/check-admin';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      if (!isLoading) {
        if (!user || !user.email) {
          router.push('/accounts/login');
          return;
        }

        try {
          // Perform server-side check using the private ADMINS variable
          const result = await isUserAdmin();
          console.log('[AdminGuard] isUserAdmin result:', result, 'for email:', user.email);
          setIsAdmin(result);

          if (!result) {
            console.warn('[AdminGuard] User is not admin, redirecting. Email:', user.email);
            router.push('/');
          }
        } catch (err) {
          console.error('[AdminGuard] Admin check failed with exception:', err);
          setIsAdmin(false);
          router.push('/');
        }
      }
    };

    checkStatus();
  }, [user, isLoading, router]);

  if (isLoading || isAdmin === null) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0A0908]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  if (isAdmin === false) {
    return null; // Prevents UI flicker before redirect
  }

  return <>{children}</>;
}
