'use client';

import React from 'react';
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
} from '@mui/material';
import {
  ArrowRight,
  FolderKanban,
  FileText,
  CheckSquare,
  Lock,
  MessageCircle,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import ProjectsActionFab from '@/components/projects/ProjectsActionFab';

const pillars = [
  {
    title: 'Notes',
    description: 'Capture the project itself, specs, decisions, and linked context.',
    href: '/note/notes',
    icon: FileText,
    accent: '#EC4899',
  },
  {
    title: 'Flow',
    description: 'Track tasks, forms, and execution without splitting the work into another silo.',
    href: '/flow',
    icon: CheckSquare,
    accent: '#A855F7',
  },
  {
    title: 'Vault',
    description: 'Keep secrets, credentials, and sensitive links close to the project surface.',
    href: '/vault/dashboard',
    icon: Lock,
    accent: '#10B981',
  },
  {
    title: 'Connect',
    description: 'Tie calls, chats, and live collaboration into the same ecosystem layer.',
    href: '/connect',
    icon: MessageCircle,
    accent: '#F59E0B',
  },
];

export default function ProjectsPage() {
  const router = useRouter();

  return (
    <Box sx={{ maxWidth: 1240, mx: 'auto', px: { xs: 2, md: 3 }, pb: { xs: 10, md: 6 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2.5 }}>
        <IconButton
          onClick={() => router.back()}
          sx={{
            bgcolor: '#161412',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.06)',
            '&:hover': { bgcolor: '#1C1A18' },
          }}
        >
          <ArrowLeft size={18} />
        </IconButton>
        <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>
          Back
        </Typography>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          bgcolor: '#161412',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '32px',
          p: { xs: 2.5, md: 4 },
          mb: 3,
          backgroundImage: 'none',
        }}
      >
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 46,
                height: 46,
                borderRadius: '16px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: '#0A0908',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#F3F4F6',
              }}
            >
              <FolderKanban size={22} />
            </Box>
            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, letterSpacing: '0.16em', fontWeight: 800 }}>
                E R C O S Y S T E M
              </Typography>
              <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: { xs: '2rem', md: '2.6rem' }, lineHeight: 1.05 }}>
                Projects
              </Typography>
            </Box>
          </Stack>

          <Typography sx={{ color: 'rgba(255,255,255,0.7)', maxWidth: 760, fontSize: 16, lineHeight: 1.7 }}>
            Projects are the integration layer: a single surface where notes, tasks, vault data, and live conversations stay tied together without turning into a separate product.
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              variant="contained"
              startIcon={<Sparkles size={16} />}
              onClick={() => router.push('/note/notes')}
              sx={{ borderRadius: '14px', textTransform: 'none', fontWeight: 800, bgcolor: '#6366F1' }}
            >
              Open notes
            </Button>
            <Button
              variant="outlined"
              endIcon={<ArrowRight size={16} />}
              onClick={() => router.push('/connect')}
              sx={{
                borderRadius: '14px',
                textTransform: 'none',
                fontWeight: 800,
                borderColor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              Go to connect
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label="Notes" sx={{ bgcolor: '#1C1A18', color: '#fff' }} />
            <Chip label="Flow" sx={{ bgcolor: '#1C1A18', color: '#fff' }} />
            <Chip label="Vault" sx={{ bgcolor: '#1C1A18', color: '#fff' }} />
            <Chip label="Connect" sx={{ bgcolor: '#1C1A18', color: '#fff' }} />
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2.5}>
        {pillars.map(({ title, description, href, icon: Icon, accent }) => (
          <Grid key={title} item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                bgcolor: '#161412',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '28px',
                p: 3,
                height: '100%',
                backgroundImage: 'none',
              }}
            >
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '14px', display: 'grid', placeItems: 'center', bgcolor: '#0A0908', color: accent, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Icon size={20} />
                  </Box>
                  <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>{title}</Typography>
                </Box>

                <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.7 }}>{description}</Typography>

                <Button
                  variant="text"
                  endIcon={<ArrowRight size={16} />}
                  onClick={() => router.push(href)}
                  sx={{ alignSelf: 'flex-start', px: 0, color: '#fff', textTransform: 'none', fontWeight: 800 }}
                >
                  Open {title.toLowerCase()}
                </Button>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <ProjectsActionFab />
    </Box>
  );
}
