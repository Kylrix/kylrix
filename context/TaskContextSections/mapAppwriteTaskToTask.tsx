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

export function mapAppwriteTaskToTask(bag: any) {
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

  const raw = doc as any;
  // Extract project ID from tags if present (format: "project:ID")
  const projectTag = raw.tags?.find((t: string) => t.startsWith('project:'));
  const projectId = projectTag ? projectTag.split(':')[1] : 'inbox';
  const userLabels = raw.tags?.filter((t: string) => !t.startsWith('project:') && !t.startsWith('source:')) || [];
  const linkedNotes = parseSourceNoteIdsFromTags(raw.tags || []);
  const comments = Array.isArray(raw.comments)
    ? raw.comments.map((entry: any) => parseCommentEntry(entry))
    : [];

  return {
    id: doc.$id || raw.id,
    title: doc.title,
    description: doc.description,
    status: (doc.status as TaskStatus) || 'todo',
    priority: (doc.priority as Priority) || 'medium',
    projectId: projectId,
    labels: userLabels,
    linkedNotes: linkedNotes,
    subtasks: [],
    comments,
    attachments: [],
    reminders: [],
    timeEntries: [],
    assigneeIds: raw.assigneeIds || [],
    creatorId: raw.userId,
    userId: raw.userId || 'guest',
    parentTaskId: raw.parentId || null,
    dueDate: raw.dueDate ? new Date(raw.dueDate) : undefined,
    createdAt: doc.$createdAt ? new Date(doc.$createdAt) : raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: doc.$updatedAt ? new Date(doc.$updatedAt) : raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
    position: 0,
    isArchived: raw.isArchived === true || String(raw.isArchived) === 'true',
    isPinned: raw.isPinned === true || String(raw.isPinned) === 'true',
    isPublic: raw.isPublic === true || String(raw.isPublic) === 'true',
    isGuest: raw.isGuest === true || String(raw.isGuest) === 'true',
    discussionId: raw.discussionId || null,
    scheduled: raw.scheduled === true || String(raw.scheduled) === 'true',
    isAgentic: raw.isAgentic === true || String(raw.isAgentic) === 'true',
    isWorkspace: raw.isWorkspace === true || String(raw.isWorkspace) === 'true' || (Boolean(projectId) && projectId !== 'inbox'),
    dek: raw.dek || null,
  };
}
