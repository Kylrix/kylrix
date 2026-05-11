"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "@mui/material";
import {
    Lock,
    Fingerprint,
    Eye,
    EyeOff,
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

interface SudoModalProps {
    isOpen?: boolean;
    open?: boolean;
    onSuccess: () => void;
    onCancel?: () => void;
    onClose?: () => void;
    intent?: "unlock" | "initialize" | "reset";
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
    const isOpen = _isOpen ?? open ?? false;
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
    const [mode, setMode] = useState<"passkey" | "password" | "initialize" | null>(null);
    const [isDetecting, setIsDetecting] = useState(true);
    const [showPasskeyIncentive, setShowPasskeyIncentive] = useState(false);
    const appTone = getAppTone(app);
    const accentColor = appTone.secondary;
    const isKylrixDomain =
        typeof window !== "undefined" &&
        (window.location.hostname === "kylrix.space" || window.location.hostname.endsWith(".kylrix.space"));

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
            // Check for passkey keychain entry
            AppwriteService.listKeychainEntries(user.$id).then((entries: any[]) => {
                const passkeyPresent = entries.some((e: any) => e.type === 'passkey');
                const passwordPresent = entries.some((e: any) => e.type === 'password');
                const passkeyAllowed = passkeyPresent && isKylrixDomain;
                setHasPasskey(passkeyAllowed);
                setHasMasterpass(passwordPresent);

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

                setMode(passkeyAllowed ? "passkey" : "password");
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
    }, [isOpen, user?.$id, intent, handleRedirectToVaultSetup, isKylrixDomain, router]);

    useEffect(() => {
        if (isOpen && mode === "passkey" && hasPasskey && !passkeyLoading) {
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
            // Find password keychain entry
            const entries = await AppwriteService.listKeychainEntries(user.$id);
            const passwordEntry = entries.find((e: any) => e.type === 'password');

            if (!passwordEntry) {
                setHasMasterpass(false);
                handleRedirectToVaultSetup();
                setLoading(false);
                return;
            }

            const isValid = await ecosystemSecurity.unlock(password, passwordEntry);
            if (isValid) {
                const activeMek = ecosystemSecurity.getMasterKey();
                if (activeMek) {
                    const rawMek = await crypto.subtle.exportKey("raw", activeMek);
                    await masterPassCrypto.importKey(rawMek);
                    await masterPassCrypto.unlockWithImportedKey();
                }
                toast.success("Verified");
                handleSuccessWithSync();
            } else {
                toast.error("Incorrect master password");
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Verification failed");
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
            ModalProps={{ keepMounted: true, sx: { zIndex: 1199 } }}
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
                    zIndex: 1200,
                    top: isDesktop ? '88px' : 0,
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
            <Box sx={{ position: 'relative', px: { xs: 2.5, sm: 3 }, pt: { xs: 1.5, sm: 2 }, pb: 1, flex: '0 0 auto', bgcolor: '#161412' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
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

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box sx={{ px: { xs: 2.5, sm: 3 }, py: { xs: 1.5, sm: 2 }, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable', pb: 'calc(8px + env(safe-area-inset-bottom))', bgcolor: '#161412' }}>
                {isDetecting || (loading && !password) ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2.5 }}>
                        <CircularProgress sx={{ color: accentColor }} />
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
                    px: { xs: 2.5, sm: 3 },
                    pb: 'calc(12px + env(safe-area-inset-bottom))',
                    pt: 1.5,
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
