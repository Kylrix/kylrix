"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import Topbar from '../Topbar';

export default function TopbarShell() {
  const { user, logout } = useAuth();

  return (
    <Topbar
      userId={user?.$id || undefined}
      userName={user?.name || undefined}
      userEmail={user?.email || undefined}
      profilePicId={(user?.prefs as any)?.profilePicId || null}
      connectedWallet={(user?.prefs as any)?.walletEth || (user?.prefs as any)?.walletAddress || null}
      onManageAccount={() => {
        window.location.href = '/accounts/settings/profile';
      }}
      onSignOut={logout}
      onSessionsClick={() => {
        window.location.href = '/accounts/settings/sessions';
      }}
      onActivityClick={() => {
        window.location.href = '/accounts/settings/activity';
      }}
    />
  );
}
