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

export function updateTask(bag: any) {
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

    const currentTask = state.tasks.find(t => t.id === id);

    dispatch({ type: 'UPDATE_TASK', payload: { id, updates } });

    if (updates.status !== undefined) {
      registerPendingStatus(
        id,
        updates.status,
        updates.completedAt ?? (updates.status === 'done' ? new Date() : undefined),
      );
    }

    const mergedTask: Task = {
      ...(currentTask || {
        id,
        title: updates.title || '',
        description: updates.description || '',
        status: updates.status || 'todo',
        priority: updates.priority || 'medium',
        projectId: updates.projectId || 'inbox',
        labels: updates.labels || [],
        subtasks: updates.subtasks || [],
        comments: updates.comments || [],
        attachments: [],
        reminders: [],
        timeEntries: [],
        assigneeIds: updates.assigneeIds || [],
        creatorId: state.userId || 'guest',
        userId: state.userId || 'guest',
        parentTaskId: updates.parentTaskId || null,
        dueDate: updates.dueDate,
        createdAt: new Date(),
        updatedAt: new Date(),
        position: 0,
        isArchived: false,
        isPinned: false,
        isPublic: false,
        isGuest: false,
      }),
      ...updates,
      id,
      updatedAt: new Date(),
    };

    pushLiveGoal(mergedTask);
}
