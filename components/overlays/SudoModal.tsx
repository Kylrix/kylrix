"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Button,
    TextField,
    Box,
    IconButton,
    CircularProgress,
    Stack,
    Fade,
    alpha,
    InputAdornment,
} from "@mui/material";
import {
    Lock,
    Fingerprint,
    LayoutGrid,
    LogOut,
    Eye,
    EyeOff,
    KeyRound,
} from "lucide-react";
import CloseIcon from "@mui/icons-material/Close";
import Logo from "../Logo";
import { AppwriteService } from "@/lib/appwrite";
import { PasskeySetup } from "./passkeySetup";
import { unlockWithPasskey } from "@/lib/passkey";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";
import React from "react";
import { masterPassCrypto } from "@/lib/masterpass-crypto";
import { ecosystemSecurity } from "@/lib/ecosystem/security";

interface SudoModalProps {
    isOpen: boolean;
    onSuccess: () => void;
    onCancel: () => void;
    intent?: "unlock" | "initialize" | "reset";
}

export default function SudoModal({
    isOpen,
    onSuccess,
    onCancel,
    intent,
}: SudoModalProps) {
    const { user, logout } = useAuth();
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
    const [isResetting, setIsResetting] = useState(false);
    const [resetStep] = useState(1);

    const handleLogout = useCallback(async () => {
        setLoading(true);
        await logout();
        setLoading(false);
        onCancel();
    }, [logout, onCancel]);

    const handleSuccessWithSync = useCallback(async () => {
        if (user?.$id) {
            try {
                // Identity Sync
                await ecosystemSecurity.ensureE2EIdentity(user.$id);

                const entries = await AppwriteService.listKeychainEntries(user.$id);
                const hasPasskey = entries.some((e: any) => e.type === 'passkey');
                
                if (intent === "reset") {
                    const callbackUrl = encodeURIComponent(window.location.href);
                    window.location.href = `https://vault.kylrix.space/masterpass/reset?callbackUrl=${callbackUrl}`;
                    return;
                }

                if (!hasPasskey) {
                    const lastSkip = localStorage.getItem(`passkey_skip_${user.$id}`);
                    const sevenDays = 7 * 24 * 60 * 60 * 1000;
                    if (!lastSkip || (Date.now() - parseInt(lastSkip)) > sevenDays) {
                        setShowPasskeyIncentive(true);
                        return;
                    }
                }
            } catch (e) {
                console.error("Failed to sync identity on unlock", e);
            }
        }
        onSuccess();
    }, [user, onSuccess, intent]);

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

    const handleRedirectToVaultSetup = useCallback(() => {
        const callbackUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://vault.kylrix.space/masterpass?callbackUrl=${callbackUrl}`;
    }, []);

    const handleInitializeMasterPass = async (e: React.FormEvent) => {
        e.preventDefault();
        handleRedirectToVaultSetup();
    };

    const handlePasswordVerify = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!user?.$id) return;

        setLoading(true);
        try {
            const isValid = await masterPassCrypto.unlock(password, user.$id);
            if (isValid) {
                toast.success("Identity Verified");
                handleSuccessWithSync();
            } else {
                const entries = await AppwriteService.listKeychainEntries(user.$id);
                const hasPassword = entries.some((e: any) => e.type === 'password');
                if (!hasPassword) {
                    handleRedirectToVaultSetup();
                } else {
                    toast.error("Incorrect master password");
                }
            }
        } catch (_error: unknown) {
            console.error(_error);
            toast.error("Verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handlePinVerify = async (pinValue: string) => {
        if (pinValue.length !== 4 || loading) return;

        setLoading(true);
        try {
            const success = await ecosystemSecurity.unlockWithPin(pinValue);
            if (success) {
                toast.success("Verified via PIN");
                handleSuccessWithSync();
            } else {
                toast.error("Incorrect PIN");
                setPin("");
            }
        } catch (_error: unknown) {
            console.error(_error);
            toast.error("PIN verification failed");
        } finally {
            setLoading(false);
        }
    };

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
        setPin(val);
        if (val.length === 4) {
            handlePinVerify(val);
        }
    };

    const handleFinalReset = async (e: React.FormEvent) => {
        e.preventDefault();
        const callbackUrl = encodeURIComponent(window.location.href);
        window.location.href = `https://vault.kylrix.space/masterpass/reset?callbackUrl=${callbackUrl}`;
    };

    useEffect(() => {
        if (isOpen && user?.$id) {
            const pinSet = ecosystemSecurity.isPinSet();
            setHasPin(pinSet);

            AppwriteService.listKeychainEntries(user.$id).then(entries => {
                const passkeyPresent = entries.some((e: any) => e.type === 'passkey');
                const passwordPresent = entries.some((e: any) => e.type === 'password');
                const pinPresent = entries.some((e: any) => e.type === 'pin') || pinSet;
                
                setHasPasskey(passkeyPresent);
                setHasPin(pinPresent);

                if (intent === "initialize") {
                    if (passwordPresent) {
                        toast.error("MasterPass is already setup.");
                        setMode("password");
                    } else {
                        handleRedirectToVaultSetup();
                    }
                    setIsDetecting(false);
                    return;
                }

                if (intent === "reset") {
                    setIsResetting(true);
                    setMode(passkeyPresent ? "passkey" : "password");
                    setIsDetecting(false);
                    return;
                }

                if (!passwordPresent && isOpen) {
                    handleRedirectToVaultSetup();
                    setIsDetecting(false);
                    return;
                }

                if (passkeyPresent) {
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

            setPassword("");
            setPin("");
            setLoading(false);
            setPasskeyLoading(false);
            setIsDetecting(true);
        }
    }, [isOpen, user?.$id, intent, handleRedirectToVaultSetup]);

    useEffect(() => {
        if (isOpen && mode === "passkey" && hasPasskey && !passkeyLoading) {
            setMode("password");
        }
    }, [isOpen, mode, hasPasskey, passkeyLoading]);

    if (showPasskeyIncentive && user) {
        return (
            <PasskeySetup
                isOpen={true}
                onClose={() => {
                    setShowPasskeyIncentive(false);
                    handleSuccessWithSync();
                }}
                userId={user.$id}
                onSuccess={() => {
                    setShowPasskeyIncentive(false);
                    handleSuccessWithSync();
                }}
                trustUnlocked={true}
            />
        );
    }

    return (
        <Dialog
            open={isOpen}
            onClose={onCancel}
            maxWidth="xs"
            fullWidth
            TransitionComponent={Fade}
            PaperProps={{
                sx: {
                    borderRadius: '32px',
                    bgcolor: 'rgba(5, 5, 5, 0.03)',
                    backdropFilter: 'blur(25px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    backgroundImage: 'none',
                    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
                    width: '100%',
                    maxWidth: '400px',
                    overflow: 'hidden'
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
                <IconButton
                    onClick={onCancel}
                    sx={{
                        position: 'absolute',
                        right: 20,
                        top: 20,
                        color: 'rgba(255, 255, 255, 0.3)',
                        '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                >
                    <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>

                <Box sx={{ position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)' }}>
                    <Box sx={{ position: 'relative' }}>
                        <Logo 
                            variant="icon" 
                            size={64} 
                            app="accounts"
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
                letterSpacing: "-0.04em",
                fontFamily: "var(--font-clash)",
                color: "white",
                mt: 4
            }}>
                {user?.name || "User"}
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.4)", mt: 1, fontFamily: "var(--font-satoshi)", fontWeight: 600 }}>
                Enter MasterPass to continue
            </Typography>
        </DialogTitle>

        <DialogContent sx={{ pb: 4 }}>
            {isResetting && resetStep === 2 ? (
                <Stack spacing={3} sx={{ mt: 2 }}>
                    <Box sx={{
                        p: 2,
                        borderRadius: "16px",
                        bgcolor: alpha("#ef4444", 0.1),
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                    }}>
                        <Typography variant="body2" sx={{ color: "#ef4444", fontWeight: 600, display: "flex", alignItems: "center", gap: 1 }}>
                            <KeyRound size={16} /> RESET MASTERPASS
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.5)", mt: 0.5, display: "block" }}>
                            This will replace your current master password. Your encrypted data will remain accessible with the new password.
                        </Typography>
                    </Box>

                    <form onSubmit={handleFinalReset}>
                        <Stack spacing={2.5}>
                            <Box>
                                <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.4)", fontWeight: 600, mb: 1, display: "block" }}>
                                    ENTER NEW MASTERPASS
                                </Typography>
                                <TextField
                                    fullWidth
                                    type={showPassword ? "text" : "password"}
                                    placeholder="New master password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Lock size={18} color="rgba(255, 255, 255, 0.3)" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "rgba(255, 255, 255, 0.3)" }}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </IconButton>
                                        ),
                                    }}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: "14px",
                                            bgcolor: "rgba(255, 255, 255, 0.03)",
                                            "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                                            "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                                            "&.Mui-focused fieldset": { borderColor: "#ef4444" },
                                        },
                                        "& .MuiInputBase-input": { color: "white" }
                                    }}
                                />
                            </Box>

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                disabled={loading || !password || password.length < 8}
                                sx={{
                                    py: 1.5,
                                    borderRadius: "14px",
                                    bgcolor: "#ef4444",
                                    color: "#fff",
                                    fontWeight: 700,
                                    "&:hover": {
                                        bgcolor: alpha("#ef4444", 0.8),
                                    }
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : "Reset and Update Vault"}
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            ) : isDetecting || passkeyLoading ? (
                <Stack spacing={3} sx={{ mt: 4, mb: 2, alignItems: "center" }}>
                    <CircularProgress size={48} sx={{ color: "#A855F7" }} />
                    <Box sx={{ textAlign: "center" }}>
                        <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.5)", fontWeight: 600, letterSpacing: "0.1em" }}>
                            {passkeyLoading ? "AUTHENTICATING..." : "PREPARING SECURITY CHECK..."}
                        </Typography>
                    </Box>
                    {passkeyLoading && (
                        <Button
                            fullWidth
                            variant="text"
                            size="small"
                            onClick={() => setMode("password")}
                            sx={{ color: "rgba(255, 255, 255, 0.5)", "&:hover": { color: "white" } }}
                        >
                            Use Master Password
                        </Button>
                    )}
                </Stack>
            ) : mode === "initialize" ? (
                <Stack spacing={3} sx={{ mt: 2 }}>
                    <form onSubmit={handleInitializeMasterPass}>
                        <Stack spacing={2.5}>
                            <Box>
                                <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.4)", fontWeight: 600, mb: 1, display: "block" }}>
                                    SET MASTER PASSWORD
                                </Typography>
                                <TextField
                                    fullWidth
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a strong password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Lock size={18} color="rgba(255, 255, 255, 0.3)" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "rgba(255, 255, 255, 0.3)" }}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </IconButton>
                                        ),
                                    }}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: "14px",
                                            bgcolor: "rgba(255, 255, 255, 0.03)",
                                            "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                                            "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                                            "&.Mui-focused fieldset": { borderColor: "#A855F7" },
                                        },
                                        "& .MuiInputBase-input": { color: "white" }
                                    }}
                                />
                            </Box>

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                disabled={loading || !password || password.length < 8}
                                sx={{
                                    py: 1.8,
                                    borderRadius: "16px",
                                    background: "linear-gradient(135deg, #A855F7 0%, #7E22CE 100%)",
                                    color: "#FFFFFF",
                                    fontWeight: 800,
                                    fontFamily: "var(--font-satoshi)",
                                    textTransform: "none",
                                    "&:hover": {
                                        background: "linear-gradient(135deg, #9333EA 0%, #6B21A8 100%)",
                                        transform: "translateY(-1px)",
                                        boxShadow: "0 8px 25px rgba(168, 85, 247, 0.25)"
                                    }
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : "Initialize Ecosystem Vault"}
                            </Button>

                            <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.3)", textAlign: "center", mt: 1 }}>
                                Your MasterPass is the key to all your secure data. <br /> It cannot be recovered if lost.
                            </Typography>
                        </Stack>
                    </form>
                </Stack>
            ) : mode === "pin" ? (
                <Stack spacing={3} sx={{ mt: 2 }}>
                    <Box>
                        <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.4)", fontWeight: 600, mb: 1, display: "block", textAlign: "center" }}>
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
                                inputMode: "numeric",
                                style: { textAlign: "center", fontSize: "2rem", letterSpacing: "0.5em" }
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "14px",
                                    bgcolor: "rgba(255, 255, 255, 0.03)",
                                    "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                                    "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                                    "&.Mui-focused fieldset": { borderColor: "#A855F7" },
                                },
                                "& .MuiInputBase-input": { color: "white" }
                            }}
                        />
                    </Box>

                    <Button
                        fullWidth
                        variant="text"
                        size="small"
                        onClick={() => setMode("password")}
                        sx={{ color: "rgba(255, 255, 255, 0.5)", "&:hover": { color: "white" } }}
                    >
                        Use Master Password
                    </Button>
                </Stack>
            ) : mode === "passkey" ? (
                <Stack spacing={3} sx={{ mt: 2, alignItems: "center" }}>
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
                                    <stop offset="0%" stopColor="#A855F7" />
                                    <stop offset="100%" stopColor="#7E22CE" />
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
                            <Fingerprint size={32} color={passkeyLoading ? "#A855F7" : "rgba(255, 255, 255, 0.4)"} />
                        </Box>
                    </Box>

                    <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.3)", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {passkeyLoading ? "CONFIRM ON DEVICE" : "TAP TO VERIFY"}
                    </Typography>

                    <Button
                        fullWidth
                        variant="text"
                        size="small"
                        onClick={() => setMode("password")}
                        sx={{ color: "rgba(255, 255, 255, 0.5)", "&:hover": { color: "white" } }}
                    >
                        Use Master Password
                    </Button>
                </Stack>
            ) : (
                <Stack spacing={3} sx={{ mt: 2 }}>
                    <form onSubmit={handlePasswordVerify}>
                        <Stack spacing={2.5}>
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
                                    autoFocus
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Lock size={18} color="rgba(255, 255, 255, 0.3)" />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: "rgba(255, 255, 255, 0.3)" }}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </IconButton>
                                        ),
                                    }}
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: "14px",
                                            bgcolor: "rgba(255, 255, 255, 0.03)",
                                            "& fieldset": { borderColor: "rgba(255, 255, 255, 0.1)" },
                                            "&:hover fieldset": { borderColor: "rgba(255, 255, 255, 0.2)" },
                                            "&.Mui-focused fieldset": { borderColor: "#A855F7" },
                                        },
                                        "& .MuiInputBase-input": { color: "white" }
                                    }}
                                />
                            </Box>

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                disabled={loading || !password}
                                sx={{
                                    py: 1.8,
                                    borderRadius: "16px",
                                    background: "linear-gradient(135deg, #A855F7 0%, #7E22CE 100%)",
                                    color: "#FFFFFF",
                                    fontWeight: 800,
                                    fontFamily: "var(--font-satoshi)",
                                    textTransform: "none",
                                    "&:hover": {
                                        background: "linear-gradient(135deg, #9333EA 0%, #6B21A8 100%)",
                                        transform: "translateY(-1px)",
                                        boxShadow: "0 8px 25px rgba(168, 85, 247, 0.25)"
                                    }
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : "Verify Identity"}
                            </Button>
                        </Stack>
                    </form>

                    {hasPin && (
                        <Button
                            fullWidth
                            variant="text"
                            startIcon={<LayoutGrid size={18} />}
                            onClick={() => setMode("pin")}
                            sx={{ color: "rgba(255, 255, 255, 0.5)", "&:hover": { color: "white" } }}
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
                                window.open(`https://vault.kylrix.space/masterpass/reset?callbackUrl=${callbackUrl}`, "_blank");
                            }}
                            sx={{ color: "error.main", "&:hover": { bgcolor: alpha("#ef4444", 0.1) }, mt: 2 }}
                        >
                            Reset Master Password
                        </Button>
                    )}
                </Stack>
            )}
        </DialogContent>

        <DialogActions sx={{ flexDirection: "column", p: 4, pt: 0, gap: 2 }}>
            <Button
                variant="text"
                size="small"
                onClick={handleLogout}
                startIcon={<LogOut size={14} />}
                sx={{ color: "rgba(255, 255, 255, 0.4)", fontWeight: 600, "&:hover": { color: "white" } }}
            >
                Logout from Account
            </Button>
        </DialogActions>
    </Dialog>
);
}
