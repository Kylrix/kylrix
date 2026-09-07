'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { ID, Query } from 'appwrite';
import { tasks as taskApi, calendars as calendarApi, taskCollaborators, subscribeToTable, buildTaskPermissions } from '@/lib/kylrixflow';
import { getCurrentUser, getCurrentUserSnapshot } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getEcosystemUrl } from '@/lib/constants';
import { Task as AppwriteTask, Calendar as AppwriteCalendar } from '@/types/kylrixflow';
import { useDataNexus } from './DataNexusContext';
import { sendKylrixEmailNotification } from '@/lib/email-notifications';
import { useAuth } from '@/context/auth/AuthContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { getAllTags } from '@/lib/appwrite';
import { tagsCacheKey } from '@/lib/data';
import type { Tags } from '@/types/appwrite';
import { parseSourceNoteIdsFromTags } from '@/sdk/crosslinks';
import {

export function syncTaskAccess(bag: any) {
  const {
  addComment,
  addLabel,
  addProject,
  addSubtask,
  addTask,
  addTaskCollaborator,
  applyPendingPatches,
  byId,
  clearStalePendingPatches,
  cloned,
  coerceCachedTask,
  collaboratorIds,
  collaboratorRows,
  comments,
  completeTask,
  context,
  customWorkspaceId,
  deleteLabel,
  deleteProject,
  deleteSubtask,
  deleteTask,
  deleteTaskCollaborator,
  dispatch,
  dispatchSyncedData,
  fetchBatch,
  flowWarmOwnerRef,
  getFilteredTasks,
  getSelectedProject,
  getSelectedTask,
  getTagFilterOptions,
  getTaskStats,
  getTasksByProject,
  goalProjectObjectIdsRef,
  id,
  init,
  initRealtime,
  invalidateCalendarsNexus,
  invalidateTasksNexus,
  isCustomWorkspace,
  isFetchingTasksRef,
  lastPathnameRef,
  lastTaskPullAtRef,
  linkedNotes,
  list,
  listTaskCollaborators,
  mapAppwriteTaskToTask,
  newlyAddedAssignees,
  normalizedAssigneeIds,
  pathname,
  pendingStatusPatchesRef,
  permissions,
  persistGoalsLocalCopy,
  projectId,
  projectTag,
  projectsRef,
  pushLiveGoal,
  pushLiveTag,
  raw,
  refreshEcosystemTags,
  refreshTasks,
  registerPendingStatus,
  selectProject,
  selectTask,
  setFilter,
  setSearchQuery,
  setSidebarOpen,
  setSort,
  setTaskDialogOpen,
  setViewMode,
  shouldIgnoreRealtimeStatus,
  state,
  syncTaskAccess,
  taskMap,
  taskReducer,
  tasksRef,
  threadTasksRef,
  togglePinProject,
  togglePinTask,
  toggleSidebar,
  toggleSubtask,
  toggleTaskReminder,
  updateLabel,
  updateProject,
  updateSubtask,
  updateTask,
  updateTaskCollaborator,
  userLabels,
  value
  } = bag as any;

  const collaboratorRows = await taskCollaborators.list(taskId);
  const collaboratorIds = new Set(collaboratorRows.map((row) => row.userId));
  const normalizedAssigneeIds = Array.from(new Set(assigneeIds.filter((id): id is string => Boolean(id) && id !== 'guest')));
  const newlyAddedAssignees = normalizedAssigneeIds.filter((id) => id !== creatorId && !previousAssigneeIds.includes(id));

  for (const assigneeId of normalizedAssigneeIds) {
    if (!collaboratorIds.has(assigneeId)) {
      const created = await taskCollaborators.create(taskId, assigneeId, 'read', creatorId);
      collaboratorRows.push(created);
      collaboratorIds.add(assigneeId);
    } else {
      const existing = collaboratorRows.find((row) => row.userId === assigneeId);
      if (existing && existing.permission !== 'read') {
        const updated = await taskCollaborators.update(existing.id, { permission: 'read' }, creatorId, taskId);
        const rowIndex = collaboratorRows.findIndex((row) => row.id === existing.id);
        if (rowIndex !== -1) {
          collaboratorRows[rowIndex] = updated;
        }
      }
    }
  }

  const permissions = buildTaskPermissions(creatorId, normalizedAssigneeIds, collaboratorRows);
  await taskApi.update(taskId, { assigneeIds: normalizedAssigneeIds }, permissions);

  if (newlyAddedAssignees.length > 0) {
    await notifyTaskAssignment({
      taskId,
      taskTitle,
      creatorId,
      recipientIds: newlyAddedAssignees}).catch((error) => {
      console.error('[TaskContext] Failed to queue task assignment email', error);
    });
  }

  await Promise.all(
    collaboratorRows.map((collaborator) =>
      taskCollaborators.update(
        collaborator.id,
        { permission: collaborator.permission as CollaboratorPermission },
        creatorId,
        taskId,
        permissions
      )
    )
  );

  return collaboratorRows;
}
