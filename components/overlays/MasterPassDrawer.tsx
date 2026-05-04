"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import LockIcon from "@mui/icons-material/Lock";
import ShieldIcon from "@mui/icons-material/Shield";
import LogoutIcon from "@mui/icons-material/Logout";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import AppsIcon from "@mui/icons-material/Apps";
import CloseIcon from "@mui/icons-material/Close";
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

interface MasterPassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const VAULT_PRIMARY = "#10B981"; // Emerald
const BG_COLOR = "#0A0908";
const SURFACE_COLOR = "#161412";

export function MasterPassDrawer({ isOpen, onClose }: MasterPassDrawerProps) {
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
                    }
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
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
                onChange={(e) => setMasterPassword(e.target.value)}
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
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '16px',
                    bgcolor: alpha(VAULT_PRIMARY, 0.05),
                    border: `1px solid ${alpha(VAULT_PRIMARY, 0.2)}`,
                  }
                }}
              />

              {isFirstTime && (
                <TextField
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm master password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '16px',
                      bgcolor: alpha(VAULT_PRIMARY, 0.05),
                      border: `1px solid ${alpha(VAULT_PRIMARY, 0.2)}`,
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
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          bgcolor: SURFACE_COLOR,
          border: isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          width: isMobile ? '100%' : '420px',
          maxHeight: isMobile ? '90vh' : '100%',
        }
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
