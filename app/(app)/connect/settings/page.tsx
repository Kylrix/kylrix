'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { 
    Box, 
    Typography, 
    Paper, 
    Button, 
    Stack, 
    Switch, 
    FormControlLabel, 
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    useTheme
} from '@mui/material';
import { 
    Lock, 
    Shield, 
    Fingerprint, 
    Smartphone,
    Trash2
} from 'lucide-react';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { KeychainService } from '@/lib/appwrite/keychain';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';
import { SudoModal } from '@/components/overlays/SudoModal';
import { DiscoverabilitySettings } from '@/components/settings/DiscoverabilitySettings';
import { toast } from 'react-hot-toast';

export default function SettingsPage() {
    const { user } = useAuth();
    const _muiTheme = useTheme();
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);

    // Passkey state
    const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);
    const [_loadingPasskeys, setLoadingPasskeys] = useState(true);

    const loadPasskeys = React.useCallback(async () => {
        if (!user?.$id) return;
        try {
            const entries = await KeychainService.listKeychainEntries(user.$id);
            const pkEntries = entries.filter((e: any) => e.type === 'passkey').map((e: any) => ({
                ...e,
                params: typeof e.params === 'string' ? JSON.parse(e.params) : e.params
            }));
            
            setPasskeyEntries(pkEntries);
        } catch (e) {
            console.error("Failed to load passkeys", e);
        } finally {
            setLoadingPasskeys(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            if (status.isUnlocked !== isUnlocked) {
                setIsUnlocked(status.isUnlocked);
            }
        });

        if (user?.$id) {
            loadPasskeys();
            // detect whether the user has a master password (Tier 2 / encryption) set
            (async () => {
                try {
                    const present = await KeychainService.hasMasterpass(user.$id);
                    setHasMasterpass(present);
                } catch (e) {
                    console.error('Failed to check masterpass presence', e);
                    setHasMasterpass(null);
                }
            })();
        }

        return unsubscribe;
    }, [isUnlocked, user, loadPasskeys]);

    const handleRemovePasskey = async (id: string) => {
        if (!window.confirm("Are you sure you want to remove this passkey? This cannot be undone.")) return;
        try {
            await KeychainService.deleteKeychainEntry(id);
            toast.success("Passkey removed");
            loadPasskeys();
        } catch (_e) {
            toast.error("Failed to remove passkey");
        }
    };


    return (
        <AppShell>
            <Box sx={{ maxWidth: 800, mx: 'auto', py: 4, px: 2 }}>
                <Typography variant="h4" sx={{ fontWeight: 900, mb: 4, fontFamily: 'var(--font-space-grotesk)' }}>
                    Settings
                </Typography>

                <Stack spacing={4}>
                    <DiscoverabilitySettings />
                    
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Shield size={20} color="var(--color-primary)" /> Security & Privacy
                        </Typography>
                        
                        <Paper sx={{ 
                            p: 3, 
                            borderRadius: '24px', 
                            bgcolor: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid rgba(255, 255, 255, 0.05)' 
                        }}>
                            <Stack spacing={3}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Vault Status</Typography>
                                        <Typography variant="body2" sx={{ opacity: 0.6 }}>Current encryption state of your session</Typography>
                                    </Box>
                                    <Button 
                                        variant={isUnlocked ? "outlined" : "contained"}
                                        onClick={() => isUnlocked ? ecosystemSecurity.lock() : setUnlockModalOpen(true)}
                                        color={isUnlocked ? "inherit" : "primary"}
                                        startIcon={isUnlocked ? <Lock size={16} /> : <Shield size={16} />}
                                        sx={{ borderRadius: '12px' }}
                                    >
                                        {isUnlocked ? "Lock Vault" : (hasMasterpass === false ? "Setup" : "Unlock Vault")}
                                    </Button>
                                </Box>

                                <Divider sx={{ opacity: 0.05 }} />

                                {/* Passkey Section */}
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Passkeys</Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.6 }}>
                                                Use biometrics to unlock your secure session.
                                            </Typography>
                                        </Box>
                                        <Button 
                                            variant="contained" 
                                            size="small" 
                                            startIcon={<Fingerprint size={16} />}
                                            onClick={() => setPasskeySetupOpen(true)}
                                            disabled={hasMasterpass === false}
                                            sx={{ borderRadius: '10px' }}
                                        >
                                            Add Passkey
                                        </Button>
                                    </Box>

                                    <List sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', p: 0, overflow: 'hidden' }}>
                                        {passkeyEntries.length === 0 ? (
                                            <Box sx={{ p: 2, textAlign: 'center', opacity: 0.5 }}>
                                                <Typography variant="body2">No passkeys registered.</Typography>
                                            </Box>
                                        ) : (
                                            passkeyEntries.map((pk, idx) => (
                                                <React.Fragment key={pk.$id}>
                                                    <ListItem 
                                                        secondaryAction={
                                                            <IconButton edge="end" color="error" onClick={() => handleRemovePasskey(pk.$id)}>
                                                                <Trash2 size={18} />
                                                            </IconButton>
                                                        }
                                                    >
                                                        <ListItemIcon>
                                                            <Fingerprint size={20} color="var(--color-primary)" />
                                                        </ListItemIcon>
                                                        <ListItemText 
                                                            primary={pk.params?.name || `Passkey ${idx + 1}`}
                                                            secondary="Active"
                                                            primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem' }}
                                                            secondaryTypographyProps={{ fontSize: '0.75rem' }}
                                                        />
                                                    </ListItem>
                                                    {idx < passkeyEntries.length - 1 && <Divider sx={{ opacity: 0.05 }} />}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </List>
                                </Box>

                                <Divider sx={{ opacity: 0.05 }} />
                </Stack>
                        </Paper>
                    </Box>

                    {/* App Settings */}
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Smartphone size={20} color="var(--color-electric)" /> App Preferences
                        </Typography>
                        <Paper sx={{ 
                            p: 3, 
                            borderRadius: '24px', 
                            bgcolor: 'rgba(255, 255, 255, 0.02)', 
                            border: '1px solid rgba(255, 255, 255, 0.05)' 
                        }}>
                            <Stack spacing={2}>
                                <FormControlLabel
                                    control={<Switch defaultChecked color="primary" />}
                                    label={
                                        <Box>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>Push Notifications</Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.6 }}>Get notified of new messages</Typography>
                                        </Box>
                                    }
                                    sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                />
                                <Divider sx={{ opacity: 0.05 }} />
                                <FormControlLabel
                                    control={<Switch defaultChecked color="primary" />}
                                    label={
                                        <Box>
                                            <Typography variant="body1" sx={{ fontWeight: 600 }}>Active Status</Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.6 }}>Show when you are online</Typography>
                                        </Box>
                                    }
                                    sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                />
                            </Stack>
                        </Paper>
                    </Box>
                </Stack>
            </Box>

            <PasskeySetup 
                isOpen={passkeySetupOpen}
                onClose={() => setPasskeySetupOpen(false)}
                userId={user?.$id || ""}
                onSuccess={() => {
                    setPasskeySetupOpen(false);
                    loadPasskeys();
                }}
                trustUnlocked={true}
            />

            <SudoModal 
                isOpen={unlockModalOpen}
                onSuccess={() => {
                    setUnlockModalOpen(false);
                    setIsUnlocked(true);
                }}
                onCancel={() => setUnlockModalOpen(false)}
            />
        </AppShell>
    );
}
