'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Drawer,
  useTheme,
  useMediaQuery,
} from '@/lib/mui-tailwind/material';
import { Shield, CheckCircle, Loader2 } from 'lucide-react';

interface CdrProcessingDrawerProps {
  open: boolean;
  onClose: () => void;
  isDemoMode?: boolean;
  walletAddress?: string;
  onFinished: () => void;
}

export function CdrProcessingDrawer({
  open,
  onClose,
  isDemoMode = false,
  walletAddress = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  onFinished,
}: CdrProcessingDrawerProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [step, setStep] = useState(0);
  const [txHash, setTxHash] = useState('');
  const [cid, setCid] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTxHash('');
    setCid('');

    // Animate steps for demo polished look
    const timer1 = setTimeout(() => setStep(1), 800);
    const timer2 = setTimeout(() => setStep(2), 1600);
    const timer3 = setTimeout(() => {
      setStep(3);
      setTxHash('0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
      setCid('QmStoryDemoIPFS' + Math.random().toString(36).substring(2, 10));
    }, 2400);
    const timer4 = setTimeout(() => {
      setStep(4);
      onFinished();
    }, 3200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [open]);

  const steps = [
    { label: 'Deriving EVM Key', desc: 'Querying RAM keystore' },
    { label: 'Encrypting Payload', desc: 'TEE threshold ECIES wrap' },
    { label: 'Story Contract Submission', desc: 'Deploying OwnerWriteCondition' },
    { label: 'Finalizing Data Rail', desc: 'Writing metadata to database' },
  ];

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      onClose={() => {}} // Block manual close during transaction processing
      ModalProps={{ keepMounted: false, disablePortal: true }}
      PaperProps={{
        sx: {
          bgcolor: '#000000',
          borderLeft: isDesktop ? '1px solid #1f1f1f' : 'none',
          borderTop: !isDesktop ? '1px solid #1f1f1f' : 'none',
          borderRadius: !isDesktop ? '32px 32px 0 0' : '0',
          height: isDesktop ? '100%' : 'auto',
          maxHeight: isDesktop ? '100%' : '90dvh',
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ p: { xs: 3, md: 4 }, color: '#fff', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box>
          {/* Header */}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
              <Shield size={24} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
                Story CDR Gateway
              </Typography>
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                {step < 4 ? 'SECURE TRANSACTION IN PROGRESS' : 'TRANSACTION COMPLETE'}
              </Typography>
            </Box>
          </Stack>

          {/* Account Details */}
          <Box sx={{ p: 2.5, bgcolor: '#161412', border: '1px solid #1f1f1f', borderRadius: '16px', mb: 4 }}>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', fontFamily: 'var(--font-mono)' }}>
                  Active EVM Account
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                  {walletAddress}
                </Typography>
              </Box>

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', fontFamily: 'var(--font-mono)' }}>
                    Testnet Balance
                  </Typography>
                  <Typography sx={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                    {isDemoMode ? '4,200.00 IP' : '0.15 IP'}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', fontFamily: 'var(--font-mono)' }}>
                    Aeneid Gas Fee
                  </Typography>
                  <Typography sx={{ color: '#F59E0B', fontSize: '0.85rem', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                    0.00021 IP
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Box>

          {/* Steps list */}
          <Stack spacing={3}>
            {steps.map((s, idx) => {
              const isActive = step === idx;
              const isCompleted = step > idx;
              return (
                <Stack key={idx} direction="row" spacing={2.5} alignItems="center">
                  <Box sx={{ display: 'grid', placeItems: 'center', width: 28, height: 28 }}>
                    {isCompleted ? (
                      <Box sx={{ color: '#10B981' }}>
                        <CheckCircle size={20} />
                      </Box>
                    ) : isActive ? (
                      <CircularProgress size={20} sx={{ color: '#6366F1' }} />
                    ) : (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.15)' }} />
                    )}
                  </Box>
                  <Box>
                    <Typography sx={{ color: isCompleted || isActive ? '#ffffff' : 'rgba(255,255,255,0.3)', fontWeight: isCompleted || isActive ? 900 : 700, fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                      {s.label}
                    </Typography>
                    <Typography sx={{ color: isCompleted || isActive ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', fontSize: '0.75rem', fontFamily: 'var(--font-sans)' }}>
                      {s.desc}
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </Box>

        {/* Transaction Metadata & Details */}
        <Box sx={{ mt: 4 }}>
          {step >= 3 && (
            <Box sx={{ p: 2, bgcolor: 'rgba(16, 185, 129, 0.03)', border: '1px dashed rgba(16, 185, 129, 0.2)', borderRadius: '16px', mb: 3 }}>
              <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1, fontFamily: 'var(--font-mono)' }}>
                Transaction Receipt (Aeneid Explorer)
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                Hash: {txHash.substring(0, 20)}...
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', mt: 0.5 }}>
                CID: {cid}
              </Typography>
            </Box>
          )}

          {step === 4 && (
            <Button
              fullWidth
              variant="contained"
              onClick={onClose}
              sx={{
                py: 2,
                borderRadius: '16px',
                fontWeight: 900,
                textTransform: 'none',
                fontSize: '0.95rem',
                bgcolor: '#10B981',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                '&:hover': { bgcolor: '#059669', transform: 'translateY(-1px)' },
                transition: 'all 0.2s ease-in-out',
                boxShadow: 'none',
              }}
            >
              Done
            </Button>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
