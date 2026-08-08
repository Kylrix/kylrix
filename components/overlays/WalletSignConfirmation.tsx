'use client';
import React from 'react';
import { Box, Typography, Stack, Button, Divider, Paper, CircularProgress } from '@/lib/openbricks/primitives';
import { WALLET_SURFACE as SURFACE, WALLET_HIGHLIGHT as HIGHLIGHT, WALLET_EDGE as EDGE, WALLET_MUTED as MUTED, WALLET_ACCENT as ACCENT } from './wallet-theme';

export function WalletSignConfirmation(props: {
  signDestination: string;
  signMessageText: string;
  signConfirmLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { signDestination, signMessageText, signConfirmLoading, onCancel, onConfirm } = props;
  return (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: SURFACE }}>
            <Stack gap={2.5} sx={{ flex: 1, overflowY: 'auto', px: 3, pt: 2, pb: 3, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: '#2A2825', borderRadius: '10px' } }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 2 }}>
                    Signature Request
                </Typography>
                <Paper sx={{ px: 2.25, py: 1.5, borderRadius: '18px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}`, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                    <Typography component="span" sx={{ color: MUTED, fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'var(--font-satoshi)' }}>
                        Origin / Invoker
                    </Typography>
                    <Typography component="span" sx={{ color: 'white', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'var(--font-satoshi)', lineHeight: 1.25 }}>
                        {signDestination || 'Kylrix Ecosystem Platform'}
                    </Typography>
                </Paper>

                <Paper sx={{ px: 2.25, py: 1.5, borderRadius: '18px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}`, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography component="span" sx={{ color: MUTED, fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'var(--font-satoshi)' }}>
                        Message to Sign
                    </Typography>
                    <Box sx={{
                        bgcolor: '#0B0A09',
                        p: 2.25,
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.03)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.78rem',
                        color: 'white',
                        whiteSpace: 'pre-wrap',
                        textAlign: 'left',
                        lineHeight: 1.4
                    }}>
                        {signMessageText}
                    </Box>
                </Paper>

                <Box sx={{ px: 2.25, py: 1.5, borderRadius: '18px', bgcolor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                    <Typography component="span" sx={{ color: '#ef4444', fontWeight: 800, fontSize: '0.78rem', fontFamily: 'var(--font-satoshi)' }}>
                        Security Risk Acknowledgment
                    </Typography>
                    <Typography component="span" sx={{ color: MUTED, fontSize: '0.72rem', lineHeight: 1.45, fontFamily: 'var(--font-satoshi)' }}>
                        For your privacy, keys are kept in transient memory for this session. Please confirm you recognize this app action.
                    </Typography>
                </Box>
            </Stack>

            <Divider sx={{ borderColor: EDGE, my: 2 }} />

            <Stack direction="row" gap={2} sx={{ px: 3, pb: 3 }}>
                <Button
                    variant="outlined"
                    onClick={onCancel}
                    sx={{
                        flex: 1,
                        borderColor: EDGE,
                        color: 'white',
                        borderRadius: '14px',
                        fontWeight: 800,
                        textTransform: 'none',
                        py: 1.5,
                        '&:hover': { bgcolor: HIGHLIGHT }
                    }}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={signConfirmLoading}
                    onClick={onConfirm}
                    sx={{
                        flex: 1,
                        bgcolor: ACCENT,
                        color: 'white',
                        borderRadius: '14px',
                        fontWeight: 900,
                        textTransform: 'none',
                        py: 1.5,
                        '&:hover': { bgcolor: '#5145cd' }
                    }}
                >
                    {signConfirmLoading ? <CircularProgress size={16} color="inherit" /> : 'Sign Message'}
                </Button>
            </Stack>
        </Box>
  );
}
