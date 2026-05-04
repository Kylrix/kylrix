'use client';

import { useColors, useTheme } from '@/lib/theme-context';
import { useEffect, useState, useCallback, use } from 'react';
import { account, AppwriteService } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import PreferencesManager from '@/components/PreferencesManager';
import SessionsManager from '@/components/SessionsManager';
import ActivityLogs from '@/components/ActivityLogs';
import ConnectedIdentities from '@/components/ConnectedIdentities';
import MasterPassManager from '@/components/MasterPassManager';
import PinManager from '@/components/PinManager';
import ProfileManager from '@/components/ProfileManager';
import ReferralManager from '@/components/ReferralManager';
import SudoModal from '@/components/overlays/SudoModal';
import { TwoFactorDrawer } from '@/components/overlays/TwoFactorDrawer';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Chip,
  alpha,
  TextField,
} from '@mui/material';

interface UserData {
  email: string;
  name: string;
  userId: string;
  lastUsernameEdit?: string;
  profilePicId?: string | null;
  emailVerified?: boolean;
  mfaEnabledAt?: string | null;
  mfaLastVerifiedAt?: string | null;
  mfaPrimaryFactor?: 'email' | 'totp' | null;
}

interface MfaFactorsState {
  email: boolean;
  totp: boolean;
  phone: boolean;
}

export default function SubSettingsPage(props: { params: Promise<{ subsettings: string }> }) {
  const params = use(props.params);
  const dynamicColors = useColors();
  const { isDark } = useTheme();
  const router = useRouter();
  const subsettings = params?.subsettings || 'profile';

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [loginMethod, setLoginMethod] = useState<'email-otp' | 'oauth2' | 'password' | 'unknown'>('unknown');
  const [twoFactorSudoOpen, setTwoFactorSudoOpen] = useState(false);
  const [twoFactorDrawerOpen, setTwoFactorDrawerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<MfaFactorsState | null>(null);
  const [profileStatus, setProfileStatus] = useState<{ label: string, color: string } | null>(null);
  const [giftUsername, setGiftUsername] = useState('');
  const [giftMonths, setGiftMonths] = useState('1');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);

  const checkInitialStatus = useCallback(async (userId: string, email?: string) => {
    try {
      const status = await AppwriteService.getGlobalProfileStatus(userId);
      if (!status.exists) {
        const suggestion = email?.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
        setProfileStatus({ 
          label: `Profile missing from directory. Clicking below will link you as @${suggestion}.`, 
          color: dynamicColors.primary 
        });
      } else {
        setProfileStatus({ 
          label: `Correctly linked in directory as @${status.profile?.username || 'user'}`, 
          color: '#10b981' 
        });
      }
    } catch (_e: unknown) {
      setProfileStatus({ label: 'Unable to verify directory status.', color: '#ef4444' });
    }
  }, [dynamicColors.primary]);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const [userData, session, factors] = await Promise.all([
          account.get(),
          account.getSession('current').catch(() => null),
          account.listMfaFactors().catch(() => null),
        ]);
        if (mounted) {
          const normalizedFactors = factors
            ? {
                email: Boolean((factors as any).email),
                totp: Boolean((factors as any).totp),
                phone: Boolean((factors as any).phone),
              }
            : null;
          setUser({
            email: userData.email,
            name: userData.prefs?.username || userData.name || userData.email.split('@')[0],
            userId: userData.$id,
            lastUsernameEdit: userData.prefs?.last_username_edit,
            profilePicId: userData.prefs?.profilePicId || null,
            emailVerified: Boolean((userData as any)?.emailVerification),
            mfaEnabledAt: userData.prefs?.mfaEnabledAt || null,
            mfaLastVerifiedAt: userData.prefs?.mfaLastVerifiedAt || null,
            mfaPrimaryFactor: userData.prefs?.mfaPrimaryFactor || null,
          });
          setMfaFactors(normalizedFactors);
          setLoginMethod(((session as any)?.provider || '').toLowerCase().includes('email')
            ? 'email-otp'
            : ((session as any)?.provider || '').toLowerCase().includes('oauth')
              ? 'oauth2'
              : ((session as any)?.provider || '').toLowerCase().includes('password')
                ? 'password'
                : 'unknown');
          setLoading(false);
          checkInitialStatus(userData.$id, userData.email);
        }
      } catch (_err) {
        if (mounted) router.push('/login');
      }
    }
    init();
    return () => { mounted = false; };
  }, [router, checkInitialStatus]);

  useEffect(() => {
    // Handle hash scrolling
    if (!loading && window.location.hash) {
      const id = window.location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [loading, subsettings]);

  const handleFixDiscoverability = async () => {
    setSyncing(true);
    setSyncSuccess(false);
    try {
      const userData = await account.get();
      const result = await AppwriteService.ensureGlobalProfile(userData);
      setSyncSuccess(true);
      setProfileStatus({ 
        label: `Successfully synced! Your global username is now @${result?.username || 'user'}`, 
        color: '#10b981' 
      });
      setUser(prev => prev ? { ...prev, name: result?.username || prev.name } : null);
      setTimeout(() => setSyncSuccess(false), 5000);
    } catch (err: unknown) {
      console.error('Manual sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleGiftCheckout = useCallback(async () => {
    const recipientQuery = giftUsername.trim();
    if (!recipientQuery) {
      setGiftError('Enter a recipient username.');
      return;
    }

    setGiftLoading(true);
    setGiftError(null);

    try {
      const matches = await AppwriteService.searchGlobalProfiles(recipientQuery, 1);
      const recipient = (matches[0] as any) || null;

      let recipientUserId = recipient?.userId || null;
      let recipientLabel = recipient?.displayName || recipient?.username || null;

      if (!recipientUserId) {
        const directLookup = await AppwriteService.getGlobalProfileStatus(recipientQuery);
        recipientUserId = directLookup?.profile?.userId || null;
        recipientLabel = directLookup?.profile?.displayName || directLookup?.profile?.username || recipientLabel;
      }

      if (!recipientUserId) {
        throw new Error('No matching account found for that username or user ID.');
      }

      const normalizedMonths = Math.max(1, Number.parseInt(giftMonths || '1', 10) || 1);
      const checkoutUrl = new URL('/subscription/pro/checkout', window.location.origin);
      checkoutUrl.searchParams.set('planId', normalizedMonths >= 12 ? 'PRO_YEAR' : 'PRO_MONTH');
      checkoutUrl.searchParams.set('months', String(normalizedMonths));
      checkoutUrl.searchParams.set('giftRecipientId', recipientUserId);
      checkoutUrl.searchParams.set('giftRecipientName', recipientLabel || recipientUserId);

      window.location.assign(checkoutUrl.toString());
    } catch (error: unknown) {
      setGiftError((error as Error)?.message || 'Failed to start gift checkout.');
    } finally {
      setGiftLoading(false);
    }
  }, [giftMonths, giftUsername]);

  const refreshTwoFactorStatus = useCallback(async () => {
    try {
      const [freshUser, factors] = await Promise.all([
        account.get(),
        account.listMfaFactors().catch(() => null),
      ]);
      const normalizedFactors = factors
        ? {
            email: Boolean((factors as any).email),
            totp: Boolean((factors as any).totp),
            phone: Boolean((factors as any).phone),
          }
        : null;
      setMfaFactors(normalizedFactors);
      setUser(prev => prev ? {
        ...prev,
        emailVerified: Boolean((freshUser as any)?.emailVerification),
        mfaEnabledAt: freshUser.prefs?.mfaEnabledAt || null,
        mfaLastVerifiedAt: freshUser.prefs?.mfaLastVerifiedAt || null,
        mfaPrimaryFactor: freshUser.prefs?.mfaPrimaryFactor || null,
      } : null);
    } catch {
      // keep current UI state
    }
  }, []);

  const handleTwoFactorSuccess = useCallback(() => {
    setTwoFactorSudoOpen(false);
    setTwoFactorDrawerOpen(true);
  }, []);

  if (loading || !user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress sx={{ color: dynamicColors.primary }} />
      </Box>
    );
  }

  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const surfaceColor = isDark ? 'rgba(15, 13, 12, 0.6)' : 'rgba(245, 245, 245, 0.6)';
  const brandIndigo = '#6366F1';
  const secondaryText = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
  const accountMfaEnabled = Boolean(mfaFactors?.email && mfaFactors?.totp);

    return (
    <Box sx={{ animation: 'fadeIn 0.4s ease-out', bgcolor: '#000000', minHeight: '100vh', p: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 6, display: { xs: 'none', md: 'block' } }}>
        <Typography
          sx={{
            fontSize: { md: '2.5rem', lg: '3rem' },
            fontWeight: 900,
            color: textColor,
            lineHeight: 1.1,
            letterSpacing: '-0.04em',
            fontFamily: 'var(--font-clash)',
            textTransform: 'capitalize'
          }}
        >
          {subsettings} Configuration
        </Typography>
        <Typography sx={{ color: secondaryText, mt: 1.5, fontSize: '1.1rem', fontWeight: 500, maxWidth: '600px' }}>
          Manage your global {subsettings} protocols and ecosystem preferences.
        </Typography>
      </Box>

      {subsettings === 'profile' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Box
              id="identity"
              sx={{
              bgcolor: '#161514',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${borderColor}`,
              borderRadius: '32px',
              p: { xs: 3, md: 5 },
              }}
          >
              <ProfileManager 
              onProfileUpdate={(data) => {
                  setUser(prev => prev ? {
                  ...prev,
                  ...(data.name && { name: data.name }),
                  ...(data.profilePicId !== undefined && { profilePicId: data.profilePicId })
                  } : null);
              }}
              />
          </Box>

          <Box id="identifiers">
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>identifiers</Typography>
              <Stack spacing={2.5}>
                  <Box
                  sx={{
                      backgroundColor: alpha(surfaceColor, 0.3),
                      border: `1px solid ${borderColor}`,
                      borderRadius: '20px',
                      p: 3.5,
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: 3,
                  }}
                  >
                  <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: secondaryText, fontWeight: 800, textTransform: 'uppercase', mb: 1, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>Primary Mail Relay</Typography>
                      <Typography sx={{ fontSize: '1.2rem', color: textColor, fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {user.email}
                      </Typography>
                  </Box>
                  <Button
                      onClick={() => navigator.clipboard.writeText(user.email)}
                      variant="outlined"
                      sx={{
                      borderColor: borderColor,
                      color: textColor,
                      fontWeight: 800,
                      borderRadius: '12px',
                      textTransform: 'none',
                      px: 3.5,
                      py: 1,
                      '&:hover': { borderColor: brandIndigo, backgroundColor: alpha(brandIndigo, 0.05) },
                      }}
                  >
                      Copy ID
                  </Button>
                  </Box>

                  <Box
                  sx={{
                      backgroundColor: alpha(surfaceColor, 0.3),
                      border: `1px solid ${borderColor}`,
                      borderRadius: '20px',
                      p: 3.5,
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      justifyContent: 'space-between',
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      gap: 3,
                  }}
                  >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.7rem', color: secondaryText, fontWeight: 800, textTransform: 'uppercase', mb: 1, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>Unique Node Signature</Typography>
                      <Typography
                      sx={{
                          fontSize: '0.95rem',
                          color: textColor,
                          fontFamily: 'var(--font-mono)',
                          wordBreak: 'break-all',
                          opacity: 0.8,
                          fontWeight: 500
                      }}
                      >
                      {user.userId}
                      </Typography>
                  </Box>
                  <Button
                      onClick={() => navigator.clipboard.writeText(user.userId)}
                      variant="outlined"
                      sx={{
                      borderColor: borderColor,
                      color: textColor,
                      fontWeight: 800,
                      borderRadius: '12px',
                      textTransform: 'none',
                      px: 3.5,
                      py: 1,
                      '&:hover': { borderColor: brandIndigo, backgroundColor: alpha(brandIndigo, 0.05) },
                      }}
                  >
                      Copy Signature
                  </Button>
                  </Box>
              </Stack>
          </Box>

          <Box id="pulse">
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>pulse</Typography>
              <Box
                  sx={{
                  backgroundColor: alpha(brandIndigo, 0.02),
                  border: `1px solid ${alpha(brandIndigo, 0.15)}`,
                  borderRadius: '28px',
                  p: 4,
                  }}
              >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                  <Box 
                      sx={{ 
                      width: 12, 
                      height: 12, 
                      borderRadius: '50%', 
                      backgroundColor: profileStatus?.color || brandIndigo,
                      boxShadow: `0 0 12px ${profileStatus?.color || brandIndigo}`
                      }} 
                  />
                  <Typography sx={{ fontSize: '1.1rem', color: textColor, fontWeight: 800, letterSpacing: '-0.01em' }}>
                      Global Directory Synchrony
                  </Typography>
                  </Box>
                  
                  {profileStatus && (
                  <Typography sx={{ fontSize: '0.95rem', color: secondaryText, mb: profileStatus.label.includes('Correctly linked') ? 0 : 3, fontWeight: 500, lineHeight: 1.7 }}>
                      {profileStatus.label}
                  </Typography>
                  )}

                  {!profileStatus?.label.includes('Correctly linked') && (
                  <>
                      <Typography sx={{ fontSize: '0.9rem', color: secondaryText, mb: 4, opacity: 0.7 }}>
                      Ensure your identity is broadcasted across all nodes to enable seamless interaction in Note, Flow, and Connect.
                      </Typography>
                      <Button
                      onClick={handleFixDiscoverability}
                      disabled={syncing}
                      variant="contained"
                      sx={{
                          backgroundColor: brandIndigo,
                          color: '#000',
                          fontWeight: 900,
                          borderRadius: '14px',
                          textTransform: 'none',
                          px: 4,
                          py: 1.5,
                          fontSize: '0.95rem',
                          boxShadow: `0 8px 20px ${alpha(brandIndigo, 0.2)}`,
                          '&:hover': {
                              backgroundColor: alpha(brandIndigo, 0.9),
                              transform: 'translateY(-2px)'
                          },
                          transition: 'all 0.2s'
                      }}
                      >
                      {syncing ? <CircularProgress size={20} sx={{ mr: 1, color: 'inherit' }} /> : null}
                      {syncSuccess ? 'IDENTITY SYNCED' : 'INITIALIZE SYNC'}
                      </Button>
                  </>
                  )}
              </Box>
          </Box>

          <Box
            sx={{
              backgroundColor: alpha(surfaceColor, 0.3),
              border: `1px solid ${borderColor}`,
              borderRadius: '28px',
              p: { xs: 3, md: 4 },
            }}
          >
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, mb: 1, fontFamily: 'var(--font-clash)' }}>
              Gift Pro
            </Typography>
            <Typography sx={{ color: secondaryText, mb: 3 }}>
              Send a subscription gift to another Kylrix account. The recipient will claim it automatically on login.
            </Typography>

            <Stack spacing={2}>
              <TextField
                value={giftUsername}
                onChange={(e) => setGiftUsername(e.target.value)}
                placeholder="Recipient username"
                fullWidth
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    color: textColor,
                    bgcolor: alpha('#FFFFFF', 0.02),
                    '& fieldset': { borderColor },
                  },
                }}
              />
              <TextField
                value={giftMonths}
                onChange={(e) => setGiftMonths(e.target.value)}
                placeholder="Months"
                type="number"
                inputProps={{ min: 1 }}
                fullWidth
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    color: textColor,
                    bgcolor: alpha('#FFFFFF', 0.02),
                    '& fieldset': { borderColor },
                  },
                }}
              />
              {giftError && (
                <Typography sx={{ color: '#ef4444', fontSize: '0.9rem' }}>
                  {giftError}
                </Typography>
              )}
              <Button
                onClick={() => void handleGiftCheckout()}
                disabled={giftLoading}
                sx={{
                  alignSelf: 'flex-start',
                  bgcolor: brandIndigo,
                  color: '#fff',
                  fontWeight: 800,
                  borderRadius: '12px',
                  textTransform: 'none',
                  px: 3,
                  '&:hover': { bgcolor: '#4f46e5' },
                }}
              >
                {giftLoading ? 'Preparing Gift...' : 'Gift Subscription'}
              </Button>
            </Stack>
          </Box>

          <Box id="referrals">
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
                referrals
              </Typography>
              <ReferralManager />
          </Box>
          </Box>
      )}

      {subsettings === 'security' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Box id="masterpass">
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
              encryption
              </Typography>
              <Box
              sx={{
                  bgcolor: '#161514',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '32px',
                  p: { xs: 3, md: 5 },
              }}
              >
              <MasterPassManager userId={user.userId} />
              </Box>
          </Box>

          <Box id="pin">
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
              quick access
              </Typography>
              <Box
              sx={{
                  bgcolor: '#161514',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '32px',
                  p: { xs: 3, md: 5 },
              }}
              >
              <PinManager />
              </Box>
          </Box>

          <Box id="mfa">
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
                2fa
              </Typography>
              <Box
                sx={{
                  backgroundColor: alpha(surfaceColor, 0.3),
                  border: `1px solid ${borderColor}`,
                  borderRadius: '28px',
                  p: 4,
                }}
              >
                <Stack spacing={2.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 3, flexDirection: { xs: 'column', sm: 'row' } }}>
                    <Box>
                      <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, color: textColor, mb: 1 }}>
                        2FA status
                      </Typography>
                      <Typography sx={{ fontSize: '0.95rem', color: secondaryText, maxWidth: '540px', lineHeight: 1.6 }}>
                        2FA is on only when both Email and TOTP are enabled.
                      </Typography>
                    </Box>
                    <Button
                      onClick={() => setTwoFactorSudoOpen(true)}
                      variant="contained"
                      sx={{
                        backgroundColor: brandIndigo,
                        color: 'white',
                        fontWeight: 900,
                        borderRadius: '14px',
                        textTransform: 'none',
                        px: 3,
                      }}
                    >
                      {accountMfaEnabled ? 'Manage 2FA' : 'Set up 2FA'}
                    </Button>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip label={`2FA: ${accountMfaEnabled ? 'enabled' : 'off'}`} sx={{ bgcolor: alpha(accountMfaEnabled ? '#10b981' : '#f59e0b', 0.16), color: 'white' }} />
                    <Chip label={`Email: ${mfaFactors?.email ? 'enabled' : 'off'}`} sx={{ bgcolor: alpha('#10B981', 0.16), color: 'white' }} />
                    <Chip label={`TOTP: ${mfaFactors?.totp ? 'enabled' : 'off'}`} sx={{ bgcolor: alpha('#F59E0B', 0.16), color: 'white' }} />
                  </Box>

                  <Typography sx={{ fontSize: '0.92rem', color: secondaryText, lineHeight: 1.7 }}>
                    {accountMfaEnabled
                      ? 'Email and TOTP are both enabled.'
                      : 'Tap set up 2FA to register email first, then TOTP.'}
                  </Typography>
                </Stack>
              </Box>
          </Box>
          </Box>
      )}

      {subsettings === 'sessions' && (
          <Box id="active-sessions">
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>sessions</Typography>
          <Box
              sx={{
              bgcolor: '#161514',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${borderColor}`,
              borderRadius: '32px',
              p: { xs: 3, md: 5 },
              }}
          >
              <SessionsManager />
          </Box>
          </Box>
      )}

      {subsettings === 'activity' && (
          <Box id="activity-log">
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>activity</Typography>
          <Box
              sx={{
              bgcolor: '#161514',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${borderColor}`,
              borderRadius: '32px',
              p: { xs: 3, md: 5 },
              }}
          >
              <ActivityLogs />
          </Box>
          </Box>
      )}

      {subsettings === 'identities' && (
          <Box id="oauth">
          <Box
              sx={{
              bgcolor: '#161514',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${borderColor}`,
              borderRadius: '32px',
              p: { xs: 3, md: 5 },
              }}
          >
              <ConnectedIdentities />
          </Box>
          </Box>
      )}

      {subsettings === 'preferences' && (
          <Box id="env-prefs">
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 3, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>preferences</Typography>
          <Box
              sx={{
              bgcolor: '#161514',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${borderColor}`,
              borderRadius: '32px',
              p: { xs: 3, md: 5 },
              }}
          >
              <PreferencesManager />
          </Box>
          </Box>
      )}

      {subsettings === 'account' && (
          <Box id="root-mgmt">
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, mb: 4, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>account</Typography>
          
          <Stack spacing={3}>
              <Box
              id="export"
              sx={{
                  backgroundColor: alpha(surfaceColor, 0.3),
                  border: `1px solid ${borderColor}`,
                  borderRadius: '28px',
                  p: 5,
              }}
              >
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', lg: 'center' }, gap: 4 }}>
                  <Box>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: textColor, mb: 1 }}>
                      Identity Data Export
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', color: secondaryText, maxWidth: '600px', lineHeight: 1.6 }}>
                      Download a full cryptographic archive of your account data. This process may take several minutes to compile.
                  </Typography>
                  </Box>
                  <Button
                  variant="outlined"
                  sx={{
                      color: textColor,
                      borderColor: borderColor,
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      textTransform: 'none',
                      borderRadius: '14px',
                      px: 4,
                      py: 1.5,
                      minWidth: '200px',
                      '&:hover': { 
                      borderColor: brandIndigo,
                      backgroundColor: alpha(brandIndigo, 0.05),
                      },
                  }}
                  >
                  PREPARE ARCHIVE
                  </Button>
              </Box>

              <Divider sx={{ my: 5, borderColor: borderColor }} />

              <Box id="purge" sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', lg: 'center' }, gap: 4 }}>
                  <Box>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444', mb: 1 }}>
                      Node Decommissioning
                  </Typography>
                  <Typography sx={{ fontSize: '1rem', color: secondaryText, maxWidth: '600px', lineHeight: 1.6 }}>
                      Permanently terminate this identity node and purge all associated encrypted data from the ecosystem. This operation is terminal.
                  </Typography>
                  </Box>
                  <Button
                  variant="contained"
                  sx={{
                      backgroundColor: alpha('#ef4444', 0.1),
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      fontSize: '0.9rem',
                      fontWeight: 900,
                      textTransform: 'none',
                      borderRadius: '14px',
                      px: 4,
                      py: 1.5,
                      minWidth: '200px',
                      '&:hover': {
                      backgroundColor: alpha('#ef4444', 0.2),
                      borderColor: '#ef4444',
                      },
                  }}
                  >
                  PURGE IDENTITY
                  </Button>
              </Box>
              </Box>
          </Stack>
          </Box>
      )}

      <SudoModal
        isOpen={twoFactorSudoOpen}
        onSuccess={handleTwoFactorSuccess}
        onCancel={() => setTwoFactorSudoOpen(false)}
      />

      {user && (
        <TwoFactorDrawer
          open={twoFactorDrawerOpen}
          onClose={() => setTwoFactorDrawerOpen(false)}
          userId={user.userId}
          emailVerified={Boolean(user.emailVerified)}
          loginMethod={loginMethod}
          mode="setup"
          onEnabled={refreshTwoFactorStatus}
        />
      )}
    </Box>
  );
}
