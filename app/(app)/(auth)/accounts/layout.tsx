'use client';

import React from 'react';
import { AuthProvider } from '@/context/auth/AuthContext';

export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}