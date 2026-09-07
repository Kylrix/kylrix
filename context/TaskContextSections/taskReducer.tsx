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

export function taskReducer(bag: any) {
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

  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_DATA':
      {
        const uniqueTasks = Array.from(
          new Map(action.payload.tasks.map((task) => [task.id, task])).values()
        );
        const uniqueProjects = Array.from(
          new Map(action.payload.projects.map((project) => [project.id, project])).values()
        );
        return {
          ...state,
          tasks: uniqueTasks,
          projects: uniqueProjects,
          isLoading: false};
      }

    case 'SET_USER':
      if (state.userId && state.userId !== 'guest' && action.payload !== 'guest' && state.userId !== action.payload) {
        return { ...state, userId: action.payload, tasks: [], projects: [], selectedTaskId: null, selectedProjectId: null };
      }
      return { ...state, userId: action.payload };

    case 'ADD_TASK':
      if (state.tasks.some((task) => task.id === action.payload.id)) {
        return state;
      }
      return { ...state, tasks: [action.payload, ...state.tasks] };

    case 'UPSERT_TASK':
      {
        const next = action.payload;
        const exists = state.tasks.some((task) => task.id === next.id);
        if (exists) {
          return {
            ...state,
            tasks: state.tasks.map((task) => (task.id === next.id ? { ...task, ...next, updatedAt: next.updatedAt || new Date() } : task)),
          };
        }
        return { ...state, tasks: [next, ...state.tasks] };
      }

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? {
                ...task,
                ...action.payload.updates,
                // Prefer caller-provided updatedAt (pushLiveGoal / server). Forcing `new Date()`
                // here poisoned goal sync: realtime echoes re-queued forever after a successful flush.
                updatedAt: action.payload.updates.updatedAt || task.updatedAt || new Date()}
            : task
        ),
      };

    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
        selectedTaskId: state.selectedTaskId === action.payload ? null : state.selectedTaskId};

    case 'COMPLETE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? {
                ...task,
                status: task.status === 'done' ? 'todo' : 'done',
                completedAt: task.status === 'done' ? undefined : new Date(),
                updatedAt: new Date()}
            : task
        ),
      };

    case 'SELECT_TASK':
      return { ...state, selectedTaskId: action.payload };

    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.payload] };

    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === action.payload.id
            ? { ...project, ...action.payload.updates, updatedAt: new Date() }
            : project
        ),
      };

    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(project => project.id !== action.payload),
        tasks: state.tasks.map(task =>
          task.projectId === action.payload ? { ...task, projectId: 'inbox' } : task
        ),
        selectedProjectId: state.selectedProjectId === action.payload ? null : state.selectedProjectId,
      };

    case 'SELECT_PROJECT':
      return { ...state, selectedProjectId: action.payload };

    case 'ADD_LABEL':
      return { ...state, labels: [...state.labels, action.payload] };

    case 'UPDATE_LABEL':
      return {
        ...state,
        labels: state.labels.map(label =>
          label.id === action.payload.id ? { ...label, ...action.payload.updates } : label
        ),
      };

    case 'DELETE_LABEL':
      return {
        ...state,
        labels: state.labels.filter(label => label.id !== action.payload),
        tasks: state.tasks.map(task => ({
          ...task,
          labels: task.labels.filter(l => l !== action.payload)})),
      };

    case 'SET_FILTER':
      return { ...state, filter: action.payload };

    case 'SET_SORT':
      return { ...state, sort: action.payload };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };

    case 'SET_SIDEBAR_OPEN':
      return { ...state, sidebarOpen: action.payload };

    case 'SET_TASK_DIALOG_OPEN':
      return { ...state, taskDialogOpen: action.payload };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };

    case 'ADD_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.taskId
            ? { ...task, subtasks: [...task.subtasks, action.payload.subtask], updatedAt: new Date() }
            : task
        ),
      };

    case 'UPDATE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.taskId
            ? {
                ...task,
                subtasks: task.subtasks.map(st =>
                  st.id === action.payload.subtaskId ? { ...st, ...action.payload.updates } : st
                ),
                updatedAt: new Date(),
              }
            : task
        ),
      };

    case 'DELETE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.taskId
            ? {
                ...task,
                subtasks: task.subtasks.filter(st => st.id !== action.payload.subtaskId),
                updatedAt: new Date()}
            : task
        ),
      };

    case 'TOGGLE_SUBTASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.taskId
            ? {
                ...task,
                subtasks: task.subtasks.map(st =>
                  st.id === action.payload.subtaskId
                    ? { ...st, completed: !st.completed, completedAt: !st.completed ? new Date() : undefined }
                    : st
                ),
                updatedAt: new Date(),
              }
            : task
        ),
      };

    case 'ADD_COMMENT':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.taskId
            ? { ...task, comments: [...task.comments, action.payload.comment], updatedAt: new Date() }
            : task
        ),
      };

    case 'REORDER_TASKS':
      return {
        ...state,
        tasks: state.tasks.map(task => {
          const newPosition = action.payload.taskIds.indexOf(task.id);
          if (newPosition !== -1) {
            return { ...task, position: newPosition };
          }
          return task;
        }),
      };

    case 'TOGGLE_PIN_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? { ...task, isPinned: !task.isPinned, updatedAt: new Date() }
            : task
        ),
      };

    case 'TOGGLE_PIN_PROJECT':
      return {
        ...state,
        projects: state.projects.map(project =>
          project.id === action.payload
            ? { ...project, isPinned: !project.isPinned, updatedAt: new Date() }
            : project
        ),
      };

    case 'SET_ECOSYSTEM_TAGS':
      return {
        ...state,
        ecosystemTags: action.payload,
        labels: mapEcosystemTagsToLabels(action.payload)};

    default:
      return state;
  }
}
