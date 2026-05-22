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
} from '@mui/material';
import { Bot, Play, Plug, Plus, X } from 'lucide-react';

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
  { id: 'hermes', title: 'Hermes', comingSoon: true }];

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

  const [stage, setStage] = useState<'live' | 'framework' | 'create'>('live');
  const [framework, setFramework] = useState<AgentFramework>('kylrix');
  const [agentName, setAgentName] = useState('');
  const [agentGoal, setAgentGoal] = useState('');
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingAgentId, setUpdatingAgentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stageOrder: Array<typeof stage> = ['live', 'framework', 'create'];

  useEffect(() => {
    if (!isOpen) {
      setStage('live');
      setFramework('kylrix');
      setAgentName('');
      setAgentGoal('');
      setError(null);
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
      setStage('live');
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

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={isOpen}
      onClose={closeAgenticDrawer}
      ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
      slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
      sx={{
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
                height: isExpanded ? '92dvh' : '60dvh',
                transition: BRAND_TRANSITION,
                borderTopLeftRadius: RADIUS_LARGE,
                borderTopRightRadius: RADIUS_LARGE,
                border: BORDER,
                borderBottom: 0,
              }),
          bgcolor: SURFACE_ASH,
          boxShadow: 'none',
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
            onClick={() => setIsExpanded(!isExpanded)}
        >
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
        </Box>
      )}

      <Box
        sx={{
          px: { xs: 2.25, sm: 2.75 },
          pb: 'max(20px, env(safe-area-inset-bottom))',
          pt: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          ...sheetBodySx,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
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
            <Typography
              sx={{
                color: '#fff',
                fontWeight: 900,
                fontSize: '1rem',
                fontFamily: fontDisplay,
                letterSpacing: '-0.03em',
              }}
            >
              Smart Systems
            </Typography>
          </Stack>
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
            <X size={18} />
          </IconButton>
        </Stack>

        <Paper
          elevation={0}
          sx={{
            mb: 1.75,
            p: 1.5,
            borderRadius: RADIUS_MEDIUM,
            bgcolor: VOID,
            border: BORDER,
          }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '999px', bgcolor: runSummary.working > 0 ? SYSTEM_WARNING : SYSTEM_SUCCESS }} />
              <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>
                {runSummary.total} Systems
              </Typography>
            </Stack>
            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem', fontWeight: 700 }}>
              {runSummary.working} Active · {runSummary.idle} Inactive
            </Typography>
          </Stack>
        </Paper>

        <Stack direction="row" spacing={0.75} sx={{ mb: 1.6 }}>
          {stageOrder.map((entry, index) => {
            const active = stage === entry;
            const label = entry === 'live' ? 'Live' : entry === 'framework' ? 'Runtime' : 'Create';
            return (
              <Button
                key={entry}
                size="small"
                onClick={() => setStage(entry)}
                sx={{
                  flex: 1,
                  minHeight: 36,
                  borderRadius: '10px',
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: '0.76rem',
                  letterSpacing: '0.02em',
                  color: active ? '#fff' : TEXT_MUTED,
                  bgcolor: active ? SYSTEM_PRIMARY : VOID,
                  border: BORDER,
                  transition: BRAND_TRANSITION,
                  '&:hover': { bgcolor: active ? SYSTEM_HOVER : HOVER },
                }}
              >
                {index + 1}. {label}
              </Button>
            );
          })}
        </Stack>

        {stage === 'live' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexShrink: 0 }}>
              <Typography sx={{ fontFamily: fontUi, fontSize: '0.8125rem', color: TEXT_MUTED, fontWeight: 600 }}>
                {parsedAgents.length} active assistants
              </Typography>
              <Button
                size="small"
                onClick={() => setStage('create')}
                startIcon={<Plus size={16} />}
                sx={{
                  textTransform: 'none',
                  borderRadius: '10px',
                  color: '#F4F4F5',
                  bgcolor: VOID,
                  border: BORDER,
                  fontWeight: 700,
                  px: 1.2,
                }}
              >
                Setup
              </Button>
            </Stack>

            {error ? <Typography sx={{ color: '#FCA5A5', fontSize: '0.8rem' }}>{error}</Typography> : null}

            <Stack
              spacing={1}
              sx={{
                maxHeight: { xs: 440, md: 520 },
                overflowY: 'auto',
                pr: 0.25,
                flex: 1,
              }}
            >
              {loading ? (
                <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : parsedAgents.length === 0 ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2.2,
                      borderRadius: RADIUS_MEDIUM,
                      bgcolor: VOID,
                      border: BORDER,
                    }}
                  >
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>No assistants yet</Typography>
                  <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem', mt: 0.5 }}>
                    Initialize your first Smart Assistant to start automations.
                  </Typography>
                </Paper>
              ) : (
                parsedAgents.map((agent) => (
                  <Paper
                    key={agent.$id}
                    elevation={0}
                    sx={{
                      p: 1.6,
                      borderRadius: RADIUS_MEDIUM,
                      bgcolor: LIFTED,
                      border: BORDER,
                      transition: BRAND_TRANSITION,
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        bgcolor: HOVER,
                      }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ color: '#fff', fontWeight: 800, fontSize: '0.88rem' }}>
                          {agent.name}
                        </Typography>
                        <Typography noWrap sx={{ color: TEXT_MUTED, fontSize: '0.76rem' }}>
                          {agent.framework === 'kylrix' ? 'Kylrix Internal' : agent.framework}
                        </Typography>
                        <Typography noWrap sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', mt: 0.25 }}>
                          {formatUpdatedAgo(agent.$updatedAt)}
                        </Typography>
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          px: 1.1,
                          py: 0.25,
                          borderRadius: '999px',
                          bgcolor: agent.status === 'working' ? SYSTEM_PRIMARY : SYSTEM_SUCCESS,
                          color: '#fff',
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {agent.status}
                      </Box>
                    </Stack>
                    <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.78rem', mt: 1.1, mb: 1.05, lineHeight: 1.5 }}>
                      {agent.goal}
                    </Typography>
                    {agent.lastError ? (
                      <Typography sx={{ color: '#FCA5A5', fontSize: '0.75rem', mb: 1.05, lineHeight: 1.45 }}>
                        Last run error: {agent.lastError}
                      </Typography>
                    ) : agent.lastSummary ? (
                      <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', mb: 1.05, lineHeight: 1.45 }}>
                        Last run: {agent.lastSummary}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        fullWidth
                        variant="outlined"
                        disabled={updatingAgentId === agent.$id || agent.status === 'idle'}
                        onClick={() => void setAgentStatus(agent, 'idle')}
                        sx={{ textTransform: 'none', borderColor: BORDER_HAIRLINE, color: '#F4F4F5', borderRadius: '10px', minHeight: 38 }}
                      >
                        Inactive
                      </Button>
                      <Button
                        size="small"
                        fullWidth
                        variant="contained"
                        startIcon={<Play size={14} />}
                        disabled={updatingAgentId === agent.$id || agent.status === 'working'}
                        onClick={() => void runAgentNow(agent)}
                        sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: SYSTEM_PRIMARY, minHeight: 38, '&:hover': { bgcolor: SYSTEM_HOVER } }}
                      >
                        Activate
                      </Button>
                    </Stack>
                  </Paper>
                ))
              )}
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setStage('framework')}
                sx={{
                  py: 1.15,
                  borderRadius: RADIUS_SMALL,
                  textTransform: 'none',
                  color: '#F4F4F5',
                  borderColor: BORDER_HAIRLINE,
                  fontWeight: 700,
                  transition: BRAND_TRANSITION,
                  '&:hover': { borderColor: '#4F4C49', bgcolor: VOID },
                }}
              >
                Runtime
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                startIcon={<Plus size={18} />}
                onClick={() => setStage('create')}
                sx={{
                  py: 1.15,
                  borderRadius: RADIUS_SMALL,
                  textTransform: 'none',
                  fontWeight: 800,
                  bgcolor: SYSTEM_PRIMARY,
                  color: '#FFFFFF',
                  boxShadow: 'none',
                  transition: BRAND_TRANSITION,
                  '&:hover': { bgcolor: SYSTEM_HOVER },
                }}
              >
                Initialize
              </Button>
            </Stack>
          </Box>
        )}

        {stage === 'framework' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9375rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
              System Runtime
            </Typography>

            <Stack spacing={1.25} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.25 }}>
              {frameworks.map((item) => {
                const selected = item.id === framework;
                const disabled = Boolean(item.comingSoon);
                return (
                  <Paper
                    key={item.id}
                    elevation={0}
                    onClick={() => !disabled && setFramework(item.id)}
                    sx={{
                      p: 1.75,
                      borderRadius: RADIUS_MEDIUM,
                      bgcolor: VOID,
                      border: selected ? `2px solid ${SYSTEM_PRIMARY}` : BORDER,
                      cursor: disabled ? 'default' : 'pointer',
                      transition: BRAND_TRANSITION,
                      '&:hover': disabled
                        ? undefined
                        : {
                            bgcolor: HOVER,
                            borderColor: selected ? SYSTEM_PRIMARY : BORDER_HAIRLINE,
                          },
                    }}
                  >
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
                  </Paper>
                );
              })}
            </Stack>

            <Button
              variant="contained"
              onClick={() => setStage('create')}
              disabled={framework !== 'kylrix'}
              sx={{ borderRadius: '10px', minHeight: 40, textTransform: 'none', fontWeight: 700, bgcolor: SYSTEM_PRIMARY, '&:hover': { bgcolor: SYSTEM_HOVER } }}
            >
              Continue
            </Button>
            <Button variant="text" onClick={() => setStage('live')} sx={{ alignSelf: 'flex-start', color: TEXT_MUTED, textTransform: 'none', fontWeight: 700 }}>
              Back
            </Button>
          </Box>
        )}

        {stage === 'create' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9375rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
              Setup Assistant
            </Typography>

            <Paper
              elevation={0}
              sx={{
                p: 1.75,
                borderRadius: RADIUS_MEDIUM,
                bgcolor: LIFTED,
                border: BORDER,
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
              }}
            >
              <Stack spacing={1.25}>
                <TextField
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  label="Assistant Name"
                  placeholder="Workflow Manager"
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': { bgcolor: '#201E1C', borderRadius: '12px' },
                    '& .MuiInputBase-input': { color: '#fff' },
                    '& .MuiInputLabel-root': { color: TEXT_MUTED },
                  }}
                />
                <TextField
                  value={agentGoal}
                  onChange={(event) => setAgentGoal(event.target.value)}
                  label="Goal"
                  placeholder="Triage overdue tasks and report blockers"
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': { bgcolor: HOVER, borderRadius: '12px' },
                    '& .MuiInputBase-input': { color: '#fff' },
                    '& .MuiInputLabel-root': { color: TEXT_MUTED },
                  }}
                />
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    height: 36,
                    px: 1.5,
                    borderRadius: '999px',
                    bgcolor: VOID,
                    border: BORDER,
                    color: '#F4F4F5',
                    fontFamily: fontUi,
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    width: 'fit-content',
                  }}
                >
                  <Plug size={14} />
                  System: {framework === 'kylrix' ? 'Kylrix Internal' : framework}
                </Box>
                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.74rem' }}>
                  Assistants run with your internal account permissions and never expose external interfaces.
                </Typography>
              </Stack>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setStage('framework')}
                sx={{
                  py: 1.15,
                  borderRadius: RADIUS_SMALL,
                  textTransform: 'none',
                  color: '#F4F4F5',
                  borderColor: BORDER_HAIRLINE,
                  fontWeight: 700,
                  transition: BRAND_TRANSITION,
                  '&:hover': { borderColor: '#4F4C49', bgcolor: VOID },
                }}
              >
                Runtime
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                onClick={() => void createAgent()}
                disabled={saving || !agentName.trim() || !user?.$id}
                sx={{
                  py: 1.15,
                  borderRadius: RADIUS_SMALL,
                  textTransform: 'none',
                  fontWeight: 800,
                  bgcolor: SYSTEM_PRIMARY,
                  color: '#FFFFFF',
                  boxShadow: 'none',
                  transition: BRAND_TRANSITION,
                  '&:hover': { bgcolor: SYSTEM_HOVER },
                }}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : 'Ready'}
              </Button>
            </Stack>

            <Button variant="text" onClick={() => setStage('live')} sx={{ alignSelf: 'flex-start', color: TEXT_MUTED, textTransform: 'none', fontWeight: 700 }}>
              Back
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
