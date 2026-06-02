'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@/lib/mui-tailwind/material';
import {
  Bot,
  Play,
  Plug,
  Plus,
  X,
  ChevronRight,
  ArrowLeft,
  Check,
  Power,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { AgenticService } from '@/lib/services/agentic';
import { runMyAgent } from '@/lib/actions/agentic';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';

type AgentFramework = 'kylrix' | 'openclaw' | 'hermes';

type AgentStatus = 'idle' | 'working';

interface AgentRow {
  $id: string;
  ownerId: string;
  parentId?: string | null;
  publicKey?: string | null;
  config?: string;
  status?: string;
  $updatedAt?: string;
}

const frameworks: Array<{ id: AgentFramework; title: string; comingSoon?: boolean }> = [
  { id: 'kylrix', title: 'Kylrix Internal' },
  { id: 'openclaw', title: 'OpenClaw', comingSoon: true },
  { id: 'hermes', title: 'Hermes', comingSoon: true }
];

const fontUi = 'var(--font-satoshi)';
const fontDisplay = 'var(--font-clash)';

// 1. Opaque solids only — see `design.md` + `.agents/skills/kylrix-muted-v3-design`.
const SURFACE_ASH = '#161412';
const VOID = '#0A0908';
const HOVER = '#1C1A18';
const LIFTED = '#1F1D1B';
const BORDER_HAIRLINE = '#34322F';
const TEXT_MUTED = '#9B9691';
const SYSTEM_PRIMARY = '#6366F1';
const SYSTEM_HOVER = '#575CF0';
const SYSTEM_SUCCESS = '#10B981';
const SYSTEM_WARNING = '#F59E0B';

const BORDER = `1px solid ${BORDER_HAIRLINE}`;
const BRAND_TRANSITION = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
const RADIUS_LARGE = '24px';
const RADIUS_MEDIUM = '16px';
const RADIUS_SMALL = '12px';

function formatUpdatedAgo(value?: string): string {
  if (!value) return 'Just now';
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return 'updated just now';
  const deltaMs = Date.now() - ts;
  if (deltaMs < 60_000) return 'updated just now';
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 60) return `updated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `updated ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `updated ${days}d ago`;
}

export function AgenticDrawer() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { isOpen, closeAgenticDrawer } = useAgenticDrawer();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const isPro = hasPaidKylrixPlan(user);

  const [isExpanded, setIsExpanded] = useState(false);

  // Nested Overlay State Controllers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFrameworkOpen, setIsFrameworkOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const [framework, setFramework] = useState<AgentFramework>('kylrix');
  const [agentName, setAgentName] = useState('');
  const [agentGoal, setAgentGoal] = useState('');
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsCreateOpen(false);
      setIsFrameworkOpen(false);
      setSelectedAgentId(null);
      setFramework('kylrix');
      setAgentName('');
      setAgentGoal('');
      setError(null);
      setIsExpanded(false);
    }
  }, [isOpen]);

  const fetchAgents = useCallback(async () => {
    if (!user?.$id) {
      setAgents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await AgenticService.listMyAgents(user.$id);
      setAgents(rows as unknown as AgentRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load agents.');
    } finally {
      setLoading(false);
    }
  }, [user?.$id]);

  useEffect(() => {
    if (!isOpen || !user?.$id) return;
    void fetchAgents();
  }, [fetchAgents, isOpen, user?.$id]);

  const createAgent = useCallback(async () => {
    if (!user?.$id || !agentName.trim()) return;

    if (!isPro) {
      openProUpgrade('Create AI Agent');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await AgenticService.createMyAgent({
        userId: user.$id,
        name: agentName.trim(),
        goal: agentGoal.trim(),
        framework,
      });
      setAgentName('');
      setAgentGoal('');
      setIsCreateOpen(false);
      await fetchAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create agent.');
    } finally {
      setSaving(false);
    }
  }, [agentGoal, agentName, fetchAgents, framework, isPro, openProUpgrade, user?.$id]);

  const setAgentStatus = useCallback(async (agent: AgentRow, status: AgentStatus) => {
    if (!user?.$id) return;
    setUpdatingAgentId(agent.$id);
    setError(null);
    try {
      await AgenticService.setMyAgentStatus(user.$id, agent.$id, status);
      setAgents((prev) => prev.map((entry) => (entry.$id === agent.$id ? { ...entry, status } : entry)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update agent status.');
    } finally {
      setUpdatingAgentId(null);
    }
  }, [user?.$id]);

  const runAgentNow = useCallback(async (agent: AgentRow) => {
    if (!user?.$id) return;

    if (!isPro) {
      openProUpgrade('Run AI Agent');
      return;
    }

    setUpdatingAgentId(agent.$id);
    setError(null);
    try {
      await AgenticService.setMyAgentStatus(user.$id, agent.$id, 'working');
      setAgents((prev) => prev.map((entry) => (entry.$id === agent.$id ? { ...entry, status: 'working' } : entry)));
      await runMyAgent(agent.$id);
      await fetchAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not run agent.');
      await fetchAgents();
    } finally {
      setUpdatingAgentId(null);
    }
  }, [fetchAgents, isPro, openProUpgrade, user?.$id]);

  const parsedAgents = useMemo(() => {
    return agents.map((agent) => {
      let config: { name?: string; goal?: string; framework?: string; lastSummary?: string | null; lastError?: string | null } = {};
      try {
        config = JSON.parse(agent.config || '{}');
      } catch {
        config = {};
      }
      return {
        ...agent,
        name: config.name || `Agent ${agent.$id.slice(0, 6)}`,
        goal: config.goal || 'No goal defined yet.',
        framework: (config.framework as AgentFramework) || 'kylrix',
        status: agent.status === 'working' ? 'working' : 'idle',
        lastSummary: config.lastSummary || null,
        lastError: config.lastError || null,
      };
    });
  }, [agents]);

  const selectedAgent = useMemo(() => {
    return parsedAgents.find((a) => a.$id === selectedAgentId) || null;
  }, [parsedAgents, selectedAgentId]);

  const runSummary = useMemo(() => {
    const working = parsedAgents.filter((a) => a.status === 'working').length;
    return {
      total: parsedAgents.length,
      working,
      idle: Math.max(parsedAgents.length - working, 0),
    };
  }, [parsedAgents]);

  const sheetBodySx = {
    fontFamily: fontUi,
    '& .MuiButton-root': { fontFamily: fontUi },
  } as const;

  const subDrawerPaperSx = {
    ...(isDesktop
      ? {
          top: '88px',
          right: 0,
          height: 'calc(100vh - 88px)',
          width: 'min(460px, 94vw)',
          maxWidth: 'min(460px, 94vw)',
          borderTopLeftRadius: RADIUS_LARGE,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderLeft: BORDER,
          borderTop: BORDER,
          borderBottom: 0,
          borderRight: 0,
        }
      : {
          height: isExpanded ? '100dvh' : '75dvh',
          borderTopLeftRadius: isExpanded ? 0 : RADIUS_LARGE,
          borderTopRightRadius: isExpanded ? 0 : RADIUS_LARGE,
          border: BORDER,
          borderBottom: 0,
          transition: 'height 0.3s ease-in-out, border-radius 0.3s ease-in-out',
        }),
    bgcolor: SURFACE_ASH,
    boxShadow: '0 -8px 24px rgba(0,0,0,0.5)',
    backgroundImage: 'none',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  };

  return (
    <>
      <Drawer
        anchor={isDesktop ? 'right' : 'bottom'}
        open={isOpen}
        onClose={closeAgenticDrawer}
        ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
        slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
        sx={{
          zIndex: 1300,
          '& .MuiDrawer-paper': {
            ...(isDesktop
              ? {
                  top: '88px',
                  right: 0,
                  height: 'calc(100vh - 88px)',
                  width: 'min(460px, 94vw)',
                  maxWidth: 'min(460px, 94vw)',
                  borderTopLeftRadius: RADIUS_LARGE,
                  borderTopRightRadius: 0,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  borderLeft: BORDER,
                  borderTop: BORDER,
                  borderBottom: 0,
                  borderRight: 0,
                }
              : {
                  height: isExpanded ? '100dvh' : '75dvh',
                  borderTopLeftRadius: isExpanded ? 0 : RADIUS_LARGE,
                  borderTopRightRadius: isExpanded ? 0 : RADIUS_LARGE,
                  border: BORDER,
                  borderBottom: 0,
                  transition: 'height 0.3s ease-in-out, border-radius 0.3s ease-in-out',
                }),
            bgcolor: SURFACE_ASH,
            boxShadow: '0 -8px 24px rgba(0,0,0,0.5)',
            backgroundImage: 'none',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {!isDesktop && (
          <Box 
              sx={{ display: 'flex', justifyContent: 'center', py: 1.5, cursor: 'pointer' }}
              onClick={closeAgenticDrawer}
          >
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
          </Box>
        )}

        <Box
          sx={{
            px: { xs: 2.25, sm: 2.75 },
            pb: 'max(20px, env(safe-area-inset-bottom))',
            pt: { xs: 1, md: 3 },
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            ...sheetBodySx,
          }}
        >
          {/* Main Header */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5, flexShrink: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: RADIUS_SMALL,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: VOID,
                  border: BORDER,
                }}
              >
                <Bot size={20} color={SYSTEM_PRIMARY} strokeWidth={2} />
              </Box>
              <Stack spacing={0.25}>
                <Typography
                  sx={{
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: '1rem',
                    fontFamily: fontDisplay,
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                  }}
                >
                  Smart Systems
                </Typography>
                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem', fontWeight: 600 }}>
                  Automate work with secure AI assistants
                </Typography>
              </Stack>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {!isDesktop && (
                <IconButton
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? 'Scale down' : 'Scale up'}
                  sx={{
                    color: '#E8E6E3',
                    bgcolor: VOID,
                    border: BORDER,
                    '&:hover': { bgcolor: HOVER },
                  }}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </IconButton>
              )}
              <IconButton
                onClick={closeAgenticDrawer}
                aria-label="Close"
                sx={{
                  color: '#E8E6E3',
                  bgcolor: VOID,
                  border: BORDER,
                  '&:hover': { bgcolor: HOVER },
                }}
              >
                <X size={16} />
              </IconButton>
            </Stack>
          </Stack>

          {/* Stats Bar */}
          <Paper
            elevation={0}
            sx={{
              mb: 2,
              p: 1.5,
              borderRadius: RADIUS_MEDIUM,
              bgcolor: VOID,
              border: BORDER,
              flexShrink: 0,
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Box sx={{ width: 8, height: 8, borderRadius: '999px', bgcolor: runSummary.working > 0 ? SYSTEM_WARNING : SYSTEM_SUCCESS }} />
                <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>
                  {runSummary.total} Active Systems
                </Typography>
              </Stack>
              <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem', fontWeight: 700 }}>
                {runSummary.working} Active · {runSummary.idle} Inactive
              </Typography>
            </Stack>
          </Paper>

          {/* Main List Box */}
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error ? <Typography sx={{ color: '#FCA5A5', fontSize: '0.8rem' }}>{error}</Typography> : null}

            <Stack
              spacing={1}
              sx={{
                overflowY: 'auto',
                pr: 0.25,
                flex: 1,
              }}
            >
              {loading ? (
                <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : parsedAgents.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: RADIUS_MEDIUM,
                    bgcolor: VOID,
                    border: BORDER,
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', mb: 0.5 }}>
                    No Smart Systems
                  </Typography>
                  <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem', lineHeight: 1.5 }}>
                    Initialize your first background assistant to automate routine operations.
                  </Typography>
                </Paper>
              ) : (
                parsedAgents.map((agent) => {
                  const isWorking = agent.status === 'working';
                  return (
                    <Paper
                      key={agent.$id}
                      elevation={0}
                      onClick={() => setSelectedAgentId(agent.$id)}
                      sx={{
                        p: 2,
                        borderRadius: RADIUS_MEDIUM,
                        bgcolor: VOID,
                        border: BORDER,
                        cursor: 'pointer',
                        transition: BRAND_TRANSITION,
                        '&:hover': {
                          bgcolor: HOVER,
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 10px -8px rgba(0,0,0,1)',
                        }
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', fontFamily: fontDisplay }}>
                            {agent.name}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.75rem', fontWeight: 600 }}>
                              {agent.framework === 'kylrix' ? 'Kylrix Internal' : agent.framework}
                            </Typography>
                            <Box sx={{ width: 3, height: 3, borderRadius: '99px', bgcolor: '#5D5A56' }} />
                            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem' }}>
                              {formatUpdatedAgo(agent.$updatedAt)}
                            </Typography>
                          </Stack>
                        </Stack>

                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
                          <Box
                            sx={{
                              px: 1.2,
                              py: 0.4,
                              borderRadius: '999px',
                              bgcolor: isWorking ? alpha(SYSTEM_PRIMARY, 0.15) : alpha(SYSTEM_SUCCESS, 0.15),
                              border: `1px solid ${isWorking ? alpha(SYSTEM_PRIMARY, 0.3) : alpha(SYSTEM_SUCCESS, 0.3)}`,
                              color: isWorking ? SYSTEM_PRIMARY : SYSTEM_SUCCESS,
                              fontSize: '0.68rem',
                              fontWeight: 900,
                              letterSpacing: '0.05em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {agent.status}
                          </Box>
                          <ChevronRight size={16} color={TEXT_MUTED} />
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })
              )}
            </Stack>

            {/* Bottom Initialize Action Button */}
            <Box sx={{ mt: 'auto', pt: 2, flexShrink: 0 }}>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                startIcon={<Plus size={18} />}
                onClick={() => setIsCreateOpen(true)}
                sx={{
                  py: 1.3,
                  borderRadius: RADIUS_SMALL,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  bgcolor: SYSTEM_PRIMARY,
                  color: '#FFFFFF',
                  boxShadow: 'none',
                  transition: BRAND_TRANSITION,
                  '&:hover': { bgcolor: SYSTEM_HOVER },
                }}
              >
                Initialize Smart System
              </Button>
            </Box>
          </Box>
        </Box>
      </Drawer>

      {/* NESTED OVERLAY 1: Initialize/Create Assistant Drawer */}
      {isCreateOpen && (
        <Drawer
          anchor={isDesktop ? 'right' : 'bottom'}
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          ModalProps={{ keepMounted: false, disableScrollLock: true, disablePortal: true }}
          slotProps={{ backdrop: { style: { backgroundColor: 'transparent' } } }}
          sx={{
            zIndex: 1400,
            '& .MuiDrawer-paper': subDrawerPaperSx,
          }}
        >
          {!isDesktop && (
            <Box 
              sx={{ display: 'flex', justifyContent: 'center', py: 1.5, cursor: 'pointer' }}
              onClick={() => setIsCreateOpen(false)}
            >
              <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
            </Box>
          )}

          <Box
            sx={{
              px: { xs: 2.25, sm: 2.75 },
              pb: 'max(20px, env(safe-area-inset-bottom))',
              pt: 1,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              ...sheetBodySx,
            }}
          >
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5, flexShrink: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton
                  onClick={() => setIsCreateOpen(false)}
                  aria-label="Back"
                  sx={{
                    color: '#E8E6E3',
                    bgcolor: VOID,
                    border: BORDER,
                    '&:hover': { bgcolor: HOVER },
                  }}
                >
                  <ArrowLeft size={16} />
                </IconButton>
                <Typography
                  sx={{
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '1rem',
                    fontFamily: fontDisplay,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Initialize System
                </Typography>
              </Stack>
              {!isDesktop && (
                <IconButton
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-label={isExpanded ? 'Scale down' : 'Scale up'}
                  sx={{
                    color: '#E8E6E3',
                    bgcolor: VOID,
                    border: BORDER,
                    '&:hover': { bgcolor: HOVER },
                  }}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </IconButton>
              )}
            </Stack>

            {/* Main Form Scroll Area */}
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.25, display: 'flex', flexDirection: 'column', gap: 2.5, minHeight: 0 }}>
              <Stack spacing={2.5}>
                <TextField
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  label="System Name"
                  placeholder="e.g., Workflow Manager"
                  fullWidth
                  size="medium"
                  sx={{
                    '& .MuiOutlinedInput-root': { 
                      bgcolor: VOID, 
                      borderRadius: RADIUS_SMALL,
                      border: BORDER,
                      '& fieldset': { border: 'none' },
                      '&:hover': { bgcolor: HOVER },
                      '&.Mui-focused': { bgcolor: HOVER, border: `1px solid ${SYSTEM_PRIMARY}` }
                    },
                    '& .MuiInputBase-input': { color: '#fff', fontSize: '0.9rem', fontWeight: 600 },
                    '& .MuiInputLabel-root': { color: TEXT_MUTED, fontSize: '0.85rem' },
                  }}
                />

                <TextField
                  value={agentGoal}
                  onChange={(event) => setAgentGoal(event.target.value)}
                  label="Goal / Instructions"
                  placeholder="e.g., Triage overdue tasks and notify team members..."
                  fullWidth
                  multiline
                  minRows={4}
                  size="medium"
                  sx={{
                    '& .MuiOutlinedInput-root': { 
                      bgcolor: VOID, 
                      borderRadius: RADIUS_SMALL,
                      border: BORDER,
                      '& fieldset': { border: 'none' },
                      '&:hover': { bgcolor: HOVER },
                      '&.Mui-focused': { bgcolor: HOVER, border: `1px solid ${SYSTEM_PRIMARY}` }
                    },
                    '& .MuiInputBase-input': { color: '#fff', fontSize: '0.9rem', lineHeight: 1.5 },
                    '& .MuiInputLabel-root': { color: TEXT_MUTED, fontSize: '0.85rem' },
                  }}
                />

                {/* Framework Selector Trigger */}
                <Paper
                  elevation={0}
                  onClick={() => setIsFrameworkOpen(true)}
                  sx={{
                    p: 2,
                    borderRadius: RADIUS_SMALL,
                    bgcolor: VOID,
                    border: BORDER,
                    cursor: 'pointer',
                    transition: BRAND_TRANSITION,
                    '&:hover': { bgcolor: HOVER }
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <Plug size={18} color={SYSTEM_PRIMARY} />
                      <Stack spacing={0.25}>
                        <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Runtime Environment
                        </Typography>
                        <Typography sx={{ color: '#fff', fontSize: '0.88rem', fontWeight: 800 }}>
                          {framework === 'kylrix' ? 'Kylrix Internal' : framework}
                        </Typography>
                      </Stack>
                    </Stack>
                    <ChevronRight size={16} color={TEXT_MUTED} />
                  </Stack>
                </Paper>

                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem', lineHeight: 1.5, px: 0.5 }}>
                  Smart systems run locally using in-process tasks. They cannot connect to arbitrary external websites or leak internal files.
                </Typography>
              </Stack>
            </Box>

            {/* Action Footer */}
            <Box sx={{ mt: 'auto', pt: 2, flexShrink: 0 }}>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                onClick={async () => {
                  await createAgent();
                }}
                disabled={saving || !agentName.trim() || !user?.$id}
                sx={{
                  py: 1.3,
                  borderRadius: RADIUS_SMALL,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  bgcolor: SYSTEM_PRIMARY,
                  color: '#FFFFFF',
                  boxShadow: 'none',
                  transition: BRAND_TRANSITION,
                  '&:hover': { bgcolor: SYSTEM_HOVER },
                }}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : 'Ready'}
              </Button>
            </Box>
          </Box>
        </Drawer>
      )}

      {/* NESTED OVERLAY 2: Select Runtime Framework Drawer */}
      {isFrameworkOpen && (
        <Drawer
          anchor={isDesktop ? 'right' : 'bottom'}
          open={isFrameworkOpen}
          onClose={() => setIsFrameworkOpen(false)}
          ModalProps={{ keepMounted: false, disableScrollLock: true, disablePortal: true }}
          slotProps={{ backdrop: { style: { backgroundColor: 'transparent' } } }}
          sx={{
            zIndex: 1500,
            '& .MuiDrawer-paper': subDrawerPaperSx,
          }}
        >
          {!isDesktop && (
            <Box 
              sx={{ display: 'flex', justifyContent: 'center', py: 1.5, cursor: 'pointer' }}
              onClick={() => setIsFrameworkOpen(false)}
            >
              <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
            </Box>
          )}

          <Box
            sx={{
              px: { xs: 2.25, sm: 2.75 },
              pb: 'max(20px, env(safe-area-inset-bottom))',
              pt: 1,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              ...sheetBodySx,
            }}
          >
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5, flexShrink: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton
                  onClick={() => setIsFrameworkOpen(false)}
                  aria-label="Back"
                  sx={{
                    color: '#E8E6E3',
                    bgcolor: VOID,
                    border: BORDER,
                    '&:hover': { bgcolor: HOVER },
                  }}
                >
                  <ArrowLeft size={16} />
                </IconButton>
                <Typography
                  sx={{
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '1rem',
                    fontFamily: fontDisplay,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Select Runtime
                </Typography>
              </Stack>
            </Stack>

            {/* Main List */}
            <Stack spacing={1.25} sx={{ flex: 1, overflowY: 'auto', pr: 0.25 }}>
              {frameworks.map((item) => {
                const selected = item.id === framework;
                const disabled = Boolean(item.comingSoon);
                return (
                  <Paper
                    key={item.id}
                    elevation={0}
                    onClick={() => {
                      if (!disabled) {
                        setFramework(item.id);
                        setIsFrameworkOpen(false);
                      }
                    }}
                    sx={{
                      p: 2,
                      borderRadius: RADIUS_MEDIUM,
                      bgcolor: VOID,
                      border: selected ? `2px solid ${SYSTEM_PRIMARY}` : BORDER,
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      transition: BRAND_TRANSITION,
                      '&:hover': disabled
                        ? undefined
                        : {
                            bgcolor: HOVER,
                          },
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography
                        sx={{
                          color: disabled ? TEXT_MUTED : '#fff',
                          fontWeight: 800,
                          fontSize: '0.875rem',
                          fontFamily: fontDisplay,
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {item.title}{item.comingSoon ? ' (Coming soon)' : ''}
                      </Typography>
                      {selected && <Check size={16} color={SYSTEM_PRIMARY} />}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          </Box>
        </Drawer>
      )}

      {/* NESTED OVERLAY 3: Agent Details System Panel Drawer */}
      {selectedAgent && (
        <Drawer
          anchor={isDesktop ? 'right' : 'bottom'}
          open={Boolean(selectedAgent)}
          onClose={() => setSelectedAgentId(null)}
          ModalProps={{ keepMounted: false, disableScrollLock: true, disablePortal: true }}
          slotProps={{ backdrop: { style: { backgroundColor: 'transparent' } } }}
          sx={{
            zIndex: 1400,
            '& .MuiDrawer-paper': subDrawerPaperSx,
          }}
        >
          {!isDesktop && (
            <Box 
              sx={{ display: 'flex', justifyContent: 'center', py: 1.5, cursor: 'pointer' }}
              onClick={() => setSelectedAgentId(null)}
            >
              <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
            </Box>
          )}

          <Box
            sx={{
              px: { xs: 2.25, sm: 2.75 },
              pb: 'max(20px, env(safe-area-inset-bottom))',
              pt: 1,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              ...sheetBodySx,
            }}
          >
            {/* Header */}
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2.5, flexShrink: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <IconButton
                  onClick={() => setSelectedAgentId(null)}
                  aria-label="Back"
                  sx={{
                    color: '#E8E6E3',
                    bgcolor: VOID,
                    border: BORDER,
                    '&:hover': { bgcolor: HOVER },
                  }}
                >
                  <ArrowLeft size={16} />
                </IconButton>
                <Typography
                  sx={{
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '1rem',
                    fontFamily: fontDisplay,
                    letterSpacing: '-0.02em',
                  }}
                >
                  System Panel
                </Typography>
              </Stack>
            </Stack>

            {/* Main Details Panel */}
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.25, display: 'flex', flexDirection: 'column', gap: 2.5, minHeight: 0 }}>
              {/* Name and State Card */}
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: RADIUS_MEDIUM,
                  bgcolor: VOID,
                  border: BORDER,
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', fontFamily: fontDisplay, mb: 1 }}>
                  {selectedAgent.name}
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      px: 1.2,
                      py: 0.4,
                      borderRadius: '999px',
                      bgcolor: selectedAgent.status === 'working' ? alpha(SYSTEM_PRIMARY, 0.15) : alpha(SYSTEM_SUCCESS, 0.15),
                      border: `1px solid ${selectedAgent.status === 'working' ? alpha(SYSTEM_PRIMARY, 0.3) : alpha(SYSTEM_SUCCESS, 0.3)}`,
                      color: selectedAgent.status === 'working' ? SYSTEM_PRIMARY : SYSTEM_SUCCESS,
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {selectedAgent.status}
                  </Box>
                  <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem', fontWeight: 600 }}>
                    {selectedAgent.framework === 'kylrix' ? 'Kylrix Internal' : selectedAgent.framework}
                  </Typography>
                </Stack>
              </Paper>

              {/* Goal Description Card */}
              <Stack spacing={1}>
                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', px: 0.5 }}>
                  Objective Goal
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: RADIUS_SMALL,
                    bgcolor: VOID,
                    border: BORDER,
                  }}
                >
                  <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {selectedAgent.goal}
                  </Typography>
                </Paper>
              </Stack>

              {/* Logs & Run Summaries Card */}
              {(selectedAgent.lastSummary || selectedAgent.lastError) && (
                <Stack spacing={1}>
                  <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', px: 0.5 }}>
                    System Logs / Activity
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: RADIUS_SMALL,
                      bgcolor: VOID,
                      border: BORDER,
                    }}
                  >
                    {selectedAgent.lastError ? (
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box sx={{ mt: 0.25, flexShrink: 0, display: 'flex' }}>
                            <AlertCircle size={16} color="#EF4444" />
                        </Box>
                        <Typography sx={{ color: '#FCA5A5', fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: 1.45 }}>
                          Error: {selectedAgent.lastError}
                        </Typography>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <Box sx={{ mt: 0.25, flexShrink: 0, display: 'flex' }}>
                            <RefreshCw size={16} color={SYSTEM_SUCCESS} />
                        </Box>
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontFamily: 'monospace', lineHeight: 1.45 }}>
                          {selectedAgent.lastSummary}
                        </Typography>
                      </Stack>
                    )}
                  </Paper>
                </Stack>
              )}
            </Box>

            {/* Action Footer */}
            <Box sx={{ mt: 'auto', pt: 2, flexShrink: 0 }}>
              {selectedAgent.status === 'working' ? (
                <Button
                  fullWidth
                  variant="contained"
                  disableElevation
                  startIcon={<Power size={16} />}
                  disabled={updatingAgentId === selectedAgent.$id}
                  onClick={async () => {
                    await setAgentStatus(selectedAgent, 'idle');
                  }}
                  sx={{
                    py: 1.3,
                    borderRadius: RADIUS_SMALL,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    bgcolor: '#EF4444',
                    color: '#FFFFFF',
                    boxShadow: 'none',
                    transition: BRAND_TRANSITION,
                    '&:hover': { bgcolor: '#DC2626' },
                  }}
                >
                  Deactivate / Set Idle
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  disableElevation
                  startIcon={<Play size={16} />}
                  disabled={updatingAgentId === selectedAgent.$id}
                  onClick={async () => {
                    await runAgentNow(selectedAgent);
                  }}
                  sx={{
                    py: 1.3,
                    borderRadius: RADIUS_SMALL,
                    textTransform: 'none',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    bgcolor: SYSTEM_SUCCESS,
                    color: '#FFFFFF',
                    boxShadow: 'none',
                    transition: BRAND_TRANSITION,
                    '&:hover': { bgcolor: '#059669' },
                  }}
                >
                  Run Agent Now
                </Button>
              )}
            </Box>
          </Box>
        </Drawer>
      )}
    </>
  );
}
