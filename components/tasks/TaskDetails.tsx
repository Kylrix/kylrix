'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Video, 
  Send, 
  ArrowLeft, 
  Globe,
  Tag as TagIcon,
  MessageSquare,
  Activity,
  Mic,
  Square,
  RefreshCw,
  MoreVertical,
  ChevronRight,
  Copy
} from 'lucide-react';
import { 
  createGhostNoteForResource, 
  promoteGhostResourceThreadToStory,
  initGoalDiscussion,
  getResourceCollaborators,
} from '@/lib/actions/client-ops';
import { createComment, listComments, getNote } from '@/lib/appwrite/note';
import { formatNoteCreatedDate } from '@/lib/date-utils';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useLayout } from '@/context/LayoutContext';
import { exportToMarkdown, exportToPDF } from '@/lib/utils/export';
import { useTask } from '@/context/TaskContext';
import { useAI } from '@/hooks/useAI';
import { client } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { usePresence } from '@/components/providers/PresenceProvider';
import { useToast } from '@/components/ui/Toast';
import { AppwriteService } from '@/lib/appwrite';
import { IdentityAvatar } from '@/components/IdentityBadge';
import ProjectLinker from '@/components/projects/ProjectLinker';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
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
  alpha,
} from '@/lib/openbricks/primitives';

const priorityColors: Record<Priority, string> = {
  low: '#A1A1AA',
  medium: '#14B8A6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};

interface TaskDetailsProps {
  taskId: string;
  onBack?: () => void;
}

export default function TaskDetails({ taskId, onBack }: TaskDetailsProps) {
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { closeSecondarySidebar } = useLayout();

  const handleClose = () => {
    if (onBack) {
      onBack();
    } else {
      closeSecondarySidebar();
    }
  };
  const { joinResource, resourcePresence } = usePresence();

  useEffect(() => {
      if (taskId) {
          return joinResource(
              APPWRITE_CONFIG.DATABASES.FLOW,
              APPWRITE_CONFIG.TABLES.FLOW.TASKS,
              taskId
          );
      }
  }, [taskId, joinResource]);

  const {
    tasks,
    updateTask,
    completeTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    addTaskCollaborator,
    updateTaskCollaborator,
    deleteTaskCollaborator,
    projects,
    labels,
  } = useTask();

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
        completedAt: child.status === 'done' ? child.completedAt : undefined,
      }));

    return {
      ...current,
      subtasks: [...(current.subtasks || []), ...childSubtasks],
    };
  }, [tasks, taskId]);

  const { openProUpgrade } = useProUpgrade();
  const { currentTier } = useSubscription();
  const isPaid = currentTier === 'PRO' || currentTier === 'TEAMS' || currentTier === 'ORG' || currentTier === 'LIFETIME';

  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [noteQuery, setNoteQuery] = useState('');
  const [noteResults, setNoteResults] = useState<any[]>([]);
  const [isSearchingNotes, setIsSearchingNotes] = useState(false);
  const [linkedNoteTitles, setLinkedNoteTitles] = useState<Record<string, string>>({});
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [taskParticipantProfiles, setTaskParticipantProfiles] = useState<any[]>([]);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [taskCollaboratorRows, setTaskCollaboratorRows] = useState<TaskCollaborator[]>([]);
  const [pendingCollaborators, setPendingCollaborators] = useState<any[]>([]);
  const [showProjectLinker, setShowProjectLinker] = useState(false);
  const [pendingCollaboratorPermission, setPendingCollaboratorPermission] = useState<CollaboratorPermission>('write');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTagSelectorOpen, setIsTagSelectorOpen] = useState(false);
  const { ecosystemTags, refreshEcosystemTags } = useTask();

  // High-Fidelity Discussion State & Effects
  const { showSuccess, showError } = useToast();
  const [huddleMessages, setHuddleMessages] = useState<any[]>([]);
  const [huddleLoading, setHuddleLoading] = useState(false);
  const [huddleSending, setHuddleSending] = useState(false);
  const huddleMessageEndRef = React.useRef<HTMLDivElement>(null);

  const discussionNoteId = task?.discussionId;

  // Load comments and subscribe to Appwrite comments
  React.useEffect(() => {
    if (!discussionNoteId) return;
    let active = true;
    setHuddleLoading(true);

    const loadDiscussionComments = async () => {
      try {
        const res = await listComments(discussionNoteId);
        if (!active) return;
        const msgs = await Promise.all(
          res.rows.map(async (row: any) => {
            let senderName = 'Collaborator';
            let senderAvatar: string | null = null;
            if (user && row.userId === user.$id) {
              senderName = user.name || 'You';
            } else {
              try {
                const profile = await AppwriteService.getProfile(row.userId);
                if (profile) {
                    senderName = profile.name || 'Collaborator';
                    senderAvatar = profile.avatar || profile.profilePicId || null;
                }
              } catch {}
            }
            return {
              id: row.$id,
              senderId: row.userId,
              senderName,
              senderAvatar,
              content: row.content,
              timestamp: new Date(row.createdAt).getTime(),
            };
          })
        );

        msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
        setHuddleMessages(msgs);
      } catch (err) {
        console.error('Failed to load discussion comments:', err);
      } finally {
        if (active) setHuddleLoading(false);
      }
    };

    loadDiscussionComments();

    const unsubscribe = client.subscribe(
      `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.comments.documents`,
      async (response: any) => {
        if (!active) return;
        const events = response.events;
        const payload = response.payload;

        if (events.some((e: string) => e.includes('.create')) && payload.noteId === discussionNoteId) {
          let senderName = 'Collaborator';
          let senderAvatar: string | null = null;
          if (user && payload.userId === user.$id) {
            senderName = user.name || 'You';
          } else {
            try {
              const profile = await AppwriteService.getProfile(payload.userId);
              if (profile) {
                senderName = profile.name || 'Collaborator';
                senderAvatar = profile.avatar || profile.profilePicId || null;
              }
            } catch {}
          }
          const msg = {
            id: payload.$id,
            senderId: payload.userId,
            senderName,
            senderAvatar,
            content: payload.content,
            timestamp: new Date(payload.createdAt).getTime(),
          };
          setHuddleMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
          });
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [discussionNoteId, user]);

  React.useEffect(() => {
    huddleMessageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [huddleMessages]);

  const handleInitDiscussion = async () => {
    if (!task) return;
    setHuddleLoading(true);
    try {
      await initGoalDiscussion(task.id);
      showSuccess('Goal discussion initialized!');
    } catch (err) {
      console.error('Failed to init discussion:', err);
      showError('Failed to initialize discussion.');
    } finally {
      setHuddleLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || huddleSending || !discussionNoteId) return;
    if (!isPaid) {
      openProUpgrade('Discussions');
      return;
    }
    setHuddleSending(true);
    try {
      await createComment(discussionNoteId, newComment.trim());
      setNewComment('');
    } catch (err) {
      console.error('Failed to send comment:', err);
      showError('Failed to send message.');
    } finally {
      setHuddleSending(false);
    }
  };

  // AI Integration
  const { generate } = useAI();
  const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false);

  const handleGenerateSubtasks = async () => {
    const currentTask = task;
    if (!currentTask?.title) return;
    setIsGeneratingSubtasks(true);
    try {
      const prompt = `You are a Project Manager. The user wants to '${currentTask.title}'. Generate a JSON array of 5 concrete, actionable sub-tasks. Return ONLY the JSON array of strings.`;
      const result = await generate(prompt);
      const text = typeof result === 'string' ? result : (result as any).text;
      // Clean up markdown code blocks if present
      const jsonString = text.replace(/```json\n|\n```/g, '').replace(/```/g, '');
      const subtasks = JSON.parse(jsonString);
      
      if (Array.isArray(subtasks)) {
        await Promise.all(
          subtasks
            .filter((st: unknown) => typeof st === 'string')
            .map((st: string) => addSubtask(currentTask.id, st))
        );
      }
    } catch (error: unknown) {
      console.error("Failed to generate subtasks", error);
    } finally {
      setIsGeneratingSubtasks(false);
    }
  };

  const handleStartEditTitle = () => {
    const currentTask = task;
    if (!currentTask) return;
    setEditTitle(currentTask.title);
    setIsEditingTitle(true);
  };

  const handleSaveEditTitle = () => {
    const currentTask = task;
    if (!currentTask) return;
    if (editTitle.trim() && editTitle.trim() !== currentTask.title) {
      updateTask(currentTask.id, {
        title: editTitle.trim(),
      });
    }
    setIsEditingTitle(false);
  };

  const handleStartEditDescription = () => {
    const currentTask = task;
    if (!currentTask) return;
    setEditDescription(currentTask.description || '');
    setIsEditingDescription(true);
  };

  const handleSaveEditDescription = () => {
    const currentTask = task;
    if (!currentTask) return;
    updateTask(currentTask.id, {
      description: editDescription.trim() || undefined,
    });
    setIsEditingDescription(false);
  };

  const handleAddSubtask = async () => {
    const currentTask = task;
    if (!currentTask) return;
    if (newSubtask.trim()) {
      await addSubtask(currentTask.id, newSubtask.trim());
      setNewSubtask('');
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
          resourceType: 'task',
        });
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

  const project = projects.find((p) => p.id === task?.projectId);
  
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

  const handleAddCollaborators = async () => {
    if (!task || pendingCollaborators.length === 0) return;
    await Promise.all(
      pendingCollaborators.map((user) =>
        addTaskCollaborator(task.id, user.id, pendingCollaboratorPermission)
      )
    );
    setPendingCollaborators([]);
  };

  const handleCollaboratorPermissionChange = async (collaboratorId: string, permission: CollaboratorPermission) => {
    if (!task) return;
    await updateTaskCollaborator(task.id, collaboratorId, permission);
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!task) return;
    await deleteTaskCollaborator(task.id, collaboratorId);
  };

  return (
    <div className="flex flex-col h-full bg-[#161412] text-[#F5F2ED] font-satoshi relative overflow-hidden">
      {/* Ambient radial gradient spotlight */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(168,85,247,0.12),transparent_60%)] pointer-events-none" />

      {/* Header - Sticky/Fixed at Top */}
      <div className="relative z-20 flex flex-col gap-3 p-5 md:p-6 border-b border-white/5 bg-[#161412]/60 backdrop-blur-md shrink-0">
        {/* Row 1: Title & Close Action Buttons */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="p-2 text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-colors flex-shrink-0 md:hidden"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            {isEditingTitle ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleSaveEditTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveEditTitle()}
                autoFocus
                className="w-full bg-transparent border-0 outline-none text-base md:text-lg font-extrabold font-clash text-white tracking-tight uppercase border-b border-white/10 focus:border-[#A855F7] transition-all py-0.5"
              />
            ) : (
              <h2
                onClick={handleStartEditTitle}
                className="text-base md:text-lg font-extrabold font-clash text-[#A855F7] tracking-tight uppercase flex-1 min-w-0 break-words [overflow-wrap:anywhere] cursor-pointer hover:text-[#b975ff] transition-colors"
              >
                {task.title}
              </h2>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowProjectLinker(true)}
              className="p-2 text-[#A855F7] hover:text-white rounded-xl bg-[#A855F7]/10 hover:bg-[#A855F7]/20 transition-all"
              title="Link Project"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleStartEditTitle}
              className="p-2 text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-all"
              title="Edit Title"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="p-2 text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-all"
                title="Export Goal"
              >
                <FileText className="w-4 h-4" />
              </button>
              {isExportOpen && (
                <>
                  <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsExportOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-[#161412] border border-[#34322F] shadow-2xl p-1 z-50 font-satoshi flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportOpen(false);
                        exportToMarkdown(task.title, task.description || '');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors text-[#F5F2ED] hover:bg-white/5"
                    >
                      Export as Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportOpen(false);
                        exportToPDF(task.title, task.description || '');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors text-[#F5F2ED] hover:bg-white/5"
                    >
                      Export as PDF
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                openUnified('delete-confirm', {
                  title: 'Delete Goal?',
                  description: `Are you sure you want to permanently delete "${task.title}"?`,
                  onConfirm: async () => {
                    await deleteTask(task.id);
                    handleClose();
                  }
                });
              }}
              className="p-2 text-[#9B9691] hover:text-red-400 rounded-xl hover:bg-white/5 transition-all"
              title="Delete Goal"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {!onBack && (
              <button
                type="button"
                onClick={handleClose}
                className="p-2 text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-all"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Status & Priority Dropdowns */}
        <div className="flex items-center gap-2.5">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsStatusOpen(!isStatusOpen);
                setIsPriorityOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1A18] border border-[#34322F] text-[10px] font-bold text-[#F5F2ED] rounded-xl hover:border-white/20 transition-colors uppercase tracking-wider font-mono"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]" />
              <span>Status: {statusLabels[task.status]}</span>
            </button>
            {isStatusOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsStatusOpen(false)} />
                <div className="absolute left-0 mt-1 w-44 rounded-2xl bg-[#161412] border border-[#34322F] shadow-2xl p-1 z-50 font-satoshi flex flex-col gap-0.5">
                  {Object.entries(statusLabels).map(([status, label]) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusChange(status as TaskStatus)}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                        task.status === status
                          ? 'bg-[#A855F7] text-[#0A0908]'
                          : 'text-[#F5F2ED] hover:bg-white/5'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsPriorityOpen(!isPriorityOpen);
                setIsStatusOpen(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1A18] border border-[#34322F] text-[10px] font-bold rounded-xl hover:border-white/20 transition-colors uppercase tracking-wider font-mono"
              style={{ color: priorityColors[task.priority] }}
            >
              <Flag className="w-3.5 h-3.5" style={{ color: priorityColors[task.priority] }} />
              <span>Priority: {task.priority}</span>
            </button>
            {isPriorityOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsPriorityOpen(false)} />
                <div className="absolute left-0 mt-1 w-44 rounded-2xl bg-[#161412] border border-[#34322F] shadow-2xl p-1 z-50 font-satoshi flex flex-col gap-0.5">
                  {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePriorityChange(p)}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 ${
                        task.priority === p
                          ? 'bg-[#A855F7] text-[#0A0908]'
                          : 'text-[#F5F2ED] hover:bg-white/5'
                      }`}
                    >
                      <Flag className="w-3 h-3" style={{ color: priorityColors[p] }} />
                      <span>{p.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Area - Scrollable */}
      <div className="relative z-10 flex-1 overflow-y-auto p-5 md:p-6 space-y-6 scrollbar-thin">
        {/* Objective Details Box */}
        <div className="p-5 rounded-[28px] bg-[#0A0908] border border-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.4)] flex flex-col">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider font-mono">Objective details</span>
            {task.description && !isEditingDescription && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(task.description || '');
                  showSuccess('Copied', 'Objective details copied to clipboard');
                }}
                className="p-1.5 rounded-lg text-[#9B9691] hover:text-white hover:bg-white/5 transition-colors"
                title="Copy details"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="min-h-[100px] md:min-h-[140px] flex">
            {isEditingDescription ? (
              <textarea
                rows={5}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                onBlur={handleSaveEditDescription}
                className="w-full bg-transparent border-0 outline-none text-sm text-[#F5F2ED]/90 leading-relaxed resize-none focus:ring-0 focus:outline-none"
                placeholder="Provide detailed parameters for this goal..."
                autoFocus
              />
            ) : (
              <p
                onClick={handleStartEditDescription}
                className="text-sm text-[#9B9691] leading-relaxed font-satoshi whitespace-pre-wrap cursor-text w-full"
              >
                {task.description || 'No detailed parameters provided. Click to add.'}
              </p>
            )}
          </div>
        </div>

        {/* Execution Track Box */}
        <div className="p-5 rounded-[28px] bg-[#0A0908] border border-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider font-mono">Execution Track</span>
            <span className="text-xs font-bold text-[#9B9691] font-mono">{completedSubtasks} / {task.subtasks.length}</span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full mb-4 overflow-hidden">
            <div className="h-full bg-[#A855F7] transition-all duration-500" style={{ width: `${subtaskProgress}%` }} />
          </div>

          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {task.subtasks.length === 0 ? (
              <div className="text-xs text-white/30 italic py-2">No sub-tasks yet.</div>
            ) : (
              task.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-start gap-3 py-1 group">
                  <input
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={() => toggleSubtask(task.id, subtask.id)}
                    className="w-4 h-4 mt-0.5 rounded border-[#34322F] bg-transparent text-[#A855F7] focus:ring-0 focus:ring-offset-0 focus:outline-none cursor-pointer shrink-0"
                  />
                  <span className={`text-sm flex-1 min-w-0 break-words [overflow-wrap:anywhere] ${subtask.completed ? 'text-[#9B9691] line-through' : 'text-[#F5F2ED]'}`}>
                    {subtask.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteSubtask(task.id, subtask.id)}
                    className="text-[#9B9691] hover:text-red-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Sub-task Bar */}
          <div className="flex gap-2 mt-4 p-1 bg-white/[0.02] rounded-xl border border-white/5 items-center">
            <input
              type="text"
              placeholder="Add sub-task..."
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              className="w-full bg-transparent border-0 outline-none px-3 py-1.5 text-xs text-[#F5F2ED] focus:ring-0 focus:outline-none font-satoshi"
            />
            <button
              type="button"
              onClick={handleGenerateSubtasks}
              disabled={isGeneratingSubtasks}
              className="p-1.5 text-[#A855F7] hover:text-white rounded-lg hover:bg-[#A855F7]/10 transition-colors flex shrink-0"
              title="AI Autocomplete Subtasks"
            >
              {isGeneratingSubtasks ? (
                <div className="w-4 h-4 border-2 border-[#A855F7] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Actionable Meta Grid */}
        <div className="grid grid-cols-2 gap-4 px-1">
          <div>
            <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider mb-1.5 block font-mono">Project Domain</span>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: project?.color || '#6366F1' }} />
              <span className="text-sm font-bold text-[#F5F2ED]">{project?.name || 'Inbox'}</span>
            </div>
          </div>
          <div>
            <button
              type="button"
              onClick={() => {
                setIsPriorityOpen(!isPriorityOpen);
                setIsStatusOpen(false);
              }}
              className="flex flex-col items-start gap-1 w-full text-left bg-transparent border-0 outline-none p-0 cursor-pointer group"
            >
              <span className="text-[10px] font-black text-[#A855F7] group-hover:text-[#b975ff] transition-colors uppercase tracking-wider block font-mono">Urgency Level</span>
              <div className="flex items-center gap-2 text-[#F5F2ED]">
                <Flag className="w-4 h-4" style={{ color: priorityColors[task.priority] }} />
                <span className="text-sm font-bold capitalize group-hover:underline" style={{ color: priorityColors[task.priority] }}>{task.priority}</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tags Section */}
        <div className="px-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider block font-mono">Ecosystem Tags</span>
            <button
              type="button"
              onClick={() => setIsTagSelectorOpen(true)}
              className="p-1 text-[#A855F7] hover:text-white rounded-lg hover:bg-[#A855F7]/10 transition-colors flex shrink-0"
              title="Edit Tags"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </div>
          {taskLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {taskLabels.map((label) => (
                <div 
                  key={label.name}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 text-[11px] font-bold text-white/60"
                >
                  <TagIcon size={10} style={{ color: label.color || '#9B9691' }} />
                  <span>{label.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-white/20 italic">No tags associated with this goal. Click + to add tags.</div>
          )}
        </div>

        {/* Discussion Section */}
        <div className="p-5 rounded-[28px] bg-[#0A0908] border border-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.4)]">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-[#A855F7]" />
                <span className="text-[10px] font-black text-[#A855F7] uppercase tracking-wider font-mono">Goal Discussion</span>
            </div>
            {discussionNoteId && (
                <div className="flex items-center gap-1.5 text-[9px] font-black text-[#10B981] uppercase tracking-[0.15em] font-mono">
                    <Activity size={10} className="animate-pulse" />
                    <span>Live Secure Channel</span>
                </div>
            )}
          </div>

          {!discussionNoteId ? (
            <div className="py-6 text-center">
              <Globe className="w-6 h-6 text-white/10 mx-auto mb-3" />
              <button
                type="button"
                onClick={handleInitDiscussion}
                disabled={huddleLoading}
                className="px-5 py-2.5 bg-[#A855F7] text-[#0A0908] font-black text-[11px] uppercase tracking-widest rounded-xl shadow-[0_8px_20px_-8px_rgba(168,85,247,0.4)] hover:bg-[#9333EA] hover:translate-y-[-1px] transition-all duration-200 font-satoshi flex items-center gap-2 mx-auto"
              >
                {huddleLoading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} strokeWidth={3} />}
                <span>Start Discussion</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {huddleLoading && !huddleMessages.length ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[#A855F7] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                  {huddleMessages.length === 0 ? (
                    <div className="text-[11px] text-white/20 font-black uppercase tracking-widest py-8 text-center flex flex-col gap-2">
                        <MessageSquare size={20} className="mx-auto opacity-10" />
                        No parameters defined yet.
                    </div>
                  ) : (
                    huddleMessages.map((msg) => {
                      const isOutgoing = msg.senderId === user?.$id;
                      return (
                        <div key={msg.id} className={`flex flex-col gap-1.5 ${isOutgoing ? 'items-end' : 'items-start'}`}>
                           <div className={`flex items-center gap-2 ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}`}>
                                <IdentityAvatar
                                    fileId={msg.senderAvatar}
                                    alt={msg.senderName}
                                    fallback={msg.senderName.slice(0, 1).toUpperCase()}
                                    size={20}
                                    borderRadius="50%"
                                />
                                <span className="text-[10px] font-black text-white/30 font-mono uppercase tracking-wider">{msg.senderName}</span>
                           </div>
                           <div 
                             className={`px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed max-w-[90%] border shadow-sm transition-all hover:shadow-md ${
                               isOutgoing
                                 ? 'bg-[#161412] border-[#23211F] border-right-[3px] border-r-[#A855F7] text-white font-medium'
                                 : 'bg-[#161412] border-[#23211F] border-left-[3px] border-l-[#34322F] text-[#F5F2ED]'
                             }`}
                           >
                             {msg.content}
                           </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={huddleMessageEndRef} />
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2 mt-2 p-1.5 bg-[#1C1A18] rounded-2xl border border-white/5 items-center focus-within:border-[#A855F7]/30 transition-all">
                <input
                  type="text"
                  placeholder="Message the team..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full bg-transparent border-0 outline-none px-3 py-1.5 text-[13px] text-white font-medium placeholder:text-white/10 focus:ring-0 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={huddleSending || !newComment.trim()}
                  className={`p-2 rounded-xl transition-all shrink-0 ${
                      newComment.trim() 
                        ? 'bg-[#A855F7] text-[#0A0908] shadow-[0_4px_12px_-4px_rgba(168,85,247,0.4)]' 
                        : 'text-white/10'
                  }`}
                >
                  {huddleSending ? (
                    <RefreshCw className="animate-spin w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" strokeWidth={2.5} />
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t border-white/5">
          <span className="text-[10px] text-white/30 font-mono block">Created {formatNoteCreatedDate(task as any)}</span>
        </div>
      </div>

      {/* Project Linker Modal Integration */}
      {showProjectLinker && (
        <ProjectLinker
          open={showProjectLinker}
          onClose={() => setShowProjectLinker(false)}
          entityId={taskId}
          entityKind="goal"
          onLinked={async () => {
            // refresh projects list inside context or parent if needed
          }}
        />
      )}

      {/* Ecosystem Tags Selection Drawer */}
      {isTagSelectorOpen && (
        <Drawer
          anchor="bottom"
          open={isTagSelectorOpen}
          onClose={() => setIsTagSelectorOpen(false)}
          ModalProps={{ keepMounted: false, disablePortal: true }}
          sx={{
            zIndex: 15000,
            '& .ob-drawer-panel': {
              bgcolor: '#161412',
              backgroundImage: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(10, 9, 8, 0.02) 100%)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              maxHeight: '60vh',
              width: '100%',
              p: 3,
            },
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="between" sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <TagIcon size={20} color="#A855F7" />
              <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                Select Tags
              </Typography>
            </Stack>
            <IconButton
              onClick={() => setIsTagSelectorOpen(false)}
              sx={{
                color: '#E8E6E3',
                bgcolor: '#0A0908',
                border: '1px solid #34322F',
                '&:hover': { bgcolor: '#1C1A18' },
              }}
            >
              <X size={18} />
            </IconButton>
          </Stack>

          <Box sx={{ maxHeight: '40dvh', overflowY: 'auto', pr: 0.5 }}>
            <List sx={{ py: 0 }}>
              <ListItem disablePadding sx={{ mb: 1 }}>
                <ListItemButton 
                  onClick={() => {
                    setIsTagSelectorOpen(false);
                    openUnified('new-tag', { 
                      onSuccess: async () => {
                        await refreshEcosystemTags();
                        setIsTagSelectorOpen(true);
                      } 
                    });
                  }}
                  sx={{ 
                    borderRadius: '12px', 
                    bgcolor: alpha('#A855F7', 0.1),
                    border: `1px dashed ${alpha('#A855F7', 0.3)}`,
                    py: 1.5,
                    '&:hover': { bgcolor: alpha('#A855F7', 0.15) }
                  }}
                >
                  <Plus size={18} color="#A855F7" style={{ marginRight: '12px' }} />
                  <ListItemText 
                    primary="Create New Tag" 
                    primaryTypographyProps={{ sx: { color: '#A855F7', fontWeight: 800, fontSize: '0.9rem' } }}
                  />
                </ListItemButton>
              </ListItem>

              {ecosystemTags.map((tag) => {
                const isSelected = task.labels.includes(tag.name || '');
                const color = (tag as any).color || '#9B9691';

                return (
                  <ListItem key={tag.$id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton 
                      onClick={async () => {
                        let nextLabels = [...task.labels];
                        if (!isSelected && tag.name) {
                          nextLabels.push(tag.name);
                        } else if (isSelected && tag.name) {
                          nextLabels = nextLabels.filter(n => n !== tag.name);
                        }
                        await updateTask(task.id, { labels: nextLabels });
                      }}
                      sx={{ 
                        borderRadius: '12px', 
                        py: 1.5,
                        border: '1px solid transparent',
                        borderColor: isSelected ? color : 'transparent',
                        bgcolor: isSelected ? alpha(color, 0.1) : 'transparent',
                        '&:hover': { bgcolor: '#1C1A18' }
                      }}
                    >
                      <Box 
                        sx={{ 
                          width: 12, 
                          height: 12, 
                          borderRadius: '4px', 
                          bgcolor: color, 
                          mr: 2,
                          boxShadow: `0 0 10px ${alpha(color, 0.4)}`
                        }} 
                      />
                      <ListItemText 
                        primary={(tag.name || '').toUpperCase()} 
                        primaryTypographyProps={{ 
                          sx: { 
                            color: isSelected ? 'white' : '#9B9691', 
                            fontWeight: 900, 
                            fontSize: '0.8rem',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.05em'
                          } 
                        }}
                      />
                      {isSelected && (
                        <Typography sx={{ color: color, fontWeight: 900, fontSize: '0.7rem', opacity: 0.8 }}>
                          SELECTED
                        </Typography>
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        </Drawer>
      )}
    </div>
  );
}
