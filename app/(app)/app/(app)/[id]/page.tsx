'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/context/auth/AuthContext';
import NotesPage from '../page';

export default function AppWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { setActiveWorkspaceId } = useWorkspace();
  const targetId = (params?.id as string) || '';

  useEffect(() => {
    if (!targetId) return;
    if (user?.$id && targetId === user.$id) {
      router.replace('/app');
      return;
    }
    setActiveWorkspaceId(targetId);
  }, [targetId, user?.$id, setActiveWorkspaceId, router]);

  return <NotesPage />;
}
