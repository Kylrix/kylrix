"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VaultPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/vault/dashboard');
  }, [router]);

  return null;
}
