'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography, Stack, Button, IconButton,  alpha, useTheme, Chip } from '@/lib/mui-tailwind/material';
import { 
  ChevronDown, 
  ChevronUp, 
  Maximize2, 
  FolderKanban, 
  Phone, 
  FileText, 
  Tag as TagIcon, 
  Activity,
  Bot,
  Plus,
  Key,
  Shield,
  Clock,
  Send,
  MessageSquare
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { CallService } from '@/lib/services/call';
import { listNotes, listTags, listKeepCredentials } from '@/lib/appwrite';
import { listTotpSecrets } from '@/lib/appwrite/vault';
import { ChatList } from '@/components/chat/ChatList';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import toast from 'react-hot-toast';

interface PanelState {
  isOpen: boolean;
  data: any[];
  loading: boolean;
}

export type PanelType = 
  | 'note' 
  | 'huddles' 
  | 'projects' 
  | 'threads' 
  | 'tags' 
  | 'forms' 
  | 'goals' 
  | 'totp' 
  | 'secrets' 
  | 'secret_chat'
  | 'settings_discoverability'
  | 'settings_integrations'
  | 'settings_accounts'
  | 'projects_templates'
  | 'projects_stats';

interface DesktopRightSectionProps {
  panels: PanelType[];
  contextId?: string; // Optional context like eventId, formId, project ID
  onAction?: (actionId: string, payload?: any) => void;
}

export default function DesktopRightSection({ panels, contextId, onAction }: DesktopRightSectionProps) {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();
  const { open: openUnified } = useUnifiedDrawer();

  // Unified panel open/collapse states
  const [openStates, setOpenStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    panels.forEach((p, idx) => {
      initial[p] = idx === 0; // Expand first panel by default
    });
    return initial;
  });

  const togglePanel = (panel: PanelType) => {
    setOpenStates(prev => ({
      ...prev,
      [panel]: !prev[panel]
    }));
  };

  // Data states
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  const [calls, setCalls] = useState<any[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);

  const [notes, setNotes] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const [tags, setTags] = useState<any[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  const [secrets, setSecrets] = useState<any[]>([]);
  const [secretsLoading, setSecretsLoading] = useState(false);

  const [totps, setTotps] = useState<any[]>([]);
  const [totpsLoading, setTotpsLoading] = useState(false);

  const [userForms, setUserForms] = useState<any[]>([]);
  const [userFormsLoading, setUserFormsLoading] = useState(false);

  const [userGoals, setUserGoals] = useState<any[]>([]);
  const [userGoalsLoading, setUserGoalsLoading] = useState(false);

  // Load active projects
  useEffect(() => {
    if ((!panels.includes('projects') && !panels.includes('projects_stats')) || !user) return;
    let mounted = true;
    async function load() {
      setProjectsLoading(true);
      try {
        const res = await ProjectsService.listProjects();
        if (mounted) setProjects(res.rows || []);
      } catch (e) {
        console.error('Failed loading projects:', e);
      } finally {
        if (mounted) setProjectsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user]);

  // Load forms
  useEffect(() => {
    if (!panels.includes('forms') || !user) return;
    const userId = user.$id;
    let mounted = true;
    async function load() {
      setUserFormsLoading(true);
      try {
        const { FormsService } = await import('@/lib/services/forms');
        const res = await FormsService.listUserForms(userId);
        if (mounted) setUserForms(res.rows || []);
      } catch (e) {
        console.error('Failed loading forms:', e);
      } finally {
        if (mounted) setUserFormsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user]);

  // Load goals/tasks
  useEffect(() => {
    if (!panels.includes('goals') || !user) return;
    let mounted = true;
    async function load() {
      setUserGoalsLoading(true);
      try {
        const { tasks: tasksApi } = await import('@/lib/kylrixflow');
        const res = await tasksApi.list([]);
        if (mounted) setUserGoals(res.rows || []);
      } catch (e) {
        console.error('Failed loading goals:', e);
      } finally {
        if (mounted) setUserGoalsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user]);

  // Load calls/huddles
  useEffect(() => {
    if (!panels.includes('huddles') || !user) return;
    const userId = user.$id;
    let mounted = true;
    async function load() {
      setCallsLoading(true);
      try {
        const res = await CallService.getActiveCalls(userId, true);
        if (mounted) setCalls(res || []);
      } catch (e) {
        console.error('Failed loading calls:', e);
      } finally {
        if (mounted) setCallsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user]);

  // Load notes
  useEffect(() => {
    if (!panels.includes('note') || !user) return;
    let mounted = true;
    async function load() {
      setNotesLoading(true);
      try {
        const res = await listNotes([], 5);
        if (mounted) setNotes(res.rows || []);
      } catch (e) {
        console.error('Failed loading notes:', e);
      } finally {
        if (mounted) setNotesLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user]);

  // Load tags
  useEffect(() => {
    if (!panels.includes('tags') || !user) return;
    let mounted = true;
    async function load() {
      setTagsLoading(true);
      try {
        const res = await listTags();
        if (mounted) setTags(res.rows || []);
      } catch (e) {
        console.error('Failed loading tags:', e);
      } finally {
        if (mounted) setTagsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user]);

  // Load secrets
  useEffect(() => {
    if (!panels.includes('secrets') || !user) return;
    let mounted = true;
    async function load() {
      setSecretsLoading(true);
      try {
        const res = await listKeepCredentials();
        let list = res.rows || [];
        if (contextId) {
          const query = contextId.toLowerCase();
          list = [...list].sort((a, b) => {
            const aTitle = (a.title || a.label || '').toLowerCase();
            const bTitle = (b.title || b.label || '').toLowerCase();
            const aMatch = aTitle.includes(query) ? 1 : 0;
            const bMatch = bTitle.includes(query) ? 1 : 0;
            return bMatch - aMatch;
          });
        }
        if (mounted) setSecrets(list);
      } catch (e) {
        console.error('Failed loading secrets:', e);
      } finally {
        if (mounted) setSecretsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user, contextId]);

  // Load TOTPs
  useEffect(() => {
    if (!panels.includes('totp') || !user) return;
    const userId = user.$id;
    let mounted = true;
    async function load() {
      setTotpsLoading(true);
      try {
        const res = await listTotpSecrets(userId);
        if (mounted) setTotps(res || []);
      } catch (e) {
        console.error('Failed loading TOTPs:', e);
      } finally {
        if (mounted) setTotpsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user]);

  // Calculate live TOTP code seconds remaining
  const [totpSecondsRemaining, setTotpSecondsRemaining] = useState(30);
  useEffect(() => {
    if (!panels.includes('totp')) return;
    const interval = setInterval(() => {
      const sec = 30 - (Math.floor(Date.now() / 1000) % 30);
      setTotpSecondsRemaining(sec);
    }, 1000);
    return () => clearInterval(interval);
  }, [panels]);

  // Render list panel skeleton helper
  const renderSkeletonList = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {[1, 2, 3].map((n) => (
        <Box key={n} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }}>
          <></>
          <Box sx={{ flex: 1 }}>
            <></>
            <></>
          </Box>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{
      maxHeight: 'calc(100vh - 140px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      position: 'sticky',
      top: '108px',
      width: '100%',
      pointerEvents: 'auto',
      overflowY: 'auto',
      pr: '4px',
      msOverflowStyle: 'none',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': {
        display: 'none'
      }
    }}>
      {panels.map((panel) => {
        const isOpen = !!openStates[panel];

        switch (panel) {
          case 'projects':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Projects
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/projects')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#F59E0B' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {projectsLoading ? renderSkeletonList() : projects.length === 0 ? (
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
            );

          case 'huddles':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Huddles
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    {isOpen && onAction && (
                      <IconButton onClick={() => onAction('start-huddle')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
                        <Plus size={16} />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {callsLoading ? renderSkeletonList() : calls.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No active huddles right now.
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Phone size={14} />}
                          onClick={() => router.push('/connect/calls?start=1')}
                          sx={{ borderRadius: '12px', textTransform: 'none', color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                        >
                          Start Huddle
                        </Button>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {calls.map((call) => (
                          <Box
                            key={call.$id}
                            onClick={() => router.push(`/connect/call/${call.$id}`)}
                            sx={{
                              display: 'flex',
                              gap: 1.5,
                              p: 1.5,
                              borderRadius: '16px',
                              bgcolor: 'rgba(16, 185, 129, 0.04)',
                              border: '1px solid rgba(16, 185, 129, 0.15)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: 'rgba(16, 185, 129, 0.08)',
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
                              bgcolor: 'rgba(16, 185, 129, 0.15)',
                              color: '#10B981',
                              flexShrink: 0,
                            }}>
                              <Phone size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                                {call.title || 'Live Huddle'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700 }} noWrap>
                                ACTIVE NOW
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );

          case 'note':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Notes
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/note/notes')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#EC4899' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {notesLoading ? renderSkeletonList() : notes.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No recent notes.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {notes.map((note) => (
                          <Box
                            key={note.$id}
                            onClick={() => router.push(`/note/notes/${note.$id}`)}
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
                              bgcolor: 'rgba(236, 72, 153, 0.1)',
                              color: '#EC4899',
                              flexShrink: 0,
                            }}>
                              <FileText size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                                {note.title || 'Untitled Note'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }} noWrap>
                                {note.content ? note.content.substring(0, 45) + '...' : 'Empty Note'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );

          case 'threads':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Threads
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/connect/chats')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#F59E0B' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    <ChatList activeTab="public" hideTabs={true} />
                  </Box>
                )}
              </Box>
            );

          case 'tags':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/note/tags')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#6366F1' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {tagsLoading ? renderSkeletonList() : tags.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No tags created yet.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {tags.map((tag) => (
                          <Chip
                            key={tag.$id}
                            label={tag.name}
                            onClick={() => router.push(`/note/tags?tag=${encodeURIComponent(tag.name)}`)}
                            sx={{
                              bgcolor: alpha(tag.color || '#6366F1', 0.08),
                              color: tag.color || '#6366F1',
                              border: `1px solid ${alpha(tag.color || '#6366F1', 0.2)}`,
                              fontWeight: 800,
                              fontSize: '0.8rem',
                              fontFamily: 'var(--font-satoshi)',
                              '&:hover': {
                                bgcolor: alpha(tag.color || '#6366F1', 0.15),
                              }
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );

          case 'totp':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
                    TOTP Keys
                    <Box sx={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      border: '2px solid rgba(255,255,255,0.1)', 
                      display: 'grid', 
                      placeItems: 'center', 
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      color: totpSecondsRemaining < 6 ? '#FF4D4D' : '#10B981',
                      borderColor: totpSecondsRemaining < 6 ? 'rgba(255, 77, 77, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                    }}>
                      {totpSecondsRemaining}
                    </Box>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/vault/totp')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {totpsLoading ? renderSkeletonList() : totps.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No TOTP accounts in Vault.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {totps.map((totp) => (
                          <Box
                            key={totp.$id}
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.5,
                              p: 1.5,
                              borderRadius: '16px',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.03)',
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>
                                {totp.issuer || 'TOTP'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                                {totp.accountName}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.02)', p: 1, borderRadius: '10px', mt: 0.5 }}>
                              <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 900, color: '#10B981', letterSpacing: '0.04em' }}>
                                305 918
                              </Typography>
                              <IconButton size="small" onClick={() => {
                                navigator.clipboard.writeText('305918');
                                toast.success('TOTP code copied!');
                              }} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: 'white' } }}>
                                <Maximize2 size={12} />
                              </IconButton>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );

          case 'secrets':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Vault Secrets
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/vault/dashboard')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {secretsLoading ? renderSkeletonList() : secrets.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No secrets in Vault.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {secrets.map((secret) => (
                          <Box
                            key={secret.$id}
                            onClick={() => router.push('/vault/dashboard')}
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
                              bgcolor: 'rgba(16, 185, 129, 0.1)',
                              color: '#10B981',
                              flexShrink: 0,
                            }}>
                              <Key size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                                {secret.title || secret.label || 'Credentials'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }} noWrap>
                                {secret.username || 'Encrypted secret'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );

          case 'forms':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Forms
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/flow/forms')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {userFormsLoading ? renderSkeletonList() : userForms.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No forms found.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {userForms.map((form) => (
                          <Box
                            key={form.$id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'form', id: form.$id, title: form.title }));
                            }}
                            onClick={() => router.push(`/flow/forms/${form.$id}`)}
                            sx={{
                              display: 'flex',
                              gap: 1.5,
                              p: 1.5,
                              borderRadius: '16px',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.03)',
                              cursor: 'grab',
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
                              bgcolor: 'rgba(16, 185, 129, 0.1)',
                              color: '#10B981',
                              flexShrink: 0,
                            }}>
                              <FileText size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                                {form.title || 'Untitled Form'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }} noWrap>
                                {form.description || 'No description'}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );

          case 'goals':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Goals
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/flow/goals')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    {userGoalsLoading ? renderSkeletonList() : userGoals.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          No goals found.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {userGoals.map((goal) => (
                          <Box
                            key={goal.$id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'goal', id: goal.$id, title: goal.title }));
                            }}
                            onClick={() => router.push('/flow/goals')}
                            sx={{
                              display: 'flex',
                              gap: 1.5,
                              p: 1.5,
                              borderRadius: '16px',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.03)',
                              cursor: 'grab',
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
                              bgcolor: 'rgba(16, 185, 129, 0.1)',
                              color: '#10B981',
                              flexShrink: 0,
                            }}>
                              <Activity size={18} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                                {goal.title || 'Untitled Goal'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }} noWrap>
                                STATUS: {(goal.status || 'todo').toUpperCase()}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            );

          case 'secret_chat':
            return (
              <Box key={panel} sx={{
                bgcolor: '#161412',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                p: 2.5,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: '0 0 auto',
                height: isOpen ? 'auto' : '68px',
                maxHeight: isOpen ? '380px' : '68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
                    Secret Chat
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/connect/chats')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#F59E0B' } }}>
                      <Maximize2 size={14} />
                    </IconButton>
                  </Box>
                </Box>

                {isOpen && (
                  <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
                    <ChatList activeTab="secure" hideTabs={true} />
                  </Box>
                )}
              </Box>
            );

          case 'projects_templates': {
            const projectTemplates = [
              { id: 'form-to-project', title: 'Analyze Responses', summary: 'Intake forms to execution tasks.', color: '#6366F1' },
              { id: 'idea-to-execution', title: 'Launch Projects', summary: 'Roadmaps, syncs & vault secrets.', color: '#EC4899' },
              { id: 'academic-research', title: 'Deep Research', summary: 'Milestones & studies.', color: '#A855F7' },
              { id: 'social-pulse', title: 'Grow Audience', summary: 'Sync campaign moment RSVPs.', color: '#10B981' },
              { id: 'secure-handover', title: 'Secure Delivery', summary: 'Vault-locked delivery handover.', color: '#F59E0B' },
            ];

            return (
              <div 
                key={panel} 
                className={`bg-[#161412] rounded-[24px] border border-white/5 p-5 flex flex-col overflow-hidden transition-all duration-300 ease-out flex-none ${
                  isOpen ? 'h-auto max-h-[380px]' : 'h-[68px]'
                }`}
              >
                <div className={`flex justify-between items-center ${isOpen ? 'mb-2' : ''}`}>
                  <h3 className="text-white text-base font-black tracking-tight leading-tight flex items-center gap-1.5 font-mono select-none">
                    <Bot size={18} className="text-[#10B981]" /> Execution Templates
                  </h3>
                  <button 
                    onClick={() => togglePanel(panel)} 
                    className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                  >
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {isOpen && (
                  <div className="flex-1 overflow-y-auto pr-0.5 mt-2 space-y-3">
                    {projectTemplates.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          openUnified('new-project', { template: t });
                        }}
                        className="w-full text-left flex gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.04] transition-all duration-200 hover:translate-x-1 group"
                        style={{
                          borderColor: `${t.color}15`
                        }}
                      >
                        <div 
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: `${t.color}1A`,
                            color: t.color,
                          }}
                        >
                          <FolderKanban size={17} />
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <span className="font-extrabold text-white text-[13px] leading-tight group-hover:text-white transition-colors">
                            {t.title}
                          </span>
                          <span className="text-white/50 text-[11px] font-medium leading-tight">
                            {t.summary}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          case 'projects_stats': {
            const totalProjects = projects.length;
            const pinnedProjects = projects.filter((p: any) => p.isPinned).length;
            const statusSpreads = projects.reduce((acc: Record<string, number>, p: any) => {
              const status = p.status || 'active';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {});

            return (
              <div 
                key={panel} 
                className={`bg-[#161412] rounded-[24px] border border-white/5 p-5 flex flex-col overflow-hidden transition-all duration-300 ease-out flex-none ${
                  isOpen ? 'h-auto max-h-[380px]' : 'h-[68px]'
                }`}
              >
                <div className={`flex justify-between items-center ${isOpen ? 'mb-2' : ''}`}>
                  <h3 className="text-white text-base font-black tracking-tight leading-tight flex items-center gap-1.5 font-mono select-none">
                    <Activity size={18} className="text-[#6366F1]" /> Workspace Stats
                  </h3>
                  <button 
                    onClick={() => togglePanel(panel)} 
                    className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all"
                  >
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {isOpen && (
                  <div className="space-y-4 mt-3 flex-1 overflow-y-auto pr-0.5 scrollbar-thin">
                    <div className="space-y-2">
                      <span className="text-[9px] text-[#10B981] font-black uppercase tracking-wider block mb-1.5 font-mono">
                        Quick Execution Deck
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => openUnified('note')}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/10 text-left transition-all group"
                        >
                          <FileText size={15} className="text-[#EC4899] group-hover:scale-110 transition-transform" />
                          <span className="text-[11px] font-bold text-white leading-tight">Draft Note</span>
                        </button>
                        <button
                          onClick={() => openUnified('new-project')}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/10 text-left transition-all group"
                        >
                          <Plus size={15} className="text-[#6366F1] group-hover:scale-110 transition-transform" />
                          <span className="text-[11px] font-bold text-white leading-tight">New Project</span>
                        </button>
                        <button
                          onClick={() => openUnified('new-chat')}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/10 text-left transition-all group"
                        >
                          <MessageSquare size={15} className="text-[#F59E0B] group-hover:scale-110 transition-transform" />
                          <span className="text-[11px] font-bold text-white leading-tight">New Chat</span>
                        </button>
                        <button
                          onClick={() => openUnified('github-integration')}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/10 text-left transition-all group"
                        >
                          <Send size={15} className="text-[#10B981] group-hover:scale-110 transition-transform" />
                          <span className="text-[11px] font-bold text-white leading-tight">Link Github</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[9px] text-white/40 font-black uppercase tracking-wider block mb-0.5">
                          Total
                        </span>
                        <span className="text-lg font-black text-white font-mono">
                          {totalProjects}
                        </span>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                        <span className="text-[9px] text-white/40 font-black uppercase tracking-wider block mb-0.5">
                          Pinned
                        </span>
                        <span className="text-lg font-black text-[#F59E0B] font-mono">
                          {pinnedProjects}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <span className="text-[9px] text-white/40 font-black uppercase tracking-wider block mb-2">
                        Status Distribution
                      </span>
                      <div className="space-y-1.5">
                        {Object.entries(statusSpreads).length === 0 ? (
                          <span className="text-[11px] text-white/40 italic">
                            No status data available.
                          </span>
                        ) : (
                          Object.entries(statusSpreads).map(([status, count]: [string, any]) => (
                            <div key={status} className="flex justify-between items-center">
                              <span className="text-xs text-white/70 capitalize font-bold">
                                {status}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-[#6366F1]/10 text-[#6366F1] font-black font-mono text-[9px]">
                                {count}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }

          default:
            return null;
        }
      })}
    </Box>
  );
}
