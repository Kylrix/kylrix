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
  { id: 'hermes', title: 'Hermes', comingSoon: true },
];

const fontUi = 'var(--font-satoshi)';
const fontDisplay = 'var(--font-clash)';

/** Opaque solids only — see `design.md` + `.agents/skills/kylrix-muted-v3-design`. */
const SURFACE_NAV = '#161412';
const VOID = '#0A0908';
const HOVER = '#1C1A18';
const BORDER_EDGE = '#34322F';
const TEXT_MUTED = '#9B9691';
const INDIGO = '#6366F1';
const INDIGO_HOVER = '#575CF0';
const EMERALD = '#10B981';
const AMBER = '#F59E0B';

const BORDER = `1px solid ${BORDER_EDGE}`;
const SHELL_SHADOW = '0 -24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)';

function formatUpdatedAgo(value?: string): string {
  if (!value) return 'updated just now';
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
  }, [agentGoal, agentName, fetchAgents, framework, user?.$id]);

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
  }, [fetchAgents, user?.$id]);

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
                borderTopLeftRadius: '24px',
                borderTopRightRadius: 0,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                borderLeft: BORDER,
                borderTop: BORDER,
                borderBottom: 0,
                borderRight: 0,
              }
            : {
                height: 'min(86dvh, 760px)',
                maxHeight: 'min(86dvh, 760px)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                border: BORDER,
                borderBottom: 0,
              }),
          bgcolor: SURFACE_NAV,
          boxShadow: SHELL_SHADOW,
          backgroundImage: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {!isDesktop && (
        <>
          <Box sx={{ pt: 'max(8px, env(safe-area-inset-top))' }} />
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
          </Box>
        </>
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
                borderRadius: '12px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(INDIGO, 0.14),
                border: `1px solid ${alpha(INDIGO, 0.35)}`,
                boxShadow: `0 10px 24px ${alpha(INDIGO, 0.24)}`,
              }}
            >
              <Bot size={20} color="#E0E7FF" strokeWidth={2} />
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
              Agent workspace
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
            p: 1.4,
            borderRadius: '16px',
            bgcolor: '#11100F',
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundImage: `radial-gradient(circle at 8% 0%, ${alpha(INDIGO, 0.18)}, transparent 42%)`,
          }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '999px', bgcolor: runSummary.working > 0 ? AMBER : EMERALD }} />
              <Typography sx={{ color: '#fff', fontSize: '0.8rem', fontWeight: 800 }}>
                {runSummary.total} agents
              </Typography>
            </Stack>
            <Typography sx={{ color: alpha('#fff', 0.62), fontSize: '0.74rem', fontWeight: 700 }}>
              {runSummary.working} working · {runSummary.idle} idle
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
                  color: active ? '#fff' : alpha('#fff', 0.6),
                  bgcolor: active ? alpha(INDIGO, 0.88) : '#100F0E',
                  border: `1px solid ${active ? alpha(INDIGO, 0.95) : 'rgba(255,255,255,0.08)'}`,
                  '&:hover': { bgcolor: active ? INDIGO_HOVER : HOVER },
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
                {parsedAgents.length} agent{parsedAgents.length === 1 ? '' : 's'} · live
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
                New agent
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
                    borderRadius: '16px',
                    bgcolor: VOID,
                    border: BORDER,
                    backgroundImage: `radial-gradient(circle at 0% 0%, ${alpha(INDIGO, 0.14)}, transparent 56%)`,
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.88rem' }}>No agents yet</Typography>
                  <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem', mt: 0.5 }}>
                    Spin up your first Kylrix agent to start automations.
                  </Typography>
                </Paper>
              ) : (
                parsedAgents.map((agent) => (
                  <Paper
                    key={agent.$id}
                    elevation={0}
                    sx={{
                      p: 1.6,
                      borderRadius: '16px',
                      bgcolor: '#0F0E0D',
                      border: `1px solid ${agent.status === 'working' ? alpha(AMBER, 0.44) : 'rgba(255,255,255,0.09)'}`,
                      boxShadow: agent.status === 'working' ? `0 10px 26px ${alpha(AMBER, 0.14)}` : 'none',
                      transition: 'all 180ms ease',
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
                          bgcolor: agent.status === 'working' ? '#1E3A8A' : '#14532D',
                          color: agent.status === 'working' ? '#BFDBFE' : '#DCFCE7',
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
                        sx={{ textTransform: 'none', borderColor: BORDER_EDGE, color: '#F4F4F5', borderRadius: '10px', minHeight: 38 }}
                      >
                        Idle
                      </Button>
                      <Button
                        size="small"
                        fullWidth
                        variant="contained"
                        startIcon={<Play size={14} />}
                        disabled={updatingAgentId === agent.$id || agent.status === 'working'}
                        onClick={() => void runAgentNow(agent)}
                        sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: INDIGO, minHeight: 38, '&:hover': { bgcolor: INDIGO_HOVER } }}
                      >
                        Run
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
                  borderRadius: '12px',
                  textTransform: 'none',
                  color: '#F4F4F5',
                  borderColor: BORDER_EDGE,
                  fontWeight: 700,
                  '&:hover': { borderColor: '#4F4C49', bgcolor: VOID },
                }}
              >
                Framework
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                startIcon={<Plus size={18} />}
                onClick={() => setStage('create')}
                sx={{
                  py: 1.15,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 800,
                  bgcolor: INDIGO,
                  color: '#FFFFFF',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: INDIGO_HOVER },
                }}
              >
                Spin up
              </Button>
            </Stack>
          </Box>
        )}

        {stage === 'framework' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9375rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
              Framework
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
                      borderRadius: '14px',
                      bgcolor: VOID,
                      border: selected ? `2px solid ${INDIGO}` : BORDER,
                      cursor: disabled ? 'default' : 'pointer',
                      '&:hover': disabled
                        ? undefined
                        : {
                            bgcolor: HOVER,
                            borderColor: selected ? INDIGO : BORDER_EDGE,
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
                      {item.title}{item.comingSoon ? ' (coming soon)' : ''}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>

            <Button
              variant="contained"
              onClick={() => setStage('create')}
              disabled={framework !== 'kylrix'}
              sx={{ borderRadius: '10px', minHeight: 40, textTransform: 'none', fontWeight: 700, bgcolor: INDIGO, '&:hover': { bgcolor: INDIGO_HOVER } }}
            >
              Use framework
            </Button>
            <Button variant="text" onClick={() => setStage('live')} sx={{ alignSelf: 'flex-start', color: TEXT_MUTED, textTransform: 'none', fontWeight: 700 }}>
              Back
            </Button>
          </Box>
        )}

        {stage === 'create' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9375rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
              Create agent
            </Typography>

            <Paper
              elevation={0}
              sx={{
                p: 1.75,
                borderRadius: '16px',
                bgcolor: '#100F0E',
                border: '1px solid rgba(255,255,255,0.09)',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                backgroundImage: `radial-gradient(circle at 90% 0%, ${alpha(INDIGO, 0.14)}, transparent 52%)`,
              }}
            >
              <Stack spacing={1.25}>
                <TextField
                  value={agentName}
                  onChange={(event) => setAgentName(event.target.value)}
                  label="Agent name"
                  placeholder="Ops Helper"
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': { bgcolor: HOVER, borderRadius: '12px' },
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
                    bgcolor: HOVER,
                    border: BORDER,
                    color: '#F4F4F5',
                    fontFamily: fontUi,
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    width: 'fit-content',
                  }}
                >
                  <Plug size={14} />
                  Runtime: {framework === 'kylrix' ? 'Kylrix Internal' : framework}
                </Box>
                <Typography sx={{ color: alpha('#fff', 0.48), fontSize: '0.74rem' }}>
                  Agents run with your internal account permissions and never expose external API surfaces.
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
                  borderRadius: '12px',
                  textTransform: 'none',
                  color: '#F4F4F5',
                  borderColor: BORDER_EDGE,
                  fontWeight: 700,
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
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 800,
                  bgcolor: INDIGO,
                  color: '#FFFFFF',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: INDIGO_HOVER },
                }}
              >
                {saving ? <CircularProgress size={18} color="inherit" /> : 'Create'}
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
