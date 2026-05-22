'use client';

import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';

const steps = [
  {
    tool: 'Cursor',
    items: [
      'Open your project in Cursor.',
      'Create `.agents/skills/kylrix/SKILL.md`.',
      'Paste the Kylrix skill content and save.',
      'Ask the agent to use `kylrix-muted-v3-design`.'],
  },
  {
    tool: 'OpenClaw',
    items: [
      'Open your project workspace.',
      'Add `SKILL.md` inside your agent skills folder.',
      'Paste the same Kylrix skill content.',
      'Enable the skill in your session.'],
  }];

export default function SkillInstallPage() {
  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#FFFFFF', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="md">
        <Stack spacing={3.5}>
          <Stack spacing={1.25}>
            <Typography
              component="h1"
              sx={{
                fontFamily: 'var(--font-clash)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.02,
                fontSize: { xs: '2.1rem', sm: '2.8rem' },
              }}
            >
              Install Kylrix Agent Skill
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-satoshi)', color: '#9B9691', fontSize: '1rem', lineHeight: 1.6 }}>
              Pick your tool, follow 4 quick steps, then run Kylrix with the same design and security language.
            </Typography>
          </Stack>

          <Paper sx={{ p: 2.25, borderRadius: '18px', bgcolor: '#161412', border: '1px solid #34322F' }}>
            <Stack spacing={1.1}>
              <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, fontSize: '1rem' }}>
                Skill Source
              </Typography>
              <Typography sx={{ fontFamily: 'var(--font-satoshi)', color: '#C7C2BC', fontSize: '0.92rem' }}>
                Use: `kylrix/.agents/skills/kylrix-muted-v3-design/SKILL.md`
              </Typography>
            </Stack>
          </Paper>

          <Stack spacing={2}>
            {steps.map((section) => (
              <Paper key={section.tool} sx={{ p: 2.5, borderRadius: '18px', bgcolor: '#161412', border: '1px solid #34322F' }}>
                <Stack spacing={1.4}>
                  <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, fontSize: '1.05rem' }}>{section.tool}</Typography>
                  {section.items.map((item) => (
                    <Stack key={item} direction="row" spacing={1.2} alignItems="center">
                      <CheckCircle2 size={16} color="#6366F1" />
                      <Typography sx={{ fontFamily: 'var(--font-satoshi)', color: '#E7E5E3', fontSize: '0.95rem' }}>{item}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <Button component={Link} href="/" variant="contained" startIcon={<ExternalLink size={16} />} sx={{ bgcolor: '#6366F1', borderRadius: '12px', textTransform: 'none', fontWeight: 800 }}>
              Back to Landing
            </Button>
            <Button component={Link} href="/docs" variant="outlined" sx={{ borderColor: '#34322F', color: '#FFFFFF', borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}>
              Read Docs
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
