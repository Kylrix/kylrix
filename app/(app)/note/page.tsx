"use client";

import React, { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';

function NoteLandingInner() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/note/notes');
      } else {
        router.replace('/send');
      }
    }
  }, [user, isLoading, router]);

  return null;
}

export default function NoteLandingPage() {
  return (
    <Suspense fallback={null}>
      <NoteLandingInner />
    </Suspense>
  );
}
