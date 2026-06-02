'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';
import { useFAB } from '@/context/FABContext';
import ProjectCard from '@/components/projects/ProjectCard';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects } from '@/types/appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useLocalContext } from '@/lib/context-engine';
import { useAuth } from '@/lib/auth';
import { hasPaidKylrixPlan } from '@/lib/utils';

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

function TemplateCard({ template, onSelect }: { template: typeof projectTemplates[0], onSelect: (t: any) => void }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <Paper
            elevation={0}
            onClick={() => onSelect(template)}
            sx={{
                p: 2,
                borderRadius: '24px',
                bgcolor: '#161412',
                border: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
                overflow: 'hidden',
                '&:hover': { 
                    bgcolor: '#1C1A18', 
                    borderColor: alpha(template.color, 0.3),
                    transform: 'translateY(-4px)',
                    boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 20px ${alpha(template.color, 0.1)}`
                }
            }}
        >
            {template.isPro && (
                <Chip 
                    label="PRO" 
                    size="small"
                    sx={{ 
                        position: 'absolute', 
                        top: 12, 
                        right: 12, 
                        bgcolor: alpha(template.color, 0.1), 
                        color: template.color, 
                        fontWeight: 900, 
                        fontSize: '0.6rem',
                        height: 18,
                        fontFamily: 'var(--font-mono)',
                        border: `1px solid ${alpha(template.color, 0.2)}`
                    }} 
                />
            )}
            <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: alpha(template.color, 0.1), color: template.color, display: 'grid', placeItems: 'center' }}>
                        <template.icon size={18} strokeWidth={2.5} />
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 900, color: '#fff', fontSize: '0.95rem', letterSpacing: '-0.01em' }}>{template.title}</Typography>
                </Stack>
                
                <Box>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', lineHeight: 1.4, fontWeight: 500, fontSize: '0.85rem' }}>
                        {expanded ? template.description : template.summary}
                    </Typography>
                </Box>

                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Button 
                        size="small" 
                        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                        sx={{ 
                            p: 0, 
                            minWidth: 0, 
                            color: 'rgba(255,255,255,0.3)', 
                            textTransform: 'none', 
                            fontSize: '0.7rem', 
                            fontWeight: 800,
                            '&:hover': { color: '#fff', bgcolor: 'transparent' }
                        }}
                    >
                        {expanded ? 'Show Less' : 'Learn More'}
                    </Button>
                    <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: template.color }}>
                        <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activate</Typography>
                        <Plus size={10} strokeWidth={4} />
                    </Stack>
                </Stack>
            </Stack>
        </Paper>
    );
}

export default function ProjectsPage() {
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { open } = useUnifiedDrawer();
  const { savedWorkflows } = useLocalContext();
  const { user } = useAuth();
  
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
    open('new-project', { 
        onCreated: handleCreated,
        template: template 
    });
  }, [open, handleCreated]);

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
        return new Date(b.$updatedAt || b.updatedAt).getTime() - new Date(a.$updatedAt || a.updatedAt).getTime();
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
      
      <Grid container spacing={2}>
        {displayedTemplates.map((template) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={template.title}>
            <TemplateCard template={template} onSelect={openCreateDrawer} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const workflowsCardElement = (
    <Paper
      elevation={0}
      onClick={() => router.push('/projects/workflows')}
      sx={{
        mb: 6,
        p: 3,
        borderRadius: '24px',
        bgcolor: '#141312',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        gap: 3,
        '&:hover': {
          bgcolor: '#1A1816',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          transform: 'translateY(-2px)',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
        }
      }}
    >
      {/* Accent glow line at top */}
      <Box 
        sx={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          height: '3px', 
          background: 'linear-gradient(90deg, #6366F1 0%, #A855F7 100%)' 
        }} 
      />
      
      <Stack direction="row" spacing={2.5} alignItems="center">
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '16px',
            bgcolor: alpha('#6366F1', 0.08),
            color: '#6366F1',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <Workflow size={28} strokeWidth={2} />
        </Box>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
              Smart Action Workflows
            </Typography>
            <Chip
              label={`${Object.keys(savedWorkflows || {}).length} SAVED`}
              size="small"
              sx={{
                bgcolor: 'rgba(99, 102, 241, 0.1)',
                color: '#818CF8',
                fontWeight: 900,
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                height: 20
              }}
            />
          </Stack>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: '0.875rem', maxWidth: 640 }}>
            Record, share, and automate action sequences to boost execution speed. Perfect for repetitive workspace tasks and smart guidance.
          </Typography>
        </Box>
      </Stack>
      
      <Button
        variant="outlined"
        onClick={(e) => { e.stopPropagation(); router.push('/projects/workflows'); }}
        endIcon={<ArrowUpRight size={16} />}
        sx={{
          borderRadius: '12px',
          borderColor: 'rgba(255,255,255,0.08)',
          color: '#fff',
          px: 3,
          py: 1,
          fontWeight: 800,
          fontSize: '0.8rem',
          textTransform: 'none',
          bgcolor: 'rgba(255,255,255,0.02)',
          '&:hover': {
            borderColor: '#6366F1',
            bgcolor: 'rgba(99, 102, 241, 0.05)'
          }
        }}
      >
        Manage Workflows
      </Button>
    </Paper>
  );

  const projectsListElement = (
    <Grid container spacing={4}>
      {/* Main Projects List */}
      <Grid size={{ xs: 12 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
          Projects ({projects.length})
        </Typography>
        
        {loading ? (
          <Grid container spacing={2.5}>
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={idx}>
                <ProjectCard 
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
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, maxWidth: 360, mx: 'auto' }}>
              Create a project to combine your context, communications, and secrets into one high-velocity workspace.
            </Typography>
            <Button variant="outlined" onClick={() => openCreateDrawer()} sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', px: 4, fontWeight: 800 }}>Start Fresh Project</Button>
          </Paper>
        ) : (
            <Grid container spacing={2.5}>
                {sortedProjects.map(project => (
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={project.$id}>
                        <ProjectCard 
                            project={project} 
                            onClick={handleProjectClick}
                            onDelete={() => handleDeleteProject(project)}
                            onTogglePin={handleTogglePin}
                        />
                    </Grid>
                ))}
            </Grid>
        )}

      </Grid>
    </Grid>
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
                  <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.4)', maxWidth: 500, fontSize: '1rem', fontWeight: 500 }}>
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
              <Box sx={{ display: { xs: 'block', lg: 'none' }, mb: 8 }}>
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
              <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 8 }}>
                {templatesElement}
              </Box>
            </>
          )}
        </Box>
      </MultiSectionContainer>
    </Box>
  );
}
