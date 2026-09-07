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

export function initRealtime(bag: any) {
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

      // Subscribe to Tasks
      unsubTasks = await subscribeToTable<AppwriteTask>(APPWRITE_CONFIG.TABLES.TASKS, ({ type, payload }) => {
        const isBelonging = Boolean(state.userId && (payload.userId === state.userId || (Array.isArray(payload.assigneeIds) && payload.assigneeIds.includes(state.userId))));
        if (!isBelonging) return;

        // Mirror notes live-edit guards: never clobber a goal the engine still owes a flush for.
        if (autonomicSyncEngine.isPending(goalPendingKey(payload.$id))) {
          return;
        }

        if (type === 'create') {
          if ((payload as any).isTrash === true) {
            dispatch({ type: 'DELETE_TASK', payload: payload.$id });
            return;
          }
          dispatch({ type: 'ADD_TASK', payload: mapAppwriteTaskToTask(payload) });
        } else if (type === 'update') {
          if ((payload as any).isTrash === true) {
            dispatch({ type: 'DELETE_TASK', payload: payload.$id });
            invalidateTasksNexus(state.userId || 'guest');
            return;
          }
          const mapped = mapAppwriteTaskToTask(payload);
          if (shouldIgnoreRealtimeStatus(payload.$id, mapped.status)) return;
          dispatch({ type: 'UPDATE_TASK', payload: { id: payload.$id, updates: mapped } });
        } else if (type === 'delete') {
          dispatch({ type: 'DELETE_TASK', payload: payload.$id });
          invalidateTasksNexus(state.userId || 'guest');
        }
      });

      // Subscribe to Calendars/Projects
      unsubProjects = await subscribeToTable<AppwriteCalendar>(APPWRITE_CONFIG.TABLES.CALENDARS, ({ type, payload }) => {
        if (payload.userId !== state.userId) return;

        if (type === 'create') {
          dispatch({ type: 'ADD_PROJECT', payload: mapAppwriteCalendarToProject(payload) });
        } else if (type === 'update') {
          dispatch({ type: 'UPDATE_PROJECT', payload: { id: payload.$id, updates: mapAppwriteCalendarToProject(payload) } });
        } else if (type === 'delete') {
          dispatch({ type: 'DELETE_PROJECT', payload: payload.$id });
        }
      });
}
