'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ID } from 'appwrite';
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
  Switch,
  Skeleton,
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
  RefreshCw,
  Check,
} from 'lucide-react';
import { ProjectsService } from '@/lib/appwrite/projects';
import { SourceControlService, SourceControlRow } from '@/lib/services/sourceControl';
import { useToast } from '@/components/ui/Toast';
import toast from 'react-hot-toast';
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
  deleteGhostNoteForProject,
  updateRow
} from '@/lib/actions/client-ops';

import { account } from '@/lib/appwrite/client';
import { getResourceCollaboratorsSecure, getUsersByIdsSecure } from '@/lib/actions/secure-ops';

import { createComment, listComments, createReaction, deleteReaction, listReactions, deleteReactionsForTarget } from '@/lib/appwrite/note';
import { TargetType } from '@/types/appwrite';
import { client } from '@/lib/appwrite/client';
import { ChatService } from '@/lib/services/chat';
import { createMessageAction } from '@/lib/actions/chat';
import { Send, Clock, Mic, Square, Tag, ShieldCheck, Camera, PhoneCall, FileSpreadsheet, X, Copy, ChevronLeft, Info } from 'lucide-react';
import MuralPattern from '@/components/chat/MuralPattern';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { StorageService } from '@/lib/services/storage';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { ProjectDiscussionSidebar } from '@/components/projects/ProjectDiscussionSidebar';
import { useLayout } from '@/context/LayoutContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { MultiSectionContainer } from '@/context/SectionContext';
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
  const { openSidebar, closeSidebar } = useDynamicSidebar();
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

  const [rawProject, setRawProject] = useState<Projects | null>(null);
  const [projectObjects, setProjectObjects] = useState<ProjectObjects[]>([]);
  const [loading, setLoading] = useState(true);

  const project = rawProject || (loading ? {
    title: 'Loading Project...',
    summary: 'Fetching active workspace details and linking components...',
    status: 'active',
    visibility: 'private',
    updatedAt: new Date().toISOString(),
    $id: '',
    metadata: '{}'
  } as any : null);
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
      openSidebar(
        <ProjectDiscussionSidebar
          project={project}
          fetchProjectData={fetchProjectData}
          user={user}
        />,
        'project-discussion',
        { hideHeader: true }
      );
    } else {
      setInitializingHuddle(true);
      try {
        await createGhostNoteForProject(project.$id, `${project.title} Discussion`);
        showSuccess('Huddle Discussion spun up successfully!');
        await fetchProjectData();
        openSidebar(
          <ProjectDiscussionSidebar
            project={project}
            fetchProjectData={fetchProjectData}
            user={user}
          />,
          'project-discussion',
          { hideHeader: true }
        );
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
      setRawProject(p);

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

  const handleToggleKeepPermission = async (entityId: string, kind: string, checked: boolean) => {
      let databaseId = '';
      let tableId = '';

      const lowerKind = kind.toLowerCase();
      if (lowerKind === 'note') {
          databaseId = APPWRITE_CONFIG.DATABASES.NOTE;
          tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;
      } else if (lowerKind === 'goal' || lowerKind === 'task') {
          databaseId = APPWRITE_CONFIG.DATABASES.FLOW;
          tableId = APPWRITE_CONFIG.TABLES.FLOW.TASKS;
      } else if (lowerKind === 'password' || lowerKind === 'credential' || lowerKind === 'secret') {
          databaseId = APPWRITE_CONFIG.DATABASES.VAULT;
          tableId = APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS;
      } else if (lowerKind === 'totp') {
          databaseId = APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER;
          tableId = 'totpSecrets';
      } else if (lowerKind === 'event') {
          databaseId = APPWRITE_CONFIG.DATABASES.KYLRIXFLOW;
          tableId = 'events';
      }

      if (!databaseId || !tableId) return;

      try {
          await updateRow(databaseId, tableId, entityId, { keepPermission: checked });
          
          if (lowerKind === 'note') {
              setNotes(prev => prev.map(n => n.$id === entityId ? { ...n, keepPermission: checked } : n));
          } else if (lowerKind === 'goal' || lowerKind === 'task') {
              setTasks(prev => prev.map(t => t.$id === entityId ? { ...t, keepPermission: checked } : t));
          } else if (lowerKind === 'password' || lowerKind === 'credential' || lowerKind === 'secret') {
              setCredentials(prev => prev.map(c => c.$id === entityId ? { ...c, keepPermission: checked } : c));
          } else if (lowerKind === 'totp') {
              setTotps(prev => prev.map(t => t.$id === entityId ? { ...t, keepPermission: checked } : t));
          } else if (lowerKind === 'event') {
              setEvents(prev => prev.map(e => e.$id === entityId ? { ...e, keepPermission: checked } : e));
          }

          if (checked) {
              showSuccess('Original permissions kept. View the resource directly to edit its own permissions.');
          } else {
              showSuccess('Object now inherits project permissions.');
          }
          
          await fetchProjectData();
      } catch (err: any) {
          showError('Failed to update permission override settings', err.message);
      }
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

  if (!loading && !project) {
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', pt: { xs: 2, md: 6 }, pb: 10 }}>
      <MultiSectionContainer panels={['note', 'huddles', 'goals']} contextId={projectId as string}>
        <Box sx={{ width: '100%' }}>
        
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
                        {loading ? (
                          <Skeleton variant="text" width={180} height={32} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                        ) : (
                          <>
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
                          </>
                        )}
                    </Stack>
                    {loading ? (
                      <Skeleton variant="text" width={240} height={18} sx={{ bgcolor: 'rgba(255,255,255,0.02)', mt: 0.5 }} />
                    ) : (
                      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', fontWeight: 600 }}>
                          {projectObjects.length} linked ecosystem objects • {collaborators.length + 1} participants
                      </Typography>
                    )}
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
                <Box 
                    sx={{ 
                        mb: 3, 
                        p: 2.5, 
                        borderRadius: '24px', 
                        bgcolor: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2
                    }}
                >
                    <Info size={18} style={{ color: '#6366F1', flexShrink: 0 }} />
                    <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.4 }}>
                        All integrated internal objects inherit project member&apos;s permission level, except on object level permission override.
                    </Typography>
                </Box>
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
                        </Tabs>
                    </Box>

                    <Box sx={{ p: { xs: 2, md: 4 } }}>
                        {/* Integrated Notes */}
                        <CustomTabPanel value={tabValue} index={0}>
                            {loading ? <ResourceGridSkeleton /> : resolving ? <LoadingPlaceholder /> : notes.length === 0 ? <EmptyState kind="note" /> : (
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
                                                keepPermission={note.keepPermission}
                                                onToggleKeepPermission={(checked) => handleToggleKeepPermission(note.$id, 'note', checked)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>
                        
                        {/* Execution Goals */}
                        <CustomTabPanel value={tabValue} index={1}>
                            {loading ? <ResourceGridSkeleton /> : resolving ? <LoadingPlaceholder /> : tasks.length === 0 ? <EmptyState kind="goal" /> : (
                                <Grid container spacing={2}>
                                    {tasks.map(task => (
                                        <Grid size={{ xs: 12 }} key={task.$id}>
                                            <ResourceItem 
                                                title={task.title} 
                                                kind="goal"
                                                metadata={`${task.status.replace('-', ' ')} • ${task.priority}`}
                                                onOpen={() => openSecondarySidebar('task', task.$id)}
                                                onUnlink={() => handleRemoveObject(task.$id)}
                                                keepPermission={task.keepPermission}
                                                onToggleKeepPermission={(checked) => handleToggleKeepPermission(task.$id, 'goal', checked)}
                                            />
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </CustomTabPanel>

                        {/* Vault Assets */}
                        <CustomTabPanel value={tabValue} index={2}>
                            {loading ? <ResourceGridSkeleton /> : resolving ? <LoadingPlaceholder /> : (credentials.length === 0 && totps.length === 0) ? <EmptyState kind="password" /> : (
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
                                                keepPermission={cred.keepPermission}
                                                onToggleKeepPermission={(checked) => handleToggleKeepPermission(cred.$id, 'password', checked)}
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
                                                keepPermission={totp.keepPermission}
                                                onToggleKeepPermission={(checked) => handleToggleKeepPermission(totp.$id, 'totp', checked)}
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
                            {loading ? <ResourceGridSkeleton /> : resolving ? <LoadingPlaceholder /> : subProjects.length === 0 ? <EmptyState kind="sub-project" /> : (
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
                            {loading ? <ResourceGridSkeleton /> : resolving ? <LoadingPlaceholder /> : (events.length === 0 && calls.length === 0) ? <EmptyState kind="event" /> : (
                                <Grid container spacing={2}>
                                    {events.map(event => (
                                        <Grid size={{ xs: 12 }} key={event.$id}>
                                            <ResourceItem 
                                                title={event.title} 
                                                kind="event"
                                                metadata={`${event.location || 'No location'} • ${new Date(event.startTime).toLocaleString()}`}
                                                onOpen={() => openSecondarySidebar('event', event.$id, event)}
                                                onUnlink={() => handleRemoveObject(event.$id)}
                                                keepPermission={event.keepPermission}
                                                onToggleKeepPermission={(checked) => handleToggleKeepPermission(event.$id, 'event', checked)}
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
                            {loading ? <ResourceGridSkeleton /> : resolving ? <LoadingPlaceholder /> : (forms.length === 0 && tags.length === 0 && moments.length === 0) ? <EmptyState kind="flow" /> : (
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
                    </Box>
                </Paper>

                {/* External Objects Card */}
                <Paper
                    elevation={0}
                    sx={{
                        bgcolor: '#161412',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '32px',
                        overflow: 'hidden',
                        backgroundImage: 'none',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                        mt: 4
                    }}
                >
                    <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.06)', px: 3, py: 2.5, bgcolor: alpha('#fff', 0.01), display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                        </svg>
                        <Typography sx={{ color: '#fff', fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                            GitHub Repositories
                        </Typography>
                    </Box>

                    <Box sx={{ p: { xs: 2, md: 4 } }}>
                        <GitHubExternalObjectsTab 
                            projectId={projectId as string}
                            projectObjects={projectObjects}
                            fetchProjectData={fetchProjectData}
                            tasks={tasks}
                        />
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
      </MultiSectionContainer>

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

function ResourceGridSkeleton() {
    return (
        <Stack spacing={2} sx={{ py: 2 }}>
            {[1, 2, 3].map((idx) => (
                <Box
                    key={idx}
                    sx={{
                        p: 2.5,
                        borderRadius: '24px',
                        bgcolor: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                >
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                        <Skeleton variant="rounded" width={40} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '10px' }} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="40%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.04)', mb: 1 }} />
                            <Skeleton variant="text" width="25%" height={14} sx={{ bgcolor: 'rgba(255,255,255,0.02)' }} />
                        </Box>
                    </Stack>
                    <Skeleton variant="circular" width={24} height={24} sx={{ bgcolor: 'rgba(255,255,255,0.03)' }} />
                </Box>
            ))}
        </Stack>
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
    onExtractGoals,
    keepPermission,
    onToggleKeepPermission
}: { 
    title: string, 
    kind: string, 
    metadata: string, 
    onOpen: () => void, 
    onUnlink: () => void,
    onExtractGoals?: () => void,
    keepPermission?: boolean | null,
    onToggleKeepPermission?: (checked: boolean) => void
}) {
    const [menuAnchor, setMenuAnchor] = useState<{ x: number, y: number } | null>(null);
    const longPressTimerRef = useRef<any>(null);
    const touchStartPosRef = useRef<{ x: number, y: number } | null>(null);

    const handleContextMenu = (event: React.MouseEvent) => {
        if (!onToggleKeepPermission) return;
        event.preventDefault();
        setMenuAnchor({ x: event.clientX, y: event.clientY });
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!onToggleKeepPermission) return;
        const touch = e.touches[0];
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        const currentTarget = e.currentTarget;
        longPressTimerRef.current = setTimeout(() => {
            const rect = currentTarget.getBoundingClientRect();
            setMenuAnchor({ x: rect.left + rect.width / 2, y: rect.bottom });
            if (navigator.vibrate) navigator.vibrate(10);
        }, 600);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartPosRef.current) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartPosRef.current.x;
        const dy = touch.clientY - touchStartPosRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
        }
    };

    const handleTouchEnd = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

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
        <>
            <Paper
                elevation={0}
                onContextMenu={handleContextMenu}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
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
                    cursor: onToggleKeepPermission ? 'context-menu' : 'default',
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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography 
                                sx={{ 
                                    color: '#fff', 
                                    fontWeight: 800, 
                                    fontSize: '0.95rem',
                                    lineHeight: 1.3,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {title}
                            </Typography>
                            {keepPermission && (
                                <Tooltip title="Keeps original permissions (override active)" arrow>
                                    <Box component="span" sx={{ display: 'inline-flex', color: '#10B981', flexShrink: 0 }}>
                                        <ShieldCheck size={16} />
                                    </Box>
                                </Tooltip>
                            )}
                        </Box>
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

            {menuAnchor && (
                <Menu
                    open={Boolean(menuAnchor)}
                    onClose={() => setMenuAnchor(null)}
                    anchorReference="anchorPosition"
                    anchorPosition={{ top: menuAnchor.y, left: menuAnchor.x }}
                    disablePortal={true}
                    keepMounted={false}
                    PaperProps={{
                        sx: {
                            bgcolor: '#161412',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '16px',
                            minWidth: 240,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            py: 1.5,
                        }
                    }}
                >
                    <Box sx={{ px: 2, py: 0.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <FormControlLabel
                            control={
                                <Switch 
                                    checked={!!keepPermission} 
                                    onChange={(e) => {
                                        onToggleKeepPermission?.(e.target.checked);
                                        setMenuAnchor(null);
                                    }}
                                    color="primary"
                                    size="small"
                                />
                            }
                            label={
                                <Typography sx={{ color: '#fff', fontSize: '0.85rem', fontWeight: 800 }}>
                                    Keep Original Permissions
                                </Typography>
                            }
                            sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                        />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', mt: 0.5, lineHeight: 1.3 }}>
                            When enabled, this object uses its own permissions instead of inheriting the project&apos;s.
                        </Typography>
                    </Box>
                </Menu>
            )}
        </>
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

// ============================================================================
// NEW SOLID INTEGRATION MODULES: UNVERIFIED EXTERNAL OBJECTS
// ============================================================================

function GitHubExternalObjectsTab({
  projectId,
  projectObjects,
  fetchProjectData,
  tasks = []
}: {
  projectId: string;
  projectObjects: any[];
  fetchProjectData: () => Promise<void>;
  tasks?: any[];
}) {
  const [repoInput, setRepoInput] = useState('');
  const [adding, setAdding] = useState(false);
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const [liveStats, setLiveStats] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`kylrix_github_cache_${projectId}`);
        return cached ? JSON.parse(cached) : {};
      } catch (e) {
        return {};
      }
    }
    return {};
  });
  const [loadingLive, setLoadingLive] = useState<Record<string, boolean>>({});

  const unverifiedRepos = useMemo(() => {
    return projectObjects.filter(o => o.entityKind === 'unverified_github');
  }, [projectObjects]);

  const fetchLiveStats = useCallback(async (repoPath: string, objectId?: string, currentMetadata?: any) => {
    const cacheKey = `kylrix_github_cache_${projectId}`;
    let cachedStats: any = {};
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) cachedStats = JSON.parse(cached);
      } catch (e) {}
    }
    const hasCache = !!cachedStats[repoPath] || (currentMetadata && Object.keys(currentMetadata).length > 0);

    if (!hasCache) {
      setLoadingLive(prev => ({ ...prev, [repoPath]: true }));
    }
    try {
      const parts = repoPath.split('/');
      if (parts.length !== 2) throw new Error('Invalid repo');
      const [owner, repoName] = parts;

      const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const repoData = await res.json();

      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=1`);
      const commitData = commitRes.ok ? await commitRes.json() : [];

      const pullsRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/pulls?state=open&per_page=1`);
      let pullsCount = 0;
      if (pullsRes.ok) {
        const linkHeader = pullsRes.headers.get('Link');
        if (linkHeader) {
          const match = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (match) pullsCount = parseInt(match[1], 10);
          else {
            const pulls = await pullsRes.json();
            pullsCount = pulls.length;
          }
        } else {
          const pulls = await pullsRes.json();
          pullsCount = pulls.length;
        }
      }

      const newStats = {
        description: repoData?.description || 'Public Repository',
        stars: repoData?.stargazers_count || 0,
        openIssues: repoData?.open_issues_count || 0,
        pullsCount,
        language: repoData?.language || 'Codebase',
        lastCommit: commitData?.[0]?.commit?.message || 'No commits found',
        lastCommitAuthor: commitData?.[0]?.commit?.author?.name || 'Unknown',
        lastCommitDate: commitData?.[0]?.commit?.author?.date || ''
      };

      setLiveStats(prev => {
        const updated = { ...prev, [repoPath]: newStats };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(updated));
          } catch (e) {}
        }
        return updated;
      });

      if (objectId) {
        const dbCached = currentMetadata || {};
        const isChanged = !dbCached ||
          dbCached.stars !== newStats.stars ||
          dbCached.openIssues !== newStats.openIssues ||
          dbCached.pullsCount !== newStats.pullsCount ||
          dbCached.language !== newStats.language ||
          dbCached.lastCommit !== newStats.lastCommit ||
          dbCached.description !== newStats.description;

        if (isChanged) {
          const updatedMetadata = {
            isUnverified: true,
            ...newStats,
            addedAt: dbCached.addedAt || new Date().toISOString()
          };

          await updateRow(
            APPWRITE_CONFIG.DATABASES.CHAT,
            'project_objects',
            objectId,
            { metadata: JSON.stringify(updatedMetadata) }
          );
        }
      }
    } catch (e) {
      console.warn('Failed to fetch live stats for', repoPath, e);
    } finally {
      setLoadingLive(prev => ({ ...prev, [repoPath]: false }));
    }
  }, [projectId, setLoadingLive, setLiveStats]);

  // Load live statistics dynamically on mount
  useEffect(() => {
    unverifiedRepos.forEach(repo => {
      const repoPath = repo.entityId;
      
      let dbCached: any = {};
      try {
        dbCached = typeof repo.metadata === 'string' ? JSON.parse(repo.metadata) : repo.metadata || {};
      } catch (e) {}

      // If not in state, initialize from database cache instantly
      if (!liveStats[repoPath] && Object.keys(dbCached).length > 0) {
        setLiveStats(prev => ({ ...prev, [repoPath]: dbCached }));
      }

      // Quietly fetch in background
      const lastFetched = localStorage.getItem(`kylrix_github_last_fetch_${repoPath}`);
      const now = Date.now();
      const needsFetch = !lastFetched || (now - parseInt(lastFetched, 10) > 5 * 60 * 1000);

      if (needsFetch && !loadingLive[repoPath]) {
        localStorage.setItem(`kylrix_github_last_fetch_${repoPath}`, now.toString());
        fetchLiveStats(repoPath, repo.$id, dbCached);
      }
    });
  }, [unverifiedRepos, liveStats, loadingLive, fetchLiveStats]);

  const handleAddRepo = async (overridePath?: string) => {
    let input = (overridePath || repoInput).trim();
    if (!input) {
      toast.error('Please enter a GitHub repository path or URL.');
      return;
    }

    if (input.includes('github.com/')) {
      const parts = input.split('github.com/');
      input = parts[1];
    }
    const cleanPath = input.replace(/^\/|\/$/g, '');
    const pathParts = cleanPath.split('/');
    if (pathParts.length < 2) {
      toast.error('Invalid format. Use "owner/repository" or GitHub URL.');
      return;
    }
    const owner = pathParts[0];
    const repo = pathParts[1];
    const fullPath = `${owner}/${repo}`;

    if (unverifiedRepos.some(r => r.entityId === fullPath)) {
      toast.error('This repository is already associated with this project.');
      return;
    }

    setAdding(true);
    const toastId = toast.loading('Validating repository and fetching details...');
    try {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!res.ok) {
        throw new Error('Repository not found or is private. Ensure it is a public repository.');
      }
      const repoData = await res.json();

      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`);
      const commitData = commitRes.ok ? await commitRes.json() : [];

      const pullsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=1`);
      let pullsCount = 0;
      if (pullsRes.ok) {
        const linkHeader = pullsRes.headers.get('Link');
        if (linkHeader) {
          const match = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (match) pullsCount = parseInt(match[1], 10);
        }
      }

      const metadata = {
        isUnverified: true,
        description: repoData.description || 'Public Repository',
        stars: repoData.stargazers_count || 0,
        openIssues: repoData.open_issues_count || 0,
        pullsCount,
        language: repoData.language || 'Codebase',
        lastCommit: commitData?.[0]?.commit?.message || 'No commits',
        lastCommitAuthor: commitData?.[0]?.commit?.author?.name || 'Unknown',
        lastCommitDate: commitData?.[0]?.commit?.author?.date || '',
        addedAt: new Date().toISOString()
      };

      await ProjectsService.addObjectToProject(
        projectId,
        'unverified_github',
        fullPath,
        'viewer',
        metadata
      );

      toast.success('Unverified repository added to project successfully!', { id: toastId });
      setRepoInput('');
      fetchProjectData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to add repository.', { id: toastId });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRepo = async (objectId: string) => {
    const confirmed = window.confirm('Are you sure you want to unlink this repository from the project?');
    if (!confirmed) return;
    try {
      await ProjectsService.removeObjectFromProject(objectId);
      toast.success('Repository unlinked successfully.');
      fetchProjectData();
    } catch (e: any) {
      toast.error('Failed to unlink repository: ' + e.message);
    }
  };

  return (
    <Stack spacing={3}>
      {unverifiedRepos.length === 0 && (
        <Box 
          sx={{ 
            p: 3, 
            borderRadius: '20px', 
            bgcolor: 'rgba(255,255,255,0.02)', 
            border: '1px solid rgba(255,255,255,0.06)' 
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 905, color: 'white', mb: 1, fontFamily: 'var(--font-clash)' }}>
            Associate GitHub Repository (Unverified)
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', mb: 2, display: 'block', lineHeight: 1.5 }}>
            No GitHub connection is required. Paste any public GitHub repository URL or path (e.g. <code>facebook/react</code>) to integrate its live statistics, commit logs, and issues list directly into this project.
          </Typography>
          
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. facebook/react or https://github.com/facebook/react"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              disabled={adding}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#161412',
                  borderRadius: '12px',
                  color: 'white',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                  '&.Mui-focused fieldset': { borderColor: '#6366F1' }
                }
              }}
            />
            <Button
              variant="contained"
              disabled={adding || !repoInput.trim()}
              onClick={() => handleAddRepo()}
              sx={{
                borderRadius: '12px',
                bgcolor: '#6366F1',
                color: '#000',
                fontWeight: 900,
                px: 3,
                py: 1.25,
                textTransform: 'none',
                flexShrink: 0,
                width: { xs: '100%', sm: 'auto' },
                '&:hover': { bgcolor: alpha('#6366F1', 0.9) }
              }}
            >
              {adding ? 'Adding...' : 'Add Repository'}
            </Button>
          </Stack>

          <Box sx={{ mt: 2.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', mb: 1.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
              ⚡ Developer Favorites (1-Click Test Drive)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {[
                { label: 'React', path: 'facebook/react', logo: '⚛️' },
                { label: 'Next.js', path: 'vercel/next.js', logo: '▲' },
                { label: 'Tailwind CSS', path: 'tailwindlabs/tailwindcss', logo: '🎨' }
              ].map((fav) => (
                <Chip
                  key={fav.path}
                  label={`${fav.logo} ${fav.label}`}
                  onClick={() => {
                    setRepoInput(fav.path);
                    handleAddRepo(fav.path);
                  }}
                  disabled={adding}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.02)',
                    color: 'rgba(255,255,255,0.65)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: 'rgba(99, 102, 241, 0.08)',
                      borderColor: 'rgba(99, 102, 241, 0.25)',
                      color: '#818CF8'
                    }
                  }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      )}

      {unverifiedRepos.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '20px' }}>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
            No unverified repositories linked yet.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {unverifiedRepos.map((repo) => {
            const path = repo.entityId;
            let cached: any = {};
            try {
              cached = typeof repo.metadata === 'string' ? JSON.parse(repo.metadata) : repo.metadata || {};
            } catch (e) {}

            const stats = liveStats[path] || cached || {};
            const loading = loadingLive[path];

            return (
              <Grid size={{ xs: 12 }} key={repo.$id}>
                <Box 
                  sx={{ 
                    p: 2.5, 
                    borderRadius: '20px', 
                    bgcolor: '#0A0908', 
                    border: '1px solid #1C1A18',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    position: 'relative',
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'rgba(255,255,255,0.1)' }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.06)', color: 'white' }}>
                        <FolderKanban size={18} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography 
                          onClick={() => openSidebar(
                            <UnverifiedGithubRepoDrawer 
                              repoPath={path}
                              projectId={projectId}
                              projectObjects={projectObjects}
                              fetchProjectData={fetchProjectData}
                              onClose={closeSidebar}
                              tasks={tasks}
                            />,
                            'unverified-github-repo'
                          )}
                          sx={{ 
                            fontWeight: 900, 
                            color: '#6366F1', 
                            fontSize: '1rem', 
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                        >
                          {path}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                          Linked {new Date(cached.addedAt || repo.$createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center">
                      {loading && <CircularProgress size={12} sx={{ color: '#F59E0B' }} />}
                      <Chip 
                        label="UNVERIFIED" 
                        size="small" 
                        sx={{ 
                          height: 18, 
                          fontSize: '8px', 
                          fontWeight: 900, 
                          bgcolor: 'rgba(245, 158, 11, 0.1)', 
                          color: '#F59E0B', 
                          border: '1px solid rgba(245, 158, 11, 0.2)' 
                        }} 
                      />
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleRemoveRepo(repo.$id)}
                        sx={{
                          height: 24,
                          fontSize: '10px',
                          fontWeight: 800,
                          borderColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#EF4444',
                          textTransform: 'none',
                          borderRadius: '8px',
                          '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239, 68, 68, 0.05)' }
                        }}
                      >
                        Unlink
                      </Button>
                    </Stack>
                  </Box>

                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
                    {stats.description || 'Public GitHub Repository'}
                  </Typography>

                  <Grid container spacing={1.5} sx={{ bgcolor: 'rgba(255,255,255,0.01)', p: 1.5, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>⭐ Stars</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{stats.stars ?? cached.stars ?? '-'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>🎫 Open Issues</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{stats.openIssues ?? cached.openIssues ?? '-'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>🔀 Open PRs</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{stats.pullsCount ?? cached.pullsCount ?? '-'}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6, sm: 3 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block' }}>🛠️ Language</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>{stats.language ?? cached.language ?? '-'}</Typography>
                    </Grid>
                  </Grid>

                  {(stats.lastCommit || cached.lastCommit) && (
                    <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.03)', border: '1px dashed rgba(99, 102, 241, 0.15)' }}>
                      <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 900, display: 'block', mb: 0.5 }}>
                        LATEST COMMIT LOG
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', mb: 0.5, fontSize: '0.85rem' }}>
                        {stats.lastCommit || cached.lastCommit}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                        Authored by {stats.lastCommitAuthor || cached.lastCommitAuthor || 'Unknown'} {stats.lastCommitDate || cached.lastCommitDate ? `on ${new Date(stats.lastCommitDate || cached.lastCommitDate).toLocaleDateString()}` : ''}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Stack>
  );
}

interface UnverifiedGithubRepoDrawerProps {
  repoPath: string;
  projectId: string;
  projectObjects: any[];
  fetchProjectData: () => Promise<void>;
  onClose: () => void;
  tasks: any[];
}

function UnverifiedGithubRepoDrawer({
  repoPath,
  projectId,
  projectObjects,
  fetchProjectData,
  onClose,
  tasks = []
}: UnverifiedGithubRepoDrawerProps) {
  const [issues, setIssues] = useState<any[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [convertingIssueId, setConvertingIssueId] = useState<number | null>(null);
  const [stats, setStats] = useState<any>(null);
  const { user } = useAuth();

  const repoObject = useMemo(() => {
    return projectObjects.find(o => o.entityKind === 'unverified_github' && o.entityId === repoPath);
  }, [projectObjects, repoPath]);

  const isAlreadyLinked = useCallback((issue: any) => {
    return tasks.some(task => {
      const hasTitleMatch = task.title?.startsWith(`[GitHub #${issue.number}]`);
      const hasUrlMatch = task.description?.includes(issue.html_url);
      return hasTitleMatch || hasUrlMatch;
    });
  }, [tasks]);

  const loadRepoData = useCallback(async () => {
    setLoadingIssues(true);
    setIssuesError(null);
    try {
      const parts = repoPath.split('/');
      if (parts.length !== 2) throw new Error('Invalid repo format');
      const [owner, repo] = parts;

      const statsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=15`);
      if (!res.ok) throw new Error('Failed to load public repository issues.');
      const data = await res.json();
      
      const filteredIssues = data.filter((item: any) => !item.pull_request);
      setIssues(filteredIssues);
    } catch (e: any) {
      setIssuesError(e.message || 'Failed to fetch repository issues.');
    } finally {
      setLoadingIssues(false);
    }
  }, [repoPath]);

  useEffect(() => {
    loadRepoData();
  }, [loadRepoData]);

  const handleConvertToGoal = async (issue: any) => {
    if (!user || !user.$id) {
      toast.error('User not authenticated.');
      return;
    }
    setConvertingIssueId(issue.id);
    const toastId = toast.loading('Converting GitHub issue to local Execution Goal...');
    try {
      const taskId = ID.unique();
      const now = new Date().toISOString();

      await (databases as any).createRow(
        APPWRITE_CONFIG.DATABASES.FLOW,
        APPWRITE_CONFIG.TABLES.FLOW.TASKS,
        taskId,
        {
          title: `[GitHub #${issue.number}] ${issue.title}`,
          status: 'todo',
          priority: 'medium',
          userId: user.$id,
          createdAt: now,
          updatedAt: now,
          description: `${issue.body || 'No description provided.'}\n\n---\nOrigin: Unverified GitHub Issue\nURL: ${issue.html_url}\nRepository: ${repoPath}`
        }
      );

      await ProjectsService.addObjectToProject(projectId, 'goal', taskId);

      toast.success('Successfully converted to Execution Goal!', { id: toastId });
      fetchProjectData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Failed to convert issue.', { id: toastId });
    } finally {
      setConvertingIssueId(null);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#161412', color: '#fff' }}>
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 900, color: '#6366F1', fontFamily: 'var(--font-mono)' }}>
              unverified_github
            </Typography>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 905, color: '#fff', fontSize: '1rem' }}>
              {repoPath}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
          <X size={16} />
        </IconButton>
      </Box>

      <Box sx={{ p: 3, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {stats && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', display: 'block' }}>⭐ Stars</Typography>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>{stats.stargazers_count}</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px' }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', display: 'block' }}>🎫 Open Issues</Typography>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>{stats.open_issues_count}</Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        <Stack spacing={1.5}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => window.open(`https://github.com/${repoPath}`, '_blank')}
            startIcon={<ExternalLink size={14} />}
            sx={{
              borderRadius: '12px',
              borderColor: 'rgba(255,255,255,0.08)',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.85rem',
              py: 1.25,
              '&:hover': { borderColor: '#6366F1', bgcolor: 'rgba(99,102,241,0.03)' }
            }}
          >
            Open on GitHub
          </Button>
          <Button
            fullWidth
            variant="outlined"
            onClick={loadRepoData}
            startIcon={<RefreshCw size={14} />}
            sx={{
              borderRadius: '12px',
              borderColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.7)',
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.85rem',
              py: 1.25,
              '&:hover': { borderColor: 'rgba(255,255,255,0.2)', bgcolor: 'rgba(255,255,255,0.02)', color: '#fff' }
            }}
          >
            Sync Live Feed
          </Button>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Open Issues ({issues.length})
          </Typography>

          {loadingIssues ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <CircularProgress size={24} sx={{ color: '#6366F1' }} />
            </Box>
          ) : issuesError ? (
            <Typography variant="caption" sx={{ color: '#EF4444', fontStyle: 'italic' }}>
              {issuesError}
            </Typography>
          ) : issues.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              No open public issues found in this repository.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {issues.map((issue) => (
                <Paper
                  key={issue.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: '16px',
                    bgcolor: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                    '&:hover': { borderColor: 'rgba(255,255,255,0.08)' }
                  }}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <Typography variant="body2" sx={{ fontWeight: 900, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                        #{issue.number}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', lineHeight: 1.4 }}>
                        {issue.title}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)', mt: 0.5, display: 'block' }}>
                      Opened by @{issue.user?.login} • {new Date(issue.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>

                  {issue.labels && issue.labels.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {issue.labels.slice(0, 3).map((label: any) => (
                        <Chip
                          key={label.id}
                          label={label.name}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '8px',
                            fontWeight: 900,
                            bgcolor: label.color ? `#${label.color}15` : 'rgba(255,255,255,0.04)',
                            color: label.color ? `#${label.color}` : '#fff',
                            border: `1px solid ${label.color ? `#${label.color}30` : 'rgba(255,255,255,0.08)'}`
                          }}
                        />
                      ))}
                    </Box>
                  )}

                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Button
                      size="small"
                      onClick={() => window.open(issue.html_url, '_blank')}
                      startIcon={<ExternalLink size={10} />}
                      sx={{
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'none',
                        color: 'rgba(255,255,255,0.6)',
                        '&:hover': { color: '#fff' }
                      }}
                    >
                      Open Live
                    </Button>

                    {isAlreadyLinked(issue) ? (
                      <Chip
                        icon={<Check size={10} style={{ color: '#10B981', marginLeft: '4px' }} />}
                        label="Goal Linked"
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '9px',
                          fontWeight: 900,
                          bgcolor: 'rgba(16, 185, 129, 0.1)',
                          color: '#10B981',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          borderRadius: '6px',
                          '& .MuiChip-icon': {
                            color: '#10B981 !important'
                          }
                        }}
                      />
                    ) : (
                      <Button
                        size="small"
                        disabled={convertingIssueId === issue.id}
                        onClick={() => handleConvertToGoal(issue)}
                        startIcon={convertingIssueId === issue.id ? <CircularProgress size={10} color="inherit" /> : <Plus size={10} />}
                        sx={{
                          fontSize: '10px',
                          fontWeight: 900,
                          textTransform: 'none',
                          color: '#6366F1',
                          '&:hover': { color: '#818CF8' }
                        }}
                      >
                        Convert to Goal
                      </Button>
                    )}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}
