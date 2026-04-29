'use client';

import React from 'react';
import { alpha, Box, Button, ButtonBase, Divider, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { ChevronRight, ExternalLink } from 'lucide-react';

import Logo from '@/components/Logo';
import type { SdkSectionNav } from './catalog';

interface SdkShellProps {
  sections: SdkSectionNav[];
  activeSection: string;
  onSelectSection: (id: string) => void;
  children: React.ReactNode;
}

export default function SdkShell({ sections, activeSection, onSelectSection, children }: SdkShellProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <Box component="main" sx={{ pt: { xs: 10, md: 12 }, pb: { xs: 18, md: 12 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ px: { xs: 2, md: 3 } }}>
        <Paper
          sx={{
            display: { xs: 'none', md: 'block' },
            position: 'sticky',
            top: 112,
            alignSelf: 'flex-start',
            width: 320,
            p: 2,
            borderRadius: 5,
            bgcolor: 'var(--surface)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: 'none',
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
              <Stack spacing={0.3}>
                <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.2em' }}>
                  SDK DEMO
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Local mirror
                </Typography>
              </Stack>
              <Logo app="root" size={34} variant="icon" />
            </Stack>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Stack spacing={1}>
              {sections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <ButtonBase
                    key={section.id}
                    onClick={() => onSelectSection(section.id)}
                    sx={{
                      width: '100%',
                      borderRadius: 3,
                      textAlign: 'left',
                    }}
                  >
                    <Stack
                      direction="row"
                      alignItems="center"
                      spacing={1.5}
                      sx={{
                        width: '100%',
                        p: 1.5,
                        borderRadius: 3,
                        bgcolor: isActive ? alpha(section.accent, 0.1) : 'transparent',
                        border: '1px solid',
                        borderColor: isActive ? alpha(section.accent, 0.22) : 'transparent',
                        transition: 'all 160ms ease',
                        '&:hover': {
                          bgcolor: alpha(section.accent, 0.08),
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '999px',
                          bgcolor: section.accent,
                          boxShadow: `0 0 18px ${alpha(section.accent, 0.38)}`,
                          flex: '0 0 auto',
                        }}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>
                          {section.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                          {section.summary}
                        </Typography>
                      </Box>
                      <ChevronRight size={15} color={isActive ? section.accent : 'rgba(255,255,255,0.4)'} />
                    </Stack>
                  </ButtonBase>
                );
              })}
            </Stack>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Stack spacing={1.2}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.16em' }}>
                SOURCE MAP
              </Typography>
              <Button
                component="a"
                href={sections.find((section) => section.id === activeSection)?.sourceHref || sections[0]?.sourceHref || '/sdk'}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                sx={{ borderRadius: 3, textAlign: 'left', justifyContent: 'flex-start', px: 1.5 }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1.5}
                  sx={{
                    width: '100%',
                    p: 1.5,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Stack spacing={0.3} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>
                      Open source location
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)', wordBreak: 'break-all' }}>
                      {sections.find((section) => section.id === activeSection)?.sourceHref || ''}
                    </Typography>
                  </Stack>
                  <ExternalLink size={15} color="#6366F1" />
                </Stack>
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      </Stack>

      {!isMobile ? null : (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: (theme) => theme.zIndex.appBar + 1,
            px: 1.5,
            pb: 1.5,
          }}
        >
          <Paper
            sx={{
              borderRadius: 5,
              bgcolor: 'rgba(16, 14, 12, 0.96)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
              overflow: 'hidden',
            }}
          >
            <Stack spacing={1} sx={{ p: 1.2 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em', px: 0.8 }}>
                SDK PATHS
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  overflowX: 'auto',
                  pb: 0.4,
                  pr: 0.5,
                  '&::-webkit-scrollbar': { height: 6 },
                  '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.14)', borderRadius: 999 },
                }}
              >
                {sections.map((section) => {
                  const isActive = activeSection === section.id;
                  return (
                    <ButtonBase
                      key={section.id}
                      onClick={() => onSelectSection(section.id)}
                      sx={{
                        flex: '0 0 auto',
                        borderRadius: 999,
                        px: 1.4,
                        py: 1,
                        minHeight: 42,
                        bgcolor: isActive ? alpha(section.accent, 0.14) : 'rgba(255,255,255,0.03)',
                        border: '1px solid',
                        borderColor: isActive ? alpha(section.accent, 0.24) : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: section.accent }} />
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.08em' }}>
                          {section.title}
                        </Typography>
                      </Stack>
                    </ButtonBase>
                  );
                })}
              </Box>
            </Stack>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
