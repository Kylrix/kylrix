import type { Metadata } from 'next';
import {
  alpha,
  Box,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowRight,
  Lock,
  Shield,
  Sparkles,
  Wallet,
  Waypoints,
  Zap,
} from 'lucide-react';

import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';

export const metadata: Metadata = {
  title: 'Kylrix Pitch — The Sovereign Work OS',
  description:
    'Kylrix is a sovereign work operating system built on E2EE, open source transparency, and a shared session layer across Note, Vault, Flow, and Connect.',
};

const problemCards = [
  {
    title: 'Centralization',
    copy: 'Sensitive work data lives on infrastructure the user does not control, creating lock-in and breach risk.',
  },
  {
    title: 'AI privacy risk',
    copy: 'Modern assistants need data access, but cloud processing turns context into exposure.',
  },
  {
    title: 'Fragmented tools',
    copy: 'Teams bounce between disconnected apps that never behave like one operating system.',
  },
];

const solutionRows = [
  {
    product: 'Kylrix Note',
    target: 'Notion / Google Keep',
    edge: 'E2EE structured knowledge base.',
    accent: '#EC4899',
  },
  {
    product: 'Kylrix Vault',
    target: 'Bitwarden / Ente',
    edge: 'Local-first secrets and asset storage.',
    accent: '#10B981',
  },
  {
    product: 'Kylrix Flow',
    target: 'Google Tasks / Luma',
    edge: 'Privacy-first task orchestration.',
    accent: '#A855F7',
  },
  {
    product: 'Kylrix Connect',
    target: 'Discord / Google Meet',
    edge: 'Zero-knowledge communication.',
    accent: '#F59E0B',
  },
];

const statCards = [
  { label: '2026 ARR target', value: '$400K' },
  { label: 'Scale trigger', value: '$5K-$10K MRR' },
  { label: 'Business model', value: 'Open core + Sovereign Pro' },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        mb: 1.5,
        color: '#6366F1',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '0.2em',
      }}
    >
      {children}
    </Typography>
  );
}

export default function PitchPage() {
  return (
    <Box component="main" sx={{ pt: { xs: 10, md: 12 }, pb: { xs: 10, md: 14 } }}>
      <Navbar />

      <Container maxWidth="xl">
        <Grid container spacing={{ xs: 6, md: 8 }} alignItems="start">
          <Grid size={{ xs: 12, lg: 7 }}>
            <Stack spacing={4}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.75,
                  py: 1,
                  width: 'fit-content',
                  borderRadius: 999,
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Logo app="root" size={24} variant="icon" />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  Investor narrative
                </Typography>
              </Box>

              <Box>
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: '3rem', sm: '4.4rem', lg: '6rem' },
                    lineHeight: 0.94,
                    letterSpacing: '-0.06em',
                    fontWeight: 900,
                    color: '#fff',
                    textWrap: 'balance',
                  }}
                >
                  The Sovereign
                  <Box component="span" sx={{ display: 'block', color: '#6366F1' }}>
                    Work OS
                  </Box>
                </Typography>

                <Typography
                  variant="h6"
                  sx={{
                    mt: 3,
                    maxWidth: 760,
                    color: 'rgba(255, 255, 255, 0.68)',
                    lineHeight: 1.8,
                    fontWeight: 400,
                  }}
                >
                  Kylrix breaks the data-for-utility trade-off by giving users a high-performance ecosystem where
                  they own the data, the session, and the security model.
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button
                  href="/apps"
                  variant="contained"
                  endIcon={<ArrowRight size={18} />}
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 999,
                    bgcolor: '#6366F1',
                    color: '#fff',
                    fontWeight: 800,
                    '&:hover': { bgcolor: '#5254E8' },
                  }}
                >
                  Explore apps
                </Button>
                <Button
                  href="/docs"
                  variant="outlined"
                  sx={{
                    px: 4,
                    py: 1.5,
                    borderRadius: 999,
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontWeight: 800,
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.28)',
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                    },
                  }}
                >
                  Read docs
                </Button>
              </Stack>

              <Grid container spacing={2}>
                {statCards.map((stat) => (
                  <Grid key={stat.label} size={{ xs: 12, sm: 4 }}>
                    <Paper
                      sx={{
                        p: 2.5,
                        borderRadius: 4,
                        bgcolor: 'var(--surface)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          color: '#fff',
                          fontWeight: 900,
                          fontFamily: 'var(--font-mono)',
                          fontVariantNumeric: 'tabular-nums',
                          lineHeight: 1,
                        }}
                      >
                        {stat.value}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          mt: 1,
                          display: 'block',
                          color: 'rgba(255, 255, 255, 0.56)',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {stat.label}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 6,
                bgcolor: 'var(--surface)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(circle at top right, ${alpha('#6366F1', 0.12)}, transparent 38%)`,
                  pointerEvents: 'none',
                }}
              />

              <Stack spacing={3} sx={{ position: 'relative' }}>
                <Box>
                  <SectionLabel>Design philosophy</SectionLabel>
                  <Typography variant="h4" sx={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.04em' }}>
                    Muted Bold
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1.5, color: 'rgba(255, 255, 255, 0.62)', lineHeight: 1.8 }}>
                    Kylrix rejects glassmorphism in favor of a grounded, 3D architectural system built on deep
                    earth surfaces, rim lighting, and focus-first clarity.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 2.5,
                    borderRadius: 4,
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                    <Sparkles size={18} color="#6366F1" />
                    <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 800 }}>
                      Privacy as a power, not a feature
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.62)', lineHeight: 1.8 }}>
                    The product wins by making the secure path the default path — no special mode, no hidden
                    compromise, no second-class UX.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 1.5,
                  }}
                >
                  {[
                    { icon: Shield, label: 'Open source', color: '#6366F1' },
                    { icon: Lock, label: 'E2EE first', color: '#10B981' },
                    { icon: Waypoints, label: 'Shared session', color: '#F59E0B' },
                    { icon: Wallet, label: 'Sovereign Pro', color: '#A855F7' },
                  ].map((item) => (
                    <Box
                      key={item.label}
                      sx={{
                        p: 1.75,
                        borderRadius: 3,
                        bgcolor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                      }}
                    >
                      <item.icon size={18} color={item.color} />
                      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                        {item.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      <Container maxWidth="xl" sx={{ mt: { xs: 8, md: 12 } }}>
        <SectionLabel>Problem</SectionLabel>
        <Typography variant="h2" sx={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.05em', mb: 3 }}>
          The privacy-utility paradox.
        </Typography>
        <Grid container spacing={2.5}>
          {problemCards.map((card) => (
            <Grid key={card.title} size={{ xs: 12, md: 4 }}>
              <Paper
                sx={{
                  p: 3,
                  height: '100%',
                  borderRadius: 5,
                  bgcolor: 'var(--surface)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                  {card.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.64)', lineHeight: 1.8 }}>
                  {card.copy}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Container maxWidth="xl" sx={{ mt: { xs: 8, md: 12 } }}>
        <SectionLabel>Solution</SectionLabel>
        <Typography variant="h2" sx={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.05em', mb: 3 }}>
          The Kylrix triad.
        </Typography>
        <Grid container spacing={2.5}>
          {solutionRows.map((row) => (
            <Grid key={row.product} size={{ xs: 12, md: 6 }}>
              <Paper
                sx={{
                  p: 3,
                  borderRadius: 5,
                  bgcolor: 'var(--surface)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Stack spacing={1.25}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: row.accent,
                      fontWeight: 800,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {row.target}
                  </Typography>
                  <Typography variant="h4" sx={{ color: '#fff', fontWeight: 900 }}>
                    {row.product}
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.66)', lineHeight: 1.8 }}>
                    {row.edge}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Container maxWidth="xl" sx={{ mt: { xs: 8, md: 12 } }}>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 6,
                bgcolor: 'var(--surface)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <SectionLabel>X-factor</SectionLabel>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.04em', mb: 2 }}>
                Agents + Wallet.
              </Typography>
              <Stack spacing={3}>
                <Box>
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                    Kylrix Agents
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.64)', lineHeight: 1.8 }}>
                    Local-first AI can inspect and act across encrypted apps without the context leaving the device.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                    Kylrix Wallet
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.64)', lineHeight: 1.8 }}>
                    A non-custodial financial layer enables autonomous settlement, team payouts, and frictionless
                    payments.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Paper
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 6,
                bgcolor: 'var(--surface)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                height: '100%',
              }}
            >
              <SectionLabel>Business model</SectionLabel>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.04em', mb: 2 }}>
                Open core, sovereign tier.
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.66)', lineHeight: 1.8 }}>
                The base ecosystem stays open source. Revenue comes from Sovereign Pro — advanced agentic features
                and managed encrypted sync for individuals and teams.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      <Container maxWidth="xl" sx={{ mt: { xs: 8, md: 12 } }}>
        <Paper
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 6,
            bgcolor: 'var(--surface)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 8 }}>
              <SectionLabel>Targets</SectionLabel>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.04em', mb: 2 }}>
                Built to scale into a full-time global operation.
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.66)', lineHeight: 1.8, maxWidth: 780 }}>
                The immediate goal is to cross the MRR threshold that justifies team expansion, then grow into the
                broader sovereign productivity market with the core ecosystem as the wedge.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Box
                sx={{
                  height: '100%',
                  p: 3,
                  borderRadius: 4,
                  bgcolor: alpha('#6366F1', 0.08),
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.55)', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 800 }}>
                  Design language
                </Typography>
                <Typography variant="h4" sx={{ mt: 1, color: '#fff', fontWeight: 900 }}>
                  Muted Bold
                </Typography>
                <Typography variant="body2" sx={{ mt: 1.5, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.8 }}>
                  A pitch-black, deep-ash system with premium stability, rim lighting, and no glassmorphism.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
}
