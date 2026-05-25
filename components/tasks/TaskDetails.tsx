'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Avatar,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  alpha,
  CircularProgress,
  Stack,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Flag as FlagIcon,
  CalendarMonth as CalendarIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Description as NotesIcon,
  VideoCall as MeetingIcon,
  Send as SendIcon,
  AutoFixHigh as AutoFixHighIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { Query } from 'appwrite';
import { useTask } from '@/context/TaskContext';
import { Priority, TaskStatus } from '@/types';
import { useLayout } from '@/context/LayoutContext';
import { useAI } from '@/hooks/useAI';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { notes as noteApi } from '@/lib/kylrixflow';
import UserSearch from '@/components/UserSearch';
import { getResourceCollaboratorsSecure } from '@/lib/actions/secure-ops';
import { account } from '@/lib/appwrite';
import { UsersService } from '@/lib/services/users';
import { FolderKanban } from 'lucide-react';
import ProjectLinker from '@/components/projects/ProjectLinker';
import type { CollaboratorPermission, TaskCollaborator } from '@/types';
import { createGhostNoteForResource, promoteGhostResourceThreadToStory } from '@/lib/actions/client-ops';
import { createComment, listComments, getNote } from '@/lib/appwrite/note';
import { client } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { usePresence } from '@/components/providers/PresenceProvider';
import { useToast } from '@/components/ui/Toast';
import { AppwriteService } from '@/lib/appwrite';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { Clock, FileText, Globe } from 'lucide-react';

const priorityColors: Record<Priority, string> = {
  low: '#A1A1AA',
  medium: '#6366F1',
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
}

export default function TaskDetails({ taskId }: TaskDetailsProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { closeSecondarySidebar } = useLayout();
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
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addComment,
    listTaskCollaborators,
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
  const [newSubtask, setNewSubtask] = useState('');
  const [newComment, setNewComment] = useState('');
  const [noteQuery, setNoteQuery] = useState('');
  const [noteResults, setNoteResults] = useState<any[]>([]);
  const [isSearchingNotes, setIsSearchingNotes] = useState(false);
  const [linkedNoteTitles, setLinkedNoteTitles] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [statusAnchor, setStatusAnchor] = useState<null | HTMLElement>(null);
  const [priorityAnchor, setPriorityAnchor] = useState<null | HTMLElement>(null);
  const [taskParticipantProfiles, setTaskParticipantProfiles] = useState<any[]>([]);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);
  const [taskCollaboratorRows, setTaskCollaboratorRows] = useState<TaskCollaborator[]>([]);
  const [pendingCollaborators, setPendingCollaborators] = useState<any[]>([]);
  const [showProjectLinker, setShowProjectLinker] = useState(false);
  const [pendingCollaboratorPermission, setPendingCollaboratorPermission] = useState<CollaboratorPermission>('write');

  // Huddle Discussion State & Effects
  const { showSuccess, showError } = useToast();
  const [huddleMessages, setHuddleMessages] = useState<any[]>([]);
  const [huddleLoading, setHuddleLoading] = useState(false);
  const [huddleSending, setHuddleSending] = useState(false);
  const [isHuddleInit, setIsHuddleInit] = useState(false);
  const [huddleTimeRemaining, setHuddleTimeRemaining] = useState('');
  const huddleMessageEndRef = React.useRef<HTMLDivElement>(null);

  // Check if Huddle is initialized and set timer countdown
  React.useEffect(() => {
    if (!taskId) return;
    let active = true;

    const checkHuddle = async () => {
      try {
        const note = await getNote(taskId);
        if (!active) return;
        if (note && note.metadata) {
          setIsHuddleInit(true);
          const noteMeta = JSON.parse(note.metadata);
          const expiresAt = new Date(noteMeta.expiresAt).getTime();
          const updateTimer = () => {
            const diff = expiresAt - Date.now();
            if (diff <= 0) {
              setHuddleTimeRemaining('Expired');
            } else {
              const days = Math.floor(diff / (24 * 60 * 60 * 1000));
              const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
              setHuddleTimeRemaining(`${days}d ${hours}h remaining`);
            }
          };
          updateTimer();
        }
      } catch (err) {
        if (active) setIsHuddleInit(false);
      }
    };

    checkHuddle();

    return () => { active = false; };
  }, [taskId]);

  // Load comments and subscribe to Appwrite comments
  React.useEffect(() => {
    if (!taskId || !isHuddleInit) return;
    let active = true;
    setHuddleLoading(true);

    const loadHuddleComments = async () => {
      try {
        const res = await listComments(taskId);
        if (!active) return;
        const msgs = await Promise.all(
          res.rows.map(async (row: any) => {
            let senderName = 'Collaborator';
            if (user && row.userId === user.$id) {
              senderName = user.name || 'You';
            } else {
              try {
                const profile = await AppwriteService.getProfile(row.userId);
                if (profile) senderName = profile.name || 'Collaborator';
              } catch {}
            }
            return {
              id: row.$id,
              senderId: row.userId,
              senderName,
              content: row.content,
              timestamp: new Date(row.createdAt).getTime(),
            };
          })
        );

        msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
        setHuddleMessages(msgs);
      } catch (err) {
        console.error('Failed to load huddle comments:', err);
      } finally {
        if (active) setHuddleLoading(false);
      }
    };

    loadHuddleComments();

    const unsubscribe = client.subscribe(
      `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.comments.documents`,
      async (response: any) => {
        if (!active) return;
        const events = response.events;
        const payload = response.payload;

        if (events.some((e: string) => e.includes('.create')) && payload.noteId === taskId) {
          let senderName = 'Collaborator';
          if (user && payload.userId === user.$id) {
            senderName = user.name || 'You';
          } else {
            try {
              const profile = await AppwriteService.getProfile(payload.userId);
              if (profile) senderName = profile.name || 'Collaborator';
            } catch {}
          }
          const msg = {
            id: payload.$id,
            senderId: payload.userId,
            senderName,
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
  }, [taskId, isHuddleInit, user]);

  React.useEffect(() => {
    huddleMessageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [huddleMessages]);

  const handleInitHuddle = async () => {
    if (!task) return;
    setHuddleLoading(true);
    try {
      await createGhostNoteForResource(taskId, 'task', `${task.title} Discussion`);
      setIsHuddleInit(true);
      showSuccess('Discussion huddle initialized!');
    } catch (err) {
      console.error('Failed to init huddle:', err);
      showError('Failed to initialize huddle.');
    } finally {
      setHuddleLoading(false);
    }
  };

  const handleSendHuddleMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || huddleSending) return;
    setHuddleSending(true);
    try {
      await createComment(taskId, newComment.trim());
      setNewComment('');
    } catch (err) {
      console.error('Failed to send comment:', err);
      showError('Failed to send message.');
    } finally {
      setHuddleSending(false);
    }
  };

  const handleSaveHuddleAsStory = async () => {
    setHuddleLoading(true);
    try {
      await promoteGhostResourceThreadToStory(taskId, 'task');
      showSuccess('Discussion promoted to a permanent Story note!');
      setIsHuddleInit(false);
      setHuddleMessages([]);
    } catch (err) {
      console.error('Failed to save story:', err);
      showError('Failed to promote discussion.');
    } finally {
      setHuddleLoading(false);
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

  const handleStartEdit = () => {
    const currentTask = task;
    if (!currentTask) return;
    setEditTitle(currentTask.title);
    setEditDescription(currentTask.description || '');
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const currentTask = task;
    if (!currentTask) return;
    updateTask(currentTask.id, {
      title: editTitle,
      description: editDescription || undefined,
    });
    setIsEditing(false);
  };

  const handleAddSubtask = async () => {
    const currentTask = task;
    if (!currentTask) return;
    if (newSubtask.trim()) {
      await addSubtask(currentTask.id, newSubtask.trim());
      setNewSubtask('');
    }
  };

  const handleAddComment = () => {
    const currentTask = task;
    if (!currentTask) return;
    if (newComment.trim()) {
      addComment(currentTask.id, newComment.trim());
      setNewComment('');
    }
  };

  const handleAttachNote = async (noteId: string) => {
    const currentTask = task;
    if (!currentTask) return;
    const next = Array.from(new Set([...(currentTask.linkedNotes || []), noteId]));
    await updateTask(currentTask.id, { linkedNotes: next });
    setNoteQuery('');
    setNoteResults([]);
  };

  const handleDetachNote = async (noteId: string) => {
    const currentTask = task;
    if (!currentTask) return;
    const next = (currentTask.linkedNotes || []).filter((id) => id !== noteId);
    await updateTask(currentTask.id, { linkedNotes: next });
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
        const { jwt } = await account.createJWT();
        if (!active) return;
        
        const { collaborators } = await getResourceCollaboratorsSecure({
            resourceId: taskId,
            resourceType: 'task',
            jwt
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

  if (!task) {
    return (
        <Box sx={{ p: 6, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
            <Typography variant="h6" color="text.secondary">Task details unavailable</Typography>
            <Button variant="outlined" size="small" onClick={closeSecondarySidebar}>Go Back</Button>
        </Box>
    );
  }

  const project = projects.find((p) => p.id === task.projectId);
  const taskLabels = labels.filter((l) => task.labels.includes(l.id));
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const subtaskProgress = task.subtasks.length > 0
    ? (completedSubtasks / task.subtasks.length) * 100
    : 0;

  const handleStatusChange = (status: TaskStatus) => {
    updateTask(task.id, { status });
    setStatusAnchor(null);
  };

  const handlePriorityChange = (priority: Priority) => {
    updateTask(task.id, { priority });
    setPriorityAnchor(null);
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
    <Box sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      bgcolor: 'transparent',
      perspective: '1200px',
    }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2, md: 4 },
          py: 3,
          bgcolor: 'rgba(28, 26, 24, 0.95)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
          zIndex: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
          {isMobile && (
            <IconButton 
              onClick={closeSecondarySidebar}
              sx={{ color: 'text.secondary', mr: 1 }}
            >
              <BackIcon />
            </IconButton>
          )}
          <Checkbox
            checked={task.status === 'done'}
            onChange={() => completeTask(task.id)}
            sx={{
              p: 0,
              color: 'rgba(255, 255, 255, 0.15)',
              '&.Mui-checked': { color: '#6366F1' },
              '&:hover': { bgcolor: alpha('#6366F1', 0.1) }
            }}
          />
          <Chip
            label={statusLabels[task.status]}
            size="small"
            onClick={(e) => setStatusAnchor(e.currentTarget)}
            sx={{ 
              cursor: 'pointer',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontWeight: 800,
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontFamily: 'var(--font-clash-display)',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              '&:hover': { 
                bgcolor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                transform: 'translateY(-1px)'
              }
            }}
          />
        </Box>

        {/* Collaborator HUD */}
        {taskId && resourcePresence[taskId]?.length > 0 && (
            <Stack direction="row" spacing={-1} sx={{ ml: 2, mr: 'auto' }}>
                {resourcePresence[taskId].map((p, idx) => (
                    <IdentityAvatar 
                        key={p.userId}
                        size={24}
                        status={p.state}
                        sx={{ border: '2px solid #161412' }}
                    />
                ))}
            </Stack>
        )}

        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton 
            size="small" 
            onClick={() => setShowProjectLinker(true)} 
            sx={{ 
              color: 'text.secondary', 
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'all 0.2s ease',
              '&:hover': { color: '#6366F1', bgcolor: 'rgba(255, 255, 255, 0.08)', transform: 'translateY(-1px)' } 
            }}
          >
            <FolderKanban size={18} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={handleStartEdit} 
            sx={{ 
              color: 'text.secondary', 
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'all 0.2s ease',
              '&:hover': { color: '#F2F2F2', bgcolor: 'rgba(255, 255, 255, 0.08)', transform: 'translateY(-1px)' } 
            }}
          >
            <EditIcon sx={{ fontSize: 18 }} />
          </IconButton>
          <IconButton 
            size="small" 
            onClick={closeSecondarySidebar} 
            sx={{ 
              color: 'text.secondary', 
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              transition: 'all 0.2s ease',
              '&:hover': { color: '#F2F2F2', bgcolor: 'rgba(255, 255, 255, 0.08)', transform: 'translateY(-1px)' } 
            }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Box>

      <ProjectLinker 
        open={showProjectLinker} 
        onClose={() => setShowProjectLinker(false)} 
        entityId={taskId} 
        entityKind="goal" 
      />

      {/* Scrollable Content */}
      <Box sx={{ 
        px: 4, 
        py: 5, 
        overflow: 'auto', 
        flexGrow: 1,
        '&::-webkit-scrollbar': { width: 0 },
        scrollbarWidth: 'none'
      }}>
        {/* Title & Description */}
        {isEditing ? (
          <Box sx={{ 
            mb: 6,
            p: 3,
            bgcolor: alpha('#161412', 0.4),
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            <TextField
              fullWidth
              variant="standard"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              sx={{ mb: 2.5 }}
              InputProps={{ 
                sx: { 
                    fontSize: '1.75rem', 
                    fontWeight: 900, 
                    fontFamily: 'var(--font-clash-display)',
                    letterSpacing: '-0.02em',
                    '&:before, &:after': { display: 'none' } 
                } 
              }}
            />
            <TextField
              fullWidth
              multiline
              rows={4}
              variant="standard"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Add more context..."
              InputProps={{
                disableUnderline: true,
                sx: { 
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    p: 2,
                    borderRadius: '16px',
                    fontSize: '0.95rem',
                    fontFamily: 'var(--font-satoshi)',
                    lineHeight: 1.6
                }
              }}
            />
            <Box sx={{ display: 'flex', gap: 2, mt: 3.5 }}>
              <Button 
                variant="contained" 
                onClick={handleSaveEdit}
                sx={{ borderRadius: '12px', px: 3, fontWeight: 800 }}
              >
                Save
              </Button>
              <Button 
                onClick={() => setIsEditing(false)} 
                sx={{ color: 'text.secondary', fontWeight: 700 }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ 
            mb: 6,
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            '&:hover': { transform: 'translateZ(10px)' }
          }}>
            <Typography
              variant="h3"
              sx={{
                mb: 2.5,
                fontWeight: 900,
                lineHeight: 1.1,
                fontFamily: 'var(--font-clash-display)',
                letterSpacing: '-0.03em',
                textDecoration: task.status === 'done' ? 'line-through' : 'none',
                color: task.status === 'done' ? 'text.disabled' : '#F2F2F2',
                opacity: task.status === 'done' ? 0.6 : 1,
              }}
            >
              {task.title}
            </Typography>
            {task.description && (
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'text.secondary', 
                  fontSize: '1rem', 
                  lineHeight: 1.8,
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 500,
                  opacity: 0.8
                }}
              >
                {task.description}
              </Typography>
            )}
          </Box>
        )}

        {/* Actionable Meta Grid */}
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 4, 
          mb: 6,
          p: 4,
          bgcolor: alpha('#161412', 0.2),
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)'
        }}>
          {/* Project */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontSize: '0.65rem', opacity: 0.5 }}>Project Domain</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                 <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: project?.color || '#6366F1', boxShadow: `0 0 10px ${alpha(project?.color || '#6366F1', 0.4)}` }} />
                 <Typography variant="body2" fontWeight={800} sx={{ fontFamily: 'var(--font-clash-display)', letterSpacing: '0.02em' }}>{project?.name || 'Inbox'}</Typography>
            </Box>
          </Box>

          {/* Priority */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontSize: '0.65rem', opacity: 0.5 }}>Urgency Level</Typography>
            <Box 
                onClick={(e) => setPriorityAnchor(e.currentTarget)}
                sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5, 
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 0.7 }
                }}
            >
                 <FlagIcon sx={{ fontSize: 18, color: priorityColors[task.priority] }} />
                 <Typography variant="body2" fontWeight={800} sx={{ color: priorityColors[task.priority], fontFamily: 'var(--font-clash-display)', letterSpacing: '0.05em' }}>
                    {task.priority.toUpperCase()}
                 </Typography>
            </Box>
          </Box>

          {/* Due Date */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontSize: '0.65rem', opacity: 0.5 }}>Timeline Deadline</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                 <CalendarIcon sx={{ fontSize: 18, opacity: 0.6 }} />
                 <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'var(--font-satoshi)' }}>
                    {task.dueDate ? format(new Date(task.dueDate), 'MMM d, yyyy') : 'Open Schedule'}
                 </Typography>
            </Box>
          </Box>

          {/* Labels */}
          {taskLabels.length > 0 && (
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontSize: '0.65rem', opacity: 0.5 }}>Meta Tags</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {taskLabels.map((label) => (
                    <Chip
                        key={label.id}
                        label={label.name}
                        size="small"
                        sx={{
                            height: 22,
                            fontSize: '0.65rem',
                            bgcolor: alpha(label.color, 0.08),
                            border: `1px solid ${alpha(label.color, 0.2)}`,
                            color: label.color,
                            fontWeight: 800,
                            fontFamily: 'var(--font-clash-display)',
                            letterSpacing: '0.05em',
                            borderRadius: '6px'
                        }}
                    />
                    ))}
                </Box>
            </Box>
          )}

          {task.linkedNotes && task.linkedNotes.length > 0 && (
            <Box>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontSize: '0.65rem', opacity: 0.5 }}>Linked Notes</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {task.linkedNotes.map((noteId) => (
                      <Chip
                        key={noteId}
                        label={linkedNoteTitles[noteId] || noteId}
                        onDelete={() => handleDetachNote(noteId)}
                        size="small"
                        sx={{
                          maxWidth: '100%',
                          bgcolor: alpha('#6366F1', 0.08),
                          border: `1px solid ${alpha('#6366F1', 0.15)}`,
                          color: '#B8BDFB',
                          fontWeight: 700,
                          borderRadius: '6px',
                          '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
                        }}
                      />
                    ))}
                </Box>
            </Box>
          )}

          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontSize: '0.65rem', opacity: 0.5 }}>Assignees</Typography>
            {isLoadingAssignees ? (
            <CircularProgress size={16} sx={{ color: '#A855F7', ml: 1 }} />
        ) : taskParticipantProfiles.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {taskParticipantProfiles.map((profile) => (
                    <Box 
                        key={profile.userId} 
                        onClick={() => openUnified('assign-goal', { 
                            taskId: taskId,
                            taskTitle: task.title,
                            actorName: user?.name || 'A Kylrix User',
                            initialCollaborator: profile
                        })}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            p: 1.5,
                            borderRadius: '16px',
                            bgcolor: alpha('#fff', 0.03),
                            border: '1px solid rgba(255,255,255,0.06)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                bgcolor: alpha('#fff', 0.06),
                                borderColor: alpha('#A855F7', 0.3)
                            }
                        }}
                    >
                        <IdentityAvatar
                                fileId={profile.avatar || null}
                                alt={profile.displayName || profile.username}
                                fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                                size={32}
                                verified={profile.verified}
                            />
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'white', noWrap: true }}>
                                        {profile.displayName || profile.username}
                                    </Typography>
                                    <Typography 
                                        variant="caption" 
                                        sx={{ 
                                            px: 1, 
                                            py: 0.25, 
                                            borderRadius: '6px', 
                                            bgcolor: alpha('#A855F7', 0.1),
                                            color: '#A855F7',
                                            fontWeight: 800,
                                            fontSize: '9px',
                                            textTransform: 'uppercase'
                                        }}
                                    >
                                        {profile.permissionLevel || 'Viewer'}
                                    </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                                    @{profile.username}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                </Box>
            ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', opacity: 0.7, fontStyle: 'italic' }}>
                  No assignees yet.
                </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={{ my: 4, opacity: 0.05 }} />

        {/* Subtasks Section */}
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2">Execution Track</Typography>
            {task.subtasks.length > 0 && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                {completedSubtasks} / {task.subtasks.length}
              </Typography>
            )}
          </Box>

          {task.subtasks.length > 0 && (
            <Box sx={{ width: '100%', height: 4, bgcolor: 'rgba(255, 255, 255, 0.03)', borderRadius: 2, mb: 3, overflow: 'hidden' }}>
                <Box 
                    sx={{ 
                        height: '100%', 
                        width: `${subtaskProgress}%`, 
                        bgcolor: '#6366F1', 
                        boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
                        transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
                    }} 
                />
            </Box>
          )}

          <List sx={{ mb: 2 }}>
            {task.subtasks.map((subtask) => (
              <ListItem
                key={subtask.id}
                disablePadding
                sx={{
                  borderRadius: 1.5,
                  mb: 0.5,
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                  },
                }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => {
                        openUnified('delete-confirm', {
                            title: `Delete sub-task?`,
                            description: `"${subtask.title}"`,
                            resourceName: 'this sub-task',
                            confirmLabel: 'Delete Sub-task',
                            onConfirm: async () => {
                                await deleteSubtask(task.id, subtask.id);
                            }
                        });
                    }}
                    sx={{ opacity: 0.2, '&:hover': { opacity: 1, color: 'error.main' } }}
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                }
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={subtask.completed}
                    onChange={() => toggleSubtask(task.id, subtask.id)}
                    size="small"
                    sx={{
                        p: 0,
                        color: 'rgba(255, 255, 255, 0.1)',
                        '&.Mui-checked': { color: '#6366F1' }
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={subtask.title}
                  primaryTypographyProps={{
                    sx: {
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      textDecoration: subtask.completed ? 'line-through' : 'none',
                      color: subtask.completed ? 'text.disabled' : 'text.primary',
                    }
                  }}
                />
              </ListItem>
            ))}
          </List>

          <Box sx={{ display: 'flex', gap: 1, bgcolor: 'rgba(255, 255, 255, 0.02)', p: 0.5, borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Add sub-task..."
              value={newSubtask}
              variant="standard"
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
              InputProps={{ 
                disableUnderline: true,
                sx: { px: 1.5, fontSize: '0.85rem' }
              }}
            />
            <IconButton 
                size="small" 
                onClick={handleGenerateSubtasks} 
                disabled={isGeneratingSubtasks}
                sx={{ color: '#6366F1' }}
            >
                {isGeneratingSubtasks ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <IconButton size="small" onClick={handleAddSubtask} disabled={!newSubtask.trim()} sx={{ color: '#F2F2F2' }}>
              <AddIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        <Divider sx={{ my: 4, opacity: 0.05 }} />

        {/* Ecosystem Integration */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Ecosystem Links</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<NotesIcon sx={{ fontSize: 16 }} />}
              sx={{ justifyContent: 'flex-start', border: '1px solid rgba(255, 255, 255, 0.05)', bgcolor: 'rgba(255, 255, 255, 0.01)', fontSize: '0.75rem' }}
            >
              Note
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<MeetingIcon sx={{ fontSize: 16 }} />}
              sx={{ justifyContent: 'flex-start', border: '1px solid rgba(255, 255, 255, 0.05)', bgcolor: 'rgba(255, 255, 255, 0.01)', fontSize: '0.75rem' }}
            >
              Meet
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CalendarIcon sx={{ fontSize: 16 }} />}
              sx={{ justifyContent: 'flex-start', border: '1px solid rgba(255, 255, 255, 0.05)', bgcolor: 'rgba(255, 255, 255, 0.01)', fontSize: '0.75rem' }}
            >
              Cal
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 4, opacity: 0.05 }} />

        {/* Note Attachment */}
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle2">Attach Notes</Typography>
            {isSearchingNotes && <CircularProgress size={14} />}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', bgcolor: 'rgba(255,255,255,0.02)', p: 1.5, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search notes by title..."
              variant="standard"
              value={noteQuery}
              onChange={(e) => setNoteQuery(e.target.value)}
              InputProps={{ disableUnderline: true, sx: { fontSize: '0.9rem' } }}
            />
          </Box>
          {noteResults.length > 0 && (
            <List disablePadding>
              {noteResults.map((note: any) => (
                <ListItem
                  key={note.$id}
                  secondaryAction={
                    <Button size="small" onClick={() => handleAttachNote(note.$id)} sx={{ fontWeight: 800 }}>
                      Attach
                    </Button>
                  }
                  sx={{ px: 0, py: 0.5 }}
                >
                  <ListItemText
                    primary={note.title || 'Untitled note'}
                    secondary={note.content ? String(note.content).slice(0, 100) : note.$id}
                    primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem' }}
                    secondaryTypographyProps={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        {/* Comments Section / Public Huddle Discussion */}
        <Box sx={{ mb: 4, position: 'relative' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Public Huddle Thread
            </Typography>
            {isHuddleInit && huddleTimeRemaining && (
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ color: '#F59E0B' }}>
                <Clock size={12} style={{ color: '#F59E0B' }} />
                <Typography variant="caption" sx={{ fontWeight: 800 }}>{huddleTimeRemaining}</Typography>
              </Stack>
            )}
          </Stack>

          {huddleLoading && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(10,9,8,0.7)', zIndex: 2, borderRadius: 2 }}>
              <CircularProgress size={24} sx={{ color: '#6366F1' }} />
            </Box>
          )}

          {!isHuddleInit ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 3, bgcolor: 'rgba(255,255,255,0.01)' }}>
              <Globe size={24} style={{ color: '#6366F1', marginBottom: 12 }} />
              <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>Initialize Discussion Huddle</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 300, lineHeight: 1.4, mb: 2 }}>
                Spin up a real-time huddle discussion thread for this task. Anyone with task access can read and post. Ephemeral chat purges automatically in 7 days.
              </Typography>
              <Button 
                size="small"
                onClick={handleInitHuddle}
                sx={{ bgcolor: '#6366F1', color: '#fff', fontWeight: 800, py: 0.75, px: 2, borderRadius: '8px', textTransform: 'none', '&:hover': { bgcolor: '#575CF0' } }}
              >
                Start Huddle
              </Button>
            </Box>
          ) : (
            <>
              {/* Messages Viewport */}
              <Box sx={{ maxHeight: 300, overflowY: 'auto', p: 1, mb: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {huddleMessages.length === 0 ? (
                  <Box sx={{ py: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                    <Typography variant="caption" sx={{ fontStyle: 'italic' }}>No messages yet. Start the huddle discussion!</Typography>
                  </Box>
                ) : (
                  huddleMessages.map((msg) => {
                    const isSelf = msg.senderId === user?.$id;
                    return (
                      <Box key={msg.id} sx={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, display: 'block', mb: 0.25, textAlign: isSelf ? 'right' : 'left' }}>
                          {msg.senderName}
                        </Typography>
                        <Paper 
                          elevation={0}
                          sx={{
                            p: 1.25,
                            borderRadius: '12px',
                            borderTopRightRadius: isSelf ? 0 : '12px',
                            borderTopLeftRadius: isSelf ? '12px' : 0,
                            bgcolor: isSelf ? '#6366F1' : 'rgba(255,255,255,0.03)',
                            border: isSelf ? 'none' : '1px solid rgba(255,255,255,0.04)',
                            color: '#fff',
                            boxShadow: 'none',
                            backgroundImage: 'none'
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                            {msg.content}
                          </Typography>
                        </Paper>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.6rem', display: 'block', mt: 0.25, textAlign: isSelf ? 'right' : 'left' }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    );
                  })
                )}
                <div ref={huddleMessageEndRef} />
              </Box>

              {/* Message Input Panel */}
              <Box component="form" onSubmit={handleSendHuddleMessage} sx={{ display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'rgba(255,255,255,0.02)', p: 1.25, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)', mb: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Type huddle message..."
                  variant="standard"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={huddleSending}
                  InputProps={{ 
                    disableUnderline: true,
                    sx: { fontSize: '0.85rem', color: '#fff' }
                  }}
                />
                <IconButton
                  size="small"
                  type="submit"
                  disabled={!newComment.trim() || huddleSending}
                  sx={{ color: '#6366F1', p: 0.5 }}
                >
                  <SendIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>

              {/* Story Promotion Panel */}
              <Button
                fullWidth
                size="small"
                startIcon={<FileText size={14} />}
                onClick={handleSaveHuddleAsStory}
                sx={{
                  bgcolor: 'rgba(236, 72, 153, 0.1)', color: '#EC4899', fontWeight: 800, py: 1, borderRadius: '8px', textTransform: 'none',
                  '&:hover': { bgcolor: 'rgba(236, 72, 153, 0.15)' }
                }}
              >
                Promote Discussion to Story Note
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Menus */}
      <Menu
        anchorEl={statusAnchor}
        open={Boolean(statusAnchor)}
        onClose={() => setStatusAnchor(null)}
        PaperProps={{ sx: { minWidth: 160 } }}
      >
        {Object.entries(statusLabels).map(([status, label]) => (
          <MenuItem
            key={status}
            onClick={() => handleStatusChange(status as TaskStatus)}
            selected={task.status === status}
            sx={{ fontSize: '0.85rem' }}
          >
            {label}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={priorityAnchor}
        open={Boolean(priorityAnchor)}
        onClose={() => setPriorityAnchor(null)}
        PaperProps={{ sx: { minWidth: 160 } }}
      >
        {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((priority) => (
          <MenuItem
            key={priority}
            onClick={() => handlePriorityChange(priority)}
            selected={task.priority === priority}
            sx={{ fontSize: '0.85rem', gap: 1 }}
          >
            <FlagIcon sx={{ fontSize: 16, color: priorityColors[priority] }} />
            {priority.toUpperCase()}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
