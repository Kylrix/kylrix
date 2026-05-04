"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import ShieldIcon from "@mui/icons-material/Shield";
import LogoutIcon from "@mui/icons-material/Logout";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AppsIcon from "@mui/icons-material/Apps";
import Logo from "../common/Logo";
import { useAppwriteVault } from "@/context/appwrite-context";
import { masterPassCrypto } from "@/lib/masterpass-crypto";
import { useFinalizeAuth } from "@/lib/finalizeAuth";
import {
  setMasterpassFlag,
  AppwriteService,
} from "@/lib/appwrite";
import { checkRateLimit, getBlockedDuration } from "@/lib/rate-limiter";
import toast from "react-hot-toast";
import { unlockWithPasskey } from "@/lib/passkey";
import { PasskeySetup } from "./passkeySetup";
import { ecosystemSecurity } from "@/lib/ecosystem/security";

interface MasterPassModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VAULT_PRIMARY = "#10B981"; // Emerald
const BG_COLOR = "#0A0908";
const SURFACE_COLOR = "#161412";

export function MasterPassModal({ isOpen, onClose }: MasterPassModalProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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

  const [mode, setMode] = useState<"passkey" | "password" | "pin" | "initialize" | null>(null);
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);

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
    await finalizeAuth({ redirect: true, fallback: "/dashboard" });
  }, [user?.$id, finalizeAuth, refresh]);

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

    // Auto-success if already unlocked
    if (masterPassCrypto.isVaultUnlocked()) {
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
      .then((entries) => {
        const passkeyPresent = entries.some((e: any) => e.type === 'passkey');
        const passwordPresent = entries.some((e: any) => e.type === 'password');

        // Disable passkey if not on kylrix.space domain
        const effectivePasskeyPresent = passkeyPresent && isKylrixDomain;

        setHasPasskey(effectivePasskeyPresent);
        setIsFirstTime(!passwordPresent);

        if (!passwordPresent) {
          setMode("initialize");
        } else if (effectivePasskeyPresent) {
          setMode("passkey");
          handlePasskeyUnlock();
        } else if (pinSet) {
          setMode("pin");
        } else {
          setMode("password");
        }
      })
      .catch(() => {
        setIsFirstTime(true);
        setMode("initialize");
      })
      .finally(() => {
        setLoading(false);
      });

    // Reset state on open
    setMasterPassword("");
    setConfirmPassword("");
    setPin("");
  }, [user, isOpen, handlePasskeyUnlock, onSuccess]);

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
        isOpen={true}
        onClose={onSuccess}
        userId={user.$id}
        onSuccess={onSuccess}
        trustUnlocked={true}
      />
    );
  }

  return (
    <Dialog
      open={isOpen}
      onClose={() => { }} // Prevent closing by clicking outside
      PaperProps={{
        sx: {
          borderRadius: '32px',
          bgcolor: SURFACE_COLOR,
          /* Following Kylrix design guidance: avoid glassmorphism/backdrop blur on surfaces */
          border: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundImage: 'none',
          /* Subtle ambient shadow instead of heavy glass blur */
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
          width: '100%',
          maxWidth: '400px',
          overflow: 'hidden',
          position: 'relative',
        }
      }}
    >
      <style>{`
        @keyframes race {
          from { stroke-dashoffset: 240; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse-hex {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <DialogTitle sx={{ textAlign: 'center', pt: 6, pb: 1, position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)' }}>
              <Box sx={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Use app-specific logo variant for Vault so the left hemisphere uses the Vault color */}
                <Logo app="vault" size={64} variant="icon" />
              
              
              </Box>
              <Box sx={{
                position: 'absolute',
                bottom: -6,
                right: -6,
                width: 28,
                height: 28,
                borderRadius: '8px',
                bgcolor: VAULT_PRIMARY,
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 4px 12px ${alpha(VAULT_PRIMARY, 0.4)}`,
                border: `3px solid ${BG_COLOR}`,
                zIndex: 1
              }}>
                <LockIcon sx={{ fontSize: 14 }} />
              </Box>
        </Box>

        <Typography variant="h5" sx={{
          fontWeight: 900,
          letterSpacing: '-0.04em',
          fontFamily: 'var(--font-clash)',
          color: 'white',
          mt: 4
        }}>
          {user?.name || "User"}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', mt: 1, fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>
          Enter MasterPass to continue
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 4 }}>
        {isFirstTime === null || (loading && !masterPassword && mode !== "pin") ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: VAULT_PRIMARY }} />
          </Box>
        ) : mode === "pin" ? (
          <Stack spacing={3} sx={{ mt: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, mb: 1, display: 'block', textAlign: 'center' }}>
                ENTER 4-DIGIT PIN
              </Typography>
              <TextField
                fullWidth
                type="password"
                placeholder="••••"
                value={pin}
                onChange={handlePinChange}
                disabled={loading}
                autoFocus
                inputProps={{
                  maxLength: 4,
                  inputMode: 'numeric',
                  style: { textAlign: 'center', fontSize: '2rem', letterSpacing: '0.5em' }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: SURFACE_COLOR,
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&.Mui-focused fieldset': { borderColor: VAULT_PRIMARY },
                  },
                  '& .MuiInputBase-input': { color: 'white' }
                }}
              />
            </Box>

            <Button
              fullWidth
              variant="text"
              size="small"
              onClick={() => setMode("password")}
              sx={{ color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, '&:hover': { color: 'white', bgcolor: 'transparent' } }}
            >
              Use Master Password
            </Button>
          </Stack>
        ) : mode === "passkey" ? (
          <Stack spacing={3} sx={{ mt: 2, alignItems: 'center' }}>
            <Box
              onClick={handlePasskeyUnlock}
              sx={{
                width: 80,
                height: 80,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.05)'
                }
              }}
            >
              <svg width="80" height="80" viewBox="0 0 80 80">
                <path
                  d="M40 5 L70 22.5 L70 57.5 L40 75 L10 57.5 L10 22.5 Z"
                  fill="transparent"
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
                {passkeyLoading && (
                  <path
                    d="M40 5 L70 22.5 L70 57.5 L40 75 L10 57.5 L10 22.5 Z"
                    fill="transparent"
                    stroke="url(#racingGradient)"
                    strokeWidth="3"
                    strokeDasharray="60 180"
                    style={{
                      animation: 'race 2s linear infinite'
                    }}
                  />
                )}
                <defs>
                  <linearGradient id="racingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={VAULT_PRIMARY} />
                    <stop offset="100%" stopColor={alpha(VAULT_PRIMARY, 0.6)} />
                  </linearGradient>
                </defs>
              </svg>
              <Box sx={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: passkeyLoading ? 'pulse-hex 2s infinite ease-in-out' : 'none'
              }}>
                <FingerprintIcon sx={{ fontSize: 32, color: passkeyLoading ? VAULT_PRIMARY : 'rgba(255, 255, 255, 0.4)' }} />
              </Box>
            </Box>

            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {passkeyLoading ? "CONFIRM ON DEVICE" : "TAP TO VERIFY"}
            </Typography>

            <Button
              fullWidth
              variant="text"
              size="small"
              onClick={() => setMode("password")}
              sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: 'white' } }}
            >
              Use Master Password
            </Button>
          </Stack>
        ) : (
          <Stack spacing={3} component="form" onSubmit={handleSubmit}>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, mb: 1, display: 'block' }}>
                {isFirstTime ? "CREATE MASTER PASSWORD" : "MASTER PASSWORD"}
              </Typography>
              <TextField
                fullWidth
                disabled={loading}
                type={showPassword ? "text" : "password"}
                placeholder={isFirstTime ? "Create a strong master password" : "Enter your master password"}
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                required
                autoFocus
                InputProps={{
                  startAdornment: (
                    <Box sx={{ mr: 1, color: 'rgba(255, 255, 255, 0.3)', display: 'flex' }}>
                      <LockIcon sx={{ fontSize: 18 }} />
                    </Box>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                      {showPassword ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '14px',
                    bgcolor: SURFACE_COLOR,
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&.Mui-focused fieldset': { borderColor: VAULT_PRIMARY },
                  },
                  '& .MuiInputBase-input': { color: 'white' }
                }}
              />
              {capsLock && (
                <Typography variant="caption" sx={{ color: 'warning.main', mt: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
                  <ErrorOutlineIcon sx={{ fontSize: 12 }} /> Caps Lock is ON
                </Typography>
              )}
            </Box>

            {isFirstTime && (
              <Box>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, mb: 1, display: 'block' }}>
                  CONFIRM MASTER PASSWORD
                </Typography>
                <TextField
                  fullWidth
                  disabled={loading}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your master password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                      <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                        {showConfirmPassword ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                      </InputAdornment>
                    )
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '14px',
                      bgcolor: SURFACE_COLOR,
                      '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                      '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                      '&.Mui-focused fieldset': { borderColor: VAULT_PRIMARY },
                    },
                    '& .MuiInputBase-input': { color: 'white' }
                  }}
                />
                {confirmCapsLock && (
                  <Typography variant="caption" sx={{ color: 'warning.main', mt: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600 }}>
                    <ErrorOutlineIcon sx={{ fontSize: 12 }} /> Caps Lock is ON
                  </Typography>
                )}
                {confirmPassword.length > 0 && (
                  <Typography variant="caption" sx={{ color: confirmPassword === masterPassword ? 'success.main' : 'error.main', mt: 1, display: 'block' }}>
                    {confirmPassword === masterPassword ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </Typography>
                )}
              </Box>
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
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  py: 1.5,
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  textTransform: 'none',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 700,
                  '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.15)' },
                  mt: 1
                }}
              >
                Use Passkey
              </Button>
            )}

            {hasPin && !isFirstTime && (
              <Button
                fullWidth
                variant="text"
                startIcon={<AppsIcon sx={{ fontSize: 18 }} />}
                onClick={() => setMode("pin")}
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  py: 1,
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 600,
                  '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                  mt: 0.5
                }}
              >
                Use PIN
              </Button>
            )}

            {mode === "password" && !isFirstTime && (
              <Button
                fullWidth
                variant="text"
                size="small"
                onClick={() => router.push("/reset")}
                sx={{
                  color: '#ef4444',
                  fontSize: '0.75rem',
                  mt: 1,
                  '&:hover': { bgcolor: alpha('#ef4444', 0.1) },
                  textTransform: 'none',
                  fontWeight: 700
                }}
              >
                Reset Master Password
              </Button>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ flexDirection: 'column', p: 4, pt: 0, gap: 2 }}>
        <Button
          variant="text"
          size="small"
          onClick={handleLogout}
          startIcon={<LogoutIcon sx={{ fontSize: 14 }} />}
          sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, '&:hover': { color: 'white', bgcolor: 'transparent' } }}
        >
          Logout from Account
        </Button>
      </DialogActions>
    </Dialog>
  );
}
