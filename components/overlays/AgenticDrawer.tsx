'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Bot, CalendarClock, Mic, Play, Plug, X } from 'lucide-react';

import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { useProUpgrade } from '@/context/ProUpgradeContext';

type AgentFramework = 'kylrix' | 'openclaw' | 'hermes';

/** Short labels — keep copy density low in the sheet. */
const frameworks: Array<{ id: AgentFramework; title: string }> = [
  { id: 'kylrix', title: 'Kylrix Internal' },
  { id: 'openclaw', title: 'OpenClaw (soon)' },
  { id: 'hermes', title: 'Hermes (soon)' },
];

const connectorHints = ['From this note', 'New Flow goal', 'Vault lookup', 'Connect draft'];

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

const BORDER = `1px solid ${BORDER_EDGE}`;

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
    return connectorHints.filter((entry) => entry.toLowerCase().includes(chatInput.toLowerCase())).slice(0, 4);
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
  } as const;

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={closeAgenticDrawer}
      sx={{
        '& .MuiDrawer-paper': {
          height: 'min(62dvh, 540px)',
          maxHeight: 'min(62dvh, 540px)',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          bgcolor: SURFACE_NAV,
          border: BORDER,
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

      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
        <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: '#3D3A36' }} aria-hidden />
      </Box>

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
                bgcolor: VOID,
                border: BORDER,
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

        {stage === 'live' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexShrink: 0 }}>
              <Typography sx={{ fontFamily: fontUi, fontSize: '0.8125rem', color: TEXT_MUTED, fontWeight: 600 }}>
                Kylrix · idle
              </Typography>
              <Box
                component="span"
                sx={{
                  px: 1.25,
                  py: 0.35,
                  borderRadius: '999px',
                  bgcolor: '#14532D',
                  color: '#DCFCE7',
                  fontFamily: fontUi,
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Active
              </Box>
            </Stack>

            <Stack spacing={1} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.25 }}>
              {suggestedInstructions.map((item) => (
                <Button
                  key={item}
                  fullWidth
                  disableElevation
                  onClick={() => setChatInput(item)}
                  sx={{
                    justifyContent: 'flex-start',
                    textTransform: 'none',
                    fontFamily: fontUi,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: '#F4F4F5',
                    py: 1.25,
                    px: 1.75,
                    minHeight: 44,
                    borderRadius: '12px',
                    border: BORDER,
                    bgcolor: VOID,
                    '&:hover': { bgcolor: HOVER },
                  }}
                >
                  {item}
                </Button>
              ))}
            </Stack>

            <Stack direction="row" spacing={1.25} alignItems="stretch">
              <TextField
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Instruction…"
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    color: '#fff',
                    fontFamily: fontUi,
                    fontSize: '0.875rem',
                    bgcolor: VOID,
                    minHeight: 48,
                    '& fieldset': { borderColor: BORDER_EDGE },
                    '&:hover fieldset': { borderColor: '#4A4744' },
                    '&.Mui-focused fieldset': { borderColor: INDIGO },
                  },
                  '& .MuiInputBase-input': { py: 1.35, px: 0.75 },
                  '& .MuiInputBase-input::placeholder': { color: TEXT_MUTED, opacity: 1 },
                }}
              />
              <IconButton
                aria-label="Voice input"
                sx={{
                  alignSelf: 'stretch',
                  width: 52,
                  borderRadius: '12px',
                  flexShrink: 0,
                  bgcolor: INDIGO,
                  color: '#FFFFFF',
                  border: `1px solid ${INDIGO}`,
                  '&:hover': { bgcolor: INDIGO_HOVER, borderColor: INDIGO_HOVER },
                }}
              >
                <Mic size={20} strokeWidth={2.25} />
              </IconButton>
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
                startIcon={<Play size={18} />}
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
                Run
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
                const disabled = item.id !== 'kylrix';
                return (
                  <Paper
                    key={item.id}
                    elevation={0}
                    onClick={() => !disabled && openPlannerFromFramework(item.id)}
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
                      {item.title}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>

            <Button variant="text" onClick={() => setStage('live')} sx={{ alignSelf: 'flex-start', color: TEXT_MUTED, textTransform: 'none', fontWeight: 700 }}>
              Back
            </Button>
          </Box>
        )}

        {stage === 'planner' && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9375rem', fontFamily: fontDisplay, letterSpacing: '-0.02em' }}>
              Connectors
            </Typography>

            <Paper
              elevation={0}
              sx={{
                p: 1.75,
                borderRadius: '14px',
                bgcolor: VOID,
                border: BORDER,
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
              }}
            >
              <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}>
                {['Note', 'Flow', 'Vault', 'Connect'].map((connector) => (
                  <Box
                    key={connector}
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
                    }}
                  >
                    <Plug size={14} />
                    {connector}
                  </Box>
                ))}
              </Stack>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CalendarClock size={18} />}
                onClick={() => openProUpgrade('Agent Scheduling')}
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
                Schedule (Pro)
              </Button>
              <Button
                fullWidth
                variant="contained"
                disableElevation
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
                Save
              </Button>
            </Stack>

            <Button variant="text" onClick={() => setStage('framework')} sx={{ alignSelf: 'flex-start', color: TEXT_MUTED, textTransform: 'none', fontWeight: 700 }}>
              Back
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
