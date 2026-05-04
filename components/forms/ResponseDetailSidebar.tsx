'use client';

import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Drawer,
  Stack,
  Divider,
  Chip,
  Paper,
  alpha
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowBack as BackIcon,
  Event as TimeIcon,
  Person as UserIcon,
  Flag as FlagIcon,
  ContentPaste as DataIcon
} from '@mui/icons-material';

interface ResponseDetailSidebarProps {
  open: boolean;
  onClose: () => void;
  submission: any | null;
  schemaMap?: Record<string, string>;
}

export default function ResponseDetailSidebar({ open, onClose, submission, schemaMap }: ResponseDetailSidebarProps) {
  if (!submission) return null;

  let data = {};
  try {
    data = JSON.parse(submission.payload);
  } catch (_e) {
    data = { raw: submission.payload };
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 480 },
          bgcolor: '#000000',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
          p: 0,
          boxShadow: '-20px 0 50px rgba(0,0,0,0.5)',
          marginTop: { xs: '64px', sm: '64px' },
          height: 'calc(100% - 64px)',
        }
      }}
    >
      {/* Header */}
      <Box sx={{ 
        p: 3, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'linear-gradient(to bottom, rgba(99, 102, 241, 0.05), transparent)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton 
            onClick={onClose} 
            size="small"
            sx={{ 
              bgcolor: 'rgba(99, 102, 241, 0.15)',
              color: '#6366F1',
              '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.25)' }
            }}
          >
            <BackIcon fontSize="small" />
          </IconButton>
          <Box sx={{ 
            width: 40, 
            height: 40, 
            borderRadius: 2, 
            bgcolor: alpha('#6366F1', 0.1), 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#6366F1',
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}>
            <DataIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em' }}>Response Detail</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              ID: {submission.$id.slice(-8)}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} sx={{ bgcolor: 'rgba(255,255,255,0.03)', color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

      {/* Metadata */}
      <Box sx={{ p: 3 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, mb: 1, display: 'block', letterSpacing: '0.1em' }}>METADATA</Typography>
            <Stack spacing={1.5}>
              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <TimeIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, display: 'block' }}>Submitted At</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{new Date(submission.$createdAt).toLocaleString()}</Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <UserIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800, display: 'block' }}>Submitter</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{submission.submitterName || 'Anonymous User'}</Typography>
                  </Box>
                </Stack>
              </Paper>

              {submission.flagged && (
                <Chip 
                  icon={<FlagIcon sx={{ fontSize: '14px !important' }} />}
                  label="Important / Flagged" 
                  sx={{ 
                    bgcolor: alpha('#FFB020', 0.1), 
                    color: '#FFB020', 
                    fontWeight: 800, 
                    borderRadius: 2,
                    alignSelf: 'flex-start',
                    px: 1
                  }} 
                />
              )}
            </Stack>
          </Box>

          {/* Form Data */}
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, mb: 1, display: 'block', letterSpacing: '0.1em' }}>RESPONSE DATA</Typography>
            <Stack spacing={2}>
              {Object.entries(data).map(([key, value]: [string, any]) => (
                <Box key={key}>
                     <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 800, mb: 0.5, textTransform: 'capitalize' }}>
                     {schemaMap?.[key] || key.split(/(?=[A-Z])/).join(' ').replace(/_/g, ' ') || 'Field'}
                   </Typography>
                  <Paper sx={{ 
                    p: 2, 
                    borderRadius: 3, 
                    bgcolor: '#161514', 
                    border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      bgcolor: 'rgba(99, 102, 241, 0.05)'
                    }
                  }}>
                    {Array.isArray(value) ? (
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {value.map((v, i) => (
                          <Chip key={i} label={String(v)} size="small" sx={{ fontWeight: 800, bgcolor: 'rgba(255,255,255,0.05)' }} />
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body1" sx={{ fontWeight: 700, color: '#F2F2F2' }}>
                        {String(value)}
                      </Typography>
                    )}
                  </Paper>
                </Box>
              ))}
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* Footer / Raw JSON */}
      <Box sx={{ mt: 'auto', p: 3, bgcolor: '#000000', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 900, mb: 2, display: 'block', letterSpacing: '0.1em' }}>RAW TELEMETRY</Typography>
        <Box component="pre" sx={{ 
          p: 2, 
          borderRadius: 2, 
          bgcolor: '#161514', 
          color: alpha('#6366F1', 0.8),
          fontSize: '0.7rem', 
          overflow: 'auto', 
          maxHeight: 150,
          fontFamily: 'var(--font-jetbrains)',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          {JSON.stringify(data, null, 2)}
        </Box>
      </Box>
    </Drawer>
  );
}
