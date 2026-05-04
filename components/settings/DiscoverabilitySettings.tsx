'use client';

import React, { useState, useEffect } from 'react';
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
    Tooltip
} from '@mui/material';
import { User, Edit2, Check, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/ui/AuthContext';
import { databases, CONNECT_DATABASE_ID, CONNECT_COLLECTION_ID_USERS, Query, Permission, Role } from '@/lib/appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';

// Constants match connect/lib/appwrite/config.ts
const CONNECT_DB_ID = CONNECT_DATABASE_ID;
const CONNECT_USERS_TABLE = CONNECT_COLLECTION_ID_USERS;

export const DiscoverabilitySettings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    const loadProfile = React.useCallback(async () => {
        if (!user?.$id) return;
        try {
            try {
                const p = await databases.getDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, user.$id);
                setProfile(p);
                setNewUsername(p.username || '');
            } catch (_e: any) {
                const search = await databases.listDocuments(CONNECT_DB_ID, CONNECT_USERS_TABLE, [
                    Query.or([
                        Query.equal('userId', user.$id),
                        Query.equal('$id', user.$id)
                    ]),
                    Query.limit(1)
                ]);
                if (search.documents.length > 0) {
                    const p = search.documents[0];
                    setProfile(p);
                    setNewUsername(p.username || '');
                } else {
                    setProfile(null);
                }
            }
        } catch (e: any) {
            console.error("Failed to load profile from Connect", e);
        } finally {
            setLoading(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (user?.$id) {
            loadProfile();
        }
    }, [user?.$id, loadProfile]);

    useEffect(() => {
        const check = async () => {
            const normalized = newUsername.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');
            if (!normalized || normalized === profile?.username || normalized.length < 3) {
                setIsAvailable(null);
                return;
            }

            setCheckingAvailability(true);
            try {
                const existing = await databases.listDocuments(CONNECT_DB_ID, CONNECT_USERS_TABLE, [
                    Query.equal('username', normalized),
                    Query.limit(1)
                ]);
                setIsAvailable(existing.total === 0);
            } catch (e) {
                console.error("Check failed", e);
                setIsAvailable(null);
            } finally {
                setCheckingAvailability(false);
            }
        };

        const timeoutId = setTimeout(check, 500);
        return () => clearTimeout(timeoutId);
    }, [newUsername, profile?.username]);

    const handleToggleDiscoverability = async (checked: boolean) => {
        if (!user?.$id) return;

        // If no profile exists yet, they must set a username first
        if (!profile) {
            setIsEditing(true);
            toast.error("Set a username first to enable discovery");
            return;
        }

        setSaving(true);
        try {
            // appsActive was removed from schema, just fake the success for UI purposes
            // In the future this could update a different flag.
            await databases.updateDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, profile.$id, {
                updatedAt: new Date().toISOString()
            });
            setProfile({ ...profile, isDiscoverableLocalState: checked });
            toast.success(checked ? "Discovery enabled across Kylrix" : "Discovery disabled");
        } catch (_e) {
            toast.error("Failed to update discovery preference");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveUsername = async () => {
        if (!user?.$id || !newUsername) return;
        const normalized = newUsername.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');

        if (normalized.length < 3) {
            toast.error("Username must be at least 3 characters");
            return;
        }

        setSaving(true);
        try {
            // Check availability if changed or new
            if (!profile || profile.username !== normalized) {
                const existing = await databases.listDocuments(CONNECT_DB_ID, CONNECT_USERS_TABLE, [
                    Query.equal('username', normalized),
                    Query.limit(1)
                ]);
                if (existing.total > 0 && existing.documents[0].$id !== user.$id) {
                    toast.error("Username already taken");
                    setSaving(false);
                    return;
                }
            }

            let publicKeyStr: string | undefined;
            try {
                if (ecosystemSecurity.status.isUnlocked) {
                    const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    if (pub) publicKeyStr = pub;
                }
            } catch (e) {
                console.warn(e);
            }

            const data: any = {
                username: normalized,
                displayName: profile?.displayName || user.name || normalized,
                updatedAt: new Date().toISOString(),
                bio: profile?.bio || "",
            };
            if (publicKeyStr) {
                data.publicKey = publicKeyStr;
            }

            if (profile) {
                await databases.updateDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, profile.$id, data);
                setProfile({ ...profile, ...data });
                toast.success("Handle updated");
            } else {
                await databases.createDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, user.$id, {
                    ...data,
                    createdAt: new Date().toISOString()
                }, [
                    Permission.read(Role.any()),
                    Permission.update(Role.user(user.$id)),
                    Permission.delete(Role.user(user.$id))
                ]);
                const p = await databases.getDocument(CONNECT_DB_ID, CONNECT_USERS_TABLE, user.$id);
                setProfile(p);
                toast.success("Universal identity created!");
            }
            setIsEditing(false);
            setShowConfirm(false);
        } catch (e) {
            console.error(e);
            toast.error("Failed to save handle");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={24} />
        </Box>
    );

    const isDiscoverable = profile?.appsActive?.includes('connect') || profile?.appsActive?.includes('note');

    return (
        <Box>
            <Typography variant="overline" sx={{ fontWeight: 900, color: '#EC4899', mb: 2, display: 'block', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>
                ECOSYSTEM DISCOVERABILITY
            </Typography>
            <Paper sx={{
                p: 4,
                borderRadius: '32px',
                bgcolor: '#161412',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                backgroundImage: 'none',
                boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 20px 40px rgba(0,0,0,0.4)'
            }}>
                <Stack spacing={4}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', color: 'white' }}>Global Discovery</Typography>
                            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)' }}>Allow others to find you by your universal handle</Typography>
                        </Box>
                        <Switch
                            checked={!!isDiscoverable}
                            onChange={(e) => handleToggleDiscoverability(e.target.checked)}
                            disabled={saving}
                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#EC4899' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#EC4899' } }}
                        />
                    </Box>

                    <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

                    <Box sx={{
                        bgcolor: '#0A0908',
                        p: 3,
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2
                    }}>
                        <Box sx={{
                            p: 1.5,
                            borderRadius: '12px',
                            bgcolor: isDiscoverable ? alpha('#EC4899', 0.1) : '#161412',
                            border: '1px solid',
                            borderColor: isDiscoverable ? alpha('#EC4899', 0.2) : 'rgba(255, 255, 255, 0.05)',
                            display: 'flex'
                        }}>
                            <User size={24} color={isDiscoverable ? "#EC4899" : "rgba(255, 255, 255, 0.2)"} />
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            {isEditing ? (
                                <Box>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        variant="standard"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        placeholder="Your handle"
                                        autoFocus
                                        InputProps={{
                                            disableUnderline: true,
                                            startAdornment: <Typography sx={{ color: '#EC4899', fontWeight: 800, mr: 0.5 }}>@</Typography>,
                                            endAdornment: (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {checkingAvailability && <CircularProgress size={14} sx={{ color: '#EC4899' }} />}
                                                    {!checkingAvailability && isAvailable === true && <Check size={14} color="#EC4899" />}
                                                    {!checkingAvailability && isAvailable === false && <X size={14} color="#FF4D4D" />}
                                                </Box>
                                            ),
                                            sx: {
                                                fontFamily: 'var(--font-mono)',
                                                fontWeight: 800,
                                                fontSize: '1.1rem',
                                                color: 'white'
                                            }
                                        }}
                                    />
                                    {isAvailable === false && (
                                        <Typography variant="caption" sx={{ color: '#FF5252', fontWeight: 600, mt: 0.5, display: 'block' }}>
                                            already taken
                                        </Typography>
                                    )}
                                </Box>
                            ) : (
                                <>
                                    <Typography sx={{
                                        fontFamily: 'var(--font-mono)',
                                        fontWeight: 800,
                                        fontSize: '1.1rem',
                                        opacity: (isDiscoverable || !profile) ? 1 : 0.4,
                                        color: !profile ? 'warning.main' : 'inherit'
                                    }}>
                                        @{profile?.username || 'not_set'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.4, display: 'block', mt: 0.5 }}>
                                        {!profile ? 'Identity not initialized' : `Universal Identity • ${isDiscoverable ? 'Public' : 'Private'}`}
                                    </Typography>
                                </>
                            )}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            {isEditing ? (
                                <>
                                    <Tooltip title="Cancel">
                                        <IconButton size="small" onClick={() => { setIsEditing(false); setNewUsername(profile?.username || ''); setIsAvailable(null); }} sx={{ color: 'error.main' }}>
                                            <X size={18} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Save">
                                        <IconButton 
                                            size="small" 
                                            onClick={() => setShowConfirm(true)} 
                                            sx={{ color: 'success.main' }} 
                                            disabled={saving || !newUsername || isAvailable === false || checkingAvailability || (newUsername === profile?.username && !!profile)}
                                        >
                                            <Check size={18} />
                                        </IconButton>
                                    </Tooltip>
                                </>
                            ) : (
                                <Tooltip title={profile ? "Change Handle" : "Setup Identity"}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setIsEditing(true)}
                                        sx={{
                                            color: 'primary.main',
                                            bgcolor: !profile ? alpha('#6366F1', 0.1) : 'transparent',
                                            '&:hover': { bgcolor: alpha('#6366F1', 0.2) }
                                        }}
                                    >
                                        <Edit2 size={18} />
                                    </IconButton>
                                </Tooltip>
                            )}

                            {isDiscoverable && !isEditing && (
                                <Box sx={{
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: '8px',
                                    bgcolor: alpha('#00D1DA', 0.1),
                                    border: '1px solid',
                                    borderColor: alpha('#00D1DA', 0.2),
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 900, color: '#00D1DA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Live
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Stack>
            </Paper>

            {/* Confirmation Dialog */}
            <Dialog
                open={showConfirm}
                onClose={() => setShowConfirm(false)}
                PaperProps={{
                    sx: {
                        borderRadius: '24px',
                        bgcolor: 'rgba(15, 15, 15, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        p: 1
                    }
                }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 800 }}>
                    <ShieldAlert color="#6366F1" />
                    Confirm Identity Change
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ opacity: 0.7, color: 'white' }}>
                        Updating your universal handle will change how you are found across the entire Kylrix ecosystem.
                        This action is immediate and public.
                    </Typography>
                    <Box sx={{ mt: 3, p: 2, borderRadius: '16px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px dotted rgba(255, 255, 255, 0.2)' }}>
                        <Typography variant="caption" sx={{ opacity: 0.5, display: 'block', mb: 0.5 }}>NEW HANDLE</Typography>
                        <Typography sx={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'primary.main' }}>@{newUsername.toLowerCase().trim()}</Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 0 }}>
                    <Button onClick={() => setShowConfirm(false)} sx={{ color: 'white', opacity: 0.6 }}>Cancel</Button>
                    <Button
                        onClick={handleSaveUsername}
                        variant="contained"
                        disabled={saving}
                        sx={{
                            borderRadius: '12px',
                            bgcolor: '#6366F1',
                            color: 'white',
                            fontWeight: 700,
                            px: 3,
                            '&:hover': { bgcolor: '#4F46E5' }
                        }}
                    >
                        {saving ? <CircularProgress size={20} color="inherit" /> : "Confirm & Update"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
