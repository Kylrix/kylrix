"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { Box, CircularProgress } from '@mui/material';
import { isUserAdmin } from '@/actions/admin/check-admin';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      if (!isLoading) {
        if (!user || !user.email) {
          router.push('/login');
          return;
        }

        // Perform server-side check using the private ADMINS variable
        const result = await isUserAdmin(user.email);
        setIsAdmin(result);

        if (!result) {
          router.push('/');
        }
      }
    };

    checkStatus();
  }, [user, isLoading, router]);

  if (isLoading || isAdmin === null) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#0A0908' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  if (isAdmin === false) {
    return null; // Prevents UI flicker before redirect
  }

  return <>{children}</>;
}
