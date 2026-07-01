"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Drawer,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Box,
  Stack,
  CircularProgress,
  alpha,
  useTheme,
  useMediaQuery
} from '@/lib/openbricks/primitives';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  LockIcon,
  Shield as ShieldIcon,
  Logout as LogoutIcon,
  FingerprintOutlined as FingerprintIcon,
  ErrorOutline as ErrorOutlineIcon,
  Apps as AppsIcon,
  Close as CloseIcon,
} from '@/lib/openbricks/icons';
import Logo from '../common/Logo';
import { useAppwriteVault } from '@/context/appwrite-context';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { useFinalizeAuth } from '@/lib/finalizeAuth';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import {
  setMasterpassFlag,
  AppwriteService,
} from '@/lib/appwrite';
import { checkRateLimit, getBlockedDuration } from '@/lib/rate-limiter';
import toast from 'react-hot-toast';
import { unlockWithPasskey } from '@/lib/passkey';
import { PasskeySetup } from './PasskeySetup';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

interface MasterPassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  intent?: 'unlock' | 'initialize' | 'upgrade';
}

const VAULT_PRIMARY = "#10B981"; // Emerald
const BG_COLOR = "#0A0908";
const SURFACE_COLOR = "#161412";

export function MasterPassDrawer({ isOpen, onClose, intent = 'unlock' }: MasterPassDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { setIsDrawerOpen } = useDrawerState();

  useEffect(() => {
    setIsDrawerOpen(isOpen);
    if (!isOpen) {
        passkeyTriggeredRef.current = false;
    }
    return () => setIsDrawerOpen(false);
  }, [isOpen, setIsDrawerOpen]);

  const [masterPassword, setMasterPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLock] = useState(false);
  const [confirmCapsLock] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [showPasskeyIncentive, setShowPasskeyIncentive] = useState(false);
  const passkeyTriggeredRef = useRef(false);

  const [passkeyIncentiveDone, setPasskeyIncentiveDone] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'upgrading' | 'success' | 'error'>('idle');
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [isCriticalError, setIsCriticalError] = useState(false);
  const [isPendingVault, setIsPendingVault] = useState(false);
  const isMigratingRef = useRef(false);

  useEffect(() => {
      if (migrationStatus !== 'upgrading') {
          if (migrationStatus === 'success') setMigrationProgress(100);
          return;
      }
      
      setMigrationProgress(0);
      const interval = setInterval(() => {
          setMigrationProgress(prev => {
              if (prev >= 95) {
                  clearInterval(interval);
                  return prev;
              }
              return prev + Math.random() * 15;
          });
      }, 350);
      
      return () => clearInterval(interval);
  }, [migrationStatus]);

  const { user, refresh, logout } = useAppwriteVault();
  const { finalizeAuth } = useFinalizeAuth();
  const router = useRouter();

  const onSuccess = useCallback(async () => {
    // 1. Sudo Hook: Ensure E2E Identity is created and published
    if (user?.$id) {
      try {
        console.log("Synchronizing Identity...");
        await ecosystemSecurity.ensureE2EIdentity(user.$id);
      } catch (e) {
        console.error("Failed to sync identity on unlock", e);
      }
    }

    // 2. Refresh global Appwrite context state so route guards see the unlocked vault
    await refresh();

    // 3. Complete the flow and navigate once the state is settled
    await finalizeAuth({ redirect: true, fallback: "/vault" });
  }, [user?.$id, finalizeAuth, refresh]);

  const onSuccessRef = useRef(onSuccess);

  // Keep onSuccessRef updated without triggering useEffect re-runs
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  const [mode, setMode] = useState<"passkey" | "password" | "pin" | "initialize" | "migrating" | null>(null);

  useEffect(() => {
      if (!isOpen) return;

      masterPassCrypto.setMigrationCallbacks(
          () => {
              isMigratingRef.current = true;
              setMode("migrating");
              setMigrationStatus('upgrading');
              setIsCriticalError(false);
          },
          (success) => {
              setMigrationStatus(success ? 'success' : 'error');
              if (!success) {
                  setIsCriticalError(true);
                  return;
              }
              setTimeout(() => {
                  if (isOpen) {
                      onSuccessRef.current();
                      isMigratingRef.current = false;
                  }
              }, 1500);
          }
      );
      
      return () => {
          // Only clear if the drawer is truly closing to preserve mid-flight state
          if (!isMigratingRef.current) {
              masterPassCrypto.setMigrationCallbacks(() => {}, () => {});
          }
      };
  }, [isOpen]);

  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);

  const handleSuccessWithSync = onSuccess;

  const handlePinChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    setPin(val);
    if (val.length === 4 && user?.$id) {
      setLoading(true);
      try {
        const success = await ecosystemSecurity.unlockWithPin(val);
        if (success) {
          // Sync with MasterPassCrypto singleton for Vault access
          const rawMek = await crypto.subtle.exportKey("raw", ecosystemSecurity.getMasterKey()!);
          await masterPassCrypto.importKey(rawMek);
          await masterPassCrypto.unlockWithImportedKey();

          handleSuccessWithSync();
        } else {
          toast.error("Invalid PIN");
          setPin("");
        }
      } catch (_e: unknown) {
        toast.error("Verification failed");
        setPin("");
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePasskeyUnlock = useCallback(async () => {
    if (!user) return;
    setPasskeyLoading(true);
    try {
      const success = await unlockWithPasskey(user.$id);
      if (success) {
        toast.success("Identity verified via Passkey");

        // Sync with MasterPassCrypto singleton
        const rawMek = await crypto.subtle.exportKey("raw", ecosystemSecurity.getMasterKey()!);
        await masterPassCrypto.importKey(rawMek);
        await masterPassCrypto.unlockWithImportedKey();

        onSuccess();
      }
    } catch (e) {
      console.error("Passkey verification failed or cancelled", e);
    } finally {
      setPasskeyLoading(false);
    }
  }, [user, onSuccess]);

  useEffect(() => {
    if (!user || !isOpen) return;

    // Auto-success if already unlocked (EXCEPT for manual upgrades)
    if (masterPassCrypto.isVaultUnlocked() && intent !== 'upgrade') {
      onSuccess();
      return;
    }
    setLoading(true);

    const isKylrixDomain = typeof window !== 'undefined' && 
      (window.location.hostname === 'kylrix.space' || window.location.hostname.endsWith('.kylrix.space'));

    const pinSet = ecosystemSecurity.isPinSet();
    setHasPin(pinSet);

    // Check for keychain entries to determine mode
    AppwriteService.listKeychainEntries(user.$id)
      .then((entries: any[]) => {
        const passkeyPresent = entries.some((e: any) => e.type === 'passkey');
        const passwordEntries = entries.filter((e: any) => e.type === 'password');
        const passwordPresent = passwordEntries.length > 0;

        if (passwordPresent) {
          localStorage.setItem('kylrix_has_masterpass_' + user.$id, 'true');
        } else {
          localStorage.removeItem('kylrix_has_masterpass_' + user.$id);
        }

        // Prioritize stable over pending for authentication
        const stableEntry = passwordEntries.find(e => !e.isPending);
        const pendingEntry = passwordEntries.find(e => e.isPending);

        const bestEntry = stableEntry || pendingEntry || passwordEntries[0];

        // isPendingVault should be true if we are on a pending entry OR if a zombie pending entry exists
        setIsPendingVault(!!pendingEntry);

        // Disable passkey if not on kylrix.space domain

        const effectivePasskeyPresent = passkeyPresent && isKylrixDomain;

        setHasPasskey(effectivePasskeyPresent);
        setIsFirstTime(!passwordPresent);

        if (!passwordPresent) {
          setMode("initialize");
        } else if (intent === "upgrade") {
          setMode("password");
        } else if (effectivePasskeyPresent) {
          setMode("passkey");
          if (!passkeyTriggeredRef.current) {
              passkeyTriggeredRef.current = true;
              handlePasskeyUnlock();
          }
        } else if (pinSet) {
          setMode("pin");
        } else {
          setMode("password");
        }

      })
      .catch((err: any) => {
        console.warn("Failed to fetch keychain entries (likely offline):", err);
        const cachedHasMasterpass = typeof window !== 'undefined' && localStorage.getItem('kylrix_has_masterpass_' + user.$id) === 'true';
        if (cachedHasMasterpass) {
          setIsFirstTime(false);
          setMode("password");
        } else {
          setIsFirstTime(true);
          setMode("initialize");
        }
      })
      .finally(() => {
        setLoading(false);
      });

    // Reset state on open
    setMasterPassword("");
    setConfirmPassword("");
    setPin("");
  }, [user, isOpen, handlePasskeyUnlock, onSuccess, intent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.$id) return;
    setLoading(true);

    const rateLimitKey = `unlock_${user.$id}`;
    if (!checkRateLimit(rateLimitKey)) {
      const remainingTime = getBlockedDuration(rateLimitKey);
      toast.error(
        `Too many attempts. Please try again in ${remainingTime} seconds.`
      );
      setLoading(false);
      return;
    }

    try {
      if (mode === "initialize" || isFirstTime) {
        if (masterPassword !== confirmPassword) {
          toast.error("Passwords don't match");
          setLoading(false);
          return;
        }
        if (masterPassword.length < 8) {
          toast.error("Master password must be at least 8 characters");
          setLoading(false);
          return;
        }

        const success = await masterPassCrypto.unlock(
          masterPassword,
          user.$id,
          true
        );

        if (success) {
          await setMasterpassFlag(user.$id, user.email);
          const isKylrixDomain = typeof window !== 'undefined' && 
            (window.location.hostname === 'kylrix.space' || window.location.hostname.endsWith('.kylrix.space'));
          
          if (!hasPasskey && isKylrixDomain) {
            setShowPasskeyIncentive(true);
          } else {
            onSuccess();
          }
        } else {
          toast.error("Failed to set master password");
        }
      } else {
        const success = await masterPassCrypto.unlock(
          masterPassword,
          user.$id,
          false
        );

        if (success) {
          // IF MIGRATING: Don't call onSuccess yet.
          // The migration end callback will handle it after the visual delay.
          if (isMigratingRef.current) {
              return;
          }

          const skipTimestamp = localStorage.getItem(

            `passkey_skip_${user.$id}`
          );
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          const isKylrixDomain = typeof window !== 'undefined' && 
            (window.location.hostname === 'kylrix.space' || window.location.hostname.endsWith('.kylrix.space'));

          const shouldShowIncentive =
            !hasPasskey &&
            isKylrixDomain &&
            (!skipTimestamp ||
              Date.now() - parseInt(skipTimestamp) > sevenDays);

          if (shouldShowIncentive) {
            setShowPasskeyIncentive(true);
          } else {
            onSuccess();
          }
        } else {
          toast.error("Incorrect master password. Please try again.");
        }
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (
        e?.message?.includes("Vault is locked") ||
        e?.message?.includes("master password is incorrect")
      ) {
        toast.error("Incorrect master password. Please try again.");
      } else {
        toast.error("Failed to unlock vault");
      }
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    await logout();
    setLoading(false);
    onClose();
    router.replace("/");
  };

  if (!user || !isOpen) return null;

  if (showPasskeyIncentive) {
    return (
      <PasskeySetup
        open={true}
        onClose={onSuccess}
        userId={user.$id}
        onSuccess={onSuccess}
        trustUnlocked={true}
      />
    );
  }

  const drawerContent = (
    <Box sx={{ 
      p: { xs: 3, md: 4 },
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header with close button on mobile */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start',
        mb: 3
      }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ 
            fontWeight: 900, 
            mb: 0.5,
            fontSize: '1.25rem',
            color: 'white'
          }}>
            Unlock Your Vault
          </Typography>
          <Typography variant="caption" sx={{ 
            color: 'rgba(255, 255, 255, 0.5)',
            display: 'block'
          }}>
            Enter your master password to continue
          </Typography>
        </Box>
        {isMobile && (
          <IconButton 
            size="small" 
            onClick={onClose}
            sx={{ ml: 2 }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', mb: 3 }}>
        <Stack spacing={3} component="form" onSubmit={handleSubmit}>
          {isPendingVault && mode !== 'migrating' && (
              <Box sx={{ 
                  p: 2, 
                  bgcolor: alpha('#F59E0B', 0.05), 
                  borderRadius: '16px', 
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  gap: 2,
                  alignItems: 'flex-start'
              }}>
                  <ErrorOutlineIcon sx={{ color: '#F59E0B', mt: 0.25 }} />
                  <Box>
                      <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>Resuming High-Priority Upgrade</Typography>
                      <Typography variant="caption" sx={{ color: '#9B9691', lineHeight: 1.4, display: 'block', mt: 0.5 }}>
                          A previous cryptographic transition was interrupted. Please enter your master password to stabilize and finalize your T5 Core upgrade.
                      </Typography>
                  </Box>
              </Box>
          )}

          {mode === "migrating" && (

            <Box sx={{ 
                py: 6, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                textAlign: 'center',
                gap: 3 
            }}>
                <Box sx={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
                    <CircularProgress 
                        size={80} 
                        thickness={1.5} 
                        sx={{ color: migrationStatus === 'error' ? '#EF4444' : '#6366F1' }} 
                        variant="determinate"
                        value={migrationProgress}
                    />
                    <Box sx={{ position: 'absolute', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        {migrationStatus === 'upgrading' && (
                            <>
                                <ShieldIcon sx={{ fontSize: 24, color: '#6366F1', mb: 0.5 }} />
                                <Typography sx={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 900, color: 'white' }}>
                                    {Math.round(migrationProgress)}%
                                </Typography>
                            </>
                        )}
                        {migrationStatus === 'success' && <ShieldIcon sx={{ fontSize: 32, color: '#10B981' }} />}
                        {migrationStatus === 'error' && <ErrorOutlineIcon sx={{ fontSize: 32, color: '#EF4444' }} />}
                    </Box>
                </Box>

                <Box>
                    <Typography sx={{ fontWeight: 900, color: 'white', mb: 1, fontFamily: 'var(--font-clash)', fontSize: '1.25rem' }}>
                        {migrationStatus === 'upgrading' && 'Hardening Security...'}
                        {migrationStatus === 'success' && 'Upgrade Complete'}
                        {migrationStatus === 'error' && 'Critical Update Interrupted'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9B9691', maxWidth: '320px', mx: 'auto', mb: 3 }}>
                        {migrationStatus === 'upgrading' && 'Upgrading your vault to memory-hard Argon2id protection.'}
                        {migrationStatus === 'success' && 'Your identity is now protected with elite architectural standards.'}
                        {migrationStatus === 'error' && (
                            <Box sx={{ color: '#F59E0B', fontWeight: 800 }}>
                                DO NOT REFRESH THIS TAB. <br/>
                                <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>Your encryption key is currently resident in RAM. We are stabilizing your secure perimeter.</span>
                            </Box>
                        )}
                    </Typography>

                    {isCriticalError && (
                        <Button
                            variant="contained"
                            onClick={() => {
                                // Manual retry of the migration using the resident key
                                masterPassCrypto.unlock(masterPassword, user?.$id || "", false).catch(() => {});
                            }}
                            sx={{
                                bgcolor: '#F59E0B',
                                color: '#000',
                                fontWeight: 900,
                                borderRadius: '12px',
                                px: 4,
                                '&:hover': { bgcolor: '#D97706' }
                            }}
                        >
                            Retry Stabilization
                        </Button>
                    )}
                </Box>
            </Box>
          )}

          {mode === "pin" && (
            <>
              <TextField
                autoFocus
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={handlePinChange}
                disabled={loading}
                slotProps={{
                  htmlInput: {
                    maxLength: 4,
                  },
                  input: {
                    sx: {
                      fontFamily: 'monospace',
                      letterSpacing: '0.5em',
                      fontSize: '1.5rem',
                      textAlign: 'center',
                      WebkitTextSecurity: 'disc',
                    }
                  }
                }}
                sx={{
                  '& .ob-input-root': {
                    borderRadius: '16px',
                    bgcolor: alpha(VAULT_PRIMARY, 0.05),
                    border: `1px solid ${alpha(VAULT_PRIMARY, 0.2)}`,
                  }
                }}
              />
              <Typography variant="caption" sx={{ 
                color: 'rgba(255, 255, 255, 0.5)',
                textAlign: 'center'
              }}>
                Enter your 4-digit PIN
              </Typography>
            </>
          )}

          {mode === "password" && (
            <>
              <TextField
                autoFocus
                type={showPassword ? "text" : "password"}
                placeholder={isFirstTime ? "Set master password" : "Enter master password"}
                value={masterPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMasterPassword(e.target.value)}
                disabled={loading}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{
                  '& .ob-input-root': {
                    borderRadius: '16px',
                    bgcolor: alpha(VAULT_PRIMARY, 0.05),
                    border: `1px solid ${alpha(VAULT_PRIMARY, 0.2)}`,
                  },
                  '& input': {
                    WebkitTextSecurity: showPassword ? 'none' : 'disc',
                  }
                }}
              />

              {isFirstTime && (
                <TextField
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm master password"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                            size="small"
                          >
                            {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{
                    '& .ob-input-root': {
                      borderRadius: '16px',
                      bgcolor: alpha(VAULT_PRIMARY, 0.05),
                      border: `1px solid ${alpha(VAULT_PRIMARY, 0.2)}`,
                    },
                    '& input': {
                      WebkitTextSecurity: showConfirmPassword ? 'none' : 'disc',
                    }
                  }}
                />
              )}

              {confirmPassword.length > 0 && (
                <Typography variant="caption" sx={{ 
                  color: confirmPassword === masterPassword ? 'success.main' : 'error.main', 
                  mt: 1 
                }}>
                  {confirmPassword === masterPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                </Typography>
              )}

              {isFirstTime && (
                <Box sx={{
                  p: 2,
                  borderRadius: '16px',
                  bgcolor: alpha(VAULT_PRIMARY, 0.05),
                  border: `1px solid ${alpha(VAULT_PRIMARY, 0.15)}`,
                  display: 'flex',
                  gap: 1.5
                }}>
                  <ShieldIcon sx={{ fontSize: 20, color: VAULT_PRIMARY, flexShrink: 0 }} />
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
                    <strong>Important:</strong> Your master password encrypts all your data locally. We cannot recover it if you forget it.
                  </Typography>
                </Box>
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
                sx={{
                  py: 2,
                  borderRadius: '16px',
                  bgcolor: VAULT_PRIMARY,
                  color: '#000',
                  fontWeight: 900,
                  fontFamily: 'var(--font-space-grotesk)',
                  textTransform: 'none',
                  boxShadow: `0 8px 25px ${alpha(VAULT_PRIMARY, 0.3)}`,
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    bgcolor: alpha(VAULT_PRIMARY, 0.9),
                    transform: 'translateY(-2px)',
                    boxShadow: `0 12px 30px ${alpha(VAULT_PRIMARY, 0.4)}`
                  },
                  '&:disabled': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : (isFirstTime ? "Set Master Password" : "Verify Identity")}
              </Button>

              {hasPasskey && !isFirstTime && (
                <Button
                  fullWidth
                  variant="text"
                  startIcon={<FingerprintIcon sx={{ fontSize: 18 }} />}
                  onClick={() => {
                    setMode("passkey");
                    handlePasskeyUnlock();
                  }}
                  disabled={passkeyLoading}
                  sx={{
                    color: '#6366F1',
                    fontWeight: 700,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.08)' },
                    mt: 1
                  }}
                >
                  {passkeyLoading ? <CircularProgress size={20} /> : "Use Passkey"}
                </Button>
              )}

              {hasPin && !isFirstTime && (
                <Button
                  fullWidth
                  variant="text"
                  size="small"
                  onClick={() => setMode("pin")}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 600,
                    '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                    mt: 0.5,
                    textTransform: 'none'
                  }}
                >
                  Use PIN
                </Button>
              )}


            </>
          )}
        </Stack>
      </Box>

      {/* Footer with logout */}
      <Box sx={{ 
        pt: 2,
        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <Button
          variant="text"
          size="small"
          fullWidth
          onClick={handleLogout}
          disabled={loading}
          startIcon={<LogoutIcon sx={{ fontSize: 14 }} />}
          sx={{ 
            color: 'rgba(255, 255, 255, 0.4)', 
            fontWeight: 700, 
            '&:hover': { color: 'white', bgcolor: 'transparent' },
            textTransform: 'none',
            justifyContent: 'flex-start'
          }}
        >
          Logout from Account
        </Button>
      </Box>
    </Box>
  );

  return (
    <Drawer
      anchor={isMobile ? "bottom" : "right"}
      open={isOpen}
      onClose={() => { }} // Prevent closing by clicking outside
      slotProps={{
        backdrop: {
          sx: { 
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          },
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: '0',
          bgcolor: SURFACE_COLOR,
          border: 'none',
          width: '100vw',
          maxWidth: '100vw',
          maxHeight: '100dvh',
          height: '100dvh',
          top: 0,
        }
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
