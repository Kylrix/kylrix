"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { useLoginDrawer } from '@/context/LoginDrawerContext';
import Topbar from '../Topbar';

export default function TopbarShell() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { open: openLoginDrawer } = useLoginDrawer();

  return (
    <Topbar
      userId={user?.$id || undefined}
      userName={user?.name || undefined}
      userEmail={user?.email || undefined}
      profilePicId={(user?.prefs as any)?.profilePicId || null}
      connectedWallet={(user?.prefs as any)?.walletEth || (user?.prefs as any)?.walletAddress || null}
      onManageAccount={() => {
        router.push('/accounts/settings/profile');
      }}
      onSignOut={logout}
      onSessionsClick={() => {
        router.push('/accounts/settings/sessions');
      }}
      onActivityClick={() => {
        router.push('/accounts/settings/activity');
      }}
      authLoading={isLoading}
      onConnect={() => {
        openLoginDrawer();
      }}
    />
  );
}
