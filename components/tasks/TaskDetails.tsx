'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Priority, TaskStatus, TaskCollaborator, CollaboratorPermission } from '@/types';
import { Query } from 'appwrite';
import { notes as noteApi } from '@/lib/kylrixflow';
import { 
  X, 
  Flag, 
  Calendar, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  FileText, 
  Send, 
  ArrowLeft, 
  Globe,
  Tag as TagIcon,
  MessageSquare,
  Activity,
  RefreshCw,
  Check,
  Copy,
  Clock
} from 'lucide-react';
import {
  initGoalDiscussion,
  getResourceCollaborators,
  listThreadMessages,
  postThreadMessage,
  getOrCreateThread,
} from '@/lib/actions/client-ops';
import { toLocalDateInputString } from '@/lib/utils';
import { formatNoteCreatedDate } from '@/lib/date-utils';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { goalPendingKey } from '@/lib/sync/goal-keys';
import { useLayout } from '@/context/LayoutContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { exportToMarkdown, exportToPDF } from '@/lib/utils/export';
import { KylrixWYSIWYGEditor } from '@/components/editor/KylrixWYSIWYGEditor';
import { useTask } from '@/context/TaskContext';
import { useAI } from '@/hooks/useAI';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { usePresence } from '@/components/providers/PresenceProvider';
import { useToast } from '@/components/ui/Toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { IdentityAvatar } from '@/components/IdentityBadge';
import ProjectLinker from '@/components/projects/ProjectLinker';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { MILESTONES_UPGRADE_LABEL } from '@/lib/agentic/access';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import {
  Drawer,
  Box,
  Typography,
  Stack,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  alpha} from '@/lib/openbricks/primitives';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { autonomicSyncEngine } from '@/lib/services/sync-engine';
import { loadDiscussionComments as loadDiscussionComments_ext } from './TaskDetailsSections/loadDiscussionComments';
import { handleSendMessage as handleSendMessage_ext } from './TaskDetailsSections/handleSendMessage';
import { TaskDetailsView } from './TaskDetailsSections/TaskDetailsView';



const priorityColors: Record<Priority, string> = {
  low: '#A1A1AA',
  medium: '#14B8A6',
  high: '#F59E0B',
  urgent: '#EF4444'};

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled'};

interface TaskDetailsProps {
  taskId: string;
  onBack?: () => void;
}

export default function TaskDetails({ taskId, onBack }: TaskDetailsProps) {
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { closeSecondarySidebar} = useLayout();

  const { closeSidebar } = useDynamicSidebar();
  const { activeWorkspace, workspaces } = useWorkspace();
  const { closeOverlay } = useOverlay();

  const handleClose = () => {
    if (onBack) {
      onBack();
      return;
    }
    closeSidebar();
    closeOverlay();
    closeSecondarySidebar();
  };
  const { joinResource} = usePresence();

  useEffect(() => {
    if (taskId) {
      const unsub = joinResource(
        APPWRITE_CONFIG.DATABASES.FLOW,
        APPWRITE_CONFIG.TABLES.FLOW.TASKS,
        taskId
      );
      return () => {
        if (typeof unsub === 'function') unsub();
        autonomicSyncEngine.flushImmediately();
      };
    }
  }, [taskId, joinResource]);

  const {
    tasks,
    updateTask,
    completeTask,
    pushLiveGoal,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    projects,
    labels} = useTask();

  const task = React.useMemo(() => {
    const current = tasks.find((t) => t.id === taskId);
    if (!current) return null;

    const childSubtasks = tasks
      .filter((candidate) => candidate.parentTaskId === taskId)
      .map((child) => ({
        id: child.id,
        title: child.title,
        completed: child.status === 'done',
        createdAt: child.createdAt,
        completedAt: child.status === 'done' ? child.completedAt : undefined}));

    return {
      ...current,
      subtasks: [...(current.subtasks || []), ...childSubtasks]};
  }, [tasks, taskId]);

  const { openProUpgrade } = useProUpgrade();
  const { currentTier } = useSubscription();
  const isPaid = hasPaidKylrixPlan(user) || currentTier === 'PRO' || currentTier === 'TEAMS' || currentTier === 'ORG' || currentTier === 'LIFETIME';

  const requirePaidMilestones = useCallback(() => {
    if (isPaid) return true;
    openProUpgrade(MILESTONES_UPGRADE_LABEL);
    return false;
  }, [isPaid, openProUpgrade]);

  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [noteQuery, _setNoteQuery] = useState('');
  const [_noteResults, setNoteResults] = useState<any[]>([]);
  const [_isSearchingNotes, setIsSearchingNotes] = useState(false);
  const [_linkedNoteTitles, setLinkedNoteTitles] = useState<Record<string, string>>({});
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, _setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [_taskParticipantProfiles, setTaskParticipantProfiles] = useState<any[]>([]);
  const [_isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [_taskCollaboratorRows, _setTaskCollaboratorRows] = useState<TaskCollaborator[]>([]);
  const [,] = useState<any[]>([]);
  const [showProjectLinker, setShowProjectLinker] = useState(false);
  const [, _setPendingCollaboratorPermission] = useState<CollaboratorPermission>('write');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const { ecosystemTags, refreshEcosystemTags } = useTask();

  // High-Fidelity Discussion State & Effects
  const { showSuccess, showError } = useToast();
  const [huddleMessages, setHuddleMessages] = useState<any[]>([]);
  const [huddleLoading, setHuddleLoading] = useState(false);
  const [huddleSending, setHuddleSending] = useState(false);
  const huddleMessageEndRef = React.useRef<HTMLDivElement>(null);

  const discussionNoteId = (task as any)?.primaryThreadId || task?.discussionId;

  // Load canonical thread messages (legacy discussionId notes bridged via ThreadService)
  React.useEffect(() => {
    if (!discussionNoteId && !task?.id) return;
    let active = true;
    setHuddleLoading(true);

    const loadDiscussionComments = (..._args: any[]) => loadDiscussionComments_ext({ _isLoadingAssignees, _isSearchingNotes, _linkedNoteTitles, _noteResults, _setIsEditingDescription, _setNoteQuery, _setTaskCollaboratorRows, _taskCollaboratorRows, _taskParticipantProfiles, completedSubtasks, discussionNoteId, editDescription, editTitle, handleAddSubtask, handleClose, handleInitDiscussion, handlePriorityChange, handleSaveEditTitle, handleSendMessage, handleStartEditTitle, handleStatusChange, huddleLoading, huddleMessageEndRef, huddleMessages, huddleSending, isEditingDescription, isEditingTitle, isExportOpen, isPaid, isPriorityOpen, isStatusOpen, isTagSelectorOpen, loadDiscussionComments, matchedWorkspace, newComment, newSubtask, noteQuery, requirePaidMilestones, setEditDescription, setEditTitle, setHuddleLoading, setHuddleMessages, setHuddleSending, setIsEditingTitle, setIsExportOpen, setIsLoadingAssignees, setIsPriorityOpen, setIsSearchingNotes, setIsStatusOpen, setIsTagSelectorOpen, setLinkedNoteTitles, setNewComment, setNewSubtask, setNoteResults, setShowProjectLinker, setTaskParticipantProfiles, showProjectLinker, subtaskProgress, task, taskLabels });

    loadDiscussionComments();
    return () => {
      active = false;
    };
  }, [discussionNoteId, task?.id, task?.discussionId, task?.title, user, (task as any)?.primaryThreadId]);

  React.useEffect(() => {
    huddleMessageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [huddleMessages]);

  React.useEffect(() => {
    if (task?.id) {
      autonomicSyncEngine.requestObjectFreshness('goal', task.id, (refreshedGoal) => {
        pushLiveGoal(refreshedGoal, { pending: false });
      });
    }
  }, [task?.id, pushLiveGoal]);

  const handleInitDiscussion = async () => {
    if (!task) return;
    setHuddleLoading(true);
    try {
      await initGoalDiscussion(task.id);
      showSuccess('Goal discussion ready');
    } catch (err) {
      console.error('Failed to init discussion:', err);
      showError('Failed to initialize discussion.');
    } finally {
      setHuddleLoading(false);
    }
  };

  const handleSendMessage = (..._args: any[]) => handleSendMessage_ext({ _isLoadingAssignees, _isSearchingNotes, _linkedNoteTitles, _noteResults, _setIsEditingDescription, _setNoteQuery, _setTaskCollaboratorRows, _taskCollaboratorRows, _taskParticipantProfiles, completedSubtasks, discussionNoteId, editDescription, editTitle, handleAddSubtask, handleClose, handleInitDiscussion, handlePriorityChange, handleSaveEditTitle, handleSendMessage, handleStartEditTitle, handleStatusChange, huddleLoading, huddleMessageEndRef, huddleMessages, huddleSending, isEditingDescription, isEditingTitle, isExportOpen, isPaid, isPriorityOpen, isStatusOpen, isTagSelectorOpen, loadDiscussionComments, matchedWorkspace, newComment, newSubtask, noteQuery, requirePaidMilestones, setEditDescription, setEditTitle, setHuddleLoading, setHuddleMessages, setHuddleSending, setIsEditingTitle, setIsExportOpen, setIsLoadingAssignees, setIsPriorityOpen, setIsSearchingNotes, setIsStatusOpen, setIsTagSelectorOpen, setLinkedNoteTitles, setNewComment, setNewSubtask, setNoteResults, setShowProjectLinker, setTaskParticipantProfiles, showProjectLinker, subtaskProgress, task, taskLabels });

  // AI Integration
  const { } = useAI();
  const [_isGeneratingSubtasks,] = useState(false);


  React.useEffect(() => {
    if (task) {
      if (!isEditingTitle) setEditTitle(task.title || '');
      if (!isEditingDescription) setEditDescription(task.description || '');
    }
  }, [task?.id, task?.title, task?.description, isEditingTitle, isEditingDescription]);

  const handleStartEditTitle = () => {
    const currentTask = task;
    if (!currentTask) return;
    setEditTitle(currentTask.title);
    setIsEditingTitle(true);
  };

  const handleSaveEditTitle = () => {
    // Live copy already mirrored via pushLiveGoal while typing (notes 1:1).
    setIsEditingTitle(false);
  };

  // 1:1 NoteDetailSidebar: dirty editor → pushLiveGoal (engine enqueues amber).
  useEffect(() => {
    if (!task) return;
    if (!isEditingTitle && !isEditingDescription) return;
    const nextTitle = isEditingTitle ? editTitle.trim() : task.title;
    const nextDescription = isEditingDescription
      ? editDescription.trim()
      : (task.description || '');
    if (
      nextTitle === task.title &&
      nextDescription === (task.description || '')
    ) {
      return;
    }
    if (!nextTitle) return;
    pushLiveGoal({
      ...task,
      title: nextTitle,
      description: nextDescription || undefined,
      updatedAt: new Date()});
  }, [
    editTitle,
    editDescription,
    isEditingTitle,
    isEditingDescription,
    task,
    pushLiveGoal,
  ]);

  const handleAddSubtask = async () => {
    const currentTask = task;
    if (!currentTask) return;
    if (!requirePaidMilestones()) return;
    const rawInput = newSubtask.trim();
    if (rawInput) {
      let title = rawInput.split('\n')[0].trim();
      if (title.length > 50) {
        title = title.substring(0, 50) + '...';
      }
      setNewSubtask('');
      await addSubtask(currentTask.id, title, rawInput);
    }
  };

  React.useEffect(() => {
    let active = true;

    const searchNotes = async () => {
      if (!task) return;
      if (noteQuery.trim().length < 2) {
        setNoteResults([]);
        setIsSearchingNotes(false);
        return;
      }

      setIsSearchingNotes(true);
      try {
        const res = await noteApi.list([
          Query.or([
            Query.search('searchTitle', noteQuery.trim()),
            Query.search('content', noteQuery.trim())]),
          Query.limit(6)]);
        if (!active) return;
        setNoteResults(res.rows.filter((row: any) => row.$id !== task.id));
      } catch (error) {
        console.error('Failed to search notes', error);
        if (active) setNoteResults([]);
      } finally {
        if (active) setIsSearchingNotes(false);
      }
    };

    const timer = setTimeout(searchNotes, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [noteQuery, task]);

  React.useEffect(() => {
    let active = true;
    const loadLinkedNotes = async () => {
      if (!task) return;
      const next: Record<string, string> = {};
      for (const noteId of task.linkedNotes || []) {
        try {
          const note = await noteApi.get(noteId);
          next[noteId] = note?.title || noteId;
        } catch (_error) {
          next[noteId] = noteId;
        }
      }
      if (active) setLinkedNoteTitles(next);
    };

    loadLinkedNotes();
    return () => {
      active = false;
    };
  }, [task]);

  // Fetch hydrated assignee profiles (Non-blocking background fetch)
  React.useEffect(() => {
    let active = true;
    const fetchAssigneeProfiles = async () => {
      if (!taskId) return;
      
      // Defer slightly for smooth sidebar mount
      await new Promise(resolve => setTimeout(resolve, 400));
      if (!active) return;

      setIsLoadingAssignees(true);
      try {
        const { collaborators } = await getResourceCollaborators({
          resourceId: taskId,
          resourceType: 'task'});
        if (active) setTaskParticipantProfiles(collaborators);
      } catch (err) {
        console.error('Failed to fetch assignee profiles:', err);
      } finally {
        if (active) setIsLoadingAssignees(false);
      }
    };

    fetchAssigneeProfiles();
    return () => { active = false; };
  }, [taskId]);

  const matchedWorkspace = useMemo(() => {
    if (task?.projectId) {
      const found = workspaces.find((w) => w.id === task.projectId);
      if (found) return found.title;
    }
    const foundProject = projects.find((p) => p.id === task?.projectId);
    if (foundProject?.name) return foundProject.name;
    return activeWorkspace.title;
  }, [task?.projectId, workspaces, projects, activeWorkspace.title]);
  
  const taskLabels = useMemo(() => {
    if (!task) return [];
    const known = labels.filter((label) => task.labels.includes(label.name));
    const knownNames = new Set(known.map((label) => label.name));
    const orphans = task.labels
      .filter((name) => !knownNames.has(name))
      .map((name) => ({ id: name, name, color: '#9B9691' }));
    return [...known, ...orphans];
  }, [labels, task]);

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-4 bg-[#161412] text-[#9B9691] font-satoshi">
        <h3 className="text-lg font-extrabold font-clash text-[#F5F2ED] tracking-tight uppercase">Goal details unavailable</h3>
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 border border-[#34322F] hover:border-white/20 text-[#F5F2ED] rounded-xl hover:bg-white/5 transition-all font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const subtaskProgress = task.subtasks.length > 0
    ? (completedSubtasks / task.subtasks.length) * 100
    : 0;

  const handleStatusChange = (status: TaskStatus) => {
    updateTask(task.id, { status });
    setIsStatusOpen(false);
  };

  const handlePriorityChange = (priority: Priority) => {
    updateTask(task.id, { priority });
    setIsPriorityOpen(false);
  };




  return <TaskDetailsView {...({ _isLoadingAssignees, _isSearchingNotes, _linkedNoteTitles, _noteResults, _setIsEditingDescription, _setNoteQuery, _setTaskCollaboratorRows, _taskCollaboratorRows, _taskParticipantProfiles, active, childSubtasks, completedSubtasks, current, currentTask, discussionNoteId, editDescription, editTitle, fetchAssigneeProfiles, found, foundProject, handleAddSubtask, handleClose, handleInitDiscussion, handlePriorityChange, handleSaveEditTitle, handleSendMessage, handleStartEditTitle, handleStatusChange, huddleLoading, huddleMessageEndRef, huddleMessages, huddleSending, isEditingDescription, isEditingTitle, isExportOpen, isPaid, isPriorityOpen, isStatusOpen, isTagSelectorOpen, known, knownNames, loadDiscussionComments, loadLinkedNotes, matchedWorkspace, newComment, newSubtask, nextDescription, nextTitle, note, noteQuery, onBack, orphans, rawInput, requirePaidMilestones, res, searchNotes, setEditDescription, setEditTitle, setHuddleLoading, setHuddleMessages, setHuddleSending, setIsEditingTitle, setIsExportOpen, setIsLoadingAssignees, setIsPriorityOpen, setIsSearchingNotes, setIsStatusOpen, setIsTagSelectorOpen, setLinkedNoteTitles, setNewComment, setNewSubtask, setNoteResults, setShowProjectLinker, setTaskParticipantProfiles, showProjectLinker, subtaskProgress, task, taskId, taskLabels, timer, title, unsub })} />;
}
