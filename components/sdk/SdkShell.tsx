 'use client';

import React from 'react';
import { alpha, Box, ButtonBase, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { ChevronRight } from 'lucide-react';

import Logo from '@/components/Logo';
import type { SdkSection } from './catalog';

interface SdkShellProps {
  sections: SdkSection[];
  activeSection: string;
  onSelectSection: (id: string) => void;
  children: React.ReactNode;
}

function SectionButton({
  section,
  active,
  onClick,
  compact = false,
}: {
  section: SdkSection;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = section.icon;

  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        flex: compact ? '0 0 auto' : '0 0 100%',
        width: compact ? 'auto' : '100%',
        borderRadius: compact ? 999 : 4,
        textAlign: 'left',
      }}
    >
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={0.7}
        sx={{
          minWidth: compact ? 72 : '100%',
          px: compact ? 1.5 : 1.5,
          py: compact ? 1.1 : 1.3,
          borderRadius: compact ? 999 : 4,
          bgcolor: active ? alpha(section.accent, 0.12) : 'rgba(255,255,255,0.02)',
          border: '1px solid',
          borderColor: active ? alpha(section.accent, 0.24) : 'rgba(255,255,255,0.06)',
          transition: 'all 160ms ease',
          '&:hover': {
            bgcolor: alpha(section.accent, 0.08),
          },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: 28,
            height: 28,
            borderRadius: 999,
            color: active ? section.accent : 'rgba(255,255,255,0.82)',
          }}
        >
          <Icon size={18} />
        </Box>
        <Box sx={{ minWidth: 0, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.08em', lineHeight: 1 }}>
            {section.title}
          </Typography>
          {!compact ? (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.54)', display: 'block', mt: 0.35, lineHeight: 1.2 }}>
              {section.summary}
            </Typography>
          ) : null}
        </Box>
        {!compact ? <ChevronRight size={14} color={active ? section.accent : 'rgba(255,255,255,0.35)'} /> : null}
      </Stack>
    </ButtonBase>
  );
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
            width: 300,
            p: 2,
            borderRadius: 5,
            bgcolor: 'rgba(22, 20, 18, 0.96)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
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

            <Stack spacing={1}>
              {sections.map((section) => (
                <SectionButton
                  key={section.id}
                  section={section}
                  active={activeSection === section.id}
                  onClick={() => onSelectSection(section.id)}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
      </Stack>

      {isMobile ? (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            px: 1.25,
            pb: 'calc(env(safe-area-inset-bottom) + 10px)',
            zIndex: (value) => value.zIndex.appBar + 2,
          }}
        >
          <Paper
            sx={{
              borderRadius: '22px 22px 0 0',
              bgcolor: 'rgba(22, 20, 18, 0.98)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.38)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                overflowX: 'auto',
                px: 1,
                py: 1.1,
                '&::-webkit-scrollbar': { height: 6 },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.14)', borderRadius: 999 },
              }}
            >
              {sections.map((section) => (
                <SectionButton
                  key={section.id}
                  section={section}
                  active={activeSection === section.id}
                  onClick={() => onSelectSection(section.id)}
                  compact
                />
              ))}
            </Box>
          </Paper>
        </Box>
      ) : null}
    </Box>
  );
}
