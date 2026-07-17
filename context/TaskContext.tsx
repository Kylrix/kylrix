'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useRef, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { ID, Query } from 'appwrite';
import { tasks as taskApi, calendars as calendarApi, taskCollaborators, subscribeToTable, buildTaskPermissions } from '@/lib/kylrixflow';
import { getCurrentUser } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getEcosystemUrl } from '@/lib/constants';
import { buildSourceNoteTags } from '@/lib/sdk';
import { Task as AppwriteTask, Calendar as AppwriteCalendar } from '@/types/kylrixflow';
import { useDataNexus } from './DataNexusContext';
import { sendKylrixEmailNotification } from '@/lib/email-notifications';
import { useAuth } from '@/context/auth/AuthContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { getAllTags } from '@/lib/appwrite';
import type { Tags } from '@/types/appwrite';
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
  CollaboratorPermission,
} from '@/types';

// Mappers
const mapAppwriteTaskToTask = (doc: AppwriteTask): Task => {
  const raw = doc as any;
  // Extract project ID from tags if present (format: "project:ID")
  const projectTag = raw.tags?.find((t: string) => t.startsWith('project:'));
  const projectId = projectTag ? projectTag.split(':')[1] : 'inbox';
  const userLabels = raw.tags?.filter((t: string) => !t.startsWith('project:') && !t.startsWith('source:')) || [];
  const linkedNotes = raw.tags?.filter((t: string) => t.startsWith('source:kylrixnote:'))
                                .map((t: string) => t.split(':')[2]) || [];
  const comments = Array.isArray(raw.comments)
    ? raw.comments.map((entry: any) => parseCommentEntry(entry))
    : [];

  return {
    id: doc.$id,
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
    parentTaskId: raw.parentId || null,
    dueDate: raw.dueDate ? new Date(raw.dueDate) : undefined,
    createdAt: new Date(doc.$createdAt),
    updatedAt: new Date(doc.$updatedAt),
    position: 0,
    isArchived: raw.isArchived === true || String(raw.isArchived) === 'true',
    isPinned: raw.isPinned === true || String(raw.isPinned) === 'true',
    isPublic: raw.isPublic === true || String(raw.isPublic) === 'true',
    isGuest: raw.isGuest === true || String(raw.isGuest) === 'true',
    discussionId: raw.discussionId || null,
    scheduled: raw.scheduled === true || String(raw.scheduled) === 'true',
  };
};

async function notifyTaskAssignment(params: {
  taskId: string;
  taskTitle: string;
  creatorId: string;
  recipientIds: string[];
}) {
  if (params.recipientIds.length === 0) return;

  await sendKylrixEmailNotification({
    eventType: 'task_assigned',
    sourceApp: 'flow',
    actorName: params.creatorId,
    recipientIds: params.recipientIds,
    resourceId: params.taskId,
    resourceTitle: params.taskTitle,
    resourceType: 'task',
    templateKey: 'flow:task-assigned',
    ctaUrl: `${getEcosystemUrl('flow')}/goals/${params.taskId}`,
    ctaText: 'Open task',
  });
}

const parseCommentEntry = (entry: any): Comment => {
  if (entry && typeof entry === 'object' && entry.id && entry.content) {
    return {
      ...entry,
      createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date(),
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : undefined,
    };
  }

  if (typeof entry === 'string') {
    try {
      return parseCommentEntry(JSON.parse(entry));
    } catch (_e) {
      return {
        id: ID.unique(),
        content: entry,
        authorId: 'system',
        authorName: 'System',
        createdAt: new Date(),
      };
    }
  }

  return {
    id: ID.unique(),
    content: '',
    authorId: 'system',
    authorName: 'System',
    createdAt: new Date(),
  };
};

const serializeCommentEntry = (comment: Comment) =>
  JSON.stringify({
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt?.toISOString() || null,
  });

const buildTaskHierarchy = (tasks: Task[]) => {
  const cloned = tasks.map((task) => ({
    ...task,
    subtasks: [...(task.subtasks || [])],
    comments: [...(task.comments || [])],
  }));
  const taskMap = new Map(cloned.map((task) => [task.id, task]));

  cloned.forEach((task) => {
    if (!task.parentTaskId) return;
    const parent = taskMap.get(task.parentTaskId);
    if (!parent) return;

    parent.subtasks = [
      ...parent.subtasks.filter((subtask) => subtask.id !== task.id),
      {
        id: task.id,
        title: task.title,
        completed: task.status === 'done',
        createdAt: task.createdAt,
        completedAt: task.status === 'done' ? task.completedAt : undefined,
      }];
  });

  return cloned.filter((task) => !task.parentTaskId);
};

const mapAppwriteCalendarToProject = (doc: AppwriteCalendar): Project => ({
  id: doc.$id,
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
  createdAt: new Date(doc.$createdAt),
  updatedAt: new Date(doc.$updatedAt),
  position: 0,
  settings: {
    defaultPriority: 'medium',
    allowSubtasks: true,
    allowTimeTracking: true,
    allowRecurrence: true,
    showCompletedTasks: true,
  },
});

const mapEcosystemTagsToLabels = (tags: Tags[]): Label[] =>
  tags
    .filter((tag): tag is Tags & { name: string } => Boolean(tag.name))
    .map((tag) => ({
      id: tag.name,
      name: tag.name,
      color: (tag as Tags & { color?: string }).color || '#9B9691',
      description: (tag as Tags & { description?: string }).description,
    }));

// State
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
    showArchived: false,
  },
  sort: {
    field: 'dueDate',
    direction: 'asc',
  },
  viewMode: 'list',
  isLoading: true,
  error: null,
  sidebarOpen: true,
  taskDialogOpen: false,
  searchQuery: '',
  userId: null,
};

// Actions
type TaskAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_DATA'; payload: { tasks: Task[]; projects: Project[] } }
  | { type: 'SET_USER'; payload: string }
  | { type: 'ADD_TASK'; payload: Task }
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

// Reducer
function taskReducer(state: TaskState, action: TaskAction): TaskState {
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
          isLoading: false,
        };
      }

    case 'SET_USER':
      return { ...state, userId: action.payload };

    case 'ADD_TASK':
      if (state.tasks.some((task) => task.id === action.payload.id)) {
        return state;
      }
      return { ...state, tasks: [...state.tasks, action.payload] };

    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, ...action.payload.updates, updatedAt: new Date() }
            : task
        ),
      };

    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
        selectedTaskId: state.selectedTaskId === action.payload ? null : state.selectedTaskId,
      };

    case 'COMPLETE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === action.payload
            ? {
                ...task,
                status: task.status === 'done' ? 'todo' : 'done',
                completedAt: task.status === 'done' ? undefined : new Date(),
                updatedAt: new Date(),
              }
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
          labels: task.labels.filter(l => l !== action.payload),
        })),
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
                updatedAt: new Date(),
              }
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
        labels: mapEcosystemTagsToLabels(action.payload),
      };

    default:
      return state;
  }
}

// Context
interface TaskContextType extends TaskState {
  // Task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => Promise<Task | null>;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  selectTask: (id: string | null) => void;
  togglePinTask: (id: string) => Promise<void>;
  toggleTaskReminder: (id: string, enabled: boolean) => Promise<void>;
  // Subtask actions
  addSubtask: (taskId: string, title: string, description?: string) => void;
  updateSubtask: (taskId: string, subtaskId: string, updates: Partial<Subtask>) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  // Comment actions
  addComment: (taskId: string, content: string) => void;
  listTaskCollaborators: (taskId: string) => Promise<TaskCollaborator[]>;
  addTaskCollaborator: (taskId: string, userId: string, permission: CollaboratorPermission) => Promise<TaskCollaborator | null>;
  updateTaskCollaborator: (taskId: string, collaboratorId: string, permission: CollaboratorPermission) => Promise<TaskCollaborator | null>;
  deleteTaskCollaborator: (taskId: string, collaboratorId: string) => Promise<void>;
  // Project actions
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string | null) => void;
  togglePinProject: (id: string) => Promise<void>;
  // Label actions
  addLabel: (label: Omit<Label, 'id'>) => void;
  updateLabel: (id: string, updates: Partial<Label>) => void;
  deleteLabel: (id: string) => void;
  // Filter and sort actions
  setFilter: (filter: TaskFilter) => void;
  setSort: (sort: TaskSort) => void;
  setViewMode: (mode: ViewMode) => void;
  // UI actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTaskDialogOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  // Computed values
  getFilteredTasks: () => Task[];
  getTasksByProject: (projectId: string) => Task[];
  getTaskStats: () => { total: number; completed: number; overdue: number; dueToday: number };
  getSelectedTask: () => Task | null;
  getSelectedProject: () => Project | null;
  ecosystemTags: Tags[];
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

async function syncTaskAccess(taskId: string, creatorId: string, assigneeIds: string[], taskTitle: string, previousAssigneeIds: string[] = []) {
  const collaboratorRows = await taskCollaborators.list(taskId);
  const collaboratorIds = new Set(collaboratorRows.map((row) => row.userId));
  const normalizedAssigneeIds = Array.from(new Set(assigneeIds.filter((id): id is string => Boolean(id) && id !== 'guest')));
  const newlyAddedAssignees = normalizedAssigneeIds.filter((id) => id !== creatorId && !previousAssigneeIds.includes(id));

  for (const assigneeId of normalizedAssigneeIds) {
    if (!collaboratorIds.has(assigneeId)) {
      const created = await taskCollaborators.create(taskId, assigneeId, 'read', creatorId);
      collaboratorRows.push(created);
      collaboratorIds.add(assigneeId);
    } else {
      const existing = collaboratorRows.find((row) => row.userId === assigneeId);
      if (existing && existing.permission !== 'read') {
        const updated = await taskCollaborators.update(existing.id, { permission: 'read' }, creatorId, taskId);
        const rowIndex = collaboratorRows.findIndex((row) => row.id === existing.id);
        if (rowIndex !== -1) {
          collaboratorRows[rowIndex] = updated;
        }
      }
    }
  }

  const permissions = buildTaskPermissions(creatorId, normalizedAssigneeIds, collaboratorRows);
  await taskApi.update(taskId, { assigneeIds: normalizedAssigneeIds }, permissions);

  if (newlyAddedAssignees.length > 0) {
    await notifyTaskAssignment({
      taskId,
      taskTitle,
      creatorId,
      recipientIds: newlyAddedAssignees,
    }).catch((error) => {
      console.error('[TaskContext] Failed to queue task assignment email', error);
    });
  }

  await Promise.all(
    collaboratorRows.map((collaborator) =>
      taskCollaborators.update(
        collaborator.id,
        { permission: collaborator.permission as CollaboratorPermission },
        creatorId,
        taskId,
        permissions
      )
    )
  );

  return collaboratorRows;
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(taskReducer, initialState);
  const ghostTasksRef = useRef<Task[]>([]);
  const { fetchOptimized, invalidate, getCachedData, getCachedDataAsync, setCachedData, refreshInBackground } = useDataNexus();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const { isPinned: isResourcePinned, togglePin, setLocalPin } = useResourcePins();
  const flowWarmOwnerRef = useRef<string | null>(null);
  const pendingStatusPatchesRef = useRef<Map<string, PendingStatusPatch>>(new Map());

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
      at: Date.now(),
    });
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
        updatedAt: new Date(),
      };
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

  const refreshEcosystemTags = useCallback(async () => {
    try {
      const { rows } = await getAllTags();
      dispatch({ type: 'SET_ECOSYSTEM_TAGS', payload: rows });
    } catch (error) {
      console.error('[TaskContext] Failed to load ecosystem tags', error);
    }
  }, []);

  const fetchBatch = useCallback(async (uid: string, force = false) => {
    const FLOW_WARM_TTL = 1000 * 60 * 30;
    const tasksKey = `f_tasks_${uid}`;
    const calsKey = `f_calendars_${uid}`;

    const taskQueries = [
      Query.equal('userId', uid),
      Query.limit(1000),
      Query.select(['$id', 'userId', 'title', 'description', 'status', 'priority', 'dueDate', 'recurrenceRule', 'tags', 'assigneeIds', 'attachmentIds', '$createdAt', '$updatedAt', 'isPinned', 'isArchived', 'isPublic', 'isGuest', 'parentId', 'comments', 'discussionId'])];
    const calQueries = [
      Query.equal('userId', uid),
      Query.limit(100),
      Query.select(['$id', 'userId', 'name', 'color', 'isDefault', 'isPinned', '$createdAt', '$updatedAt'])];

    const [tList, cList] = await Promise.all([
      fetchOptimized(tasksKey, () => taskApi.list(taskQueries), force ? 0 : FLOW_WARM_TTL),
      fetchOptimized(calsKey, () => calendarApi.list(calQueries), force ? 0 : FLOW_WARM_TTL)]);

    return { 
      tasks: (tList?.rows || []).map(mapAppwriteTaskToTask), 
      projects: (cList?.rows || []).map(mapAppwriteCalendarToProject) 
    };

  }, [fetchOptimized]);

  const dispatchSyncedData = useCallback((data: { tasks: Task[]; projects: Project[] }) => {
    const historyRaw = typeof window !== 'undefined' ? localStorage.getItem('kylrix_ghost_notes_v2') : null;
    const deletedIds = new Set<string>();
    if (historyRaw) {
      try {
        const history = JSON.parse(historyRaw);
        if (Array.isArray(history)) {
          history.forEach((item: any) => {
            const meta = (() => {
              try { return JSON.parse(item.metadata || '{}'); } catch { return {}; }
            })();
            if (meta?._deleted === true) {
              deletedIds.add(item.id);
            }
          });
        }
      } catch {}
    }

    const mergedTasks = [
      ...ghostTasksRef.current,
      ...data.tasks.filter(t => !deletedIds.has(t.id))
    ];

    dispatch({
      type: 'SET_DATA',
      payload: {
        tasks: applyPendingPatches(mergedTasks),
        projects: data.projects,
      },
    });
  }, [applyPendingPatches]);

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

  // Initial Data Fetch & Cold Hydration
  useEffect(() => {
    if (isAuthLoading) return;

    const init = async () => {
      try {
        let userId = authUser?.$id || 'guest';
        if (!authUser?.$id) {
            try {
                const user = await getCurrentUser();
                userId = user.$id;
            } catch {
                // If we can't get user even here, we are truly guest
            }
        }
        dispatch({ type: 'SET_USER', payload: userId });
        flowWarmOwnerRef.current = userId;

        // Load ghost tasks and deleted IDs for ALL users (including guest and authenticated)
        const historyRaw = typeof window !== 'undefined' ? localStorage.getItem('kylrix_ghost_notes_v2') : null;
        let ghostTasks: Task[] = [];
        const deletedIds = new Set<string>();
        if (historyRaw) {
            try {
                const history = JSON.parse(historyRaw);
                if (Array.isArray(history)) {
                    const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
                    for (const item of history) {
                        const meta = (() => {
                            try { return JSON.parse(item.metadata || '{}'); } catch { return {}; }
                        })();
                        if (meta?._deleted === true) {
                            deletedIds.add(item.id);
                        } else if (meta?.send_object?.kind === 'task') {
                            const decryptedContent = (item.content && item.decryptionKey)
                                ? await decryptGhostData(item.content, item.decryptionKey)
                                : (item.content || '');
                            const payload = (() => {
                                try { return JSON.parse(decryptedContent); } catch { return null; }
                            })();
                            if (payload) {
                                ghostTasks.push({
                                    id: item.id,
                                    title: payload.title || item.title,
                                    description: payload.detail || '',
                                    status: payload.status || 'todo',
                                    priority: payload.priority || 'medium',
                                    labels: [],
                                    subtasks: [],
                                    comments: [],
                                    attachments: [],
                                    reminders: [],
                                    timeEntries: [],
                                    assigneeIds: [userId],
                                    creatorId: userId,
                                    dueDate: payload.dueAt ? new Date(payload.dueAt) : undefined,
                                    createdAt: new Date(item.createdAt),
                                    updatedAt: new Date(item.createdAt),
                                    position: 0,
                                    isArchived: false,
                                    isPinned: false,
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to load ghost tasks', e);
            }
        }
        ghostTasksRef.current = ghostTasks;

        if (userId === 'guest') {
            dispatchSyncedData({
                tasks: ghostTasks,
                projects: [],
            });
            dispatch({ type: 'SET_LOADING', payload: false });
            return;
        }

        // 1. Proactive Hydration (RxDB Substrate)
        const tasksKey = `f_tasks_${userId}`;
        const calsKey = `f_calendars_${userId}`;
        const COLD_START_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days authoritative window

        const [cachedTasksRes, cachedCalsRes] = await Promise.all([
            getCachedDataAsync<any>(tasksKey, COLD_START_TTL),
            getCachedDataAsync<any>(calsKey, COLD_START_TTL)
        ]);

        if (cachedTasksRes || cachedCalsRes) {
            console.log('[TaskContext] Cold-start hydration triggered via RxDB.');
            dispatchSyncedData({
              tasks: (cachedTasksRes?.rows || []).map(mapAppwriteTaskToTask),
              projects: (cachedCalsRes?.rows || []).map(mapAppwriteCalendarToProject),
            });
        }

        // 2. Standard Background Refresh
        const data = await fetchBatch(userId);
        dispatchSyncedData(data);
        await refreshEcosystemTags();
      } catch (err: any) {
          console.error('[TaskContext] Authoritative init failed:', err);
          dispatch({ type: 'SET_ERROR', payload: err.message || 'Failed to sync workspace' });
      }
    };

    init();
  }, [authUser?.$id, isAuthLoading, fetchBatch, getCachedDataAsync, dispatchSyncedData, refreshEcosystemTags]);

  // Route-based background revalidation
  useEffect(() => {
    if (!state.userId || state.userId === 'guest' || isAuthLoading) return;
    if (pathname === lastPathnameRef.current) return;

    const prevPath = lastPathnameRef.current;
    lastPathnameRef.current = pathname;

    // Only revalidate if we actually navigated (not first load)
    if (prevPath && pathname.startsWith('/flow')) {
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

    const handleGhostClaimed = () => {
      console.log('[TaskContext] Ghost items claimed. Refreshing tasks...');
      if (state.userId && state.userId !== 'guest') {
        void refreshTasks();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('kylrix:ghost-claimed', handleGhostClaimed);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('kylrix:ghost-claimed', handleGhostClaimed);
    };
  }, [state.userId, refreshTasks]);
  // Realtime Subscriptions
  useEffect(() => {
    if (!state.userId) return;

    let unsubTasks: any;
    let unsubProjects: any;

    const initRealtime = async () => {
      // Subscribe to Tasks
      unsubTasks = await subscribeToTable<AppwriteTask>(APPWRITE_CONFIG.TABLES.TASKS, ({ type, payload }) => {
        if (payload.userId !== state.userId) return;
        if (type === 'create') {
          dispatch({ type: 'ADD_TASK', payload: mapAppwriteTaskToTask(payload) });
        } else if (type === 'update') {
          const mapped = mapAppwriteTaskToTask(payload);
          if (shouldIgnoreRealtimeStatus(payload.$id, mapped.status)) return;
          dispatch({ type: 'UPDATE_TASK', payload: { id: payload.$id, updates: mapped } });
        } else if (type === 'delete') {
          dispatch({ type: 'DELETE_TASK', payload: payload.$id });
        }
      });

      // Subscribe to Calendars/Projects
      unsubProjects = await subscribeToTable<AppwriteCalendar>(APPWRITE_CONFIG.TABLES.CALENDARS, ({ type, payload }) => {
        if (payload.userId !== state.userId) return;

        if (type === 'create') {
          dispatch({ type: 'ADD_PROJECT', payload: mapAppwriteCalendarToProject(payload) });
        } else if (type === 'update') {
          dispatch({ type: 'UPDATE_PROJECT', payload: { id: payload.$id, updates: mapAppwriteCalendarToProject(payload) } });
        } else if (type === 'delete') {
          dispatch({ type: 'DELETE_PROJECT', payload: payload.$id });
        }
      });
    };

    initRealtime();

    return () => {
      if (typeof unsubTasks === 'function') unsubTasks();
      else if (unsubTasks?.unsubscribe) unsubTasks.unsubscribe();
      
      if (typeof unsubProjects === 'function') unsubProjects();
      else if (unsubProjects?.unsubscribe) unsubProjects.unsubscribe();
    };
  }, [state.userId, shouldIgnoreRealtimeStatus]);

  // Task actions
  const addTask = useCallback(
    async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => {
      try {
        const userId = state.userId || 'guest';
        const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;

        if (userId === 'guest' || isOffline) {
          // Save as ghost task in localStorage
          const secret = localStorage.getItem('kylrix_ghost_secret_v2') || crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
          const deletionSecret = crypto.randomUUID();
          const { sha256HexUtf8 } = await import('@/lib/crypto/sha256-hex');
          const creatorDeletionProofHash = await sha256HexUtf8(deletionSecret);

          const taskPayload = {
            title: task.title,
            detail: task.description || '',
            dueAt: task.dueDate ? task.dueDate.toISOString() : undefined,
            priority: task.priority || 'medium',
          };

          const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
          const { encrypted: encTitle, key: noteKey } = await encryptGhostData(task.title);
          const { encrypted: encContent } = await encryptGhostData(JSON.stringify(taskPayload), noteKey);

          const id = `ghost-${crypto.randomUUID()}`;
          const newRef = {
            id,
            title: encTitle,
            content: encContent,
            metadata: JSON.stringify({
              isGhost: true,
              ghostSecret: secret,
              expiresAt,
              isEncrypted: true,
              creatorDeletionProofHash,
              send_object: { kind: 'task' }
            }),
            createdAt: new Date().toISOString(),
            expiresAt,
            decryptionKey: noteKey,
            deletionSecret,
          };

          const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
          let history = historyRaw ? JSON.parse(historyRaw) : [];
          if (!Array.isArray(history)) history = [];
          history.unshift(newRef);
          localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
          window.dispatchEvent(new Event('storage'));

          const mappedTask: Task = {
            id,
            title: task.title,
            description: task.description || '',
            status: task.status,
            priority: task.priority,
            labels: task.labels || [],
            subtasks: [],
            comments: [],
            attachments: [],
            reminders: [],
            timeEntries: [],
            assigneeIds: ['guest'],
            creatorId: 'guest',
            dueDate: task.dueDate,
            createdAt: new Date(),
            updatedAt: new Date(),
            position: 0,
            isArchived: false,
            isPinned: false,
          };

          dispatch({ type: 'ADD_TASK', payload: mappedTask });
          return mappedTask;
        }

        // Prepare tags with project ID
        const tags = [...(task.labels || [])];
        if (task.linkedNotes?.length) {
          tags.push(...buildSourceNoteTags(task.linkedNotes));
        }
        if (task.projectId && task.projectId !== 'inbox') {
          tags.push(`project:${task.projectId}`);
        }

        const newTask = await taskApi.create({
          title: task.title,
          description: task.description || '',
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate ? task.dueDate.toISOString() : null,
          userId: userId,
          tags: tags,
          assigneeIds: task.assigneeIds || [],
          attachmentIds: [],
          eventId: '',
          parentId: '',
          recurrenceRule: task.recurrence ? JSON.stringify(task.recurrence) : '',
        }, buildTaskPermissions(userId, task.assigneeIds || []));

        await syncTaskAccess(newTask.$id, userId, task.assigneeIds || [], task.title, []);
        invalidateTasksNexus(userId);

        const mapped = mapAppwriteTaskToTask(newTask);
        dispatch({ type: 'ADD_TASK', payload: mapped });
        return mapped;
      } catch (error: unknown) {
        console.error('Failed to create task', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to create task' });
        return null;
      }
    },
    [state.userId, invalidateTasksNexus]
  );

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;

    if ((id.startsWith('ghost-') || isOffline) && typeof window !== 'undefined') {
      const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
      if (historyRaw) {
        try {
          const history = JSON.parse(historyRaw);
          const index = history.findIndex((n: any) => n.id === id);
          if (index !== -1) {
            const match = history[index];
            const payload = JSON.parse(match.content || '{}');
            const updatedPayload = {
              ...payload,
              title: updates.title !== undefined ? updates.title : payload.title,
              detail: updates.description !== undefined ? updates.description : payload.detail,
              dueAt: updates.dueDate !== undefined ? (updates.dueDate ? updates.dueDate.toISOString() : undefined) : payload.dueAt,
              priority: updates.priority !== undefined ? updates.priority : payload.priority,
              status: updates.status !== undefined ? updates.status : payload.status,
            };

            const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
            const { encrypted: encTitle, key: noteKey } = await encryptGhostData(updatedPayload.title);
            const { encrypted: encContent } = await encryptGhostData(JSON.stringify(updatedPayload), noteKey);

            history[index] = {
              ...match,
              title: encTitle,
              content: encContent,
              decryptionKey: noteKey,
            };
            localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
            window.dispatchEvent(new Event('storage'));
          } else {
            // Standard task edited offline -> save as ghost note with standard ID!
            const currentTask = state.tasks.find(t => t.id === id);
            const taskPayload = {
              title: updates.title !== undefined ? updates.title : (currentTask?.title || ''),
              detail: updates.description !== undefined ? updates.description : (currentTask?.description || ''),
              dueAt: updates.dueDate !== undefined ? (updates.dueDate ? updates.dueDate.toISOString() : undefined) : (currentTask?.dueDate ? currentTask.dueDate.toISOString() : undefined),
              priority: updates.priority !== undefined ? updates.priority : (currentTask?.priority || 'medium'),
              status: updates.status !== undefined ? updates.status : (currentTask?.status || 'todo'),
            };

            const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
            const noteKey = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
            const { encrypted: encTitle } = await encryptGhostData(taskPayload.title, noteKey);
            const { encrypted: encContent } = await encryptGhostData(JSON.stringify(taskPayload), noteKey);

            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const deletionSecret = crypto.randomUUID();

            const newRef = {
              id,
              title: encTitle,
              content: encContent,
              metadata: JSON.stringify({
                isGhost: true,
                expiresAt,
                isEncrypted: true,
                send_object: { kind: 'task' }
              }),
              createdAt: new Date().toISOString(),
              expiresAt,
              decryptionKey: noteKey,
              deletionSecret,
            };

            history.unshift(newRef);
            localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(history));
            window.dispatchEvent(new Event('storage'));
          }
        } catch (e) {
          console.error(e);
        }
      }
      dispatch({ type: 'UPDATE_TASK', payload: { id, updates } });
      return;
    }

    const currentTask = state.tasks.find(t => t.id === id);
    if (!currentTask) return;

    const shareOnly =
      (updates.isPublic !== undefined || updates.isGuest !== undefined) &&
      Object.keys(updates).every((key) => key === 'isPublic' || key === 'isGuest');
    if (shareOnly) {
      dispatch({ type: 'UPDATE_TASK', payload: { id, updates } });
      return;
    }

    const previousStatus = currentTask.status;
    const previousCompletedAt = currentTask.completedAt;

    if (updates.status !== undefined) {
      registerPendingStatus(
        id,
        updates.status,
        updates.completedAt ?? (updates.status === 'done' ? new Date() : undefined),
      );
    }

    // Optimistic update
    dispatch({ type: 'UPDATE_TASK', payload: { id, updates } });

    try {

      const apiUpdates: any = {};
      if (updates.title !== undefined) apiUpdates.title = updates.title;
      if (updates.description !== undefined) apiUpdates.description = updates.description;
      if (updates.status !== undefined) apiUpdates.status = updates.status;
      if (updates.priority !== undefined) apiUpdates.priority = updates.priority;
      if (updates.dueDate !== undefined) {
        apiUpdates.dueDate = updates.dueDate 
          ? (typeof updates.dueDate === 'string' ? updates.dueDate : updates.dueDate.toISOString()) 
          : null;
      }
      if (updates.parentTaskId !== undefined) {
        apiUpdates.parentId = updates.parentTaskId || null;
      }
      if (updates.assigneeIds !== undefined) {
        apiUpdates.assigneeIds = updates.assigneeIds;
      }
      if (updates.attachments !== undefined) {
        apiUpdates.attachmentIds = updates.attachments;
      }
      if (updates.isPinned !== undefined) apiUpdates.isPinned = updates.isPinned;
      if (updates.isPublic !== undefined) apiUpdates.isPublic = updates.isPublic;
      if (updates.isGuest !== undefined) apiUpdates.isGuest = updates.isGuest;
      if (updates.scheduled !== undefined) apiUpdates.scheduled = updates.scheduled;

      if (updates.labels !== undefined || updates.linkedNotes !== undefined || updates.projectId !== undefined) {
        const projectId = updates.projectId || currentTask.projectId;

        const finalTags = updates.labels !== undefined ? [...updates.labels] : [...(currentTask.labels || [])];

        const notesToLink = updates.linkedNotes !== undefined ? updates.linkedNotes : (currentTask.linkedNotes || []);
        notesToLink.forEach(noteId => {
          const tag = `source:kylrixnote:${noteId}`;
          if (!finalTags.includes(tag)) finalTags.push(tag);
        });

        if (projectId && projectId !== 'inbox') {
          const projectTag = `project:${projectId}`;
          if (!finalTags.includes(projectTag)) finalTags.push(projectTag);
        }

        apiUpdates.tags = finalTags;
      }

      const nextAssignees = updates.assigneeIds ?? currentTask.assigneeIds;
      const currentCollaborators = await taskCollaborators.list(id);
      await taskApi.update(id, apiUpdates, buildTaskPermissions(currentTask.creatorId, nextAssignees, currentCollaborators));
      await syncTaskAccess(id, currentTask.creatorId, nextAssignees || [], currentTask.title, currentTask.assigneeIds || []);
      invalidateTasksNexus(state.userId || 'guest');
    } catch (error: unknown) {
      if (updates.status !== undefined) {
        pendingStatusPatchesRef.current.delete(id);
        dispatch({
          type: 'UPDATE_TASK',
          payload: {
            id,
            updates: {
              status: previousStatus,
              completedAt: previousCompletedAt,
            },
          },
        });
      }
      console.error('Failed to update task', error);
    }
  }, [state.tasks, state.userId, invalidateTasksNexus, registerPendingStatus]);

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
              scheduled: updatedDoc.scheduled,
            }
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

  const deleteTask = useCallback(async (id: string) => {
    const isOffline = typeof window !== 'undefined' && !window.navigator.onLine;

    if ((id.startsWith('ghost-') || isOffline) && typeof window !== 'undefined') {
      const historyRaw = localStorage.getItem('kylrix_ghost_notes_v2');
      if (historyRaw) {
        try {
          const history = JSON.parse(historyRaw);
          const filtered = history.filter((n: any) => n.id !== id);
          
          if (isOffline && !id.startsWith('ghost-')) {
            // Save deletion as a ghost note with _deleted: true
            const newRef = {
              id,
              title: '',
              content: '',
              metadata: JSON.stringify({
                isGhost: true,
                _deleted: true,
                send_object: { kind: 'task' }
              }),
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              decryptionKey: '',
              deletionSecret: '',
            };
            filtered.unshift(newRef);
          }

          localStorage.setItem('kylrix_ghost_notes_v2', JSON.stringify(filtered));
          window.dispatchEvent(new Event('storage'));
        } catch (e) {
          console.error(e);
        }
      }
      dispatch({ type: 'DELETE_TASK', payload: id });
      return;
    }

    try {
      const collectDescendants = (taskId: string): string[] => {
        const directChildren = state.tasks.filter(task => task.parentTaskId === taskId).map(task => task.id);
        const descendantIds: string[] = [];
        directChildren.forEach((childId) => {
          descendantIds.push(childId, ...collectDescendants(childId));
        });
        return descendantIds;
      };

      const descendantIds = collectDescendants(id);
      for (const childId of descendantIds) {
        const childCollaborators = await taskCollaborators.list(childId);
        await Promise.all(childCollaborators.map((collaborator) => taskCollaborators.delete(collaborator.id)));
        await taskApi.delete(childId);
        dispatch({ type: 'DELETE_TASK', payload: childId });
      }

      const currentCollaborators = await taskCollaborators.list(id);
      await Promise.all(currentCollaborators.map((collaborator) => taskCollaborators.delete(collaborator.id)));
      await taskApi.delete(id);
      invalidateTasksNexus(state.userId || 'guest');
      dispatch({ type: 'DELETE_TASK', payload: id });
    } catch (error: unknown) {
      console.error('Failed to delete task', error);
    }
  }, [state.tasks, state.userId, invalidateTasksNexus]);

  const completeTask = useCallback(async (id: string) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    const completedAt = newStatus === 'done' ? new Date() : undefined;
    const previousStatus = task.status;
    const previousCompletedAt = task.completedAt;

    registerPendingStatus(id, newStatus, completedAt);
    dispatch({
      type: 'UPDATE_TASK',
      payload: { id, updates: { status: newStatus, completedAt } },
    });

    try {
      await taskApi.update(id, { status: newStatus });
      invalidateTasksNexus(state.userId || 'guest');
    } catch (error: unknown) {
      pendingStatusPatchesRef.current.delete(id);
      dispatch({
        type: 'UPDATE_TASK',
        payload: {
          id,
          updates: {
            status: previousStatus,
            completedAt: previousCompletedAt,
          },
        },
      });
      console.error('Failed to complete task', error);
    }
  }, [state.tasks, state.userId, invalidateTasksNexus, registerPendingStatus]);

  const selectTask = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_TASK', payload: id });
  }, []);

  // Subtask actions (Local only for now)
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
      createdAt: new Date(),
    };

    await updateTask(taskId, {
      comments: [...(task.comments || []), comment],
    });
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

  // Project actions
  const addProject = useCallback(
    async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => {
      try {
        const userId = state.userId || 'guest';
        const newCalendar = await calendarApi.create({
          name: project.name,
          color: project.color,
          isDefault: false,
          userId: userId,
        });
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

  // Label actions (Local only)
  const addLabel = useCallback((label: Omit<Label, 'id'>) => {
    const newLabel: Label = {
      ...label,
      id: ID.unique(),
    };
    dispatch({ type: 'ADD_LABEL', payload: newLabel });
  }, []);

  const updateLabel = useCallback((id: string, updates: Partial<Label>) => {
    dispatch({ type: 'UPDATE_LABEL', payload: { id, updates } });
  }, []);

  const deleteLabel = useCallback((id: string) => {
    dispatch({ type: 'DELETE_LABEL', payload: id });
  }, []);

  // Filter and sort
  const setFilter = useCallback((filter: TaskFilter) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);

  const setSort = useCallback((sort: TaskSort) => {
    dispatch({ type: 'SET_SORT', payload: sort });
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode });
  }, []);

  // UI
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

  // Computed values
  const getFilteredTasks = useCallback(() => {
    let filtered = buildTaskHierarchy(state.tasks);

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
      const aDone = a.status === 'done';
      const bDone = b.status === 'done';
      const aPinned = isResourcePinned('task', a.id, a.creatorId, a.isPinned);
      const bPinned = isResourcePinned('task', b.id, b.creatorId, b.isPinned);
      
      // 1. Completion State: Done tasks always sink to the bottom
      if (aDone !== bDone) {
        return aDone ? 1 : -1;
      }

      // 2. Pin State: Pinned tasks authoritatively float to the top
      if (aPinned !== bPinned) {
        return aPinned ? -1 : 1;
      }

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
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
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
  }, [state.tasks, state.filter, state.sort, state.searchQuery, isResourcePinned]);

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
      dueToday,
    };
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

  const value = useMemo<TaskContextType>(() => ({
    ...state,
    addTask,
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
    ecosystemTags: state.ecosystemTags,
    refreshEcosystemTags,
    getTagFilterOptions,
    refreshTasks,
  }), [
    state,
    addTask,
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
    refreshEcosystemTags,
    getTagFilterOptions,
    refreshTasks]);

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
