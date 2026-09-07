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
  Task,
  Project,
  Label,
  TaskFilter,
  TaskSort,
  TaskStatus,
  Priority,
  ViewMode,
  Subtask,
  Comment,
  TaskCollaborator,
  CollaboratorPermission} from '@/types';
import { isFlowPath, isWorkspacesPath, isGoalsSurfacePath } from '@/lib/routing/app-paths';
import { registerLiveGoalGetter } from '@/lib/sync/pending-sync-bridge';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import { shouldSoftPull } from '@/lib/sync/local-copy-sync';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { loadGoalsFromLocalCopy } from '@/lib/goals/load-local-goals';
import { subscribeLocalSoftRefresh } from '@/lib/sync/local-soft-refresh';
import { useWorkspace } from '@/context/WorkspaceContext';
import { isDefaultWorkspaceObject } from '@/lib/workspaces/is-default-workspace-object';
import { useProjectObjects } from '@/hooks/useProjectObjects';
import { taskReducer as taskReducer_ext } from './TaskContextSections/taskReducer';
import { init as init_ext } from './TaskContextSections/init';
import { syncTaskAccess as syncTaskAccess_ext } from './TaskContextSections/syncTaskAccess';
import { coerceCachedTask as coerceCachedTask_ext } from './TaskContextSections/coerceCachedTask';
import { initRealtime as initRealtime_ext } from './TaskContextSections/initRealtime';
import { mapAppwriteTaskToTask as mapAppwriteTaskToTask_ext } from './TaskContextSections/mapAppwriteTaskToTask';
import { persistGoalsLocalCopy as persistGoalsLocalCopy_ext } from './TaskContextSections/persistGoalsLocalCopy';
import { parseCommentEntry as parseCommentEntry_ext } from './TaskContextSections/parseCommentEntry';
import { buildTaskHierarchy as buildTaskHierarchy_ext } from './TaskContextSections/buildTaskHierarchy';
import { mapAppwriteCalendarToProject as mapAppwriteCalendarToProject_ext } from './TaskContextSections/mapAppwriteCalendarToProject';
import { hydrateInstant as hydrateInstant_ext } from './TaskContextSections/hydrateInstant';
import { maybeSoftPull as maybeSoftPull_ext } from './TaskContextSections/maybeSoftPull';
import { notifyTaskAssignment as notifyTaskAssignment_ext } from './TaskContextSections/notifyTaskAssignment';
import { mergeTaskRows as mergeTaskRows_ext } from './TaskContextSections/mergeTaskRows';
import { getFilteredTasks as getFilteredTasks_ext } from './TaskContextSections/getFilteredTasks';
import { value as value_ext } from './TaskContextSections/value';
import { addTask as addTask_ext } from './TaskContextSections/addTask';
import { updateTask as updateTask_ext } from './TaskContextSections/updateTask';
import { deleteTask as deleteTask_ext } from './TaskContextSections/deleteTask';
import { dispatchSyncedData as dispatchSyncedData_ext } from './TaskContextSections/dispatchSyncedData';
import { completeTask as completeTask_ext } from './TaskContextSections/completeTask';
const coerceCachedTask = (..._args: any[]) => coerceCachedTask_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, byId, clearStalePendingPatches, cloned, coerceCachedTask, collaboratorIds, collaboratorRows, comments, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, id, init, initRealtime, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, linkedNotes, list, listTaskCollaborators, mapAppwriteTaskToTask, newlyAddedAssignees, normalizedAssigneeIds, pathname, pendingStatusPatchesRef, permissions, persistGoalsLocalCopy, projectId, projectTag, projectsRef, pushLiveGoal, pushLiveTag, raw, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, syncTaskAccess, taskMap, taskReducer, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, userLabels, value });
const mergeTaskRows = (..._args: any[]) => mergeTaskRows_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, buildTaskHierarchy, byId, clearStalePendingPatches, cloned, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, hydrateInstant, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, mapAppwriteCalendarToProject, maybeSoftPull, mergeTaskRows, notifyTaskAssignment, parseCommentEntry, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, taskMap, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value });
const persistGoalsLocalCopy = (..._args: any[]) => persistGoalsLocalCopy_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, byId, clearStalePendingPatches, cloned, coerceCachedTask, collaboratorIds, collaboratorRows, comments, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, id, init, initRealtime, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, linkedNotes, list, listTaskCollaborators, mapAppwriteTaskToTask, newlyAddedAssignees, normalizedAssigneeIds, pathname, pendingStatusPatchesRef, permissions, persistGoalsLocalCopy, projectId, projectTag, projectsRef, pushLiveGoal, pushLiveTag, raw, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, syncTaskAccess, taskMap, taskReducer, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, userLabels, value });
export const mapAppwriteTaskToTask = (..._args: any[]) => mapAppwriteTaskToTask_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, byId, clearStalePendingPatches, cloned, coerceCachedTask, collaboratorIds, collaboratorRows, comments, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, id, init, initRealtime, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, linkedNotes, list, listTaskCollaborators, mapAppwriteTaskToTask, newlyAddedAssignees, normalizedAssigneeIds, pathname, pendingStatusPatchesRef, permissions, persistGoalsLocalCopy, projectId, projectTag, projectsRef, pushLiveGoal, pushLiveTag, raw, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, syncTaskAccess, taskMap, taskReducer, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, userLabels, value });
const notifyTaskAssignment = (..._args: any[]) => notifyTaskAssignment_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, buildTaskHierarchy, byId, clearStalePendingPatches, cloned, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, hydrateInstant, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, mapAppwriteCalendarToProject, maybeSoftPull, mergeTaskRows, notifyTaskAssignment, parseCommentEntry, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, taskMap, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value });
const parseCommentEntry = (..._args: any[]) => parseCommentEntry_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, buildTaskHierarchy, byId, clearStalePendingPatches, cloned, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, hydrateInstant, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, mapAppwriteCalendarToProject, maybeSoftPull, mergeTaskRows, notifyTaskAssignment, parseCommentEntry, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, taskMap, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value });
const buildTaskHierarchy = (..._args: any[]) => buildTaskHierarchy_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, buildTaskHierarchy, byId, clearStalePendingPatches, cloned, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, hydrateInstant, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, mapAppwriteCalendarToProject, maybeSoftPull, mergeTaskRows, notifyTaskAssignment, parseCommentEntry, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, taskMap, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value });
const mapAppwriteCalendarToProject = (..._args: any[]) => mapAppwriteCalendarToProject_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, buildTaskHierarchy, byId, clearStalePendingPatches, cloned, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, hydrateInstant, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, mapAppwriteCalendarToProject, maybeSoftPull, mergeTaskRows, notifyTaskAssignment, parseCommentEntry, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, taskMap, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value });
const mapEcosystemTagsToLabels = (tags: Tags[]): Label[] =>
  tags
    .filter((tag): tag is Tags & { name: string } => Boolean(tag.name))
    .map((tag) => ({
      id: tag.name,
      name: tag.name,
      color: (tag as Tags & { color?: string }).color || '#9B9691',
      description: (tag as Tags & { description?: string }).description,
    }));
interface TaskState {
  tasks: Task[];
  projects: Project[];
  labels: Label[];
  ecosystemTags: Tags[];
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  filter: TaskFilter;
  sort: TaskSort;
  viewMode: ViewMode;
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  taskDialogOpen: boolean;
  searchQuery: string;
  userId: string | null;
}
const initialState: TaskState = {
  tasks: [],
  projects: [],
  labels: [],
  ecosystemTags: [],
  selectedTaskId: null,
  selectedProjectId: null,
  filter: {
    showCompleted: true,
    showArchived: false},
  sort: {
    field: 'updatedAt',
    direction: 'desc'},
  viewMode: 'list',
  isLoading: false,
  error: null,
  sidebarOpen: true,
  taskDialogOpen: false,
  searchQuery: '',
  userId: null,
};
type TaskAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_DATA'; payload: { tasks: Task[]; projects: Project[] } }
  | { type: 'SET_USER'; payload: string }
  | { type: 'ADD_TASK'; payload: Task }
  | { type: 'UPSERT_TASK'; payload: Task }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<Task> } }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'COMPLETE_TASK'; payload: string }
  | { type: 'SELECT_TASK'; payload: string | null }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: { id: string; updates: Partial<Project> } }
  | { type: 'DELETE_PROJECT'; payload: string }
  | { type: 'SELECT_PROJECT'; payload: string | null }
  | { type: 'ADD_LABEL'; payload: Label }
  | { type: 'UPDATE_LABEL'; payload: { id: string; updates: Partial<Label> } }
  | { type: 'DELETE_LABEL'; payload: string }
  | { type: 'SET_FILTER'; payload: TaskFilter }
  | { type: 'SET_SORT'; payload: TaskSort }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR_OPEN'; payload: boolean }
  | { type: 'SET_TASK_DIALOG_OPEN'; payload: boolean }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'ADD_SUBTASK'; payload: { taskId: string; subtask: Subtask } }
  | { type: 'UPDATE_SUBTASK'; payload: { taskId: string; subtaskId: string; updates: Partial<Subtask> } }
  | { type: 'DELETE_SUBTASK'; payload: { taskId: string; subtaskId: string } }
  | { type: 'TOGGLE_SUBTASK'; payload: { taskId: string; subtaskId: string } }
  | { type: 'ADD_COMMENT'; payload: { taskId: string; comment: Comment } }
  | { type: 'REORDER_TASKS'; payload: { taskIds: string[]; projectId?: string } }
  | { type: 'TOGGLE_PIN_TASK'; payload: string }
  | { type: 'TOGGLE_PIN_PROJECT'; payload: string }
  | { type: 'SET_ECOSYSTEM_TAGS'; payload: Tags[] };
const taskReducer = (..._args: any[]) => taskReducer_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, byId, clearStalePendingPatches, cloned, coerceCachedTask, collaboratorIds, collaboratorRows, comments, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, id, init, initRealtime, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, linkedNotes, list, listTaskCollaborators, mapAppwriteTaskToTask, newlyAddedAssignees, normalizedAssigneeIds, pathname, pendingStatusPatchesRef, permissions, persistGoalsLocalCopy, projectId, projectTag, projectsRef, pushLiveGoal, pushLiveTag, raw, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, syncTaskAccess, taskMap, taskReducer, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, userLabels, value });
interface TaskContextType extends TaskState {
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => Promise<Task | null>;
  /** Live-copy upsert. Default enqueues engine flush (amber). `pending: false` after remote confirm. */
  pushLiveGoal: (task: Task, options?: { pending?: boolean }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  selectTask: (id: string | null) => void;
  togglePinTask: (id: string) => Promise<void>;
  toggleTaskReminder: (id: string, enabled: boolean) => Promise<void>;
  addSubtask: (taskId: string, title: string, description?: string) => void;
  updateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addComment: (taskId: string, content: string) => void;
  listTaskCollaborators: (taskId: string) => Promise<TaskCollaborator[]>;
  addTaskCollaborator: (taskId: string, userId: string, permission: CollaboratorPermission) => Promise<TaskCollaborator | null>;
  updateTaskCollaborator: (taskId: string, collaboratorId: string, permission: CollaboratorPermission) => Promise<TaskCollaborator | null>;
  deleteTaskCollaborator: (taskId: string, collaboratorId: string) => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;
  togglePinProject: (id: string) => Promise<void>;
  addLabel: (label: Omit<Label, 'id'>) => void;
  updateLabel: (id: string, updates: Partial<Label>) => void;
  deleteLabel: (id: string) => void;
  setFilter: (filter: TaskFilter) => void;
  setSort: (sort: TaskSort) => void;
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTaskDialogOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  getFilteredTasks: () => Task[];
  getTasksByProject: (projectId: string) => Task[];
  getTaskStats: () => { total: number; completed: number; overdue: number; dueToday: number };
  getSelectedTask: () => Task | null;
  getSelectedProject: () => Project | null;
  ecosystemTags: Tags[];
  pushLiveTag: (tag: Tags) => void;
  refreshEcosystemTags: () => Promise<void>;
  getTagFilterOptions: () => string[];
  refreshTasks: () => Promise<void>;
}
const TaskContext = createContext<TaskContextType | undefined>(undefined);
const PENDING_STATUS_TTL_MS = 15000;
type PendingStatusPatch = {
  status: TaskStatus;
  completedAt?: Date;
  at: number;
};
export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};
const syncTaskAccess = (..._args: any[]) => syncTaskAccess_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, byId, clearStalePendingPatches, cloned, coerceCachedTask, collaboratorIds, collaboratorRows, comments, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, id, init, initRealtime, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, linkedNotes, list, listTaskCollaborators, mapAppwriteTaskToTask, newlyAddedAssignees, normalizedAssigneeIds, pathname, pendingStatusPatchesRef, permissions, persistGoalsLocalCopy, projectId, projectTag, projectsRef, pushLiveGoal, pushLiveTag, raw, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, syncTaskAccess, taskMap, taskReducer, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, userLabels, value });
export function TaskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, initialState);
  const threadTasksRef = useRef<Task[]>([]);
  const tasksRef = useRef<Task[]>(state.tasks);
  tasksRef.current = state.tasks;
  const projectsRef = useRef<Project[]>(state.projects);
  projectsRef.current = state.projects;
  const { fetchOptimized, invalidate, getCachedData, getCachedDataAsync, setCachedData, refreshInBackground } = useDataNexus();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const { isPinned: isResourcePinned, togglePin, setLocalPin } = useResourcePins();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
  const customWorkspaceId = isCustomWorkspace ? activeWorkspace?.id : null;
  const { rows: goalProjectObjects } = useProjectObjects(customWorkspaceId, 'goal');
  const goalProjectObjectIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    goalProjectObjectIdsRef.current = new Set(
      goalProjectObjects.map((po) => po.entityId).filter(Boolean) as string[]
    );
  }, [goalProjectObjects]);
  const flowWarmOwnerRef = useRef<string | null>(null);
  const pendingStatusPatchesRef = useRef<Map<string, PendingStatusPatch>>(new Map());
  useEffect(() => {
    registerLiveGoalGetter((goalId) => tasksRef.current.find((t) => t.id === goalId) || null);
    if (autonomicSyncEngine.listPendingIds().length > 0) {
      autonomicSyncEngine.flushImmediately();
    }
    return () => registerLiveGoalGetter(null);
  }, []);
  const clearStalePendingPatches = useCallback(() => {
    const now = Date.now();
    for (const [id, patch] of pendingStatusPatchesRef.current.entries()) {
      if (now - patch.at > PENDING_STATUS_TTL_MS) {
        pendingStatusPatchesRef.current.delete(id);
      }
    }
  }, []);
  const registerPendingStatus = useCallback((id: string, status: TaskStatus, completedAt?: Date) => {
    pendingStatusPatchesRef.current.set(id, {
      status,
      completedAt,
      at: Date.now()});
  }, []);
  const applyPendingPatches = useCallback((tasks: Task[]) => {
    clearStalePendingPatches();
    const pending = pendingStatusPatchesRef.current;
    if (pending.size === 0) return tasks;
    return tasks.map((task) => {
      const patch = pending.get(task.id);
      if (!patch) return task;
      if (task.status === patch.status) {
        pending.delete(task.id);
        return task;
      }
      return {
        ...task,
        status: patch.status,
        completedAt: patch.status === 'done' ? (patch.completedAt || task.completedAt || new Date()) : undefined,
        updatedAt: new Date()};
    });
  }, [clearStalePendingPatches]);
  const shouldIgnoreRealtimeStatus = useCallback((taskId: string, incomingStatus: TaskStatus) => {
    clearStalePendingPatches();
    const patch = pendingStatusPatchesRef.current.get(taskId);
    if (!patch) return false;
    if (incomingStatus === patch.status) {
      pendingStatusPatchesRef.current.delete(taskId);
      return false;
    }
    return true;
  }, [clearStalePendingPatches]);
  const pushLiveTag = useCallback((tag: Tags) => {
    if (!tag?.name) return;
    dispatch({
      type: 'SET_ECOSYSTEM_TAGS',
      payload: [tag, ...state.ecosystemTags.filter(t => t.name !== tag.name && t.$id !== tag.$id)]});
    if (typeof window !== 'undefined' && state.userId) {
      const tagsKey = tagsCacheKey(state.userId);
      const updated = [tag, ...state.ecosystemTags.filter(t => t.name !== tag.name && t.$id !== tag.$id)];
      void setCachedData(tagsKey, { rows: updated, total: updated.length });
    }
  }, [state.ecosystemTags, state.userId, setCachedData]);
  const refreshEcosystemTags = useCallback(async () => {
    const uid = state.userId || flowWarmOwnerRef.current || 'guest';
    const tagsKey = tagsCacheKey(uid);
    const COLD_START_TTL = 1000 * 60 * 60 * 24 * 7;
    try {
      const cached = await getCachedDataAsync<any>(tagsKey, COLD_START_TTL);
      if (cached?.rows && Array.isArray(cached.rows) && cached.rows.length > 0) {
        dispatch({ type: 'SET_ECOSYSTEM_TAGS', payload: cached.rows });
      }
    } catch {}
    try {
      const { rows } = await getAllTags();
      dispatch({ type: 'SET_ECOSYSTEM_TAGS', payload: rows });
      if (uid !== 'guest') {
        void setCachedData(tagsKey, { rows, total: rows.length });
      }
    } catch (error) {
      console.warn('[TaskContext] Remote tags fetch failed, keeping local tags:', error);
    }
  }, [state.userId, getCachedDataAsync, setCachedData]);
  const fetchBatch = useCallback(async (uid: string, force = false) => {
    const FLOW_WARM_TTL = 1000 * 60 * 30;
    const tasksKey = `f_tasks_${uid}`;
    const calsKey = `f_calendars_${uid}`;
    const taskQueries = [
      Query.equal('userId', uid),
      Query.limit(1000),
    ];
    const calQueries = [
      Query.equal('userId', uid),
      Query.limit(100),
    ];
    const [tList, cList] = await Promise.all([
      fetchOptimized(tasksKey, () => taskApi.list(taskQueries), force ? 0 : FLOW_WARM_TTL),
      fetchOptimized(calsKey, () => calendarApi.list(calQueries), force ? 0 : FLOW_WARM_TTL)]);
    return { 
      tasks: (tList?.rows || []).map(mapAppwriteTaskToTask), 
      projects: (cList?.rows || []).map(mapAppwriteCalendarToProject) 
    };
  }, [fetchOptimized]);
  const dispatchSyncedData = useCallback((..._args: any[]) => dispatchSyncedData_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, clearStalePendingPatches, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value }, ..._args), [applyPendingPatches, state.userId]);
  const refreshTasks = useCallback(async () => {
    if (!state.userId || state.userId === 'guest') return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const data = await fetchBatch(state.userId, true);
      dispatchSyncedData(data);
      await refreshEcosystemTags();
    } catch (error) {
      console.error('[TaskContext] Manual refresh failed:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.userId, fetchBatch, dispatchSyncedData, refreshEcosystemTags]);
  const invalidateTasksNexus = useCallback((uid: string) => invalidate(`f_tasks_${uid}`), [invalidate]);
  const invalidateCalendarsNexus = useCallback((uid: string) => invalidate(`f_calendars_${uid}`), [invalidate]);
  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const hydrateInstant = (..._args: any[]) => hydrateInstant_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, buildTaskHierarchy, byId, clearStalePendingPatches, cloned, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, hydrateInstant, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, mapAppwriteCalendarToProject, maybeSoftPull, mergeTaskRows, notifyTaskAssignment, parseCommentEntry, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, taskMap, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value });
    void hydrateInstant();
    const unsubscribe = subscribeLocalSoftRefresh((kind) => {
      if (!kind || kind === 'goal' || kind === 'task') {
        void hydrateInstant();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authUser?.$id, getCachedData, getCachedDataAsync, dispatchSyncedData]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleLogout = () => {
      tasksRef.current = [];
      threadTasksRef.current = [];
      dispatch({ type: 'SET_DATA', payload: { tasks: [], projects: [] } });
      dispatch({ type: 'SET_USER', payload: 'guest' });
    };
    window.addEventListener('kylrix:auth:logout', handleLogout);
    return () => window.removeEventListener('kylrix:auth:logout', handleLogout);
  }, []);
  useEffect(() => {
    if (isAuthLoading) return;
    const init = (..._args: any[]) => init_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, byId, clearStalePendingPatches, cloned, coerceCachedTask, collaboratorIds, collaboratorRows, comments, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, id, init, initRealtime, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, linkedNotes, list, listTaskCollaborators, mapAppwriteTaskToTask, newlyAddedAssignees, normalizedAssigneeIds, pathname, pendingStatusPatchesRef, permissions, persistGoalsLocalCopy, projectId, projectTag, projectsRef, pushLiveGoal, pushLiveTag, raw, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, syncTaskAccess, taskMap, taskReducer, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, userLabels, value });
    init();
  }, [authUser?.$id, isAuthLoading, fetchBatch, getCachedDataAsync, dispatchSyncedData, refreshEcosystemTags]);
  useEffect(() => {
    if (!state.userId || state.userId === 'guest' || isAuthLoading) return;
    if (pathname === lastPathnameRef.current) return;
    const prevPath = lastPathnameRef.current;
    lastPathnameRef.current = pathname;
    if (prevPath && (isFlowPath(pathname) || isGoalsSurfacePath(pathname) || isWorkspacesPath(pathname))) {
      const uid = state.userId;
      refreshInBackground(`f_route_refresh_${uid}`, async () => {
        const data = await fetchBatch(uid, true);
        dispatchSyncedData(data);
        return true;
      }, 10000); // 10s cooldown for route-based refreshes
    }
  }, [pathname, state.userId, isAuthLoading, fetchBatch, refreshInBackground, dispatchSyncedData]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      console.log('[TaskContext] Network connection restored. Refreshing tasks...');
      if (state.userId && state.userId !== 'guest') {
        void refreshTasks();
      }
    };
    const handlethreadClaimed = () => {
      console.log('[TaskContext] thread items claimed. Refreshing tasks...');
      if (state.userId && state.userId !== 'guest') {
        void refreshTasks();
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('kylrix:thread-claimed', handlethreadClaimed);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('kylrix:thread-claimed', handlethreadClaimed);
    };
  }, [state.userId, refreshTasks]);
  const lastTaskPullAtRef = useRef<number>(0);
  const isFetchingTasksRef = useRef<boolean>(false);
  useEffect(() => {
    if (!state.userId || state.userId === 'guest') return;
    const maybeSoftPull = (..._args: any[]) => maybeSoftPull_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, buildTaskHierarchy, byId, clearStalePendingPatches, cloned, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, hydrateInstant, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, mapAppwriteCalendarToProject, maybeSoftPull, mergeTaskRows, notifyTaskAssignment, parseCommentEntry, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, taskMap, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void maybeSoftPull();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [state.userId, fetchBatch, dispatchSyncedData]);
  useEffect(() => {
    if (!state.userId) return;
    let unsubTasks: any;
    let unsubProjects: any;
    const initRealtime = (..._args: any[]) => initRealtime_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, byId, clearStalePendingPatches, cloned, coerceCachedTask, collaboratorIds, collaboratorRows, comments, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, id, init, initRealtime, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, linkedNotes, list, listTaskCollaborators, mapAppwriteTaskToTask, newlyAddedAssignees, normalizedAssigneeIds, pathname, pendingStatusPatchesRef, permissions, persistGoalsLocalCopy, projectId, projectTag, projectsRef, pushLiveGoal, pushLiveTag, raw, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, syncTaskAccess, taskMap, taskReducer, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, userLabels, value });
    initRealtime();
    return () => {
      if (typeof unsubTasks === 'function') unsubTasks();
      else if (unsubTasks?.unsubscribe) unsubTasks.unsubscribe();
      if (typeof unsubProjects === 'function') unsubProjects();
      else if (unsubProjects?.unsubscribe) unsubProjects.unsubscribe();
    };
  }, [state.userId, shouldIgnoreRealtimeStatus]);
  const pushLiveGoal = useCallback(
    (task: Task, options?: { pending?: boolean }) => {
      if (!task?.id) return;
      const ownerId = task.userId || task.creatorId || state.userId || 'guest';
      const stamped: Task = {
        ...task,
        userId: ownerId,
        creatorId: task.creatorId || ownerId,
        updatedAt: new Date()};
      dispatch({ type: 'UPSERT_TASK', payload: stamped });
      void setCachedData(`goal_${stamped.id}`, stamped);
      const updatedList = [stamped, ...tasksRef.current.filter((t) => t.id !== stamped.id)];
      if (state.userId) {
        const tasksKey = `f_tasks_${state.userId}`;
        void setCachedData(tasksKey, { rows: updatedList, total: updatedList.length });
      }
      void persistGoalsLocalCopy(state.userId, updatedList);
      if (options?.pending !== false) {
        autonomicSyncEngine.markPending(goalPendingKey(stamped.id), stamped.updatedAt.toISOString(), stamped);
        autonomicSyncEngine.nudge();
      }
    },
    [setCachedData, state.userId],
  );
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.isPersonal) return;
    const wsId = activeWorkspace.id;
    let cancelled = false;
    void (async () => {
      try {
        const { ProjectsService } = await import('@/lib/appwrite/projects');
        const tagged = await ProjectsService.listTaggedResources(wsId).catch(() => null);
        if (tagged?.tasks && Array.isArray(tagged.tasks) && tagged.tasks.length > 0 && !cancelled) {
          tagged.tasks.forEach((t: any) => {
            const coerced = coerceCachedTask({ ...t, projectId: wsId, isWorkspace: true });
            if (coerced) pushLiveGoal(coerced);
          });
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id, pushLiveGoal]);
  const addTask = useCallback((..._args: any[]) => addTask_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, clearStalePendingPatches, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value }, ..._args), [state.userId, setCachedData, pushLiveGoal, activeWorkspace, attachEntityToActiveWorkspace]);
  const updateTask = useCallback((..._args: any[]) => updateTask_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, clearStalePendingPatches, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value }, ..._args), [state.tasks, state.userId, registerPendingStatus, pushLiveGoal]);
  const togglePinTask = useCallback(async (id: string) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task || !state.userId) return;
    const ownerId = task.creatorId || state.userId;
    const currentlyPinned = isResourcePinned('task', id, ownerId, task.isPinned);
    const isOwner = state.userId === ownerId;
    if (isOwner) {
      dispatch({ type: 'TOGGLE_PIN_TASK', payload: id });
    }
    try {
      await togglePin({
        resourceType: 'task',
        resourceId: id,
        ownerId,
        rowIsPinned: task.isPinned,
        setOwnerRowPin: async (pinned) => {
          await taskApi.update(id, { isPinned: pinned } as any);
        },
      });
      invalidateTasksNexus(state.userId);
    } catch (err) {
      console.error('Failed to toggle task pin', err);
      if (isOwner) {
        dispatch({ type: 'TOGGLE_PIN_TASK', payload: id });
      } else {
        setLocalPin('task', id, currentlyPinned);
      }
    }
  }, [state.tasks, state.userId, isResourcePinned, togglePin, setLocalPin, invalidateTasksNexus]);
  const toggleTaskReminder = useCallback(async (id: string, enabled: boolean) => {
    try {
      const { toggleTaskReminder: toggleAction } = await import('@/lib/actions/client-ops');
      const updatedDoc = await toggleAction(id, enabled);
      if (updatedDoc) {
        dispatch({
          type: 'UPDATE_TASK',
          payload: {
            id,
            updates: {
              scheduled: updatedDoc.scheduled}
          }
        });
        invalidateTasksNexus(state.userId || 'guest');
      }
    } catch (error: any) {
      console.error('Failed to toggle task reminder', error);
      throw error;
    }
  }, [state.userId, invalidateTasksNexus]);
  const togglePinProject = useCallback(async (id: string) => {
    const project = state.projects.find(p => p.id === id);
    if (!project || !state.userId) return;
    const ownerId = project.ownerId || state.userId;
    const currentlyPinned = isResourcePinned('calendar', id, ownerId, project.isPinned);
    const isOwner = state.userId === ownerId;
    if (isOwner) {
      dispatch({ type: 'TOGGLE_PIN_PROJECT', payload: id });
    }
    try {
      await togglePin({
        resourceType: 'calendar',
        resourceId: id,
        ownerId,
        rowIsPinned: project.isPinned,
        setOwnerRowPin: async (pinned) => {
          await calendarApi.update(id, { isPinned: pinned } as any);
        },
      });
      invalidateTasksNexus(state.userId);
    } catch (err) {
      console.error('Failed to toggle project pin', err);
      if (isOwner) {
        dispatch({ type: 'TOGGLE_PIN_PROJECT', payload: id });
      } else {
        setLocalPin('calendar', id, currentlyPinned);
      }
    }
  }, [state.projects, state.userId, isResourcePinned, togglePin, setLocalPin, invalidateTasksNexus]);
  const deleteTask = useCallback((..._args: any[]) => deleteTask_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, clearStalePendingPatches, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value }, ..._args), [state.tasks, state.userId, invalidateTasksNexus]);
  const completeTask = useCallback((..._args: any[]) => completeTask_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, clearStalePendingPatches, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value }, ..._args), [state.tasks, pushLiveGoal, registerPendingStatus]);
  const selectTask = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_TASK', payload: id });
  }, []);
  const addSubtask = useCallback(async (taskId: string, title: string, description: string = '') => {
    const parentTask = state.tasks.find(task => task.id === taskId);
    if (!parentTask) return;
    try {
      const creatorId = state.userId || parentTask.creatorId || 'guest';
      const childTask = await taskApi.create({
        title,
        description,
        status: 'todo',
        priority: parentTask.priority,
        dueDate: parentTask.dueDate ? parentTask.dueDate.toISOString() : null,
        userId: creatorId,
        tags: [
          ...(parentTask.labels || []),
          ...(parentTask.projectId && parentTask.projectId !== 'inbox' ? [`project:${parentTask.projectId}`] : [])],
        assigneeIds: parentTask.assigneeIds || [],
        attachmentIds: [],
        eventId: '',
        parentId: parentTask.id,
        recurrenceRule: '',
      }, buildTaskPermissions(creatorId, parentTask.assigneeIds || []));
      await syncTaskAccess(childTask.$id, creatorId, parentTask.assigneeIds || [], parentTask.title, []);
      invalidateTasksNexus(state.userId || 'guest');
      dispatch({ type: 'ADD_TASK', payload: mapAppwriteTaskToTask(childTask) });
    } catch (error: unknown) {
      console.error('Failed to create subtask', error);
    }
  }, [state.tasks, state.userId, invalidateTasksNexus]);
  const updateSubtask = useCallback(async (_taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
    const payload: Partial<Task> = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.completed !== undefined) {
      payload.status = updates.completed ? 'done' : 'todo';
    }
    await updateTask(subtaskId, payload);
  }, [updateTask]);
  const deleteSubtask = useCallback(async (_taskId: string, subtaskId: string) => {
    await deleteTask(subtaskId);
  }, [deleteTask]);
  const toggleSubtask = useCallback(async (_taskId: string, subtaskId: string) => {
    const task = state.tasks.find(t => t.id === subtaskId);
    if (!task) return;
    await updateTask(subtaskId, { status: task.status === 'done' ? 'todo' : 'done' });
  }, [state.tasks, updateTask]);
  const addComment = useCallback(async (taskId: string, content: string) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const comment: Comment = {
      id: ID.unique(),
      content,
      authorId: state.userId || task.creatorId || 'user',
      authorName: 'You',
      createdAt: new Date()};
    await updateTask(taskId, {
      comments: [...(task.comments || []), comment]});
  }, [state.tasks, state.userId, updateTask]);
  const listTaskCollaborators = useCallback(async (taskId: string) => {
    return await taskCollaborators.list(taskId);
  }, []);
  const addTaskCollaborator = useCallback(async (taskId: string, userId: string, permission: CollaboratorPermission) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return null;
    const created = await taskCollaborators.create(taskId, userId, permission, task.creatorId);
    const nextAssigneeIds = permission === 'read'
      ? (task.assigneeIds || [])
      : (task.assigneeIds || []).filter((id) => id !== userId);
    await syncTaskAccess(taskId, task.creatorId, nextAssigneeIds, task.title, task.assigneeIds || []);
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        id: taskId,
        updates: { assigneeIds: nextAssigneeIds },
      },
    });
    return created;
  }, [state.tasks]);
  const updateTaskCollaborator = useCallback(async (taskId: string, collaboratorId: string, permission: CollaboratorPermission) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return null;
    const collaborator = await taskCollaborators.update(collaboratorId, { permission }, task.creatorId, taskId);
    const nextAssigneeIds = permission === 'read'
      ? (task.assigneeIds || [])
      : (task.assigneeIds || []).filter((id) => id !== collaborator.userId);
    await syncTaskAccess(taskId, task.creatorId, nextAssigneeIds, task.title, task.assigneeIds || []);
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        id: taskId,
        updates: { assigneeIds: nextAssigneeIds },
      },
    });
    return collaborator;
  }, [state.tasks]);
  const deleteTaskCollaborator = useCallback(async (taskId: string, collaboratorId: string) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const collaborator = await taskCollaborators.list(taskId).then((rows) => rows.find((row) => row.id === collaboratorId));
    await taskCollaborators.delete(collaboratorId);
    const nextAssigneeIds = collaborator
      ? (task.assigneeIds || []).filter((id) => id !== collaborator.userId)
      : task.assigneeIds || [];
    await syncTaskAccess(taskId, task.creatorId, nextAssigneeIds, task.title, task.assigneeIds || []);
    dispatch({
      type: 'UPDATE_TASK',
      payload: {
        id: taskId,
        updates: { assigneeIds: nextAssigneeIds },
      },
    });
  }, [state.tasks]);
  const addProject = useCallback(
    async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => {
      try {
        const userId = state.userId || 'guest';
        const newCalendar = await calendarApi.create({
          name: project.name,
          color: project.color,
          isDefault: false,
          userId: userId});
        invalidateCalendarsNexus(userId);
        dispatch({ type: 'ADD_PROJECT', payload: mapAppwriteCalendarToProject(newCalendar) });
      } catch (error: unknown) {
        console.error('Failed to create project', error);
      }
    },
    [state.userId, invalidateCalendarsNexus]
  );
  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      dispatch({ type: 'UPDATE_PROJECT', payload: { id, updates } });
      const apiUpdates: any = {};
      if (updates.name) apiUpdates.name = updates.name;
      if (updates.color) apiUpdates.color = updates.color;
      await calendarApi.update(id, apiUpdates);
      invalidateCalendarsNexus(state.userId || 'guest');
    } catch (error: unknown) {
      console.error('Failed to update project', error);
    }
  }, [state.userId, invalidateCalendarsNexus]);
  const deleteProject = useCallback(async (id: string) => {
    try {
      await calendarApi.delete(id);
      invalidateCalendarsNexus(state.userId || 'guest');
      dispatch({ type: 'DELETE_PROJECT', payload: id });
    } catch (error: unknown) {
      console.error('Failed to delete project', error);
    }
  }, [state.userId, invalidateCalendarsNexus]);
  const selectProject = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_PROJECT', payload: id });
  }, []);
  const addLabel = useCallback((label: Omit<Label, 'id'>) => {
    const newLabel: Label = {
      ...label,
      id: ID.unique()};
    dispatch({ type: 'ADD_LABEL', payload: newLabel });
  }, []);
  const updateLabel = useCallback((id: string, updates: Partial<Label>) => {
    dispatch({ type: 'UPDATE_LABEL', payload: { id, updates } });
  }, []);
  const deleteLabel = useCallback((id: string) => {
    dispatch({ type: 'DELETE_LABEL', payload: id });
  }, []);
  const setFilter = useCallback((filter: TaskFilter) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);
  const setSort = useCallback((sort: TaskSort) => {
    dispatch({ type: 'SET_SORT', payload: sort });
  }, []);
  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);
  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);
  const setSidebarOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_SIDEBAR_OPEN', payload: open });
  }, []);
  const setTaskDialogOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_TASK_DIALOG_OPEN', payload: open });
  }, []);
  const setSearchQuery = useCallback((query: string) => {
    dispatch({ type: 'SET_SEARCH_QUERY', payload: query });
  }, []);
  const getFilteredTasks = useCallback((..._args: any[]) => getFilteredTasks_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, clearStalePendingPatches, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value }, ..._args), [state.tasks, state.filter, state.sort, state.searchQuery, isResourcePinned, activeWorkspace?.isPersonal, activeWorkspace?.id, state.userId]);
  const getTasksByProject = useCallback(
    (projectId: string) => {
      return buildTaskHierarchy(state.tasks).filter(t => t.projectId === projectId && !t.isArchived);
    },
    [state.tasks]
  );
  const getTaskStats = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const activeTasks = buildTaskHierarchy(state.tasks).filter(t => !t.isArchived);
    const completed = activeTasks.filter(t => t.status === 'done').length;
    const overdue = activeTasks.filter(
      t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
    ).length;
    const dueToday = activeTasks.filter(t => {
      if (!t.dueDate || t.status === 'done') return false;
      const due = new Date(t.dueDate);
      return due >= today && due < tomorrow;
    }).length;
    return {
      total: activeTasks.length,
      completed,
      overdue,
      dueToday};
  }, [state.tasks]);
  const getSelectedTask = useCallback(() => {
    return buildTaskHierarchy(state.tasks).find(t => t.id === state.selectedTaskId) || state.tasks.find(t => t.id === state.selectedTaskId) || null;
  }, [state.tasks, state.selectedTaskId]);
  const getSelectedProject = useCallback(() => {
    return state.projects.find(p => p.id === state.selectedProjectId) || null;
  }, [state.projects, state.selectedProjectId]);
  const getTagFilterOptions = useCallback((): string[] => {
    const fromTasks = state.tasks.flatMap((task) => task.labels || []);
    const fromEcosystem = state.ecosystemTags.map((tag) => tag.name);
    return Array.from(new Set([...fromEcosystem, ...fromTasks].filter((name): name is string => Boolean(name)))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );
  }, [state.tasks, state.ecosystemTags]);
  const value = useMemo(() => value_ext({ addComment, addLabel, addProject, addSubtask, addTask, addTaskCollaborator, applyPendingPatches, clearStalePendingPatches, completeTask, context, customWorkspaceId, deleteLabel, deleteProject, deleteSubtask, deleteTask, deleteTaskCollaborator, dispatch, dispatchSyncedData, fetchBatch, flowWarmOwnerRef, getFilteredTasks, getSelectedProject, getSelectedTask, getTagFilterOptions, getTaskStats, getTasksByProject, goalProjectObjectIdsRef, invalidateCalendarsNexus, invalidateTasksNexus, isCustomWorkspace, isFetchingTasksRef, lastPathnameRef, lastTaskPullAtRef, listTaskCollaborators, pathname, pendingStatusPatchesRef, projectsRef, pushLiveGoal, pushLiveTag, refreshEcosystemTags, refreshTasks, registerPendingStatus, selectProject, selectTask, setFilter, setSearchQuery, setSidebarOpen, setSort, setTaskDialogOpen, setViewMode, shouldIgnoreRealtimeStatus, state, tasksRef, threadTasksRef, togglePinProject, togglePinTask, toggleSidebar, toggleSubtask, toggleTaskReminder, updateLabel, updateProject, updateSubtask, updateTask, updateTaskCollaborator, value }), [
    state,
    addTask,
    pushLiveGoal,
    pushLiveTag,
    updateTask,
    deleteTask,
    completeTask,
    selectTask,
    togglePinTask,
    toggleTaskReminder,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    toggleSubtask,
    addComment,
    listTaskCollaborators,
    addTaskCollaborator,
    updateTaskCollaborator,
    deleteTaskCollaborator,
    addProject,
    updateProject,
    deleteProject,
    selectProject,
    togglePinProject,
    addLabel,
    updateLabel,
    deleteLabel,
    setFilter,
    setSort,
    setViewMode,
    toggleSidebar,
    setSidebarOpen,
    setTaskDialogOpen,
    setSearchQuery,
    getFilteredTasks,
    getTasksByProject,
    getTaskStats,
    getSelectedTask,
    getSelectedProject,
    pushLiveTag,
    refreshEcosystemTags,
    getTagFilterOptions,
    refreshTasks]);
  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
