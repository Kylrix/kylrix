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

export function deleteTask(bag: any) {
  const {
  addComment,
  addLabel,
  addProject,
  addSubtask,
  addTask,
  addTaskCollaborator,
  applyPendingPatches,
  clearStalePendingPatches,
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
  invalidateCalendarsNexus,
  invalidateTasksNexus,
  isCustomWorkspace,
  isFetchingTasksRef,
  lastPathnameRef,
  lastTaskPullAtRef,
  listTaskCollaborators,
  pathname,
  pendingStatusPatchesRef,
  projectsRef,
  pushLiveGoal,
  pushLiveTag,
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
  value
  } = bag as any;

    dispatch({ type: 'DELETE_TASK', payload: id });
    autonomicSyncEngine.cancelPending(id);
    autonomicSyncEngine.cancelPending(goalPendingKey(id));
    try {
      const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
      const db = await getRxDB();
      await db.cache.findOne(`goal_${id}`).remove().catch(() => {});
    } catch {}

    try {
      const collectDescendants = (taskId: string): string[] => {
        const directChildren = state.tasks.filter(task => task.parentTaskId === taskId).map(task => task.id);
        const descendantIds: string[] = [];
        directChildren.forEach((childId) => {
          descendantIds.push(childId, ...collectDescendants(childId));
        });
        return descendantIds;
      };

      const descendantIds = collectDescendants(id);
      for (const childId of descendantIds) {
        dispatch({ type: 'DELETE_TASK', payload: childId });
        autonomicSyncEngine.cancelPending(childId);
        autonomicSyncEngine.cancelPending(goalPendingKey(childId));
        try {
          const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
          const db = await getRxDB();
          await db.cache.findOne(`goal_${childId}`).remove().catch(() => {});
        } catch {}
        const childCollaborators = await taskCollaborators.list(childId).catch(() => []);
        await Promise.all(childCollaborators.map((collaborator) => taskCollaborators.delete(collaborator.id).catch(() => {})));
        await taskApi.delete(childId).catch(() => {});
      }

      const currentCollaborators = await taskCollaborators.list(id).catch(() => []);
      await Promise.all(currentCollaborators.map((collaborator) => taskCollaborators.delete(collaborator.id).catch(() => {})));
      await taskApi.delete(id).catch(() => {});
      invalidateTasksNexus(state.userId || 'guest');
      dispatch({ type: 'DELETE_TASK', payload: id });
    } catch (error: unknown) {
      console.error('Failed to delete task', error);
    }
}
