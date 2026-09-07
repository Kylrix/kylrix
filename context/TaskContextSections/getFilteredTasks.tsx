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

export function getFilteredTasks(bag: any) {
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

    let sourceTasks = state.tasks.filter((t: any) => !t.isTrash && !t.isDeleted && String(t.isTrash) !== 'true' && String(t.isDeleted) !== 'true');
    if (!activeWorkspace || activeWorkspace.isPersonal) {
      sourceTasks = sourceTasks.filter(isDefaultWorkspaceObject);
    } else {
      // Real workspace: filter by project_objects join table (same as notes/vault pattern)
      const registeredIds = goalProjectObjectIdsRef.current;
      const pid = activeWorkspace.id;
      sourceTasks = sourceTasks.filter(
        (t) => registeredIds.has(t.id) || t.projectId === pid
      );
    }
    if (!activeWorkspace || activeWorkspace.isPersonal) {
      if (state.userId && state.userId !== 'guest') {
        const activeId = state.userId;
        sourceTasks = sourceTasks.filter((t) =>
          !t.userId || t.userId === 'guest' || t.userId === activeId ||
          !t.creatorId || t.creatorId === 'guest' || t.creatorId === activeId ||
          (Boolean(activeId) && Array.isArray(t.assigneeIds) && t.assigneeIds.includes(activeId!))
        );
      } else {
        sourceTasks = sourceTasks.filter((t) =>
          !t.userId || t.userId === 'guest' || !t.creatorId || t.creatorId === 'guest'
        );
      }
    }
    let filtered = buildTaskHierarchy(sourceTasks);

    // Apply filters
    if (state.filter.status?.length) {
      filtered = filtered.filter(t => state.filter.status!.includes(t.status));
    }
    if (state.filter.priority?.length) {
      filtered = filtered.filter(t => state.filter.priority!.includes(t.priority));
    }
    if (state.filter.projectId !== undefined) {
      filtered = filtered.filter(t => t.projectId === state.filter.projectId);
    }
    if (state.filter.labels?.length) {
      filtered = filtered.filter(t => t.labels.some(l => state.filter.labels!.includes(l)));
    }
    if (!state.filter.showCompleted) {
      filtered = filtered.filter(t => t.status !== 'done');
    }
    if (!state.filter.showArchived) {
      filtered = filtered.filter(t => !t.isArchived);
    }
    if (state.searchQuery) {
      const query = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        t =>
          t.title.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const { field, direction } = state.sort;
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (field) {
        case 'dueDate':
          const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          comparison = aDate - bDate;
          break;
        case 'priority':
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'createdAt':
          const aCreated = new Date((a as any).$createdAt || a.createdAt || (a as any).$updatedAt || a.updatedAt || 0).getTime();
          const bCreated = new Date((b as any).$createdAt || b.createdAt || (b as any).$updatedAt || b.updatedAt || 0).getTime();
          comparison = aCreated - bCreated;
          break;
        case 'updatedAt':
          const aUpdated = new Date((a as any).$updatedAt || a.updatedAt || (a as any).$createdAt || a.createdAt || 0).getTime();
          const bUpdated = new Date((b as any).$updatedAt || b.updatedAt || (b as any).$createdAt || b.createdAt || 0).getTime();
          comparison = aUpdated - bUpdated;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          const statusOrder = { todo: 0, 'in-progress': 1, blocked: 2, done: 3, cancelled: 4 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'position':
          comparison = a.position - b.position;
          break;
      }

      return direction === 'asc' ? comparison : -comparison;
    });

    return filtered;
}
