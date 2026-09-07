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

export function coerceCachedTask(bag: any) {
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

  if (!row || typeof row !== 'object') return null;
  const id = String(row.$id || row.id || '').trim();
  if (!id) return null;

  // Already a live Task shape (cache / pushLiveGoal) — do NOT re-run Appwrite mapper
  // (that expects tags[] and would wipe projectId/labels).
  if (row.id && !row.$id) {
    return {
      ...row,
      id,
      title: String(row.title || ''),
      description: String(row.description || ''),
      status: (row.status as TaskStatus) || 'todo',
      priority: (row.priority as Priority) || 'medium',
      projectId: row.projectId || 'inbox',
      labels: Array.isArray(row.labels) ? row.labels : [],
      linkedNotes: Array.isArray(row.linkedNotes) ? row.linkedNotes : [],
      subtasks: Array.isArray(row.subtasks) ? row.subtasks : [],
      comments: Array.isArray(row.comments) ? row.comments : [],
      attachments: Array.isArray(row.attachments) ? row.attachments : [],
      reminders: Array.isArray(row.reminders) ? row.reminders : [],
      timeEntries: Array.isArray(row.timeEntries) ? row.timeEntries : [],
      assigneeIds: Array.isArray(row.assigneeIds) ? row.assigneeIds : [],
      creatorId: row.creatorId || row.userId || 'guest',
      userId: row.userId || row.creatorId || 'guest',
      parentTaskId: row.parentTaskId || row.parentId || null,
      dueDate: row.dueDate ? new Date(row.dueDate) : undefined,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
      completedAt: row.completedAt ? new Date(row.completedAt) : undefined,
      position: typeof row.position === 'number' ? row.position : 0,
      isArchived: row.isArchived === true || String(row.isArchived) === 'true',
      isPinned: row.isPinned === true || String(row.isPinned) === 'true',
      isPublic: row.isPublic === true || String(row.isPublic) === 'true',
      isGuest: row.isGuest === true || String(row.isGuest) === 'true',
      discussionId: row.discussionId || null,
      scheduled: row.scheduled === true || String(row.scheduled) === 'true',
      isAgentic: row.isAgentic === true || String(row.isAgentic) === 'true',
      isWorkspace: row.isWorkspace === true || String(row.isWorkspace) === 'true' || (Boolean(row.projectId) && row.projectId !== 'inbox'),
      dek: row.dek || null,
    } as Task;
  }

  return mapAppwriteTaskToTask({ ...row, $id: id } as AppwriteTask);
}
