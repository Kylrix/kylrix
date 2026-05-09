'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  alpha,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Bot, CalendarClock, Mic, Play, Plug, Sparkles, X } from 'lucide-react';

import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';

type AgentFramework = 'kylrix' | 'openclaw' | 'hermes';

const frameworks: Array<{ id: AgentFramework; title: string; description: string }> = [
  { id: 'kylrix', title: 'Kylrix Internal', description: 'Optimized for workspace-native actions' },
  { id: 'openclaw', title: 'OpenClaw', description: 'External runtime (coming soon)' },
  { id: 'hermes', title: 'Hermes', description: 'External runtime (coming soon)' },
];

const connectorHints = ['Research from this note', 'Create a Flow goal', 'Fetch related vault secrets', 'Draft a Connect post'];

/** Typography: Satoshi UI + Clash Display (Muted V3 — see `.agents/skills/kylrix-muted-v3-design`). */
const fontUi = 'var(--font-satoshi)';
const fontDisplay = 'var(--font-clash)';

/** Bottom chrome parity with `UnifiedBottomBar` + rim token. */
const SURFACE_NAV = '#161412';
const RIM = '1px solid rgba(255, 255, 255, 0.05)';
const CANVAS_VOID = '#0A0908';
const HOVER_LIFT = '#1C1A18';

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        fontFamily: fontUi,
        fontSize: '0.68rem',
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.42)',
        mb: 1.25,
      }}
    >
      {children}
    </Typography>
  );
}

export function AgenticDrawer() {
  const { isOpen, closeAgenticDrawer } = useAgenticDrawer();
  const { openProUpgrade } = useProUpgrade();

  const [stage, setStage] = useState<'live' | 'framework' | 'planner'>('live');
  const [framework, setFramework] = useState<AgentFramework>('kylrix');
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setStage('live');
      setFramework('kylrix');
      setChatInput('');
    }
  }, [isOpen]);

  const suggestedInstructions = useMemo(() => {
    if (!chatInput.trim()) return connectorHints;
    return connectorHints.filter((entry) => entry.toLowerCase().includes(chatInput.toLowerCase())).slice(0, 6);
  }, [chatInput]);

  const openPlannerFromFramework = (id: AgentFramework) => {
    setFramework(id);
    if (id === 'kylrix') {
      setStage('planner');
    }
  };

  const sheetBodySx = {
    fontFamily: fontUi,
    '& .MuiButton-root': { fontFamily: fontUi },
    '& .MuiChip-label': { fontFamily: fontUi },
  } as const;

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={closeAgenticDrawer}
      sx={{
        '& .MuiDrawer-paper': {
          height: 'min(78dvh, 720px)',
          maxHeight: 'min(78dvh, 720px)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          bgcolor: SURFACE_NAV,
          border: RIM,
          borderBottom: 0,
          boxShadow: 'none',
          backgroundImage: 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box sx={{ pt: 'max(8px, env(safe-area-inset-top))' }} />

      {/* Drag affordance */}
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <Box
          sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)' }}
          aria-hidden
        />
      </Box>

      <Box
        sx={{
          px: { xs: 2.75, sm: 3.25 },
          pb: 'max(24px, env(safe-area-inset-bottom))',
          pt: 0,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          ...sheetBodySx,
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha('#6366F1', 0.12),
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <Bot size={22} color="#A5B4FC" strokeWidth={2} />
            </Box>
            <Box sx={{ pt: 0.25 }}>
              <Typography
                sx={{
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '1.05rem',
                  lineHeight: 1.25,
                  fontFamily: fontDisplay,
                  letterSpacing: '-0.03em',
                }}
              >
                Agentic Workspace
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.52)',
                  fontSize: '0.8125rem',
                  fontFamily: fontUi,
                  mt: 0.5,
                  lineHeight: 1.45,
                  maxWidth: 260,
                }}
              >
                Live agents across your ecosystem. Start from a suggestion or type your own task.
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={closeAgenticDrawer}
            aria-label="Close"
            sx={{
              color: 'rgba(255,255,255,0.72)',
              mt: -0.5,
              bgcolor: 'rgba(255,255,255,0.04)',
              border: RIM,
              '&:hover': { bgcolor: HOVER_LIFT },
            }}
          >
            <X size={18} />
          </IconButton>
        </Stack>

        {stage === 'live' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2.75 }}>
            <Box>
              <SectionLabel>Status</SectionLabel>
              <Paper
                elevation={0}
                sx={{
                  p: 2.25,
                  borderRadius: '18px',
                  bgcolor: CANVAS_VOID,
                  border: RIM,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap gap={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Sparkles size={16} color="#A5B4FC" />
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
                      Running agents
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label="1 active"
                    sx={{
                      bgcolor: alpha('#10B981', 0.14),
                      color: '#34D399',
                      fontWeight: 800,
                      fontFamily: fontUi,
                      border: '1px solid rgba(16,185,129,0.25)',
                    }}
                  />
                </Stack>
                <Typography sx={{ color: 'rgba(255,255,255,0.58)', mt: 1.5, fontSize: '0.8125rem', fontFamily: fontUi, lineHeight: 1.55 }}>
                  Kylrix Internal is connected to your workspace and waiting for the next instruction.
                </Typography>
              </Paper>
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <SectionLabel>Suggestions</SectionLabel>
              <Stack
                spacing={1.25}
                sx={{
                  flex: 1,
                  minHeight: 120,
                  maxHeight: { xs: 220, sm: 280 },
                  overflowY: 'auto',
                  pr: 0.5,
                  pb: 0.5,
                }}
              >
                {suggestedInstructions.map((item) => (
                  <Button
                    key={item}
                    fullWidth
                    disableElevation
                    onClick={() => setChatInput(item)}
                    sx={{
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      textTransform: 'none',
                      fontFamily: fontUi,
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: 'rgba(255,255,255,0.9)',
                      py: 1.5,
                      px: 2,
                      minHeight: 48,
                      borderRadius: '14px',
                      border: RIM,
                      bgcolor: CANVAS_VOID,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                      '&:hover': { bgcolor: HOVER_LIFT, borderColor: 'rgba(255,255,255,0.08)' },
                    }}
                  >
                    {item}
                  </Button>
                ))}
              </Stack>
            </Box>

            <Box>
              <SectionLabel>Instruction</SectionLabel>
              <Stack direction="row" spacing={1.25} alignItems="stretch">
                <TextField
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Describe what the agent should do…"
                  size="medium"
                  fullWidth
                  multiline
                  maxRows={3}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '14px',
                      color: '#fff',
                      fontFamily: fontUi,
                      fontSize: '0.9rem',
                      bgcolor: CANVAS_VOID,
                      alignItems: 'flex-start',
                      py: 0.5,
                      '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    },
                    '& .MuiInputBase-input': { fontFamily: fontUi, py: 1.25, px: 0.5 },
                    '& .MuiInputBase-input::placeholder': { opacity: 0.45 },
                  }}
                />
                <IconButton
                  aria-label="Voice input"
                  sx={{
                    alignSelf: 'stretch',
                    width: 52,
                    borderRadius: '14px',
                    flexShrink: 0,
                    bgcolor: alpha('#6366F1', 0.14),
                    color: '#C7D2FE',
                    border: '1px solid rgba(99,102,241,0.28)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                    '&:hover': { bgcolor: alpha('#6366F1', 0.22) },
                  }}
                >
                  <Mic size={20} />
                </IconButton>
              </Stack>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setStage('framework')}
                sx={{
                  py: 1.35,
                  borderRadius: '14px',
                  textTransform: 'none',
                  color: 'rgba(255,255,255,0.88)',
                  borderColor: 'rgba(255,255,255,0.14)',
                  fontWeight: 700,
                  '&:hover': { borderColor: 'rgba(255,255,255,0.22)', bgcolor: 'rgba(255,255,255,0.03)' },
                }}
              >
                Framework
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                startIcon={<Play size={18} />}
                sx={{
                  py: 1.35,
                  borderRadius: '14px',
                  textTransform: 'none',
                  fontWeight: 800,
                  bgcolor: '#6366F1',
                  color: '#fff',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: alpha('#6366F1', 0.92) },
                }}
              >
                Execute
              </Button>
            </Stack>
          </Box>
        )}

        {stage === 'framework' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SectionLabel>Runtime</SectionLabel>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem', fontFamily: fontDisplay, letterSpacing: '-0.02em', mb: -0.5 }}>
              Choose framework
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8125rem', fontFamily: fontUi, lineHeight: 1.5 }}>
              Kylrix Internal is ready today; external runtimes are listed for visibility.
            </Typography>

            <Stack spacing={1.75} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5, pb: 1 }}>
              {frameworks.map((item) => {
                const selected = item.id === framework;
                const disabled = item.id !== 'kylrix';
                return (
                  <Paper
                    key={item.id}
                    elevation={0}
                    onClick={() => !disabled && openPlannerFromFramework(item.id)}
                    sx={{
                      p: 2.5,
                      borderRadius: '18px',
                      bgcolor: selected ? alpha('#6366F1', 0.1) : CANVAS_VOID,
                      border: selected ? '1px solid rgba(99,102,241,0.35)' : RIM,
                      cursor: disabled ? 'default' : 'pointer',
                      opacity: disabled ? 0.55 : 1,
                      transition: 'background-color 0.2s ease, border-color 0.2s ease',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                      '&:hover': disabled
                        ? undefined
                        : {
                            bgcolor: selected ? alpha('#6366F1', 0.14) : HOVER_LIFT,
                            borderColor: selected ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.08)',
                          },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                      <Box>
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
                          {item.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.58)', mt: 1, fontSize: '0.8125rem', fontFamily: fontUi, lineHeight: 1.5 }}>
                          {item.description}
                        </Typography>
                      </Box>
                      {item.id !== 'kylrix' && (
                        <Chip label="Soon" size="small" sx={{ fontFamily: fontUi, fontWeight: 800, bgcolor: 'rgba(255,255,255,0.06)' }} />
                      )}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>

            <Button
              variant="text"
              onClick={() => setStage('live')}
              sx={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.65)', textTransform: 'none', fontWeight: 700, py: 1 }}
            >
              ← Back to workspace
            </Button>
          </Box>
        )}

        {stage === 'planner' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SectionLabel>Planner</SectionLabel>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
              Kylrix Internal
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8125rem', fontFamily: fontUi, lineHeight: 1.5 }}>
              Wire connectors for this run. Save when you are ready to reuse the setup.
            </Typography>

            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: '18px',
                bgcolor: CANVAS_VOID,
                border: RIM,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
              }}
            >
              <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8125rem', fontFamily: fontUi, mb: 2, lineHeight: 1.5 }}>
                Connectors available for this workspace:
              </Typography>
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1.25}>
                {['Note', 'Flow', 'Vault', 'Connect'].map((connector) => (
                  <Chip
                    key={connector}
                    icon={<Plug size={14} />}
                    label={connector}
                    sx={{
                      color: 'rgba(255,255,255,0.9)',
                      bgcolor: HOVER_LIFT,
                      fontFamily: fontUi,
                      fontWeight: 700,
                      border: RIM,
                      height: 40,
                    }}
                  />
                ))}
              </Stack>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CalendarClock size={18} />}
                onClick={() => openProUpgrade('Agent Scheduling')}
                sx={{
                  py: 1.35,
                  borderRadius: '14px',
                  textTransform: 'none',
                  color: 'rgba(255,255,255,0.88)',
                  borderColor: 'rgba(255,255,255,0.14)',
                  fontWeight: 700,
                }}
              >
                Schedule (Pro)
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
                sx={{
                  py: 1.35,
                  borderRadius: '14px',
                  textTransform: 'none',
                  fontWeight: 800,
                  bgcolor: '#6366F1',
                  color: '#fff',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: alpha('#6366F1', 0.92) },
                }}
              >
                Save agent
              </Button>
            </Stack>

            <Button variant="text" onClick={() => setStage('framework')} sx={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.65)', textTransform: 'none', fontWeight: 700 }}>
              ← Back to frameworks
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
