'use client';

import React, { useState, useEffect } from 'react';
import { 
    Drawer, 
    Button, 
    TextField, 
    Box, 
    Typography,
    CircularProgress,
    InputAdornment,
    useTheme,
    useMediaQuery,
    FormControlLabel,
    Switch,
    Divider,
    Stack
} from '@/lib/mui-tailwind/material';
import CheckCircleIcon from '@/lib/mui-tailwind/icons/CheckCircle';
import ErrorIcon from '@/lib/mui-tailwind/icons/Error';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
import { account } from '@/lib/appwrite/client';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
    profile: any;
    onUpdate: () => void;
}

export const EditProfileModal = ({ open, onClose, profile, onUpdate }: EditProfileModalProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user } = useAuth();
    const [username, setUsername] = useState(profile?.username || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [displayName, setDisplayName] = useState(profile?.displayName || '');
    const [isPublic, setIsPublic] = useState<boolean>(profile?.isPublic ?? true);
    const [isGuest, setIsGuest] = useState<boolean>(profile?.isGuest ?? true);
    const [isAvatar, setIsAvatar] = useState<boolean>(profile?.isAvatar ?? true);
    const [isContact, setIsContact] = useState<boolean>(profile?.isContact ?? true);
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (profile) {
            setUsername(profile.username || '');
            setBio(profile.bio || '');
            setDisplayName(profile.displayName || '');
            setIsPublic(profile.isPublic ?? true);
            setIsGuest(profile.isGuest ?? true);
            setIsAvatar(profile.isAvatar ?? true);
            setIsContact(profile.isContact ?? true);
        }
    }, [profile, open]);

    useEffect(() => {
        const checkUsername = async () => {
            if (!username || username === profile?.username) {
                setIsAvailable(null);
                return;
            }

            if (username.length < 3) {
                setIsAvailable(false);
                return;
            }

            setIsChecking(true);
            try {
                const available = await UsersService.isUsernameAvailable(username);
                setIsAvailable(available);
            } catch (err: unknown) {
                console.error('Failed to check username:', err);
            } finally {
                setIsChecking(false);
            }
        };

        const timer = setTimeout(checkUsername, 500);
        return () => clearTimeout(timer);
    }, [username, profile?.username]);

    const handleSave = async () => {
        if (!profile?.$id) return;
        
        if (username !== profile.username && isAvailable === false) {
            setError('Please pick an available username');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const userId = profile.userId || profile.$id; // Fallback to $id if userId is missing for some reason
            let publicKey: string | undefined;
            try {
                if (ecosystemSecurity.status.isUnlocked) {
                    const pub = await ecosystemSecurity.ensureE2EIdentity(userId);
                    if (pub) publicKey = pub;
                }
            } catch (e) {
                console.warn("Could not sync public key during profile update", e);
            }

            await UsersService.updateProfile(userId, {
                username,
                bio,
                displayName,
                publicKey,
                isPublic,
                isGuest,
                isAvatar,
                isContact
            });

            // Update global account name and username preference for ecosystem coherence
            try {
                if (displayName || username) {
                    if (displayName) await account.updateName(displayName);
                    const currentPrefs = user?.prefs || {};
                    await account.updatePrefs({
                        ...currentPrefs,
                        username: username.toLowerCase().trim()
                    });
                }
            } catch (prefErr) {
                console.warn('Failed to sync display name or username to account prefs', prefErr);
            }

            onUpdate();
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update profile';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer anchor={isMobile ? 'bottom' : 'right'} open={open} onClose={onClose}
            PaperProps={{
                sx: {
                    width: isMobile ? '100%' : 'min(100vw, 500px)',
                    maxWidth: '100%',
                    height: isMobile ? 'auto' : '100%',
                    maxHeight: isMobile ? '92dvh' : '100%',
                    borderRadius: isMobile ? '24px 24px 0 0' : '0',
                    display: 'flex',
                    flexDirection: 'column',
                }
            }}
        >
            <Box sx={{ fontWeight: 'bold', px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>Edit Profile</Box>
            <Box sx={{ px: 3, py: 2, flex: 1, overflowY: 'auto' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                    <TextField
                        label="Username"
                        fullWidth
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-0_]/g, ''))}
                        error={isAvailable === false && username !== profile?.username}
                        helperText={
                            isAvailable === false && username !== profile?.username 
                            ? 'Username is already taken' 
                            : 'Only letters, numbers, and underscores allowed'
                        }
                        InputProps={{
                            startAdornment: <InputAdornment position="start">@</InputAdornment>,
                            endAdornment: (
                                <InputAdornment position="end">
                                    {isChecking && <CircularProgress size={20} />}
                                    {!isChecking && isAvailable === true && username !== profile?.username && <CheckCircleIcon color="success" />}
                                    {!isChecking && isAvailable === false && username !== profile?.username && <ErrorIcon color="error" />}
                                </InputAdornment>
                            )
                        }}
                    />

                    <TextField
                        label="Display Name"
                        fullWidth
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                    />

                    <TextField
                        label="Bio"
                        fullWidth
                        multiline
                        rows={4}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell the world about yourself..."
                    />

                    <Divider sx={{ my: 1, opacity: 0.1 }} />

                    <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                        Privacy & Visibility
                    </Typography>
                    
                    <Stack spacing={1}>
                        <FormControlLabel
                            control={<Switch size="small" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />}
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Public Profile</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Allow anyone to find your profile</Typography>
                                </Box>
                            }
                        />
                        <FormControlLabel
                            control={<Switch size="small" checked={isGuest} onChange={(e) => setIsGuest(e.target.checked)} disabled={!isPublic} />}
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Guest Visibility</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Allow non-logged in users to see your profile</Typography>
                                </Box>
                            }
                        />
                        <FormControlLabel
                            control={<Switch size="small" checked={isAvatar} onChange={(e) => setIsAvatar(e.target.checked)} />}
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Show Avatar</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Make your profile picture visible to others</Typography>
                                </Box>
                            }
                        />
                        <FormControlLabel
                            control={<Switch size="small" checked={isContact} onChange={(e) => setIsContact(e.target.checked)} />}
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Allow Contact</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>Allow others to send you direct messages</Typography>
                                </Box>
                            }
                        />
                    </Stack>
                </Box>
                {error && (
                    <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                        {error}
                    </Typography>
                )}
            </Box>
            <Box sx={{ p: 3, display: 'flex', gap: 1, borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
                <Button onClick={onClose} disabled={loading}>Cancel</Button>
                <Button 
                    variant="contained" 
                    onClick={handleSave} 
                    disabled={loading || (isAvailable === false && username !== profile?.username)}
                    sx={{ boxShadow: 'none' }}
                >
                    {loading ? <CircularProgress size={24} /> : 'Save Changes'}
                </Button>
            </Box>
        </Drawer>
    );
};
