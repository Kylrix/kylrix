'use client';

import React, { useState, useEffect } from 'react';
import { 
    Box, 
    Typography, 
    Paper, 
    Button, 
    TextField, 
    Stack, 
    Divider,
    Alert,
    CircularProgress,
    alpha,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    IconButton
} from '@mui/material';
import { 
    LockOutlined as LockIcon, 
    FingerprintOutlined as FingerprintIcon,
    DeleteOutline as DeleteIcon,
    ShieldOutlined as ShieldIcon
} from '@mui/icons-material';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { AppwriteService, getCurrentUser } from '@/lib/appwrite/client';
import { PasskeySetup } from '@/components/common/PasskeySetup';
import { DiscoverabilitySettings } from '@/components/settings/DiscoverabilitySettings';
import toast from 'react-hot-toast';

export default function SettingsPage() {
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [oldPin, setOldPin] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [isPinSet, setIsPinSet] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [user, setUser] = useState<any>(null);

    // Passkey state
    const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
    const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);
    const [, setLoadingPasskeys] = useState(true);

    useEffect(() => {
        setIsPinSet(ecosystemSecurity.isPinSet());

        const unsubscribe = ecosystemSecurity.onStatusChange((unlocked) => {
            setIsUnlocked(unlocked);
        });

        getCurrentUser().then(u => {
            setUser(u);
            if (u?.$id) {
                loadPasskeys(u.$id);
            }
        });

        return () => unsubscribe();
    }, []);

    const loadPasskeys = async (userId: string) => {
        try {
            const entries = await AppwriteService.listKeychainEntries(userId);
            const pkEntries = entries.filter((e: any) => e.type === 'passkey').map((e: any) => ({
                ...e,
                params: typeof e.params === 'string' ? JSON.parse(e.params) : e.params
            }));
            
            setPasskeyEntries(pkEntries);
        } catch (_e) {
            console.error("Failed to load passkeys", _e);
        } finally {
            setLoadingPasskeys(false);
        }
    };

    const handleRemovePasskey = async (id: string) => {
        if (!window.confirm("Are you sure you want to remove this passkey? This cannot be undone.")) return;
        try {
            await AppwriteService.deleteKeychainEntry(id);
            toast.success("Passkey removed");
            if (user?.$id) loadPasskeys(user.$id);
        } catch (_e) {
            toast.error("Failed to remove passkey");
        }
    };

    const handleSetPin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length !== 4) {
            setMessage({ type: 'error', text: 'PIN must be 4 digits.' });
            return;
        }
        if (pin !== confirmPin) {
            setMessage({ type: 'error', text: 'New PINs do not match.' });
            return;
        }

        if (isPinSet) {
            const verified = await ecosystemSecurity.verifyPin(oldPin);
            if (!verified) {
                setMessage({ type: 'error', text: 'Current PIN is incorrect.' });
                return;
            }
        }

        if (!isUnlocked) {
            setMessage({ type: 'error', text: 'Vault must be unlocked to set a PIN. Please unlock via Connect or Vault app.' });
            return;
        }

        setLoading(true);
        setMessage(null);
        try {
            const success = await ecosystemSecurity.setupPin(pin);
            if (success) {
                setMessage({ type: 'success', text: isPinSet ? 'PIN updated successfully!' : 'Quick Unlock PIN set successfully!' });
                setIsPinSet(true);
                setPin('');
                setConfirmPin('');
                setOldPin('');
            } else {
                setMessage({ type: 'error', text: 'Failed to setup PIN. Ensure your vault is active.' });
            }
        } catch (_err: unknown) {
            setMessage({ type: 'error', text: 'An unexpected error occurred.' });
        } finally {
            setLoading(false);
        }
    };

    const handleWipePin = () => {
        if (!isUnlocked) {
            setMessage({ type: 'error', text: 'You must unlock your vault with your master password to reset a forgotten PIN.' });
            return;
        }

        if (confirm('Are you sure you want to reset your Quick Unlock PIN?')) {
            ecosystemSecurity.wipePin();
            setIsPinSet(false);
            setOldPin('');
            setPin('');
            setConfirmPin('');
            setMessage({ type: 'success', text: 'PIN has been reset.' });
        }
    };

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto', p: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, fontFamily: '"Space Grotesk", sans-serif' }}>
                Settings
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 5 }}>
                Manage your Flow experience and ecosystem security.
            </Typography>

            <Stack spacing={4}>
                {/* Security Section */}
                <Box>
                    <Typography variant="overline" sx={{ fontWeight: 800, color: '#00F0FF', mb: 2, display: 'block', letterSpacing: '0.1em' }}>
                        SECURITY & PRIVACY
                    </Typography>
                    
                    <Paper sx={{ 
                        p: 4, 
                        borderRadius: '24px', 
                        bgcolor: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundImage: 'none'
                    }}>
                        <Stack spacing={4}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 800 }}>System Lock</Typography>
                                    <Typography variant="body2" sx={{ opacity: 0.6 }}>Current status of your ecosystem vault</Typography>
                                </Box>
                                <Button 
                                    variant={isUnlocked ? "outlined" : "contained"}
                                    onClick={() => isUnlocked ? ecosystemSecurity.lock() : window.open('https://vault.kylrix.space', '_blank')}
                                    color={isUnlocked ? "inherit" : "primary"}
                                    startIcon={isUnlocked ? <LockIcon /> : <ShieldIcon />}
                                    sx={{ borderRadius: '12px', fontWeight: 700 }}
                                >
                                    {isUnlocked ? "Lock System" : "Unlock via Vault"}
                                </Button>
                            </Box>

                            <Divider sx={{ opacity: 0.05 }} />

                            {/* Passkey Section */}
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800 }}>Passkeys</Typography>
                                        <Typography variant="body2" sx={{ opacity: 0.6 }}>
                                            Use biometrics to securely unlock your session.
                                        </Typography>
                                    </Box>
                                    <Button 
                                        variant="contained" 
                                        size="small" 
                                        startIcon={<FingerprintIcon sx={{ fontSize: 18 }} />}
                                        onClick={() => setPasskeySetupOpen(true)}
                                        sx={{ borderRadius: '10px', bgcolor: '#00F0FF', color: 'black', '&:hover': { bgcolor: alpha('#00F0FF', 0.8) } }}
                                    >
                                        Add Passkey
                                    </Button>
                                </Box>

                                <List sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', p: 0, overflow: 'hidden' }}>
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
                                                            <DeleteIcon sx={{ fontSize: 20 }} />
                                                        </IconButton>
                                                    }
                                                >
                                                    <ListItemIcon>
                                                        <FingerprintIcon sx={{ color: "#00F0FF" }} />
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

                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Quick Unlock PIN</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.6, mb: 3 }}>
                                    {isPinSet 
                                        ? "Update your 4-digit PIN or reset if forgotten."
                                        : "Set a 4-digit PIN for faster access across the Kylrix ecosystem."
                                    }
                                </Typography>

                                {message && (
                                    <Alert severity={message.type} sx={{ mb: 3, borderRadius: '12px' }}>
                                        {message.text}
                                    </Alert>
                                )}

                                <Box component="form" onSubmit={handleSetPin} sx={{ maxWidth: 360 }}>
                                    <Stack spacing={2}>
                                        {isPinSet && (
                                            <TextField
                                                fullWidth
                                                type="password"
                                                placeholder="Current PIN"
                                                value={oldPin}
                                                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                variant="filled"
                                                inputProps={{ maxLength: 4, inputMode: 'numeric', style: { textAlign: 'center', fontWeight: 800 } }}
                                                InputProps={{ disableUnderline: true, sx: { borderRadius: '12px' } }}
                                            />
                                        )}
                                        <Box sx={{ display: 'flex', gap: 2 }}>
                                            <TextField
                                                fullWidth
                                                type="password"
                                                placeholder={isPinSet ? "New PIN" : "Set PIN"}
                                                value={pin}
                                                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                variant="filled"
                                                inputProps={{ maxLength: 4, inputMode: 'numeric', style: { textAlign: 'center', fontWeight: 800 } }}
                                                InputProps={{ disableUnderline: true, sx: { borderRadius: '12px' } }}
                                            />
                                            <TextField
                                                fullWidth
                                                type="password"
                                                placeholder="Confirm"
                                                value={confirmPin}
                                                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                variant="filled"
                                                inputProps={{ maxLength: 4, inputMode: 'numeric', style: { textAlign: 'center', fontWeight: 800 } }}
                                                InputProps={{ disableUnderline: true, sx: { borderRadius: '12px' } }}
                                            />
                                        </Box>
                                        <Button 
                                            fullWidth
                                            variant="contained" 
                                            type="submit"
                                            disabled={loading || pin.length !== 4 || pin !== confirmPin || (isPinSet && oldPin.length !== 4)}
                                            sx={{ 
                                                borderRadius: '12px', 
                                                py: 1.5, 
                                                fontWeight: 800,
                                                bgcolor: isPinSet ? alpha('#00F0FF', 0.1) : '#00F0FF',
                                                color: isPinSet ? '#00F0FF' : 'black',
                                                border: isPinSet ? '1px solid #00F0FF' : 'none',
                                                '&:hover': { bgcolor: isPinSet ? alpha('#00F0FF', 0.2) : alpha('#00F0FF', 0.8) }
                                            }}
                                        >
                                            {loading ? <CircularProgress size={24} color="inherit" /> : (isPinSet ? "Update PIN" : "Setup PIN")}
                                        </Button>

                                        {isPinSet && (
                                            <Button 
                                                fullWidth
                                                variant="text"
                                                color="error"
                                                onClick={handleWipePin}
                                                startIcon={<DeleteIcon />}
                                                sx={{ textTransform: 'none', fontWeight: 700 }}
                                            >
                                                Forgot PIN? Reset with Password
                                            </Button>
                                        )}
                                    </Stack>
                                </Box>
                            </Box>
                        </Stack>
                    </Paper>
                </Box>

                {/* Discoverability Section */}
                <DiscoverabilitySettings />

                {/* Workflow Section ... unchanged */}
            </Stack>

            <PasskeySetup 
                isOpen={passkeySetupOpen}
                onClose={() => setPasskeySetupOpen(false)}
                userId={user?.$id || ""}
                onSuccess={() => {
                    setPasskeySetupOpen(false);
                    if (user?.$id) loadPasskeys(user.$id);
                }}
                trustUnlocked={true}
            />
        </Box>
    );
}
