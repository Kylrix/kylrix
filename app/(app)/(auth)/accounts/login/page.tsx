'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Client, Account, OAuthProvider, ID } from 'appwrite';
import { Box, Typography, Stack, TextField, Button, Alert, CircularProgress, alpha, InputAdornment } from '@mui/material';
import { safeDeleteCurrentSession } from '@/lib/safe-session';
import { useSource } from '@/lib/source-context';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { normalizeMfaFactors, sessionNeedsTotpMfa } from '@/lib/mfa-session';
import Logo from '../components/Logo';
import { MfaChallengeDrawer } from '@/components/overlays/MfaChallengeDrawer';

const client = new Client();
if (typeof window !== 'undefined') {
  client.setEndpoint(APPWRITE_CONFIG.ENDPOINT);
  client.setProject(APPWRITE_CONFIG.PROJECT_ID);
}
const account = new Account(client);

const glassEffect = {
  bgcolor: '#161514',
  border: '1px solid rgba(255, 255, 255, 0.08)',
};

const IDM_AUTH_SUCCESS_EVENT = 'idm:auth-success';

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const { source, setSource, setRedirectUri, getBackUrl } = useSource();
  const hasNotifiedRef = useRef(false);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpUserId, setOtpUserId] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailValid, setEmailValid] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [mfaChallengeOpen, setMfaChallengeOpen] = useState(false);
  const [mfaLoginMethod, setMfaLoginMethod] = useState<'email-otp' | 'oauth2' | 'password' | 'unknown'>('unknown');
  const appName = APPWRITE_CONFIG.SYSTEM?.RP_NAME || 'Kylrix';

  const resolveLoginMethod = useCallback((provider?: string | null) => {
    const value = (provider || '').toLowerCase();
    if (value.includes('email')) return 'email-otp' as const;
    if (value.includes('oauth')) return 'oauth2' as const;
    if (value.includes('password')) return 'password' as const;
    return 'unknown' as const;
  }, []);

  const isValidEmail = useCallback((email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, []);

  const notifyOpenerAuthSuccess = useCallback((payload: any) => {
    if (typeof window !== 'undefined' && window.opener && !hasNotifiedRef.current) {
      window.opener.postMessage({ type: IDM_AUTH_SUCCESS_EVENT, ...payload }, '*');
      hasNotifiedRef.current = true;
    }
  }, []);

  const confirmAuthenticated = useCallback(async () => {
    try {
      const [session, factors] = await Promise.all([
        account.getSession('current'),
        account.listMfaFactors().catch(() => null),
      ]);
      setMfaLoginMethod(resolveLoginMethod((session as any)?.provider));

      if (sessionNeedsTotpMfa({
        session,
        availableFactors: normalizeMfaFactors(factors),
      })) {
        setOtpUserId(null);
        setMfaChallengeOpen(true);
        return;
      }

      const user = await account.get();

      const redirectUri = searchParams.get('redirect_uri');
      const returnTo = searchParams.get('return_to');
      const source = searchParams.get('source');

      // HANDLE APP RETURN ROUTE FIRST
      if (returnTo) {
        const target = new URL(returnTo, window.location.origin);
        if (source) {
          target.searchParams.set('source', source);
        }
        if (redirectUri) {
          target.searchParams.set('redirect_uri', redirectUri);
        }
        window.location.replace(target.toString());
        return;
      }

      // HANDLE EXTERNAL REDIRECT (LEGACY CENTRALIZED AUTH)
      if (redirectUri) {
        try {
          const jwt = await account.createJWT();
          const res = await fetch('/api/auth/session', {
            headers: {
              Authorization: `Bearer ${jwt.jwt}`,
            },
          });
          if (res.ok) {
            const { secret, userId } = await res.json();
            const target = new URL(redirectUri);
            target.searchParams.set('secret', secret);
            target.searchParams.set('userId', userId);
            window.location.href = target.toString();
            return;
          }
        } catch (e) {
          console.error('Failed to get session secret for redirect', e);
        }
      }

      notifyOpenerAuthSuccess({ userId: user.$id });
      setIsSuccess(true);
    } catch (_e: unknown) {
      const err = _e as any;
      if (err?.type === 'user_more_factors_required' || err?.message?.includes('more_factors_required')) {
        const session = await account.getSession('current').catch(() => null);
        setMfaLoginMethod(resolveLoginMethod((session as any)?.provider));
        setMfaChallengeOpen(true);
        return;
      }
      throw _e;
    }
  }, [notifyOpenerAuthSuccess, resolveLoginMethod, searchParams]);

  const checkExistingSession = useCallback(async () => {
    setIsCheckingSession(true);
    try {
      await confirmAuthenticated();
    } catch (_e) {
      // Session doesn't exist
    } finally {
      setIsCheckingSession(false);
    }
  }, [confirmAuthenticated]);

  useEffect(() => {
    const source = searchParams.get('source');
    const redirect = searchParams.get('redirect_uri');
    if (source) setSource(source);
    if (redirect) setRedirectUri(redirect);
  }, [searchParams, setSource, setRedirectUri]);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed' && !message) {
      setMessage('OAuth login failed. Please try again.');
    }
  }, [searchParams, message]);

  useEffect(() => {
    if (!isSuccess || window.opener) return;

    const backUrl = getBackUrl();
    if (!backUrl) return;

    window.location.replace(backUrl);
  }, [getBackUrl, isSuccess]);

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setLoading(true);
    setMessage(null);
    try {
      await safeDeleteCurrentSession();

      const source = searchParams.get('source');
      const redirect = searchParams.get('redirect_uri');
        const returnTo = searchParams.get('return_to');
      
      let success = `${window.location.origin}/`;
        if (returnTo) {
          const target = new URL(returnTo, window.location.origin);
          if (source) target.searchParams.set('source', source);
          if (redirect) target.searchParams.set('redirect_uri', redirect);
          success = target.toString();
        } else if (source && redirect) {
          success = `${window.location.origin}/login?source=${encodeURIComponent(source)}&redirect_uri=${encodeURIComponent(redirect)}`;
        } else if (source) {
          success = `${window.location.origin}/?source=${encodeURIComponent(source)}`;
        } else if (redirect) {
          success = `${window.location.origin}/login?redirect_uri=${encodeURIComponent(redirect)}`;
        }

        let failure = `${window.location.origin}/login?error=oauth_failed`;
        if (returnTo) {
          const target = new URL(returnTo, window.location.origin);
          if (source) target.searchParams.set('source', source);
          if (redirect) target.searchParams.set('redirect_uri', redirect);
          target.searchParams.set('error', 'oauth_failed');
          failure = target.toString();
        } else if (redirect) {
          failure = `${failure}&redirect_uri=${encodeURIComponent(redirect)}`;
        }

      await account.createOAuth2Session(
        provider,
        success,
        failure
      );
    } catch (err: any) {
      setMessage(err?.message || 'OAuth login failed');
      setLoading(false);
    }
  };

  const handleSendEmailOTP = async () => {
    if (!emailValid) {
      setMessage('Please enter a valid email');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const sessionToken = await account.createEmailToken({ userId: ID.unique(), email });
      setOtpUserId(sessionToken.userId);
      setOtpRequested(true);
      setOtp('');
      setMessage('OTP sent to your email. Enter the 6-digit code to continue.');
    } catch (_err: unknown) {
      const err = _err as any;
      setMessage(err.message || 'OTP failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmailOTP = async () => {
    if (!emailValid) {
      setMessage('Please enter a valid email');
      return;
    }
    if (!otpUserId) {
      setMessage('Send the code first.');
      return;
    }
    if (otp.trim().length !== 6) {
      setMessage('Please enter the 6-digit code from your email.');
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await safeDeleteCurrentSession();
      await account.createSession(otpUserId, otp.trim());
      await confirmAuthenticated();
    } catch (_err: unknown) {
      const err = _err as any;
      if (err?.type === 'user_more_factors_required' || err?.message?.includes('more_factors_required')) {
        const session = await account.getSession('current').catch(() => null);
        setMfaLoginMethod(resolveLoginMethod((session as any)?.provider));
        setMfaChallengeOpen(true);
        return;
      }
      setMessage(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaChallengeSuccess = () => {
    setMfaChallengeOpen(false);
    confirmAuthenticated();
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setOtp('');
    setOtpUserId(null);
    setOtpRequested(false);
    setIsTyping(true);
    if (typingTimeout) clearTimeout(typingTimeout);

    const isValid = isValidEmail(newEmail);
    const timeout = setTimeout(() => {
      setEmailValid(isValid);
      setIsTyping(false);
    }, 1000);
    setTypingTimeout(timeout);
  };

  if (isCheckingSession) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  if (isSuccess) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#000',
          p: 2,
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 440,
            borderRadius: '28px',
            p: 6,
            textAlign: 'center',
            ...glassEffect,
            boxShadow: '0 32px 64px -12px rgba(0, 0, 0, 0.8)',
          }}
        >
          <Box sx={{ mb: 4, display: 'flex', justifyContent: 'center' }}>
            <Box sx={{
              width: 80,
              height: 80,
              borderRadius: '24px',
              background: alpha('#6366F1', 0.1),
              border: '1px solid rgba(99, 102, 241, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Logo size={42} app="accounts" />
            </Box>
          </Box>
          <Typography variant="h4" sx={{ color: 'white', fontWeight: 900, mb: 2, letterSpacing: '-0.03em' }}>
            Welcome Back
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 5, fontSize: '0.95rem' }}>
            Identity verified. You are now signed into {appName}.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                const backUrl = getBackUrl();
                window.location.href = backUrl || '/';
              }
            }}
            sx={{
              height: 56,
              borderRadius: '16px',
              background: 'white',
              color: '#000',
              fontWeight: 800,
              fontSize: '0.9rem',
              '&:hover': { background: 'white', opacity: 0.9 },
            }}
          >
            {window.opener ? 'Close Terminal' : 'Proceed'}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#000',
        p: 2,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 480,
          borderRadius: '32px',
          p: { xs: 4, md: 6 },
          ...glassEffect,
          boxShadow: '0 40px 100px -20px rgba(0, 0, 0, 0.9)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 5 }}>
          <Logo size={42} app="accounts" />
        </Box>

        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography
            sx={{
              color: 'white',
              fontSize: { xs: '1.75rem', md: '2.25rem' },
              fontWeight: 900,
              letterSpacing: '-0.04em',
              mb: 1,
            }}
          >
            Sign In
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Kylrix Global Identity
          </Typography>
        </Box>

        <Stack spacing={3}>
          <Stack direction="row" spacing={2}>
            <Button
              onClick={() => handleOAuthLogin(OAuthProvider.Google)}
              disabled={loading}
              startIcon={<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>}
              sx={{
                flex: 1, height: 52, bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', color: 'white', fontWeight: 700, textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
              }}
            >
              Google
            </Button>
            <Button
              onClick={() => handleOAuthLogin(OAuthProvider.Github)}
              disabled={loading}
              startIcon={<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>}
              sx={{
                flex: 1, height: 52, bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px', color: 'white', fontWeight: 700, textTransform: 'none',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)' },
              }}
            >
              GitHub
            </Button>
          </Stack>

          <Box sx={{ display: 'flex', alignItems: 'center', py: 1 }}>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
            <Typography sx={{ px: 2, color: 'rgba(255, 255, 255, 0.2)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>or use email</Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
          </Box>

          <Box sx={{ position: 'relative' }}>
            <TextField
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="Email address"
              fullWidth
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white', height: 56, borderRadius: '16px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.1)',
                  '&.Mui-focused': { borderColor: '#6366F1', bgcolor: 'rgba(99, 102, 241, 0.02)' },
                  '& fieldset': { border: 'none' },
                  pr: 1,
                },
                '& .MuiOutlinedInput-input': {
                  '&::placeholder': { color: 'rgba(255, 255, 255, 0.2)' }
                }
              }}
              InputProps={{
                endAdornment: isTyping ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} sx={{ color: '#6366F1' }} />
                  </InputAdornment>
                ) : null,
              }}
            />
            {email.length > 0 && (
              <Typography 
                variant="caption" 
                sx={{ 
                  position: 'absolute', 
                  bottom: -22, 
                  left: 4,
                  fontWeight: 700,
                  color: emailValid ? '#4CAF50' : '#FF4D4D',
                  animation: 'fadeIn 0.2s ease'
                }}
              >
                {emailValid ? 'Valid email format' : 'Invalid email address'}
              </Typography>
            )}
          </Box>

          <Box sx={{ mt: 1, animation: 'fadeIn 0.3s ease' }}>
            <Stack spacing={2}>
              <Button
                onClick={otpRequested ? handleVerifyEmailOTP : handleSendEmailOTP}
                disabled={loading || !emailValid || (!otpRequested && !emailValid) || (otpRequested && otp.trim().length !== 6)}
                variant="outlined"
                fullWidth
                sx={{
                  height: 56, borderRadius: '16px',
                  color: 'white', borderColor: 'rgba(255, 255, 255, 0.1)', fontWeight: 800,
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.03)', borderColor: '#6366F1' }
                }}
              >
                {otpRequested ? 'Verify Code' : 'Send Code'}
              </Button>

              {otpRequested && emailValid && (
                <TextField
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { color: 'white', height: 56, borderRadius: '16px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid #6366F1', '& fieldset': { border: 'none' }, textAlign: 'center' }, '& .MuiOutlinedInput-input': { textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.2rem' } }}
                />
              )}
            </Stack>
          </Box>
        </Stack>

        {message && (
          <Alert severity={message.includes('sent') ? 'success' : 'error'} sx={{ mt: 4, borderRadius: '14px', bgcolor: alpha(message.includes('sent') ? '#4CAF50' : '#FF4D4D', 0.1), color: message.includes('sent') ? '#4CAF50' : '#FF4D4D', border: '1px solid', borderColor: alpha(message.includes('sent') ? '#4CAF50' : '#FF4D4D', 0.2) }}>{message}</Alert>
        )}

        {(source || searchParams.get('source')) && (
          <Box sx={{ mt: 6, pt: 3, borderTop: '1px solid rgba(255, 255, 255, 0.05)', textAlign: 'center' }}>
            <Button
              onClick={() => {
                const backUrl = getBackUrl();
                window.location.href = backUrl || '/';
              }}
              sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}
            >
              Cancel and Return
            </Button>
          </Box>
        )}
      </Box>

      <MfaChallengeDrawer
        open={mfaChallengeOpen}
        onClose={() => setMfaChallengeOpen(false)}
        loginMethod={mfaLoginMethod}
        onSuccess={handleMfaChallengeSuccess}
      />
    </Box>
  );
}
