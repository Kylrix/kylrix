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

export function addTask(bag: any) {
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

      try {
        const userId = state.userId || 'guest';
        const id = ID.unique();
        const inCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
        const mappedTask: Task = {
          id,
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          projectId: inCustomWorkspace ? activeWorkspace!.id : (task.projectId || 'inbox'),
          labels: task.labels || [],
          linkedNotes: task.linkedNotes || [],
          subtasks: [],
          comments: [],
          attachments: [],
          reminders: [],
          timeEntries: [],
          assigneeIds: task.assigneeIds || (userId !== 'guest' ? [userId] : []),
          creatorId: userId,
          userId,
          parentTaskId: task.parentTaskId || null,
          dueDate: task.dueDate,
          createdAt: new Date(),
          updatedAt: new Date(),
          position: 0,
          isArchived: false,
          isPinned: false,
          isPublic: false,
          isGuest: false,
          isAgentic: task.isAgentic === true,
          isWorkspace: inCustomWorkspace,
        };

        pushLiveGoal(mappedTask);
        if (inCustomWorkspace && typeof attachEntityToActiveWorkspace === 'function') {
          void attachEntityToActiveWorkspace('goal', id);
        }
        autonomicSyncEngine.nudge();
        return mappedTask;
      } catch (error: unknown) {
        console.error('Failed to create task', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to create task' });
        return null;
      }
}
