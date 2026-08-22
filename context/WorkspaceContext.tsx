'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { attachObjectToProject } from '@/lib/projects/object-attachment';
import { getSessionProjectsList, projectObjectsKindCacheKey } from '@/lib/projects/projects-cache';
import { normalizeProjectsList, warmProjectsList } from '@/lib/projects/warm-projects-list';
import type { ProjectObjects } from '@/types/appwrite';

export interface WorkspaceItem {
  id: string;
  title: string;
  ownerId: string;
  isPersonal: boolean;
  isShared?: boolean;
  isPublic?: boolean;
  role?: string;
}

interface WorkspaceContextType {
  activeWorkspace: WorkspaceItem;
  workspaces: WorkspaceItem[];
  ownedWorkspaces: WorkspaceItem[];
  sharedWorkspaces: WorkspaceItem[];
  loadingWorkspaces: boolean;
  setActiveWorkspaceId: (id: string) => void;
  registerSharedWorkspace: (workspace: { id: string; title?: string; ownerId?: string; isPublic?: boolean }) => Promise<void>;
  markWorkspacePublic: (workspaceId: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (title: string, summary?: string) => Promise<WorkspaceItem | null>;
  attachEntityToActiveWorkspace: (entityKind: string, entityId: string) => Promise<void>;
  setEntityPersonalWorkspaceState: (entityKind: string, entityId: string, inPersonal: boolean) => Promise<void>;
  isEntityPendingInActiveWorkspace: (entityKind: string, entityId: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { getCachedDataAsync, fetchOptimized } = useDataNexus();
  const userId = user?.$id || 'guest';
  // Derive a clean display name for the personal workspace label.
  // Avoid "My's Workspace" — if name contains an apostrophe already or is absent,
  // we use the raw name but strip a trailing "'s" to prevent double-possessive.
  const rawName = (user?.name || user?.email?.split('@')[0] || '').trim();
  // Build title: "<Name>'s Workspace" when we have a name, otherwise "My Workspace"
  const personalWorkspaceTitle = rawName
    ? `${rawName}'s Workspace`
    : 'My Workspace';

  const personalWorkspace = useMemo<WorkspaceItem>(
    () => ({
      id: userId,
      title: personalWorkspaceTitle,
      ownerId: userId,
      isPersonal: true,
      isShared: false,
      role: 'owner',
    }),
    [userId, personalWorkspaceTitle]
  );

  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(userId);
  const hydratedRef = useRef(false);
  const lastSetIdRef = useRef<string | null>(null);
  const pendingPrefSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUserIdRef = useRef(userId);
  const pendingProjectObjectsRef = useRef<Map<string, Set<string>>>(new Map());
  const isEntityPendingInActiveWorkspace = useCallback(
    (entityKind: string, entityId: string) => {
      if (!activeWorkspaceId || activeWorkspaceId === userId) return false;
      const key = `${activeWorkspaceId}:${entityKind}`;
      const set = pendingProjectObjectsRef.current.get(key);
      return set ? set.has(entityId) : false;
    },
    [activeWorkspaceId, userId]
  );

  const mapProjectRows = useCallback(
    (rows: unknown): WorkspaceItem[] =>
      normalizeProjectsList(rows)
        .map((p: any) => {
          const id = String(p.$id || p.id || '').trim();
          const ownerId = p.ownerId || p.userId || '';
          const isOwned = ownerId === userId || (!ownerId && userId !== 'guest');
          const isShared = !isOwned || p.isShared === true || (p.collabStatus && p.collabStatus !== 'owner');
          return {
            id,
            title: p.title || p.name || 'Untitled Workspace',
            ownerId: ownerId || userId,
            isPersonal: false as const,
            isShared,
            isPublic: !!p.isPublic,
            role: p.role || (isOwned ? 'owner' : 'viewer'),
          };
        })
        .filter((w) => w.id && w.id !== personalWorkspace.id),
    [personalWorkspace.id, userId],
  );

  const initialItems = useMemo<WorkspaceItem[]>(() => {
    return [personalWorkspace, ...mapProjectRows(getSessionProjectsList() || [])];
  }, [personalWorkspace, mapProjectRows]);

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>(initialItems);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  const refreshWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const { clearSessionProjectsList } = await import('@/lib/projects/projects-cache');
      clearSessionProjectsList();
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const [rows, localShared] = await Promise.all([
        warmProjectsList({
          userId: userId || 'guest',
          getCachedDataAsync,
          fetchOptimized,
        }),
        LocalEngine.cacheGet<WorkspaceItem[]>(`visited_shared_workspaces_${userId}`).catch(() => []),
      ]);

      const mapped = mapProjectRows(rows);
      const mappedLocal = Array.isArray(localShared)
        ? localShared.filter((s) => s.id && s.id !== personalWorkspace.id)
        : [];

      const byId = new Map<string, WorkspaceItem>();
      byId.set(personalWorkspace.id, personalWorkspace);
      for (const w of mapped) byId.set(w.id, w);
      for (const w of mappedLocal) {
        if (!byId.has(w.id)) byId.set(w.id, { ...w, isShared: true, isPersonal: false });
      }

      setWorkspaces([personalWorkspace, ...Array.from(byId.values()).filter((w) => w.id !== personalWorkspace.id)]);
    } catch (err) {
      console.warn('[WorkspaceContext] Failed to load workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [personalWorkspace, getCachedDataAsync, fetchOptimized, mapProjectRows, userId]);

  const registerSharedWorkspace = useCallback(
    async (workspace: { id: string; title?: string; ownerId?: string; isPublic?: boolean }) => {
      if (!workspace.id || workspace.id === personalWorkspace.id) return;
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cacheKey = `visited_shared_workspaces_${userId}`;
        const existing = (await LocalEngine.cacheGet<WorkspaceItem[]>(cacheKey)) || [];
        const item: WorkspaceItem = {
          id: workspace.id,
          title: workspace.title || 'Shared Workspace',
          ownerId: workspace.ownerId || '',
          isPersonal: false,
          isShared: true,
          isPublic: workspace.isPublic !== undefined ? workspace.isPublic : true,
          role: 'viewer',
        };
        const filtered = existing.filter((w) => w.id !== workspace.id);
        const updated = [item, ...filtered].slice(0, 30);
        await LocalEngine.cacheSet(cacheKey, updated);
        setWorkspaces((prev) => {
          const byId = new Map(prev.map((w) => [w.id, w]));
          byId.set(item.id, item);
          return [personalWorkspace, ...Array.from(byId.values()).filter((w) => w.id !== personalWorkspace.id)];
        });
      } catch (err) {
        console.warn('[WorkspaceContext] Failed to register visited shared workspace:', err);
      }
    },
    [personalWorkspace, userId]
  );

  const markWorkspacePublic = useCallback(
    async (workspaceId: string) => {
      setWorkspaces((prev) =>
        prev.map((w) =>
          w.id === workspaceId ? { ...w, isPublic: true, isGuest: true } : w
        )
      );
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const [userProjects, globalProjects] = await Promise.all([
          LocalEngine.cacheGet<any[]>(`f_projects_list_${userId}`),
          LocalEngine.cacheGet<any[]>('f_projects_list'),
        ]);
        if (Array.isArray(userProjects)) {
          const updated = userProjects.map((p) =>
            (p.$id === workspaceId || p.id === workspaceId) ? { ...p, isPublic: true, isGuest: true } : p
          );
          await LocalEngine.cacheSet(`f_projects_list_${userId}`, updated);
        }
        if (Array.isArray(globalProjects)) {
          const updated = globalProjects.map((p) =>
            (p.$id === workspaceId || p.id === workspaceId) ? { ...p, isPublic: true, isGuest: true } : p
          );
          await LocalEngine.cacheSet('f_projects_list', updated);
        }
      } catch {}
    },
    [userId]
  );

  useEffect(() => {
    if (lastUserIdRef.current !== userId) {
      hydratedRef.current = false;
      lastSetIdRef.current = userId;
      lastUserIdRef.current = userId;
      setActiveWorkspaceIdState(userId);
      setWorkspaces([personalWorkspace]);
    } else {
      setActiveWorkspaceIdState((prev) => (prev === 'guest' && userId !== 'guest' ? userId : prev));
    }
    void refreshWorkspaces();
  }, [userId, personalWorkspace, refreshWorkspaces]);

  useEffect(() => {
    void (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const [userProjects, globalProjects, localShared] = await Promise.all([
          LocalEngine.cacheGet(`f_projects_list_${userId}`),
          LocalEngine.cacheGet('f_projects_list'),
          LocalEngine.cacheGet<WorkspaceItem[]>(`visited_shared_workspaces_${userId}`).catch(() => []),
        ]);
        const mapped = mapProjectRows(userProjects || globalProjects || []);
        const mappedLocal = Array.isArray(localShared)
          ? localShared.filter((s) => s.id && s.id !== personalWorkspace.id)
          : [];
        if (!mapped.length && !mappedLocal.length) return;
        setWorkspaces((prev) => {
          const byId = new Map(prev.map((w) => [w.id, w]));
          byId.set(personalWorkspace.id, personalWorkspace);
          for (const w of mapped) byId.set(w.id, w);
          for (const w of mappedLocal) {
            if (!byId.has(w.id)) byId.set(w.id, { ...w, isShared: true, isPersonal: false });
          }
          return [personalWorkspace, ...Array.from(byId.values()).filter((w) => w.id !== personalWorkspace.id)];
        });
      } catch {
        /* optional */
      }
    })();
  }, [personalWorkspace, mapProjectRows, userId]);

  const ACTIVE_WORKSPACE_CACHE_KEY = `kylrix_active_workspace_${userId}`;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const saved = await LocalEngine.cacheGet(ACTIVE_WORKSPACE_CACHE_KEY);
        if (cancelled) return;
        if (hydratedRef.current) return;
        if (saved && typeof saved === 'string' && saved.trim()) {
          const trimmed = saved.trim();
          hydratedRef.current = true;
          lastSetIdRef.current = trimmed;
          setActiveWorkspaceIdState(trimmed);
          return;
        }
        if (user?.prefs?.activeWorkspaceId && typeof user.prefs.activeWorkspaceId === 'string') {
          const prefId = (user.prefs.activeWorkspaceId as string).trim();
          if (prefId) {
            hydratedRef.current = true;
            lastSetIdRef.current = prefId;
            setActiveWorkspaceIdState(prefId);
            try {
              await LocalEngine.cacheSet(ACTIVE_WORKSPACE_CACHE_KEY, prefId);
            } catch {}
            return;
          }
        }
        hydratedRef.current = true;
      } catch {
        hydratedRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, ACTIVE_WORKSPACE_CACHE_KEY]);

  useEffect(() => {
    return () => {
      if (pendingPrefSyncRef.current) clearTimeout(pendingPrefSyncRef.current);
    };
  }, []);

  const { updatePreferences } = useAuth();

  const setActiveWorkspaceId = useCallback((id: string) => {
    const trimmed = String(id || '').trim();
    if (!trimmed) return;
    if (trimmed === lastSetIdRef.current) return;
    lastSetIdRef.current = trimmed;
    hydratedRef.current = true;
    setActiveWorkspaceIdState(trimmed);
    void (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        await LocalEngine.cacheSet(ACTIVE_WORKSPACE_CACHE_KEY, trimmed);
      } catch {}
    })();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('kylrix:workspace-changed', {
          detail: { previousId: lastSetIdRef.current, workspaceId: trimmed }
        })
      );
    }
    if (pendingPrefSyncRef.current) clearTimeout(pendingPrefSyncRef.current);
    pendingPrefSyncRef.current = setTimeout(() => {
      if (user?.$id && typeof updatePreferences === 'function') {
        void updatePreferences({ activeWorkspaceId: trimmed });
      }
    }, 800);
  }, [ACTIVE_WORKSPACE_CACHE_KEY, user?.$id, updatePreferences]);

  // High-performance background prewarming for active workspace objects
  useEffect(() => {
    if (!activeWorkspaceId || activeWorkspaceId === userId || activeWorkspaceId === 'guest') return;
    const targetId = activeWorkspaceId;
    let cancelled = false;

    void (async () => {
      const kinds = ['goal', 'note', 'event', 'form', 'password', 'totp', 'agent_session'];
      for (const kind of kinds) {
        if (cancelled) break;
        try {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cacheKey = projectObjectsKindCacheKey(targetId, kind);
          const res = await ProjectsService.listProjectObjectsByKind(targetId, kind).catch(() => null);
          const rows = Array.isArray(res) ? res : Array.isArray((res as any)?.rows) ? (res as any).rows : [];
          if (rows.length > 0 && !cancelled) {
            await LocalEngine.cacheSet(cacheKey, rows).catch(() => {});
          }
        } catch {
          /* optional background warm */
        }
      }

      // Fetch and warm actual workspace entities (notes, goals, events, forms)
      try {
        const tagged = await ProjectsService.listTaggedResources(targetId).catch(() => null);
        if (tagged && !cancelled) {
          if (Array.isArray(tagged.notes) && tagged.notes.length > 0) {
            for (const note of tagged.notes) {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('kylrix:live-note-saved', { detail: { note: { ...note, projectId: targetId, isWorkspace: true } } }));
              }
            }
          }
          if (Array.isArray(tagged.tasks) && tagged.tasks.length > 0) {
            for (const task of tagged.tasks) {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('kylrix:live-task-saved', { detail: { task: { ...task, projectId: targetId, isWorkspace: true } } }));
              }
            }
          }
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, userId]);

  // When switching to a shared workspace, verify it is still accessible and public in the background
  useEffect(() => {
    if (!activeWorkspaceId || activeWorkspaceId === userId || activeWorkspaceId === 'guest') return;
    const targetId = activeWorkspaceId;
    const currentW = workspaces.find((w) => w.id === targetId);
    if (!currentW || !currentW.isShared) return;

    let cancelled = false;
    void (async () => {
      try {
        const proj = await ProjectsService.getProject(targetId).catch(() => null);
        if (cancelled) return;
        if (!proj || (proj.isPublic === false && proj.ownerId !== userId)) {
          const { LocalEngine } = await import('@/lib/services/LocalEngine');
          const cacheKey = `visited_shared_workspaces_${userId}`;
          const existing = (await LocalEngine.cacheGet<WorkspaceItem[]>(cacheKey)) || [];
          await LocalEngine.cacheSet(cacheKey, existing.filter((w) => w.id !== targetId));
          setWorkspaces((prev) => prev.filter((w) => w.id !== targetId));
          setActiveWorkspaceIdState(userId);
          const { toast } = await import('react-hot-toast');
          toast.error('This shared workspace is no longer public or accessible.');
        }
      } catch {
        /* no-op */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, userId, workspaces]);

  const activeWorkspace = useMemo<WorkspaceItem>(() => {
    const found = workspaces.find((w) => w.id === activeWorkspaceId);
    if (found) return found;
    if (activeWorkspaceId && activeWorkspaceId !== userId && activeWorkspaceId !== 'guest') {
      return {
        id: activeWorkspaceId,
        title: 'Workspace',
        ownerId: userId,
        isPersonal: false,
        isShared: true,
        role: 'viewer',
      };
    }
    return personalWorkspace;
  }, [workspaces, activeWorkspaceId, personalWorkspace, userId]);

  const ownedWorkspaces = useMemo(
    () => workspaces.filter((w) => !w.isPersonal && (!w.isShared && (w.ownerId === userId || !w.ownerId))),
    [workspaces, userId]
  );

  const sharedWorkspaces = useMemo(
    () => workspaces.filter((w) => !w.isPersonal && (w.isShared || (w.ownerId && w.ownerId !== userId))),
    [workspaces, userId]
  );

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
          isShared: false,
          role: 'owner',
        };
        setWorkspaces((prev) => [
          personalWorkspace,
          newItem,
          ...prev.filter((w) => w.id !== personalWorkspace.id && w.id !== newItem.id),
        ]);
        setActiveWorkspaceIdState(created.$id);
        void refreshWorkspaces();
        return newItem;
      } catch (err) {
        console.error('[WorkspaceContext] Create workspace failed:', err);
        return null;
      }
    },
    [userId, refreshWorkspaces, personalWorkspace]
  );

  const attachEntityToActiveWorkspace = useCallback(
    async (entityKind: string, entityId: string) => {
      if (!activeWorkspace || activeWorkspace.isPersonal) return;
      // Track in-memory pending attachment
      const key = `${activeWorkspace.id}:${entityKind}`;
      if (!pendingProjectObjectsRef.current.has(key)) {
        pendingProjectObjectsRef.current.set(key, new Set());
      }
      pendingProjectObjectsRef.current.get(key)!.add(entityId);
      // Fast optimistic update in LocalEngine
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cacheKey = projectObjectsKindCacheKey(activeWorkspace.id, entityKind);
        const existing = (await LocalEngine.cacheGet<ProjectObjects[]>(cacheKey)) || [];
        if (!existing.some((r) => r.entityId === entityId && r.entityKind === entityKind)) {
          const optimisticRow = {
            $id: `${activeWorkspace.id}:${entityKind}:${entityId}`,
            entityId,
            entityKind,
            projectId: activeWorkspace.id,
            $createdAt: new Date().toISOString(),
          } as unknown as ProjectObjects;
          await LocalEngine.cacheSet(cacheKey, [...existing, optimisticRow]);
        }
      } catch {}
      try {
        await attachObjectToProject({
          projectId: activeWorkspace.id,
          entityKind,
          entityId});
        // Mark row as workspace-scoped so default (no-workspace) views can hide it
        try {
          const { databases } = await import('@/lib/appwrite/client');
          const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
          const tableByKind: Record<string, string> = {
            note: APPWRITE_CONFIG.TABLES.NOTES,
            idea: APPWRITE_CONFIG.TABLES.NOTES,
            goal: APPWRITE_CONFIG.TABLES.TASKS,
            task: APPWRITE_CONFIG.TABLES.TASKS,
            form: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
            event: APPWRITE_CONFIG.TABLES.EVENTS,
            credential: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
            totp: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS,
            agent_session: 'agentic_sessions',
            agentic_session: 'agentic_sessions',
          };
          const tableId = tableByKind[entityKind];
          if (tableId) {
            await databases.updateRow(
              APPWRITE_CONFIG.DATABASE_ID,
              tableId,
              entityId,
              { isWorkspace: true, projectId: activeWorkspace.id },
            );
          }
        } catch (flagErr) {
          console.warn('[WorkspaceContext] isWorkspace flag update failed:', flagErr);
        }
      } catch (err) {
        console.warn(`[WorkspaceContext] Auto-attach entity ${entityKind} ${entityId} failed:`, err);
      }
    },
    [activeWorkspace]
  );

  const setEntityPersonalWorkspaceState = useCallback(
    async (entityKind: string, entityId: string, inPersonal: boolean) => {
      try {
        const { databases } = await import('@/lib/appwrite/client');
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
        const tableByKind: Record<string, string> = {
          note: APPWRITE_CONFIG.TABLES.NOTES,
          idea: APPWRITE_CONFIG.TABLES.NOTES,
          goal: APPWRITE_CONFIG.TABLES.TASKS,
          task: APPWRITE_CONFIG.TABLES.TASKS,
          form: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
          event: APPWRITE_CONFIG.TABLES.EVENTS,
          credential: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
          totp: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS,
          agent_session: 'agentic_sessions',
          agentic_session: 'agentic_sessions',
        };
        const tableId = tableByKind[entityKind];
        if (tableId) {
          await databases.updateRow(
            APPWRITE_CONFIG.DATABASE_ID,
            tableId,
            entityId,
            { isWorkspace: !inPersonal, projectId: inPersonal ? null : activeWorkspace.id },
          );
        }
      } catch (err) {
        console.warn(`[WorkspaceContext] Failed to update isWorkspace flag for ${entityKind} ${entityId}:`, err);
      }
    },
    [activeWorkspace.id]
  );

  const value = useMemo(
    () => ({
      activeWorkspace,
      workspaces,
      ownedWorkspaces,
      sharedWorkspaces,
      loadingWorkspaces,
      setActiveWorkspaceId,
      registerSharedWorkspace,
      markWorkspacePublic,
      refreshWorkspaces,
      createWorkspace,
      attachEntityToActiveWorkspace,
      setEntityPersonalWorkspaceState,
      isEntityPendingInActiveWorkspace,
    }),
    [
      activeWorkspace,
      workspaces,
      ownedWorkspaces,
      sharedWorkspaces,
      loadingWorkspaces,
      setActiveWorkspaceId,
      registerSharedWorkspace,
      markWorkspacePublic,
      refreshWorkspaces,
      createWorkspace,
      attachEntityToActiveWorkspace,
      setEntityPersonalWorkspaceState,
      isEntityPendingInActiveWorkspace,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

const fallbackPersonalWorkspace: WorkspaceItem = {
  id: 'guest',
  title: 'My Workspace',
  ownerId: 'guest',
  isPersonal: true,
  isShared: false,
  role: 'owner',
};

const fallbackWorkspaceContext: WorkspaceContextType = {
  activeWorkspace: fallbackPersonalWorkspace,
  workspaces: [fallbackPersonalWorkspace],
  ownedWorkspaces: [],
  sharedWorkspaces: [],
  loadingWorkspaces: false,
  setActiveWorkspaceId: () => {},
  registerSharedWorkspace: async () => {},
  markWorkspacePublic: () => {},
  refreshWorkspaces: async () => {},
  createWorkspace: async () => null,
  attachEntityToActiveWorkspace: async () => {},
  setEntityPersonalWorkspaceState: async () => {},
  isEntityPendingInActiveWorkspace: () => false,
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  return context || fallbackWorkspaceContext;
}
