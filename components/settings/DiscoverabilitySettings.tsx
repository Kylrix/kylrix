'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    Typography,
    Paper,
    Stack,
    Switch,
    Divider,
    CircularProgress,
    alpha,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Avatar,
} from '@mui/material';
import {
    Search,
    Edit2,
    Check,
    X,
    ShieldAlert,
    User,
    Image as ImageIcon,
    Globe,
    MessageSquare,
} from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/context/auth/AuthContext';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { storage } from '@/lib/appwrite/client';
import { getUserProfilePicId } from '@/lib/user-utils';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import SudoModal from '@/components/overlays/SudoModal';

const ACCENT_CONNECT = '#F59E0B';
const ACCENT_AVATAR = '#10B981';
const ACCENT_MESSAGE = '#6366F1';

export const DiscoverabilitySettings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [savingDiscoverable, setSavingDiscoverable] = useState(false);
    const [savingContact, setSavingContact] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [username, setUsername] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [isSudoOpen, setIsSudoOpen] = useState(false);
    const [avatarPublicRead, setAvatarPublicRead] = useState(false);

    const resolvedAvatarFileId = useMemo(() => {
        const rowId = typeof profile?.avatar === 'string' ? profile.avatar.trim() : '';
        if (rowId && !rowId.startsWith('http')) return rowId;
        const prefsId = getUserProfilePicId(user);
        if (prefsId && !String(prefsId).startsWith('http')) return String(prefsId);
        return null;
    }, [profile?.avatar, user]);

    const loadProfile = useCallback(async () => {
        if (!user?.$id) return;
        try {
            const p = await UsersService.getProfileById(user.$id);
            setProfile(p);
            if (p) {
                const u = p.username || '';
                setUsername(u);
                setNewUsername(u);
            } else {
                setUsername('');
                setNewUsername('');
            }
        } catch (_e: unknown) {
            console.error('Failed to load profile', _e);
        } finally {
            setLoading(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (user?.$id) loadProfile();
    }, [user?.$id, loadProfile]);

    useEffect(() => {
        let cancelled = false;
        const id = profile?.avatar || getUserProfilePicId(user);
        if (!id) {
            setPreviewUrl(null);
            return;
        }
        if (typeof id === 'string' && id.startsWith('http')) {
            setPreviewUrl(id);
            return;
        }
        (async () => {
            try {
                const { fetchProfilePreview } = await import('@/lib/profilePreview');
                const url = await fetchProfilePreview(id, 96, 96);
                if (!cancelled) setPreviewUrl(url);
            } catch {
                if (!cancelled) setPreviewUrl(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [profile?.avatar, user]);

    useEffect(() => {
        let cancelled = false;
        const fileId = resolvedAvatarFileId;
        if (!fileId) {
            setAvatarPublicRead(false);
            return;
        }

        void (async () => {
            try {
                const f = await storage.getFile(APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES, fileId);
                if (cancelled) return;
                const pub =
                    Array.isArray((f as any).$permissions) &&
                    ((f as any).$permissions as string[]).some((p: string) => typeof p === 'string' && p.includes('read("any")'));
                setAvatarPublicRead(!!pub);
            } catch {
                if (!cancelled) setAvatarPublicRead(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [resolvedAvatarFileId]);

    useEffect(() => {
        const check = async () => {
            const normalized = newUsername
                .toLowerCase()
                .trim()
                .replace(/^@/, '')
                .replace(/[^a-z0-9_]/g, '');
            if (!normalized || normalized === username || normalized.length < 3) {
                setIsAvailable(null);
                return;
            }

            setCheckingAvailability(true);
            try {
                const available = await UsersService.isUsernameAvailable(normalized);
                setIsAvailable(available);
            } catch (e) {
                console.error('Check failed', e);
                setIsAvailable(null);
            } finally {
                setCheckingAvailability(false);
            }
        };

        const timeoutId = setTimeout(check, 500);
        return () => clearTimeout(timeoutId);
    }, [newUsername, username]);

    const handleToggleDiscoverability = async (checked: boolean) => {
        if (!user?.$id) return;

        if (!profile) {
            setIsEditing(true);
            toast.error('Set a username first to enable discovery');
            return;
        }

        setSavingDiscoverable(true);
        try {
            const p = await UsersService.setProfileDiscoverable(user.$id, checked);
            setProfile(p || profile);
            toast.success(checked ? 'Profile is now discoverable in global search' : 'Profile discoverability turned off');
        } catch (e: any) {
            toast.error(e.message || 'Failed to toggle profile discoverability');
        } finally {
            setSavingDiscoverable(false);
        }
    };

    const handleToggleAvatarVisibility = async (checked: boolean) => {
        if (!user?.$id) return;

        const fileId = resolvedAvatarFileId;
        if (!fileId || String(fileId).startsWith('http')) {
            toast.error('Set a profile picture first to manage visibility');
            return;
        }

        setSavingAvatar(true);
        try {
            const p = await UsersService.setAvatarVisible(user.$id, fileId, checked);
            setProfile(p || profile);
            setAvatarPublicRead(checked);
            toast.success(checked ? 'Profile image is visible where your profile appears' : 'Profile image visibility restricted');
        } catch (e: any) {
            toast.error(e.message || 'Failed to toggle avatar visibility');
        } finally {
            setSavingAvatar(false);
        }
    };

    const handleToggleContact = async (checked: boolean) => {
        if (!user?.$id) return;

        if (checked) {
            if (!ecosystemSecurity.status.isUnlocked) {
                setIsSudoOpen(true);
                return;
            }

            setSavingContact(true);
            try {
                const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                if (pub) {
                    const p = await UsersService.updateProfile(user.$id, { publicKey: pub });
                    setProfile(p || { ...profile, publicKey: pub });
                    toast.success('People can reach you with encrypted messages');
                }
            } catch (e: any) {
                toast.error(`Failed to enable contact: ${e.message}`);
            } finally {
                setSavingContact(false);
            }
        } else {
            setSavingContact(true);
            try {
                const p = await UsersService.updateProfile(user.$id, { publicKey: '' });
                setProfile(p || { ...profile, publicKey: '' });
                toast.success('Secure contact disabled');
            } catch (e: any) {
                toast.error(`Failed to disable contact: ${e.message}`);
            } finally {
                setSavingContact(false);
            }
        }
    };

    const handleSyncE2E = async () => {
        if (!user?.$id || !profile) return;

        if (!ecosystemSecurity.status.isUnlocked) {
            toast.error('Unlock your vault to publish secure messaging keys');
            return;
        }

        setSaving(true);
        setSyncError(null);
        try {
            const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
            if (pub) {
                const updated = await UsersService.updateProfile(user.$id, { publicKey: pub });
                setProfile(updated || { ...profile, publicKey: pub });
                toast.success('Encryption keys synced to your profile');
            } else {
                setSyncError('Identity exists locally but could not be published.');
            }
        } catch (e: any) {
            console.error('Sync error:', e);
            setSyncError(e.message || 'Failed to sync identity keys');
            toast.error('Failed to sync keys');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveUsername = async () => {
        if (!user?.$id || !newUsername) return;
        const normalized = newUsername.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');

        if (normalized.length < 3) {
            toast.error('Username must be at least 3 characters');
            return;
        }

        setSaving(true);
        try {
            let publicKey: string | undefined;
            try {
                if (ecosystemSecurity.status.isUnlocked) {
                    const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    if (pub) publicKey = pub;
                }
            } catch (_e) {
                /* ignore */
            }

            if (profile) {
                const updated = await UsersService.updateProfile(user.$id, {
                    username: normalized,
                    ...(typeof publicKey === 'string' ? { publicKey } : {}),
                });
                setUsername(normalized);
                setProfile(updated || { ...profile, username: normalized, publicKey });
                toast.success('Handle updated');
            } else {
                const p = await UsersService.createProfile(user.$id, normalized, {
                    displayName: user.name || (normalized.charAt(0).toUpperCase() + normalized.slice(1)),
                    publicKey,
                    bio: '',
                });
                setProfile(p);
                setUsername(normalized);
                toast.success('Universal identity initialized');
            }
            setIsEditing(false);
            setShowConfirm(false);
        } catch (e: any) {
            toast.error(e.message || 'Failed to save handle');
        } finally {
            setSaving(false);
        }
    };

    if (!user?.$id) {
        return (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                Sign in to manage discoverability.
            </Typography>
        );
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={24} sx={{ color: ACCENT_CONNECT }} />
            </Box>
        );
    }

    const isDiscoverable =
        Array.isArray(profile?.$permissions) &&
        profile.$permissions.some((p: string) => typeof p === 'string' && p.includes('read("any")'));

    const isContactable = !!profile?.publicKey;

    const paperSurface = {
        p: 3,
        borderRadius: '24px',
        bgcolor: '#161412',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        backgroundImage: 'none',
        boxShadow: 'none',
    } as const;

    return (
        <Box>
            <Typography
                variant="h6"
                sx={{
                    fontWeight: 800,
                    mb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: '#F5F3F0',
                    fontFamily: 'var(--font-clash)',
                }}
            >
                <Search size={20} color={ACCENT_CONNECT} aria-hidden /> Discoverability
            </Typography>
            <Paper sx={paperSurface}>
                <Stack spacing={3}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
                            <Box
                                sx={{
                                    p: 1,
                                    borderRadius: '12px',
                                    bgcolor: alpha(ACCENT_CONNECT, 0.12),
                                    color: ACCENT_CONNECT,
                                    flexShrink: 0,
                                }}
                            >
                                <Globe size={18} aria-hidden />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#F5F3F0' }}>
                                    Global search discoverability
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.55, fontSize: '0.8125rem' }}>
                                    Allow others to find your profile via global search across Kylrix
                                </Typography>
                            </Box>
                        </Box>
                        <Switch
                            checked={!!isDiscoverable}
                            onChange={(e) => handleToggleDiscoverability(e.target.checked)}
                            disabled={savingDiscoverable}
                            sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT_CONNECT },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: alpha(ACCENT_CONNECT, 0.5) },
                            }}
                        />
                    </Box>

                    <Divider sx={{ opacity: 0.06 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
                            <Box
                                sx={{
                                    p: 1,
                                    borderRadius: '12px',
                                    bgcolor: alpha(ACCENT_AVATAR, 0.12),
                                    color: ACCENT_AVATAR,
                                    flexShrink: 0,
                                }}
                            >
                                <ImageIcon size={18} aria-hidden />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#F5F3F0' }}>
                                    Profile picture visibility
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.55, fontSize: '0.8125rem' }}>
                                    Let your universal avatar render for others where your profile is shown
                                </Typography>
                            </Box>
                        </Box>
                        <Switch
                            checked={resolvedAvatarFileId ? avatarPublicRead : false}
                            onChange={(e) => handleToggleAvatarVisibility(e.target.checked)}
                            disabled={savingAvatar || !resolvedAvatarFileId}
                            sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT_AVATAR },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: alpha(ACCENT_AVATAR, 0.45) },
                            }}
                        />
                    </Box>

                    <Divider sx={{ opacity: 0.06 }} />

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
                            <Box
                                sx={{
                                    p: 1,
                                    borderRadius: '12px',
                                    bgcolor: alpha(ACCENT_MESSAGE, 0.12),
                                    color: ACCENT_MESSAGE,
                                    flexShrink: 0,
                                }}
                            >
                                <MessageSquare size={18} aria-hidden />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#F5F3F0' }}>
                                    Allow people to contact you
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.55, fontSize: '0.8125rem' }}>
                                    Publish your secure messaging key so others can DM you encrypted
                                </Typography>
                            </Box>
                        </Box>
                        <Switch
                            checked={isContactable}
                            onChange={(e) => handleToggleContact(e.target.checked)}
                            disabled={savingContact || (!isContactable && !ecosystemSecurity.status.isUnlocked)}
                            sx={{
                                opacity: !isContactable && !ecosystemSecurity.status.isUnlocked ? 0.55 : 1,
                                '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT_MESSAGE },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: alpha(ACCENT_MESSAGE, 0.45) },
                            }}
                        />
                    </Box>

                    <Divider sx={{ opacity: 0.06 }} />

                    {profile && !profile.publicKey && (
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: '16px',
                                bgcolor: alpha(ACCENT_CONNECT, 0.06),
                                border: `1px solid ${alpha(ACCENT_CONNECT, 0.22)}`,
                            }}
                        >
                            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                                <Box
                                    sx={{
                                        p: 1,
                                        borderRadius: '12px',
                                        bgcolor: alpha(ACCENT_CONNECT, 0.12),
                                        color: ACCENT_CONNECT,
                                        display: 'flex',
                                    }}
                                >
                                    <ShieldAlert size={20} aria-hidden />
                                </Box>
                                <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: ACCENT_CONNECT }}>
                                        Messaging keys not published
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mt: 0.25 }}>
                                        Unlock the vault and sync so others can reach you securely.
                                    </Typography>
                                </Box>
                                <Button
                                    size="small"
                                    variant="contained"
                                    onClick={handleSyncE2E}
                                    disabled={saving}
                                    sx={{
                                        bgcolor: ACCENT_CONNECT,
                                        color: '#0A0908',
                                        fontWeight: 800,
                                        textTransform: 'none',
                                        borderRadius: '10px',
                                        '&:hover': { bgcolor: alpha(ACCENT_CONNECT, 0.92) },
                                    }}
                                >
                                    {saving ? <CircularProgress size={16} color="inherit" /> : 'Sync keys'}
                                </Button>
                            </Stack>
                            {syncError ? (
                                <Typography variant="caption" sx={{ color: '#F87171', mt: 1.5, display: 'block' }}>
                                    {syncError}
                                </Typography>
                            ) : null}
                        </Box>
                    )}

                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <User size={14} color="rgba(255, 255, 255, 0.38)" aria-hidden />
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontWeight: 800,
                                    color: 'rgba(255, 255, 255, 0.45)',
                                    textTransform: 'uppercase',
                                    fontSize: '0.68rem',
                                    letterSpacing: '0.06em',
                                }}
                            >
                                Universal handle
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: '2px 2px 2px 16px',
                                borderRadius: '18px',
                                bgcolor: '#0A0908',
                                border: '1px solid rgba(255, 255, 255, 0.06)',
                                transition: 'border-color 0.2s ease',
                                '&:focus-within': {
                                    borderColor: alpha(ACCENT_CONNECT, 0.35),
                                },
                            }}
                        >
                            <Box sx={{ flex: 1, py: 1.25, minWidth: 0 }}>
                                {isEditing ? (
                                    <Box>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            variant="standard"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            placeholder="your_handle"
                                            autoFocus
                                            InputProps={{
                                                disableUnderline: true,
                                                startAdornment: (
                                                    <Typography sx={{ color: ACCENT_CONNECT, fontWeight: 900, mr: 0.5, fontSize: '1.05rem' }}>
                                                        @
                                                    </Typography>
                                                ),
                                                endAdornment: (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 0.75 }}>
                                                        {checkingAvailability && (
                                                            <CircularProgress size={14} sx={{ color: ACCENT_CONNECT }} />
                                                        )}
                                                        {!checkingAvailability && isAvailable === true ? (
                                                            <Check size={16} color={ACCENT_CONNECT} strokeWidth={3} aria-hidden />
                                                        ) : null}
                                                        {!checkingAvailability && isAvailable === false ? (
                                                            <X size={16} color="#F87171" strokeWidth={3} aria-hidden />
                                                        ) : null}
                                                    </Box>
                                                ),
                                                sx: {
                                                    fontFamily: 'var(--font-mono)',
                                                    fontWeight: 800,
                                                    fontSize: '0.98rem',
                                                    color: '#F5F3F0',
                                                },
                                            }}
                                        />
                                        {isAvailable === false ? (
                                            <Typography
                                                variant="caption"
                                                sx={{ color: '#F87171', fontWeight: 700, mt: 0.5, display: 'block', letterSpacing: '0.04em' }}
                                            >
                                                Handle unavailable
                                            </Typography>
                                        ) : null}
                                    </Box>
                                ) : (
                                    <>
                                        <Typography
                                            sx={{
                                                fontFamily: 'var(--font-mono)',
                                                fontWeight: 800,
                                                fontSize: '1.05rem',
                                                letterSpacing: '-0.02em',
                                                opacity: isDiscoverable || !profile ? 1 : 0.45,
                                                color: !profile ? ACCENT_CONNECT : '#F5F3F0',
                                            }}
                                        >
                                            @{username || 'not_set'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.4, display: 'block', mt: 0.25, fontWeight: 600 }}>
                                            {!profile
                                                ? 'Set a handle to activate discovery toggles'
                                                : isDiscoverable
                                                  ? 'Visible in ecosystem search'
                                                  : 'Discoverability off'}
                                        </Typography>
                                    </>
                                )}
                            </Box>

                            <Box sx={{ display: 'flex', gap: 0.5, pr: 0.5, flexShrink: 0 }}>
                                {isEditing ? (
                                    <>
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                setIsEditing(false);
                                                setNewUsername(username);
                                                setIsAvailable(null);
                                            }}
                                            sx={{
                                                color: 'rgba(255, 255, 255, 0.38)',
                                                bgcolor: '#161412',
                                                borderRadius: '12px',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                '&:hover': { bgcolor: alpha('#F87171', 0.12), color: '#F87171' },
                                            }}
                                            aria-label="Cancel handle edit"
                                        >
                                            <X size={18} strokeWidth={2.5} />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => setShowConfirm(true)}
                                            disabled={
                                                saving ||
                                                !newUsername ||
                                                isAvailable === false ||
                                                checkingAvailability ||
                                                (newUsername === username && !!profile)
                                            }
                                            sx={{
                                                color: '#0A0908',
                                                bgcolor: ACCENT_CONNECT,
                                                borderRadius: '12px',
                                                '&:hover': { bgcolor: alpha(ACCENT_CONNECT, 0.9) },
                                                '&.Mui-disabled': { bgcolor: '#1C1A18', color: 'rgba(255,255,255,0.2)' },
                                            }}
                                            aria-label="Save handle"
                                        >
                                            <Check size={18} strokeWidth={3} />
                                        </IconButton>
                                    </>
                                ) : (
                                    <Button
                                        size="small"
                                        onClick={() => setIsEditing(true)}
                                        startIcon={<Edit2 size={14} strokeWidth={2.5} />}
                                        sx={{
                                            color: !profile ? '#0A0908' : ACCENT_CONNECT,
                                            bgcolor: !profile ? ACCENT_CONNECT : alpha(ACCENT_CONNECT, 0.08),
                                            borderRadius: '12px',
                                            px: 1.75,
                                            py: 0.75,
                                            fontWeight: 800,
                                            textTransform: 'none',
                                            fontSize: '0.8rem',
                                            border: '1px solid',
                                            borderColor: !profile ? ACCENT_CONNECT : alpha(ACCENT_CONNECT, 0.2),
                                            '&:hover': {
                                                bgcolor: !profile ? alpha(ACCENT_CONNECT, 0.92) : alpha(ACCENT_CONNECT, 0.14),
                                                borderColor: ACCENT_CONNECT,
                                            },
                                        }}
                                    >
                                        {profile ? 'Edit' : 'Set up'}
                                    </Button>
                                )}
                            </Box>
                        </Box>
                        <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.38 }}>
                            Same handle everywhere in the Kylrix ecosystem.
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            <SudoModal
                isOpen={isSudoOpen}
                onCancel={() => setIsSudoOpen(false)}
                app="vault"
                onSuccess={() => {
                    setIsSudoOpen(false);
                    void handleToggleContact(true);
                }}
            />

            <Box
                sx={{
                    mt: 3,
                    p: 2,
                    borderRadius: '16px',
                    bgcolor: '#161412',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    backgroundImage: 'none',
                    boxShadow: 'none',
                }}
            >
                <Avatar
                    src={previewUrl || undefined}
                    alt="Profile preview"
                    sx={{
                        width: 48,
                        height: 48,
                        border: '1px solid rgba(255,255,255,0.08)',
                        bgcolor: '#1C1A18',
                        fontFamily: 'var(--font-satoshi)',
                        fontWeight: 800,
                    }}
                >
                    {(username || user.name || '?').slice(0, 1).toUpperCase()}
                </Avatar>
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#F5F3F0' }}>
                        Preview
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.5 }}>
                        Roughly how you appear in discovery and chats
                    </Typography>
                </Box>
            </Box>

            <Dialog
                open={showConfirm}
                onClose={() => setShowConfirm(false)}
                PaperProps={{
                    sx: {
                        borderRadius: '24px',
                        bgcolor: '#161412',
                        border: '1px solid rgba(255,255,255,0.06)',
                        backgroundImage: 'none',
                        boxShadow: 'none',
                        maxWidth: '400px',
                        width: '100%',
                    },
                }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800, color: '#F5F3F0' }}>
                    <ShieldAlert color={ACCENT_CONNECT} size={22} aria-hidden /> Confirm handle
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ opacity: 0.72, mb: 2, color: '#C7C2BC' }}>
                        Your universal handle affects how people find you in search and mentions. Pick something you intend to keep.
                    </Typography>
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: '12px',
                            bgcolor: '#0A0908',
                            border: '1px dashed rgba(255,255,255,0.12)',
                        }}
                    >
                        <Typography variant="caption" sx={{ opacity: 0.45, display: 'block', mb: 0.5 }}>
                            NEW HANDLE
                        </Typography>
                        <Typography sx={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: ACCENT_CONNECT }}>
                            @{newUsername.toLowerCase().trim()}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2.5, pt: 0 }}>
                    <Button onClick={() => setShowConfirm(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveUsername}
                        variant="contained"
                        disabled={saving}
                        sx={{
                            borderRadius: '12px',
                            bgcolor: ACCENT_CONNECT,
                            color: '#0A0908',
                            fontWeight: 800,
                            textTransform: 'none',
                            '&:hover': { bgcolor: alpha(ACCENT_CONNECT, 0.92) },
                        }}
                    >
                        {saving ? <CircularProgress size={20} color="inherit" /> : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
