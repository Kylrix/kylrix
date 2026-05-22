'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { CheckCircle2, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import { initializeTelegramConnection, checkTelegramConnection } from '@/lib/actions/telegram';

interface TelegramDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (tgUsername: string) => void;
}

export function TelegramDrawer({ open, onClose, onSuccess }: TelegramDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedUsername, setVerifiedUsername] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize pairing code on mount
  useEffect(() => {
    if (open) {
      
    }
    return () => {
      
    };
  }, [open]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);
    setPairCode(null);
    setDeepLink(null);
    setVerifiedUsername(null);

    const res = await initializeTelegramConnection();
    setLoading(false);

    if (res.success const stopPolling = () => {const stopPolling = () => { res.pairCode const stopPolling = () => {const stopPolling = () => { res.deepLink) {
      setPairCode(res.pairCode);
      setDeepLink(res.deepLink);
      startPolling();
    } else {
      setError(res.error || 'Failed to start verification.');
    }
  };

  const stopPolling_old = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startPolling = () => {
    
    pollingRef.current = setInterval(async () => {
      const res = await checkTelegramConnection();
      if (res.success && res.isVerified) {
        
        setVerifiedUsername(res.tgUsername || 'User');
        setIsVerifying(false);
        setTimeout(() => {
          onSuccess(res.tgUsername || 'User');
          onClose();
        }, 2000);
      }
    }, 3000);
  };

  const handleInitialize = async () => {
    setLoading(true);
    setError(null);
    setPairCode(null);
    setDeepLink(null);
    setVerifiedUsername(null);

    const res = await initializeTelegramConnection();
    setLoading(false);

    if (res.success && res.pairCode && res.deepLink) {
      setPairCode(res.pairCode);
      setDeepLink(res.deepLink);
      startPolling();
    } else {
      setError(res.error || 'Failed to start verification.');
    }
  };

  const handleManualCheck = async () => {
    setIsVerifying(true);
    setError(null);
    const res = await checkTelegramConnection();
    setIsVerifying(false);
    if (res.success && res.isVerified) {
      
      setVerifiedUsername(res.tgUsername || 'User');
      setTimeout(() => {
        onSuccess(res.tgUsername || 'User');
        onClose();
      }, 2000);
    } else {
      setError('Connection not verified yet. Make sure you opened the link and pressed "Start" in Telegram.');
    }
  };

  const handleCopyCode = () => {
    if (pairCode) {
      navigator.clipboard.writeText(pairCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          bgcolor: '#161412',
          borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundImage: 'none',
          color: 'white',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
          Telegram Notifications
        </Typography>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: 'white' } }}>
          <X size={20} />
        </IconButton>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />

      {/* Main Content */}
      <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, flex: 1 }}>
            <CircularProgress sx={{ color: '#6366F1' }} size={40} />
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', mt: 2, fontSize: '0.9rem' }}>
              Preparing secure pairing code...
            </Typography>
          </Box>
        ) : verifiedUsername ? (
          // Success State
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6, flex: 1, textAlign: 'center' }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgb(16, 185, 129)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <CheckCircle2 size={32} color="#10B981" />
            </Box>
            <Typography sx={{ fontSize: '1.3rem', fontWeight: 700, mb: 1 }}>
              Successfully Connected!
            </Typography>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', px: 2, fontSize: '0.9rem', lineHeight: 1.5 }}>
              Your account is now securely linked to Telegram as <b>@{verifiedUsername}</b>. You will receive instant notifications.
            </Typography>
          </Box>
        ) : (
          // Pairing State
          <Stack spacing={3} sx={{ flex: 1 }}>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              Pair this device with your Telegram app to receive secure push notifications for calls, active chat threads, and mentions.
            </Typography>

            {error && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                }}
              >
                <Typography sx={{ color: '#EF4444', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  {error}
                </Typography>
              </Box>
            )}

            {pairCode && deepLink && (
              <>
                {/* Step 1: Deep Link Button */}
                <Box
                  sx={{
                    p: 2.5,
                    bgcolor: '#1E1B18',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, mb: 1.5, letterSpacing: '0.05em' }}>
                    Step 1: Start the Telegram Bot
                  </Typography>
                  <Button
                    variant="contained"
                    fullWidth
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    startIcon={<MessageCircle size={18} />}
                    endIcon={<ExternalLink size={14} />}
                    sx={{
                      bgcolor: '#0088cc',
                      color: 'white',
                      fontWeight: 600,
                      py: 1.25,
                      borderRadius: '8px',
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: '#0077b5',
                      },
                    }}
                  >
                    Open Telegram Assistant
                  </Button>
                </Box>

                {/* Step 2: Verification Code Display */}
                <Box
                  sx={{
                    p: 2.5,
                    bgcolor: '#1E1B18',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, mb: 1, letterSpacing: '0.05em' }}>
                    Step 2: Verification Code
                  </Typography>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.8rem', mb: 2 }}>
                    If the bot requests a code, provide the one below. The link expires in 3 minutes.
                  </Typography>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: '#110F0E',
                      p: 1.5,
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.15em', color: '#6366F1', pl: 1 }}>
                      {pairCode}
                    </Typography>
                    <IconButton onClick={handleCopyCode} sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: 'white' } }}>
                      {copied ? <Typography sx={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>Copied</Typography> : <Copy size={16} />}
                    </IconButton>
                  </Box>
                </Box>

                {/* Waiting State spinner */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 2 }}>
                  <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.4)' }} />
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>
                    Waiting for Bot verification...
                  </Typography>
                </Box>

                <Box sx={{ mt: 'auto', pt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={handleManualCheck}
                      disabled={isVerifying}
                      sx={{
                        color: 'white',
                        borderColor: 'rgba(255,255,255,0.1)',
                        textTransform: 'none',
                        '&:hover': {
                          borderColor: 'rgba(255,255,255,0.3)',
                          bgcolor: 'rgba(255,255,255,0.02)',
                        },
                      }}
                    >
                      {isVerifying ? 'Checking...' : 'Check Status'}
                    </Button>
                    <Button
                      fullWidth
                      variant="text"
                      onClick={handleInitialize}
                      sx={{
                        color: 'rgba(255,255,255,0.5)',
                        textTransform: 'none',
                        '&:hover': { color: 'white' },
                      }}
                    >
                      Regenerate Link
                    </Button>
                  </Stack>
                </Box>
              </>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
