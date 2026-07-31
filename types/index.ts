// Task Management Types for Kylrix Flow

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'blocked' | 'cancelled';
type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
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

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

interface Reminder {
  id: string;
  time: Date;
  type: 'notification' | 'email' | 'sms';
  sent: boolean;
}

interface Recurrence {
  type: RecurrenceType;
  interval: number;
  endDate?: Date;
  endAfterOccurrences?: number;
  daysOfWeek?: number[]; // 0 = Sunday, 6 = Saturday
  dayOfMonth?: number;
  monthOfYear?: number;
}

interface TimeEntry {
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
  userId?: string;
  dueDate?: Date | null;
  startDate?: Date;
  estimatedTime?: number; // in minutes
  actualTime?: number; // in minutes
  recurrence?: Recurrence;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  position: number; // for ordering
  isArchived: boolean;
  isPinned: boolean;
  isPublic?: boolean;
  isGuest?: boolean;
  discussionId?: string | null;
  // Ecosystem integration fields
  linkedNotes?: string[]; // Kylrix Note integration
  linkedEvents?: string[]; // KylrixEvents integration
  linkedMeetings?: string[]; // KylrixMeet integration
  linkedCalendarEvents?: string[]; // KylrixCal integration
  scheduled?: boolean;
  /** True when Kyle (agent) created this goal rather than the user. */
  isAgentic?: boolean;
  /** Vault-lock: non-empty dek means title/description are DEK-encrypted (MEK-wrapped key). */
  dek?: string | null;
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
  isPinned: boolean;
  defaultView: ViewMode;
  createdAt: Date;
  updatedAt: Date;
  position: number;
  settings: ProjectSettings;
}

interface ProjectSettings {
  defaultPriority: Priority;
  allowSubtasks: boolean;
  allowTimeTracking: boolean;
  allowRecurrence: boolean;
  showCompletedTasks: boolean;
  autoArchiveCompletedAfterDays?: number;
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
type SortDirection = 'asc' | 'desc';

export interface TaskSort {
  field: SortField;
  direction: SortDirection;
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
  isPinned: boolean;
  isGuest?: boolean;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[] | null;
}
