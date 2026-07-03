'use client';

import React, { useState } from 'react';
import {
    Box,
    Typography,
    Stack,
    TextField,
    Button,
    IconButton,
    Drawer,
    InputAdornment,
    CircularProgress,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Paper,
} from '@/lib/openbricks/primitives';
import { X, ShieldAlert, Shield, User, Fingerprint, Bell, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useSetup } from '@/context/SetupContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { UsersService, buildUsernameHandleSuggestions, invalidateUsersProfileRowCache } from '@/lib/services/users';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { account } from '@/lib/appwrite/client';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';
import { useSudo } from '@/context/SudoContext';

const SURFACE = '#161412';
const SURFACE_HOVER = '#1C1A18';
const EDGE = '#34322F';
const ACCENT_CYAN = '#00F0FF';
const AMBER = '#F59E0B';

const normalizeHandleInput = (raw: string) =>
    raw.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');

export function AccountHealthDrawers() {
    const router = useRouter();
    const { user } = useAuth();
    const { activeContent } = useUnifiedDrawer();
    const { currentStep, dismissStep, profile, triggerCheck } = useSetup();
    const { requestSudo } = useSudo();

    const [newHandle, setNewHandle] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [available, setAvailable] = useState<boolean | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [showPasskeySetup, setShowPasskeySetup] = useState(false);

    const suggestionList = React.useMemo(
        () => (user ? buildUsernameHandleSuggestions(user) : []),
        [user]
    );

    const canonicalSavedHandle = React.useMemo(() => {
        const u = profile && typeof profile.username === 'string' ? profile.username : '';
        return normalizeHandleInput(u);
    }, [profile]);

    React.useEffect(() => {
        if (currentStep === 'username' && user) {
            setNewHandle(canonicalSavedHandle || suggestionList[0] || '');
            const dn =
                (profile && typeof profile.displayName === 'string' ? profile.displayName : '') ||
                user.name ||
                '';
            setDisplayName(String(dn).trim());
            setAvailable(null);
        }
    }, [currentStep, user, profile, canonicalSavedHandle, suggestionList]);

    React.useEffect(() => {
        const normalized = normalizeHandleInput(newHandle);
        if (
            !normalized ||
            normalized.length < 3 ||
            normalized === canonicalSavedHandle ||
            currentStep !== 'username'
        ) {
            setAvailable(null);
            setCheckingAvailability(false);
            return;
        }

        let cancelled = false;
        const id = window.setTimeout(async () => {
            setCheckingAvailability(true);
            try {
                const ok = await UsersService.isUsernameAvailable(normalized);
                if (!cancelled) setAvailable(ok);
            } catch {
                if (!cancelled) setAvailable(null);
            } finally {
                if (!cancelled) setCheckingAvailability(false);
            }
        }, 500);

        return () => {
            cancelled = true;
            window.clearTimeout(id);
        };
    }, [newHandle, canonicalSavedHandle, currentStep]);

    const openVaultSetup = () => {
        requestSudo({
            intent: 'initialize',
            onSuccess: () => {
                triggerCheck();
            }
        });
    };

    const commitUsername = async (normalizedHandle: string, displayTrim: string) => {
        if (!user?.$id) return;
        setSavingProfile(true);

        try {
            let publicKey: string | undefined;
            try {
                if (ecosystemSecurity.status.isUnlocked) {
                    const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    if (pub) publicKey = pub;
                }
            } catch {
                // Best effort
            }

            if (profile?.$id) {
                await UsersService.updateProfile(user.$id, {
                    username: normalizedHandle,
                    displayName: displayTrim,
                    ...(publicKey ? { publicKey } : {}),
                });
            } else {
                await UsersService.createProfile(user.$id, normalizedHandle, {
                    displayName:
                        displayTrim ||
                        (normalizedHandle.charAt(0).toUpperCase() + normalizedHandle.slice(1)),
                    ...(publicKey ? { publicKey } : {}),
                });
            }

            try {
                if (displayTrim) await account.updateName(displayTrim);
                const currentPrefs = user.prefs || {};
                await account.updatePrefs({ ...currentPrefs, username: normalizedHandle });
            } catch {
                // Best effort
            }

            invalidateUsersProfileRowCache(user.$id);
            setConfirmOpen(false);
            await triggerCheck();
            toast.success('Universal identity saved');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Could not save profile');
        } finally {
            setSavingProfile(false);
        }
    };

    const requestSaveUsername = async () => {
        if (!user?.$id) return;
        const normalized = normalizeHandleInput(newHandle);
        if (normalized.length < 3) {
            toast.error('Username must be at least 3 characters.');
            return;
        }
        if (normalized !== canonicalSavedHandle && available === false) {
            toast.error('That username is unavailable.');
            return;
        }

        const displayTrim =
            displayName.trim() ||
            (user.name || '').trim() ||
            normalized.charAt(0).toUpperCase() + normalized.slice(1);

        if (canonicalSavedHandle && normalized !== canonicalSavedHandle) {
            setConfirmOpen(true);
            return;
        }

        await commitUsername(normalized, displayTrim);
    };

    const handleSetupPasskeySuccess = async () => {
        setShowPasskeySetup(false);
        await triggerCheck();
    };

    const drawerPaperSx = {
        borderTopLeftRadius: '26px',
        borderTopRightRadius: '26px',
        bgcolor: SURFACE,
        borderTop: `1px solid ${EDGE}`,
        backgroundImage: 'none',
        maxHeight: 'min(520px, 92dvh)',
        boxShadow: '0 -12px 42px rgba(0, 0, 0, 0.52)',
        pb: 'calc(1rem + env(safe-area-inset-bottom))',
    };

    const normalizedTyping = normalizeHandleInput(newHandle);
    const canSaveUsername =
        normalizedTyping.length >= 3 &&
        !(normalizedTyping !== canonicalSavedHandle && available === false) &&
        !checkingAvailability;

    if (activeContent === 'login') {
        return null;
    }

    return (
        <>
            {/* MasterPass Setup Drawer */}
            <Drawer
                anchor="bottom"
                open={currentStep === 'masterpass'}
                onClose={() => dismissStep('masterpass', 3)}
                slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
                ModalProps={{ keepMounted: false, disableScrollLock: false }}
                PaperProps={{ sx: { ...drawerPaperSx, maxHeight: 'min(380px, 88dvh)' } }}
            >
                <Box sx={{ maxWidth: 720, width: '100%', mx: 'auto', p: { xs: 2, sm: 2.75 }, pt: 2.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                px: 1.6,
                                py: 1.25,
                                borderRadius: '16px',
                                bgcolor: SURFACE_HOVER,
                                border: `1px solid ${EDGE}`,
                                flex: 1,
                            }}
                        >
                            <Box sx={{ display: 'flex', gap: 1.35, alignItems: 'flex-start' }}>
                                <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: SURFACE, border: `1px solid ${EDGE}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                    <Shield color={AMBER} size={21} strokeWidth={2.4} />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: '1.06rem' }}>
                                        Initialize MasterPass
                                    </Typography>
                                    <Typography sx={{ opacity: 0.66, mt: 0.45, fontSize: '0.88rem', lineHeight: 1.46 }}>
                                        No Vault master-password marker found. Setup MasterPass to secure your account.
                                    </Typography>
                                </Box>
                            </Box>
                        </Paper>
                        <IconButton onClick={() => dismissStep('masterpass', 3)} aria-label="Close" sx={{ color: 'text.secondary' }}>
                            <X size={20} />
                        </IconButton>
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.5 }} justifyContent="flex-end">
                        <Button variant="text" sx={{ color: 'text.secondary' }} onClick={() => dismissStep('masterpass', 3)}>
                            Remind me in 3 days
                        </Button>
                        <Button
                            variant="contained"
                            onClick={openVaultSetup}
                            sx={{
                                borderRadius: '14px',
                                py: 1.15,
                                fontWeight: 900,
                                textTransform: 'none',
                                bgcolor: AMBER,
                                color: '#000',
                                '&:hover': { bgcolor: '#fbbf24' },
                            }}
                        >
                            Open Vault setup
                        </Button>
                    </Stack>
                </Box>
            </Drawer>

            {/* Username/Handle Setup Drawer */}
            <Drawer
                anchor="bottom"
                open={currentStep === 'username'}
                onClose={() => dismissStep('username', 7)}
                slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
                ModalProps={{ keepMounted: false, disableScrollLock: false }}
                PaperProps={{ sx: drawerPaperSx }}
            >
                <Box sx={{ maxWidth: 720, width: '100%', mx: 'auto', p: { xs: 2, sm: 2.75 }, pt: 2.25 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                px: 1.6,
                                py: 1.2,
                                borderRadius: '16px',
                                bgcolor: SURFACE_HOVER,
                                border: `1px solid ${EDGE}`,
                                flex: 1,
                            }}
                        >
                            <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: '1.05rem' }}>
                                Set your ecosystem handle
                            </Typography>
                            <Typography sx={{ opacity: 0.72, mt: 0.45, fontSize: '0.88rem', lineHeight: 1.45 }}>
                                Create a unique lowercase handle to be discovered on Kylrix.
                            </Typography>
                        </Paper>
                        <IconButton onClick={() => dismissStep('username', 7)} aria-label="Close" sx={{ color: 'text.secondary' }}>
                            <X size={20} />
                        </IconButton>
                    </Box>

                    <Divider sx={{ my: 2.25, borderColor: EDGE }} />

                    {suggestionList.length > 0 ? (
                        <Stack spacing={1} sx={{ mb: 2 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                                Suggestions
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {suggestionList.map((hint) => (
                                    <Chip
                                        key={hint}
                                        size="small"
                                        label={`@${hint}`}
                                        onClick={() => setNewHandle(hint)}
                                        icon={<User size={14} color="rgba(255,255,255,0.5)" />}
                                        sx={{
                                            borderRadius: '12px',
                                            fontWeight: 800,
                                            fontFamily: 'var(--font-mono)',
                                            bgcolor: SURFACE_HOVER,
                                            border: `1px solid ${EDGE}`,
                                            color: '#fff',
                                        }}
                                    />
                                ))}
                            </Box>
                        </Stack>
                    ) : null}

                    <Stack spacing={2}>
                        <TextField
                            fullWidth
                            label="Universal handle"
                            value={newHandle}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHandle(normalizeHandleInput(e.target.value))}
                            autoComplete="off"
                            helperText={
                                normalizedTyping !== canonicalSavedHandle && available === false
                                    ? 'That handle is already taken'
                                    : 'Lowercase letters, numbers, underscores only'
                            }
                            error={normalizedTyping !== canonicalSavedHandle && available === false}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Typography sx={{ color: ACCENT_CYAN, fontWeight: 900 }}>@</Typography>
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {checkingAvailability ? (
                                            <CircularProgress size={18} sx={{ color: ACCENT_CYAN }} />
                                        ) : null}
                                        {!checkingAvailability &&
                                        normalizedTyping.length >= 3 &&
                                        normalizedTyping !== canonicalSavedHandle &&
                                        available === true ? (
                                            <Typography sx={{ color: '#10B981', fontWeight: 900, fontSize: '0.75rem' }}>
                                                OPEN
                                            </Typography>
                                        ) : null}
                                    </InputAdornment>
                                ),
                                sx: { fontFamily: 'var(--font-mono)', fontWeight: 700 },
                            }}
                        />

                        <TextField
                            fullWidth
                            label="Display name (optional)"
                            value={displayName}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDisplayName(e.target.value)}
                            autoComplete="name"
                        />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.75 }} justifyContent="flex-end">
                        <Button variant="text" sx={{ color: 'text.secondary' }} onClick={() => dismissStep('username', 7)}>
                            Remind me in a week
                        </Button>
                        <Button
                            variant="contained"
                            disabled={!canSaveUsername || savingProfile}
                            onClick={() => void requestSaveUsername()}
                            sx={{
                                borderRadius: '14px',
                                py: 1.15,
                                fontWeight: 900,
                                textTransform: 'none',
                                bgcolor: ACCENT_CYAN,
                                color: '#000',
                                '&:hover': { bgcolor: '#33f3ff' },
                            }}
                        >
                            {savingProfile ? <CircularProgress size={22} sx={{ color: '#000' }} /> : 'Save & verify'}
                        </Button>
                    </Stack>
                </Box>
            </Drawer>

            {/* Passkey Setup Reminder Drawer */}
            <Drawer
                anchor="bottom"
                open={currentStep === 'passkey'}
                onClose={() => dismissStep('passkey', 7)}
                slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
                ModalProps={{ keepMounted: false, disableScrollLock: false }}
                PaperProps={{ sx: { ...drawerPaperSx, maxHeight: 'min(400px, 90dvh)' } }}
            >
                <Box sx={{ p: 4, maxWidth: '600px', mx: 'auto', width: '100%' }}>
                    <Stack spacing={3}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box sx={{ p: 1.5, bgcolor: '#1C1A18', border: '1px solid #34322F', borderRadius: '14px', display: 'grid', placeItems: 'center' }}>
                                <Fingerprint color="#6366F1" size={24} />
                            </Box>
                            <IconButton onClick={() => dismissStep('passkey', 7)} sx={{ color: '#9B9691' }}>
                                <X size={20} />
                            </IconButton>
                        </Stack>

                        <Box>
                            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', mb: 1 }}>
                                Upgrade to Biometric Access
                            </Typography>
                            <Typography sx={{ color: '#9B9691', fontSize: '0.95rem', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6 }}>
                                Enable Face ID, Touch ID, or Windows Hello for a faster, more secure way to authenticate.
                            </Typography>
                        </Box>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={() => setShowPasskeySetup(true)}
                                sx={{
                                    bgcolor: '#6366F1',
                                    color: '#fff',
                                    fontWeight: 900,
                                    borderRadius: '16px',
                                    py: 1.75,
                                    textTransform: 'none',
                                    '&:hover': { bgcolor: '#575CF0' }
                                }}
                                startIcon={<ShieldCheck size={18} />}
                            >
                                Setup Passkey
                            </Button>
                            <Button
                                fullWidth
                                variant="text"
                                onClick={() => dismissStep('passkey', 7)}
                                sx={{
                                    color: '#9B9691',
                                    fontWeight: 700,
                                    borderRadius: '16px',
                                    py: 1.75,
                                    textTransform: 'none',
                                    '&:hover': { bgcolor: '#1C1A18', color: '#fff' }
                                }}
                                startIcon={<Bell size={18} />}
                            >
                                Remind me in a week
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
            </Drawer>

            <Dialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: '24px',
                        bgcolor: SURFACE,
                        border: `1px solid ${EDGE}`,
                        maxWidth: 420,
                        width: '100%',
                    },
                }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontWeight: 800, color: '#fff' }}>
                    <ShieldAlert color={ACCENT_CYAN} size={22} strokeWidth={2.2} />
                    Confirm handle change
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ opacity: 0.72, color: '#fff', mb: 2.25, lineHeight: 1.55 }}>
                        Your universal handle affects discovery across Kylrix.
                    </Typography>
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2,
                            borderRadius: '14px',
                            bgcolor: SURFACE_HOVER,
                            border: `1px dashed ${EDGE}`,
                        }}
                    >
                        <Typography variant="caption" sx={{ opacity: 0.5, color: '#fff' }}>
                            NEW HANDLE
                        </Typography>
                        <Typography sx={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: ACCENT_CYAN, mt: 0.5 }}>
                            @{normalizeHandleInput(newHandle)}
                        </Typography>
                    </Paper>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2.5 }}>
                    <Button onClick={() => setConfirmOpen(false)} sx={{ color: 'rgba(255,255,255,0.55)' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        disabled={savingProfile}
                        onClick={() => {
                            const normalized = normalizeHandleInput(newHandle);
                            const displayTrim =
                                displayName.trim() ||
                                (user?.name || '').trim() ||
                                normalized.charAt(0).toUpperCase() + normalized.slice(1);
                            void commitUsername(normalized, displayTrim);
                        }}
                        sx={{
                            borderRadius: '12px',
                            bgcolor: ACCENT_CYAN,
                            color: '#000',
                            fontWeight: 800,
                            '&:hover': { bgcolor: '#33f3ff' },
                        }}
                    >
                        {savingProfile ? <CircularProgress size={20} sx={{ color: '#000' }} /> : 'Update identity'}
                    </Button>
                </DialogActions>
            </Dialog>

            {showPasskeySetup && user && (
                <PasskeySetup
                    open={showPasskeySetup}
                    userId={user.$id}
                    onClose={() => setShowPasskeySetup(false)}
                    onSuccess={handleSetupPasskeySuccess}
                />
            )}
        </>
    );
}
