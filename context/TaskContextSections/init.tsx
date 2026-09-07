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

export function init(bag: any) {
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

      try {
        let userId = authUser?.$id || 'guest';
        if (!authUser?.$id) {
            try {
                const user = await getCurrentUser();
                userId = user.$id;
            } catch {
                // If we can't get user even here, we are truly guest
            }
        }
        dispatch({ type: 'SET_USER', payload: userId });
        flowWarmOwnerRef.current = userId;

        threadTasksRef.current = [];

        const tasksKey = `f_tasks_${userId}`;
        const calsKey = `f_calendars_${userId}`;
        const COLD_START_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days authoritative window

        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const db = await import('@/lib/webrtc/RxDBManager').then((m) => m.getRxDB()).catch(() => null);

        const instant = await loadGoalsFromLocalCopy({
          userId,
          existingTasks: tasksRef.current,
          getCachedDataSync: (key) => getCachedData(key, COLD_START_TTL),
          getCachedDataAsync: (key) => getCachedDataAsync(key, COLD_START_TTL)});

        const [cachedTasksRes, cachedCalsRes, guestTasksRes, goalsListCache, rxTasks] = await Promise.all([
            getCachedDataAsync<any>(tasksKey, COLD_START_TTL),
            getCachedDataAsync<any>(calsKey, COLD_START_TTL),
            userId === 'guest' ? getCachedDataAsync<any>('f_tasks_guest', COLD_START_TTL) : Promise.resolve(null),
            LocalEngine.cacheGet<any[]>(`f_goals_list_${userId}`),
            db?.tasks ? db.tasks.find({ selector: { userId: { $eq: userId } } }).exec().then((docs: any[]) => docs.map((d) => d.toJSON())).catch(() => []) : Promise.resolve([]),
        ]);

        const combinedTasks = mergeTaskRows(
          instant,
          cachedTasksRes?.rows || (Array.isArray(cachedTasksRes) ? cachedTasksRes : []),
          guestTasksRes?.rows || (Array.isArray(guestTasksRes) ? guestTasksRes : []),
          Array.isArray(goalsListCache) ? goalsListCache : [],
          Array.isArray(rxTasks) ? rxTasks : [],
        );

        if (combinedTasks.length > 0 || cachedCalsRes) {
            console.log('[TaskContext] Cold-start hydration from local copy:', combinedTasks.length, 'goals');
            dispatchSyncedData({
              tasks: combinedTasks,
              projects: (cachedCalsRes?.rows || []).map(mapAppwriteCalendarToProject)});
        }

        dispatch({ type: 'SET_LOADING', payload: false });

        if (userId === 'guest') {
            return;
        }

        // 2. Background Refresh — network errors are silent so local copy remains SoT
        try {
          const data = await fetchBatch(userId);
          dispatchSyncedData(data);
          await refreshEcosystemTags();
        } catch (netErr) {
          console.warn('[TaskContext] Background network sync failed, local copy remains SoT:', netErr);
        } finally {
          dispatch({ type: 'SET_LOADING', payload: false });
        }
      } catch (err: any) {
          console.warn('[TaskContext] Init fallback:', err);
          dispatch({ type: 'SET_LOADING', payload: false });
      }
}
