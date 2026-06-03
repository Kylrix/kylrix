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

  return (
    <div
      onClick={() => onClick(project.$id)}
      className="relative flex flex-col justify-between gap-5 p-6 w-full min-h-[196px] rounded-[28px] bg-[#161412] border border-[#34322F] hover:border-[#6366F1]/40 hover:bg-[#1C1A18] transition-all duration-300 ease-out cursor-pointer overflow-hidden group select-none max-w-full"
    >
      <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
        {/* Left Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white/3 text-white/60 grid place-items-center border border-white/8 group-hover:scale-105 group-hover:text-[#6366F1] group-hover:bg-[#6366F1]/10 group-hover:border-[#6366F1]/20 transition-all duration-300">
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
            <span className="flex-shrink-0 bg-white/5 text-white/40 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-white/8 flex items-center gap-1">
              {getVisibilityIcon()}
              {project.visibility}
            </span>
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
  const { savedWorkflows } = useLocalContext();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  
  const [projects, setProjects] = useState<Projects[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

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
      isVisible: true,
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
  }, [setConfiguration, resetConfiguration, router, user, open, showSuccess]);

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
    <Box>
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
    <div
      onClick={() => router.push('/projects/workflows')}
      className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-5 p-6 w-full rounded-[28px] bg-[#161412] border border-white/6 hover:border-[#6366F1]/30 hover:bg-[#1C1A18] transition-all duration-300 ease-out cursor-pointer overflow-hidden mb-6 group select-none max-w-full"
    >
      <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
        {/* Left Icon (Workflow) */}
        <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#6366F1]/8 text-[#6366F1] grid place-items-center">
          <Workflow size={28} strokeWidth={2} />
        </div>

        {/* Grouped Copy Column */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* Header Row */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-white text-lg font-black tracking-tight leading-tight">
              Smart Action Workflows
            </h3>
            <span className="flex-shrink-0 bg-[#6366F1]/10 text-[#818CF8] text-[10px] font-black font-mono px-2 py-0.5 rounded border border-[#6366F1]/20">
              {Object.keys(savedWorkflows || {}).length} SAVED
            </span>
          </div>

          {/* Description Content */}
          <p className="text-sm text-white/40 font-medium leading-relaxed break-words mt-1 max-w-[640px]">
            Record, share, and automate action sequences to boost execution speed. Perfect for repetitive workspace tasks and smart guidance.
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="flex-shrink-0 w-full md:w-auto mt-3 md:mt-0 flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push('/projects/workflows');
          }}
          className="flex items-center justify-center gap-2 rounded-xl border border-white/8 text-white px-5 py-2.5 text-xs font-extrabold bg-white/2 hover:border-[#6366F1] hover:bg-[#6366F1]/5 transition-all duration-200 w-full md:w-auto"
        >
          Manage Workflows
          <ArrowUpRight size={16} />
        </button>
      </div>
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
                  {/* Empty box to maintain layout if needed, but FAB handles creation now */}
              </Box>
          </Stack>

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
