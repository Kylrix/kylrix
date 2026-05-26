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
import { CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';
import TelegramIcon from '@mui/icons-material/Telegram';
import { initializeTelegramConnection, checkTelegramConnection } from '@/lib/actions/telegram';

interface TelegramDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (tgUsername: string) => void;
}

interface CachedConnection {
  pairCode: string;
  deepLink: string;
  createdAt: string;
  userId: string;
}

let connectionCache: CachedConnection | null = null;

export function TelegramDrawer({ open, onClose, onSuccess }: TelegramDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedUsername, setVerifiedUsername] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Live timer states
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('03:00');

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const jwtRef = useRef<string | null>(null);

  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onCloseRef.current = onClose;
  }, [onSuccess, onClose]);

  const getOrUpdateJWT = React.useCallback(async () => {
    if (jwtRef.current) return jwtRef.current;
    try {
      const { account } = await import('@/lib/appwrite/client');
      const { jwt } = await account.createJWT();
      jwtRef.current = jwt;
      return jwt;
    } catch (err) {
      console.error('Failed to create JWT:', err);
      return undefined;
    }
  }, []);

  const stopPolling = React.useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = React.useCallback(() => {
    stopPolling();
    // Low-frequency polling fallback (every 10 seconds) to protect database load
    pollingRef.current = setInterval(async () => {
      const jwt = await getOrUpdateJWT();
      const res = await checkTelegramConnection(jwt);
      if (res.success && res.isVerified) {
        stopPolling();
        setVerifiedUsername(res.tgUsername || 'User');
        setIsVerifying(false);
        setTimeout(() => {
          onSuccessRef.current(res.tgUsername || 'User');
          onCloseRef.current();
        }, 2000);
      }
    }, 10000);
  }, [getOrUpdateJWT, stopPolling]);

  const handleInitialize = React.useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    setPairCode(null);
    setDeepLink(null);
    setVerifiedUsername(null);
    setCreatedAt(null);
    setUserId(null);
    setTimeLeft('03:00');

    // Check client-side session-cache first if not forced
    if (!force && connectionCache) {
      const createdTime = new Date(connectionCache.createdAt).getTime();
      const now = Date.now();
      const threeMinutesInMs = 3 * 60 * 1000;
      if (now - createdTime < threeMinutesInMs) {
        setPairCode(connectionCache.pairCode);
        setDeepLink(connectionCache.deepLink);
        setCreatedAt(connectionCache.createdAt);
        setUserId(connectionCache.userId);
        setLoading(false);
        startPolling();
        return;
      } else {
        connectionCache = null;
      }
    }

    try {
      const jwt = await getOrUpdateJWT();
      const res = await initializeTelegramConnection(jwt, force);
      if (res.success && (res as any).isVerified) {
          setVerifiedUsername((res as any).tgUsername || 'User');
          setLoading(false);
          return;
      }
      
      if (res.success && res.pairCode && res.deepLink && res.userId) {
        setPairCode(res.pairCode);
        setDeepLink(res.deepLink);
        const codeCreatedAt = res.createdAt || new Date().toISOString();
        setCreatedAt(codeCreatedAt);
        setUserId(res.userId);

        // Cache pairing info locally on client
        connectionCache = {
          pairCode: res.pairCode,
          deepLink: res.deepLink,
          createdAt: codeCreatedAt,
          userId: res.userId,
        };

        startPolling();
      } else {
        setError(res.error || 'Failed to start verification.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [getOrUpdateJWT, startPolling]);

  const handleInitializeRef = useRef(handleInitialize);
  useEffect(() => {
    handleInitializeRef.current = handleInitialize;
  }, [handleInitialize]);

  // Real-time Event Subscription (Zero-Database-Read Verification)
  useEffect(() => {
    if (!open || !pairCode || verifiedUsername || !userId) return;

    let isSubscribed = true;
    let unsubscribeFn: (() => void) | null = null;

    const setupRealtime = async () => {
      try {
        const { realtime } = await import('@/lib/appwrite/client');
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
        
        if (!isSubscribed) return;

        const channel = `databases.${APPWRITE_CONFIG.DATABASES.CONNECT}.collections.${APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS}.documents.${userId}`;
        
        const sub = await realtime.subscribe(channel, (response: any) => {
          const payload = response.payload;
          if (payload && payload.is_verified) {
            stopPolling();
            setVerifiedUsername(payload.tg_username || 'User');
            setIsVerifying(false);
            setTimeout(() => {
              onSuccessRef.current(payload.tg_username || 'User');
              onCloseRef.current();
            }, 2000);
          }
        });

        unsubscribeFn = () => {
          if (typeof sub === 'function') {
            (sub as any)();
          } else if (sub && typeof (sub as any).unsubscribe === 'function') {
            (sub as any).unsubscribe();
          }
        };
      } catch (err) {
        console.error('Failed to subscribe to realtime connection status:', err);
      }
    };

    setupRealtime();

    return () => {
      isSubscribed = false;
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, [open, pairCode, verifiedUsername, userId, stopPolling]);

  // Live Expiration Timer Countdown
  useEffect(() => {
    if (!createdAt || !pairCode || verifiedUsername) {
      setTimeLeft('03:00');
      return;
    }

    const updateTimer = () => {
      const createdTime = new Date(createdAt).getTime();
      const now = Date.now();
      const threeMinutesInMs = 3 * 60 * 1000;
      const totalTimeLeft = Math.max(0, threeMinutesInMs - (now - createdTime));
      
      if (totalTimeLeft <= 0) {
        clearInterval(timer);
        setTimeLeft('Expired');
        handleInitializeRef.current(true);
      } else {
        const minutes = Math.floor(totalTimeLeft / 1000 / 60);
        const seconds = Math.floor((totalTimeLeft / 1000) % 60);
        setTimeLeft(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
      }
    };

    updateTimer(); // Initial call
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [createdAt, pairCode, verifiedUsername]);

  // Initialize pairing code on mount
  useEffect(() => {
    if (open) {
      handleInitializeRef.current();
    }
    return () => {
      stopPolling();
    };
  }, [open, stopPolling]);

  const handleManualCheck = async () => {
    setIsVerifying(true);
    setError(null);
    const jwt = await getOrUpdateJWT();
    const res = await checkTelegramConnection(jwt);
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
      anchor="bottom"
      open={open}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: {
          height: 'auto',
          maxHeight: '60vh',
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          bgcolor: '#161412',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          backgroundImage: 'none',
          color: 'white',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
            <TelegramIcon sx={{ color: '#0088cc', fontSize: 28 }} />
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
              Telegram Notifications
            </Typography>
        </Stack>
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
                    startIcon={<TelegramIcon />}
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
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography sx={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 700, 
                          color: timeLeft === 'Expired' ? '#EF4444' : (timeLeft.startsWith('00:') ? '#F59E0B' : '#10B981'),
                          bgcolor: 'rgba(255, 255, 255, 0.02)',
                          px: 1.25,
                          py: 0.5,
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.04)'
                      }}>
                        {timeLeft}
                      </Typography>
                      <IconButton onClick={handleCopyCode} sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: 'white' } }}>
                        {copied ? <Typography sx={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600 }}>Copied</Typography> : <Copy size={16} />}
                      </IconButton>
                    </Stack>
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
                      onClick={() => handleInitialize(true)}
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
