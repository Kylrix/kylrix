'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
} from '@mui/material';
import { X, ShieldAlert, Shield, User } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/context/auth/AuthContext';
import { UsersService, buildUsernameHandleSuggestions, invalidateUsersProfileRowCache } from '@/lib/services/users';
import { KeychainService } from '@/lib/appwrite/keychain';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { account } from '@/lib/appwrite/client';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

const SURFACE = '#161412';
const SURFACE_HOVER = '#1C1A18';
const EDGE = '#34322F';
const ACCENT_CYAN = '#00F0FF';
const AMBER = '#F59E0B';

const normalizeHandleInput = (raw: string) =>
    raw.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');

const USERNAME_DISMISS_PREFIX = 'kylrix_username_health_dismissed_';
const MP_DISMISS_PREFIX = 'kylrix_masterpass_health_dismissed_';

function profileBasicsIncomplete(profile: unknown | null) {
    if (!profile || typeof profile !== 'object') return true;
    const row = profile as { username?: string };
    const handle = normalizeHandleInput(String(row.username || ''));
    return handle.length < 3;
}

function routeSuppressesHealthUi(pathname: string | null) {
    if (!pathname) return true;
    if (pathname.includes('/settings')) return true;
    if (pathname.startsWith('/vault/masterpass')) return true;
    if (pathname.startsWith('/vault/reset')) return true;
    return false;
}

/**
 * Universal username picker + MasterPass setup prompts (bottom drawers).
 * Username gate runs first; MasterPass prompt waits until handle ≥ 3 chars.
 * Profile is loaded here (ProfileProvider is not wired app-wide).
 */
export function AccountHealthDrawers() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();

    const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);

    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [usernameDismissed, setUsernameDismissed] = useState(false);
    const [mpDismissed, setMpDismissed] = useState(false);

    const [newHandle, setNewHandle] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [available, setAvailable] = useState<boolean | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const prevUsernameDrawer = useRef(false);

    const suppress = routeSuppressesHealthUi(pathname ?? null);

    const profileFetchGen = useRef(0);

    const reloadProfile = useCallback(async () => {
        if (!user?.$id) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }
        const gen = ++profileFetchGen.current;
        setProfileLoading(true);
        try {
            const p = await UsersService.getProfileById(user.$id);
            if (gen !== profileFetchGen.current) return;
            setProfile(p);
        } catch {
            if (gen !== profileFetchGen.current) return;
            setProfile(null);
        } finally {
            if (gen === profileFetchGen.current) setProfileLoading(false);
        }
    }, [user?.$id]);

    /** Profile + keychain: mount + user change only (not every pathname — avoids request storms on slow tunnels). */
    useEffect(() => {
        void reloadProfile();
    }, [reloadProfile]);

    const needsBasics = useMemo(() => profileBasicsIncomplete(profile), [profile]);
    const suggestionList = useMemo(
        () => (user ? buildUsernameHandleSuggestions(user) : []),
        [user]
    );

    const canonicalSavedHandle = useMemo(() => {
        const u = profile && typeof profile.username === 'string' ? profile.username : '';
        return normalizeHandleInput(u);
    }, [profile]);

    useEffect(() => {
        if (!user?.$id) {
            setUsernameDismissed(false);
            setMpDismissed(false);
            return;
        }
        setUsernameDismissed(sessionStorage.getItem(`${USERNAME_DISMISS_PREFIX}${user.$id}`) === '1');
        setMpDismissed(sessionStorage.getItem(`${MP_DISMISS_PREFIX}${user.$id}`) === '1');
    }, [user?.$id]);

    const refreshMasterpass = useCallback(() => {
        if (!user?.$id) {
            setHasMasterpass(null);
            return;
        }
        KeychainService.hasMasterpass(user.$id)
            .then((ok) => setHasMasterpass(ok))
            .catch(() => setHasMasterpass(false));
    }, [user?.$id]);

    useEffect(() => {
        refreshMasterpass();
    }, [refreshMasterpass]);

    useEffect(() => {
        if (!user?.$id) return;
        let debounce: ReturnType<typeof setTimeout> | undefined;
        const bump = () => {
            if (debounce) window.clearTimeout(debounce);
            debounce = window.setTimeout(() => {
                debounce = undefined;
                void reloadProfile();
                refreshMasterpass();
            }, 400);
        };
        const onFocus = () => bump();
        const onVis = () => {
            if (document.visibilityState === 'visible') bump();
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVis);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVis);
            if (debounce) window.clearTimeout(debounce);
        };
    }, [user?.$id, reloadProfile, refreshMasterpass]);

    const usernameDrawerOpen =
        !!user &&
        !profileLoading &&
        !suppress &&
        needsBasics &&
        !usernameDismissed;

    const masterpassDrawerOpen =
        !!user &&
        !profileLoading &&
        !suppress &&
        !needsBasics &&
        !usernameDismissed &&
        hasMasterpass === false &&
        !mpDismissed;

    useEffect(() => {
        if (usernameDrawerOpen && !prevUsernameDrawer.current && user) {
            setNewHandle(canonicalSavedHandle || suggestionList[0] || '');
            const dn =
                (profile && typeof profile.displayName === 'string' ? profile.displayName : '') ||
                user.name ||
                '';
            setDisplayName(String(dn).trim());
            setAvailable(null);
        }
        prevUsernameDrawer.current = usernameDrawerOpen;
    }, [usernameDrawerOpen, user, profile, canonicalSavedHandle, suggestionList]);

    useEffect(() => {
        const normalized = normalizeHandleInput(newHandle);
        if (
            !normalized ||
            normalized.length < 3 ||
            normalized === canonicalSavedHandle ||
            !usernameDrawerOpen
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
    }, [newHandle, canonicalSavedHandle, usernameDrawerOpen]);

    const dismissUsername = () => {
        if (user?.$id) {
            sessionStorage.setItem(`${USERNAME_DISMISS_PREFIX}${user.$id}`, '1');
        }
        setUsernameDismissed(true);
    };

    const dismissMasterpass = () => {
        if (user?.$id) {
            sessionStorage.setItem(`${MP_DISMISS_PREFIX}${user.$id}`, '1');
        }
        setMpDismissed(true);
    };

    const openVaultSetup = () => {
        const callback =
            typeof window !== 'undefined'
                ? encodeURIComponent(window.location.href)
                : encodeURIComponent('/');
        router.push(`/vault/masterpass?callbackUrl=${callback}`);
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
                // optional — mirror DiscoverabilitySettings
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
                // prefs sync best-effort
            }

            invalidateUsersProfileRowCache(user.$id);
            sessionStorage.removeItem(`${USERNAME_DISMISS_PREFIX}${user.$id}`);
            setUsernameDismissed(false);
            setConfirmOpen(false);
            await reloadProfile();
            refreshMasterpass();
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

    return (
        <>
            <Drawer
                anchor="bottom"
                open={usernameDrawerOpen}
                onClose={dismissUsername}
                slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
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
                                Same rules as Settings · live availability check · unique across Kylrix.
                            </Typography>
                        </Paper>
                        <IconButton onClick={dismissUsername} aria-label="Close" sx={{ color: 'text.secondary', mt: 0.35 }}>
                            <X size={20} />
                        </IconButton>
                    </Box>

                    <Divider sx={{ my: 2.25, borderColor: EDGE }} />

                    {suggestionList.length > 0 ? (
                        <Stack spacing={1} sx={{ mb: 2 }}>
                            <Typography
                                sx={{
                                    fontWeight: 800,
                                    fontSize: '0.65rem',
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    color: 'rgba(255,255,255,0.45)',
                                }}
                            >
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
                            onChange={(e) => setNewHandle(normalizeHandleInput(e.target.value))}
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
                            onChange={(e) => setDisplayName(e.target.value)}
                            autoComplete="name"
                            helperText="Defaults from your account name or handle if empty"
                        />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.75 }} justifyContent="flex-end">
                        <Button variant="text" sx={{ color: 'text.secondary' }} onClick={dismissUsername}>
                            Not now
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

            <Drawer
                anchor="bottom"
                open={masterpassDrawerOpen}
                onClose={dismissMasterpass}
                slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
                PaperProps={{
                    sx: {
                        ...drawerPaperSx,
                        maxHeight: 'min(380px, 88dvh)',
                    },
                }}
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
                                <Box
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '12px',
                                        bgcolor: SURFACE,
                                        border: `1px solid ${EDGE}`,
                                        display: 'grid',
                                        placeItems: 'center',
                                        flexShrink: 0,
                                    }}
                                >
                                    <Shield color={AMBER} size={21} strokeWidth={2.4} />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: '1.06rem' }}>
                                        Initialize MasterPass
                                    </Typography>
                                    <Typography sx={{ opacity: 0.66, mt: 0.45, fontSize: '0.88rem', lineHeight: 1.46 }}>
                                        No Vault master-password marker found. Open{' '}
                                        <Box component="span" sx={{ color: AMBER, fontWeight: 800 }}>
                                            /vault/masterpass
                                        </Box>{' '}
                                        to finish setup (reset lives separately at /vault/reset).
                                    </Typography>
                                </Box>
                            </Box>
                        </Paper>
                        <IconButton onClick={dismissMasterpass} aria-label="Close" sx={{ color: 'text.secondary' }}>
                            <X size={20} />
                        </IconButton>
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.5 }} justifyContent="flex-end">
                        <Button variant="text" sx={{ color: 'text.secondary' }} onClick={dismissMasterpass}>
                            Remind me later
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
        </>
    );
}
