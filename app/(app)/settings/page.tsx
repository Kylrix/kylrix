'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Box, 
    Typography, 
    Paper, 
    Button, 
    Stack, 
    Switch, 
    FormControlLabel, 
    Divider,
    CircularProgress,
    alpha,
    useTheme,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment
} from '@mui/material';
import { 
    ArrowLeft,
    Lock, 
    Shield, 
    Fingerprint, 
    Smartphone,
    Trash2,
    RefreshCw
} from 'lucide-react';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { KeychainService } from '@/lib/appwrite/keychain';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';
import { useSudo } from '@/context/SudoContext';
import { DiscoverabilitySettings } from '@/components/settings/DiscoverabilitySettings';
import { toast } from 'react-hot-toast';

export default function SettingsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const _muiTheme = useTheme();
    const { requestSudo } = useSudo();
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [minting, setMinting] = useState(false);
  
    // Passkey state
    const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);
    const [_loadingPasskeys, setLoadingPasskeys] = useState(true);

    const handleManualMint = async () => {
        setMinting(true);
        try {
          const { mintDailyLoginSecure } = await import('@/lib/actions/secure-ops');
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const todayKey = today.toISOString();
          
          if (!user?.$id) throw new Error("User session not found");

          const response = await mintDailyLoginSecure({
            userId: user.$id,
            dateKey: todayKey,
          });
          
          if (response?.accepted) {
            toast.success('Tokens minted successfully!');
          } else {
            toast.error(response?.reason === 'IDEMPOTENCY_CONFLICT' ? 'You have already minted your tokens for today.' : (response?.reason || 'Minting failed'));
          }
        } catch (e: any) {
          toast.error(e.message || 'Minting failed');
        } finally {
          setMinting(false);
        }
    };

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

    const handleBack = () => {
        const hasHistory = typeof window !== 'undefined' && window.history.length > 1;
        const referrer = typeof document !== 'undefined' ? document.referrer : '';
        const sameOriginReferrer =
            typeof window !== 'undefined' && !!referrer && referrer.startsWith(window.location.origin);

        if (hasHistory && sameOriginReferrer) {
            router.back();
            return;
        }
        router.push('/connect');
    };

    return (
        <>
            <Box
                sx={{
                    maxWidth: 840,
                    mx: 'auto',
                    pt: { xs: 2, md: 2.5 },
                    pb: { xs: 3, md: 4 },
                    px: { xs: 2, md: 3 },
                }}
            >
                <Button
                    variant="outlined"
                    onClick={handleBack}
                    startIcon={<ArrowLeft size={16} />}
                    sx={{
                        mb: 2.5,
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.78)',
                        borderColor: 'rgba(255,255,255,0.15)',
                        '&:hover': {
                            borderColor: 'rgba(255,255,255,0.3)',
                            bgcolor: 'rgba(255,255,255,0.04)',
                        },
                    }}
                >
                    Back
                </Button>
                <Box sx={{ mb: 4 }}>
                    <Typography
                        variant="overline"
                        sx={{
                            letterSpacing: '0.16em',
                            color: 'rgba(255,255,255,0.45)',
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)'
                        }}
                    >
                        KYLRIX CONTROL PANEL
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, fontFamily: 'var(--font-clash)', color: 'white' }}>
                        Settings
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mt: 1, maxWidth: 560 }}>
                        Manage identity discoverability, encryption access, passkeys, and device preferences.
                    </Typography>
                </Box>

                <Stack spacing={4}>
                    <DiscoverabilitySettings />
                    <Box sx={{ bgcolor: '#161412', borderRadius: '28px', p: 3, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', mb: 1, fontFamily: 'var(--font-clash)' }}>Daily Token Mint</Typography>
                        <Typography sx={{ color: '#9B9691', mb: 2, fontSize: '0.9rem' }}>Manually trigger your daily token minting reward.</Typography>
                        <Button 
                            variant="contained" 
                            startIcon={minting ? <CircularProgress size={18} /> : <RefreshCw size={18}/>} 
                            onClick={handleManualMint} 
                            disabled={minting}
                            sx={{ borderRadius: '12px', fontWeight: 700, px: 3, py: 1.2, bgcolor: '#6366F1' }}
                        >
                            {minting ? 'Minting...' : 'Mint Daily Tokens'}
                        </Button>
                    </Box>
                    
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1.25, color: 'white' }}>
                            <Shield size={20} color="#6366F1" /> Security & Privacy
                        </Typography>
                        
                        <Paper sx={{ 
                            p: { xs: 2.25, md: 3 }, 
                            borderRadius: '28px', 
                            bgcolor: '#161412', 
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundImage: 'none',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 44px rgba(0,0,0,0.42)'
                        }}>
                            <Stack spacing={3}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>Vault Status</Typography>
                                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>Current encryption state of your session</Typography>
                                    </Box>
                                    <Button 
                                        variant={isUnlocked ? 'outlined' : 'contained'}
                                        onClick={() =>
                                          isUnlocked
                                            ? ecosystemSecurity.lock()
                                            : requestSudo({ onSuccess: () => {} })
                                        }
                                        color={isUnlocked ? 'inherit' : 'primary'}
                                        startIcon={isUnlocked ? <Lock size={16} /> : <Shield size={16} />}
                                        sx={{ 
                                            borderRadius: '12px',
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            minWidth: 132,
                                            ...(isUnlocked
                                                ? { borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }
                                                : { bgcolor: '#6366F1', '&:hover': { bgcolor: '#5458E8' } })
                                        }}
                                    >
                                        {isUnlocked ? "Lock Vault" : (hasMasterpass === false ? "Setup" : "Unlock Vault")}
                                    </Button>
                                </Box>

                                <Divider sx={{ opacity: 0.05 }} />

                                {/* Passkey Section */}
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>Passkeys</Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                                                Use biometrics to unlock your secure session.
                                            </Typography>
                                        </Box>
                                        <Button 
                                            variant="contained" 
                                            size="small" 
                                            startIcon={<Fingerprint size={16} />}
                                            onClick={() => setPasskeySetupOpen(true)}
                                            disabled={hasMasterpass === false}
                                            sx={{ 
                                                borderRadius: '10px',
                                                bgcolor: '#6366F1',
                                                textTransform: 'none',
                                                fontWeight: 700,
                                                '&:hover': { bgcolor: '#5458E8' }
                                            }}
                                        >
                                            Add Passkey
                                        </Button>
                                    </Box>

                                    <List sx={{ bgcolor: '#0A0908', borderRadius: '18px', p: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        {passkeyEntries.length === 0 ? (
                                            <Box sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}>
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
                                                        sx={{ py: 1.25 }}
                                                    >
                                                        <ListItemIcon>
                                                            <Fingerprint size={20} color="#6366F1" />
                                                        </ListItemIcon>
                                                        <ListItemText 
                                                            primary={pk.params?.name || `Passkey ${idx + 1}`}
                                                            secondary="Active"
                                                            primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}
                                                            secondaryTypographyProps={{ fontSize: '0.75rem', color: alpha('#10B981', 0.9) }}
                                                        />
                                                    </ListItem>
                                                    {idx < passkeyEntries.length - 1 && <Divider sx={{ opacity: 0.05 }} />}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </List>
                                </Box>

                                <Divider sx={{ opacity: 0.05 }} />

                                {/* App Preferences */}
                                <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'white' }}>
                                        <Smartphone size={18} color="#6366F1" /> App Preferences
                                    </Typography>
                                    <Stack spacing={2}>
                                        <FormControlLabel
                                            control={<Switch defaultChecked color="primary" />}
                                            label={
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>Push Notifications</Typography>
                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Get notified of new messages</Typography>
                                                </Box>
                                            }
                                            sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                        />
                                        <Divider sx={{ opacity: 0.05 }} />
                                        <FormControlLabel
                                            control={<Switch defaultChecked color="primary" />}
                                            label={
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>Active Status</Typography>
                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Show when you are online</Typography>
                                                </Box>
                                            }
                                            sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                        />
                                    </Stack>
                                </Box>
                            </Stack>
                        </Paper>
                    </Box>
                </Stack>
            </Box>

            <PasskeySetup 
                open={passkeySetupOpen}
                onClose={() => setPasskeySetupOpen(false)}
                userId={user?.$id || ""}
                onSuccess={() => {
                    setPasskeySetupOpen(false);
                    loadPasskeys();
                }}
                trustUnlocked={true}
            />
        </>
    );
}
