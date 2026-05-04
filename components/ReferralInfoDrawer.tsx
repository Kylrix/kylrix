'use client';

import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { Copy, Link as LinkIcon, Users, X } from 'lucide-react';

interface ReferralInfoDrawerProps {
  open: boolean;
  onClose: () => void;
  referralLink: string | null;
  currentUsername: string | null;
  hasReferral: boolean;
  referrerName?: string | null;
  note?: string | null;
  onOpenSettings: () => void;
  onCopyLink: () => void;
}

export function ReferralInfoDrawer({
  open,
  onClose,
  referralLink,
  currentUsername,
  hasReferral,
  referrerName,
  note,
  onOpenSettings,
  onCopyLink,
}: ReferralInfoDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          bgcolor: '#161412',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          backgroundImage: 'none',
          color: 'white',
        },
      }}
    >
      <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
            Referral Setup
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>
            Silent initialization and copyable link state.
          </Typography>
        </Box>
        <Button onClick={onClose} sx={{ minWidth: 'auto', color: 'rgba(255,255,255,0.5)' }}>
          <X size={18} />
        </Button>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

      <Box sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Chip
            label={hasReferral ? 'Referral linked' : 'Referral ready'}
            sx={{
              width: 'fit-content',
              bgcolor: alpha(hasReferral ? '#10B981' : '#6366F1', 0.12),
              color: hasReferral ? '#6EE7B7' : '#C7D2FE',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          />

          {note && (
            <Box sx={{ p: 1.5, borderRadius: '14px', bgcolor: alpha('#6366F1', 0.08), border: '1px solid rgba(99,102,241,0.12)' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.92rem' }}>
                {note}
              </Typography>
            </Box>
          )}

          <Box sx={{ p: 2, borderRadius: '18px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', mb: 1 }}>
              Your link
            </Typography>
            <Typography sx={{ color: 'white', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', mb: 1 }}>
              {referralLink || 'Create your profile username to generate a referral link.'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                onClick={onCopyLink}
                disabled={!referralLink}
                variant="contained"
                startIcon={<Copy size={14} />}
                sx={{
                  bgcolor: '#6366F1',
                  color: '#000',
                  fontWeight: 800,
                  borderRadius: '12px',
                }}
              >
                Copy
              </Button>
              <Button
                onClick={onOpenSettings}
                variant="outlined"
                sx={{
                  borderColor: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  fontWeight: 800,
                  borderRadius: '12px',
                }}
              >
                Open Settings
              </Button>
            </Stack>
          </Box>

          <Box sx={{ p: 2, borderRadius: '18px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.05)' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', mb: 1 }}>
              Status
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LinkIcon size={16} color="#6366F1" />
                <Typography sx={{ color: 'white', fontWeight: 700 }}>
                  {currentUsername ? `@${currentUsername}` : 'No username yet'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Users size={16} color="#10B981" />
                <Typography sx={{ color: 'white', fontWeight: 700 }}>
                  {hasReferral ? `Referred by ${referrerName || 'someone in the ecosystem'}` : 'Referral not yet claimed'}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Drawer>
  );
}
