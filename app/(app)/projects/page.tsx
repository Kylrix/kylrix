'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  IconButton,
  Button,
  Chip,
  Paper,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Stack,
  Typography,
  CircularProgress,
  alpha,
  useTheme,
} from '@/lib/mui-tailwind/material';
import {
  Plus,
  FolderKanban,
  Rocket,
  ShieldAlert,
  Briefcase,
  Zap,
  ArrowLeft,
  ArrowUpRight,
  Workflow,
  Sparkles,
  ClipboardList,
  Lightbulb,
  GraduationCap,
  Megaphone,
  Key,
  Video,
  LifeBuoy,
  Book,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Users,
  Pin,
  Trash2,
  Lock,
  Globe,
  LayoutGrid,
  FileText,
  Activity,
  Play,
  RotateCcw,
  UserCheck,
  Terminal,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useFAB } from '@/context/FABContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects } from '@/types/appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useLocalContext } from '@/lib/context-engine';
import { useAuth } from '@/lib/auth';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { createNote } from '@/lib/appwrite/note';
import { anonymizeWorkflow, negateWorkflow, WorkflowChain } from '@/lib/workflow-engine';
import { 
  saveWorkflowAction, 
  listWorkflowsAction, 
  deleteWorkflowAction 
} from '@/lib/actions/workflows';

const projectTemplates = [
  { 
    id: 'form-to-project',
    title: 'Analyze Responses', 
    summary: 'Convert intake forms into context and auto-spin execution tasks.',
    icon: ClipboardList,
    color: '#6366F1',
    description: 'Transform feedback into action. Automatically connects form responses to your project context and creates execution tasks.'
  },
  { 
    id: 'idea-to-execution',
    title: 'Launch Projects', 
    summary: 'Spin up roadmaps, schedule syncs, and bundle secrets from a single note.',
    icon: Lightbulb,
    color: '#EC4899',
    description: 'The definitive flow for starting fast. Start with a simple note and instantly generate tasks, schedule weekly calls, and bundle secrets.'
  },
  { 
    id: 'academic-research',
    title: 'Deep Research', 
    summary: 'Handle 6M+ char studies, surveys, and research milestones.',
    icon: GraduationCap,
    color: '#A855F7',
    isPro: true,
    description: 'Specialized academic workflows. Supports massive long-form content, research milestones, and questionnaire-based data collection.'
  },
  { 
    id: 'social-pulse',
    title: 'Grow Audience', 
    summary: 'Sync campaign moments with scheduled events and engagement tracking.',
    icon: Megaphone,
    color: '#10B981',
    description: 'Sync your social presence. Coordinate Campaign Moments with scheduled events and real-time engagement tracking.'
  },
  { 
    id: 'secure-handover',
    title: 'Secure Delivery', 
    summary: 'Deliver results with vault-locked handover syncs and ephemeral links.',
    icon: Key,
    color: '#F59E0B',
    description: 'The professional hand-off. Bundle credentials securely, schedule a sync call, and use ephemeral sharing links.'
  },
  { 
    id: 'team-huddle-center',
    title: 'Unite Teams', 
    summary: 'Centralize persistent calls and project-isolated group chat threads.',
    icon: Video,
    color: '#3B82F6',
    description: 'Centralize communication. Keeps your team synchronized with recurring call links and a project-isolated chat environment.'
  },
  { 
    id: 'service-desk',
    title: 'Scale Support', 
    summary: 'Route form requests directly to tasks and focused execution sessions.',
    icon: LifeBuoy,
    color: '#EF4444',
    description: 'Manage requests efficiently. Link support forms directly to project tasks and resolve them in timed focus blocks.'
  },
  { 
    id: 'wiki-knowledge-hub',
    title: 'Store Knowledge', 
    summary: 'Build structured libraries with project-wide tag hierarchies.',
    icon: Book,
    color: '#06B6D4',
    description: 'Build a living library. Organize multiple notes into a collaborative wiki with smart versioning and shared tags.'
  },
  { 
    id: 'event-command-center',
    title: 'Orchestrate Events', 
    summary: 'Manage RSVPs, speaker schedules, and logistics tasking in one place.',
    icon: Calendar,
    color: '#F43F5E',
    description: 'Master your meetups. Integrated guest management (Forms), event scheduling, and full logistic task-lists.'
  },
  { 
    id: 'product-roadmap',
    title: 'Execute Strategy', 
    summary: 'Link technical specs to high-level goals and milestone execution.',
    icon: Layers,
    color: '#84CC16',
    description: 'Execute your vision. Links technical specifications (Notes) to high-level goals and deadline-driven events.'
  }
];

const NAV_SURFACE = '#161412';

/** Fluid card grid: wraps by available width, never forces 3 squeezed columns. */
const PROJECT_CARD_GRID_SX = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
  gap: 3,
  width: '100%',
  alignItems: 'stretch',
} as const;

function TemplateCard({ template, onSelect }: { template: typeof projectTemplates[0], onSelect: (t: any) => void }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div
            onClick={() => onSelect(template)}
            className="relative flex flex-col justify-between gap-5 p-6 w-full min-h-[196px] rounded-[28px] bg-[#161412] border border-white/6 hover:border-white/15 hover:bg-[#1C1A18] transition-all duration-300 ease-out cursor-pointer overflow-hidden group select-none max-w-full"
            style={{
              borderColor: expanded ? `${template.color}4D` : undefined
            }}
        >
            <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                {/* Left Icon */}
                <div 
                    className="flex-shrink-0 w-11 h-11 rounded-xl grid place-items-center transition-all duration-300"
                    style={{
                        backgroundColor: `${template.color}1A`,
                        color: template.color
                    }}
                >
                    <template.icon size={20} strokeWidth={2.5} />
                </div>

                {/* Grouped Copy Column */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* Header Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white text-base font-black tracking-tight leading-tight">
                            {template.title}
                        </h3>
                        {template.isPro && (
                            <span 
                                className="flex-shrink-0 text-[10px] font-black font-mono px-2 py-0.5 rounded border"
                                style={{
                                    backgroundColor: `${template.color}1A`,
                                    color: template.color,
                                    borderColor: `${template.color}33`
                                }}
                            >
                                PRO
                            </span>
                        )}
                    </div>

                    {/* Description Content */}
                    <p className={`text-sm text-white/45 font-medium leading-relaxed break-words mt-1 ${expanded ? '' : 'line-clamp-3'}`}>
                        {expanded ? template.description : template.summary}
                    </p>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/4">
                <button
                    onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                    className="text-white/40 hover:text-white text-xs font-extrabold transition-colors duration-200"
                >
                    {expanded ? 'Show Less' : 'Learn More'}
                </button>

                <div 
                    className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider"
                    style={{ color: template.color }}
                >
                    <span>Activate</span>
                    <Plus size={11} strokeWidth={4} />
                </div>
            </div>
        </div>
    );
}

function LocalProjectCard({ project, onClick, onDelete, onTogglePin }: {
  project: Projects;
  onClick: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onTogglePin?: (projectId: string) => void;
}) {
  const getVisibilityIcon = () => {
    switch (project.visibility) {
      case 'public': return <Globe size={13} />;
      case 'shared': return <Users size={13} />;
      default: return <Lock size={13} />;
    }
  };

  const getStatusColor = () => {
    if ((project as any).isPending) return '#F59E0B';
    switch (project.status) {
      case 'active': return '#10B981';
      case 'paused': return '#F59E0B';
      case 'archived': return '#EF4444';
      default: return '#6366F1';
    }
  };

  const statusColor = getStatusColor();
  const projColor = (project as any).color || '#6366F1';

  return (
    <div
      onClick={() => onClick(project.$id)}
      className="relative flex flex-col justify-between gap-5 p-6 w-full min-h-[196px] rounded-[28px] bg-[#161412] border transition-all duration-300 ease-out cursor-pointer overflow-hidden group select-none max-w-full"
      style={{
        borderColor: 'rgba(255, 255, 255, 0.06)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${projColor}66`;
        e.currentTarget.style.boxShadow = `0 0 20px ${projColor}08`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
        {/* Left Icon */}
        <div 
          className="flex-shrink-0 w-12 h-12 rounded-2xl grid place-items-center border transition-all duration-300 group-hover:scale-105"
          style={{
            backgroundColor: `${projColor}1A`,
            color: projColor,
            borderColor: `${projColor}33`,
          }}
        >
          <LayoutGrid size={20} strokeWidth={1.5} />
        </div>

        {/* Grouped Copy Column */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* Header Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {(project as any).isPinned && (
              <Pin size={14} className="text-[#F59E0B] fill-[#F59E0B] rotate-45 flex-shrink-0" />
            )}
            <h3 className="text-white text-base font-black tracking-tight leading-tight truncate flex-1 min-w-0">
              {project.title}
            </h3>
            {project.visibility === 'public' && (
              <span className="flex-shrink-0 bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-white/8 flex items-center gap-1">
                {getVisibilityIcon()}
                {project.visibility}
              </span>
            )}
          </div>

          {/* Summary / Description Content */}
          <p className="text-sm text-white/50 font-medium leading-relaxed line-clamp-2 break-words mt-1">
            {project.summary || 'Unified ecosystem project for coordinating cross-app resources and workflows.'}
          </p>
        </div>

        {/* Top-Right Inline Actions (Pin, Delete) */}
        {!(project as any).isPending ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin?.(project.$id);
              }}
              className="p-1.5 rounded-lg text-white/20 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5 transition-all duration-200"
            >
              <Pin size={16} className={(project as any).isPinned ? 'fill-[#F59E0B]' : ''} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project.$id);
              }}
              className="p-1.5 rounded-lg text-white/20 hover:text-[#FF453A] hover:bg-[#FF453A]/5 transition-all duration-200"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <span className="flex-shrink-0 bg-[#6366F1]/10 text-[#818CF8] text-[9px] font-black font-mono px-2 py-0.5 rounded border border-[#6366F1]/20">
            INVITED
          </span>
        )}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/4">
        {/* Updated Date */}
        <div className="flex items-center gap-1 text-xs text-white/30 font-medium">
          <Calendar size={13} />
          <span>
            {project.updatedAt
              ? new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : 'Active'}
          </span>
        </div>

        {/* Status Badge */}
        <span
          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border"
          style={{
            backgroundColor: `${statusColor}1A`,
            color: statusColor,
            borderColor: `${statusColor}33`,
          }}
        >
          {(project as any).isPending ? 'invite pending' : project.status}
        </span>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { open } = useUnifiedDrawer();
  const { 
    savedWorkflows,
    isRecording, 
    startRecording, 
    stopRecording, 
    updateWorkflow 
  } = useLocalContext();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    const listener = () => setIsDesktop(media.matches);
    listener();
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const [projects, setProjects] = useState<Projects[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // Live Draft Cockpit States
  const [draftTitle, setDraftTitle] = useState('');
  const [draftText, setDraftText] = useState('');
  const [drafting, setDrafting] = useState(false);

  // Workflow Simulator States
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);

  // Recorder states
  const [wfName, setWfName] = useState('');
  const [wfDesc, setWfDesc] = useState('');

  // Sync workflows from Appwrite database on mount
  useEffect(() => {
    const syncDb = async () => {
      try {
        const res = await listWorkflowsAction();
        if (res.success && res.data) {
          res.data.forEach(wf => {
            updateWorkflow(wf.id, wf);
          });
        }
      } catch (e) {
        console.error('Failed syncing workflows:', e);
      }
    };
    syncDb();
  }, [updateWorkflow]);

  const handleSaveDraft = async () => {
    if (!draftText.trim()) {
      showError('Draft content cannot be empty');
      return;
    }
    setDrafting(true);
    try {
      const title = draftTitle.trim() || 'Untitled Quick Draft';
      await createNote({ title, content: draftText });
      showSuccess(`Draft "${title}" saved secure!`);
      setDraftText('');
      setDraftTitle('');
    } catch (e: any) {
      showError('Failed to save draft', e.message);
    } finally {
      setDrafting(false);
    }
  };

  const simulateWorkflow = async (wf: any) => {
    setRunningWorkflow(wf.id);
    setCurrentStepIndex(0);
    for (let i = 0; i < wf.steps.length; i++) {
      setCurrentStepIndex(i);
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    setRunningWorkflow(null);
    setCurrentStepIndex(-1);
    showSuccess(`Trace "${wf.name}" executed successfully!`);
  };

  const handleTogglePrivacy = async (id: string, wf: WorkflowChain) => {
    const updated = {
      ...wf,
      isPublic: !wf.isPublic
    };
    updateWorkflow(id, updated);
    await saveWorkflowAction(updated);
    showSuccess(updated.isPublic ? "Workflow is now public" : "Workflow is now private");
  };

  const handleAnonymize = async (id: string, wf: WorkflowChain) => {
    const anon = anonymizeWorkflow(wf);
    updateWorkflow(id, anon);
    await saveWorkflowAction(anon);
    showSuccess("Workflow securely anonymized");
  };

  const handleNegate = async (id: string, wf: WorkflowChain) => {
    const res = negateWorkflow(wf);
    if (!res.success || !res.workflow) {
      showError(res.error || 'Failed to invert workflow.');
      return;
    }
    updateWorkflow(res.workflow.id, res.workflow);
    await saveWorkflowAction(res.workflow);
    showSuccess("Inversion flow created!");
  };

  const handleDeleteWorkflow = async (id: string) => {
    await deleteWorkflowAction(id);
    const nextSaved = { ...savedWorkflows };
    delete nextSaved[id];
    if (typeof window !== 'undefined') {
      localStorage.setItem('kylrix_saved_workflows', JSON.stringify(nextSaved));
    }
    showSuccess("Workflow deleted");
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleStopRecording = () => {
    const name = wfName.trim() || 'Custom Flow';
    const desc = wfDesc.trim() || 'Automated chain';
    stopRecording(name, desc, 'workspace');
    showSuccess(`Workflow "${name}" saved!`);
    setWfName('');
    setWfDesc('');
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const workflowsList = Object.values(savedWorkflows || {});

  const fetchProjects = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const res = await ProjectsService.listProjects(force);
      setProjects(res.rows);
    } catch (err: any) {
      showError('Failed to load projects', err.message);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const { setConfiguration, resetConfiguration } = useFAB();

  const handleCreated = useCallback((newProject: any) => {
    setProjects(prev => [newProject, ...prev]);
  }, []);

  const openCreateDrawer = useCallback((template?: typeof projectTemplates[0]) => {
    if (template?.isPro && !hasPaidKylrixPlan(user)) {
      openProUpgrade(`The "${template.title}" template`);
      return;
    }
    open('new-project', { 
        onCreated: handleCreated,
        template: template 
    });
  }, [open, handleCreated, user, openProUpgrade]);

  const openCreateDrawerRef = useRef(openCreateDrawer);
  useEffect(() => {
    openCreateDrawerRef.current = openCreateDrawer;
  }, [openCreateDrawer]);

  useEffect(() => {
    setConfiguration({
      isVisible: !isDesktop,
      mainColor: '#6366F1',
      actions: [
        { id: 'create-project', label: 'CREATE PROJECT', icon: <Plus size={20} />, onClick: () => openCreateDrawerRef.current() },
        { 
            id: 'create-team', 
            label: 'CREATE TEAM', 
            icon: <Users size={20} />, 
            onClick: () => {
                if (!hasPaidKylrixPlan(user)) {
                    open('pro-upgrade', {});
                } else {
                    showSuccess('Team creation environment is spinning up...');
                }
            } 
        },
        { id: 'workflows-nav', label: 'ACTION WORKFLOWS', icon: <Workflow size={20} />, onClick: () => router.push('/projects/workflows') },
        { id: 'insights', label: 'AI INSIGHTS', icon: <Sparkles size={20} />, onClick: () => router.push('/note/notes') }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, router, user, open, showSuccess, isDesktop]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDeleteProject = async (project: Projects) => {
    open('delete-confirm', {
      title: `Delete "${project.title}"?`,
      resourceName: 'this project',
      confirmLabel: 'Delete Project',
      isProject: true,
      onConfirm: async (deleteMode?: 'detach' | 'created_within' | 'all') => {
        try {
          await ProjectsService.deleteProject(project.$id, deleteMode);
          showSuccess('Project deleted');
          setProjects(prev => prev.filter(p => p.$id !== project.$id));
        } catch (err: any) {
          showError('Action failed', err.message);
        }
      }
    });
  };

  const handleTogglePin = async (projectId: string) => {
    try {
        const project = projects.find(p => p.$id === projectId);
        const newPinned = !(project as any).isPinned;
        await ProjectsService.updateProject(projectId, { isPinned: newPinned } as any);
        setProjects(prev => prev.map(p => p.$id === projectId ? { ...p, isPinned: newPinned } : p));
        showSuccess(newPinned ? "Pinned to top" : "Unpinned");
    } catch (err: any) {
        showError('Action failed', err.message);
    }
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a: any, b: any) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const bTime = new Date(b.$updatedAt || b.updatedAt || 0).getTime();
        const aTime = new Date(a.$updatedAt || a.updatedAt || 0).getTime();
        const timeDiff = (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
        if (timeDiff !== 0) return timeDiff;
        return String(a.title || '').localeCompare(String(b.title || ''));
    });
  }, [projects]);

  const handleProjectClick = (projectId: string) => {
    const selectedProj = projects.find(p => p.$id === projectId);
    if (selectedProj && (selectedProj as any).isPending) {
      open('project-invite', {
        project: selectedProj,
        onAccepted: () => {
          fetchProjects().then(() => {
            router.push(`/projects/${projectId}`);
          });
        }
      });
    } else {
      router.push(`/projects/${projectId}`);
    }
  };

  const displayedTemplates = showAllTemplates ? projectTemplates : projectTemplates.slice(0, 3);

  const templatesElement = (
    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block' }}>
          Quick Activate
        </Typography>
        <Button 
          size="small"
          onClick={() => setShowAllTemplates(!showAllTemplates)}
          endIcon={showAllTemplates ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          sx={{ color: '#6366F1', fontWeight: 800, textTransform: 'none', fontSize: '0.75rem' }}
        >
          {showAllTemplates ? 'Show Less' : 'Show All Templates'}
        </Button>
      </Stack>
      
      <Grid container spacing={3}>
        {displayedTemplates.map((template) => (
          <Grid size={{ xs: 12, md: 6 }} key={template.title} sx={{ display: 'flex', minWidth: 0 }}>
            <TemplateCard template={template} onSelect={openCreateDrawer} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const workflowsCardElement = (
    <div className="bg-[#161412] rounded-[32px] border border-white/6 p-6 mb-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-white text-base font-black tracking-tight leading-tight flex items-center gap-2 font-mono select-none">
          <Workflow size={18} className="text-[#6366F1]" />
          Smart Automation Traces
        </h3>
        <span className="text-[10px] text-[#6366F1] font-black font-mono bg-[#6366F1]/10 px-2 py-0.5 rounded border border-[#6366F1]/20 uppercase select-none">
          {workflowsList.length} Trace{workflowsList.length === 1 ? '' : 's'} Ready
        </span>
      </div>

      {workflowsList.length === 0 ? (
        <div className="text-center py-6 text-white/40 text-xs">
          No automation traces recorded yet. Hit &quot;Record New Flow&quot; above to capture execution paths.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflowsList.map((wf) => (
            <div 
              key={wf.id}
              className="bg-[#0A0908]/60 border border-white/5 hover:border-[#6366F1]/30 rounded-2xl p-4 flex flex-col justify-between gap-4 transition-all"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h4 className="text-white font-extrabold text-sm truncate">{wf.name}</h4>
                    <p className="text-white/40 text-[11px] leading-relaxed truncate">{wf.description || 'Automated action sequence'}</p>
                  </div>
                  <span className="bg-[#6366F1]/10 text-[#818CF8] text-[9px] font-black font-mono px-2 py-0.5 rounded border border-[#6366F1]/20 flex-shrink-0">
                    {wf.steps.length} STEP{wf.steps.length === 1 ? '' : 'S'}
                  </span>
                </div>
                
                {/* Collapsible/Mini Step Indicators */}
                <div className="flex flex-wrap gap-1">
                  {wf.steps.map((step: any, idx: number) => (
                    <span 
                      key={idx} 
                      title={step.actionId}
                      className="text-[9px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 hover:bg-white/10 hover:text-white transition-colors"
                    >
                      {step.actionId.substring(0, 12)}...
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-white/4 gap-2 flex-wrap">
                <div className="flex gap-1">
                  <button
                    onClick={() => handleTogglePrivacy(wf.id, wf)}
                    title={wf.isPublic ? "Make Private" : "Make Public"}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                  >
                    {wf.isPublic ? <Globe size={13} /> : <Lock size={13} />}
                  </button>
                  <button
                    onClick={() => handleAnonymize(wf.id, wf)}
                    title="Anonymize Metadata"
                    className="p-1.5 rounded-lg text-white/40 hover:text-[#10B981] hover:bg-[#10B981]/5 transition-all"
                  >
                    <UserCheck size={13} />
                  </button>
                  <button
                    onClick={() => handleNegate(wf.id, wf)}
                    title="Negate Trace Inversion"
                    className="p-1.5 rounded-lg text-white/40 hover:text-[#6366F1] hover:bg-[#6366F1]/5 transition-all"
                  >
                    <RotateCcw size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteWorkflow(wf.id)}
                    title="Delete Trace"
                    className="p-1.5 rounded-lg text-white/40 hover:text-[#FF453A] hover:bg-[#FF453A]/5 transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <button
                  onClick={() => simulateWorkflow(wf)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#6366F1] text-white hover:bg-[#4F46E5] transition-all"
                >
                  <Play size={10} fill="currentColor" />
                  <span>Run Simulation</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const projectsListElement = (
    <Box>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
          Projects ({projects.length})
        </Typography>
        
        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <Grid size={{ xs: 12, md: 6 }} key={idx} sx={{ display: 'flex', minWidth: 0 }}>
                <LocalProjectCard 
                  project={{
                    $id: `skeleton-${idx}`,
                    title: 'Loading...',
                    summary: '',
                    visibility: 'private',
                    status: 'loading'
                  } as any}
                  onClick={() => {}}
                  onDelete={() => {}}
                />
              </Grid>
            ))}
          </Grid>
        ) : projects.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#161412',
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: '32px',
              p: 8,
              textAlign: 'center',
              backgroundImage: 'none',
            }}
          >
            <Box sx={{ width: 80, height: 80, borderRadius: '24px', bgcolor: alpha('#6366F1', 0.05), color: '#6366F1', display: 'grid', placeItems: 'center', mx: 'auto', mb: 3 }}>
              <FolderKanban size={40} />
            </Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>No active projects</Typography>
            <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, maxWidth: 360, mx: 'auto', lineHeight: 1.55, display: 'block' }}>
              Create a project to combine your context, communications, and secrets into one high-velocity workspace.
            </Typography>
            <Button variant="outlined" onClick={() => openCreateDrawer()} sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', px: 4, fontWeight: 800 }}>Start Fresh Project</Button>
          </Paper>
        ) : (
            <Grid container spacing={3}>
                {sortedProjects.map(project => (
                    <Grid size={{ xs: 12, md: 6 }} key={project.$id} sx={{ display: 'flex', minWidth: 0 }}>
                        <LocalProjectCard 
                            project={project} 
                            onClick={handleProjectClick}
                            onDelete={() => handleDeleteProject(project)}
                            onTogglePin={handleTogglePin}
                        />
                    </Grid>
                ))}
            </Grid>
        )}
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', pt: { xs: 4, md: 6 }, pb: 10 }}>
      {runningWorkflow && (
        <div className="fixed inset-0 bg-[#0A0908]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#161412] border border-white/10 rounded-[32px] p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-[#6366F1]/20 animate-pulse"></div>
              <div className="absolute inset-0 rounded-full border-t-4 border-[#6366F1] animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Zap className="text-[#6366F1] animate-bounce" size={32} />
              </div>
            </div>
            
            <div>
              <h4 className="text-white text-xl font-black">Running Trace Pipeline</h4>
              <p className="text-white/40 text-xs mt-1 font-mono uppercase tracking-wider">
                {workflowsList.find(w => w.id === runningWorkflow)?.name || 'Workflow'}
              </p>
            </div>
            
            <div className="bg-[#0A0908] rounded-2xl p-4 border border-white/5 space-y-2 max-h-[160px] overflow-y-auto">
              {workflowsList.find(w => w.id === runningWorkflow)?.steps.map((step: any, idx: number) => {
                const isCurrent = idx === currentStepIndex;
                const isCompleted = idx < currentStepIndex;
                return (
                  <div 
                    key={idx} 
                    className={`flex items-center gap-3 text-left transition-all duration-200 ${
                      isCurrent ? 'scale-[1.02] translate-x-1' : ''
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      isCurrent ? 'bg-[#6366F1] animate-ping' : isCompleted ? 'bg-[#10B981]' : 'bg-white/10'
                    }`} />
                    <span className={`text-xs font-mono truncate flex-1 ${
                      isCurrent ? 'text-white font-extrabold' : isCompleted ? 'text-white/60' : 'text-white/20'
                    }`}>
                      {step.actionId}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-black text-[#6366F1] animate-pulse">ACTIVE</span>
                    )}
                    {isCompleted && (
                      <span className="text-[9px] font-black text-[#10B981]">OK</span>
                    )}
                  </div>
                );
              })}
            </div>
            
            <p className="text-[11px] text-white/50 font-medium">
              Executing local trace logic safely...
            </p>
          </div>
        </div>
      )}

      <MultiSectionContainer panels={['projects_stats', 'projects_templates']}>
        <Box sx={{ width: '100%' }}>
          {/* Back Button */}
          <IconButton
            onClick={() => router.back()}
            sx={{
              mb: 3,
              bgcolor: '#161412',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: '#1C1A18' },
            }}
          >
            <ArrowLeft size={18} />
          </IconButton>

          {/* Header Section */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'flex-end' }} sx={{ mb: 4 }}>
              <Box>
                  <Typography variant="h1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1, letterSpacing: '-0.03em' }}>
                      Active Execution
                  </Typography>
                  <Typography component="span" sx={{ mt: 1.5, color: 'rgba(255,255,255,0.4)', maxWidth: 500, fontSize: '1rem', fontWeight: 500, lineHeight: 1.55, display: 'block' }}>
                      Outcome-aware containers that unite your context, comms, and secrets into a single high-velocity workspace.
                  </Typography>
              </Box>

              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Button
                  onClick={() => openCreateDrawer()}
                  variant="contained"
                  sx={{
                    bgcolor: '#6366F1',
                    color: '#fff',
                    borderRadius: '14px',
                    px: 4,
                    py: 1.5,
                    fontWeight: 800,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#4F46E5' }
                  }}
                  startIcon={<Plus size={18} />}
                >
                  Create Project
                </Button>
              </Box>
          </Stack>

          {/* Flagship Workspace Cockpit Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Quick Draft Note & Actions */}
            <div className="bg-[#161412] rounded-[32px] border border-white/6 p-6 flex flex-col justify-between min-h-[260px] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#EC4899]/5 rounded-full filter blur-3xl pointer-events-none group-hover:bg-[#EC4899]/8 transition-all duration-500" />
              
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="text-white text-sm font-black tracking-tight leading-tight flex items-center gap-2 font-mono select-none">
                    <FileText size={18} className="text-[#EC4899]" />
                    Instant Draft Cockpit
                  </h3>
                  <span className="text-[9px] text-[#EC4899] font-black font-mono uppercase bg-[#EC4899]/10 px-2 py-0.5 rounded border border-[#EC4899]/20 select-none">
                    SECURE AES-256
                  </span>
                </div>
                
                <div className="space-y-3">
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Enter Draft Title (Optional)..."
                    className="w-full bg-[#0A0908]/60 border border-white/5 rounded-xl px-4 py-2 text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-[#EC4899]/50 transition-all font-sans"
                  />
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder="Draft thoughts, tasks, or secrets... Save instantly on the spot."
                    rows={4}
                    className="w-full bg-[#0A0908]/60 border border-white/5 rounded-2xl p-4 text-xs font-medium text-white placeholder-white/20 focus:outline-none focus:border-[#EC4899]/50 resize-none transition-all font-sans"
                  />
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/4">
                <span className="text-[10px] text-white/30 font-medium">
                  Direct connection to your Secure Notes list.
                </span>
                <button
                  onClick={handleSaveDraft}
                  disabled={drafting || !draftText.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#EC4899] text-white hover:bg-[#D0357F] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {drafting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving Secure...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={13} strokeWidth={3} />
                      <span>Save Draft Note</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Live Telemetry & Workflow Recorder */}
            <div className="bg-[#161412] rounded-[32px] border border-white/6 p-6 flex flex-col justify-between min-h-[260px] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#6366F1]/5 rounded-full filter blur-3xl pointer-events-none group-hover:bg-[#6366F1]/8 transition-all duration-500" />
              
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-center">
                  <h3 className="text-white text-sm font-black tracking-tight leading-tight flex items-center gap-2 font-mono select-none">
                    <Terminal size={18} className="text-[#6366F1]" />
                    Ecosystem Telemetry
                  </h3>
                  <div className="flex items-center gap-1.5 bg-[#6366F1]/10 px-2 py-0.5 rounded border border-[#6366F1]/20 select-none">
                    <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-[#FF453A] animate-pulse' : 'bg-[#10B981]'}`} />
                    <span className="text-[9px] text-white/70 font-black font-mono uppercase">
                      {isRecording ? 'RECORDING ACTIVE' : 'RECORDER READY'}
                    </span>
                  </div>
                </div>
                
                {isRecording ? (
                  <div className="bg-[#0A0908]/60 border border-[#FF453A]/20 rounded-2xl p-4 space-y-3">
                    <p className="text-xs text-white/60 font-semibold leading-relaxed">
                      Currently recording telemetry interactions. Go anywhere in the app to record actions, then customize below:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={wfName}
                        onChange={(e) => setWfName(e.target.value)}
                        placeholder="Workflow Name..."
                        className="w-full bg-[#0A0908] border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-[#FF453A]/50 transition-all"
                      />
                      <input
                        type="text"
                        value={wfDesc}
                        onChange={(e) => setWfDesc(e.target.value)}
                        placeholder="Description..."
                        className="w-full bg-[#0A0908] border border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-white/20 focus:outline-none focus:border-[#FF453A]/50 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs text-white/50 leading-relaxed font-sans select-none">
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="font-bold">Ecosystem Status:</span>
                      <span className="text-[#10B981] font-mono font-black">100% ONLINE</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="font-bold">Huddles Launcher:</span>
                      <span className="text-white/70 font-mono">STANDBY (P2P Mesh)</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-white/[0.02]">
                      <span className="font-bold">Vault Security:</span>
                      <span className="text-[#10B981] font-mono font-black">LOCKED & PRIVILEGED</span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="font-bold">Pinned Shortcuts:</span>
                      <div className="flex flex-wrap gap-1 mt-1 justify-end">
                        {sortedProjects.filter(p => (p as any).isPinned).length === 0 ? (
                          <span className="italic text-white/30 text-[10px]">No pinned projects</span>
                        ) : (
                          sortedProjects.filter(p => (p as any).isPinned).map(p => (
                            <button 
                              key={p.$id}
                              onClick={() => handleProjectClick(p.$id)}
                              className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded border border-white/10 hover:border-[#6366F1]/50 hover:bg-[#6366F1]/10 text-white transition-all font-mono"
                            >
                              {p.title.toUpperCase()}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/4">
                <span className="text-[10px] text-white/30 font-medium">
                  {isRecording ? 'Stop to bundle interaction steps.' : 'Capture actions to create a custom smart macro.'}
                </span>
                {isRecording ? (
                  <button
                    onClick={handleStopRecording}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#FF453A] text-white hover:bg-[#DC352C]"
                  >
                    <CheckCircle2 size={13} strokeWidth={3} />
                    <span>Save Recorded Flow</span>
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-[#6366F1] text-white hover:bg-[#4F46E5]"
                  >
                    <Zap size={13} strokeWidth={3} />
                    <span>Record New Flow</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {projects.length === 0 ? (
            <>
              {/* Mobile-only templates display at the top when projects are empty */}
              <Box sx={{ mb: 8 }}>
                {templatesElement}
              </Box>
              <Box sx={{ mb: 6 }}>
                {projectsListElement}
              </Box>
              {workflowsCardElement}
            </>
          ) : (
            <>
              <Box sx={{ mb: 6 }}>
                {projectsListElement}
              </Box>
              {workflowsCardElement}
              {/* Mobile-only templates display at the bottom when projects exist */}
              <Box sx={{ mt: 8 }}>
                {templatesElement}
              </Box>
            </>
          )}
        </Box>
      </MultiSectionContainer>
    </Box>
  );
}
