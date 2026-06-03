"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppwriteVault } from '@/context/appwrite-context';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@/lib/mui-tailwind/material';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { AppwriteService, setMasterpassFlag } from '@/lib/appwrite';
import toast from 'react-hot-toast';
import { Shield, Lock, Fingerprint, ArrowRight, CheckCircle, Info } from 'lucide-react';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';

/**
 * /masterpass - Master Password Management Page
 * Handles first-time MasterPass setup and recovery from missing-keychain states.
 */
export default function MasterPassPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: 'calc(100vh - 88px)', bgcolor: '#0A0908', py: { xs: 4, md: 8 }, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={28} sx={{ color: '#6366F1' }} />
        </Box>
      }
    >
      <MasterPassPageInner />
    </Suspense>
  );
}

function MasterPassPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAppwriteVault();
  const [checking, setChecking] = useState(true);
  const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Passkey integration
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);
  const [setupFinished, setSetupFinished] = useState(false);

  const callbackUrl = useMemo(() => {
    const raw = searchParams.get('callbackUrl');
    if (!raw) return '/vault/dashboard';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      const url = new URL(raw, origin || 'https://kylrix.space');
      if (origin && url.origin !== origin) return '/vault/dashboard';
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return '/vault/dashboard';
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/vault/dashboard');
      return;
    }
    if (!user?.$id) return;

    let cancelled = false;
    setChecking(true);
    AppwriteService.listKeychainEntries(user.$id)
      .then((entries: Array<{ type?: string }>) => {
        if (cancelled) return;
        const passwordPresent = entries.some((entry) => entry.type === 'password');
        setHasMasterpass(passwordPresent);
        if (passwordPresent && !setupFinished) {
          router.replace(callbackUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setHasMasterpass(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, router, callbackUrl, setupFinished]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.$id || !user.email) return;
    if (password.length < 8) {
      toast.error('Master password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      // Hard check against race conditions or direct page access
      if (hasMasterpass) {
          toast.error('Vault already initialized. Redirecting...');
          router.replace(callbackUrl);
          return;
      }

      const success = await masterPassCrypto.unlock(password, user.$id, true);
      if (!success) {
        toast.error('Could not initialize master password.');
        return;
      }
      await setMasterpassFlag(user.$id, user.email);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kylrix:masterpass-updated'));
      }
      
      setHasMasterpass(true);
      setSetupFinished(true);
      toast.success('MasterPass configured.');
      
      // Immediately offer passkey setup
      setShowPasskeySetup(true);
    } catch (err: any) {
      console.error('MasterPass setup error:', err);
      if (err.message === 'VAULT_ALREADY_EXISTS') {
          toast.error('Your vault is already initialized. Please login normally.');
          router.replace(callbackUrl);
      } else {
          toast.error('Failed to set up master password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasskeySuccess = () => {
      setShowPasskeySetup(false);
      router.replace(callbackUrl);
  };

  const skipPasskey = () => {
      setShowPasskeySetup(false);
      router.replace(callbackUrl);
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 88px)', bgcolor: '#000000', py: { xs: 4, md: 10 }, px: 2 }}>
      <Container maxWidth="sm">
        <Paper sx={{ 
            p: { xs: 3, md: 5 }, 
            borderRadius: '32px', 
            bgcolor: '#161412', // Dark Ash
            border: '1px solid #23211F', // Surface edge
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden'
        }}>
          {/* Subtle accent background element */}
          <Box sx={{ 
              position: 'absolute', 
              top: -40, 
              right: -40, 
              width: 120, 
              height: 120, 
              bgcolor: '#6366F1', 
              filter: 'blur(60px)', 
              opacity: 0.15,
              zIndex: 0
          }} />

          <Stack spacing={4} component="form" onSubmit={handleSubmit} sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '16px', 
                  bgcolor: '#1C1A18', 
                  border: '1px solid #34322F',
                  display: 'grid',
                  placeItems: 'center',
                  mx: 'auto',
                  mb: 3
              }}>
                <Shield size={28} color="#6366F1" />
              </Box>
              <Typography variant="h4" sx={{ 
                  color: '#fff', 
                  fontWeight: 900, 
                  fontFamily: 'var(--font-clash)', 
                  letterSpacing: '-0.02em',
                  mb: 1
              }}>
                Secure Your Vault
              </Typography>
              <Typography sx={{ 
                  color: '#9B9691', 
                  fontSize: '0.95rem', 
                  fontFamily: 'var(--font-satoshi)',
                  maxWidth: '320px',
                  mx: 'auto'
              }}>
                Set a MasterPass to enable end-to-end encryption for your secrets and messages.
              </Typography>
            </Box>

            {checking || hasMasterpass === null ? (
              <Box sx={{ py: 6, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={28} sx={{ color: '#6366F1' }} />
              </Box>
            ) : hasMasterpass ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                    <Box sx={{ 
                        width: 64, 
                        height: 64, 
                        borderRadius: '50%', 
                        bgcolor: alpha('#10B981', 0.1), 
                        border: '1px solid #10B981',
                        display: 'grid',
                        placeItems: 'center',
                        mx: 'auto',
                        mb: 3
                    }}>
                        <CheckCircle size={32} color="#10B981" />
                    </Box>
                    <Typography variant="h6" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                        Vault Already Active
                    </Typography>
                    <Typography sx={{ color: '#9B9691', fontSize: '0.9rem', mb: 4 }}>
                        Your encryption perimeter is already established. You can now access your secure data.
                    </Typography>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={() => router.replace(callbackUrl)}
                        sx={{ 
                            bgcolor: '#6366F1', 
                            color: '#fff', 
                            fontWeight: 900, 
                            borderRadius: '16px', 
                            py: 2,
                            '&:hover': { bgcolor: '#575CF0' }
                        }}
                    >
                        Go to Dashboard
                    </Button>
                </Box>
            ) : (
              <>
                <Box sx={{ 
                    bgcolor: '#1C1A18', 
                    p: 2, 
                    borderRadius: '16px', 
                    border: '1px solid #34322F',
                    display: 'flex',
                    gap: 2,
                    alignItems: 'flex-start'
                }}>
                  <Info size={20} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                  <Typography variant="caption" sx={{ color: '#9B9691', fontSize: '0.8rem', lineHeight: 1.5, fontWeight: 500 }}>
                    <strong style={{ color: '#fff' }}>Critical:</strong> This password cannot be recovered. If lost, your encrypted data will be permanently inaccessible. Save it in a safe place.
                  </Typography>
                </Box>

                <Stack spacing={2}>
                    <TextField
                    fullWidth
                    type="password"
                    placeholder="Create Master Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="new-password"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#0A0908',
                            borderRadius: '14px',
                            '& fieldset': { borderColor: '#23211F' },
                            '&:hover fieldset': { borderColor: '#34322F' },
                            '&.Mui-focused fieldset': { borderColor: '#6366F1' },
                        },
                        '& input': { color: '#fff', fontFamily: 'var(--font-mono)', py: 1.75 }
                    }}
                    />
                    <TextField
                    fullWidth
                    type="password"
                    placeholder="Confirm Master Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            bgcolor: '#0A0908',
                            borderRadius: '14px',
                            '& fieldset': { borderColor: '#23211F' },
                            '&:hover fieldset': { borderColor: '#34322F' },
                            '&.Mui-focused fieldset': { borderColor: '#6366F1' },
                        },
                        '& input': { color: '#fff', fontFamily: 'var(--font-mono)', py: 1.75 }
                    }}
                    />
                </Stack>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting || !password || password !== confirmPassword}
                  fullWidth
                  sx={{ 
                      bgcolor: '#6366F1', 
                      color: '#fff', 
                      fontWeight: 900, 
                      borderRadius: '16px', 
                      py: 2,
                      fontFamily: 'var(--font-clash)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      transition: 'all 0.3s ease',
                      '&:hover': { bgcolor: '#575CF0', transform: 'translateY(-2px)' },
                      '&:disabled': { bgcolor: '#1C1A18', color: '#34322F', borderColor: '#23211F' }
                  }}
                >
                  {submitting ? <CircularProgress size={24} color="inherit" /> : (
                      <Stack direction="row" spacing={1} alignItems="center">
                          <span>Initialize Secure Vault</span>
                          <ArrowRight size={18} />
                      </Stack>
                  )}
                </Button>
              </>
            )}
          </Stack>
        </Paper>

        <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#34322F', fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.1em' }}>
                KYLRIX • WESP SECURE ENCLAVE • V3.0
            </Typography>
        </Box>
      </Container>

      {/* Post-Setup Passkey Onboarding */}
      {user?.$id && (
          <PasskeySetup 
            open={showPasskeySetup}
            userId={user.$id}
            onClose={skipPasskey}
            onSuccess={handlePasskeySuccess}
            trustUnlocked={true}
          />
      )}
    </Box>
  );
}
