"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from 'next/navigation';
import {
    Drawer,
    Typography,
    Button,
    TextField,
    Box,
    IconButton,
    CircularProgress,
    Stack,
    InputAdornment,
    Divider,
    useMediaQuery,
    useTheme,
    alpha,
} from "@/lib/mui-tailwind/material";
import {
    Lock,
    Fingerprint,
    Eye,
    EyeOff,
    AlertTriangle,
    CheckCircle,
    Shield
} from "lucide-react";
import Logo from "@/components/common/Logo";
import { ecosystemSecurity } from "@/lib/ecosystem/security";
import { AppwriteService } from "@/lib/appwrite";
import { useAuth } from "@/context/auth/AuthContext";
import { unlockWithPasskey } from "@/lib/passkey";
import { PasskeySetup } from "./PasskeySetup";
import toast from "react-hot-toast";
import { getAppTone, type KylrixApp } from "@/lib/sdk/design";
import { masterPassCrypto } from "@/lib/masterpass-crypto";
import { useDrawerState } from "@/components/ui/DrawerStateContext";
import { useAppwriteVault } from "@/context/appwrite-context";

interface SudoModalProps {
    isOpen?: boolean;
    open?: boolean;
    onSuccess: () => void;
    onCancel?: () => void;
    onClose?: () => void;
    intent?: "unlock" | "initialize" | "reset" | "upgrade";
    app?: KylrixApp;
}

export default function SudoModal({
    isOpen: _isOpen,
    open,
    onSuccess,
    onCancel,
    onClose,
    intent,
    app = "note",
}: SudoModalProps) {
    const router = useRouter();
    const { setIsDrawerOpen } = useDrawerState();
    const { usePasskeysByDefault } = useAppwriteVault();
    const isOpen = _isOpen ?? open ?? false;

    useEffect(() => {
        setIsDrawerOpen(isOpen);
        return () => setIsDrawerOpen(false);
    }, [isOpen, setIsDrawerOpen]);

    const cancelHandler = onCancel ?? onClose ?? (() => {});
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
    const { user } = useAuth();
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [hasPasskey, setHasPasskey] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [mode, setMode] = useState<"passkey" | "password" | "initialize" | "migrating" | null>(null);
    const [isDetecting, setIsDetecting] = useState(true);
    const [isPendingVault, setIsPendingVault] = useState(false);
    const [showPasskeyIncentive, setShowPasskeyIncentive] = useState(false);
    const passkeyTriggeredRef = useRef(false);
    const appTone = getAppTone(app);
    const accentColor = appTone.secondary;
    const isKylrixDomain =
        typeof window !== "undefined" &&
        (window.location.hostname === "kylrix.space" || window.location.hostname.endsWith(".kylrix.space"));

    // Migration state
    const [migrationStatus, setMigrationStatus] = useState<'idle' | 'upgrading' | 'success' | 'error'>('idle');
    const [migrationProgress, setMigrationProgress] = useState(0);
    const [isCriticalError, setIsCriticalError] = useState(false);
    const isMigratingRef = useRef(false);
    const onSuccessRef = useRef(onSuccess);

    // Keep onSuccessRef updated without triggering useEffect re-runs
    useEffect(() => {
        onSuccessRef.current = onSuccess;
    }, [onSuccess]);

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
            if (!isMigratingRef.current) {
                masterPassCrypto.setMigrationCallbacks(() => {}, () => {});
            }
        };
    }, [isOpen]);

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

    const handleSuccessWithSync = useCallback(async () => {
        if (user?.$id) {
            try {
                // Sudo Hook: Ensure E2E Identity is created and published upon successful MasterPass unlock
                console.log("[Kylrix] Synchronizing Identity...");
                await ecosystemSecurity.ensureE2EIdentity(user.$id);

                if (intent === "reset") {
                    onSuccess();
                    return;
                }
            } catch (e) {
                console.error("[Kylrix] Failed to sync identity on unlock", e);
            }
        }
        onSuccess();
    }, [user, onSuccess, intent]);

    const handleRedirectToVaultSetup = useCallback(() => {
        const callbackUrl = encodeURIComponent(window.location.href);
        router.push(`/vault/masterpass?callbackUrl=${callbackUrl}`);
    }, [router]);

    const handlePasskeyVerify = useCallback(async () => {
        if (!user?.$id || !isOpen) return;
        setPasskeyLoading(true);
        try {
            const success = await unlockWithPasskey(user.$id);
            if (success && isOpen) {
                const activeMek = ecosystemSecurity.getMasterKey();
                if (activeMek) {
                    const rawMek = await crypto.subtle.exportKey("raw", activeMek);
                    await masterPassCrypto.importKey(rawMek);
                    await masterPassCrypto.unlockWithImportedKey();
                }
                toast.success("Verified via Passkey");
                handleSuccessWithSync();
            }
        } catch (error: unknown) {
            console.error("Passkey verification failed or cancelled", error);
        } finally {
            setPasskeyLoading(false);
        }
    }, [user?.$id, isOpen, handleSuccessWithSync]);

    // Check if user has passkey set up
    useEffect(() => {
        if (isOpen && user?.$id) {
            // Instant bypass if already unlocked
            if (masterPassCrypto.isVaultUnlocked()) {
                console.log("[Kylrix] Vault already unlocked, bypassing Sudo prompt.");
                handleSuccessWithSync();
                return;
            }

            // Check for passkey keychain entry
            AppwriteService.listKeychainEntries(user.$id).then((entries: any[]) => {
                const passkeyPresent = entries.some((e: any) => e.type === 'passkey');
                const passwordEntries = entries.filter((e: any) => e.type === 'password');
                const passwordPresent = passwordEntries.length > 0;
                
                // Prioritize stable over pending for authentication
                const stableEntry = passwordEntries.find(e => !e.isPending);
                const pendingEntry = passwordEntries.find(e => e.isPending);
                
                const bestEntry = stableEntry || pendingEntry || passwordEntries[0];
                
                // isPendingVault should be true if we are on a pending entry OR if a zombie pending entry exists
                setIsPendingVault(!!pendingEntry);
                setHasMasterpass(passwordPresent);
                
                const passkeyAllowed = passkeyPresent && isKylrixDomain;
                setHasPasskey(passkeyAllowed);

                // Intent Logic
                if (intent === "initialize") {
                    if (passwordPresent) {
                        toast.error("MasterPass already set");
                        setMode("password");
                    } else {
                        handleRedirectToVaultSetup();
                    }
                    setIsDetecting(false);
                    return;
                }

                if (intent === "upgrade") {
                    setMode("password");
                    setIsDetecting(false);
                    return;
                }
                if (intent === "reset") {
                    const callbackUrl = encodeURIComponent(window.location.href);
                    router.push(`/vault/reset?callbackUrl=${callbackUrl}`);
                    return;
                }

                // Enforce Master Password setup if missing
                if (!passwordPresent && isOpen) {
                    handleRedirectToVaultSetup();
                    setIsDetecting(false);
                    return;
                }

                // RESPECT PREFERENCE: Default to passkey only if allowed AND user prefers it
                if (passkeyAllowed && usePasskeysByDefault) {
                    setMode("passkey");
                } else {
                    setMode("password");
                }
                setIsDetecting(false);
            }).catch(() => {
                // Fail safe: if keychain lookup fails, force setup flow instead of prompting
                // for an unlock that cannot succeed and causes partial encryption states.
                if (isOpen) {
                    handleRedirectToVaultSetup();
                    setIsDetecting(false);
                    return;
                }
                setIsDetecting(false);
            });

            // Reset state on open
            setPassword("");
            setLoading(false);
            setPasskeyLoading(false);
            setIsDetecting(true);
        }
    }, [isOpen, user?.$id, intent, handleRedirectToVaultSetup, isKylrixDomain, router, usePasskeysByDefault]);

    useEffect(() => {
        if (!isOpen) {
            passkeyTriggeredRef.current = false;
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && mode === "passkey" && hasPasskey && !passkeyLoading && !passkeyTriggeredRef.current) {
            passkeyTriggeredRef.current = true;
            handlePasskeyVerify();
        }
    }, [isOpen, mode, hasPasskey, handlePasskeyVerify, passkeyLoading]);

    const handlePasswordVerify = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!user?.$id) return;

        if (hasMasterpass === false) {
            handleRedirectToVaultSetup();
            return;
        }

        if (!password) return;

        setLoading(true);
        try {
            const success = await masterPassCrypto.unlock(
              password,
              user.$id,
              false
            );

            if (success) {
                // IF MIGRATING: Don't call handleSuccessWithSync yet.
                if (isMigratingRef.current) {
                    return;
                }
                toast.success("Verified");
                handleSuccessWithSync();
            } else {
                toast.error("Incorrect master password");
            }
        } catch (error: any) {
            console.error(error);
            if (error.message === 'VAULT_ALREADY_EXISTS') {
                toast.error("Vault already initialized.");
                handleSuccessWithSync();
            } else {
                toast.error("Verification failed");
            }
        } finally {
            setLoading(false);
        }
    };

    if (showPasskeyIncentive && user) {
        return (
            <PasskeySetup
                open={true}
                onClose={() => {
                    setShowPasskeyIncentive(false);
                    onSuccess();
                }}
                userId={user.$id}
                onSuccess={() => {
                    setShowPasskeyIncentive(false);
                    onSuccess();
                }}
                trustUnlocked={true}
            />
        );
    }

    return (
        <Drawer
            open={isOpen}
            onClose={cancelHandler}
            anchor={isDesktop ? "right" : "bottom"}
            ModalProps={{ keepMounted: false, sx: { zIndex: 1299 } }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: isDesktop ? '32px' : '32px',
                    borderTopRightRadius: isDesktop ? 0 : '32px',
                    borderBottomLeftRadius: isDesktop ? '32px' : 0,
                    borderBottomRightRadius: 0,
                    bgcolor: '#161412',
                    backdropFilter: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    backgroundImage: 'none',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8)',
                    width: isDesktop ? 'min(100vw, 420px)' : '100%',
                    maxWidth: '100vw',
                    height: isDesktop ? 'calc(100dvh - 88px)' : 'auto',
                    maxHeight: isDesktop ? 'calc(100dvh - 88px)' : 'calc(100dvh - 12px)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1300,
                    top: isDesktop ? '88px' : 'auto',
                    bottom: 0,
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
            <Box sx={{ position: 'relative', px: { xs: 1.25, sm: 1.5 }, pt: { xs: 0.75, sm: 1 }, pb: 0.5, flex: '0 0 auto', bgcolor: '#161412' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.75 }}>
                    <Box sx={{
                        width: 44,
                        height: 5,
                        borderRadius: 999,
                        bgcolor: 'rgba(255, 255, 255, 0.18)',
                    }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ position: 'relative' }}>
                        <Logo 
                            variant="icon" 
                            size={48} 
                            app={app}
                            sx={{
                                borderRadius: '18px',
                                border: '2px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                                bgcolor: '#0A0908'
                            }} 
                        />
                        <Box sx={{
                            position: 'absolute',
                            bottom: -6,
                            right: -6,
                            width: 24,
                            height: 24,
                            borderRadius: '8px',
                            bgcolor: accentColor,
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 4px 12px ${accentColor}66`,
                            border: '3px solid #0a0a0a',
                            zIndex: 1
                        }}>
                            <Lock size={11} strokeWidth={3} />
                        </Box>
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h6" sx={{
                            fontWeight: 900,
                            letterSpacing: "-0.04em",
                            fontFamily: "var(--font-clash)",
                            color: "white",
                            lineHeight: 1.1
                        }}>
                            {user?.name || "User"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.4)", mt: 0.5, fontFamily: "var(--font-satoshi)", fontWeight: 600 }}>
                            Enter MasterPass to continue
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', my: 1 }} />

            <Box sx={{ px: { xs: 1.25, sm: 1.5 }, py: { xs: 0.75, sm: 1 }, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable', pb: 'calc(4px + env(safe-area-inset-bottom))', bgcolor: '#161412' }}>
                {isDetecting || (loading && !password && mode !== 'migrating') ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2.5 }}>
                        <CircularProgress sx={{ color: accentColor }} />
                    </Box>
                ) : mode === "migrating" ? (
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
                              sx={{ color: migrationStatus === 'error' ? '#EF4444' : accentColor }} 
                              variant="determinate"
                              value={migrationProgress}
                          />
                          <Box sx={{ position: 'absolute', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              {migrationStatus === 'upgrading' && (
                                  <>
                                      <Box sx={{ display: 'flex', fontSize: 24, color: accentColor, mb: 0.5 }}>
                                        <Shield size={24} />
                                      </Box>
                                      <Typography sx={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 900, color: 'white' }}>
                                          {Math.round(migrationProgress)}%
                                      </Typography>
                                  </>
                              )}
                              {migrationStatus === 'success' && <CheckCircle size={32} color="#10B981" />}
                              {migrationStatus === 'error' && <AlertTriangle size={32} color="#EF4444" />}
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
                                      // Manual retry using the resident master password
                                      handlePasswordVerify();
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
                ) : mode === "passkey" ? (

                    <Stack spacing={2} sx={{ mt: 1.5, alignItems: "center" }}>
                        <Box
                            onClick={handlePasskeyVerify}
                            sx={{
                                width: 80,
                                height: 80,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                position: "relative",
                                transition: "all 0.3s ease",
                                "&:hover": {
                                    transform: "scale(1.05)"
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
                                            animation: "race 2s linear infinite"
                                        }}
                                    />
                                )}
                                <defs>
                                    <linearGradient id="racingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor={accentColor} />
                                        <stop offset="100%" stopColor={accentColor} />
                                    </linearGradient>
                                </defs>
                            </svg>
                            <Box sx={{
                                position: "absolute",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                animation: passkeyLoading ? "pulse-hex 2s infinite ease-in-out" : "none"
                            }}>
                                <Fingerprint size={32} color={passkeyLoading ? accentColor : "rgba(255, 255, 255, 0.4)"} />
                            </Box>
                        </Box>

                        <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.3)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                            {passkeyLoading ? "CONFIRM ON DEVICE" : "TAP TO VERIFY"}
                        </Typography>
                    </Stack>
                ) : (
                    <Stack spacing={2.25} component="form" onSubmit={handlePasswordVerify}>
                        {isPendingVault && (
                            <Box sx={{ 
                                p: 2, 
                                bgcolor: alpha('#F59E0B', 0.05), 
                                borderRadius: '16px', 
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                display: 'flex',
                                gap: 2,
                                alignItems: 'flex-start'
                            }}>
                                <AlertTriangle size={20} color="#F59E0B" style={{ marginTop: 2, flexShrink: 0 }} />
                                <Box>
                                    <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>Resuming High-Priority Upgrade</Typography>
                                    <Typography variant="caption" sx={{ color: '#9B9691', lineHeight: 1.4, display: 'block', mt: 0.5 }}>
                                        A previous cryptographic transition was interrupted. Please enter your master password to stabilize and finalize your T5 Core upgrade.
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        <Box>
                            <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.4)", fontWeight: 600, mb: 1, display: "block" }}>
                                MASTER PASSWORD
                            </Typography>

                            <TextField
                                fullWidth
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your master password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoFocus
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Lock size={18} color="rgba(255, 255, 255, 0.3)" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "rgba(255, 255, 255, 0.3)" }}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    "& .MuiOutlinedInput-root": {
                                        borderRadius: "14px",
                                        bgcolor: "rgba(255, 255, 255, 0.03)",
                                        "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                                        "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                                        "&.Mui-focused fieldset": { borderColor: accentColor },
                                    },
                                    "& .MuiInputBase-input": { color: "white" }
                                }}
                            />
                        </Box>

                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            disabled={loading}
                            sx={{
                                py: 1.8,
                                borderRadius: "16px",
                                background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}CC 100%)`,
                                color: "#FFFFFF",
                                fontWeight: 800,
                                fontFamily: "var(--font-satoshi)",
                                textTransform: "none",
                                "&:hover": {
                                    background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}DD 100%)`,
                                    transform: "translateY(-1px)",
                                    boxShadow: `0 8px 25px ${accentColor}40`
                                }
                            }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : "Verify Identity"}
                        </Button>

                    </Stack>
                )
            }
            </Box>
            {mode === "passkey" && (
                <Box sx={{
                    flex: '0 0 auto',
                    px: { xs: 1.25, sm: 1.5 },
                    pb: 'calc(6px + env(safe-area-inset-bottom))',
                    pt: 0.75,
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    bgcolor: '#161412'
                }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<Fingerprint size={18} />}
                        onClick={() => setMode("password")}
                        sx={{
                            minHeight: 46,
                            color: "white",
                            borderColor: "rgba(255, 255, 255, 0.12)",
                            borderRadius: "14px",
                            textTransform: "none",
                            fontFamily: "var(--font-satoshi)",
                            fontWeight: 700,
                            bgcolor: "rgba(255, 255, 255, 0.03)",
                            "&:hover": { bgcolor: "rgba(255, 255, 255, 0.06)", borderColor: "rgba(255, 255, 255, 0.25)" }
                        }}
                    >
                        Use Master Password
                    </Button>
                </Box>
            )}
        </Drawer>
    );
}

// Migration compatibility: some pages import this overlay as a named export.
export { SudoModal };
