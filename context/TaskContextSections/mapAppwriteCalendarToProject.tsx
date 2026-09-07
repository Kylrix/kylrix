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

export function mapAppwriteCalendarToProject(bag: any) {
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
return (({
  id: doc.$id || (doc as any).id,
  name: doc.name,
  color: doc.color,
  description: '',
  icon: 'list',
  ownerId: doc.userId,
  memberIds: [],
  isArchived: false,
  isFavorite: doc.isDefault,
  isPinned: (doc as any).isPinned === true || String((doc as any).isPinned) === 'true',
  defaultView: 'list',
  createdAt: doc.$createdAt ? new Date(doc.$createdAt) : (doc as any).createdAt ? new Date((doc as any).createdAt) : new Date(),
  updatedAt: doc.$updatedAt ? new Date(doc.$updatedAt) : (doc as any).updatedAt ? new Date((doc as any).updatedAt) : new Date(),
  position: 0,
  settings: {
    defaultPriority: 'medium',
    allowSubtasks: true,
    allowTimeTracking: true,
    allowRecurrence: true,
    showCompletedTasks: true},
}));
}
