'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { attachObjectToProject } from '@/lib/projects/object-attachment';
import { getSessionProjectsList, setSessionProjectsList } from '@/lib/projects/projects-cache';
import { warmProjectsList } from '@/lib/projects/warm-projects-list';

export interface WorkspaceItem {
  id: string;
  title: string;
  ownerId: string;
  isPersonal: boolean;
}

interface WorkspaceContextType {
  activeWorkspace: WorkspaceItem;
  workspaces: WorkspaceItem[];
  loadingWorkspaces: boolean;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (title: string, summary?: string) => Promise<WorkspaceItem | null>;
  attachEntityToActiveWorkspace: (entityKind: string, entityId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { getCachedDataAsync, fetchOptimized } = useDataNexus();
  const userId = user?.$id || 'guest';
  const userName = user?.name || user?.email?.split('@')[0] || 'My';

  const personalWorkspace = useMemo<WorkspaceItem>(
    () => ({
      id: userId,
      title: `${userName}'s Workspace`,
      ownerId: userId,
      isPersonal: true,
    }),
    [userId, userName]
  );

  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(userId);

  const initialItems = useMemo<WorkspaceItem[]>(() => {
    const sessionRows = getSessionProjectsList() || [];
    const mapped = sessionRows.map((p: any) => ({
      id: p.$id || p.id,
      title: p.title || p.name || 'Untitled Workspace',
      ownerId: p.ownerId || p.userId || userId,
      isPersonal: (p.$id || p.id) === userId}));
    return [personalWorkspace, ...mapped.filter((w) => w.id !== personalWorkspace.id)];
  }, [personalWorkspace, userId]);

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>(initialItems);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  useEffect(() => {
    setActiveWorkspaceIdState((prev) => (prev === 'guest' && userId !== 'guest' ? userId : prev));
  }, [userId]);

  const refreshWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const rows = await warmProjectsList({
        userId: userId || 'guest',
        getCachedDataAsync,
        fetchOptimized});

      const customItems: WorkspaceItem[] = (rows || []).map((p: any) => ({
        id: p.$id || p.id,
        title: p.title || p.name || 'Untitled Workspace',
        ownerId: p.ownerId || p.userId || userId,
        isPersonal: (p.$id || p.id) === userId}));

      setWorkspaces([personalWorkspace, ...customItems.filter((w) => w.id !== personalWorkspace.id)]);
    } catch (err) {
      console.warn('[WorkspaceContext] Failed to load workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [userId, personalWorkspace, getCachedDataAsync, fetchOptimized]);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
  }, []);

  const activeWorkspace = useMemo<WorkspaceItem>(() => {
    const found = workspaces.find((w) => w.id === activeWorkspaceId);
    return found || personalWorkspace;
  }, [workspaces, activeWorkspaceId, personalWorkspace]);

  const createWorkspace = useCallback(
    async (title: string, summary?: string): Promise<WorkspaceItem | null> => {
      try {
        const created = await ProjectsService.createProject({
          title,
          summary: summary || '',
          ownerId: userId});
        const newItem: WorkspaceItem = {
          id: created.$id,
          title: created.title || title,
          ownerId: userId,
          isPersonal: false,
        };
        setWorkspaces((prev) => [newItem, ...prev]);
        setActiveWorkspaceIdState(created.$id);
        void refreshWorkspaces();
        return newItem;
      } catch (err) {
        console.error('[WorkspaceContext] Create workspace failed:', err);
        return null;
      }
    },
    [userId, refreshWorkspaces]
  );

  const attachEntityToActiveWorkspace = useCallback(
    async (entityKind: string, entityId: string) => {
      if (activeWorkspace.isPersonal || activeWorkspace.id === userId) {
        return; // Personal items stay in personal workspace naturally
      }
      try {
        await attachObjectToProject({
          projectId: activeWorkspace.id,
          entityKind,
          entityId});
      } catch (err) {
        console.warn(`[WorkspaceContext] Auto-attach entity ${entityKind} ${entityId} failed:`, err);
      }
    },
    [activeWorkspace, userId]
  );

  const value = useMemo(
    () => ({
      activeWorkspace,
      workspaces,
      loadingWorkspaces,
      setActiveWorkspaceId,
      refreshWorkspaces,
      createWorkspace,
      attachEntityToActiveWorkspace}),
    [
      activeWorkspace,
      workspaces,
      loadingWorkspaces,
      setActiveWorkspaceId,
      refreshWorkspaces,
      createWorkspace,
      attachEntityToActiveWorkspace,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

const fallbackPersonalWorkspace: WorkspaceItem = {
  id: 'guest',
  title: 'My Workspace',
  ownerId: 'guest',
  isPersonal: true,
};

const fallbackWorkspaceContext: WorkspaceContextType = {
  activeWorkspace: fallbackPersonalWorkspace,
  workspaces: [fallbackPersonalWorkspace],
  loadingWorkspaces: false,
  setActiveWorkspaceId: () => {},
  refreshWorkspaces: async () => {},
  createWorkspace: async () => null,
  attachEntityToActiveWorkspace: async () => {},
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  return context || fallbackWorkspaceContext;
}
