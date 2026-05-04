'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Client, Account, OAuthProvider } from 'appwrite';
import Link from 'next/link';
import { Box, Typography, Stack, TextField, Button, Alert, CircularProgress, Divider, IconButton, Grid, Fade } from '@mui/material';
import { Visibility, VisibilityOff, Fingerprint, AccountBalanceWallet, Close } from '@mui/icons-material';

const client = new Client();
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) client.setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT);
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_APPWRITE_PROJECT) client.setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT);
const account = new Account(client);

function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function publicKeyCredentialToJSON(pubKeyCred: unknown): unknown {
  if (Array.isArray(pubKeyCred)) return (pubKeyCred as unknown[]).map(publicKeyCredentialToJSON);
  if (pubKeyCred instanceof ArrayBuffer) return bufferToBase64Url(pubKeyCred);
  if (pubKeyCred && typeof pubKeyCred === 'object') {
    const obj: Record<string, unknown> = {};
    for (const key in (pubKeyCred as Record<string, unknown>)) {
      obj[key] = publicKeyCredentialToJSON((pubKeyCred as Record<string, unknown>)[key]);
    }
    return obj;
  }
  return pubKeyCred;
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#181711' }}>
        <CircularProgress sx={{ color: '#f9c806' }} />
      </Box>
    }>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailValid, setEmailValid] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'ID';

  // Email validation
  const isValidEmail = useCallback((email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, []);

  // Handle email input with dynamic typing detection
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    setEmailTouched(true);

    // Clear previous timeout
    if (typingTimeout) clearTimeout(typingTimeout);

    // Set new timeout - shorter for valid emails, longer for incomplete
    const isValid = isValidEmail(newEmail);
    const delay = isValid ? 200 : 500; // Faster confirmation when email looks valid

    const timeout = setTimeout(() => {
      setEmailValid(isValid);
    }, delay);

    setTypingTimeout(timeout);
  };

  // Check for OAuth error from URL
  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed' && !message) {
      setMessage('OAuth login failed. Please try again.');
    }
  }, [searchParams, message]);

  // Get source for redirect after login
  const getRedirectUrl = () => {
    const source = localStorage.getItem('id_redirect_source');
    localStorage.removeItem('id_redirect_source');
    return source || '/settings';
  };

  const storeAccount = (userData: any, token: any) => {
    const accounts = JSON.parse(localStorage.getItem('id_accounts') || '{}');
    accounts[userData.$id] = {
      userId: userData.$id,
      email: userData.email,
      name: userData.name || userData.email.split('@')[0],
      refreshToken: token.secret,
    };
    localStorage.setItem('id_accounts', JSON.stringify(accounts));
  };

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setLoading(true);
    setMessage(null);
    try {
      const account = new Account(client);
      const success = `${window.location.origin}/`;
      const failure = `${window.location.origin}/login?error=oauth_failed`;
      await account.createOAuth2Session({
        provider,
        success,
        failure,
      });
    } catch (err: any) {
      setMessage(err.message || 'OAuth login failed');
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!emailValid || !password.trim()) {
      setMessage('Please enter a valid email and password');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const account = new Account(client);
      // Note: This is a placeholder - implement your password auth endpoint
      setMessage('Password login not yet implemented');
      setLoading(false);
    } catch (err: any) {
      setMessage(err.message || 'Login failed');
      setLoading(false);
    }
  };

  async function registerPasskey() {
    setMessage(null);
    if (!('credentials' in navigator)) {
      setMessage('WebAuthn is not supported in this browser');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, userName: email.split('@')[0] }),
      });
      const options = await res.json();
      if (options.error) throw new Error(options.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const publicKey: any = { ...options };
      // Ensure binary fields are ArrayBuffers
      publicKey.challenge = base64UrlToBuffer(options.challenge as string);
      publicKey.user.id = base64UrlToBuffer((options as any).user.id as string);

      if (publicKey.excludeCredentials) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publicKey.excludeCredentials = publicKey.excludeCredentials.map((c: any) => ({
          ...c,
          id: base64UrlToBuffer(c.id),
        }));
      }

      const cred = await navigator.credentials.create({ publicKey });
      console.log('[CLIENT] Created credential raw object:', cred);
      if (!cred) throw new Error('Credential creation returned null');
      if (!(cred as any).response || !(cred as any).response.clientDataJSON) {
        console.warn('Unexpected credential object', cred);
        throw new Error('Browser did not return a proper attestation response');
      }
      const json = publicKeyCredentialToJSON(cred);

      const verifyRes = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Ensure we pass the original attestation object; library expects `response` wrapper
        body: JSON.stringify({ userId: email, attestation: json, challenge: (options as any).challenge, challengeToken: (options as any).challengeToken }),
      });
      const verifyJson = await verifyRes.json();
      if (verifyJson.error) throw new Error(verifyJson.error);

      // If server issued a custom token, exchange its secret for a session
      if (verifyJson.token?.secret && process.env.NEXT_PUBLIC_APPWRITE_PROJECT && process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
        try {
          // Exchange custom Appwrite user token secret for a session
          await account.createSession({ userId: verifyJson.token.userId || email, secret: verifyJson.token.secret });
          const userData = await account.get();
          storeAccount(userData, verifyJson.token);
          setMessage('Registration successful and session created. Redirecting...');
          const redirectUrl = getRedirectUrl();
          router.replace(redirectUrl);
          return;
        } catch (e) {
          setMessage('Token exchange failed, but registration succeeded. You may sign in now.');
        }
      }

      setMessage('Registration successful. You can now sign in with your passkey.');
    } catch (err) {
      setMessage((err as Error)?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function signInWithPasskey() {
    setMessage(null);
    if (!('credentials' in navigator)) {
      setMessage('WebAuthn is not supported in this browser');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/webauthn/auth/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email }),
      });
      const options = await res.json();
      if (options.error) throw new Error(options.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const publicKey = { ...options } as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicKey.challenge = base64UrlToBuffer((options as any).challenge);
      if (publicKey.allowCredentials) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => ({
          ...c,
          id: base64UrlToBuffer(c.id),
        }));
      }

      const assertion = await navigator.credentials.get({ publicKey });
      const json = publicKeyCredentialToJSON(assertion);

      const verifyRes = await fetch('/api/webauthn/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, assertion: json, challenge: (options as any).challenge, challengeToken: (options as any).challengeToken }),
      });
      const verifyJson = await verifyRes.json();
      if (verifyJson.error) throw new Error(verifyJson.error);

      // If server returned a custom token, exchange it for a session and redirect
      if (verifyJson.token?.secret && process.env.NEXT_PUBLIC_APPWRITE_PROJECT && process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) {
        try {
          await account.createSession({ userId: verifyJson.token.userId || email, secret: verifyJson.token.secret });
          router.replace('/');
          return;
        } catch (e) {
          setMessage('Token exchange failed, but authentication succeeded (assertion verified).');
        }
      }

      setMessage('Authentication successful (PoC). Server verified assertion.');
    } catch (err) {
      setMessage((err as Error)?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  // Unified one-button flow: try signin first, fallback to registration
  async function continueWithPasskey() {
    setMessage(null);
    if (!('credentials' in navigator)) {
      setMessage('WebAuthn is not supported in this browser');
      return;
    }
    setLoading(true);
    try {
      // 1) Probe sign-in capability
      const optRes = await fetch('/api/webauthn/auth/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email }),
      });

      // Rate limited
      if (optRes.status === 429) {
        const retryAfter = optRes.headers.get('Retry-After') || '';
        setMessage(`Too many attempts. Retry after ${retryAfter || 'a moment'}.`);
        return;
      }
      // Wallet gate
      if (optRes.status === 403) {
        const body = await optRes.json().catch(() => ({}));
        setMessage(body?.error || 'Account already connected with wallet');
        return;
      }

      let doRegister = false;
      let authOptions: any = null;
      if (optRes.ok) {
        authOptions = await optRes.json();
        if (!Array.isArray(authOptions.allowCredentials) || authOptions.allowCredentials.length === 0) {
          doRegister = true;
        }
      } else {
        // Any non-429/403 failure → try registration
        doRegister = true;
      }

      if (!doRegister) {
        // 2) Sign-in path
        const publicKey: any = { ...authOptions };
        publicKey.challenge = base64UrlToBuffer(authOptions.challenge as string);
        if (publicKey.allowCredentials) {
          publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => ({
            ...c,
            id: base64UrlToBuffer(c.id),
          }));
        }

        try {
          const assertion = await navigator.credentials.get({ publicKey });
          const json = publicKeyCredentialToJSON(assertion);
          const verifyRes = await fetch('/api/webauthn/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: email, assertion: json, challenge: authOptions.challenge, challengeToken: authOptions.challengeToken }),
          });
          const verifyJson = await verifyRes.json();
          if (!verifyRes.ok) {
            if (verifyRes.status === 400 && (verifyJson?.error?.includes('Unknown credential') || verifyJson?.error?.includes('WebAuthn'))) {
              doRegister = true; // fallback
            } else if (verifyRes.status === 403) {
              setMessage(verifyJson?.error || 'Account already connected with wallet');
              return;
            } else {
              setMessage(verifyJson?.error || 'Sign-in failed');
              return;
            }
          } else {
            // Token to session
            if (verifyJson.token?.secret) {
              await account.createSession({ userId: verifyJson.token.userId || email, secret: verifyJson.token.secret });
              const userData = await account.get();
              storeAccount(userData, verifyJson.token);
              const redirectUrl = getRedirectUrl();
              router.replace(redirectUrl);
              return;
            }
            setMessage('Sign-in verified. No token returned.');
            return;
          }
        } catch (e) {
          // User canceled or browser error → try registration path
          doRegister = true;
        }
      }

      // 3) Registration path
      const regRes = await fetch('/api/webauthn/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, userName: email.split('@')[0] || email }),
      });
      if (regRes.status === 429) {
        const retryAfter = regRes.headers.get('Retry-After') || '';
        setMessage(`Too many attempts. Retry after ${retryAfter || 'a moment'}.`);
        return;
      }
      if (regRes.status === 403) {
        const body = await regRes.json().catch(() => ({}));
        setMessage(body?.error || 'Account already connected with wallet');
        return;
      }
      const regOpt = await regRes.json();
      if (!regRes.ok || regOpt?.error) {
        setMessage(regOpt?.error || 'Could not start registration');
        return;
      }

      const regPK: any = { ...regOpt };
      regPK.challenge = base64UrlToBuffer(regOpt.challenge as string);
      if (regPK.user?.id) regPK.user.id = base64UrlToBuffer(regOpt.user.id as string);
      if (regPK.excludeCredentials) {
        regPK.excludeCredentials = regPK.excludeCredentials.map((c: any) => ({ ...c, id: base64UrlToBuffer(c.id) }));
      }

      const created = await navigator.credentials.create({ publicKey: regPK });
      const createdJson = publicKeyCredentialToJSON(created);
      const regVerify = await fetch('/api/webauthn/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: email, attestation: createdJson, challenge: regOpt.challenge, challengeToken: regOpt.challengeToken }),
      });
      const regVerifyJson = await regVerify.json();
      if (!regVerify.ok) {
        setMessage(regVerifyJson?.error || 'Registration failed');
        return;
      }
      if (regVerifyJson.token?.secret) {
        await account.createSession({ userId: regVerifyJson.token.userId || email, secret: regVerifyJson.token.secret });
        const userData = await account.get();
        storeAccount(userData, regVerifyJson.token);
        const redirectUrl = getRedirectUrl();
        router.replace(redirectUrl);
        return;
      }
      setMessage('Registration successful. You can now sign in.');
    } catch (err) {
      setMessage((err as Error)?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        p: 2,
      }}
    >
      {/* Modal */}
      <Box
        sx={{
          width: '100%',
          maxWidth: 448,
          borderRadius: '0.75rem',
          backgroundColor: '#231f0f',
          p: 4,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          position: 'relative',
        }}
      >
        {/* Close Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <IconButton
            onClick={() => router.push('/')}
            sx={{
              color: '#bbb49b',
              '&:hover': { color: 'white' },
            }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* Title */}
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography
            sx={{
              color: 'white',
              fontSize: '2.25rem',
              fontWeight: 900,
              lineHeight: 1.2,
              letterSpacing: '-0.033em',
            }}
          >
            Log in to {appName}
          </Typography>
        </Box>

        {/* OAuth Buttons */}
        <Box sx={{ mb: 6 }}>
          <OAuthButtons disabled={loading} />
        </Box>

        {/* Divider */}
        <Box sx={{ display: 'flex', alignItems: 'center', my: 3, gap: 2 }}>
          <Divider sx={{ flex: 1, borderColor: '#3a3627' }} />
          <Typography sx={{ fontSize: '0.875rem', color: '#bbb49b' }}>Or log in with your email</Typography>
          <Divider sx={{ flex: 1, borderColor: '#3a3627' }} />
        </Box>

        {/* Email & Password Form */}
        <Stack spacing={4} sx={{ mb: 6 }}>
          <Box>
            <Typography sx={{ color: 'white', fontSize: '1rem', fontWeight: 500, mb: 1 }}>Email</Typography>
            <TextField
              type="email"
              value={emailLogin}
              onChange={(e) => setEmailLogin(e.target.value)}
              placeholder="Enter your email"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  height: '3.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: '#27251b',
                  border: '1px solid #55503a',
                  '&:hover': { borderColor: '#55503a' },
                  '&.Mui-focused': { borderColor: '#f9c806' },
                  '& fieldset': { border: 'none' },
                },
                '& .MuiOutlinedInput-input::placeholder': {
                  color: '#bbb49b',
                  opacity: 1,
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ color: 'white', fontSize: '1rem', fontWeight: 500, mb: 1 }}>Password</Typography>
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <TextField
                type={showPassword ? 'text' : 'password'}
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                placeholder="Enter your password"
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: 'white',
                    height: '3.5rem',
                    borderRadius: '0.5rem',
                    backgroundColor: '#27251b',
                    border: '1px solid #55503a',
                    '&:hover': { borderColor: '#55503a' },
                    '&.Mui-focused': { borderColor: '#f9c806' },
                    '& fieldset': { border: 'none' },
                  },
                  '& .MuiOutlinedInput-input::placeholder': {
                    color: '#bbb49b',
                    opacity: 1,
                  },
                }}
              />
              <IconButton
                onClick={() => setShowPassword(!showPassword)}
                sx={{
                  position: 'absolute',
                  right: 12,
                  color: '#bbb49b',
                  '&:hover': { color: 'white' },
                }}
              >
                {showPassword ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </Box>
          </Box>

          <Button
            fullWidth
            variant="contained"
            sx={{
              backgroundColor: '#f9c806',
              color: '#231f0f',
              fontSize: '1rem',
              fontWeight: 700,
              height: 48,
              borderRadius: '0.5rem',
              textTransform: 'none',
              letterSpacing: '0.015em',
              '&:hover': { backgroundColor: '#ffd633' },
            }}
          >
            Log in
          </Button>
        </Stack>

        {/* Advanced Login Options Divider */}
        <Box sx={{ display: 'flex', alignItems: 'center', my: 3, gap: 2 }}>
          <Divider sx={{ flex: 1, borderColor: '#3a3627' }} />
          <Typography sx={{ fontSize: '0.875rem', color: '#bbb49b' }}>Advanced login options</Typography>
          <Divider sx={{ flex: 1, borderColor: '#3a3627' }} />
        </Box>

        {/* Advanced Options */}
        <Stack spacing={1.5} sx={{ mb: 6 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<Fingerprint />}
            onClick={() => {
              if (emailLogin.trim()) {
                setEmail(emailLogin.trim());
                continueWithPasskey();
              } else {
                setMessage('Please enter an email address');
              }
            }}
            disabled={loading}
            sx={{
              backgroundColor: '#3a3627',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 700,
              height: 48,
              borderRadius: '0.5rem',
              textTransform: 'none',
              letterSpacing: '0.015em',
              '&:hover': { backgroundColor: '#4a4637' },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
            Continue with Passkey
          </Button>

          <Button
            fullWidth
            variant="contained"
            startIcon={<AccountBalanceWallet />}
            sx={{
              backgroundColor: '#3a3627',
              color: 'white',
              fontSize: '1rem',
              fontWeight: 700,
              height: 48,
              borderRadius: '0.5rem',
              textTransform: 'none',
              letterSpacing: '0.015em',
              '&:hover': { backgroundColor: '#4a4637' },
            }}
          >
            Continue with Wallet
          </Button>
        </Stack>

        {/* Support Link */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Link href="#" style={{ textDecoration: 'none' }}>
            <Typography sx={{ fontSize: '0.875rem', color: '#f9c806', '&:hover': { textDecoration: 'underline' } }}>
              Issue with login?
            </Typography>
          </Link>
        </Box>

        {/* Footer */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#bbb49b' }}>
            By continuing, you agree to our{' '}
            <Link href="#" style={{ textDecoration: 'none' }}>
              <span style={{ textDecoration: 'underline', color: 'inherit' }}>Terms of Service</span>
            </Link>
            {' '}and{' '}
            <Link href="#" style={{ textDecoration: 'none' }}>
              <span style={{ textDecoration: 'underline', color: 'inherit' }}>Privacy Policy</span>
            </Link>
            .
          </Typography>
        </Box>

        {/* Message Alert */}
        {message && (
          <Alert severity={message.toLowerCase().includes('error') ? 'error' : 'success'} sx={{ mt: 3 }}>
            {message}
          </Alert>
        )}
      </Box>
    </Box>
  );
}

