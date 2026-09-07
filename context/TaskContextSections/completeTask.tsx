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

export function completeTask(bag: any) {
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

    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    const completedAt = newStatus === 'done' ? new Date() : undefined;

    registerPendingStatus(id, newStatus, completedAt);
    const updatedTask: Task = {
      ...task,
      status: newStatus,
      completedAt,
      updatedAt: new Date(),
    };
    pushLiveGoal(updatedTask);

    if (newStatus === 'done') {
      const collectDescendants = (taskId: string): string[] => {
        const directChildren = state.tasks.filter(t => t.parentTaskId === taskId).map(t => t.id);
        const descendantIds: string[] = [];
        directChildren.forEach((childId) => {
          descendantIds.push(childId, ...collectDescendants(childId));
        });
        return descendantIds;
      };
      const descendantIds = collectDescendants(id);
      for (const childId of descendantIds) {
        const childTask = state.tasks.find(t => t.id === childId);
        if (childTask && childTask.status !== 'done') {
          pushLiveGoal({
            ...childTask,
            status: 'done',
            completedAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
}
