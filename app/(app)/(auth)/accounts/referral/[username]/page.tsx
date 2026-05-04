'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Avatar, Box, Button, Container, Divider, Paper, Stack, Typography, CircularProgress, alpha } from '@mui/material';
import { ArrowRight, CheckCircle2, Copy, ExternalLink, ShieldCheck, Sparkles, UserRound } from 'lucide-react';

type ReferralLookup = {
  success: boolean;
  username: string;
  displayName: string;
  avatar: string | null;
  userId: string;
  referralLink: string;
};

function buildLoginUrl(returnTo: string) {
  return `/login?source=${encodeURIComponent(returnTo)}&return_to=${encodeURIComponent(returnTo)}`;
}

export default function ReferralPage({ params }: { params: { username: string } }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const username = useMemo(() => (params.username || '').trim().replace(/^@+/, '').toLowerCase(), [params.username]);
  const [currentHref, setCurrentHref] = useState('');
  const [referral, setReferral] = useState<ReferralLookup | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const autoClaimedRef = useRef(false);

  const referralApiBase = useMemo(() => '/api/referrals', []);

  // Check if user has an active session (without calling account.get())
  useEffect(() => {
    setIsAuthLoading(true);
    const hasSession = document.cookie.includes('a_session');
    setIsAuthenticated(hasSession);
    setIsAuthLoading(false);
  }, []);

  const loadReferral = useCallback(async () => {
    if (!username) {
      setLoading(false);
      setMessage('Invalid referral link.');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${referralApiBase}/${encodeURIComponent(username)}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setReferral(null);
        setMessage(data?.error || 'Referral profile not found.');
        return;
      }

      setReferral(data as ReferralLookup);
    } catch {
      setReferral(null);
      setMessage('Unable to load the referral profile right now.');
    } finally {
      setLoading(false);
    }
  }, [referralApiBase, username]);

  const claimReferral = useCallback(async () => {
    if (!referral || !username || claiming || claimed) return;

    setClaiming(true);
    setMessage(null);

    try {
      const res = await fetch(`${referralApiBase}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to claim referral.');
      }

      setClaimed(true);
      setMessage(data?.alreadyReferred ? 'Referral already applied to your account.' : 'Referral applied successfully.');
    } catch (error: any) {
      setMessage(error?.message || 'Failed to claim referral.');
    } finally {
      setClaiming(false);
    }
  }, [claimed, claiming, referral, referralApiBase, username]);

  useEffect(() => {
    loadReferral();
  }, [loadReferral]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentHref(`${window.location.origin}${window.location.pathname}`);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || isAuthLoading || !referral || autoClaimedRef.current) return;
    autoClaimedRef.current = true;
    void claimReferral();
  }, [claimReferral, isAuthLoading, isAuthenticated, referral]);

  const referralUrl = currentHref || referral?.referralLink || `https://www.kylrix.space/referral/${encodeURIComponent(username)}`;
  const loginUrl = buildLoginUrl(currentHref || referralUrl);

  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(referralUrl);
    setMessage('Referral link copied.');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', py: { xs: 6, md: 10 } }}>
      <Container maxWidth="sm">
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 5,
            bgcolor: '#161412',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 28px 60px rgba(0,0,0,0.42)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(circle at top, rgba(99,102,241,0.18), transparent 45%)',
            }}
          />

          <Stack spacing={3} sx={{ position: 'relative' }}>
            <Stack spacing={1}>
              <Typography
                variant="overline"
                sx={{
                  color: 'rgba(255,255,255,0.55)',
                  letterSpacing: '0.24em',
                  fontWeight: 800,
                }}
              >
                Kylrix referral
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontFamily: 'var(--font-clash)',
                  fontSize: { xs: '2.1rem', sm: '2.6rem' },
                  lineHeight: 0.95,
                  letterSpacing: '-0.05em',
                  fontWeight: 800,
                }}
              >
                {loading ? 'Resolving invite...' : referral ? `Invited by @${referral.username}` : 'Referral unavailable'}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.7 }}>
                This invite is resolved live from the Connect profile username and the referral record is applied through the accounts API only after sign-in.
              </Typography>
            </Stack>

            {loading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
                <CircularProgress sx={{ color: '#6366F1' }} />
              </Stack>
            ) : referral ? (
              <>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Avatar
                    src={referral.avatar || undefined}
                    sx={{
                      width: 72,
                      height: 72,
                      bgcolor: '#6366F1',
                      fontSize: '1.5rem',
                      fontWeight: 800,
                    }}
                  >
                    {referral.displayName?.slice(0, 1)?.toUpperCase() || <UserRound size={28} />}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: '1.15rem', fontWeight: 800 }}>
                      {referral.displayName}
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.56)' }}>
                      @{referral.username}
                    </Typography>
                  </Box>
                </Stack>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    bgcolor: alpha('#FFFFFF', 0.03),
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.48)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>
                    Your referral link
                  </Typography>
                  <Typography sx={{ mt: 0.75, fontFamily: '"JetBrains Mono", monospace', wordBreak: 'break-word', color: '#fff' }}>
                    {referralUrl}
                  </Typography>
                </Paper>

                {message && (
                  <Alert severity={claimed ? 'success' : 'info'} sx={{ bgcolor: alpha('#6366F1', 0.08), color: '#fff', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {message}
                  </Alert>
                )}

                <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    variant="contained"
                    onClick={handleCopy}
                    startIcon={<Copy size={16} />}
                    sx={{
                      bgcolor: '#6366F1',
                      color: '#fff',
                      borderRadius: 999,
                      px: 2.5,
                      textTransform: 'none',
                      fontWeight: 800,
                      '&:hover': { bgcolor: '#4F46E5' },
                    }}
                  >
                    Copy link
                  </Button>
                  <Button
                    variant="outlined"
                    href={referral.referralLink}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<ExternalLink size={16} />}
                    sx={{
                      borderColor: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      borderRadius: 999,
                      px: 2.5,
                      textTransform: 'none',
                      fontWeight: 800,
                    }}
                  >
                    Open invite
                  </Button>
                </Stack>

                {!isAuthenticated ? (
                  <Stack spacing={1.5}>
                    <Alert
                      icon={<ShieldCheck size={18} />}
                      severity="info"
                      sx={{
                        bgcolor: alpha('#10B981', 0.08),
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      Sign in to claim this referral on your account.
                    </Alert>
                    <Button
                      variant="contained"
                      href={loginUrl}
                      sx={{
                        bgcolor: '#0F0E0D',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 999,
                        px: 2.5,
                        textTransform: 'none',
                        fontWeight: 800,
                        '&:hover': { bgcolor: '#1C1A18' },
                      }}
                    >
                      Continue to sign in
                    </Button>
                  </Stack>
                ) : (
                  <Button
                    variant="contained"
                    onClick={claimReferral}
                    disabled={claiming || claimed}
                    endIcon={claimed ? <CheckCircle2 size={16} /> : <ArrowRight size={16} />}
                    sx={{
                      bgcolor: claimed ? '#0F172A' : '#6366F1',
                      color: '#fff',
                      borderRadius: 999,
                      px: 2.5,
                      textTransform: 'none',
                      fontWeight: 800,
                      '&:hover': { bgcolor: claimed ? '#0F172A' : '#4F46E5' },
                    }}
                  >
                    {claimed ? 'Referral claimed' : claiming ? 'Claiming referral...' : 'Claim referral now'}
                  </Button>
                )}
              </>
            ) : (
              <Alert severity="error" sx={{ bgcolor: alpha('#EF4444', 0.08), color: '#fff', border: '1px solid rgba(255,255,255,0.06)' }}>
                {message || 'We could not find a user for this referral link.'}
              </Alert>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pt: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.46)' }}>
                Powered by live Connect usernames and the accounts referral API.
              </Typography>
              <Sparkles size={16} color="rgba(255,255,255,0.4)" />
            </Box>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
