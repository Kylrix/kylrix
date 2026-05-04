// Task Management Types for Kylrix Flow

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked' | 'cancelled';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type ViewMode = 'list' | 'board' | 'calendar' | 'timeline' | 'matrix';

export interface Label {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
  completedAt?: Date;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
  updatedAt?: Date;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

export interface Reminder {
  id: string;
  time: Date;
  type: 'notification' | 'email' | 'sms';
  sent: boolean;
}

export interface Recurrence {
  type: RecurrenceType;
  interval: number;
  endDate?: Date;
  endAfterOccurrences?: number;
  daysOfWeek?: number[]; // 0 = Sunday, 6 = Saturday
  dayOfMonth?: number;
  monthOfYear?: number;
}

export interface TimeEntry {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  description?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  projectId?: string | null;
  parentTaskId?: string | null;
  labels: string[];
  subtasks: Subtask[];
  comments: Comment[];
  attachments: Attachment[];
  reminders: Reminder[];
  timeEntries: TimeEntry[];
  assigneeIds: string[];
  creatorId: string;
  dueDate?: Date;
  startDate?: Date;
  estimatedTime?: number; // in minutes
  actualTime?: number; // in minutes
  recurrence?: Recurrence;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  position: number; // for ordering
  isArchived: boolean;
  // Ecosystem integration fields
  linkedNotes?: string[]; // Kylrix Note integration
  linkedEvents?: string[]; // KylrixEvents integration
  linkedMeetings?: string[]; // KylrixMeet integration
  linkedCalendarEvents?: string[]; // KylrixCal integration
}

export type CollaboratorPermission = 'read' | 'write' | 'admin';

export interface TaskCollaborator {
  id: string;
  taskId: string;
  userId: string;
  permission: CollaboratorPermission;
  invitedAt: Date | null;
  accepted: boolean | null;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  ownerId: string;
  memberIds: string[];
  isArchived: boolean;
  isFavorite: boolean;
  defaultView: ViewMode;
  createdAt: Date;
  updatedAt: Date;
  position: number;
  settings: ProjectSettings;
}

export interface ProjectSettings {
  defaultPriority: Priority;
  allowSubtasks: boolean;
  allowTimeTracking: boolean;
  allowRecurrence: boolean;
  showCompletedTasks: boolean;
  autoArchiveCompletedAfterDays?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'member' | 'guest';
  settings: UserSettings;
  createdAt: Date;
}

export interface UserSettings {
  defaultView: ViewMode;
  theme: 'light' | 'dark' | 'system';
  startOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  reminders: boolean;
  mentions: boolean;
  taskAssigned: boolean;
  taskCompleted: boolean;
  projectUpdates: boolean;
}

export interface IntegrationSettings {
  kylrixnote: {
    enabled: boolean;
    autoLinkNotes: boolean;
  };
  kylrixmeet: {
    enabled: boolean;
    createTasksFromMeetings: boolean;
  };
  kylrixevents: {
    enabled: boolean;
    syncEvents: boolean;
  };
  kylrixcal: {
    enabled: boolean;
    showTasksInCalendar: boolean;
  };
  kylrixpass: {
    enabled: boolean;
  };
  kylrixauth: {
    enabled: boolean;
    twoFactorEnabled: boolean;
  };
}

// Filter and Sort Types
export interface TaskFilter {
  status?: TaskStatus[];
  priority?: Priority[];
  projectId?: string | null;
  labels?: string[];
  assigneeIds?: string[];
  dueDate?: {
    from?: Date;
    to?: Date;
  };
  search?: string;
  showCompleted?: boolean;
  showArchived?: boolean;
}

export type SortField = 'dueDate' | 'priority' | 'createdAt' | 'updatedAt' | 'title' | 'status' | 'position';
export type SortDirection = 'asc' | 'desc';

export interface TaskSort {
  field: SortField;
  direction: SortDirection;
}

// Quick Action Types
export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  shortcut?: string;
}

// Stats Types
export interface TaskStats {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  dueTomorrow: number;
  dueThisWeek: number;
  inProgress: number;
  blocked: number;
  byPriority: Record<Priority, number>;
  byProject: Record<string, number>;
  byLabel: Record<string, number>;
  completionRate: number;
  averageCompletionTime: number; // in hours
}

// Kanban Board Types
export interface KanbanColumn {
  id: string;
  title: string;
  status: TaskStatus;
  taskIds: string[];
  color?: string;
  limit?: number;
}

export interface KanbanBoard {
  columns: KanbanColumn[];
  columnOrder: string[];
}

// Timeline Types
export interface TimelineEntry {
  id: string;
  taskId: string;
  type: 'created' | 'updated' | 'completed' | 'commented' | 'moved' | 'assigned';
  description: string;
  userId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Eisenhower Matrix Types
export interface MatrixQuadrant {
  id: 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';
  title: string;
  description: string;
  color: string;
  taskIds: string[];
}

// Productivity Metrics
export interface ProductivityMetrics {
  date: Date;
  tasksCompleted: number;
  timeTracked: number; // in minutes
  focusScore: number; // 0-100
  streakDays: number;
}

// Workspace/Team Types (for future multi-workspace support)
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberIds: string[];
  projects: string[];
  settings: WorkspaceSettings;
  createdAt: Date;
}

export interface WorkspaceSettings {
  defaultProject?: string;
  requireTimeTracking: boolean;
  allowGuestAccess: boolean;
  maxMembers?: number;
}

// Template Types
export interface TaskTemplate {
  id: string;
  name: string;
  description?: string;
  task: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>;
  creatorId: string;
  isPublic: boolean;
  createdAt: Date;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  project: Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>;
  defaultTasks: TaskTemplate[];
  creatorId: string;
  isPublic: boolean;
  createdAt: Date;
}

// Event Management Types (Luma-style)
export interface Event {
  id: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  location?: string | null;
  url?: string | null;
  coverImage?: string | null;
  attendees: string[]; // User IDs
  isPublic: boolean;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[] | null;
}

// Focus Mode Types
export interface FocusSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // planned duration in minutes
  actualDuration?: number; // actual duration in minutes
  taskId?: string;
  status: 'active' | 'completed' | 'interrupted';
  notes?: string;
}
