"use client";
import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return <>{children}</>;
}

