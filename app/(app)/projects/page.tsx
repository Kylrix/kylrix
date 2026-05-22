'use client';

import React, { useEffect, useState, useCallback } from 'react';
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
  Container,
} from '@mui/material';
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
} from 'lucide-react';
import { useFAB } from '@/context/FABContext';
import ProjectCard from '@/components/projects/ProjectCard';
import { ProjectsService } from '@/lib/appwrite/projects';
import { useToast } from '@/components/ui/Toast';
import { Projects } from '@/types/appwrite';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

const projectTemplates = [
  { 
    id: 'form-to-project',
    title: 'Form to Project', 
    summary: 'Link a form, ingest responses as context, and auto-spin tasks.',
    icon: ClipboardList,
    color: '#6366F1',
    description: 'Transform feedback into action. Automatically connects form responses to your project context and creates execution tasks.'
  },
  { 
    id: 'idea-to-execution',
    title: 'Idea to Execution', 
    summary: 'From note to roadmap. Scheduled meetings, secrets, and team sync.',
    icon: Lightbulb,
    color: '#EC4899',
    description: 'The "Notion-killer" flow. Start with a simple note and instantly generate tasks, schedule weekly calls, and bundle secrets.'
  },
  { 
    id: 'academic-research',
    title: 'Academic Research', 
    summary: 'Unlock long-form articles (6M+ chars), milestones, and surveys.',
    icon: GraduationCap,
    color: '#A855F7',
    isPro: true,
    description: 'Deep academic workflows. Supports massive long-form content, research milestones, and questionnaire-based data collection.'
  },
  { 
    id: 'social-pulse',
    title: 'Social Pulse Campaign', 
    summary: 'Schedule moments, track engagement, and social events.',
    icon: Megaphone,
    color: '#10B981',
    description: 'Sync your social presence. Coordinate Campaign Moments with scheduled events and real-time engagement tracking.'
  },
  { 
    id: 'secure-handover',
    title: 'Secure Client Handover', 
    summary: 'Vault-locked secrets, handover calls, and ephemeral sharing.',
    icon: Key,
    color: '#F59E0B',
    description: 'The ultimate professional hand-off. Bundle credentials securely, schedule a sync call, and use ephemeral links.'
  },
  { 
    id: 'team-huddle-center',
    title: 'Team Huddle Hub', 
    summary: 'Persistent project calls and dedicated group chat threads.',
    icon: Video,
    color: '#3B82F6',
    description: 'Centralize communication. Keeps your team synchronized with recurring call links and a project-isolated chat environment.'
  },
  { 
    id: 'service-desk',
    title: 'Service Desk Dashboard', 
    summary: 'Support forms to tasks with dedicated focus sessions.',
    icon: LifeBuoy,
    color: '#EF4444',
    description: 'Manage requests efficiently. Link support forms directly to project tasks and resolve them in timed focus blocks.'
  },
  { 
    id: 'wiki-knowledge-hub',
    title: 'Wiki Knowledge Hub', 
    summary: 'Auto-organized notes with project-wide tag hierarchies.',
    icon: Book,
    color: '#06B6D4',
    description: 'Build a living library. Organize multiple notes into a collaborative wiki with smart versioning and shared tags.'
  },
  { 
    id: 'event-command-center',
    title: 'Event Command Center', 
    summary: 'RSVPs, speaker schedules, and logistics tasking.',
    icon: Calendar,
    color: '#F43F5E',
    description: 'Master your meetups. Integrated guest management (Forms), event scheduling, and full logistic task-lists.'
  },
  { 
    id: 'product-roadmap',
    title: 'Product Roadmap', 
    summary: 'Connect specs, track goals, and manage milestones.',
    icon: Layers,
    color: '#84CC16',
    description: 'Execute your vision. Links technical specifications (Notes) to high-level goals and deadline-driven events.'
  }
];

export default function ProjectsPage() {
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const { open } = useUnifiedDrawer();
  
  const [projects, setProjects] = useState<Projects[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ProjectsService.listProjects();
      setProjects(res.documents);
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

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#6366F1',
      actions: [
        { id: 'create-project', label: 'CREATE PROJECT', icon: <Plus size={20} />, onClick: () => openCreateDrawer() },
        { id: 'insights', label: 'AI INSIGHTS', icon: <Sparkles size={20} />, onClick: () => router.push('/note/notes') }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, router, openCreateDrawer]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project?')) return;
    try {
      await ProjectsService.deleteProject(projectId);
      showSuccess('Project deleted');
      setProjects(prev => prev.filter(p => p.$id !== projectId));
    } catch (err: any) {
      showError('Action failed', err.message);
    }
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const displayedTemplates = showAllTemplates ? projectTemplates : projectTemplates.slice(0, 3);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff' }}>
      <Container maxWidth="xl" sx={{ pt: { xs: 4, md: 6 }, pb: 10 }}>
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
                    Projects
                </Typography>
                <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.4)', maxWidth: 500, fontSize: '1rem', fontWeight: 500 }}>
                    Group your notes, tasks, and passwords into simple projects.
                </Typography>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                {/* Empty box to maintain layout if needed, but FAB handles creation now */}
            </Box>
        </Stack>

        {/* Project Templates Section */}
        <Box sx={{ mb: 8 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', display: 'block' }}>
                    Start from a functional template
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
                    <Grid item xs={12} sm={6} md={4} key={template.title}>
                        <Paper
                            elevation={0}
                            onClick={() => openCreateDrawer(template)}
                            sx={{
                                p: 3,
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
                                        top: 16, 
                                        right: 16, 
                                        bgcolor: alpha(template.color, 0.1), 
                                        color: template.color, 
                                        fontWeight: 900, 
                                        fontSize: '0.65rem',
                                        fontFamily: 'var(--font-mono)',
                                        border: `1px solid ${alpha(template.color, 0.2)}`
                                    }} 
                                />
                            )}
                            <Stack spacing={2.5}>
                                <Box sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: alpha(template.color, 0.1), color: template.color, display: 'grid', placeItems: 'center' }}>
                                    <template.icon size={24} strokeWidth={2.5} />
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.1rem', letterSpacing: '-0.01em' }}>{template.title}</Typography>
                                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1, display: 'block', lineHeight: 1.5, fontWeight: 500, minHeight: 44 }}>
                                        {template.description}
                                    </Typography>
                                </Box>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ color: template.color, pt: 1 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Create Project</Typography>
                                    <Plus size={14} strokeWidth={3} />
                                </Stack>
                            </Stack>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>

        <Grid container spacing={4}>
            {/* Main Projects List */}
            <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', mb: 3, display: 'block' }}>
                    My Projects ({projects.length})
                </Typography>
                
                {loading ? (
                    <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
                        <CircularProgress sx={{ color: '#6366F1' }} />
                    </Box>
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
                        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>No projects yet</Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, maxWidth: 360, mx: 'auto' }}>
                            Start a project to keep your work organized in one place.
                        </Typography>
                        <Button variant="outlined" onClick={openCreateDrawer} sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)', color: '#fff', px: 4, fontWeight: 800 }}>Create First Project</Button>
                    </Paper>
                ) : (
                    <Grid container spacing={2.5}>
                        {projects.map(project => (
                            <Grid item xs={12} sm={6} lg={4} key={project.$id}>
                                <ProjectCard 
                                    project={project} 
                                    onClick={handleProjectClick}
                                    onDelete={handleDeleteProject}
                                />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
