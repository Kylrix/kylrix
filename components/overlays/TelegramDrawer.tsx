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
} from '@/lib/mui-tailwind/material';
import { CheckCircle2, Copy, ExternalLink, X } from 'lucide-react';
import { Telegram as TelegramIcon } from '@/lib/mui-tailwind/icons';
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
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.05) 0%, transparent 75%)',
          color: 'white',
          boxShadow: '0 -16px 48px rgba(0, 0, 0, 0.6)',
          width: { xs: '100%', md: 620 },
          mx: 'auto',
          left: '50%',
          transform: 'translateX(-50%)',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 3, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(0, 136, 204, 0.1)', color: '#0088cc', border: '1px solid rgba(0, 136, 204, 0.2)' }}>
            <TelegramIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 900, fontFamily: 'var(--font-clash)', tracking: 'tight' }}>
            Telegram Connection
          </Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' }, width: 32, height: 32 }}>
          <X size={18} />
        </IconButton>
      </Box>

      {/* Main Content */}
      <Box sx={{ p: 3.5, flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, flex: 1 }}>
            <CircularProgress sx={{ color: '#6366F1' }} size={36} />
            <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 2.5, fontSize: '0.86rem', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
              Generating secure handshake protocol...
            </Typography>
          </Box>
        ) : verifiedUsername ? (
          // Success State
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5, flex: 1, textAlign: 'center' }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '20px',
                bgcolor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgb(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)',
              }}
            >
              <CheckCircle2 size={32} color="#10B981" />
            </Box>
            <Typography component="span" sx={{ fontSize: '1.25rem', fontWeight: 900, fontFamily: 'var(--font-clash)', mb: 1, color: 'white' }}>
              Connection Established
            </Typography>
            <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.58)', px: 2, fontSize: '0.9rem', fontFamily: 'var(--font-satoshi)', fontWeight: 600, lineHeight: 1.45 }}>
              Your account is now securely linked to Telegram as <b className="text-white">@{verifiedUsername}</b>. Alerts will arrive instantly.
            </Typography>
          </Box>
        ) : (
          // Pairing State
          <Stack spacing={3.25} sx={{ flex: 1 }}>
            <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '0.9rem', fontFamily: 'var(--font-satoshi)', fontWeight: 600, lineHeight: 1.45 }}>
              Sync your device to receive real-time push notifications for incoming calls, active huddle invitations, and direct mentions.
            </Typography>

            {error && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'rgba(239, 68, 68, 0.06)',
                  border: '1px solid rgba(239, 68, 68, 0.18)',
                  borderRadius: '12px',
                }}
              >
                <Typography component="span" sx={{ color: '#EF4444', fontSize: '0.82rem', fontFamily: 'var(--font-satoshi)', fontWeight: 600, lineHeight: 1.4 }}>
                  {error}
                </Typography>
              </Box>
            )}

            {pairCode && deepLink && (
              <>
                {/* Step 1: Start the Telegram Bot */}
                <Box
                  sx={{
                    p: 3,
                    bgcolor: '#0B0A09',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2.5,
                  }}
                >
                  {/* Top section: Icon + Text Column */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {/* Left: fixed icon slot */}
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: '12px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'rgba(0, 136, 204, 0.08)',
                        color: '#0088cc',
                        border: '1px solid rgba(0, 136, 204, 0.18)',
                        flexShrink: 0,
                      }}
                    >
                      <TelegramIcon sx={{ fontSize: 20 }} />
                    </Box>

                    {/* Right: Stacked text column */}
                    <Box
                      sx={{
                        minWidth: 0,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                      }}
                    >
                      <Typography component="span" sx={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6366F1', fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                        Step 1
                      </Typography>
                      <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.94rem', color: 'white', fontFamily: 'var(--font-clash)', lineHeight: 1.25 }}>
                        Start Telegram Assistant
                      </Typography>
                      <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '0.82rem', fontFamily: 'var(--font-satoshi)', fontWeight: 600, lineHeight: 1.45, mt: 0.5 }}>
                        Launch the helper bot to establish a secure, encrypted notification bridge for real-time updates.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Bottom: Action Button */}
                  <Button
                    variant="contained"
                    fullWidth
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<ExternalLink size={13} />}
                    sx={{
                      bgcolor: '#0088cc',
                      color: 'white',
                      fontFamily: 'var(--font-satoshi)',
                      fontWeight: 700,
                      py: 1.5,
                      borderRadius: '14px',
                      textTransform: 'none',
                      boxShadow: '0 4px 14px rgba(0, 136, 204, 0.2)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: '#0077b5',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 6px 20px rgba(0, 136, 204, 0.3)',
                      },
                    }}
                  >
                    Open Telegram Assistant
                  </Button>
                </Box>

                {/* Step 2: Verification Code Display */}
                <Box
                  sx={{
                    p: 3,
                    bgcolor: '#0B0A09',
                    borderRadius: '24px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2.5,
                  }}
                >
                  {/* Top section: Icon + Text Column */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {/* Left: fixed icon slot */}
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: '12px',
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: 'rgba(99, 102, 241, 0.08)',
                        color: '#6366F1',
                        border: '1px solid rgba(99, 102, 241, 0.18)',
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle2 size={20} />
                    </Box>

                    {/* Right: Stacked text column */}
                    <Box
                      sx={{
                        minWidth: 0,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                      }}
                    >
                      <Typography component="span" sx={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6366F1', fontWeight: 800, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                        Step 2
                      </Typography>
                      <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.94rem', color: 'white', fontFamily: 'var(--font-clash)', lineHeight: 1.25 }}>
                        Authenticate Connection
                      </Typography>
                      <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.42)', fontSize: '0.82rem', fontFamily: 'var(--font-satoshi)', fontWeight: 600, lineHeight: 1.45, mt: 0.5 }}>
                        Provide this authorization code if requested by the assistant bot. Code expires in 3 minutes.
                      </Typography>
                    </Box>
                  </Box>

                  {/* Bottom: Code display & Copy action */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      bgcolor: '#110F0E',
                      px: 2.5,
                      py: 1.5,
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <Typography component="span" sx={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.15em', color: '#6366F1', pl: 1 }}>
                      {pairCode}
                    </Typography>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography component="span" sx={{ 
                          fontSize: '0.74rem', 
                          fontWeight: 800, 
                          fontFamily: 'var(--font-mono)',
                          color: timeLeft === 'Expired' ? '#EF4444' : (timeLeft.startsWith('00:') ? '#F59E0B' : '#10B981'),
                          bgcolor: 'rgba(255, 255, 255, 0.02)',
                          px: 1.25,
                          py: 0.5,
                          borderRadius: '8px',
                          border: '1px solid rgba(255,255,255,0.04)'
                      }}>
                        {timeLeft}
                      </Typography>
                      <Button
                        size="small"
                        onClick={handleCopyCode}
                        sx={{ 
                          color: 'rgba(255, 255, 255, 0.5)', 
                          textTransform: 'none',
                          minWidth: 0,
                          p: 1,
                          borderRadius: '8px',
                          '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' } 
                        }}
                      >
                        {copied ? <Typography component="span" sx={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 800 }}>Copied</Typography> : <Copy size={15} />}
                      </Button>
                    </Stack>
                  </Box>
                </Box>

                {/* Handshake/Waiting Indicator */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: 1 }}>
                  <CircularProgress size={13} sx={{ color: 'rgba(255,255,255,0.3)' }} />
                  <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.42)', fontSize: '0.78rem', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
                    Listening for secure sync broadcast...
                  </Typography>
                </Box>

                <Box sx={{ mt: 'auto', pt: 1.5 }}>
                  <Stack direction="row" spacing={2}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={handleManualCheck}
                      disabled={isVerifying}
                      sx={{
                        color: 'white',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderRadius: '14px',
                        py: 1.25,
                        textTransform: 'none',
                        fontFamily: 'var(--font-satoshi)',
                        fontWeight: 700,
                        '&:hover': {
                          borderColor: 'rgba(255,255,255,0.22)',
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
                        color: 'rgba(255,255,255,0.45)',
                        borderRadius: '14px',
                        py: 1.25,
                        textTransform: 'none',
                        fontFamily: 'var(--font-satoshi)',
                        fontWeight: 700,
                        '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.03)' },
                      }}
                    >
                      Regenerate
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
