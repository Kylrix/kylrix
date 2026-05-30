'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Container, Box, Typography, useMediaQuery, useTheme, IconButton, Skeleton, alpha } from '@mui/material';
import { Feed } from '@/components/social/Feed';
import { ChatList } from '@/components/chat/ChatList';
import { ProjectsService } from '@/lib/appwrite/projects';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFAB } from '@/context/FABContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { MessageSquare, Phone, Plus, ChevronDown, ChevronUp, Maximize2, FolderKanban } from 'lucide-react';

// Client-side persistence cache to resist flicker and page reloads
let cachedProjects: any[] | null = null;

function ConnectHomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [composeIntent, setComposeIntent] = useState<{
    noteId: string;
    noteTitle?: string;
    noteContent?: string;
    noteLink?: string;
    draftText?: string;
  } | null>(null);
  const { setConfiguration, resetConfiguration } = useFAB();
  const { open: openUnified } = useUnifiedDrawer();

  // Flexible right panel sizes
  const [threadsOpen, setThreadsOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);

  // Projects data state
  const [projects, setProjects] = useState<any[]>(() => cachedProjects || []);
  const [projectsLoading, setProjectsLoading] = useState(() => !cachedProjects);

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#F59E0B',
      actions: [
        { id: 'chat', label: 'NEW CHAT', icon: <MessageSquare size={20} />, onClick: () => openUnified('new-chat') },
        { id: 'channel', label: 'NEW CHANNEL', icon: <Plus size={20} />, onClick: () => openUnified('new-channel') },
        { id: 'huddle', label: 'START HUDDLE', icon: <Phone size={20} />, onClick: () => router.push('/connect/calls?start=1') }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, router, openUnified]);

  useEffect(() => {
    let mounted = true;
    async function loadProjects() {
      try {
        const res = await ProjectsService.listProjects();
        if (mounted) {
          cachedProjects = res.rows || [];
          setProjects(res.rows || []);
          setProjectsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load projects inside Connect home:', err);
        if (mounted) setProjectsLoading(false);
      }
    }
    loadProjects();
    return () => {
      mounted = false;
    };
  }, []);

  const shouldCompose = useMemo(() => searchParams.get('compose') === '1', [searchParams]);

  useEffect(() => {
    if (!shouldCompose) return;
    const queryNoteId = String(searchParams.get('noteId') || '').trim();
    let nextIntent: {
      noteId: string;
      noteTitle?: string;
      noteContent?: string;
      noteLink?: string;
      draftText?: string;
    } | null = null;

    if (queryNoteId) {
      nextIntent = {
        noteId: queryNoteId,
        noteTitle: String(searchParams.get('noteTitle') || '').trim(),
        noteContent: '',
        noteLink: String(searchParams.get('noteLink') || '').trim(),
        draftText: String(searchParams.get('draftText') || '').trim(),
      };
    } else if (typeof window !== 'undefined') {
      const raw = window.sessionStorage.getItem('kylrix:compose-note-intent');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as {
            noteId?: string;
            noteTitle?: string;
            noteContent?: string;
            noteLink?: string;
            draftText?: string;
          };
          const noteId = String(parsed?.noteId || '').trim();
          if (noteId) {
            nextIntent = {
              noteId,
              noteTitle: String(parsed?.noteTitle || '').trim(),
              noteContent: String(parsed?.noteContent || '').trim(),
              noteLink: String(parsed?.noteLink || '').trim(),
              draftText: String(parsed?.draftText || '').trim(),
            };
          }
        } catch {}
        window.sessionStorage.removeItem('kylrix:compose-note-intent');
      }
    }

    if (nextIntent) setComposeIntent(nextIntent);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('compose');
    params.delete('noteId');
    params.delete('noteTitle');
    params.delete('noteContent');
    params.delete('noteLink');
    params.delete('draftText');
    params.delete('composeKey');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [pathname, router, searchParams, shouldCompose]);

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  if (isDesktop) {
    return (
      <Container maxWidth="xl" sx={{ py: 2, pointerEvents: 'auto' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 4, alignItems: 'flex-start' }}>
          {/* Moments Column */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff', mb: 3 }}>
              Moments
            </Typography>
            <Feed view="personal" composeIntent={composeIntent} />
          </Box>

          {/* Sticky Interactive Dashboard Side column */}
          <Box sx={{
            height: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            position: 'sticky',
            top: '108px',
          }}>
            
            {/* Section 1: Huddle Threads */}
            <Box sx={{
              bgcolor: '#161412',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              flex: threadsOpen && projectsOpen ? '1 1 50%' : threadsOpen ? '1 1 100%' : '0 0 68px',
            }}>
              {/* Threads Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: threadsOpen ? 2 : 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                  Threads
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton onClick={() => setThreadsOpen(!threadsOpen)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                    {threadsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </IconButton>
                  <IconButton onClick={() => router.push('/connect/chats')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#F59E0B' } }}>
                    <Maximize2 size={14} />
                  </IconButton>
                </Box>
              </Box>

              {threadsOpen && (
                <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                  <ChatList activeTab="public" hideTabs={true} />
                </Box>
              )}
            </Box>

            {/* Section 2: Projects Accordion */}
            <Box sx={{
              bgcolor: '#161412',
              borderRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              flex: threadsOpen && projectsOpen ? '1 1 50%' : projectsOpen ? '1 1 100%' : '0 0 68px',
            }}>
              {/* Projects Header */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: projectsOpen ? 2 : 0 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                  Projects
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton onClick={() => setProjectsOpen(!projectsOpen)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                    {projectsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </IconButton>
                  <IconButton onClick={() => router.push('/projects')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#F59E0B' } }}>
                    <Maximize2 size={14} />
                  </IconButton>
                </Box>
              </Box>

              {projectsOpen && (
                <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                  {projectsLoading ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {[1, 2, 3].map((n) => (
                        <Box key={n} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <Skeleton variant="rounded" width={36} height={36} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px' }} />
                          <Box sx={{ flex: 1 }}>
                            <Skeleton variant="text" width="60%" height={16} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                            <Skeleton variant="text" width="40%" height={12} sx={{ bgcolor: 'rgba(255,255,255,0.02)' }} />
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : projects.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                        No active projects.
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {projects.map((proj) => (
                        <Box
                          key={proj.$id}
                          onClick={() => router.push(`/projects/${proj.$id}`)}
                          sx={{
                            display: 'flex',
                            gap: 1.5,
                            p: 1.5,
                            borderRadius: '16px',
                            bgcolor: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.03)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              bgcolor: 'rgba(255,255,255,0.04)',
                              borderColor: 'rgba(255,255,255,0.08)',
                              transform: 'translateX(3px)',
                            }
                          }}
                        >
                          <Box sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: alpha(proj.color || '#6366F1', 0.12),
                            color: proj.color || '#6366F1',
                            flexShrink: 0,
                          }}>
                            <FolderKanban size={18} />
                          </Box>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                              {proj.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }} noWrap>
                              STATUS: {(proj.status || 'Active').toUpperCase()}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 2, pointerEvents: 'auto' }}>
      <Feed view="personal" composeIntent={composeIntent} />
    </Container>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <ConnectHomeContent />
    </Suspense>
  );
}
