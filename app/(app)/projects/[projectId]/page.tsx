'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ID } from 'appwrite';
import { useRouter, useParams } from 'next/navigation';

import { useTheme } from '@/lib/openbricks/theme';
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
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { ResourceItem, TaggedResourcesTabs } from '@/components/share/TaggedResourcesTabs';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Projects, ProjectObjects, Notes, Tasks, Credentials, Users as UserType } from '@/types/appwrite';
import { listNotes, listFlowTasks, listKeepCredentials, Query, AppwriteService, listTags } from '@/lib/appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import ProjectAddObjectModal from '@/components/projects/ProjectAddObjectModal';
import ProjectExtractGoalsModal from '@/components/projects/ProjectExtractGoalsModal';
import ProjectAddSubProjectModal from '@/components/projects/ProjectAddSubProjectModal';
import { databases, storage } from '@/lib/appwrite/client';
import { getUserSubscriptionTier, hasTeamsKylrixPlan } from '@/lib/utils';
import { useAuth } from '@/context/auth/AuthContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
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
import { Send, Clock, Mic, Square, Tag, ShieldCheck, Camera, PhoneCall, FileSpreadsheet, X, Copy, ChevronLeft, Info, ChevronDown } from 'lucide-react';
import MuralPattern from '@/components/chat/MuralPattern';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { StorageService } from '@/lib/services/storage';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import { ProjectDiscussionSidebar } from '@/components/projects/ProjectDiscussionSidebar';
import { useLayout } from '@/context/LayoutContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useDataNexus } from '@/context/DataNexusContext';
import {
  getSessionProjectDetail,
  setSessionProjectDetail,
  projectDetailCacheKey,
  projectMetaCacheKey,
  projectObjectsCacheKey,
  projectTaggedCacheKey,
  projectEntityCacheKey,
  PROJECT_DETAIL_TTL,
  PROJECT_META_TTL,
  PROJECT_OBJECTS_TTL,
  PROJECT_ENTITIES_TTL,
  PROJECT_TAGGED_TTL,
  EMPTY_TAGGED_RESOURCES,
  type ProjectDetailCache,
} from '@/lib/projects/projects-cache';
import { normalizeProjectVisibility } from '@/lib/projects/normalize-project';
import { SweptService } from '@/lib/services/swept';
import { MultiSectionContainer } from '@/context/SectionContext';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import FormDialog from '@/components/forms/FormDialog';
import { CallActionModal } from '@/components/call/CallActionModal';
import NewTotpDialog from '@/components/app/totp/new';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';
import { attachObjectToProject } from '@/lib/projects/object-attachment';

const TABS_CONFIG = [
  { label: 'Integrated Notes', icon: <FileText size={18} /> },
  { label: 'Execution Goals', icon: <CheckSquare size={18} /> },
  { label: 'Vault Assets', icon: <Lock size={18} /> },
  { label: 'Sub-Projects', icon: <FolderKanban size={18} /> },
  { label: 'Events & Calls', icon: <Calendar size={18} /> },
  { label: 'Interconnected Flow', icon: <Workflow size={18} /> },
];

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
        <div className="py-6">
          {children}
        </div>
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
  const { openProUpgrade } = useProUpgrade();
  const { currentTier } = useSubscription();
  const { fetchOptimized, getCachedDataAsync, setCachedData, invalidate } = useDataNexus();

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
  const [loading, setLoading] = useState(
    () => !(projectId && getSessionProjectDetail(projectId as string)),
  );

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
  const [addModalTab, setAddModalTab] = useState(0);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractGoalsNote, setExtractGoalsNote] = useState<Notes | null>(null);
  const [isAddSubProjectModalOpen, setIsAddSubProjectModalOpen] = useState(false);
  const [gitIntegration, setGitIntegration] = useState<SourceControlRow | null>(null);
  const [initializingHuddle, setInitializingHuddle] = useState(false);
  const [discussionMenuAnchor, setDiscussionMenuAnchor] = useState<HTMLElement | null>(null);
  const [tabMenuAnchorEl, setTabMenuAnchorEl] = useState<{ x: number, y: number } | null>(null);
  const [activeTabMenuIndex, setActiveTabMenuIndex] = useState<number | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<any | null>(null);
  const [autoSweepEnabled, setAutoSweepEnabled] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    SweptService.getConfig(projectId as string)
      .then((config) => setAutoSweepEnabled(config.enabled === true))
      .catch(() => setAutoSweepEnabled(false));
  }, [projectId]);

  const handleOpenAutoSweepSettings = () => {
    openUnified('project-auto-sweep', {
      projectId: projectId as string,
      projectTitle: project?.title || 'Project',
      onSaved: async (enabled: boolean) => {
        setAutoSweepEnabled(enabled);
        invalidate(projectTaggedCacheKey(projectId as string, tags.map((t) => t.$id)));
        showSuccess(enabled ? 'Auto-sweep enabled' : 'Auto-sweep disabled');
        fetchProjectData();
      },
    });
  };

  const handleSaveSettings = async (title: string, summary: string, status: 'active' | 'completed' | 'archived' | 'paused' | 'on_hold') => {
    if (!project) return;
    try {
      invalidate(projectMetaCacheKey(project.$id));
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

  const handleSaveVisibility = async (visibility: 'public' | 'private', isGuest: boolean) => {
    if (!project) return;
    try {
      invalidate(projectMetaCacheKey(project.$id));
      await ProjectsService.updateProject(project.$id, {
        visibility,
        isPublic: visibility === 'public',
        isGuest: visibility === 'public' ? isGuest : false,
      });
      showSuccess('Project visibility updated successfully!');
      fetchProjectData();
    } catch (err: any) {
      console.error('Failed to update project visibility:', err);
      showError('Failed to update visibility', err.message);
    }
  };

  const handleDeleteProject = () => {
    if (!project) return;
    openUnified('delete-confirm', {
      title: `Delete "${project.title}"?`,
      resourceName: 'this project',
      confirmLabel: 'Delete Project',
      isProject: true,
      onConfirm: async (deleteMode?: 'detach' | 'created_within' | 'all') => {
        try {
          await ProjectsService.deleteProject(project.$id, deleteMode);
          showSuccess('Project deleted successfully');
          router.push('/projects');
        } catch (err: any) {
          showError('Failed to delete project', err.message);
        }
      }
    });
  };

  const handleApproveJoinRequest = (req: any) => {
    if (!projectId) return;
    const targetUserId = String(req.userId || req.$id || '').trim();
    if (!targetUserId) {
      showError('Failed to grant request', 'Could not identify the requester.');
      return;
    }
    openUnified('project-join-request-confirm', {
      action: 'grant',
      requesterName: req.displayName || req.name || req.email || 'Collaborator',
      projectName: project?.title || 'this project',
      onConfirm: async (selectedRole?: 'viewer' | 'editor' | 'admin') => {
        try {
          await ProjectsService.approveJoinRequest(projectId as string, targetUserId, selectedRole || 'viewer');
          showSuccess('Access request granted successfully!');
          fetchProjectData();
        } catch (err: any) {
          showError('Failed to grant request', err.message);
        }
      }
    });
  };

  const handleRejectJoinRequest = (req: any) => {
    if (!projectId) return;
    const targetUserId = String(req.userId || req.$id || '').trim();
    if (!targetUserId) {
      showError('Failed to deny request', 'Could not identify the requester.');
      return;
    }
    openUnified('project-join-request-confirm', {
      action: 'deny',
      requesterName: req.displayName || req.name || req.email || 'Collaborator',
      projectName: project?.title || 'this project',
      onConfirm: async () => {
        try {
          await ProjectsService.removeCollaborator(projectId as string, targetUserId);
          showSuccess('Access request denied.');
          fetchProjectData();
        } catch (err: any) {
          showError('Failed to deny request', err.message);
        }
      }
    });
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
  const isOwner = user?.$id === project?.ownerId;
  const currentCollaborator = useMemo(() => collaborators.find(c => (c.userId || c.$id) === user?.$id), [collaborators, user?.$id]);
  const isAdmin = isOwner || currentCollaborator?.permissionLevel === 'admin' || currentCollaborator?.level === 'admin';

  const isCollaborationSuspended = useMemo(() => {
    if (!project || !ownerProfile) return false;
    const tier = getUserSubscriptionTier(ownerProfile);
    const isTeams = tier === 'TEAMS' || tier === 'ORG' || tier === 'LIFETIME';
    return !isTeams;
  }, [project, ownerProfile]);

  const joinRequests = useMemo(() => collaborators.filter(c => c.status === 'requested'), [collaborators]);
  const activeCollaborators = useMemo(() => collaborators.filter(c => c.status !== 'requested'), [collaborators]);
  const [subProjects, setSubProjects] = useState<Projects[]>([]);
  const [forms, setForms] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [totps, setTotps] = useState<any[]>([]);
  const [moments, setMoments] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [taggedResources, setTaggedResources] = useState<{
    notes: any[];
    tasks: any[];
    credentials: any[];
    totps: any[];
    events: any[];
    forms: any[];
    moments: any[];
  }>({
    notes: [],
    tasks: [],
    credentials: [],
    totps: [],
    events: [],
    forms: [],
    moments: []
  });
  const [resolving, setResolving] = useState(false);

  const applyProjectDetailCache = useCallback((parsed: ProjectDetailCache) => {
    setRawProject(normalizeProjectVisibility(parsed.project) as Projects);
    setProjectObjects(parsed.projectObjects || []);
    setCollaborators(parsed.collaborators || []);
    setNotes(parsed.notes || []);
    setTasks(parsed.tasks || []);
    setCredentials(parsed.credentials || []);
    setSubProjects(parsed.subProjects || []);
    setForms(parsed.forms || []);
    setEvents(parsed.events || []);
    setTags(parsed.tags || []);
    setTotps(parsed.totps || []);
    setMoments(parsed.moments || []);
    setCalls(parsed.calls || []);
    setTaggedResources(parsed.taggedResources || EMPTY_TAGGED_RESOURCES);
    setOwnerProfile(parsed.ownerProfile || null);
    setGitIntegration(parsed.gitIntegration || null);
    setLoading(false);
  }, []);

  // Session + RxDB cold-start hydration before network sweep.
  useEffect(() => {
    if (!projectId) return;

    const session = getSessionProjectDetail(projectId as string);
    if (session) {
      applyProjectDetailCache(session);
      return;
    }

    let mounted = true;
    void (async () => {
      const nexusCached = await getCachedDataAsync<ProjectDetailCache>(
        projectDetailCacheKey(projectId as string),
        PROJECT_DETAIL_TTL,
      );
      if (!mounted || !nexusCached) return;
      setSessionProjectDetail(projectId as string, nexusCached);
      applyProjectDetailCache(nexusCached);
    })();

    return () => {
      mounted = false;
    };
  }, [projectId, getCachedDataAsync, applyProjectDetailCache]);

  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    
    const hasCache = Boolean(getSessionProjectDetail(projectId as string));
    if (!hasCache) {
      setLoading(true);
    }

    try {
      const p = await fetchOptimized(
        projectMetaCacheKey(projectId as string),
        () => ProjectsService.getProject(projectId as string),
        PROJECT_META_TTL,
      );
      setRawProject(normalizeProjectVisibility(p) as Projects);

      // Resolve owner profile securely
      let resolvedOwner: any = null;
      if (p?.ownerId) {
        try {
          const users = await getUsersByIdsSecure([p.ownerId]);
          resolvedOwner = users[0] || null;
          setOwnerProfile(resolvedOwner);
        } catch {}
      }

      // Resolve secure project collaborators
      let resolvedCollabs: any[] = [];
      try {
        const { jwt } = await account.createJWT();
        const { collaborators: collabs } = await getResourceCollaboratorsSecure({
          resourceId: projectId as string,
          resourceType: 'project',
          jwt
        });
        resolvedCollabs = collabs;
        setCollaborators(collabs);
      } catch (collabErr) {
        console.error('Failed to load project collaborators securely:', collabErr);
      }

      const objects = await fetchOptimized(
        projectObjectsCacheKey(projectId as string),
        () => ProjectsService.listProjectObjects(projectId as string),
        PROJECT_OBJECTS_TTL,
      );
      setProjectObjects(objects.rows);

      // Resolve other entities and capture their resolved values
      const resolvedEntitiesData = await resolveEntities(objects.rows);

      // Fetch Git integration details
      let resolvedGit: any = null;
      try {
        const integrations = await SourceControlService.listIntegrations(projectId as string);
        resolvedGit = integrations[0] || null;
        setGitIntegration(resolvedGit);
      } catch (gitErr) {
        console.error('Failed to load project git integration:', gitErr);
      }

      // Save everything to session cache for instant subsequent loads
      const cachePayload = {
        project: p,
        projectObjects: objects.rows,
        collaborators: resolvedCollabs,
        ownerProfile: resolvedOwner,
        gitIntegration: resolvedGit,
        ...(resolvedEntitiesData as any)
      };
      setSessionProjectDetail(projectId as string, cachePayload);
      void setCachedData(projectDetailCacheKey(projectId as string), cachePayload);

    } catch (err: any) {
      showError('Failed to load project', err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, showError, fetchOptimized, setCachedData]);

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

      const pid = projectId as string;
      const notesPromise = noteIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'notes', noteIds),
            () => listNotes([Query.equal('$id', noteIds)]).then((r) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const tasksPromise = taskIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'tasks', taskIds),
            () => listFlowTasks([Query.equal('$id', taskIds)]).then((r) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const credentialsPromise = credentialIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'credentials', credentialIds),
            () => listKeepCredentials([Query.equal('$id', credentialIds)]).then((r) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const subProjectsPromise = subProjectIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'subprojects', subProjectIds),
            () => (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CHAT, 'projects', [Query.equal('$id', subProjectIds)]).then((r: any) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const formsPromise = formIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'forms', formIds),
            () => (databases as any).listRows(APPWRITE_CONFIG.DATABASES.FLOW, APPWRITE_CONFIG.TABLES.FLOW.FORMS, [Query.equal('$id', formIds)]).then((r: any) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const eventsPromise = eventIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'events', eventIds),
            () => (databases as any).listRows(APPWRITE_CONFIG.DATABASES.KYLRIXFLOW, 'events', [Query.equal('$id', eventIds)]).then((r: any) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const tagsPromise = tagIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'tags', tagIds),
            () => listTags([Query.equal('$id', tagIds)]).then((r) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const totpsPromise = totpIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'totps', totpIds),
            () => (databases as any).listRows(APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER, 'totpSecrets', [Query.equal('$id', totpIds)]).then((r: any) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const momentsPromise = momentIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'moments', momentIds),
            () => (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.MOMENTS, [Query.equal('$id', momentIds)]).then((r: any) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);
      const callsPromise = callIds.length
        ? fetchOptimized(
            projectEntityCacheKey(pid, 'calls', callIds),
            () => (databases as any).listRows(APPWRITE_CONFIG.DATABASES.CHAT, APPWRITE_CONFIG.TABLES.CHAT.CALL_LINKS, [Query.equal('$id', callIds)]).then((r: any) => r.rows).catch(() => []),
            PROJECT_ENTITIES_TTL,
          )
        : Promise.resolve([]);

      const [
        resolvedNotes,
        resolvedTasks,
        resolvedCreds,
        resolvedSubProjs,
        resolvedForms,
        resolvedEvents,
        resolvedTags,
        resolvedTotps,
        resolvedMoments,
        resolvedCalls
      ] = await Promise.all([
        notesPromise,
        tasksPromise,
        credentialsPromise,
        subProjectsPromise,
        formsPromise,
        eventsPromise,
        tagsPromise,
        totpsPromise,
        momentsPromise,
        callsPromise
      ]);

      // Resolve Tagged Resources if any tags exist in the project
      let resolvedTagged: any = { notes: [], tasks: [], credentials: [], totps: [], events: [], forms: [], moments: [] };
      if (tagIds.length > 0) {
        try {
          resolvedTagged = await fetchOptimized(
            projectTaggedCacheKey(projectId as string, tagIds),
            () => ProjectsService.listTaggedResources(tagIds, projectId as string),
            PROJECT_TAGGED_TTL,
          );
          
          // Filter out items that are already explicitly linked as project objects
          const explicitIds = new Set(objects.map(o => o.entityId));
          resolvedTagged.notes = resolvedTagged.notes.filter((n: any) => !explicitIds.has(n.$id));
          resolvedTagged.tasks = resolvedTagged.tasks.filter((t: any) => !explicitIds.has(t.$id));
          resolvedTagged.credentials = resolvedTagged.credentials.filter((c: any) => !explicitIds.has(c.$id));
          resolvedTagged.totps = resolvedTagged.totps.filter((t: any) => !explicitIds.has(t.$id));
          resolvedTagged.events = resolvedTagged.events.filter((e: any) => !explicitIds.has(e.$id));
          resolvedTagged.forms = resolvedTagged.forms.filter((f: any) => !explicitIds.has(f.$id));
          resolvedTagged.moments = resolvedTagged.moments.filter((m: any) => !explicitIds.has(m.$id));
        } catch (taggedErr) {
          console.error('Failed to resolve tagged resources:', taggedErr);
        }
      }

      setNotes(resolvedNotes as any);
      setTasks(resolvedTasks as any);
      setCredentials(resolvedCreds as any);
      setSubProjects(resolvedSubProjs as any);
      setForms(resolvedForms as any);
      setEvents(resolvedEvents as any);
      setTags(resolvedTags as any);
      setTotps(resolvedTotps as any);
      setMoments(resolvedMoments as any);
      setCalls(resolvedCalls as any);
      setTaggedResources(resolvedTagged);

      return {
        notes: resolvedNotes,
        tasks: resolvedTasks,
        credentials: resolvedCreds,
        subProjects: resolvedSubProjs as any,
        forms: resolvedForms,
        events: resolvedEvents,
        tags: resolvedTags,
        totps: resolvedTotps,
        moments: resolvedMoments,
        calls: resolvedCalls,
        taggedResources: resolvedTagged
      };
    } catch (err) {
      console.error('Failed to resolve entities', err);
      return {};
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
      if (!hasTeamsKylrixPlan(user, currentTier)) {
          showError('Project collaboration requires a Teams subscription on the project owner account.');
          openProUpgrade('Project Collaboration');
          return;
      }

      openUnified('share-note', {
          resourceId: projectId as string,
          resourceType: 'project',
          resourceTitle: project?.title || 'Project',
          onShared: async (userId: string, permission: string) => {
              await ProjectsService.addCollaborator(projectId as string, userId, permission);
              await fetchProjectData();
          }
      });
  };

  if (!loading && !project) {
    return (
      <div className="text-center py-20 bg-[#0A0908] min-h-screen text-white flex flex-col items-center justify-center gap-4">
        <h3 className="text-white text-xl font-black">
          Project not found
        </h3>
        <button 
          onClick={() => router.push('/projects')} 
          className="text-[#6366F1] hover:text-[#818CF8] font-bold text-sm"
        >
          Back to projects
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0908] text-white pt-2 md:pt-6 pb-20">
      <MultiSectionContainer panels={['note', 'huddles', 'goals']} contextId={projectId as string}>
        <div className="w-full">
        
        {isCollaborationSuspended && !isOwner && ownerProfile && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                        <Users size={18} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">Collaboration Suspended</p>
                        <p className="text-xs text-white/60">
                            The project owner does not have an active Teams plan. Collaboration is currently disabled.
                        </p>
                    </div>
                </div>
                {ownerProfile.username && (
                    <button
                        onClick={() => {
                            router.push(`/app?chat=${ownerProfile.username}`);
                        }}
                        className="h-9 px-4 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 transition-colors flex items-center gap-1.5"
                    >
                        <MessageSquare size={14} />
                        <span>Message @{ownerProfile.username}</span>
                    </button>
                )}
            </div>
        )}

        {/* Modern Breadcrumb / Top Bar */}
        <div className="flex flex-col md:flex-row gap-4 md:gap-0 items-start md:items-center justify-between mb-8 select-none">
            <div className="flex items-center gap-3.5 w-full md:w-auto min-w-0">
                <button
                    onClick={() => router.push('/projects')}
                    className="w-11 h-11 bg-[#161412] text-white border border-white/6 rounded-[14px] flex items-center justify-center hover:bg-[#1C1A18] hover:-translate-x-0.5 transition-all flex-shrink-0"
                >
                    <ArrowLeft size={20} />
                </button>
                <div className="min-w-0 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {loading ? (
                          <div className="h-7 w-32 bg-white/5 animate-pulse rounded-lg" />
                        ) : (
                          <>
                            <h2 className="text-white font-black text-xl md:text-2xl tracking-tight leading-tight truncate">
                                {project.title}
                            </h2>
                            <span 
                                style={{
                                    backgroundColor: project.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                    color: project.status === 'active' ? '#10B981' : '#F59E0B',
                                    borderColor: project.status === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'
                                }}
                                className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border flex-shrink-0" 
                            >
                                {project.status}
                            </span>
                          </>
                        )}
                    </div>
                    {loading ? (
                      <div className="h-4 w-48 bg-white/5 animate-pulse rounded mt-1.5" />
                    ) : (
                      <span className="text-xs text-white/40 font-bold block mt-1">
                          {projectObjects.length} linked ecosystem objects • {collaborators.length + 1} participants
                      </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-start md:justify-end flex-wrap">
                {/* Active Collaborators HUD */}
                {projectId && resourcePresence[projectId as string]?.length > 0 && (
                    <div className="flex -space-x-2 mr-2 hidden sm:flex">
                        {resourcePresence[projectId as string].map((p, idx) => (
                            <div key={p.userId} className="relative transition-transform hover:z-20" style={{ zIndex: 10 - idx }}>
                                <IdentityAvatar 
                                    size={32}
                                    status={p.state}
                                    sx={{ border: '3px solid #0A0908' }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Instant Discussion Huddle Spin-up Button */}
                <button
                    onClick={handleDiscussionClick}
                    disabled={initializingHuddle}
                    style={{
                        backgroundColor: metadata.discussionNoteId ? 'rgba(129,140,248,0.15)' : '#161412',
                        color: metadata.discussionNoteId ? '#818CF8' : 'rgba(255,255,255,0.6)',
                        borderColor: metadata.discussionNoteId ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.06)'
                    }}
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center border hover:bg-white/5 transition-all relative flex-shrink-0"
                >
                    {initializingHuddle ? (
                        <div className="w-5 h-5 border border-white/40 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <MessageSquare size={20} />
                    )}
                    {metadata.discussionNoteId && (
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#818CF8] border-2 border-[#0A0908]" />
                    )}
                </button>

                <button
                    onClick={() => openUnified('project-settings', { project, onSave: handleSaveSettings })}
                    className="h-11 rounded-[14px] border border-white/6 hover:border-white/20 text-white/60 hover:text-white px-4 font-black text-xs inline-flex items-center justify-center gap-1.5 transition-all bg-white/2 hover:bg-white/4"
                >
                    <SettingsIcon size={16} />
                    <span className="hidden sm:inline">Settings</span>
                </button>
                <button
                    onClick={handleAddCollaborator}
                    className="h-11 rounded-[14px] border border-white/6 hover:border-white/20 text-white/60 hover:text-white px-4 font-black text-xs inline-flex items-center justify-center gap-1.5 transition-all bg-white/2 hover:bg-white/4"
                >
                    <Users size={16} />
                    <span className="hidden sm:inline">Collaborator</span>
                </button>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="h-11 rounded-[14px] bg-[#6366F1] hover:bg-[#6366F1]/90 text-black px-5 font-black text-xs inline-flex items-center justify-center gap-1.5 transition-all shadow-[0_8px_20px_rgba(99,102,241,0.2)]"
                >
                    <PlusCircle size={16} />
                    <span>Integrate</span>
                </button>
            </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* Left Content Column */}
            <div className="xl:col-span-2 flex flex-col gap-6">
                <div className="mb-2 flex items-center gap-3 p-4 rounded-[20px] bg-[#161412] border border-white/6 hover:border-white/10 transition-all select-none">
                    <Info size={18} className="text-[#6366F1] flex-shrink-0" />
                    <p className="text-white/60 text-xs font-medium leading-relaxed">
                        All integrated internal objects inherit project member&apos;s permission level, except on object level permission override.
                    </p>
                </div>

                <div className="bg-[#161412] border border-white/6 rounded-[32px] overflow-hidden shadow-2xl">
                    <div className="border-b border-white/6 px-6 bg-white/[0.01] overflow-x-auto scrollbar-none flex gap-6">
                        {TABS_CONFIG.map((tab, index) => {
                            const isActive = tabValue === index;
                            return (
                                <button
                                    key={index}
                                    onClick={() => setTabValue(index)}
                                    onContextMenu={(e) => handleTabContextMenu(e, index)}
                                    onTouchStart={(e) => handleTabTouchStart(e, index)}
                                    onTouchMove={handleTabTouchMove}
                                    onTouchEnd={handleTabTouchEnd}
                                    className={`flex items-center gap-2 py-5 font-black text-sm border-b-2 transition-all duration-200 whitespace-nowrap outline-none ${
                                        isActive 
                                            ? 'border-[#6366F1] text-[#6366F1]' 
                                            : 'border-transparent text-white/40 hover:text-white'
                                    }`}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-4 md:p-8">
                        {/* Integrated Notes */}
                        <CustomTabPanel value={tabValue} index={0}>
                            {loading ? null : resolving ? <LoadingPlaceholder /> : notes.length === 0 ? <EmptyState kind="note" /> : (
                                <div className="flex flex-col gap-4">
                                    {notes.map(note => (
                                        <ResourceItem 
                                            key={note.$id}
                                            id={note.$id}
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
                                    ))}
                                </div>
                            )}
                        </CustomTabPanel>
                        
                        {/* Execution Goals */}
                        <CustomTabPanel value={tabValue} index={1}>
                            {loading ? null : resolving ? <LoadingPlaceholder /> : tasks.length === 0 ? <EmptyState kind="goal" /> : (
                                <div className="flex flex-col gap-4">
                                    {tasks.map(task => (
                                        <ResourceItem 
                                            key={task.$id}
                                            id={task.$id}
                                            title={task.title} 
                                            kind="goal"
                                            metadata={`${task.status.replace('-', ' ')} • ${task.priority}`}
                                            onOpen={() => openSecondarySidebar('task', task.$id)}
                                            onUnlink={() => handleRemoveObject(task.$id)}
                                            keepPermission={task.keepPermission}
                                            onToggleKeepPermission={(checked) => handleToggleKeepPermission(task.$id, 'goal', checked)}
                                        />
                                    ))}
                                </div>
                            )}
                        </CustomTabPanel>

                        {/* Vault Assets */}
                        <CustomTabPanel value={tabValue} index={2}>
                            {loading ? null : resolving ? <LoadingPlaceholder /> : (credentials.length === 0 && totps.length === 0) ? <EmptyState kind="password" /> : (
                                <div className="flex flex-col gap-4">
                                    {credentials.map(cred => (
                                        <ResourceItem 
                                            key={cred.$id}
                                            id={cred.$id}
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
                                    ))}
                                    {totps.map(totp => (
                                        <ResourceItem 
                                            key={totp.$id}
                                            id={totp.$id}
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
                                    ))}
                                </div>
                            )}
                        </CustomTabPanel>

                        {/* Sub-Projects */}
                        <CustomTabPanel value={tabValue} index={3}>
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => {
                                        if (!hasTeamsKylrixPlan(user, currentTier)) {
                                            openProUpgrade('Project Collaboration');
                                        } else {
                                            setIsAddSubProjectModalOpen(true);
                                        }
                                    }}
                                    className="inline-flex items-center gap-1.5 text-white bg-white/2 hover:bg-[#6366F1]/10 border border-white/8 hover:border-[#6366F1]/30 font-extrabold text-xs px-3.5 py-1.5 rounded-[12px] transition-all"
                                >
                                    <Plus size={14} />
                                    <span>Integrate Sub-Project</span>
                                </button>
                            </div>
                            {loading ? null : resolving ? <LoadingPlaceholder /> : subProjects.length === 0 ? <EmptyState kind="sub-project" /> : (
                                <div className="flex flex-col gap-4">
                                    {subProjects.map(sub => (
                                        <ResourceItem 
                                            key={sub.$id}
                                            id={sub.$id}
                                            title={sub.title || 'Untitled Project'}
                                            kind="project"
                                            metadata={sub.summary || 'Private Container'}
                                            onOpen={() => router.push(`/projects/${sub.$id}`)}
                                            onUnlink={() => handleRemoveObject(sub.$id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </CustomTabPanel>

                        {/* Events & Calls */}
                        <CustomTabPanel value={tabValue} index={4}>
                            {loading ? null : resolving ? <LoadingPlaceholder /> : (events.length === 0 && calls.length === 0) ? <EmptyState kind="event" /> : (
                                <div className="flex flex-col gap-4">
                                    {events.map(event => (
                                        <ResourceItem 
                                            key={event.$id}
                                            id={event.$id}
                                            title={event.title} 
                                            kind="event"
                                            metadata={`${event.location || 'No location'} • ${new Date(event.startTime).toLocaleString()}`}
                                            onOpen={() => openSecondarySidebar('event', event.$id, event)}
                                            onUnlink={() => handleRemoveObject(event.$id)}
                                            keepPermission={event.keepPermission}
                                            onToggleKeepPermission={(checked) => handleToggleKeepPermission(event.$id, 'event', checked)}
                                        />
                                    ))}
                                    {calls.map(call => (
                                        <ResourceItem 
                                            key={call.$id}
                                            id={call.$id}
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
                                    ))}
                                </div>
                            )}
                        </CustomTabPanel>

                        {/* Interconnected Flow: Forms, Tags, Moments */}
                        <CustomTabPanel value={tabValue} index={5}>
                            {loading ? null : resolving ? <LoadingPlaceholder /> : (forms.length === 0 && moments.length === 0) ? <EmptyState kind="flow" /> : (
                                <div className="flex flex-col gap-4">
                                    {forms.map(form => (
                                        <ResourceItem 
                                            key={form.$id}
                                            id={form.$id}
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
                                    ))}
                                    {moments.map(moment => (
                                        <ResourceItem 
                                            key={moment.$id}
                                            id={moment.$id}
                                            title={moment.caption || 'Integrated Moment'} 
                                            kind="moment"
                                            metadata={`Published: ${new Date(moment.$createdAt || moment.createdAt).toLocaleDateString()}`}
                                            onOpen={() => router.push(`/connect/post/${moment.$id}`)}
                                            onUnlink={() => handleRemoveObject(moment.$id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </CustomTabPanel>
                    </div>
                </div>

                {/* --- Project Tags Section --- */}
                <div className="bg-[#161412] border border-white/6 rounded-[32px] overflow-hidden shadow-2xl mt-8">
                    <div className="border-b border-white/6 px-6 py-5 bg-white/[0.01] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Tag size={18} className="text-[#6366F1] flex-shrink-0" />
                          <span className="text-white font-black text-base tracking-tight leading-none block">
                              Project Tags
                          </span>
                        </div>
                        <button
                            onClick={() => {
                                setAddModalTab(5); // Tags tab index
                                setIsAddModalOpen(true);
                            }}
                            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white/40 hover:text-white bg-white/5 hover:bg-[#6366F1]/20 border border-white/6 hover:border-[#6366F1]/30 transition-all"
                        >
                            <Plus size={14} />
                        </button>
                    </div>

                    <div className="p-4 md:p-8">
                        {tags.length === 0 ? (
                            <div className="py-8 text-center text-white/30 italic text-sm">
                                No tags linked to this project.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <span 
                                      key={tag.$id}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1C1A18] rounded-lg border border-[#34322F] text-xs font-black font-mono tracking-wider transition-all hover:border-[#6366F1]/50 cursor-default"
                                      style={{ color: tag.color || '#6366F1' }}
                                    >
                                        # {tag.name.toUpperCase()}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tagged Resources Section */}
                {tags.length > 0 && (
                  <div className="bg-[#161412] border border-white/6 rounded-[32px] overflow-hidden shadow-2xl mt-8">
                      <div className="border-b border-white/6 px-6 py-5 bg-white/[0.01] flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Tag size={18} className="text-[#6366F1] flex-shrink-0" />
                            <span className="text-white font-black text-base tracking-tight leading-none block">
                                Tagged Resources
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleOpenAutoSweepSettings}
                              title="Auto-sweep settings"
                              className="p-1.5 rounded-lg text-white/40 hover:text-white bg-white/2 hover:bg-white/5 border border-white/6 transition-all duration-200"
                            >
                              <SettingsIcon size={16} />
                            </button>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                              autoSweepEnabled
                                ? 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20'
                                : 'bg-white/5 text-white/35 border-white/10'
                            }`}>
                              {autoSweepEnabled ? 'AUTO-SWEPT' : 'SWEEP OFF'}
                            </span>
                          </div>
                      </div>
                      
                      <div className={`px-6 py-3 border-b border-white/4 flex items-start gap-2.5 ${
                        autoSweepEnabled ? 'bg-[#6366F1]/5' : 'bg-[#10B981]/5'
                      }`}>
                          {autoSweepEnabled ? (
                            <RefreshCw size={14} className="text-[#6366F1] flex-shrink-0 mt-0.5" />
                          ) : (
                            <ShieldCheck size={14} className="text-[#10B981] flex-shrink-0 mt-0.5" />
                          )}
                          <p className="text-[10px] text-white/55 font-bold leading-relaxed">
                            {autoSweepEnabled ? (
                              <>
                                <span className="text-[#6366F1]">Auto-sweep is ON for you.</span>{' '}
                                Every object you own with this project&apos;s tags can appear here for members.
                                Object permissions stay as you set them — use the settings gear to turn this off.
                              </>
                            ) : (
                              <>
                                <span className="text-[#10B981]">Auto-sweep is OFF (default).</span>{' '}
                                Your tagged items stay private to your account and are not listed here unless you
                                explicitly enable auto-sweep in settings.
                              </>
                            )}
                          </p>
                      </div>

                      <div className="p-4 md:p-8">
                          {Object.values(taggedResources).every(arr => arr.length === 0) ? (
                            <div className="py-8 text-center text-white/30 italic text-sm">
                                No external resources swept by these tags.
                            </div>
                          ) : (
                            <TaggedResourcesTabs 
                                resources={taggedResources} 
                                openSidebar={openSidebar}
                                openSecondarySidebar={openSecondarySidebar}
                                openOverlay={openOverlay}
                                closeOverlay={closeOverlay}
                                fetchProjectData={fetchProjectData}
                                handleToggleKeepPermission={handleToggleKeepPermission}
                                handleRemoveObject={handleRemoveObject}
                                router={router}
                                showError={showError}
                            />
                          )}
                      </div>
                  </div>
                )}

                {/* External Objects Card */}
                <div className="bg-[#161412] border border-white/6 rounded-[32px] overflow-hidden shadow-2xl mt-8">
                    <div className="border-b border-white/6 px-6 py-5 bg-white/[0.01] flex items-center gap-3">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                        </svg>
                        <span className="text-white font-black text-base tracking-tight leading-none block">
                            GitHub Repositories
                        </span>
                    </div>

                    <div className="p-4 md:p-8">
                        <GitHubExternalObjectsTab 
                            projectId={projectId as string}
                            projectObjects={projectObjects}
                            fetchProjectData={fetchProjectData}
                            tasks={tasks}
                        />
                    </div>
                </div>

                {/* Suggested Workflows Section */}
                <div className="mt-8 select-none">
                    <span className="text-[10px] text-white/30 font-black uppercase tracking-wider block mb-4">
                        Suggested Workflows
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                        {[
                            { title: 'Project Documentation', icon: FileText, color: '#EC4899', desc: 'Create a new note specific to this project.' },
                            { title: 'Sprint Planning', icon: CheckSquare, color: '#A855F7', desc: 'Initialize a goal to track execution.' },
                            { title: 'Access Hardening', icon: Lock, color: '#10B981', desc: 'Store new secrets for the team.' }
                        ].map(wf => (
                            <div 
                                key={wf.title} 
                                className="relative flex flex-col justify-between gap-4 p-5 rounded-[24px] bg-[#161412] border border-white/6 hover:border-white/12 hover:bg-[#1C1A18] transition-all duration-300 ease-out cursor-pointer overflow-hidden group"
                                style={{
                                    borderLeft: `3px solid ${wf.color}`
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div style={{ color: wf.color }} className="flex-shrink-0"><wf.icon size={18} /></div>
                                    <h4 className="text-white text-sm font-black tracking-tight leading-tight">{wf.title}</h4>
                                </div>
                                <p className="text-xs text-white/40 font-medium leading-relaxed">{wf.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Integrations Section */}
                <div className="mt-8 select-none">
                    <span className="text-[10px] text-white/30 font-black uppercase tracking-wider block mb-4">
                        Integrations
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                        <div 
                            onClick={() => openUnified('github-integration', { context: 'project', projectId: projectId as string, tasks: tasks, onSaved: fetchProjectData })}
                            className="relative flex flex-col justify-between gap-4 p-5 rounded-[24px] bg-[#161412] border border-white/6 hover:border-[#6366F1]/30 hover:bg-[#1C1A18] transition-all duration-300 ease-out cursor-pointer overflow-hidden group"
                            style={{
                                borderLeft: '3px solid #6366F1'
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="text-[#6366F1] flex-shrink-0">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                                    </svg>
                                </div>
                                <h4 className="text-white text-sm font-black tracking-tight leading-tight">GitHub</h4>
                                {gitIntegration?.enabled && (
                                    <span className="ml-auto bg-[#10B981]/15 text-[#10B981] text-[9px] font-black tracking-wider px-2 py-0.5 rounded border border-[#10B981]/20">
                                        CONNECTED
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-white/40 font-medium leading-relaxed min-h-[36px]">
                                {gitIntegration?.enabled 
                                    ? `Connected to ${gitIntegration.ownerName}/${gitIntegration.repoName}` 
                                            : 'Link your GitHub repository to sync tasks, issues, and pull requests.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Sidebar Column */}
            <div className="flex flex-col gap-6">
                {/* Participants */}
                <div className="relative flex flex-col gap-4 p-6 w-full rounded-[28px] bg-[#161412] border border-white/6 hover:border-white/12 transition-all duration-300 ease-out select-none">
                    <div className="flex items-center justify-between gap-4 pb-2.5 border-b border-white/4">
                        <h3 className="text-white text-base font-black tracking-tight leading-tight">
                            Project Members
                        </h3>
                        <div className="flex items-center gap-1.5">
                            <button 
                                onClick={handleCopyInviteLink}
                                title="Copy Invite Link"
                                className="p-1.5 rounded-lg text-white/40 hover:text-white bg-white/2 hover:bg-white/5 border border-white/4 transition-all duration-200"
                            >
                                <Copy size={14} />
                            </button>
                            <button 
                                onClick={handleAddCollaborator}
                                title="Add Collaborator"
                                className="p-1.5 rounded-lg text-[#6366F1] bg-[#6366F1]/10 hover:bg-[#6366F1]/20 border border-[#6366F1]/20 transition-all duration-200"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        {/* Project Owner Section */}
                        <div className="p-3 rounded-[16px] bg-[#0A0908] border border-white/4 hover:border-white/8 transition-colors flex items-center gap-3">
                            <div className="flex-shrink-0">
                                <IdentityAvatar 
                                    size={34} 
                                    fileId={ownerProfile?.profilePicId || ownerProfile?.avatar || null} 
                                    alt={ownerProfile?.displayName || ownerProfile?.name || 'Owner'} 
                                    fallback={(ownerProfile?.displayName || ownerProfile?.name || 'O').charAt(0).toUpperCase()} 
                                    verified={ownerProfile?.verified ?? true} 
                                    isAvatar={ownerProfile?.isAvatar ?? true}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-white text-sm font-black tracking-tight block truncate">
                                    {ownerProfile?.displayName || ownerProfile?.name || ownerProfile?.username || ownerProfile?.email || 'Project Owner'}
                                </span>
                                <span className="text-[10px] text-white/40 font-semibold block truncate">
                                    {ownerProfile?.displayName || ownerProfile?.name ? (ownerProfile?.username ? `@${ownerProfile.username}` : 'Project Owner') : 'Project Owner'}
                                </span>
                            </div>
                            <span className="flex-shrink-0 bg-[#6366F1]/12 text-[#6366F1] text-[9px] font-black px-2 py-0.5 rounded border border-[#6366F1]/20">
                                OWNER
                            </span>
                        </div>

                        {/* Collaborators Section (Active and Pending) */}
                        {activeCollaborators.map(user => (
                            <div 
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
                                className="p-3 rounded-[16px] bg-[#0A0908] border border-white/4 hover:border-white/10 hover:bg-white/2 cursor-pointer transition-all flex items-center gap-3"
                            >
                                <div className="flex-shrink-0">
                                    <IdentityAvatar 
                                        size={34} 
                                        fileId={user.avatar || user.profilePicId} 
                                        alt={user.displayName || user.name || 'Collaborator'} 
                                        fallback={(user.displayName || user.name || 'C').charAt(0).toUpperCase()} 
                                        verified={user.verified} 
                                        isAvatar={user.isAvatar ?? true}
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-white text-sm font-black tracking-tight block truncate">
                                        {user.displayName || user.name || user.email}
                                    </span>
                                    <span className="text-[10px] text-white/40 font-semibold block truncate capitalize">
                                        {user.permissionLevel || 'Viewer'}
                                    </span>
                                </div>
                                
                                {user.status === 'pending' && (
                                    <span className="flex-shrink-0 bg-[#F59E0B]/10 text-[#F59E0B] text-[9px] font-black px-2 py-0.5 rounded border border-[#F59E0B]/20">
                                        PENDING
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Join Requests (Admins / Owners only) */}
                {isAdmin && (
                    <div className="relative flex flex-col gap-4 p-6 w-full rounded-[28px] bg-[#161412] border border-white/6 hover:border-white/12 transition-all duration-300 ease-out select-none">
                        <div className="border-b border-white/4 pb-2.5 flex items-center justify-between">
                            <h3 className="text-white text-base font-black tracking-tight leading-tight">
                                Join Requests
                            </h3>
                            {joinRequests.length > 0 && (
                                <span className="bg-[#10B981]/15 text-[#10B981] text-[9px] font-black tracking-wider px-2 py-0.5 rounded border border-[#10B981]/20 uppercase">
                                    {joinRequests.length} Pending
                                </span>
                            )}
                        </div>
                        {joinRequests.length === 0 ? (
                            <div className="text-center py-4 opacity-40">
                                <p className="text-xs font-semibold text-white">No pending join requests.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {joinRequests.map((req) => (
                                    <div key={req.$id || req.userId} className="p-3 rounded-[16px] bg-[#0A0908] border border-white/4 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <IdentityAvatar 
                                                size={34} 
                                                fileId={req.avatar || req.profilePicId} 
                                                alt={req.displayName || req.name || 'Requester'} 
                                                fallback={(req.displayName || req.name || 'R').charAt(0).toUpperCase()} 
                                                verified={req.verified} 
                                                isAvatar={req.isAvatar ?? true}
                                            />
                                            <div className="min-w-0">
                                                <span className="text-white text-sm font-black tracking-tight block truncate">
                                                    {req.displayName || req.name || req.email}
                                                </span>
                                                <span className="text-[10px] text-white/40 font-semibold block truncate">
                                                    Requested access
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 shrink-0">
                                            <button
                                                onClick={() => handleApproveJoinRequest(req)}
                                                className="px-2.5 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/80 text-black text-[10px] font-black transition cursor-pointer"
                                            >
                                                Grant
                                            </button>
                                            <button
                                                onClick={() => handleRejectJoinRequest(req)}
                                                className="px-2.5 py-1.5 rounded-lg bg-red-950/20 border border-red-900/30 hover:border-red-500/20 text-red-400 text-[10px] font-black transition cursor-pointer"
                                            >
                                                Deny
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Project Insights */}
                <div className="relative flex flex-col gap-4 p-6 w-full rounded-[28px] bg-[#161412] border border-white/6 hover:border-white/12 transition-all duration-300 ease-out select-none">
                    <div className="border-b border-white/4 pb-2.5">
                        <h3 className="text-white text-base font-black tracking-tight leading-tight">
                            Project Insights
                        </h3>
                    </div>
                    <p className="text-sm text-white/50 font-medium leading-relaxed">
                        {project.summary || 'This project is used to group and coordinate your work.'}
                    </p>
                    
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => openUnified('project-visibility', { project, onSave: handleSaveVisibility })}
                            className="p-3 rounded-[16px] bg-[#0A0908] border border-white/4 hover:border-[#6366F1]/30 transition-all flex flex-col gap-1.5 text-left w-full cursor-pointer group"
                        >
                            <span className="text-[9px] text-white/30 font-black uppercase tracking-wider group-hover:text-[#6366F1] transition-colors">Visibility</span>
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2 text-[#6366F1]">
                                    <Globe size={14} />
                                    <span className="text-sm font-black capitalize">
                                        {project.visibility}{project.visibility === 'public' && (project.isGuest ? ' (Guest Access)' : ' (Authenticated Only)')}
                                    </span>
                                </div>
                                <ChevronDown size={14} className="text-white/40 group-hover:text-white transition-colors" />
                            </div>
                        </button>
                        <div className="p-3 rounded-[16px] bg-[#0A0908] border border-white/4 flex flex-col gap-1.5">
                            <span className="text-[9px] text-white/30 font-black uppercase tracking-wider">Last Update</span>
                            <div className="flex items-center gap-2 text-white/60">
                                <History size={14} />
                                <span className="text-sm font-black">{new Date(project.updatedAt || '').toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="p-3 rounded-[16px] bg-[#1A0C0C]/50 border border-red-900/30 flex flex-col gap-2">
                            <span className="text-[9px] text-red-500/60 font-black uppercase tracking-wider">Danger Zone</span>
                            <button
                                onClick={handleDeleteProject}
                                className="w-full py-2.5 rounded-xl border border-red-950 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Trash2 size={14} />
                                <span>Delete Project</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>
      </MultiSectionContainer>

      {isAddModalOpen && (
        <ProjectAddObjectModal
          open={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          projectId={projectId as string}
          onAdded={fetchProjectData}
          initialTab={addModalTab}
          linkedObjects={projectObjects.map((o) => ({
            entityKind: o.entityKind,
            entityId: o.entityId,
          }))}
          linkedTags={tags}
          onRemoveLinked={async (entityId) => {
            const obj = projectObjects.find((o) => o.entityId === entityId && o.entityKind === 'tag');
            if (!obj) return;
            await ProjectsService.removeObjectFromProject(obj.$id);
            showSuccess('Tag removed from project');
            fetchProjectData();
          }}
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



      {isAddSubProjectModalOpen && (
        <ProjectAddSubProjectModal
          open={isAddSubProjectModalOpen}
          onClose={() => setIsAddSubProjectModalOpen(false)}
          projectId={projectId as string}
          onAdded={fetchProjectData}
        />
      )}

      {/* Custom Tabs Context Menu */}
      {tabMenuAnchorEl && activeTabMenuIndex !== null && (
        <>
          <div className="fixed inset-0 z-50 cursor-default" onClick={() => { setTabMenuAnchorEl(null); setActiveTabMenuIndex(null); }} />
          <div 
            className="fixed z-[100] bg-[#13110F] border border-white/8 rounded-[16px] p-2 text-white shadow-2xl min-w-[180px] flex flex-col gap-0.5 select-none cursor-default"
            style={{ top: tabMenuAnchorEl.y, left: tabMenuAnchorEl.x }}
          >
            {activeTabMenuIndex === 0 && (
              <button
                onClick={() => {
                  setTabMenuAnchorEl(null);
                  setIsAddModalOpen(true);
                }}
                className="w-full text-left font-bold rounded-lg text-white/80 hover:text-white hover:bg-white/4 px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
              >
                <FileText size={16} />
                <span>Integrate Note</span>
              </button>
            )}
            {activeTabMenuIndex === 1 && (
              <button
                onClick={() => {
                  setTabMenuAnchorEl(null);
                  setIsAddModalOpen(true);
                }}
                className="w-full text-left font-bold rounded-lg text-white/80 hover:text-white hover:bg-white/4 px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
              >
                <CheckSquare size={16} />
                <span>Integrate Goal</span>
              </button>
            )}
            {activeTabMenuIndex === 2 && (
              <button
                onClick={() => {
                  setTabMenuAnchorEl(null);
                  setIsAddModalOpen(true);
                }}
                className="w-full text-left font-bold rounded-lg text-white/80 hover:text-white hover:bg-white/4 px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
              >
                <Lock size={16} />
                <span>Integrate Asset</span>
              </button>
            )}
            {activeTabMenuIndex === 3 && (
              <button
                onClick={() => {
                  setTabMenuAnchorEl(null);
                  if (!hasTeamsKylrixPlan(user, currentTier)) {
                    openProUpgrade('Project Collaboration');
                  } else {
                    setIsAddSubProjectModalOpen(true);
                  }
                }}
                className="w-full text-left font-bold rounded-lg text-white/80 hover:text-white hover:bg-white/4 px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
              >
                <FolderKanban size={16} />
                <span>Add Sub-Project</span>
              </button>
            )}
            {activeTabMenuIndex === 4 && (
              <button
                onClick={() => {
                  setTabMenuAnchorEl(null);
                  setIsAddModalOpen(true);
                }}
                className="w-full text-left font-bold rounded-lg text-white/80 hover:text-white hover:bg-white/4 px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
              >
                <Calendar size={16} />
                <span>Integrate Event/Call</span>
              </button>
            )}
            {activeTabMenuIndex === 5 && (
              <button
                onClick={() => {
                  setTabMenuAnchorEl(null);
                  showSuccess('Interconnected flow nodes re-synchronized');
                }}
                className="w-full text-left font-bold rounded-lg text-white/80 hover:text-white hover:bg-white/4 px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
              >
                <Workflow size={16} />
                <span>Re-sync Flow Nodes</span>
              </button>
            )}
            {activeTabMenuIndex === 6 && (
              <button
                disabled={!metadata.discussionNoteId}
                onClick={async () => {
                  setTabMenuAnchorEl(null);
                  if (metadata.discussionNoteId) {
                    if (window.confirm("Are you sure you want to wipe this entire discussion? All messages and replies will be permanently deleted.")) {
                      setInitializingHuddle(true);
                      try {
                        const commentsRes = await databases.listRows(
                          APPWRITE_CONFIG.DATABASES.NOTE,
                          'comments',
                          [Query.equal('noteId', metadata.discussionNoteId), Query.limit(1000)]
                        );
                        
                        const commentIds = (commentsRes.rows as any[]).map((c) => c.$id).filter(Boolean);
                        if (commentIds.length > 0) {
                          try {
                            await deleteReactionsForTarget(TargetType.COMMENT, commentIds);
                          } catch (e) {
                            console.warn('Failed to delete reactions during discussion wipe:', e);
                          }
                          
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
                          
                          await Promise.all(
                            commentIds.map((id) => databases.deleteRow(APPWRITE_CONFIG.DATABASES.NOTE, 'comments', id))
                          );
                        }
                        
                        await deleteGhostNoteForProject(metadata.discussionNoteId);
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
                className="w-full text-left font-bold rounded-lg text-[#FF4D4D] hover:bg-[#FF4D4D]/8 disabled:opacity-30 disabled:pointer-events-none px-3 py-2 text-sm flex items-center gap-2.5 transition-all"
              >
                <Trash2 size={16} />
                <span>Wipe Thread</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LoadingPlaceholder() {
    return (
        <div className="grid place-items-center py-8">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
}

function ResourceGridSkeleton() { return null; }

function EmptyState({ kind }: { kind: string }) {
    const icon = kind === 'note' ? <FileText size={32} /> : kind === 'goal' ? <CheckSquare size={32} /> : kind === 'sub-project' ? <FolderKanban size={32} /> : <Lock size={32} />;
    return (
        <div className="text-center py-6 opacity-40">
            <div className="mb-2 flex justify-center">{icon}</div>
            <p className="text-sm font-bold text-white">No {kind}s linked to this project yet.</p>
        </div>
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

      await attachObjectToProject({
        projectId: projectId as string,
        entityKind: 'unverified_github',
        entityId: fullPath,
        role: 'viewer',
        metadata,
      });

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
    <div className="flex flex-col gap-5">
      {unverifiedRepos.length === 0 && (
        <div className="p-5 rounded-[20px] bg-white/[0.02] border border-white/6">
          <h4 className="text-white text-sm font-black tracking-tight leading-tight mb-1">
            Associate GitHub Repository (Unverified)
          </h4>
          <p className="text-xs text-white/45 leading-relaxed mb-4">
            No GitHub connection is required. Paste any public GitHub repository URL or path (e.g. <code>facebook/react</code>) to integrate its live statistics, commit logs, and issues list directly into this project.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <input
              type="text"
              placeholder="e.g. facebook/react or https://github.com/facebook/react"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              disabled={adding}
              className="w-full bg-[#161412] border border-white/8 hover:border-white/15 focus:border-[#6366F1] rounded-[12px] px-4 py-2.5 text-white text-sm outline-none transition-all"
            />
            <button
              disabled={adding || !repoInput.trim()}
              onClick={() => handleAddRepo()}
              className="w-full sm:w-auto flex-shrink-0 text-black bg-[#6366F1] disabled:opacity-40 hover:bg-[#6366F1]/90 font-black text-sm px-6 py-2.5 rounded-[12px] transition-all shadow-[0_8px_20px_rgba(99,102,241,0.2)]"
            >
              {adding ? 'Adding...' : 'Add Repository'}
            </button>
          </div>

          <div className="mt-4">
            <span className="text-[9px] text-white/30 font-black uppercase tracking-wider block mb-2 font-mono">
              ⚡ Developer Favorites (1-Click Test Drive)
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'React', path: 'facebook/react', logo: '⚛️' },
                { label: 'Next.js', path: 'vercel/next.js', logo: '▲' },
                { label: 'Tailwind CSS', path: 'tailwindlabs/tailwindcss', logo: '🎨' }
              ].map((fav) => (
                <button
                  key={fav.path}
                  disabled={adding}
                  onClick={() => {
                    setRepoInput(fav.path);
                    handleAddRepo(fav.path);
                  }}
                  className="bg-white/2 hover:bg-[#6366F1]/10 text-white/60 hover:text-[#818CF8] border border-white/5 hover:border-[#6366F1]/25 px-2.5 py-1 rounded-[8px] font-extrabold text-[11px] transition-all"
                >
                  {fav.logo} {fav.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {unverifiedRepos.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-white/6 rounded-[20px]">
          <p className="text-sm text-white/40 italic">
            No unverified repositories linked yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {unverifiedRepos.map((repo) => {
            const path = repo.entityId;
            let cached: any = {};
            try {
              cached = typeof repo.metadata === 'string' ? JSON.parse(repo.metadata) : repo.metadata || {};
            } catch (e) {}

            const stats = liveStats[path] || cached || {};
            const loading = loadingLive[path];

            return (
              <div 
                key={repo.$id}
                className="p-5 rounded-[20px] bg-[#0A0908] border border-[#1C1A18] hover:border-white/10 flex flex-col gap-4 transition-all duration-300"
              >
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/5 text-white flex items-center justify-center flex-shrink-0">
                      <FolderKanban size={18} />
                    </div>
                    <div className="min-w-0">
                      <button 
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
                        className="font-black text-[#6366F1] hover:text-[#818CF8] hover:underline text-sm md:text-base text-left truncate block max-w-full"
                      >
                        {path}
                      </button>
                      <span className="text-[10px] text-white/40 block mt-0.5">
                        Linked {new Date(cached.addedAt || repo.$createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {loading && (
                      <div className="w-3.5 h-3.5 border border-amber-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}
                    <span className="bg-amber-500/10 text-amber-500 text-[8px] font-black tracking-wider px-1.5 py-0.5 rounded border border-amber-500/20">
                      UNVERIFIED
                    </span>
                    <button
                      onClick={() => handleRemoveRepo(repo.$id)}
                      className="text-red-500 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 font-extrabold text-[10px] px-2.5 py-1 rounded-[8px] transition-all"
                    >
                      Unlink
                    </button>
                  </div>
                </div>

                <p className="text-xs text-white/70 leading-relaxed">
                  {stats.description || 'Public GitHub Repository'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/[0.01] p-3.5 rounded-[12px] border border-white/2">
                  <div>
                    <span className="text-[10px] text-white/30 block mb-0.5">⭐ Stars</span>
                    <span className="text-sm font-extrabold text-white">{stats.stars ?? cached.stars ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 block mb-0.5">🎫 Open Issues</span>
                    <span className="text-sm font-extrabold text-white">{stats.openIssues ?? cached.openIssues ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 block mb-0.5">🔀 Open PRs</span>
                    <span className="text-sm font-extrabold text-white">{stats.pullsCount ?? cached.pullsCount ?? '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-white/30 block mb-0.5">🛠️ Language</span>
                    <span className="text-sm font-extrabold text-white">{stats.language ?? cached.language ?? '-'}</span>
                  </div>
                </div>

                {(stats.lastCommit || cached.lastCommit) && (
                  <div className="p-3.5 rounded-[12px] bg-[#6366F1]/3 border border-[#6366F1]/10">
                    <span className="text-[10px] text-[#6366F1] font-black block tracking-wider uppercase mb-1">
                      LATEST COMMIT LOG
                    </span>
                    <p className="font-extrabold text-white text-xs leading-normal mb-1.5">
                      {stats.lastCommit || cached.lastCommit}
                    </p>
                    <span className="text-[10px] text-white/40 block">
                      Authored by {stats.lastCommitAuthor || cached.lastCommitAuthor || 'Unknown'} {stats.lastCommitDate || cached.lastCommitDate ? `on ${new Date(stats.lastCommitDate || cached.lastCommitDate).toLocaleDateString()}` : ''}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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

      await attachObjectToProject({
        projectId: projectId as string,
        entityKind: 'goal',
        entityId: taskId,
      });

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
    <div className="h-full flex flex-col bg-[#161412] text-white">
      <div className="p-5 border-b border-white/6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
          </svg>
          <div className="min-w-0">
            <span className="block font-black text-xs text-[#6366F1] font-mono leading-none mb-1">
              unverified_github
            </span>
            <span className="block font-black text-sm text-white truncate max-w-[200px] md:max-w-xs leading-none">
              {repoPath}
            </span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white bg-white/2 hover:bg-white/5 transition-all"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5">
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white/[0.01] border border-white/4 rounded-[12px]">
              <span className="text-[10px] text-white/35 block mb-1">⭐ Stars</span>
              <span className="text-sm font-black text-white">{stats.stargazers_count}</span>
            </div>
            <div className="p-3 bg-white/[0.01] border border-white/4 rounded-[12px]">
              <span className="text-[10px] text-white/35 block mb-1">🎫 Open Issues</span>
              <span className="text-sm font-black text-white">{stats.open_issues_count}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => window.open(`https://github.com/${repoPath}`, '_blank')}
            className="w-full flex items-center justify-center gap-1.5 bg-white/2 hover:bg-white/5 border border-white/6 hover:border-white/15 text-white font-extrabold text-sm py-2.5 rounded-[12px] transition-all"
          >
            <ExternalLink size={14} />
            <span>Open on GitHub</span>
          </button>
          <button
            onClick={loadRepoData}
            className="w-full flex items-center justify-center gap-1.5 bg-white/2 hover:bg-white/5 border border-white/6 hover:border-white/15 text-white/70 hover:text-white font-extrabold text-sm py-2.5 rounded-[12px] transition-all"
          >
            <RefreshCw size={14} />
            <span>Sync Live Feed</span>
          </button>
        </div>

        <div className="h-px bg-white/6" />

        <div className="flex flex-col gap-3">
          <span className="text-[10px] text-white/40 font-black uppercase tracking-wider block font-mono">
            Live Open Issues ({issues.length})
          </span>

          {loadingIssues ? (
            <div className="py-8 flex justify-center">
              <div className="w-5 h-5 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : issuesError ? (
            <span className="text-xs text-red-500 italic block">{issuesError}</span>
          ) : issues.length === 0 ? (
            <p className="text-sm text-white/40 italic">
              No open public issues found in this repository.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {issues.map((issue) => (
                <div 
                  key={issue.id}
                  className="p-4 rounded-[16px] bg-white/[0.01] border border-white/4 hover:border-white/8 flex flex-col gap-3 transition-all duration-200"
                >
                  <div>
                    <div className="flex gap-1.5 items-start">
                      <span className="font-bold text-[#6366F1] font-mono text-xs mt-0.5">#{issue.number}</span>
                      <span className="font-extrabold text-white text-xs leading-normal">{issue.title}</span>
                    </div>
                    <span className="text-[10px] text-white/35 block mt-1">
                      Opened by @{issue.user?.login} • {new Date(issue.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {issue.labels && issue.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {issue.labels.slice(0, 3).map((label: any) => (
                        <span
                          key={label.id}
                          style={{
                            backgroundColor: label.color ? `#${label.color}15` : undefined,
                            color: label.color ? `#${label.color}` : undefined,
                            borderColor: label.color ? `#${label.color}30` : undefined,
                          }}
                          className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-white/4 border-white/8 text-white"
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => window.open(issue.html_url, '_blank')}
                      className="font-black text-[10px] text-white/50 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink size={10} />
                      <span>Open Live</span>
                    </button>

                    {isAlreadyLinked(issue) ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/20">
                        <Check size={10} />
                        <span>Goal Linked</span>
                      </span>
                    ) : (
                      <button
                        disabled={convertingIssueId === issue.id}
                        onClick={() => handleConvertToGoal(issue)}
                        className="font-black text-[10px] text-[#6366F1] hover:text-[#818CF8] flex items-center gap-1 transition-colors disabled:opacity-40"
                      >
                        {convertingIssueId === issue.id ? (
                          <div className="w-2.5 h-2.5 border border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Plus size={10} />
                        )}
                        <span>Convert to Goal</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
