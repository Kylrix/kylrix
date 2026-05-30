'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography, Stack, Button, IconButton, Skeleton, alpha, useTheme, Chip } from '@mui/material';
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
  | 'settings_accounts';

interface DesktopRightSectionProps {
  panels: PanelType[];
  contextId?: string; // Optional context like eventId, formId, project ID
  onAction?: (actionId: string, payload?: any) => void;
}

export default function DesktopRightSection({ panels, contextId, onAction }: DesktopRightSectionProps) {
  const router = useRouter();
  const { user } = useAuth();
  const theme = useTheme();

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

  // Load active projects
  useEffect(() => {
    if (!panels.includes('projects') || !user) return;
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
        if (mounted) setSecrets(res.rows || []);
      } catch (e) {
        console.error('Failed loading secrets:', e);
      } finally {
        if (mounted) setSecretsLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [panels, user]);

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
          <Skeleton variant="rounded" width={36} height={36} sx={{ bgcolor: 'rgba(255,255,255,0.04)', borderRadius: '10px' }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={16} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
            <Skeleton variant="text" width="40%" height={12} sx={{ bgcolor: 'rgba(255,255,255,0.02)' }} />
          </Box>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{
      height: 'calc(100vh - 120px)',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      position: 'sticky',
      top: '108px',
      width: '100%',
      pointerEvents: 'auto',
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
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: isOpen ? '1 1 auto' : '0 0 68px',
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
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: isOpen ? '1 1 auto' : '0 0 68px',
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
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: isOpen ? '1 1 auto' : '0 0 68px',
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
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: isOpen ? '1 1 auto' : '0 0 68px',
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
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: isOpen ? '1 1 auto' : '0 0 68px',
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
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: isOpen ? '1 1 auto' : '0 0 68px',
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
                transition: 'flex 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                flex: isOpen ? '1 1 auto' : '0 0 68px',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isOpen ? 2 : 0 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Vault Secrets
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton onClick={() => togglePanel(panel)} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </IconButton>
                    <IconButton onClick={() => router.push('/vault')} size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
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
                            onClick={() => router.push('/vault')}
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

          default:
            return null;
        }
      })}
    </Box>
  );
}
