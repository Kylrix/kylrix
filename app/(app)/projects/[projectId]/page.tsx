'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  IconButton,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  alpha,
  useTheme,
  Tabs,
  Tab,
  Divider,
  Avatar,
  AvatarGroup,
  Tooltip,
  TextField,
  Drawer,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Menu,
  Popover,
  Checkbox,
  FormControlLabel,
  List,
  ListItemText,
} from '@mui/material';
import {
  Plus,
  Calendar,
  FolderKanban,
  FileText,
  CheckSquare,
  Lock,
  MessageCircle,
  Sparkles,
  ArrowLeft,
  LayoutGrid,
  List as ListIcon,
  Trash2,
  ExternalLink,
  Search,
  Users,
  Settings as SettingsIcon,
  MoreHorizontal,
  PlusCircle,
  MessageSquare,
  Workflow,
  History,
  Globe,
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { SourceControlService, SourceControlRow } from '@/lib/services/sourceControl';
import { useToast } from '@/components/ui/Toast';
import { usePresence } from '@/components/providers/PresenceProvider';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Projects, ProjectObjects, Notes, Tasks, Credentials, Users as UserType } from '@/types/appwrite';
import { listNotes, listFlowTasks, listKeepCredentials, Query, AppwriteService, listTags } from '@/lib/appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import ProjectAddObjectModal from '@/components/projects/ProjectAddObjectModal';
import ProjectExtractGoalsModal from '@/components/projects/ProjectExtractGoalsModal';
import ProjectAddSubProjectModal from '@/components/projects/ProjectAddSubProjectModal';
import { databases, storage } from '@/lib/appwrite/client';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useAuth } from '@/context/auth/AuthContext';
import {
  createGhostNoteForProject,
  promoteGhostThreadToStory,
  createEncryptedGroupForProject,
  deleteGhostNoteForProject
} from '@/lib/actions/client-ops';

import { account } from '@/lib/appwrite/client';
import { getResourceCollaboratorsSecure, getUsersByIdsSecure } from '@/lib/actions/secure-ops';

import { createComment, listComments, createReaction, deleteReaction, listReactions, deleteReactionsForTarget } from '@/lib/appwrite/note';
import { TargetType } from '@/types/appwrite';
import { client } from '@/lib/appwrite/client';
import { ChatService } from '@/lib/services/chat';
import { createMessageAction } from '@/lib/actions/chat';
import { Send, Clock, Mic, Square, Tag, ShieldCheck, Camera, PhoneCall, FileSpreadsheet, X, Copy, ChevronLeft } from 'lucide-react';
import MuralPattern from '@/components/chat/MuralPattern';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { StorageService } from '@/lib/services/storage';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { useLayout } from '@/context/LayoutContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import FormDialog from '@/components/forms/FormDialog';
import { CallActionModal } from '@/components/call/CallActionModal';
import NewTotpDialog from '@/components/app/totp/new';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const theme = useTheme();
  const router = useRouter();
  const { projectId } = useParams();
  const { showSuccess, showError } = useToast();
  const { open: openUnified } = useUnifiedDrawer();
  const { user } = useAuth();
  const { joinResource, resourcePresence } = usePresence();
  const { openSidebar } = useDynamicSidebar();
  const { openSecondarySidebar } = useLayout();
  const { openOverlay, closeOverlay } = useOverlay();

  useEffect(() => {
      if (projectId) {
          return joinResource(
              APPWRITE_CONFIG.DATABASES.CHAT,
              'projects',
              projectId as string
          );
      }
  }, [projectId, joinResource]);

  const [project, setProject] = useState<Projects | null>(null);
  const [projectObjects, setProjectObjects] = useState<ProjectObjects[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractGoalsNote, setExtractGoalsNote] = useState<Notes | null>(null);
  const [isAddSubProjectModalOpen, setIsAddSubProjectModalOpen] = useState(false);
  const [gitIntegration, setGitIntegration] = useState<SourceControlRow | null>(null);
  const [initializingHuddle, setInitializingHuddle] = useState(false);
  const [discussionMenuAnchor, setDiscussionMenuAnchor] = useState<HTMLElement | null>(null);
  const [tabMenuAnchorEl, setTabMenuAnchorEl] = useState<{ x: number, y: number } | null>(null);
  const [activeTabMenuIndex, setActiveTabMenuIndex] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [ownerProfile, setOwnerProfile] = useState<any | null>(null);

  const handleSaveSettings = async (title: string, summary: string, status: 'active' | 'completed' | 'archived' | 'paused' | 'on_hold') => {
    if (!project) return;
    try {
      await ProjectsService.updateProject(project.$id, {
        title,
        summary,
        status
      });
      showSuccess('Project settings updated successfully!');
      fetchProjectData();
    } catch (err: any) {
      console.error('Failed to update project settings:', err);
      showError('Failed to update settings', err.message);
    }
  };

  const tabLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tabTouchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTabContextMenu = (event: React.MouseEvent, index: number) => {
    event.preventDefault();
    setTabMenuAnchorEl({ x: event.clientX, y: event.clientY });
    setActiveTabMenuIndex(index);
  };

  const handleTabTouchStart = (e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    tabTouchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    if (tabLongPressTimerRef.current) clearTimeout(tabLongPressTimerRef.current);
    const currentTarget = e.currentTarget;
    tabLongPressTimerRef.current = setTimeout(() => {
      const rect = currentTarget.getBoundingClientRect();
      setTabMenuAnchorEl({ x: rect.left + rect.width / 2, y: rect.bottom });
      setActiveTabMenuIndex(index);
      if (navigator.vibrate) navigator.vibrate(10);
    }, 600);
  };

  const handleTabTouchMove = (e: React.TouchEvent) => {
    if (!tabTouchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - tabTouchStartPosRef.current.x;
    const dy = touch.clientY - tabTouchStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      if (tabLongPressTimerRef.current) {
        clearTimeout(tabLongPressTimerRef.current);
        tabLongPressTimerRef.current = null;
      }
      tabTouchStartPosRef.current = null;
    }
  };

  const handleTabTouchEnd = () => {
    if (tabLongPressTimerRef.current) {
      clearTimeout(tabLongPressTimerRef.current);
      tabLongPressTimerRef.current = null;
    }
    tabTouchStartPosRef.current = null;
  };

  const metadata = useMemo(() => {
    if (!project?.metadata) return {};
    try {
      return JSON.parse(project.metadata);
    } catch {
      return {};
    }
  }, [project?.metadata]);

  const handleDiscussionClick = async () => {
    if (!project) return;
    if (metadata.discussionNoteId) {
      setTabValue(6); // Switch to discussion huddle room
    } else {
      setInitializingHuddle(true);
      try {
        await createGhostNoteForProject(project.$id, `${project.title} Discussion`);
        showSuccess('Huddle Discussion spun up successfully!');
        await fetchProjectData();
        setTabValue(6);
      } catch (err: any) {
        showError('Failed to initialize discussion', err.message);
      } finally {
        setInitializingHuddle(false);
      }
    }
  };

  // Resolved entities
  const [notes, setNotes] = useState<Notes[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<Credentials[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [subProjects, setSubProjects] = useState<Projects[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [totps, setTotps] = useState<any[]>([]);
  const [moments, setMoments] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [resolving, setResolving] = useState(false);

  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const p = await ProjectsService.getProject(projectId as string);
      setProject(p);

      // Resolve owner profile securely
      if (p?.ownerId) {
        getUsersByIdsSecure([p.ownerId])
          .then((users: any) => setOwnerProfile(users[0] || null))
          .catch(() => setOwnerProfile(null));
      }

      // Resolve secure project collaborators (with pending status, roles, and profiles!)
      try {
        const { jwt } = await account.createJWT();
        const { collaborators: collabs } = await getResourceCollaboratorsSecure({
          resourceId: projectId as string,
          resourceType: 'project',
          jwt
        });
        setCollaborators(collabs);
      } catch (collabErr) {
        console.error('Failed to load project collaborators securely:', collabErr);
      }

      const objects = await ProjectsService.listProjectObjects(projectId as string);
      setProjectObjects(objects.rows);

      // Resolve other entities
      await resolveEntities(objects.rows);

      // Fetch Git integration details for this project
      try {
        const integrations = await SourceControlService.listIntegrations(projectId as string);
        setGitIntegration(integrations[0] || null);
      } catch (gitErr) {
        console.error('Failed to load project git integration:', gitErr);
      }
    } catch (err: any) {
      showError('Failed to load project', err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  const resolveEntities = async (objects: ProjectObjects[]) => {
    setResolving(true);
    try {
      const noteIds = objects.filter(o => o.entityKind === 'note').map(o => o.entityId);
      const taskIds = objects.filter(o => o.entityKind === 'goal' || o.entityKind === 'task').map(o => o.entityId);
      const credentialIds = objects.filter(o => o.entityKind === 'password' || o.entityKind === 'credential').map(o => o.entityId);
      const subProjectIds = objects.filter(o => o.entityKind === 'project').map(o => o.entityId);
      const formIds = objects.filter(o => o.entityKind === 'form').map(o => o.entityId);
      const eventIds = objects.filter(o => o.entityKind === 'event').map(o => o.entityId);
      const tagIds = objects.filter(o => o.entityKind === 'tag').map(o => o.entityId);
      const totpIds = objects.filter(o => o.entityKind === 'totp').map(o => o.entityId);
      const momentIds = objects.filter(o => o.entityKind === 'moment').map(o => o.entityId);
      const callIds = objects.filter(o => o.entityKind === 'call').map(o => o.entityId);

      const promises = [
        noteIds.length ? listNotes([Query.equal('$id', noteIds)]).then(r => setNotes(r.rows)).catch(() => setNotes([])) : Promise.resolve(setNotes([])),
        taskIds.length ? listFlowTasks([Query.equal('$id', taskIds)]).then(r => setTasks(r.rows)).catch(() => setTasks([])) : Promise.resolve(setTasks([])),
        credentialIds.length ? listKeepCredentials([Query.equal('$id', credentialIds)]).then(r => setCredentials(r.rows)).catch(() => setCredentials([])) : Promise.resolve(setCredentials([])),
        subProjectIds.length ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CHAT, 'projects', [Query.equal('$id', subProjectIds)]).then((r: any) => setSubProjects(r.rows)).catch(() => setSubProjects([])) : Promise.resolve(setSubProjects([])),
        formIds.length ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, [Query.equal('$id', formIds)]).then((r: any) => setForms(r.rows)).catch(() => setForms([])) : Promise.resolve(setForms([])),
        eventIds.length ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, 'events', [Query.equal('$id', eventIds)]).then((r: any) => setEvents(r.rows)).catch(() => setEvents([])) : Promise.resolve(setEvents([])),
        tagIds.length ? listTags([Query.equal('$id', tagIds)]).then(r => setTags(r.rows)).catch(() => setTags([])) : Promise.resolve(setTags([])),
        totpIds.length ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, 'totpSecrets', [Query.equal('$id', totpIds)]).then((r: any) => setTotps(r.rows)).catch(() => setTotps([])) : Promise.resolve(setTotps([])),
        momentIds.length ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.MOMENTS, [Query.equal('$id', momentIds)]).then((r: any) => setMoments(r.rows)).catch(() => setMoments([])) : Promise.resolve(setMoments([])),
        callIds.length ? (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS, [Query.equal('$id', callIds)]).then((r: any) => setCalls(r.rows)).catch(() => setCalls([])) : Promise.resolve(setCalls([])),
      ];

      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to resolve entities', err);
    } finally {
      setResolving(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  const handleRemoveObject = async (entityId: string) => {
      // If it's a collaborator, we want to remove them as a collaborator!
      const isCollaborator = collaborators.some(u => (u.$id === entityId || u.userId === entityId));
      
      if (isCollaborator) {
          const collab = collaborators.find(u => (u.$id === entityId || u.userId === entityId));
          const entityName = collab?.displayName || collab?.name || collab?.email || 'this collaborator';
          openUnified('delete-confirm', {
              title: collab?.status === 'pending' ? `Cancel Invitation?` : `Remove Collaborator?`,
              description: collab?.status === 'pending' 
                  ? `This will cancel the pending invitation to "${entityName}".`
                  : `This will remove "${entityName}" from the project collaborators. They will lose all read and write access.`,
              resourceName: 'collaborator',
              confirmLabel: collab?.status === 'pending' ? 'Cancel Invitation' : 'Remove Collaborator',
              onConfirm: async () => {
                  try {
                      await ProjectsService.removeCollaborator(projectId as string, entityId);
                      showSuccess(collab?.status === 'pending' ? 'Invitation cancelled' : 'Collaborator removed');
                      setCollaborators(prev => prev.filter(u => u.$id !== entityId && u.userId !== entityId));
                      // Also cleanup any project_objects if they accepted
                      const obj = projectObjects.find(o => o.entityId === entityId);
                      if (obj) {
                          setProjectObjects(prev => prev.filter(o => o.$id !== obj.$id));
                      }
                  } catch (err: any) {
                      showError(collab?.status === 'pending' ? 'Failed to cancel invitation' : 'Failed to remove collaborator', err.message);
                  }
              }
          });
          return;
      }

      const obj = projectObjects.find(o => o.entityId === entityId);
      if (!obj) return;

      const entityName = notes.find(n => n.$id === entityId)?.title || 
                         tasks.find(t => t.$id === entityId)?.title || 
                         credentials.find(c => c.$id === entityId)?.name || 
                         subProjects.find(p => p.$id === entityId)?.title || 
                         'this object';

      openUnified('delete-confirm', {
          title: `Unlink "${entityName}"?`,
          description: `This will remove the connection between this ${obj.entityKind} and the current project. The original resource will not be deleted.`,
          resourceName: 'this connection',
          confirmLabel: 'Unlink from Project',
          onConfirm: async () => {
              try {
                  await ProjectsService.removeObjectFromProject(obj.$id);
                  showSuccess('Item unlinked');
                  setProjectObjects(prev => prev.filter(o => o.$id !== obj.$id));
                  setNotes(prev => prev.filter(n => n.$id !== entityId));
                  setTasks(prev => prev.filter(t => t.$id !== entityId));
                  setCredentials(prev => prev.filter(c => c.$id !== entityId));
                  setSubProjects(prev => prev.filter(p => p.$id !== entityId));
                  setCollaborators(prev => prev.filter(u => u.$id !== entityId));
              } catch (err: any) {
                  showError('Failed to unlink item', err.message);
              }
          }
      });
  };

  const handleCopyInviteLink = () => {
      try {
          const inviteUrl = `${window.location.origin}/project/${projectId}`;
          navigator.clipboard.writeText(inviteUrl);
          showSuccess('Project invite link copied!');
      } catch (err: any) {
          showError('Failed to copy invite link', err.message);
      }
  };

  const handleAddCollaborator = () => {
      // Check limit of 8 collaborators (7 + owner) for free plans
      const isPaid = hasPaidKylrixPlan(user);
      if (!isPaid && collaborators.length >= 7) {
          showError('Free plan is limited to 8 total collaborators. Upgrade to Pro to add more!');
          openUnified('pro-upgrade', {});
          return;
      }

      openUnified('share-note', {
          resourceId: projectId as string,
          resourceType: 'project',
          resourceTitle: project?.title || 'Project',
          onShared: (userId: string, permission: string) => {
              ProjectsService.addCollaborator(projectId as string, userId, permission);
              fetchProjectData();
          }
      });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '80vh' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ textAlign: 'center', py: 10 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900 }}>
          Project not found
        </Typography>
        <Button onClick={() => router.push('/projects')} sx={{ mt: 2, color: '#6366F1' }}>
          Back to projects
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff' }}>
      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 4 }, pt: { xs: 2, md: 6 }, pb: 10 }}>
        
        {/* Modern Breadcrumb / Top Bar */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 3, md: 0 }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" sx={{ mb: 6 }}>
            <Stack direction="row" alignItems="center" spacing={2.5} sx={{ width: { xs: '100%', md: 'auto' } }}>
                <IconButton
                    onClick={() => router.push('/projects')}
                    sx={{
                        width: 44,
                        height: 44,
                        bgcolor: '#161412',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.06)',
                        '&:hover': { bgcolor: '#1C1A18', transform: 'translateX(-2px)' },
                        transition: 'all 0.2s ease'
                    }}
                >
                    <ArrowLeft size={20} />
                </IconButton>
                <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Typography noWrap sx={{ color: '#fff', fontWeight: 900, fontSize: { xs: '1.25rem', md: '1.8rem' }, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
                            {project.title}
                        </Typography>
                        <Chip 
                            label={project.status} 
                            size="small" 
                            sx={{ 
                                bgcolor: alpha(project.status === 'active' ? '#10B981' : '#F59E0B', 0.1), 
                                color: project.status === 'active' ? '#10B981' : '#F59E0B', 
                                fontWeight: 900, 
                                fontSize: '0.65rem', 
                                textTransform: 'uppercase',
                                height: 22,
                                border: `1px solid ${alpha(project.status === 'active' ? '#10B981' : '#F59E0B', 0.2)}`
                            }} 
                        />
                    </Stack>
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>
                        {projectObjects.length} linked ecosystem objects • {collaborators.length + 1} participants
                    </Typography>
                </Box>
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                {/* Active Collaborators HUD */}
                {projectId && resourcePresence[projectId as string]?.length > 0 && (
                    <Stack direction="row" spacing={-1.5} sx={{ mr: 2, display: { xs: 'none', sm: 'flex' } }}>
                        {resourcePresence[projectId as string].map((p, idx) => (
                            <IdentityAvatar 
                                key={p.userId}
                                size={32}
                                status={p.state}
                                sx={{ border: '3px solid #0A0908', zIndex: 10 - idx }}
                            />
                        ))}
                    </Stack>
                )}

                {/* Instant Discussion Huddle Spin-up Button */}
                <IconButton
                    onClick={handleDiscussionClick}
                    disabled={initializingHuddle}
                    sx={{
                        width: 44,
                        height: 44,
                        bgcolor: metadata.discussionNoteId ? alpha('#818CF8', 0.15) : '#161412',
                        color: metadata.discussionNoteId ? '#818CF8' : 'rgba(255,255,255,0.6)',
                        border: `1px solid ${metadata.discussionNoteId ? alpha('#818CF8', 0.3) : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: '14px',
                        '&:hover': { 
                            bgcolor: metadata.discussionNoteId ? alpha('#818CF8', 0.25) : '#1C1A18',
                            color: '#fff',
                            borderColor: '#818CF8'
                        },
                        transition: 'all 0.2s ease',
                        position: 'relative'
                    }}
                >
                    {initializingHuddle ? <CircularProgress size={20} color="inherit" /> : <MessageSquare size={20} />}
                    {metadata.discussionNoteId && (
                        <Box sx={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: '#818CF8',
                            border: '2px solid #0A0908'
                        }} />
                    )}
                </IconButton>

                <Button
                    variant="outlined"
                    onClick={() => setIsSettingsOpen(true)}
                    sx={{
                        borderRadius: '14px',
                        borderColor: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.6)',
                        fontWeight: 800,
                        textTransform: 'none',
                        px: { xs: 1.5, sm: 2.5 },
                        minWidth: { xs: '44px', sm: 'auto' },
                        height: 44,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': { borderColor: 'rgba(255,255,255,0.2)', bgcolor: alpha('#fff', 0.02) }
                    }}
                >
                    <SettingsIcon size={18} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 1 }}>
                        Settings
                    </Box>
                </Button>
                <Button
                    variant="outlined"
                    onClick={handleAddCollaborator}
                    sx={{
                        borderRadius: '14px',
                        borderColor: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.6)',
                        fontWeight: 800,
                        textTransform: 'none',
                        px: { xs: 1.5, sm: 2.5 },
                        minWidth: { xs: '44px', sm: 'auto' },
                        height: 44,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        '&:hover': { borderColor: 'rgba(255,255,255,0.2)', bgcolor: alpha('#fff', 0.02) }
                    }}
                >
                    <Users size={18} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, ml: 1 }}>
                        Collaborator
                    </Box>
                </Button>
                <Button
                    variant="contained"
                    startIcon={<PlusCircle size={18} />}
                    onClick={() => setIsAddModalOpen(true)}
                    sx={{
                        borderRadius: '14px',
                        bgcolor: '#6366F1',
                        color: '#000',
                        fontWeight: 900,
                        textTransform: 'none',
                        px: { xs: 2, md: 3 },
                        boxShadow: '0 12px 24px rgba(99, 102, 241, 0.2)',
                        '&:hover': { bgcolor: alpha('#6366F1', 0.9) }
                    }}
                >
                    Integrate
                </Button>
            </Stack>
        </Stack>

        <Grid container spacing={4}>
            {/* Left Content Column */}
            <Grid size={{ xs: 12, lg: 8.5 }}>
                <Paper
                    elevation={0}
                    sx={{
                        bgcolor: '#161412',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '32px',
                        overflow: 'hidden',
                        backgroundImage: 'none',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.5)'
                    }}
                >
                    <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.06)', px: 3, pt: 1, bgcolor: alpha('#fff', 0.01) }}>
                        <Tabs 
                            value={tabValue} 
                            onChange={(_, v) => setTabValue(v)}
                            variant="scrollable"
                            scrollButtons="auto"
                            allowScrollButtonsMobile
                            sx={{
                                '& .MuiTab-root': {
                                    color: 'rgba(255, 255, 255, 0.4)',
                                    fontWeight: 900,
                                    textTransform: 'none',
                                    minHeight: 72,
                                    fontSize: '0.95rem',
                                    letterSpacing: '0.01em',
                                    mr: { xs: 1.5, md: 3 },
                                    px: { xs: 1, md: 2 },
                                    '&.Mui-selected': { color: '#6366F1' }
                                },
                                '& .MuiTabs-indicator': { bgcolor: '#6366F1', height: 3, borderRadius: '3px 3px 0 0' }
                            }}
                        >
                             <Tab 
                                label="Integrated Notes" 
                                icon={<FileText size={18} />} 
                                iconPosition="start" 
                                onContextMenu={(e) => handleTabContextMenu(e, 0)}
                                onTouchStart={(e) => handleTabTouchStart(e, 0)}
                                onTouchMove={handleTabTouchMove}
                                onTouchEnd={handleTabTouchEnd}
                             />
                             <Tab 
                                label="Execution Goals" 
                                icon={<CheckSquare size={18} />} 
                                iconPosition="start" 
                                onContextMenu={(e) => handleTabContextMenu(e, 1)}
                                onTouchStart={(e) => handleTabTouchStart(e, 1)}
                                onTouchMove={handleTabTouchMove}
                                onTouchEnd={handleTabTouchEnd}
                             />
                             <Tab 
                                label="Vault Assets" 
                                icon={<Lock size={18} />} 
                                iconPosition="start" 
                                onContextMenu={(e) => handleTabContextMenu(e, 2)}
                                onTouchStart={(e) => handleTabTouchStart(e, 2)}
                                onTouchMove={handleTabTouchMove}
                                onTouchEnd={handleTabTouchEnd}
                             />
                             <Tab 
                                label="Sub-Projects" 
                                icon={<FolderKanban size={18} />} 
                                iconPosition="start" 
                                onContextMenu={(e) => handleTabContextMenu(e, 3)}
                                onTouchStart={(e) => handleTabTouchStart(e, 3)}
                                onTouchMove={handleTabTouchMove}
                                onTouchEnd={handleTabTouchEnd}
                             />
                             <Tab 
                                label="Events & Calls" 
                                icon={<Calendar size={18} />} 
                                iconPosition="start" 
                                onContextMenu={(e) => handleTabContextMenu(e, 4)}
                                onTouchStart={(e) => handleTabTouchStart(e, 4)}
                                onTouchMove={handleTabTouchMove}
                                onTouchEnd={handleTabTouchEnd}
                             />
                             <Tab 
                                label="Interconnected Flow" 
                                icon={<Workflow size={18} />} 
                                iconPosition="start" 
                                onContextMenu={(e) => handleTabContextMenu(e, 5)}
                                onTouchStart={(e) => handleTabTouchStart(e, 5)}
                                onTouchMove={handleTabTouchMove}
                                onTouchEnd={handleTabTouchEnd}
                             />
                             <Tab 
                                label="Project Discussion" 
                                icon={<MessageCircle size={18} />} 
                                iconPosition="start" 
                                onContextMenu={(e) => handleTabContextMenu(e, 6)}
                                onTouchStart={(e) => handleTabTouchStart(e, 6)}
                                onTouchMove={handleTabTouchMove}
                                onTouchEnd={handleTabTouchEnd}
                             />
                        </Tabs>
                    </Box>

                    <Box sx={{ p: { xs: 2, md: 4 } }}>
                        {/* Integrated Notes */}
                        <CustomTabPanel value={tabValue} index={0}>
                            {resolving ? <LoadingPlaceholder /> : notes.length === 0 ? <EmptyState kind="note" /> : (
                                <Grid container spacing={2}>
                                    {notes.map(note => (
                                        <Grid size={{ xs: 12 }} key={note.$id}>
                                            <ResourceItem 
                                                title={note.title || 'Untitled Note'} 
                                                kind="note"
                                                metadata={note.tags?.slice(0, 3).join(' • ') || 'No tags'}
                                                onOpen={() => openSidebar(
                                                  <NoteDetailSidebar 
                                                    note={note} 
                                                    onUpdate={fetchProjectData} 
                                                    onDelete={fetchProjectData} 
                                                  />, 
                                                  'note-detail'
                                                )}
                                                onUnlink={() => handleRemoveObject(note.$id)}
                                                onExtractGoals={() => {
                                                    setExtractGoalsNote(note);
                                                    setIsExtractModalOpen(true);
                                                }}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>
                        
                        {/* Execution Goals */}
                        <CustomTabPanel value={tabValue} index={1}>
                            {resolving ? <LoadingPlaceholder /> : tasks.length === 0 ? <EmptyState kind="goal" /> : (
                                <Grid container spacing={2}>
                                    {tasks.map(task => (
                                        <Grid size={{ xs: 12 }} key={task.$id}>
                                            <ResourceItem 
                                                title={task.title} 
                                                kind="goal"
                                                metadata={`${task.status.replace('-', ' ')} • ${task.priority}`}
                                                onOpen={() => openSecondarySidebar('task', task.$id)}
                                                onUnlink={() => handleRemoveObject(task.$id)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>

                        {/* Vault Assets */}
                        <CustomTabPanel value={tabValue} index={2}>
                            {resolving ? <LoadingPlaceholder /> : (credentials.length === 0 && totps.length === 0) ? <EmptyState kind="password" /> : (
                                <Grid container spacing={2}>
                                    {credentials.map(cred => (
                                        <Grid size={{ xs: 12 }} key={cred.$id}>
                                            <ResourceItem 
                                                title={cred.name} 
                                                kind="password"
                                                metadata={cred.username || 'Shared secret'}
                                                onOpen={() => openOverlay(
                                                  <CredentialDialog 
                                                    open={true} 
                                                    onClose={closeOverlay} 
                                                    initial={cred} 
                                                    onSaved={fetchProjectData} 
                                                  />
                                                )}
                                                onUnlink={() => handleRemoveObject(cred.$id)}
                                            />
                                        </Grid>
                                    ))}
                                    {totps.map(totp => (
                                        <Grid size={{ xs: 12 }} key={totp.$id}>
                                            <ResourceItem 
                                                title={totp.issuer || totp.name || 'Smart Code'} 
                                                kind="totp"
                                                metadata={totp.accountName || 'TOTP secret'}
                                                onOpen={() => openOverlay(
                                                  <NewTotpDialog 
                                                    open={true} 
                                                    onClose={() => {
                                                      closeOverlay();
                                                      fetchProjectData();
                                                    }} 
                                                    initialData={totp} 
                                                  />
                                                )}
                                                onUnlink={() => handleRemoveObject(totp.$id)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>

                        {/* Sub-Projects */}
                        <CustomTabPanel value={tabValue} index={3}>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                                <Button
                                    variant="outlined"
                                    startIcon={<Plus size={16} />}
                                    onClick={() => {
                                        if (!hasPaidKylrixPlan(user)) {
                                            openUnified('pro-upgrade', {});
                                        } else {
                                            setIsAddSubProjectModalOpen(true);
                                        }
                                    }}
                                    sx={{
                                        borderRadius: '12px',
                                        borderColor: 'rgba(255,255,255,0.08)',
                                        color: '#fff',
                                        fontWeight: 800,
                                        textTransform: 'none',
                                        fontSize: '0.8rem',
                                        '&:hover': {
                                            borderColor: '#6366F1',
                                            bgcolor: 'rgba(99, 102, 241, 0.05)'
                                        }
                                    }}
                                >
                                    Integrate Sub-Project
                                </Button>
                            </Box>
                            {resolving ? <LoadingPlaceholder /> : subProjects.length === 0 ? <EmptyState kind="sub-project" /> : (
                                <Grid container spacing={2}>
                                    {subProjects.map(sub => (
                                        <Grid size={{ xs: 12 }} key={sub.$id}>
                                            <ResourceItem 
                                                title={sub.title || 'Untitled Project'}
 
                                                kind="project"
                                                metadata={sub.summary || 'Private Container'}
                                                onOpen={() => router.push(`/projects/${sub.$id}`)}
                                                onUnlink={() => handleRemoveObject(sub.$id)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>

                        {/* Events & Calls */}
                        <CustomTabPanel value={tabValue} index={4}>
                            {resolving ? <LoadingPlaceholder /> : (events.length === 0 && calls.length === 0) ? <EmptyState kind="event" /> : (
                                <Grid container spacing={2}>
                                    {events.map(event => (
                                        <Grid size={{ xs: 12 }} key={event.$id}>
                                            <ResourceItem 
                                                title={event.title} 
                                                kind="event"
                                                metadata={`${event.location || 'No location'} • ${new Date(event.startTime).toLocaleString()}`}
                                                onOpen={() => openSecondarySidebar('event', event.$id, event)}
                                                onUnlink={() => handleRemoveObject(event.$id)}
                                            />
                                        </Grid>
                                    ))}
                                    {calls.map(call => (
                                        <Grid size={{ xs: 12 }} key={call.$id}>
                                            <ResourceItem 
                                                title={call.title || 'Call Link'} 
                                                kind="call"
                                                metadata={`Scheduled Type: ${call.type || 'video'}`}
                                                onOpen={() => openOverlay(
                                                  <CallActionModal 
                                                    open={true} 
                                                    onClose={() => {
                                                      closeOverlay();
                                                      fetchProjectData();
                                                    }} 
                                                  />
                                                )}
                                                onUnlink={() => handleRemoveObject(call.$id)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>

                        {/* Interconnected Flow: Forms, Tags, Moments */}
                        <CustomTabPanel value={tabValue} index={5}>
                            {resolving ? <LoadingPlaceholder /> : (forms.length === 0 && tags.length === 0 && moments.length === 0) ? <EmptyState kind="flow" /> : (
                                <Grid container spacing={2}>
                                    {forms.map(form => (
                                        <Grid size={{ xs: 12 }} key={form.$id}>
                                            <ResourceItem 
                                                title={form.title || 'Untitled Form'} 
                                                kind="form"
                                                metadata={form.description || 'Interactive Flow Schema'}
                                                onOpen={() => openOverlay(
                                                  <FormDialog 
                                                    open={true} 
                                                    onClose={closeOverlay} 
                                                    form={form} 
                                                    onSaved={fetchProjectData} 
                                                  />
                                                )}
                                                onUnlink={() => handleRemoveObject(form.$id)}
                                            />
                                        </Grid>
                                    ))}
                                    {tags.map(tag => (
                                        <Grid size={{ xs: 12 }} key={tag.$id}>
                                            <ResourceItem 
                                                title={`# ${tag.name}`} 
                                                kind="tag"
                                                metadata={`Color accent: ${tag.color || 'default'}`}
                                                onOpen={() => openUnified('new-tag', { tag, onSuccess: fetchProjectData })}
                                                onUnlink={() => handleRemoveObject(tag.$id)}
                                            />
                                        </Grid>
                                    ))}
                                    {moments.map(moment => (
                                        <Grid size={{ xs: 12 }} key={moment.$id}>
                                            <ResourceItem 
                                                title={moment.caption || 'Integrated Moment'} 
                                                kind="moment"
                                                metadata={`Published: ${new Date(moment.$createdAt || moment.createdAt).toLocaleDateString()}`}
                                                onOpen={() => router.push(`/connect/post/${moment.$id}`)}
                                                onUnlink={() => handleRemoveObject(moment.$id)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>

                        {/* Project Discussion */}
                        <CustomTabPanel value={tabValue} index={6}>
                            <ProjectDiscussionTab 
                                project={project} 
                                fetchProjectData={fetchProjectData}
                                user={user}
                            />
                        </CustomTabPanel>
                    </Box>
                </Paper>

                {/* Suggested Workflows Section */}
                <Box sx={{ mt: 6 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
                        Suggested Workflows
                    </Typography>
                    <Grid container spacing={2}>
                        {[
                            { title: 'Project Documentation', icon: FileText, color: '#EC4899', desc: 'Create a new note specific to this project.' },
                            { title: 'Sprint Planning', icon: CheckSquare, color: '#A855F7', desc: 'Initialize a goal to track execution.' },
                            { title: 'Access Hardening', icon: Lock, color: '#10B981', desc: 'Store new secrets for the team.' }
                        ].map(wf => (
                            <Grid size={{ xs: 12, md: 4 }} key={wf.title}>
                                <Paper elevation={0} sx={{ p: 2.5, borderRadius: '24px', bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s ease', cursor: 'pointer', '&:hover': { borderColor: alpha(wf.color, 0.3), transform: 'translateY(-2px)' } }}>
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                        <Box sx={{ color: wf.color }}><wf.icon size={18} /></Box>
                                        <Typography variant="body2" sx={{ fontWeight: 800 }}>{wf.title}</Typography>
                                    </Stack>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{wf.desc}</Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Box>

                {/* Integrations Section */}
                <Box sx={{ mt: 6 }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
                        Integrations
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Paper 
                                elevation={0} 
                                onClick={() => openUnified('github-integration', { context: 'project', projectId: projectId as string, tasks: tasks, onSaved: fetchProjectData })}
                                sx={{ 
                                    p: 2.5, 
                                    borderRadius: '24px', 
                                    bgcolor: '#161412', 
                                    border: '1px solid rgba(255,255,255,0.06)', 
                                    transition: 'all 0.2s ease', 
                                    cursor: 'pointer', 
                                    position: 'relative',
                                    '&:hover': { 
                                        borderColor: alpha('#6366F1', 0.3), 
                                        transform: 'translateY(-2px)' 
                                    } 
                                }}
                            >
                                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                    <Box sx={{ color: '#6366F1', display: 'flex', alignItems: 'center' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                                        </svg>
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>GitHub</Typography>
                                    {gitIntegration?.enabled && (
                                        <Box 
                                            sx={{ 
                                                ml: 'auto', 
                                                px: 1, 
                                                py: 0.2, 
                                                borderRadius: '6px', 
                                                bgcolor: 'rgba(16, 185, 129, 0.1)', 
                                                color: '#10B981', 
                                                fontSize: '0.65rem', 
                                                fontWeight: 900 
                                            }}
                                        >
                                            CONNECTED
                                        </Box>
                                    )}
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, display: 'block', minHeight: '38px' }}>
                                    {gitIntegration?.enabled 
                                        ? `Connected to ${gitIntegration.ownerName}/${gitIntegration.repoName}` 
                                        : 'Link your GitHub repository to sync tasks, issues, and pull requests.'}
                                </Typography>
                            </Paper>
                        </Grid>

                        <Grid size={{ xs: 12, md: 4 }}>
                            <Paper 
                                elevation={0} 
                                onClick={() => openUnified('google-integration', { context: 'project', projectId: projectId as string })}
                                sx={{ 
                                    p: 2.5, 
                                    borderRadius: '24px', 
                                    bgcolor: '#161412', 
                                    border: '1px solid rgba(255,255,255,0.06)', 
                                    transition: 'all 0.2s ease', 
                                    cursor: 'pointer', 
                                    '&:hover': { 
                                        borderColor: alpha('#4285F4', 0.3), 
                                        transform: 'translateY(-2px)' 
                                    } 
                                }}
                            >
                                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <svg viewBox="0 0 24 24" width="18" height="18">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.64l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                        </svg>
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>Google Workspace</Typography>
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, display: 'block', minHeight: '38px' }}>
                                    Integrate Google Suite to sync and manage calendars, tasks, and cloud files.
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            </Grid>

            {/* Right Sidebar Column */}
            <Grid size={{ xs: 12, lg: 3.5 }}>
                <Stack spacing={4}>
                    {/* Participants */}
                    <Paper
                        elevation={0}
                        sx={{
                            bgcolor: '#161412', // Deep Ash
                            border: '1px solid #1C1A18', // Rim/Border Ash
                            borderRadius: '28px',
                            p: 3,
                            backgroundImage: 'none',
                        }}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
                            <Typography sx={{ color: '#fff', fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: '1.1rem', letterSpacing: '-0.01em' }}>Project Members</Typography>
                            <Stack direction="row" spacing={1}>
                                <IconButton 
                                    size="small" 
                                    onClick={handleCopyInviteLink}
                                    title="Copy Invite Link"
                                    sx={{ bgcolor: 'rgba(255, 255, 255, 0.04)', color: 'rgba(255, 255, 255, 0.6)', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#fff' } }}
                                >
                                    <Copy size={15} />
                                </IconButton>
                                <IconButton 
                                    size="small" 
                                    onClick={handleAddCollaborator}
                                    title="Add Collaborator"
                                    sx={{ bgcolor: alpha('#6366F1', 0.1), color: '#6366F1', '&:hover': { bgcolor: alpha('#6366F1', 0.2) } }}
                                >
                                    <Plus size={18} />
                                </IconButton>
                            </Stack>
                        </Stack>
                        
                        <Stack spacing={1.5}>
                            {/* Project Owner Section */}
                            <Box sx={{ p: 1.5, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <IdentityAvatar 
                                    size={34} 
                                    fileId={ownerProfile?.profilePicId || ownerProfile?.avatar || null} 
                                    alt={ownerProfile?.displayName || ownerProfile?.name || 'Owner'} 
                                    fallback={(ownerProfile?.displayName || ownerProfile?.name || 'O').charAt(0).toUpperCase()} 
                                    verified={ownerProfile?.verified ?? true} 
                                    isAvatar={ownerProfile?.isAvatar ?? true}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography noWrap variant="body2" sx={{ fontWeight: 800, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                                        {ownerProfile?.displayName || ownerProfile?.name || ownerProfile?.username || ownerProfile?.email || 'Project Owner'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
                                        {ownerProfile?.displayName || ownerProfile?.name ? (ownerProfile?.username ? `@${ownerProfile.username}` : 'Project Owner') : 'Project Owner'}
                                    </Typography>
                                </Box>
                                <Chip label="OWNER" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 900, fontFamily: 'var(--font-satoshi)', bgcolor: 'rgba(99, 102, 241, 0.12)', color: '#6366F1' }} />
                            </Box>

                            {/* Collaborators Section (Active and Pending) */}
                            {collaborators.map(user => (
                                <Box 
                                    key={user.$id || user.userId} 
                                    onClick={() => {
                                        openUnified('share-note', {
                                            resourceId: projectId as string,
                                            resourceType: 'project',
                                            resourceTitle: project?.title || 'Project',
                                            initialCollaborator: user,
                                            onShared: () => fetchProjectData()
                                        });
                                    }}
                                    sx={{ 
                                        p: 1.5, 
                                        borderRadius: '16px', 
                                        bgcolor: '#0A0908', 
                                        border: '1px solid #1C1A18', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 1.5,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            borderColor: 'rgba(255,255,255,0.15)',
                                            bgcolor: 'rgba(255,255,255,0.02)'
                                        }
                                    }}
                                >
                                    <IdentityAvatar 
                                        size={34} 
                                        fileId={user.avatar || user.profilePicId} 
                                        alt={user.displayName || user.name || 'Collaborator'} 
                                        fallback={(user.displayName || user.name || 'C').charAt(0).toUpperCase()} 
                                        verified={user.verified} 
                                        isAvatar={user.isAvatar ?? true}
                                    />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography noWrap variant="body2" sx={{ fontWeight: 800, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                                            {user.displayName || user.name || user.email}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontFamily: 'var(--font-satoshi)', fontWeight: 600, textTransform: 'capitalize' }}>
                                            {user.permissionLevel || 'Viewer'}
                                        </Typography>
                                    </Box>
                                    
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        {user.status === 'pending' && (
                                            <Chip label="PENDING" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 900, fontFamily: 'var(--font-satoshi)', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }} />
                                        )}
                                    </Stack>
                                </Box>
                            ))}
                        </Stack>
                    </Paper>

                    <Paper
                        elevation={0}
                        sx={{
                            bgcolor: '#161412',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '32px',
                            p: 3.5,
                            backgroundImage: 'none',
                        }}
                    >
                        <Typography sx={{ color: '#fff', fontWeight: 900, mb: 1.5, fontSize: '1.1rem' }}>Project Insights</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6, mb: 3 }}>
                            {project.summary || 'This project is used to group and coordinate your work.'}
                        </Typography>
                        
                        <Stack spacing={2}>
                            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: alpha('#fff', 0.01), border: '1px solid rgba(255,255,255,0.03)' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1 }}>Visibility</Typography>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#6366F1' }}>
                                    <Globe size={14} />
                                    <Typography variant="body2" sx={{ fontWeight: 900, textTransform: 'capitalize' }}>{project.visibility}</Typography>
                                </Stack>
                            </Box>
                            <Box sx={{ p: 2, borderRadius: '16px', bgcolor: alpha('#fff', 0.01), border: '1px solid rgba(255,255,255,0.03)' }}>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1 }}>Last Update</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <History size={14} color="rgba(255,255,255,0.4)" />
                                    <Typography variant="body2" sx={{ fontWeight: 900 }}>{new Date(project.updatedAt || '').toLocaleDateString()}</Typography>
                                </Stack>
                            </Box>
                        </Stack>
                    </Paper>
                </Stack>
            </Grid>
        </Grid>
      </Box>

      {isAddModalOpen && (
        <ProjectAddObjectModal 
          open={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)} 
          projectId={projectId as string} 
          onAdded={fetchProjectData} 
        />
      )}

      {isExtractModalOpen && extractGoalsNote && (
        <ProjectExtractGoalsModal
          open={isExtractModalOpen}
          onClose={() => {
            setIsExtractModalOpen(false);
            setExtractGoalsNote(null);
          }}
          projectId={projectId as string}
          noteTitle={extractGoalsNote.title || 'Untitled Note'}
          noteContent={extractGoalsNote.content || ''}
          onExtracted={fetchProjectData}
        />
      )}

      {/* Project Settings Bottom Drawer */}
      <ProjectSettingsDrawer
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        project={project}
        onSave={handleSaveSettings}
      />

      {isAddSubProjectModalOpen && (
        <ProjectAddSubProjectModal
          open={isAddSubProjectModalOpen}
          onClose={() => setIsAddSubProjectModalOpen(false)}
          projectId={projectId as string}
          onAdded={fetchProjectData}
        />
      )}



      {/* Custom Tabs Context Menu */}
      <Menu
        open={Boolean(tabMenuAnchorEl)}
        onClose={() => { setTabMenuAnchorEl(null); setActiveTabMenuIndex(null); }}
        anchorReference="anchorPosition"
        anchorPosition={
          tabMenuAnchorEl ? { top: tabMenuAnchorEl.y, left: tabMenuAnchorEl.x } : undefined
        }
        PaperProps={{
          sx: {
            bgcolor: '#13110F',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            p: 1,
            color: '#fff',
            backgroundImage: 'none',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            minWidth: 180
          }
        }}
      >
        {activeTabMenuIndex === 0 && (
          <MenuItem 
            onClick={() => {
              setTabMenuAnchorEl(null);
              setIsAddModalOpen(true);
            }}
            sx={{ fontWeight: 700, borderRadius: '8px', color: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' } }}
          >
            <FileText size={16} style={{ marginRight: 10 }} /> Integrate Note
          </MenuItem>
        )}
        {activeTabMenuIndex === 1 && (
          <MenuItem 
            onClick={() => {
              setTabMenuAnchorEl(null);
              setIsAddModalOpen(true);
            }}
            sx={{ fontWeight: 700, borderRadius: '8px', color: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' } }}
          >
            <CheckSquare size={16} style={{ marginRight: 10 }} /> Integrate Goal
          </MenuItem>
        )}
        {activeTabMenuIndex === 2 && (
          <MenuItem 
            onClick={() => {
              setTabMenuAnchorEl(null);
              setIsAddModalOpen(true);
            }}
            sx={{ fontWeight: 700, borderRadius: '8px', color: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' } }}
          >
            <Lock size={16} style={{ marginRight: 10 }} /> Integrate Asset
          </MenuItem>
        )}
        {activeTabMenuIndex === 3 && (
          <MenuItem 
            onClick={() => {
              setTabMenuAnchorEl(null);
              if (!hasPaidKylrixPlan(user)) {
                openUnified('pro-upgrade', {});
              } else {
                setIsAddSubProjectModalOpen(true);
              }
            }}
            sx={{ fontWeight: 700, borderRadius: '8px', color: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' } }}
          >
            <FolderKanban size={16} style={{ marginRight: 10 }} /> Add Sub-Project
          </MenuItem>
        )}
        {activeTabMenuIndex === 4 && (
          <MenuItem 
            onClick={() => {
              setTabMenuAnchorEl(null);
              setIsAddModalOpen(true);
            }}
            sx={{ fontWeight: 700, borderRadius: '8px', color: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' } }}
          >
            <Calendar size={16} style={{ marginRight: 10 }} /> Integrate Event/Call
          </MenuItem>
        )}
        {activeTabMenuIndex === 5 && (
          <MenuItem 
            onClick={() => {
              setTabMenuAnchorEl(null);
              showSuccess('Interconnected flow nodes re-synchronized');
            }}
            sx={{ fontWeight: 700, borderRadius: '8px', color: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' } }}
          >
            <Workflow size={16} style={{ marginRight: 10 }} /> Re-sync Flow Nodes
          </MenuItem>
        )}
        {activeTabMenuIndex === 6 && (
          <MenuItem 
            disabled={!metadata.discussionNoteId}
            onClick={async () => {
              setTabMenuAnchorEl(null);
              if (metadata.discussionNoteId) {
                if (window.confirm("Are you sure you want to wipe this entire discussion? All messages and replies will be permanently deleted.")) {
                  setInitializingHuddle(true);
                  try {
                    // Fetch all comment rows for this discussion note's table representation
                    const commentsRes = await databases.listRows(
                      APPWRITE_CONFIG.DATABASES.NOTE,
                      'comments',
                      [Query.equal('noteId', metadata.discussionNoteId), Query.limit(1000)]
                    );
                    
                    const commentIds = (commentsRes.rows as any[]).map((c) => c.$id).filter(Boolean);
                    if (commentIds.length > 0) {
                      // Delete reactions associated with comment rows
                      try {
                        await deleteReactionsForTarget(TargetType.COMMENT, commentIds);
                      } catch (e) {
                        console.warn('Failed to delete reactions during discussion wipe:', e);
                      }
                      
                      // Delete associated voice note storage files recursively from storage bucket
                      await Promise.all(
                        commentsRes.rows.map(async (comment: any) => {
                          let voiceFileId = null;
                          const rawContent = comment.content;
                          if (rawContent?.startsWith('{') && rawContent?.endsWith('}')) {
                            try {
                              const json = JSON.parse(rawContent);
                              voiceFileId = json.voiceFileId || null;
                            } catch {}
                          } else if (rawContent?.startsWith('__voice_note__:')) {
                            voiceFileId = rawContent.substring('__voice_note__:'.length);
                          }
                          
                          if (voiceFileId) {
                            try {
                              await storage.deleteFile('voice', voiceFileId);
                            } catch (err) {
                              console.warn(`Failed to delete voice note file ${voiceFileId}:`, err);
                            }
                          }
                        })
                      );
                      
                      // Delete comment rows from comments table
                      await Promise.all(
                        commentIds.map((id) => databases.deleteRow(APPWRITE_CONFIG.DATABASES.NOTE, 'comments', id))
                      );
                    }
                    
                    // Delete actual note row (the discussion note / ghost note itself!) from notes table
                    await deleteGhostNoteForProject(metadata.discussionNoteId);
                    
                    // Reload project data to uninitialize discussion thread
                    await fetchProjectData();
                    showSuccess('Discussion thread wiped successfully');
                  } catch (err: any) {
                    console.error('Failed to wipe discussion:', err);
                    showError('Failed to wipe discussion', err.message);
                  } finally {
                    setInitializingHuddle(false);
                  }
                }
              }
            }}
            sx={{ 
              fontWeight: 700, 
              borderRadius: '8px', 
              color: '#FF4D4D', 
              '&:hover': { bgcolor: alpha('#FF4D4D', 0.08) },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.2)' }
            }}
          >
            <Trash2 size={16} style={{ marginRight: 10 }} /> Wipe Thread
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}

function LoadingPlaceholder() {
    return (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={24} sx={{ color: '#6366F1' }} />
        </Box>
    );
}

function EmptyState({ kind }: { kind: string }) {
    const icon = kind === 'note' ? <FileText size={32} /> : kind === 'goal' ? <CheckSquare size={32} /> : kind === 'sub-project' ? <FolderKanban size={32} /> : <Lock size={32} />;
    return (
        <Box sx={{ textAlign: 'center', py: 6, opacity: 0.4 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>{icon}</Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>No {kind}s linked to this project yet.</Typography>
        </Box>
    );
}

function ResourceItem({ 
    title, 
    kind, 
    metadata, 
    onOpen, 
    onUnlink,
    onExtractGoals
}: { 
    title: string, 
    kind: string, 
    metadata: string, 
    onOpen: () => void, 
    onUnlink: () => void,
    onExtractGoals?: () => void
}) {
    // Elegant mapping for all 9 types (Notes, Goals, Secrets/Credentials, Forms, Events, Tags, TOTPs, Moments, Calls)
    const getKindAssets = (k: string) => {
        const lower = k?.toLowerCase() || '';
        switch (lower) {
            case 'note':
                return { icon: <FileText size={20} />, accent: '#EC4899' }; // Pink
            case 'goal':
                return { icon: <CheckSquare size={20} />, accent: '#A855F7' }; // Purple
            case 'secret':
            case 'password':
            case 'credential':
                return { icon: <Lock size={20} />, accent: '#10B981' }; // Emerald
            case 'totp':
                return { icon: <ShieldCheck size={20} />, accent: '#6366F1' }; // Indigo
            case 'form':
                return { icon: <FileSpreadsheet size={20} />, accent: '#3B82F6' }; // Blue
            case 'event':
                return { icon: <Calendar size={20} />, accent: '#F59E0B' }; // Amber
            case 'tag':
                return { icon: <Tag size={20} />, accent: '#06B6D4' }; // Cyan
            case 'moment':
                return { icon: <Camera size={20} />, accent: '#E11D48' }; // Rose
            case 'call':
                return { icon: <PhoneCall size={20} />, accent: '#EF4444' }; // Red
            default:
                return { icon: <FolderKanban size={20} />, accent: '#818CF8' }; // Default Violet
        }
    };

    const { icon, accent } = getKindAssets(kind);

    return (
        <Paper
            elevation={0}
            sx={{
                bgcolor: '#13110F',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '24px',
                p: { xs: 2, sm: 2.5 },
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: { xs: 2, sm: 3 },
                backgroundImage: 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4px',
                    height: '100%',
                    bgcolor: accent,
                    opacity: 0.6,
                    transition: 'all 0.2s ease',
                },
                '&:hover': { 
                    bgcolor: '#181613', 
                    borderColor: alpha(accent, 0.25),
                    transform: 'translateY(-1.5px)',
                    boxShadow: `0 8px 24px ${alpha(accent, 0.05)}`,
                    '&::before': {
                        opacity: 1,
                        height: '100%'
                    }
                }
            }}
        >
            <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, width: '100%' }}>
                <Box sx={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: '14px', 
                    bgcolor: alpha(accent, 0.08), 
                    color: accent, 
                    display: 'grid', 
                    placeItems: 'center',
                    border: `1px solid ${alpha(accent, 0.15)}`,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                }}>
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography 
                        sx={{ 
                            color: '#fff', 
                            fontWeight: 800, 
                            fontSize: '0.95rem',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.5
                        }}
                    >
                        {title}
                    </Typography>
                    <Typography 
                        variant="caption" 
                        sx={{ 
                            color: 'rgba(255,255,255,0.4)', 
                            fontWeight: 800, 
                            textTransform: 'uppercase', 
                            letterSpacing: '0.08em',
                            fontSize: '0.68rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            bgcolor: 'rgba(255,255,255,0.03)',
                            px: 1,
                            py: 0.25,
                            borderRadius: '6px',
                            border: '1px solid rgba(255,255,255,0.04)'
                        }}
                    >
                        {metadata || kind}
                    </Typography>
                </Box>
            </Stack>

            <Stack 
                direction="row" 
                spacing={1.5} 
                alignItems="center" 
                justifyContent={{ xs: 'flex-end', sm: 'flex-start' }}
                sx={{ 
                    width: { xs: '100%', sm: 'auto' },
                    flexShrink: 0,
                    borderTop: { xs: '1px solid rgba(255,255,255,0.04)', sm: 'none' },
                    pt: { xs: 1.5, sm: 0 },
                }}
            >
                {onExtractGoals && (
                    <Button
                        size="small"
                        startIcon={<Sparkles size={14} />}
                        onClick={onExtractGoals}
                        sx={{ 
                            color: '#818CF8', 
                            fontWeight: 800, 
                            textTransform: 'none', 
                            fontSize: '0.8rem',
                            px: 1.5,
                            py: 0.5,
                            borderRadius: '10px',
                            bgcolor: alpha('#818CF8', 0.05),
                            border: `1px solid ${alpha('#818CF8', 0.15)}`,
                            '&:hover': { 
                                color: '#A5B4FC', 
                                bgcolor: alpha('#818CF8', 0.1),
                                borderColor: '#818CF8'
                            } 
                        }}
                    >
                        Extract Goals
                    </Button>
                )}
                <Button
                    size="small"
                    startIcon={<ExternalLink size={14} />}
                    onClick={onOpen}
                    sx={{ 
                        color: 'rgba(255,255,255,0.6)', 
                        fontWeight: 800, 
                        textTransform: 'none', 
                        fontSize: '0.8rem',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '10px',
                        bgcolor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        '&:hover': { 
                            color: '#fff',
                            bgcolor: 'rgba(255,255,255,0.05)',
                            borderColor: 'rgba(255,255,255,0.2)'
                        } 
                    }}
                >
                    View
                </Button>
                <IconButton 
                    size="small" 
                    onClick={onUnlink} 
                    sx={{ 
                        color: 'rgba(255,255,255,0.2)', 
                        width: 32,
                        height: 32,
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.04)',
                        '&:hover': { 
                            color: '#FF453A', 
                            bgcolor: alpha('#FF453A', 0.08),
                            borderColor: alpha('#FF453A', 0.2)
                        } 
                    }}
                >
                    <Trash2 size={15} />
                </IconButton>
            </Stack>
        </Paper>
    );
}

function getActiveMentionToken(value: string, caret: number | null | undefined) {
  const cursor = typeof caret === 'number' ? caret : value.length;
  const before = value.slice(0, cursor);
  const match = before.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
  if (!match) return null;

  const start = before.lastIndexOf('@');
  if (start < 0) return null;

  const prefix = before.slice(0, start);
  if (prefix.length > 0) {
    const prev = prefix[prefix.length - 1];
    if (!/[\s(]/.test(prev)) return null;
  }

  return {
    query: match[1] || '',
    start,
    end: cursor,
  };
}

function renderMessageText(text: string): React.ReactNode {
  const MENTION_REGEX = /(^|[\s(])@([a-zA-Z0-9_]+)/g;
  const pieces: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const [full, prefix, username] = match;
    const start = match.index;
    const end = start + full.length;

    if (start > lastIndex) {
      pieces.push(text.slice(lastIndex, start));
    }

    if (prefix) {
      pieces.push(prefix);
    }

    pieces.push(
      <Box
        component="span"
        key={`${start}-${username}`}
        sx={{
          color: '#6366F1', // Ecosystem primary
          fontWeight: 800,
          bgcolor: 'rgba(99, 102, 241, 0.08)',
          px: 0.4,
          py: 0.1,
          borderRadius: '4px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9em',
          userSelect: 'text',
        }}
      >
        @{username}
      </Box>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    pieces.push(text.slice(lastIndex));
  }

  return <Box component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{pieces}</Box>;
}

interface ProjectDiscussionTabProps {
  project: Projects;
  fetchProjectData: () => void;
  user: any;
}

export function ProjectDiscussionTab({ project, fetchProjectData, user }: ProjectDiscussionTabProps) {
  const { showSuccess, showError } = useToast();
  const [activeMode, setActiveMode] = useState<'huddle' | 'private'>('huddle');
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Thread and Reactions states
  const [activeThreadParent, setActiveThreadParent] = useState<any | null>(null);
  const [threadInputText, setThreadInputText] = useState('');
  const [sendToGeneralChecked, setSendToGeneralChecked] = useState(true);
  const [messageAnchorEl, setMessageAnchorEl] = useState<{ el: HTMLElement, msg: any } | null>(null);

  // Mention Autocomplete States & Refs
  const [mentionAnchorEl, setMentionAnchorEl] = useState<HTMLDivElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionActiveRange, setMentionActiveRange] = useState<{ start: number; end: number } | null>(null);
  const [mentionInputSource, setMentionInputSource] = useState<'general' | 'thread'>('general');
  const mentionContainerRef = useRef<HTMLDivElement | null>(null);
  const threadMentionContainerRef = useRef<HTMLDivElement | null>(null);

  const closeMentionSuggestions = useCallback(() => {
    setMentionAnchorEl(null);
    setMentionResults([]);
    setMentionQuery('');
    setMentionActiveRange(null);
    setMentionLoading(false);
  }, []);

  const handleInputChange = useCallback((text: string, selectionStart: number, type: 'general' | 'thread') => {
    if (type === 'general') {
      setInputText(text);
    } else {
      setThreadInputText(text);
    }

    const caret = selectionStart;
    const active = getActiveMentionToken(text, caret);
    if (active) {
      setMentionQuery(active.query);
      setMentionActiveRange({ start: active.start, end: active.end });
      setMentionInputSource(type);
      setMentionAnchorEl(type === 'general' ? mentionContainerRef.current : threadMentionContainerRef.current);
    } else {
      closeMentionSuggestions();
    }
  }, [closeMentionSuggestions]);

  const replaceActiveMention = useCallback((item: any) => {
    if (!mentionActiveRange) return;
    const mention = `@${item.username || item.title.replace(/\s+/g, '').toLowerCase()}`;
    const currentValue = mentionInputSource === 'general' ? inputText : threadInputText;
    const nextValue = `${currentValue.slice(0, mentionActiveRange.start)}${mention} ${currentValue.slice(mentionActiveRange.end)}`;
    
    if (mentionInputSource === 'general') {
      setInputText(nextValue);
    } else {
      setThreadInputText(nextValue);
    }
    closeMentionSuggestions();
  }, [mentionActiveRange, mentionInputSource, inputText, threadInputText, closeMentionSuggestions]);

  useEffect(() => {
    if (!mentionQuery.trim()) {
      setMentionResults([]);
      setMentionLoading(false);
      return;
    }

    let alive = true;
    const timer = setTimeout(async () => {
      setMentionLoading(true);
      try {
        const docs = await searchGlobalUsers(mentionQuery.trim(), 6);
        if (!alive) return;
        const mapped = docs.map((doc: any) => {
          const id = doc?.$id || doc?.id || doc?.userId;
          const username = String(doc?.username || doc?.prefs?.username || doc?.displayName || doc?.name || '').replace(/^@+/, '').trim().toLowerCase();
          return {
            id,
            title: doc?.displayName || doc?.name || username || 'Profile',
            username: username || null,
            avatar: doc?.avatar || doc?.profilePicId || doc?.prefs?.profilePicId || null,
          };
        });
        setMentionResults(mapped);
      } catch (err) {
        if (alive) setMentionResults([]);
      } finally {
        if (alive) setMentionLoading(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [mentionQuery]);

  // Voice recording states and refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const metadata = React.useMemo(() => {
    try {
      return JSON.parse(project.metadata || '{}');
    } catch {
      return {};
    }
  }, [project.metadata]);

  const chatNoteId = metadata.discussionNoteId;
  const encryptedGroupId = metadata.encryptedGroupId;
  const messageEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeThreadParent]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadParent]);

  // Clean up timers on component unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Touch long press state/refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = React.useCallback((e: React.TouchEvent, msg: any) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    const currentTarget = e.currentTarget as HTMLElement;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setMessageAnchorEl({ el: currentTarget, msg });
      if (navigator.vibrate) navigator.vibrate(10);
    }, 600);
  }, []);

  const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      touchStartPosRef.current = null;
    }
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handleMessageClick = React.useCallback((e: React.MouseEvent, msg: any) => {
    e.stopPropagation();
    if (msg.parentCommentId) {
      const parent = messages.find(m => m.id === msg.parentCommentId);
      if (parent) {
        setActiveThreadParent(parent);
      }
    } else {
      setActiveThreadParent(msg);
    }
  }, [messages]);

  // Keep activeThreadParent fresh in real-time when messages change
  useEffect(() => {
    if (activeThreadParent) {
      const freshParent = messages.find(m => m.id === activeThreadParent.id);
      if (freshParent) {
        setActiveThreadParent(freshParent);
      }
    }
  }, [messages, activeThreadParent]);

  // Format voice recording seconds into beautiful MM:SS string
  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Safe JSON parser helper
  const parseMessageContent = React.useCallback((rawContent: string) => {
    if (rawContent?.startsWith('{') && rawContent?.endsWith('}')) {
      try {
        const json = JSON.parse(rawContent);
        return {
          text: json.text || '',
          type: json.type || 'text',
          voiceFileId: json.voiceFileId || null,
          sendToGeneral: json.sendToGeneral !== false
        };
      } catch {}
    }
    if (rawContent?.startsWith('__voice_note__:')) {
      return {
        text: 'Voice Note',
        type: 'voice',
        voiceFileId: rawContent.substring('__voice_note__:'.length),
        sendToGeneral: true
      };
    }
    return {
      text: rawContent || '',
      type: 'text',
      voiceFileId: null,
      sendToGeneral: true
    };
  }, []);

  // Load and Subscribe to Huddle Thread (Ghost Note)
  const loadHuddleMessages = useCallback(async () => {
    if (!chatNoteId) return;
    try {
      const res = await listComments(chatNoteId);
      
      // Load reactions for comments parallelly
      let commentReactions: Record<string, any[]> = {};
      try {
        const commentIds = res.rows.map((r: any) => r.$id);
        if (commentIds.length > 0) {
          const reactionsRes = await listReactions([
            Query.equal('targetType', 'comment'),
            Query.equal('targetId', commentIds),
            Query.limit(500)
          ]);
          reactionsRes.rows.forEach((react: any) => {
            if (!commentReactions[react.targetId]) commentReactions[react.targetId] = [];
            commentReactions[react.targetId].push(react);
          });
        }
      } catch (e) {
        console.warn('Failed to load reactions:', e);
      }

      const msgs = await Promise.all(
        res.rows.map(async (doc: any) => {
          let senderName = 'Collaborator';
          if (doc.userId === user?.$id) {
            senderName = user.name || 'You';
          } else {
            try {
              const profile = await AppwriteService.getProfile(doc.userId);
              if (profile) senderName = profile.name || 'Collaborator';
            } catch {}
          }
          return {
            id: doc.$id,
            senderId: doc.userId,
            senderName,
            content: doc.content,
            timestamp: new Date(doc.createdAt).getTime(),
            parentCommentId: doc.parentCommentId || null,
            reactions: commentReactions[doc.$id] || []
          };
        })
      );
      msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load huddle comments:', err);
    } finally {
      setLoading(false);
    }
  }, [chatNoteId, user]);

  useEffect(() => {
    if (activeMode !== 'huddle' || !chatNoteId) return;

    let active = true;
    setLoading(true);

    loadHuddleMessages();

    // Subscribe to comments and reactions
    const unsubscribe = client.subscribe(
      [
        `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.comments.documents`,
        `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.reactions.documents`
      ],
      async () => {
        if (!active) return;
        loadHuddleMessages();
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeMode, chatNoteId, loadHuddleMessages]);

  // Load and Subscribe to Private E2E Huddle (Connect Group)
  useEffect(() => {
    if (activeMode !== 'private' || !encryptedGroupId) return;

    let active = true;
    setLoading(true);

    const loadPrivateMessages = async () => {
      try {
        const res = await ChatService.getMessages(encryptedGroupId, 50, 0, user?.$id);
        if (!active) return;
        
        const msgs = await Promise.all(
          (res.rows || []).map(async (doc: any) => {
            let senderName = 'Secure Partner';
            if (doc.senderId === user?.$id) {
              senderName = user.name || 'You';
            } else {
              try {
                const profile = await AppwriteService.getProfile(doc.senderId);
                if (profile) senderName = profile.name || 'Secure Partner';
              } catch {}
            }
            return {
              id: doc.$id,
              senderId: doc.senderId,
              senderName,
              content: doc.content,
              timestamp: new Date(doc.createdAt).getTime(),
              parentCommentId: null,
              reactions: []
            };
          })
        );
        msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
        setMessages(msgs);
      } catch (err) {
        console.error('Failed to load private messages:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPrivateMessages();

    // Subscribe to messages in Connect
    const unsubscribe = client.subscribe(
      `databases.chat.collections.messages.documents`,
      async (response: any) => {
        if (!active) return;
        const events = response.events;
        const payload = response.payload;

        if (events.some((e: string) => e.includes('.create'))) {
          if (payload.conversationId === encryptedGroupId) {
            let senderName = 'Secure Partner';
            if (payload.senderId === user?.$id) {
              senderName = user.name || 'You';
            } else {
              try {
                const profile = await AppwriteService.getProfile(payload.senderId);
                if (profile) senderName = profile.name || 'Secure Partner';
              } catch {}
            }

            const msg = {
              id: payload.$id,
              senderId: payload.senderId,
              senderName,
              content: payload.content,
              timestamp: new Date(payload.createdAt).getTime(),
              parentCommentId: null,
              reactions: []
            };

            setMessages(prev => {
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
            });
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [activeMode, encryptedGroupId, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    setSending(true);

    try {
      if (activeMode === 'huddle' && chatNoteId) {
        // Publish comments in standardized JSON format
        await createComment(chatNoteId, JSON.stringify({
          text: inputText.trim(),
          type: 'text',
          sendToGeneral: true
        }));
      } else if (activeMode === 'private' && encryptedGroupId) {
        const { account: clientAcc } = await import('@/lib/appwrite/client');
        const { jwt } = await clientAcc.createJWT();
        await createMessageAction({
          conversationId: encryptedGroupId,
          senderId: user?.$id || '',
          content: inputText.trim(),
          type: 'text',
          jwt
        });
      }
      setInputText('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // Toggle reaction in database
  const handleReact = async (msgId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    try {
      const existingReaction = msg.reactions?.find(
        (r: any) => r.userId === user.$id && r.emoji === emoji
      );
      if (existingReaction) {
        await deleteReaction(existingReaction.$id);
      } else {
        await createReaction({
          userId: user.$id,
          targetId: msgId,
          targetType: TargetType.COMMENT,
          emoji: emoji
        });
      }
      loadHuddleMessages();
    } catch (e) {
      console.error('Failed to toggle reaction:', e);
    }
  };

  // Voice note toggle logic (start/stop)
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        let options = { audioBitsPerSecond: 16000 };
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          (options as any).mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          (options as any).mimeType = 'audio/ogg;codecs=opus';
        }
        
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (recordingTimerRef.current) {
            clearTimeout(recordingTimerRef.current);
            recordingTimerRef.current = null;
          }
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
          
          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());

          setSending(true);
          try {
            const uploaded = await StorageService.uploadFile(audioFile, 'voice');
            if (chatNoteId) {
              await createComment(chatNoteId, JSON.stringify({
                text: 'Voice Note',
                type: 'voice',
                voiceFileId: uploaded.$id,
                sendToGeneral: true
              }));
            }
          } catch (error) {
            console.error('Failed to send voice note comment:', error);
          } finally {
            setSending(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingSeconds(0);
        
        recordingIntervalRef.current = setInterval(() => {
          setRecordingSeconds(s => s + 1);
        }, 1000);

        // Limit recording to 120 seconds
        recordingTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
        }, 120000);

      } catch (err) {
        console.error("Failed to start recording:", err);
        alert("Microphone access is required for voice notes.");
      }
    }
  };

  const handleInitHuddle = async () => {
    setLoading(true);
    try {
      await createGhostNoteForProject(project.$id, `${project.title} Discussion`);
      fetchProjectData();
    } catch (err) {
      console.error('Failed to initialize huddle thread:', err);
    } finally {
      setLoading(false);
    }
  };

  const hasChat = activeMode === 'huddle' ? !!chatNoteId : !!encryptedGroupId;

  // Split messages into general huddle list vs thread huddle replies
  const generalMessages = useMemo(() => {
    return messages.filter(m => {
      if (!m.parentCommentId) return true;
      const parsed = parseMessageContent(m.content);
      return parsed.sendToGeneral !== false;
    });
  }, [messages, parseMessageContent]);

  const threadReplies = useMemo(() => {
    const groups: Record<string, any[]> = {};
    messages.forEach(m => {
      if (m.parentCommentId) {
        if (!groups[m.parentCommentId]) groups[m.parentCommentId] = [];
        groups[m.parentCommentId].push(m);
      }
    });
    return groups;
  }, [messages]);

  const threadMessages = useMemo(() => {
    if (!activeThreadParent) return [];
    return messages.filter(m => m.parentCommentId === activeThreadParent.id);
  }, [messages, activeThreadParent]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: { xs: 450, md: 600 }, 
      bgcolor: '#0A0908', 
      borderRadius: '24px', 
      border: '1px solid rgba(255,255,255,0.06)', 
      overflow: 'hidden',
      position: 'relative'
    }}>
      
      {/* Mode Control & Toolbar */}
      <Stack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="center" 
        sx={{ 
          p: { xs: 1.25, sm: 1.5 }, 
          borderBottom: '1px solid rgba(255,255,255,0.06)', 
          bgcolor: 'rgba(10, 9, 8, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 2 
        }}
      >
        <Stack direction="row" spacing={1} sx={{ p: 0.5, bgcolor: '#161412', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
          <Button 
            size="small"
            onClick={() => { setActiveMode('huddle'); setMessages([]); }}
            sx={{
              px: 2, py: 0.75, borderRadius: '8px', textTransform: 'none', fontWeight: 800, fontSize: '0.8rem',
              bgcolor: activeMode === 'huddle' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              color: activeMode === 'huddle' ? '#6366F1' : 'rgba(255,255,255,0.4)',
              '&:hover': { bgcolor: activeMode === 'huddle' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255,255,255,0.02)' }
            }}
          >
            Thread
          </Button>
          <Button 
            size="small"
            disabled
            title="Secure Hangout is disabled for Project Discussions"
            sx={{
              px: 2, py: 0.75, borderRadius: '8px', textTransform: 'none', fontWeight: 800, fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.2)',
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.15)' }
            }}
          >
            Secure Hangout
          </Button>
        </Stack>
      </Stack>

      {/* Main Panel Content */}
      <Box sx={{ 
        flex: 1, 
        minHeight: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'relative', 
        overflow: 'hidden',
        m: 1.5,
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.05)',
        bgcolor: '#080706' 
      }}>
        <MuralPattern />

        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(10,9,8,0.7)', zIndex: 3 }}>
            <CircularProgress size={28} sx={{ color: '#6366F1' }} />
          </Box>
        )}

        {!hasChat ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center', position: 'relative', zIndex: 1 }}>
            {activeMode === 'huddle' ? (
              <>
                <Box sx={{ width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.15)', mb: 2.5 }}>
                  <Globe size={26} />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Initialize Public Huddle</Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 360, lineHeight: 1.5, mb: 3 }}>
                  A temporary public comment thread lets your team coordinate tasks, tag members, and comment on assets. Messages are public to project participants and automatically clean up in 7 days.
                </Typography>
                <Button 
                  onClick={handleInitHuddle}
                  sx={{ bgcolor: '#6366F1', color: '#fff', fontWeight: 800, fontSize: '0.8rem', py: 1.25, px: 3, borderRadius: '10px', textTransform: 'none', '&:hover': { bgcolor: '#575CF0' } }}
                >
                  Start Huddle
                </Button>
              </>
            ) : null}
          </Box>
        ) : (
          /* Active Chat Viewport (Split Thread Layout) */
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'row', 
            minHeight: 0, 
            position: 'relative', 
            zIndex: 1,
            overflow: 'hidden'
          }}>
            {/* Left Side: General Huddle Chat List */}
            <Box sx={{ 
              flex: activeThreadParent ? { xs: 0, md: 0.6 } : 1, 
              display: activeThreadParent ? { xs: 'none', md: 'flex' } : 'flex',
              flexDirection: 'column', 
              minHeight: 0,
              borderRight: activeThreadParent ? '1px solid rgba(255,255,255,0.06)' : 'none'
            }}>
              <Box sx={{ 
                flex: 1, 
                overflowY: 'auto', 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 1.75,
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.06)', borderRadius: '10px' },
                '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.12)' }
              }}>
                {generalMessages.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                    <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 700 }}>No messages yet. Start the discussion!</Typography>
                  </Box>
                ) : (
                  generalMessages.map((msg) => {
                    const isSelf = msg.senderId === user?.$id;
                    const parsed = parseMessageContent(msg.content);
                    const replyCount = threadReplies[msg.id]?.length || 0;

                    return (
                      <Box key={msg.id} sx={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, display: 'block', mb: 0.75, textAlign: isSelf ? 'right' : 'left' }}>
                          {msg.senderName} {msg.parentCommentId && '• Thread Reply'}
                        </Typography>
                        <Paper 
                          elevation={0}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setMessageAnchorEl({ el: e.currentTarget, msg });
                          }}
                          onClick={(e) => handleMessageClick(e, msg)}
                          onTouchStart={(e) => handleTouchStart(e, msg)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          sx={{
                            p: parsed.type === 'voice' ? 1.25 : 1.75,
                            borderRadius: isSelf ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                            bgcolor: isSelf ? '#1C1A18' : '#161412', 
                            backgroundImage: 'none',
                            border: '1px solid #23211F',
                            borderRight: isSelf ? '3px solid #6366F1' : '1px solid #23211F',
                            borderLeft: !isSelf ? '3px solid #34322F' : '1px solid #23211F',
                            color: isSelf ? '#FFFFFF' : '#F5F2ED',
                            boxShadow: '0 4px 12px -4px rgba(0,0,0,0.8)',
                            position: 'relative',
                            zIndex: 2,
                            cursor: 'context-menu',
                            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: '0 6px 16px -4px rgba(0,0,0,0.9)',
                            }
                          }}
                        >
                          {parsed.type === 'voice' && parsed.voiceFileId ? (
                            <VoiceMessage url={StorageService.getFileView(parsed.voiceFileId, 'voice')} />
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {renderMessageText(parsed.text)}
                            </Typography>
                          )}
                        </Paper>

                        {/* Message Reactions Badge Group */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>
                            {Object.entries(
                              msg.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                                if (!acc[r.emoji]) acc[r.emoji] = [];
                                acc[r.emoji].push(r.userId);
                                return acc;
                              }, {})
                            ).map(([emoji, userIds]) => {
                              const hasReacted = (userIds as any[]).includes(user?.$id);
                              return (
                                <Chip
                                  key={emoji}
                                  label={`${emoji} ${(userIds as any[]).length}`}
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReact(msg.id, emoji);
                                  }}
                                  sx={{
                                    bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                    color: hasReacted ? '#818CF8' : 'rgba(255,255,255,0.5)',
                                    border: `1px solid ${hasReacted ? alpha('#818CF8', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    '&:hover': {
                                      bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.08)'
                                    }
                                  }}
                                />
                              );
                            })}
                          </Box>
                        )}

                        {/* Thread Replies Button */}
                        {replyCount > 0 && (
                          <Button
                            size="small"
                            startIcon={<MessageSquare size={12} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveThreadParent(msg);
                            }}
                            sx={{
                              alignSelf: isSelf ? 'flex-end' : 'flex-start',
                              mt: 0.75,
                              color: '#818CF8',
                              fontWeight: 800,
                              textTransform: 'none',
                              fontSize: '0.75rem',
                              bgcolor: 'rgba(99,102,241,0.04)',
                              px: 1.5,
                              borderRadius: '8px',
                              border: '1px solid rgba(99,102,241,0.1)',
                              '&:hover': { bgcolor: 'rgba(99,102,241,0.08)', borderColor: '#818CF8' }
                            }}
                          >
                            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                          </Button>
                        )}

                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', display: 'block', mt: 0.5, textAlign: isSelf ? 'right' : 'left', fontWeight: 700 }}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </Box>

              {/* Input Form */}
              <Box 
                component="form" 
                onSubmit={handleSendMessage} 
                sx={{ 
                  p: { xs: 1.25, sm: 1.5 }, 
                  borderTop: '1px solid rgba(255,255,255,0.05)', 
                  bgcolor: 'rgba(10, 9, 8, 0.95)',
                  backdropFilter: 'blur(12px)',
                  position: 'relative',
                  zIndex: 2
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  {activeMode === 'huddle' && chatNoteId && (
                    <IconButton
                      onClick={toggleRecording}
                      disabled={sending}
                      sx={{
                        color: isRecording ? '#ff4d4d' : 'rgba(255,255,255,0.4)',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor: '#161412',
                        border: `1px solid ${isRecording ? '#ff4d4d' : 'rgba(255,255,255,0.05)'}`,
                        borderRadius: '12px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: '#1C1A18',
                          borderColor: isRecording ? '#ff4d4d' : '#6366F1',
                          color: '#fff',
                        },
                      }}
                    >
                      {isRecording ? <Square size={18} fill="#ff4d4d" /> : <Mic size={20} strokeWidth={2} />}
                    </IconButton>
                  )}

                  <Box ref={mentionContainerRef} sx={{ flexGrow: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {isRecording && (
                      <Box sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: '#0A0908',
                        borderRadius: '12px',
                        border: '1px solid #ff4d4d',
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        gap: 2,
                        zIndex: 2,
                        animation: 'pulse 2s infinite ease-in-out',
                        '@keyframes pulse': {
                          '0%, 100%': { borderColor: 'rgba(255,77,77,0.3)', boxShadow: '0 0 4px rgba(255,77,77,0.1)' },
                          '50%': { borderColor: 'rgba(255,77,77,1)', boxShadow: '0 0 12px rgba(255,77,77,0.2)' }
                        }
                      }}>
                        <Box sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#ff4d4d',
                          animation: 'blink 1s infinite',
                          '@keyframes blink': {
                            '0%, 100%': { opacity: 0.3 },
                            '50%': { opacity: 1 }
                          }
                        }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 800, flexGrow: 1 }}>
                          Recording audio note... click square to send
                        </Typography>
                        <Typography sx={{ color: '#ff4d4d', fontSize: '0.85rem', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                          {formatRecordingTime(recordingSeconds)}
                        </Typography>
                      </Box>
                    )}

                    <TextField
                      fullWidth
                      size="small"
                      value={inputText}
                      disabled={isRecording}
                      onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length, 'general')}
                      onBlur={() => {
                        setTimeout(() => closeMentionSuggestions(), 120);
                      }}
                      onFocus={(e) => {
                        const caret = e.currentTarget.selectionStart ?? inputText.length;
                        const active = getActiveMentionToken(inputText, caret);
                        if (active) {
                          setMentionQuery(active.query);
                          setMentionActiveRange({ start: active.start, end: active.end });
                          setMentionInputSource('general');
                          setMentionAnchorEl(mentionContainerRef.current);
                        }
                      }}
                      placeholder={
                        isRecording 
                          ? "Recording in progress..." 
                          : activeMode === 'huddle' 
                            ? "Type huddle message..." 
                            : "Type cryptographically secure message..."
                      }
                      variant="standard"
                      InputProps={{
                        disableUnderline: true,
                        sx: {
                          bgcolor: '#161412',
                          borderRadius: '12px',
                          color: 'white',
                          px: 2,
                          py: 1.25,
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          border: '1px solid rgba(255,255,255,0.05)',
                          transition: 'all 0.2s ease',
                          '&:hover': { borderColor: 'rgba(255,255,255,0.1)' },
                          '&.Mui-focused': { borderColor: '#6366F1' }
                        }
                      }}
                    />
                  </Box>
                  
                  <IconButton 
                    type="submit"
                    disabled={!inputText.trim() || sending || isRecording}
                    sx={{
                      bgcolor: '#6366F1',
                      color: '#fff',
                      borderRadius: '12px',
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: '#575CF0' },
                      '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.1)' }
                    }}
                  >
                    <Send size={18} />
                  </IconButton>
                </Stack>
              </Box>
            </Box>

            {/* Right Side: Active Thread Panel */}
            {activeThreadParent && (
              <Box sx={{ 
                flex: { xs: 1, md: 0.4 }, 
                display: 'flex', 
                flexDirection: 'column', 
                minHeight: 0,
                bgcolor: '#0E0C0A', 
                borderLeft: '1px solid rgba(255,255,255,0.06)',
                position: 'relative',
                zIndex: 2
              }}>
                <Stack 
                  direction="row" 
                  justifyContent="space-between" 
                  alignItems="center" 
                  sx={{ 
                    p: 1.5, 
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    bgcolor: 'rgba(10, 9, 8, 0.5)' 
                  }}
                >
                  <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton 
                      size="small" 
                      onClick={() => setActiveThreadParent(null)} 
                      sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
                    >
                      <ChevronLeft size={16} />
                    </IconButton>
                    <Typography variant="body2" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
                      Thread replies
                    </Typography>
                  </Stack>
                  <IconButton 
                    size="small" 
                    onClick={() => setActiveThreadParent(null)} 
                    sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}
                  >
                    <X size={16} />
                  </IconButton>
                </Stack>

                <Box sx={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  p: 2, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  '&::-webkit-scrollbar': { width: '4px' },
                  '&::-webkit-scrollbar-track': { background: 'transparent' },
                  '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.06)', borderRadius: '10px' }
                }}>
                  <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 2, mb: 1 }}>
                    <Typography variant="caption" sx={{ color: '#818CF8', fontWeight: 900, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Thread initialized by {activeThreadParent.senderName}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      <Paper
                        elevation={0}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMessageAnchorEl({ el: e.currentTarget, msg: activeThreadParent });
                        }}
                        onTouchStart={(e) => handleTouchStart(e, activeThreadParent)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        sx={{
                          p: 1.5,
                          borderRadius: '4px 20px 20px 20px',
                          bgcolor: '#161412',
                          border: '1px solid #23211F',
                          borderLeft: '3px solid #818CF8',
                          color: '#F5F2ED',
                          cursor: 'context-menu',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            bgcolor: '#1C1A18'
                          }
                        }}
                      >
                        {(() => {
                          const parsedParent = parseMessageContent(activeThreadParent.content);
                          if (parsedParent.type === 'voice' && parsedParent.voiceFileId) {
                            return <VoiceMessage url={StorageService.getFileView(parsedParent.voiceFileId, 'voice')} />;
                          }
                          return (
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {renderMessageText(parsedParent.text)}
                            </Typography>
                          );
                        })()}
                      </Paper>

                      {/* Parent message Reactions Badge Group */}
                      {activeThreadParent.reactions && activeThreadParent.reactions.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, alignSelf: 'flex-start' }}>
                          {Object.entries(
                            activeThreadParent.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                              if (!acc[r.emoji]) acc[r.emoji] = [];
                              acc[r.emoji].push(r.userId);
                              return acc;
                            }, {})
                          ).map(([emoji, userIds]) => {
                            const hasReacted = (userIds as any[]).includes(user?.$id);
                            return (
                              <Chip
                                key={emoji}
                                label={`${emoji} ${(userIds as any[]).length}`}
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReact(activeThreadParent.id, emoji);
                                }}
                                sx={{
                                  bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                  color: hasReacted ? '#818CF8' : 'rgba(255,255,255,0.5)',
                                  border: `1px solid ${hasReacted ? alpha('#818CF8', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                  height: 20,
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  '&:hover': {
                                    bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.08)'
                                  }
                                }}
                              />
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  </Box>

                  {threadMessages.length === 0 ? (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35, py: 4 }}>
                      <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 700 }}>No replies yet. Send a reply below!</Typography>
                    </Box>
                  ) : (
                    threadMessages.map(reply => {
                      const isSelfReply = reply.senderId === user?.$id;
                      const parsedReply = parseMessageContent(reply.content);
                      return (
                        <Box key={reply.id} sx={{ alignSelf: isSelfReply ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column' }}>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, display: 'block', mb: 0.5, textAlign: isSelfReply ? 'right' : 'left' }}>
                            {reply.senderName}
                          </Typography>
                          <Paper
                            elevation={0}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setMessageAnchorEl({ el: e.currentTarget, msg: reply });
                            }}
                            onTouchStart={(e) => handleTouchStart(e, reply)}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            sx={{
                              p: parsedReply.type === 'voice' ? 1.25 : 1.75,
                              borderRadius: isSelfReply ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                              bgcolor: isSelfReply ? '#1C1A18' : '#161412',
                              border: '1px solid #23211F',
                              borderRight: isSelfReply ? '3px solid #6366F1' : '1px solid #23211F',
                              borderLeft: !isSelfReply ? '3px solid #34322F' : '1px solid #23211F',
                              color: isSelfReply ? '#FFFFFF' : '#F5F2ED',
                              cursor: 'context-menu',
                              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                              zIndex: 2,
                              '&:hover': {
                                  transform: 'translateY(-1px)',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                              }
                            }}
                          >
                            {parsedReply.type === 'voice' && parsedReply.voiceFileId ? (
                              <VoiceMessage url={StorageService.getFileView(parsedReply.voiceFileId, 'voice')} />
                            ) : (
                              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>
                                {renderMessageText(parsedReply.text)}
                              </Typography>
                            )}
                          </Paper>

                          {/* Reply Reactions Badge Group */}
                          {reply.reactions && reply.reactions.length > 0 && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, alignSelf: isSelfReply ? 'flex-end' : 'flex-start' }}>
                              {Object.entries(
                                reply.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                                  if (!acc[r.emoji]) acc[r.emoji] = [];
                                  acc[r.emoji].push(r.userId);
                                  return acc;
                                }, {})
                              ).map(([emoji, userIds]) => {
                                const hasReacted = (userIds as any[]).includes(user?.$id);
                                return (
                                  <Chip
                                    key={emoji}
                                    label={`${emoji} ${(userIds as any[]).length}`}
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReact(reply.id, emoji);
                                    }}
                                    sx={{
                                      bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                      color: hasReacted ? '#818CF8' : 'rgba(255,255,255,0.5)',
                                      border: `1px solid ${hasReacted ? alpha('#818CF8', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                      height: 20,
                                      fontSize: '0.7rem',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      '&:hover': {
                                        bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.08)'
                                      }
                                    }}
                                  />
                                );
                              })}
                            </Box>
                          )}

                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', display: 'block', mt: 0.5, textAlign: isSelfReply ? 'right' : 'left', fontWeight: 700 }}>
                            {new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      );
                    })
                  )}
                  <div ref={threadEndRef} />
                </Box>

                <Box 
                  component="form" 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!threadInputText.trim() || sending) return;
                    setSending(true);
                    try {
                      await createComment(chatNoteId, JSON.stringify({
                        text: threadInputText.trim(),
                        type: 'text',
                        sendToGeneral: sendToGeneralChecked
                      }), activeThreadParent.id);
                      setThreadInputText('');
                      loadHuddleMessages();
                    } catch (err) {
                      console.error('Failed to send thread reply:', err);
                    } finally {
                      setSending(false);
                    }
                  }}
                  sx={{ 
                    p: 1.5, 
                    borderTop: '1px solid rgba(255,255,255,0.05)', 
                    bgcolor: 'rgba(10, 9, 8, 0.95)' 
                  }}
                >
                  <Stack spacing={1}>
                    <Stack ref={threadMentionContainerRef} sx={{ position: 'relative', width: '100%' }} direction="row" spacing={1} alignItems="center">
                      <TextField
                        fullWidth
                        size="small"
                        value={threadInputText}
                        onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length, 'thread')}
                        onBlur={() => {
                          setTimeout(() => closeMentionSuggestions(), 120);
                        }}
                        onFocus={(e) => {
                          const caret = e.currentTarget.selectionStart ?? threadInputText.length;
                          const active = getActiveMentionToken(threadInputText, caret);
                          if (active) {
                            setMentionQuery(active.query);
                            setMentionActiveRange({ start: active.start, end: active.end });
                            setMentionInputSource('thread');
                            setMentionAnchorEl(threadMentionContainerRef.current);
                          }
                        }}
                        placeholder="Reply in thread..."
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: {
                            bgcolor: '#161412',
                            borderRadius: '8px',
                            color: 'white',
                            px: 1.5,
                            py: 1,
                            fontWeight: 600,
                            fontSize: '0.8rem',
                            border: '1px solid rgba(255,255,255,0.05)'
                          }
                        }}
                      />
                      <IconButton 
                        type="submit"
                        disabled={!threadInputText.trim() || sending}
                        sx={{
                          bgcolor: '#6366F1',
                          color: '#fff',
                          borderRadius: '8px',
                          width: 36,
                          height: 36,
                          '&:hover': { bgcolor: '#575CF0' }
                        }}
                      >
                        <Send size={14} />
                      </IconButton>
                    </Stack>

                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={sendToGeneralChecked}
                          onChange={(e) => setSendToGeneralChecked(e.target.checked)}
                          sx={{
                            color: 'rgba(255,255,255,0.3)',
                            p: 0.5,
                            '&.Mui-focused': { color: '#6366F1' },
                            '&.Mui-checked': { color: '#6366F1' }
                          }}
                        />
                      }
                      label="Also send to general huddle"
                      componentsProps={{
                        typography: {
                          sx: {
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            color: 'rgba(255,255,255,0.5)',
                            userSelect: 'none'
                          }
                        }
                      }}
                    />
                  </Stack>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Message Options / Reactions Popover Menu */}
      <Popover
        open={Boolean(messageAnchorEl)}
        anchorEl={messageAnchorEl?.el}
        onClose={() => setMessageAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            bgcolor: '#13110F',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            p: 1.5,
            color: '#fff',
            backgroundImage: 'none',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
          }
        }}
      >
        <Stack spacing={1.5}>
          {/* Reaction Quick Picker */}
          <Stack direction="row" spacing={1} sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)', pb: 1 }}>
            {['👍', '❤️', '🔥', '😂', '🙌', '😮'].map(emoji => (
              <IconButton
                key={emoji}
                size="small"
                onClick={() => {
                  if (messageAnchorEl?.msg) {
                    handleReact(messageAnchorEl.msg.id, emoji);
                    setMessageAnchorEl(null);
                  }
                }}
                sx={{ 
                  fontSize: '1.25rem',
                  p: 0.5,
                  borderRadius: '8px',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', transform: 'scale(1.15)' },
                  transition: 'all 0.15s ease'
                }}
              >
                {emoji}
              </IconButton>
            ))}
          </Stack>

          {/* Action Items */}
          <Stack spacing={0.5}>
            <Button
              size="small"
              startIcon={<MessageSquare size={14} />}
              onClick={() => {
                if (messageAnchorEl?.msg) {
                  const msg = messageAnchorEl.msg;
                  if (msg.parentCommentId) {
                    const parent = messages.find(m => m.id === msg.parentCommentId);
                    if (parent) {
                      setActiveThreadParent(parent);
                    }
                  } else {
                    setActiveThreadParent(msg);
                  }
                  setMessageAnchorEl(null);
                }
              }}
              sx={{ 
                justifyContent: 'flex-start', 
                color: 'rgba(255,255,255,0.7)', 
                textTransform: 'none', 
                fontWeight: 700,
                px: 1.5,
                py: 0.75,
                borderRadius: '8px',
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' }
              }}
            >
              Reply in Thread
            </Button>
            <Button
              size="small"
              startIcon={<Copy size={14} />}
              onClick={() => {
                if (messageAnchorEl?.msg) {
                  const content = parseMessageContent(messageAnchorEl.msg.content);
                  navigator.clipboard.writeText(content.text);
                  showSuccess('Message copied to clipboard');
                  setMessageAnchorEl(null);
                }
              }}
              sx={{ 
                justifyContent: 'flex-start', 
                color: 'rgba(255,255,255,0.7)', 
                textTransform: 'none', 
                fontWeight: 700,
                px: 1.5,
                py: 0.75,
                borderRadius: '8px',
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' }
              }}
            >
              Copy Text
            </Button>
            {messageAnchorEl?.msg?.senderId === user?.$id && (
              <Button
                size="small"
                startIcon={<Trash2 size={14} />}
                onClick={async () => {
                  if (messageAnchorEl?.msg) {
                    try {
                      await databases.deleteRow(APPWRITE_CONFIG.DATABASES.NOTE, 'comments', messageAnchorEl.msg.id);
                      showSuccess('Message deleted');
                      loadHuddleMessages();
                    } catch (e) {
                      console.error('Delete message failed:', e);
                    }
                    setMessageAnchorEl(null);
                  }
                }}
                sx={{ 
                  justifyContent: 'flex-start', 
                  color: '#FF453A', 
                  textTransform: 'none', 
                  fontWeight: 700,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: '8px',
                  '&:hover': { bgcolor: alpha('#FF453A', 0.08) }
                }}
              >
                Delete Message
              </Button>
            )}
          </Stack>
        </Stack>
      </Popover>

      {/* Mention Autocomplete Popover */}
      <Popover
        open={Boolean(mentionAnchorEl && (mentionQuery || mentionResults.length))}
        anchorEl={mentionAnchorEl}
        onClose={closeMentionSuggestions}
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            mt: 1,
            width: { xs: 'calc(100vw - 32px)', sm: 380 },
            maxWidth: 'calc(100vw - 32px)',
            bgcolor: 'rgba(16, 14, 12, 0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            borderRadius: 4,
            overflow: 'hidden',
            zIndex: 1400,
          },
          onMouseDown: (event: any) => event.preventDefault(),
        }}
      >
        <Box sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', fontWeight: 800 }}>
            Mention profiles
          </Typography>
          {mentionLoading ? <CircularProgress size={12} sx={{ color: '#6366F1' }} /> : null}
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <List dense sx={{ p: 0 }}>
          {mentionResults.length === 0 && !mentionLoading ? (
            <Box sx={{ px: 1.5, py: 1.25 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                No matches yet.
              </Typography>
            </Box>
          ) : (
            mentionResults.map((item) => (
              <MenuItem
                key={item.id}
                onClick={() => replaceActiveMention(item)}
                sx={{
                  py: 1,
                  px: 1.25,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                }}
              >
                <Avatar
                  src={item.avatar || undefined}
                  sx={{
                    width: 28,
                    height: 28,
                    bgcolor: alpha('#6366F1', 0.14),
                    color: '#6366F1',
                    fontSize: 11,
                    fontWeight: 900,
                  }}
                >
                  {item.title.charAt(0).toUpperCase()}
                </Avatar>
                <ListItemText
                  primary={item.title}
                  secondary={item.username ? `@${item.username}` : null}
                  primaryTypographyProps={{ sx: { fontSize: '0.85rem', fontWeight: 800, color: 'white' } }}
                  secondaryTypographyProps={{ sx: { fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' } }}
                />
              </MenuItem>
            ))
          )}
        </List>
      </Popover>
    </Box>
  );
}

interface ProjectSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  project: Projects;
  onSave: (title: string, summary: string, status: 'active' | 'completed' | 'archived' | 'paused' | 'on_hold') => Promise<void>;
}

function ProjectSettingsDrawer({ open, onClose, project, onSave }: ProjectSettingsDrawerProps) {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'paused' | 'on_hold'>('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && project) {
      setTitle(project.title || '');
      setSummary(project.summary || '');
      setStatus((project.status || 'active') as any);
    }
  }, [open, project]);

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(title.trim(), summary.trim(), status);
      onClose();
    } catch {
      // Handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: {
          bgcolor: '#161412', // Deep Ash
          borderTop: '1px solid #1C1A18', // Rim/Border Ash
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          maxHeight: '60vh',
          height: 'auto',
          color: '#fff',
          backgroundImage: 'none',
          p: { xs: 3, sm: 4 },
        }
      }}
    >
      <Box sx={{ width: 40, height: 4, bgcolor: 'rgba(255,255,255,0.12)', borderRadius: '2px', mx: 'auto', mb: 3 }} />
      
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', mb: 0.5 }}>
            Project Settings
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
            Configure and synchronize details for this workspace
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
          <X size={20} />
        </IconButton>
      </Stack>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', mb: 1, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)' }}>
                Project Title
              </Typography>
              <TextField
                fullWidth
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                variant="outlined"
                placeholder="Give your project a title"
                InputProps={{
                  sx: {
                    bgcolor: '#0A0908', // Inset Ash/Pitch Black
                    borderRadius: '16px',
                    color: 'white',
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 700,
                    border: '1px solid #1C1A18',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&.Mui-focused': { borderColor: '#6366F1' },
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  }
                }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', mb: 1, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)' }}>
                Description / Summary
              </Typography>
              <TextField
                fullWidth
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                multiline
                rows={4}
                variant="outlined"
                placeholder="Explain the scope and goals of this project..."
                InputProps={{
                  sx: {
                    bgcolor: '#0A0908', // Inset Ash/Pitch Black
                    borderRadius: '16px',
                    color: 'white',
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 500,
                    lineHeight: 1.6,
                    border: '1px solid #1C1A18',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&.Mui-focused': { borderColor: '#6366F1' },
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  }
                }}
              />
            </Box>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3} sx={{ height: '100%', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.72rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', mb: 1, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)' }}>
                Project Status
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  sx={{
                    bgcolor: '#0A0908',
                    borderRadius: '16px',
                    color: 'white',
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 700,
                    border: '1px solid #1C1A18',
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    '&:hover': { borderColor: 'rgba(255,255,255,0.15)' },
                    '&.Mui-focused': { borderColor: '#6366F1' }
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: '#161412',
                        border: '1px solid #1C1A18',
                        borderRadius: '16px',
                        color: 'white',
                        mt: 1,
                        '& .MuiMenuItem-root': {
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          py: 1.25,
                          fontFamily: 'var(--font-satoshi)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                          '&.Mui-selected': { bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#6366F1' }
                        }
                      }
                    }
                  }}
                >
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="paused">Paused</MenuItem>
                  <MenuItem value="on_hold">On Hold</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Stack direction="row" spacing={2} sx={{ mt: 'auto', pt: 2 }}>
              <Button
                variant="outlined"
                onClick={onClose}
                sx={{
                  flex: 1,
                  borderRadius: '14px',
                  borderColor: '#1C1A18',
                  color: 'rgba(255,255,255,0.6)',
                  fontWeight: 800,
                  fontFamily: 'var(--font-satoshi)',
                  textTransform: 'none',
                  py: 1.6,
                  '&:hover': { borderColor: 'rgba(255,255,255,0.15)', bgcolor: alpha('#fff', 0.01) }
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                disabled={saving || !title.trim()}
                onClick={handleSave}
                sx={{
                  flex: 1,
                  borderRadius: '14px',
                  bgcolor: '#6366F1',
                  color: '#000',
                  fontWeight: 900,
                  fontFamily: 'var(--font-satoshi)',
                  textTransform: 'none',
                  py: 1.6,
                  '&:hover': { bgcolor: alpha('#6366F1', 0.9) }
                }}
              >
                {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
              </Button>
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Drawer>
  );
}
