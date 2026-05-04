'use client';

import React, { useEffect, useState } from 'react';
import {
    Drawer,
    Box,
    Typography,
    Stack,
    TextField,
    Button,
    IconButton,
    Divider,
    InputAdornment,
    CircularProgress,
} from '@mui/material';
import { X, CheckCircle2, CircleAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/components/providers/ProfileProvider';
import { UsersService } from '@/lib/services/users';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { account } from '@/lib/appwrite/client';
import toast from 'react-hot-toast';

const DISMISS_KEY_PREFIX = 'kylrix_connect_profile_setup_dismissed';

const normalizeUsername = (value: string) =>
    value.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');

export const ProfileSetupDrawer = () => {
    const { user } = useAuth();
    const { profile, isLoading, refreshProfile } = useProfile();
    const [open, setOpen] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user?.$id) return;
        setDismissed(sessionStorage.getItem(`${DISMISS_KEY_PREFIX}_${user.$id}`) === '1');
    }, [user?.$id]);

    useEffect(() => {
        if (!user?.$id || isLoading) return;

        const needsSetup = !profile?.username || !profile?.displayName;
        setOpen(Boolean(needsSetup && !dismissed));
    }, [user?.$id, profile?.username, profile?.displayName, isLoading, dismissed]);

    useEffect(() => {
        if (!open) return;

        setUsername(profile?.username || '');
        setDisplayName(profile?.displayName || user?.name || '');
        setBio(profile?.bio || '');
        setError('');
        setIsAvailable(null);
    }, [open, profile, user?.name]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!open || !user?.$id) return;

            const currentUsername = profile?.username || '';
            const nextUsername = normalizeUsername(username);
            if (!nextUsername || nextUsername === currentUsername) {
                setIsAvailable(null);
                return;
            }

            if (nextUsername.length < 3) {
                setIsAvailable(false);
                return;
            }

            setIsChecking(true);
            try {
                const available = await UsersService.isUsernameAvailable(nextUsername);
                setIsAvailable(available);
            } catch (err) {
                console.error('Failed to check username:', err);
            } finally {
                setIsChecking(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [open, username, profile?.username, user?.$id]);

    const handleDismiss = () => {
        if (user?.$id) {
            sessionStorage.setItem(`${DISMISS_KEY_PREFIX}_${user.$id}`, '1');
        }
        setDismissed(true);
        setOpen(false);
    };

    const handleSave = async () => {
        if (!user?.$id) return;

        const nextUsername = normalizeUsername(username);
        if (!nextUsername) {
            setError('Username is required');
            return;
        }

        if (nextUsername !== profile?.username && isAvailable === false) {
            setError('Please pick an available username');
            return;
        }

        setLoading(true);
        setError('');
        try {
            let publicKey: string | undefined;
            if (ecosystemSecurity.status.isUnlocked) {
                try {
                    const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    if (pub) publicKey = pub;
                } catch (syncError) {
                    console.warn('Could not sync public key during profile setup', syncError);
                }
            }

            await UsersService.updateProfile(user.$id, {
                username: nextUsername,
                displayName: displayName.trim(),
                bio,
                publicKey,
            });

            if (displayName.trim() || nextUsername) {
                try {
                    if (displayName.trim()) {
                        await account.updateName(displayName.trim());
                    }
                    const currentPrefs = user?.prefs || {};
                    await account.updatePrefs({
                        ...currentPrefs,
                        username: nextUsername,
                    });
                } catch (prefErr) {
                    console.warn('Failed to sync display name or username to account prefs', prefErr);
                }
            }

            await refreshProfile();
            toast.success('Profile setup saved');
            setOpen(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save profile';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={handleDismiss}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: '24px',
                    borderTopRightRadius: '24px',
                    bgcolor: '#161412',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    backgroundImage: 'none',
                },
            }}
        >
            <Box sx={{ maxWidth: 720, width: '100%', mx: 'auto', p: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: 'white' }}>
                            Set up your chat profile
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.65, mt: 0.5 }}>
                            Pick a username so people can find you in Connect.
                        </Typography>
                    </Box>
                    <IconButton onClick={handleDismiss} sx={{ color: 'text.secondary' }}>
                        <X size={18} />
                    </IconButton>
                </Box>

                <Divider sx={{ my: 2.5, borderColor: 'rgba(255, 255, 255, 0.06)' }} />

                <Stack spacing={2}>
                    <TextField
                        label="Username"
                        value={username}
                        onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                        fullWidth
                        autoComplete="off"
                        InputProps={{
                            startAdornment: <InputAdornment position="start">@</InputAdornment>,
                            endAdornment: (
                                <InputAdornment position="end">
                                    {isChecking && <CircularProgress size={18} />}
                                    {!isChecking && isAvailable === true && username && normalizeUsername(username) !== profile?.username && (
                                        <CheckCircle2 size={18} color="#10B981" />
                                    )}
                                    {!isChecking && isAvailable === false && username && normalizeUsername(username) !== profile?.username && (
                                        <CircleAlert size={18} color="#F59E0B" />
                                    )}
                                </InputAdornment>
                            ),
                        }}
                        helperText={
                            isAvailable === false && normalizeUsername(username) !== profile?.username
                                ? 'Username is already taken'
                                : 'Only letters, numbers, underscores, and hyphens'
                        }
                    />

                    <TextField
                        label="Display name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        fullWidth
                    />

                    <TextField
                        label="Bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        fullWidth
                        multiline
                        rows={3}
                    />
                </Stack>

                {error && (
                    <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                        {error}
                    </Typography>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
                    <Button onClick={handleDismiss} variant="text" sx={{ color: 'text.secondary' }}>
                        Dismiss
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={loading || !normalizeUsername(username) || (isAvailable === false && normalizeUsername(username) !== profile?.username)}
                        sx={{ borderRadius: '12px', px: 2.5 }}
                    >
                        {loading ? <CircularProgress size={22} color="inherit" /> : 'Save profile'}
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
};
