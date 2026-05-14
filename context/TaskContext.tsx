'use client';

import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useRef } from 'react';
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
    isArchived: false,
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
      },
    ];
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

// Sample labels (hardcoded for now as there is no backend collection)
const DEFAULT_LABELS: Label[] = [
  { id: 'label-1', name: 'Bug', color: '#ef4444', description: 'Bug fixes and issues' },
  { id: 'label-2', name: 'Feature', color: '#10b981', description: 'New features' },
  { id: 'label-3', name: 'Enhancement', color: '#3b82f6', description: 'Improvements' },
  { id: 'label-4', name: 'Documentation', color: '#8b5cf6', description: 'Docs updates' },
  { id: 'label-5', name: 'Urgent', color: '#f59e0b', description: 'Needs immediate attention' },
  { id: 'label-6', name: 'Research', color: '#ec4899', description: 'Research tasks' },
];

// State
interface TaskState {
  tasks: Task[];
  projects: Project[];
  labels: Label[];
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
  labels: DEFAULT_LABELS,
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
  | { type: 'REORDER_TASKS'; payload: { taskIds: string[]; projectId?: string } };

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

    default:
      return state;
  }
}

// Context
interface TaskContextType extends TaskState {
  // Task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  selectTask: (id: string | null) => void;
  // Subtask actions
  addSubtask: (taskId: string, title: string) => void;
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
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

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
  const newlyAddedAssignees = normalizedAssigneeIds.filter((id) => !previousAssigneeIds.includes(id));

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
  const { fetchOptimized, invalidate, getCachedData, setCachedData, refreshInBackground } = useDataNexus();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();
  const flowWarmOwnerRef = useRef<string | null>(null);

  const invalidateTasksNexus = useCallback((uid: string) => invalidate(`f_tasks_${uid}`), [invalidate]);
  const invalidateCalendarsNexus = useCallback((uid: string) => invalidate(`f_calendars_${uid}`), [invalidate]);

  const pathname = usePathname();
  const lastPathnameRef = useRef<string | null>(null);

  const fetchBatch = useCallback(async (uid: string, force = false) => {
    const FLOW_WARM_TTL = 1000 * 60 * 30;
    const tasksKey = `f_tasks_${uid}`;
    const calsKey = `f_calendars_${uid}`;

    const taskQueries = [
      Query.equal('userId', uid),
      Query.limit(1000),
      Query.select(['$id', 'userId', 'title', 'status', 'priority', 'dueDate', 'tags', '$createdAt', '$updatedAt']),
    ];
    const calQueries = [
      Query.equal('userId', uid),
      Query.limit(100),
      Query.select(['$id', 'userId', 'name', 'color', 'isDefault']),
    ];

    const [tList, cList] = await Promise.all([
      fetchOptimized(tasksKey, () => taskApi.list(taskQueries), force ? 0 : FLOW_WARM_TTL),
      fetchOptimized(calsKey, () => calendarApi.list(calQueries), force ? 0 : FLOW_WARM_TTL),
    ]);

    return { 
      tasks: tList.rows.map(mapAppwriteTaskToTask), 
      projects: cList.rows.map(mapAppwriteCalendarToProject) 
    };
  }, [fetchOptimized]);

  // Initial Data Fetch
  useEffect(() => {
    if (isAuthLoading) return;

    const init = async () => {
      let userId = authUser?.$id || 'guest';
      if (!authUser?.$id) {
        try {
          const user = await getCurrentUser();
          userId = user.$id;
        } catch {}
      }
      dispatch({ type: 'SET_USER', payload: userId });
      flowWarmOwnerRef.current = userId;

      if (userId === 'guest') return;

      const data = await fetchBatch(userId);
      dispatch({ type: 'SET_DATA', payload: data });
    };

    init();
  }, [authUser?.$id, isAuthLoading, fetchBatch]);

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
        dispatch({ type: 'SET_DATA', payload: data });
        return true;
      }, 10000); // 10s cooldown for route-based refreshes
    }
  }, [pathname, state.userId, isAuthLoading, fetchBatch, refreshInBackground]);
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
          dispatch({ type: 'UPDATE_TASK', payload: { id: payload.$id, updates: mapAppwriteTaskToTask(payload) } });
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
  }, [state.userId]);

  // Task actions
  const addTask = useCallback(
    async (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'position'>) => {
      try {
        const userId = state.userId || 'guest';
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

        dispatch({ type: 'ADD_TASK', payload: mapAppwriteTaskToTask(newTask) });
      } catch (error: unknown) {
        console.error('Failed to create task', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to create task' });
      }
    },
    [state.userId, invalidateTasksNexus]
  );

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    try {
      const currentTask = state.tasks.find(t => t.id === id);
      if (!currentTask) return;

      // Optimistic update
      dispatch({ type: 'UPDATE_TASK', payload: { id, updates } });

      const apiUpdates: any = {};
      if (updates.title !== undefined) apiUpdates.title = updates.title;
      if (updates.description !== undefined) apiUpdates.description = updates.description;
      if (updates.status !== undefined) apiUpdates.status = updates.status;
      if (updates.priority !== undefined) apiUpdates.priority = updates.priority;
      if (updates.dueDate !== undefined) apiUpdates.dueDate = updates.dueDate?.toISOString();
      if (updates.parentTaskId !== undefined) {
        apiUpdates.parentId = updates.parentTaskId || null;
      }
      if (updates.assigneeIds !== undefined) {
        apiUpdates.assigneeIds = updates.assigneeIds;
      }
      if (updates.attachments !== undefined) {
        apiUpdates.attachmentIds = updates.attachments;
      }
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
      console.error('Failed to update task', error);
      // Revert?
    }
  }, [state.tasks, state.userId, invalidateTasksNexus]);

  const deleteTask = useCallback(async (id: string) => {
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
    try {
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
      
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      await taskApi.update(id, { status: newStatus });
      invalidateTasksNexus(state.userId || 'guest');
      dispatch({ type: 'COMPLETE_TASK', payload: id });
    } catch (error: unknown) {
      console.error('Failed to complete task', error);
    }
  }, [state.tasks, state.userId, invalidateTasksNexus]);

  const selectTask = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_TASK', payload: id });
  }, []);

  // Subtask actions (Local only for now)
  const addSubtask = useCallback(async (taskId: string, title: string) => {
    const parentTask = state.tasks.find(task => task.id === taskId);
    if (!parentTask) return;

    try {
      const creatorId = state.userId || parentTask.creatorId || 'guest';
      const childTask = await taskApi.create({
        title,
        description: '',
        status: 'todo',
        priority: parentTask.priority,
        dueDate: parentTask.dueDate ? parentTask.dueDate.toISOString() : null,
        userId: creatorId,
        tags: [
          ...(parentTask.labels || []),
          ...(parentTask.projectId && parentTask.projectId !== 'inbox' ? [`project:${parentTask.projectId}`] : []),
        ],
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
      if (aDone !== bDone) {
        return aDone ? 1 : -1;
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
  }, [state.tasks, state.filter, state.sort, state.searchQuery]);

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

  const value: TaskContextType = {
    ...state,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    selectTask,
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
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}
