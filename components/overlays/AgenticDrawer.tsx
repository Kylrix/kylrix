'use client';

import { useMemo, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Chip,
  Divider,
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

const frameworks: Array<{ id: AgentFramework; title: string; description: string }> = [
  { id: 'kylrix', title: 'Kylrix Internal', description: 'Optimized for workspace-native actions' },
  { id: 'openclaw', title: 'OpenClaw', description: 'External runtime (coming soon)' },
  { id: 'hermes', title: 'Hermes', description: 'External runtime (coming soon)' },
];

const connectorHints = ['Research from this note', 'Create a Flow goal', 'Fetch related vault secrets', 'Draft a Connect post'];

export function AgenticDrawer() {
  const { isOpen, closeAgenticDrawer } = useAgenticDrawer();
  const { openProUpgrade } = useProUpgrade();

  const [stage, setStage] = useState<'live' | 'framework' | 'planner'>('live');
  const [framework, setFramework] = useState<AgentFramework>('kylrix');
  const [chatInput, setChatInput] = useState('');

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

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={closeAgenticDrawer}
      sx={{
        '& .MuiDrawer-paper': {
          height: '60vh',
          maxHeight: '60vh',
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          bgcolor: '#161412',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderBottom: 0,
          boxShadow: 'none',
          backgroundImage: 'none',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ p: { xs: 2, md: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '12px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha('#6366F1', 0.14),
                border: '1px solid rgba(99,102,241,0.4)',
              }}
            >
              <Bot size={18} color="#A5B4FC" />
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '0.95rem' }}>Agentic Workspace</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.58)', fontSize: '0.78rem' }}>Live agents and orchestration</Typography>
            </Box>
          </Stack>
          <IconButton onClick={closeAgenticDrawer} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            <X size={18} />
          </IconButton>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mb: 1.75 }} />

        {stage === 'live' && (
          <Stack spacing={1.5} sx={{ minHeight: 0, flex: 1 }}>
            <Paper sx={{ p: 1.25, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.82rem' }}>Running Agents</Typography>
                <Chip size="small" label="1 Active" sx={{ bgcolor: alpha('#10B981', 0.15), color: '#10B981', fontWeight: 800 }} />
              </Stack>
              <Typography sx={{ color: 'rgba(255,255,255,0.65)', mt: 0.8, fontSize: '0.78rem' }}>
                Kylrix Internal is watching connectors and waiting for your next instruction.
              </Typography>
            </Paper>

            <Paper sx={{ p: 1.25, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.08)', minHeight: 0, flex: 1, overflowY: 'auto' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem' }}>Type an instruction and stream it live:</Typography>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {suggestedInstructions.map((item) => (
                  <Chip key={item} label={item} sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.84)', justifyContent: 'flex-start' }} />
                ))}
              </Stack>
            </Paper>

            <Stack direction="row" spacing={1}>
              <TextField
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Tell agent what to do..."
                size="small"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                  },
                }}
              />
              <IconButton sx={{ borderRadius: '12px', bgcolor: alpha('#6366F1', 0.18), color: '#A5B4FC' }}>
                <Mic size={18} />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setStage('framework')} sx={{ borderRadius: '12px', textTransform: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.16)' }}>
                Framework
              </Button>
              <Button variant="contained" startIcon={<Play size={16} />} sx={{ borderRadius: '12px', textTransform: 'none', bgcolor: '#6366F1' }}>
                Execute
              </Button>
            </Stack>
          </Stack>
        )}

        {stage === 'framework' && (
          <Stack spacing={1.25} sx={{ minHeight: 0, flex: 1, overflowY: 'auto' }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem' }}>Choose Agentic Framework</Typography>
            {frameworks.map((item) => (
              <Paper
                key={item.id}
                onClick={() => openPlannerFromFramework(item.id)}
                sx={{
                  p: 1.5,
                  borderRadius: '14px',
                  bgcolor: item.id === framework ? alpha('#6366F1', 0.12) : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${item.id === framework ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.1)'}`,
                  cursor: 'pointer',
                }}
              >
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.84rem' }}>{item.title}</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.62)', mt: 0.5, fontSize: '0.75rem' }}>{item.description}</Typography>
              </Paper>
            ))}
            <Button variant="text" onClick={() => setStage('live')} sx={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.7)' }}>
              Back
            </Button>
          </Stack>
        )}

        {stage === 'planner' && (
          <Stack spacing={1.25} sx={{ minHeight: 0, flex: 1, overflowY: 'auto' }}>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem' }}>Kylrix Internal Planner</Typography>
            <Paper sx={{ p: 1.5, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem' }}>
                Select connectors and actions to compose your agent run.
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.2 }}>
                {['Note', 'Flow', 'Vault', 'Connect'].map((connector) => (
                  <Chip key={connector} icon={<Plug size={14} />} label={connector} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.06)' }} />
                ))}
              </Stack>
            </Paper>

            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<CalendarClock size={16} />}
                onClick={() => openProUpgrade('Agent Scheduling')}
                sx={{ borderRadius: '12px', textTransform: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.16)' }}
              >
                Schedule (Pro)
              </Button>
              <Button variant="contained" sx={{ borderRadius: '12px', textTransform: 'none', bgcolor: '#6366F1' }}>
                Save Agent
              </Button>
            </Stack>

            <Button variant="text" onClick={() => setStage('framework')} sx={{ alignSelf: 'flex-start', color: 'rgba(255,255,255,0.7)' }}>
              Back
            </Button>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
