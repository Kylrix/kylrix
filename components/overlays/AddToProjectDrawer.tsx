'use client';

import React, { useState, useCallback } from 'react';
import { FolderKanban, Plus, Check } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useSubProjects } from '@/hooks/useSubProjects';
import { attachObjectToProject } from '@/lib/projects/object-attachment';
import { userCanUseProjects } from '@/lib/projects/feature-gate-client';
import { getUserSubscriptionTier } from '@/lib/utils';
import { Box, Typography, Stack, IconButton, List, ListItem, ListItemButton, ListItemText } from '@/lib/openbricks/primitives';

type AddToProjectDrawerData = {
  entityKind?: string;
  entityId?: string;
  entityTitle?: string;
  workspaceId?: string;
  taskId?: string;
  taskTitle?: string;
  resourceId?: string;
  resourceTitle?: string;
};

export function AddToProjectDrawerHost() {
  const { activeContent, drawerData, close, open: openDrawer } = useUnifiedDrawer();
  const { activeWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const { openProUpgrade } = useProUpgrade();

  const isOpen = activeContent === 'add-to-project' || activeContent === 'task-add-to-project';
  const data = (drawerData || {}) as AddToProjectDrawerData;

  const parentWorkspaceId = data.workspaceId || activeWorkspace?.id || null;
  const isPersonal = parentWorkspaceId === user?.$id || activeWorkspace?.isPersonal;

  const { projects, loading } = useSubProjects(isOpen && !isPersonal ? parentWorkspaceId : null);
  const [attaching, setAttaching] = useState<string | null>(null);

  const entityKind = data.entityKind || (activeContent === 'task-add-to-project' ? 'goal' : 'note');
  const entityId = data.entityId || data.taskId || data.resourceId || '';
  const entityTitle = data.entityTitle || data.taskTitle || data.resourceTitle || 'Item';

  const handleSelect = useCallback(async (projectId: string) => {
    if (!entityId) return;
    setAttaching(projectId);
    try {
      await attachObjectToProject({
        projectId,
        entityKind,
        entityId,
      });
      showSuccess('Added to project');
      close();
    } catch (err: any) {
      showError(err?.message || 'Failed to add to project');
    } finally {
      setAttaching(null);
    }
  }, [entityId, entityKind, close, showSuccess, showError]);

  const handleCreateNew = useCallback(() => {
    if (!userCanUseProjects(getUserSubscriptionTier(user))) {
      openProUpgrade('Projects');
      return;
    }
    if (!parentWorkspaceId) return;
    close();
    openDrawer('new-project', {
      isSubProject: true,
      parentWorkspaceId,
      pendingAttachment: entityId
        ? { entityKind, entityId }
        : undefined,
    });
  }, [user, parentWorkspaceId, close, openDrawer, openProUpgrade, entityId, entityKind]);

  if (!isOpen) return null;

  return (
    <Box className="p-6 pb-8 max-h-[70vh] overflow-y-auto bg-[#161412]">
      <Stack direction="row" alignItems="center" justifyContent="space-between" className="mb-4">
        <Typography className="text-base font-black text-white font-clash">
          Add to project
        </Typography>
        <IconButton onClick={close} size="small" className="text-white/60">
          ✕
        </IconButton>
      </Stack>

      {isPersonal ? (
        <Typography className="text-sm text-white/50">
          Switch to a workspace to organize items into projects.
        </Typography>
      ) : (
        <>
          <Typography className="text-xs text-white/40 mb-4">
            Choose a project in {activeWorkspace?.title || 'this workspace'} for &ldquo;{entityTitle}&rdquo;
          </Typography>

          <button
            type="button"
            onClick={handleCreateNew}
            className="w-full flex items-center gap-2 p-3 mb-3 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/30 text-[#818CF8] text-sm font-bold hover:bg-[#6366F1]/25 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Create new project
          </button>

          {loading ? (
            <Typography className="text-xs text-white/40 text-center py-6">Loading projects...</Typography>
          ) : projects.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#0A0908] border border-dashed border-white/10 text-center">
              <FolderKanban className="h-6 w-6 text-white/20 mx-auto mb-2" />
              <Typography className="text-xs text-white/50">No projects yet. Create one above.</Typography>
            </div>
          ) : (
            <List disablePadding>
              {projects.map((p) => (
                <ListItem key={p.$id} disablePadding className="mb-1">
                  <ListItemButton
                    onClick={() => handleSelect(p.$id)}
                    disabled={attaching === p.$id}
                    className="rounded-xl hover:bg-white/5"
                  >
                    <FolderKanban size={16} className="text-[#818CF8] mr-3 shrink-0" />
                    <ListItemText
                      primary={p.title || 'Untitled Project'}
                      primaryTypographyProps={{ className: 'text-sm font-bold text-white' }}
                    />
                    {attaching === p.$id && <Check size={16} className="text-emerald-400" />}
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </>
      )}
    </Box>
  );
}
