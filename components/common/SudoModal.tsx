"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Drawer,
    DialogTitle,
    DialogContent,
    Typography,
    Button,
    TextField,
    Box,
    IconButton,
    CircularProgress,
    Stack,
    alpha,
    InputAdornment,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import {
    Lock,
    Fingerprint,
    Eye,
    EyeOff,
    LayoutGrid,
} from "lucide-react";
import Logo from "./Logo";
import { ecosystemSecurity } from "@/lib/ecosystem/security";
import { AppwriteService } from "@/lib/appwrite/client";
import { useAuth } from "@/context/auth/AuthContext";
import toast from "react-hot-toast";
import { unlockWithPasskey } from "@/lib/passkey";
import { PasskeySetup } from "./PasskeySetup";

interface SudoModalProps {
    isOpen: boolean;
    onSuccess: () => void;
    onCancel: () => void;
    intent?: "unlock" | "initialize" | "reset";
}

export default function SudoModal({
    isOpen,
    onSuccess,
    onCancel: _onCancel,
    intent,
}: SudoModalProps) {
    const { user } = useAuth();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [hasPasskey, setHasPasskey] = useState(false);
    const [hasPin, setHasPin] = useState(false);
    const [mode, setMode] = useState<"passkey" | "password" | "pin" | "initialize" | null>(null);
    const [isDetecting, setIsDetecting] = useState(true);
    const [showPasskeyIncentive, setShowPasskeyIncentive] = useState(false);

    const [isKylrixDomain, setIsKylrixDomain] = useState(false);

    const handleSuccessWithSync = useCallback(async () => {
        if (user?.$id) {
            try {
                // Sudo Hook: Ensure E2E Identity is created and published upon successful MasterPass unlock
                console.log("Synchronizing Identity...");
                await ecosystemSecurity.ensureE2EIdentity(user.$id);
                
                if (intent === "reset") {
                    onSuccess();
                    return;
                }

                // Passkey Incentive
                const entries = await AppwriteService.listKeychainEntries(user.$id);
                const hasPasskey = entries.some((e: any) => e.type === 'passkey');
                const onKylrixDomain = window.location.hostname === 'kylrix.space' || window.location.hostname.endsWith('.kylrix.space');
                
                if (!hasPasskey && onKylrixDomain) {
                    const lastSkip = localStorage.getItem(`passkey_skip_${user.$id}`);
                    const sevenDays = 7 * 24 * 60 * 60 * 1000;
                    if (!lastSkip || (Date.now() - parseInt(lastSkip)) > sevenDays) {
                        setShowPasskeyIncentive(true);
                        return; // Don't call onSuccess yet, PasskeySetup will handle it
                    }
                }
            } catch (e) {
                console.error("Failed to sync identity on unlock", e);
            }
        }
        onSuccess();
    }, [user, onSuccess, intent]);

    const handleRedirectToVaultSetup = useCallback(() => {
        const callbackUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://vault.kylrix.space/masterpass?callbackUrl=${callbackUrl}`;
    }, []);

    const handlePasswordVerify = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!password || !user?.$id) return;

        setLoading(true);
        try {
            const entries = await AppwriteService.listKeychainEntries(user.$id);
            const entry = entries.find((e: any) => e.type === 'password');

            if (!entry) {
                handleRedirectToVaultSetup();
                return;
            }

            const success = await ecosystemSecurity.unlock(password, entry);
            if (success) {
                toast.success("Identity Verified");
                handleSuccessWithSync();
            } else {
                toast.error("Incorrect Master Password");
            }
        } catch (_e: unknown) {
            toast.error("Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handlePinVerify = async () => {
        if (pin.length !== 4) return;
        setLoading(true);
        try {
            const success = await ecosystemSecurity.unlockWithPin(pin);
            if (success) {
                toast.success("Unlocked with PIN");
                handleSuccessWithSync();
            } else {
                toast.error("Incorrect PIN");
                setPin("");
            }
        } catch (_e: unknown) {
            toast.error("PIN verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handlePasskeyVerify = useCallback(async () => {
        if (!user?.$id || !isOpen) return;
        setPasskeyLoading(true);
        try {
            const success = await unlockWithPasskey(user.$id);
            if (success && isOpen) {
                toast.success("Verified via Passkey");
                handleSuccessWithSync();
            }
        } catch (e) {
            console.error("Passkey verification failed or cancelled", e);
        } finally {
            setPasskeyLoading(false);
        }
    }, [user?.$id, isOpen, handleSuccessWithSync]);

    // Check if user has passkey and PIN set up
    useEffect(() => {
        if (isOpen && user?.$id) {
            const pinSet = ecosystemSecurity.isPinSet();
            setHasPin(pinSet);

            // Check for passkey keychain entry
            AppwriteService.listKeychainEntries(user.$id).then(entries => {
                const passkeyPresent = entries.some((e: any) => e.type === 'passkey');
                const passwordPresent = entries.some((e: any) => e.type === 'password');
                const pinPresent = entries.some((e: any) => e.type === 'pin') || pinSet;
                
                const onKylrixDomain = window.location.hostname === 'kylrix.space' || window.location.hostname.endsWith('.kylrix.space');
                setIsKylrixDomain(onKylrixDomain);
                setHasPasskey(passkeyPresent && onKylrixDomain);
                setHasPin(pinPresent);

                // Intent Logic: Setup vs Unlock
                if (intent === "initialize") {
                    if (passwordPresent) {
                        toast.error("MasterPass is already setup. Use reset if needed.");
                        setMode("password");
                    } else {
                        handleRedirectToVaultSetup();
                    }
                    setIsDetecting(false);
                    return;
                }

                if (intent === "reset") {
                    const callbackUrl = encodeURIComponent(window.location.href);
                    window.location.href = `https://vault.kylrix.space/masterpass/reset?callbackUrl=${callbackUrl}`;
                    return;
                }

                // Enforce Master Password setup if missing
                if (!passwordPresent && isOpen) {
                    handleRedirectToVaultSetup();
                    setIsDetecting(false);
                    return;
                }

                if (passkeyPresent && onKylrixDomain) {
                    setMode("passkey");
                } else if (pinPresent) {
                    setMode("pin");
                } else {
                    setMode("password");
                }
                setIsDetecting(false);
            }).catch(() => {
                setIsDetecting(false);
                setMode("password");
            });

            // Reset state on open
            setPassword("");
            setPin("");
            setLoading(false);
            setPasskeyLoading(false);
            setIsDetecting(true);
        }
    }, [isOpen, user?.$id, intent, handleRedirectToVaultSetup]);

    useEffect(() => {
        if (isOpen && mode === "passkey" && hasPasskey && !passkeyLoading) {
            handlePasskeyVerify();
        }
    }, [isOpen, mode, hasPasskey, passkeyLoading, handlePasskeyVerify]);

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        setPin(val);
        if (val.length === 4) {
            handlePinVerify();
        }
    };

    if (showPasskeyIncentive && user) {
        return (
            <PasskeySetup
                isOpen={true}
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
            onClose={() => { }} // Prevent closing by clicking outside
            anchor={isDesktop ? "right" : "bottom"}
            ModalProps={{ keepMounted: true }}
            sx={{ zIndex: 2200 }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: isDesktop ? '32px' : '32px',
                    borderTopRightRadius: isDesktop ? 0 : '32px',
                    borderBottomLeftRadius: isDesktop ? '32px' : 0,
                    borderBottomRightRadius: 0,
                    bgcolor: '#0A0908',
                    backdropFilter: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundImage: 'none',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
                    width: isDesktop ? 'min(100vw, 430px)' : '100%',
                    maxWidth: '100vw',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    height: isDesktop ? '100dvh' : 'auto',
                    maxHeight: isDesktop ? '100dvh' : 'calc(100dvh - 12px)',
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
            <DialogTitle sx={{ textAlign: 'center', pt: 5, pb: 1, position: 'relative', bgcolor: '#0A0908' }}>
                <Box sx={{ position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)' }}>
                    <Box sx={{ position: 'relative' }}>
                        <Logo 
                            variant="icon" 
                            size={64} 
                            app="flow"
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
                            width: 28,
                            height: 28,
                            borderRadius: '8px',
                            bgcolor: '#A855F7',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)',
                            border: '3px solid #0a0a0a',
                            zIndex: 1
                        }}>
                            <Lock size={14} strokeWidth={3} />
                        </Box>
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

            <DialogContent sx={{ pb: 4, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', scrollbarGutter: 'stable', bgcolor: '#0A0908' }}>
                {isDetecting || (loading && !password && mode !== "pin") ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress sx={{ color: '#A855F7' }} />
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
                                autoFocus
                                inputProps={{
                                    maxLength: 4,
                                    inputMode: 'numeric',
                                    style: { textAlign: 'center', fontSize: '2rem', letterSpacing: '0.5em' }
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: '14px',
                                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                                        '&.Mui-focused fieldset': { borderColor: '#A855F7' },
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
                            sx={{ color: 'rgba(255, 255, 255, 0.5)', '&:hover': { color: 'white' } }}
                        >
                            Use Master Password
                        </Button>
                    </Stack>
                ) : mode === "passkey" ? (
                    <Stack spacing={3} sx={{ mt: 2, alignItems: 'center' }}>
                        <Box
                            onClick={handlePasskeyVerify}
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
                                        <stop offset="0%" stopColor="#A855F7" />
                                        <stop offset="100%" stopColor="#7E22CE" />
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
                                <Fingerprint size={32} color={passkeyLoading ? '#A855F7' : 'rgba(255, 255, 255, 0.4)'} />
                            </Box>
                        </Box>

                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
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
                    <Stack spacing={3} component="form" onSubmit={handlePasswordVerify}>
                        <Box>
                            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, mb: 1, display: 'block' }}>
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
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: '14px',
                                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                                        '&.Mui-focused fieldset': { borderColor: '#A855F7' },
                                    },
                                    '& .MuiInputBase-input': { color: 'white' }
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
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, #A855F7 0%, #7E22CE 100%)',
                                color: '#FFFFFF',
                                fontWeight: 800,
                                fontFamily: 'var(--font-satoshi)',
                                textTransform: 'none',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #9333EA 0%, #6B21A8 100%)',
                                    transform: 'translateY(-1px)',
                                    boxShadow: '0 8px 25px rgba(168, 85, 247, 0.25)'
                                }
                            }}
                        >
                            {loading ? <CircularProgress size={24} color="inherit" /> : "Verify Identity"}
                        </Button>

                        {hasPasskey && isKylrixDomain && (
                            <Button
                                fullWidth
                                variant="text"
                                startIcon={<Fingerprint size={18} />}
                                onClick={() => {
                                    setMode("passkey");
                                    handlePasskeyVerify();
                                }}
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    py: 1.5,
                                    borderRadius: '14px',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    textTransform: 'none',
                                    fontFamily: 'var(--font-satoshi)',
                                    fontWeight: 600,
                                    '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.15)' },
                                    mt: 1
                                }}
                            >
                                Use Passkey
                            </Button>
                        )}

                        {hasPin && (
                            <Button
                                fullWidth
                                variant="text"
                                startIcon={<LayoutGrid size={18} />}
                                onClick={() => setMode("pin")}
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.5)',
                                    py: 1,
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontFamily: 'var(--font-satoshi)',
                                    fontWeight: 500,
                                    '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.03)' },
                                    mt: 0.5
                                }}
                            >
                                Use PIN
                            </Button>
                        )}

                        {mode === "password" && (
                            <Button
                                fullWidth
                                variant="text"
                                size="small"
                                onClick={() => {
                                    const callbackUrl = encodeURIComponent(window.location.href);
                                    window.location.href = `https://vault.kylrix.space/masterpass/reset?callbackUrl=${callbackUrl}`;
                                }}
                                sx={{
                                    color: 'error.main',
                                    fontSize: '0.75rem',
                                    mt: 1,
                                    '&:hover': { bgcolor: alpha('#ef4444', 0.1) },
                                    textTransform: 'none',
                                    fontWeight: 600
                                }}
                            >
                                Reset Master Password
                            </Button>
                        )}
                    </Stack>
                )}
            </DialogContent>
        </Drawer>
    );
}
