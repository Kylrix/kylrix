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

export function dispatchSyncedData(bag: any) {
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

    const mergedTasks = data.tasks;

    // 1:1 with notes live guards: prefer in-memory live copy when engine still owes a flush
    // or local updatedAt is newer; keep local-only ids missing from this page.
    const liveById = new Map(tasksRef.current.map((t) => [t.id, t]));
    const byId = new Map<string, Task>();

    for (const row of mergedTasks) {
      const live = liveById.get(row.id);
      if (
        live &&
        (autonomicSyncEngine.isPending(goalPendingKey(row.id)) ||
          (live.updatedAt instanceof Date &&
            row.updatedAt instanceof Date &&
            live.updatedAt.getTime() > row.updatedAt.getTime()))
      ) {
        byId.set(row.id, live);
      } else {
        byId.set(row.id, row);
      }
    }

    for (const live of tasksRef.current) {
      if (!byId.has(live.id)) byId.set(live.id, live);
    }

    const projectsMap = new Map<string, Project>();
    for (const proj of (data.projects || [])) {
      if (proj?.id) projectsMap.set(proj.id, proj);
    }

    const nextTasks = applyPendingPatches(Array.from(byId.values()));

    dispatch({
      type: 'SET_DATA',
      payload: {
        tasks: nextTasks,
        projects: Array.from(projectsMap.values())},
    });

    void persistGoalsLocalCopy(state.userId || flowWarmOwnerRef.current, nextTasks);
}
