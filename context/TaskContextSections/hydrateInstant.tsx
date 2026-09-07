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

export function hydrateInstant(bag: any) {
  const {
  addComment,
  addLabel,
  addProject,
  addSubtask,
  addTask,
  addTaskCollaborator,
  applyPendingPatches,
  buildTaskHierarchy,
  byId,
  clearStalePendingPatches,
  cloned,
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
  hydrateInstant,
  invalidateCalendarsNexus,
  invalidateTasksNexus,
  isCustomWorkspace,
  isFetchingTasksRef,
  lastPathnameRef,
  lastTaskPullAtRef,
  listTaskCollaborators,
  mapAppwriteCalendarToProject,
  maybeSoftPull,
  mergeTaskRows,
  notifyTaskAssignment,
  parseCommentEntry,
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
  taskMap,
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

      const userId =
        authUser?.$id ||
        flowWarmOwnerRef.current ||
        getCurrentUserSnapshot()?.$id ||
        'guest';
      if (userId !== 'guest') flowWarmOwnerRef.current = userId;
      const instant = await loadGoalsFromLocalCopy({
        userId,
        existingTasks: tasksRef.current,
        getCachedDataSync: (key) => getCachedData(key),
        getCachedDataAsync: (key) => getCachedDataAsync(key)});

      if (cancelled) return;

      if (instant.length > 0) {
        dispatchSyncedData({
          tasks: instant,
          projects: projectsRef.current});
      }
      dispatch({ type: 'SET_LOADING', payload: false });
}
