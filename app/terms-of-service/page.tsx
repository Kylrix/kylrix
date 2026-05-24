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
} from '@mui/material';
import { ArrowLeft, Scale, Terminal, GitFork, AlertTriangle, FileText, CheckCircle } from 'lucide-react';

export default function TermsOfServicePage() {
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
            Terms of Service
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', fontWeight: 500, maxWidth: 600 }}>
            Understanding the terms of our workspace suite, hosted services, and open-source foundation.
          </Typography>
        </Box>

        <Stack spacing={4}>
          {/* Card 1: Free & Open Source */}
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
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #A855F7 0%, #EC4899 100%)' }} />
            
            <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha('#A855F7', 0.08), color: '#A855F7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <GitFork size={22} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                  Open Source & Free-First Design
                </Typography>
                <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Our codebase is entirely open source, and the vast majority of our productive features are completely free. Users are welcome to use, audit, and explore the core workspace tools without charge, enjoying rich features for notes, vault keychains, events, and automation.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Card 2: Hosted Platform Mandate */}
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
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #6366F1 0%, #10B981 100%)' }} />

            <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha('#6366F1', 0.08), color: '#6366F1', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <CheckCircle size={22} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                  Hosted Platform Performance Signals Requirement
                </Typography>
                <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6, mb: 2 }}>
                  To ensure maximum speed, crash detection, and overall system stability, our hosted cloud platform enforces basic, completely anonymized system stability and diagnostic metrics. This functional metric gathering is a non-optional requirement of the provided online service.
                </Typography>
                
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', p: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>
                    Understanding Your Hosting Alternatives:
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    <Stack direction="row" spacing={1.5}>
                      <Terminal size={18} style={{ color: '#818CF8', flexShrink: 0, marginTop: 2 }} />
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        <strong>Hosted Environment:</strong> Ideal for fast setup, automated workflows, and global sync. Anonymized system stability signals are required here so we can actively resolve crashes and support dynamic workflow loads. If this is not suitable for your setup, our hosted platform is not a fit.
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5}>
                      <GitFork size={18} style={{ color: '#10B981', flexShrink: 0, marginTop: 2 }} />
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        <strong>Self-Hosted Liberty:</strong> You have the absolute right to fork our open-source codebase, entirely disable any built-in performance or tracking metrics, and host your own isolated instance. This completely removes external network dependencies and stability signals.
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </Paper>

          {/* Card 3: Limitations of Liability */}
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
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)' }} />

            <Stack direction="row" spacing={2.5} alignItems="flex-start" sx={{ mb: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha('#F59E0B', 0.08), color: '#F59E0B', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <AlertTriangle size={22} />
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
                  Warranty Disclaimer & Liability Limit
                </Typography>
                <Typography sx={{ mt: 1, color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                  Our hosted services and open-source applications are provided entirely "AS IS" and "AS AVAILABLE", without warranties or conditions of any kind. Under no circumstances shall our creators or maintainers be liable for any data loss, service interruption, or workspace inconsistencies resulting from system use, database sync, or workflow failures.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Summary / Core Value Statement */}
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
            <Scale size={28} style={{ color: '#6366F1', marginBottom: 12 }} />
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
              Layered Design Principles
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', maxWidth: 540, mx: 'auto', lineHeight: 1.5 }}>
              By accessing our platform or building on our repository, you agree to these legal conditions, designed to foster a robust ecosystem where privacy is respected, security is high, and developer overhead is minimal.
            </Typography>
          </Paper>
        </Stack>

        <Divider sx={{ my: 6, borderColor: 'rgba(255,255,255,0.06)' }} />

        {/* Small Legal Disclaimer */}
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', fontWeight: 500 }}>
          Last modified: May 2026. This document represents a binding agreement for our hosted cloud services.
        </Typography>
      </Container>
    </Box>
  );
}
