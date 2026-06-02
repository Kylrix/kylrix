'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Stack,
  IconButton,
  Paper,
  Button,
  alpha,
  Divider,
} from '@/lib/mui-tailwind/material';
import { ArrowLeft, Shield, Eye, EyeOff, UserCheck, Server, Activity } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', py: 4 }}>
      <Container maxWidth="md">
        {/* Navigation */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
          <IconButton
            onClick={() => router.push('/')}
            sx={{
              bgcolor: '#161412',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: '#1C1A18' },
            }}
          >
            <ArrowLeft size={18} />
          </IconButton>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            System Integrity & Legal
          </Typography>
        </Stack>

        {/* Title */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1.1, letterSpacing: '-0.03em', mb: 2 }}>
            Privacy Policy
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', fontWeight: 500, maxWidth: 600 }}>
            Our foundational commitment is simple: keep your context secure, private, and entirely under your command.
          </Typography>
        </Box>

        <Stack spacing={4}>
          {/* Card 1: Username Only */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: '24px',
              bgcolor: '#141312',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #EC4899 0%, #F59E0B 100%)' }} />
            
            <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha('#EC4899', 0.08), color: '#EC4899', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <UserCheck size={22} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                  Username-Only Architecture
                </Typography>
                <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Our system relies entirely on customizable usernames for sharing and collaboration. We do not require, collect, or display email addresses or phone numbers for social connections. Users never have to see or expose private personal details to interact within the workspace.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Card 2: Anonymized Stability Metrics */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: '24px',
              bgcolor: '#141312',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6366F1 0%, #A855F7 100%)' }} />

            <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha('#6366F1', 0.08), color: '#6366F1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Activity size={22} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                  Anonymized Diagnostics & Stability Metrics
                </Typography>
                <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6, mb: 2 }}>
                  We collect completely anonymized performance signals to detect software bug crashes and analyze workspace user flows. This data is strictly functional, stripped of identifying details, and processed solely to diagnose issues, improve the suite&apos;s performance, and fix software errors.
                </Typography>
                
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', p: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>
                    Understanding Your Performance Controls:
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={1.5}>
                      <Eye size={18} style={{ color: '#10B981', flexShrink: 0, marginTop: 2 }} />
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        <strong>Context Engine Controls:</strong> You can toggle or turn off your workspace context recording at any time in Settings. However, because automated action sequences rely heavily on contextual tracing, disabling this option will remove the ability to record, play back, or share Smart Action Workflows.
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5}>
                      <EyeOff size={18} style={{ color: '#F59E0B', flexShrink: 0, marginTop: 2 }} />
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        <strong>System Analytics:</strong> Core performance metrics and crash signals cannot be disabled on our hosted environment. If you want absolute, complete stability signal exclusion, you are encouraged to leverage the open-source codebase to self-host your own completely isolated instance.
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </Paper>

          {/* Card 3: Open Source & Self Hosting */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: '24px',
              bgcolor: '#141312',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #10B981 0%, #3B82F6 100%)' }} />

            <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha('#10B981', 0.08), color: '#10B981', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Server size={22} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                  Self-Hosting and Transparency
                </Typography>
                <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Our software is entirely open-source and free for almost all workspace features. We are transparent about how our features operate. You are fully welcome and encouraged to fork the codebase, review the algorithms, and host it independently on your own servers to control every single byte of data.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Summary/Footer Quote */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: '24px',
              bgcolor: 'rgba(99, 102, 241, 0.02)',
              border: '1px dashed rgba(99, 102, 241, 0.15)',
              textAlign: 'center',
            }}
          >
            <Shield size={28} style={{ color: '#6366F1', marginBottom: 12 }} />
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
              Hosted Environment Mandate
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', maxWidth: 540, mx: 'auto', lineHeight: 1.5 }}>
              By choosing to use our premium hosted cloud platform, you consent to our secure, completely anonymized system stability and diagnostic metrics. If your workflow requires zero metrics transmitting outside your network, our self-hosted build is the ideal path for you.
            </Typography>
          </Paper>
        </Stack>

        <Divider sx={{ my: 6, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Small Legal Disclaimer */}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', fontWeight: 500 }}>
          Last modified: May 2026. This policy reflects our steadfast commitment to privacy, data transparency, and layman-first standards.
        </Typography>
      </Container>
    </Box>
  );
}
