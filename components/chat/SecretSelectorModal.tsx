'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    Typography,
    Box,
    CircularProgress,
    TextField,
    Tabs,
    Tab,
    alpha as _alpha
} from '@mui/material';
import KeyIcon from '@mui/icons-material/VpnKeyOutlined';
import ShieldIcon from '@mui/icons-material/ShieldOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import { EcosystemService } from '@/lib/services/ecosystem';
import { useAuth } from '@/lib/auth';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { SudoModal } from '../overlays/SudoModal';
import speakeasy from 'speakeasy';

interface SecretSelectorModalProps {
    open: boolean;
    onClose: () => void;
    onSelect: (item: any, type: 'secret' | 'totp') => void;
    isSelf: boolean;
}

export const SecretSelectorModal = ({ open, onClose, onSelect, isSelf }: SecretSelectorModalProps) => {
    const { user } = useAuth();
    const [tab, setTab] = useState(0);
    const [secrets, setSecrets] = useState<any[]>([]);
    const [totps, setTotps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [unlockModalOpen, setUnlockModalOpen] = useState(false);
    const [pendingSelection, setPendingSelection] = useState<{ item: any, type: 'secret' | 'totp' } | null>(null);

    const loadData = React.useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [secretsRes, totpsRes] = await Promise.all([
                EcosystemService.listSecrets(user.$id),
                EcosystemService.listTotpSecrets(user.$id)
            ]);
            setSecrets(secretsRes.rows);
            setTotps(totpsRes.rows);
        } catch (error: unknown) {
            console.error('Failed to load ecosystem data:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (open && user) {
            loadData();
        }
    }, [open, user, loadData]);

    const handleSelect = async (item: any, type: 'secret' | 'totp') => {
        if (type === 'secret' && !isSelf) {
            // Restrictions: Can only share secrets to self for now
            alert("For security, secrets can only be shared in your self-chat. TOTP codes can be shared anywhere.");
            return;
        }

        if (!ecosystemSecurity.status.isUnlocked) {
            setPendingSelection({ item, type });
            setUnlockModalOpen(true);
            return;
        }

        try {
            if (type === 'totp') {
                // Decrypt and generate code
                const decryptedSecret = await ecosystemSecurity.decrypt(item.secretKey);
                const code = speakeasy.totp({
                    secret: decryptedSecret.replace(/\s+/g, '').toUpperCase(),
                    encoding: 'base32',
                });
                onSelect({ ...item, currentCode: code }, 'totp');
            } else {
                onSelect(item, 'secret');
            }
            onClose();
        } catch (error: unknown) {
            console.error('Failed to process selection:', error);
        }
    };

    const _filteredItems = tab === 0
        ? secrets.filter(s => (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
        : totps.filter(t => (t.issuer || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        borderRadius: '24px',
                        bgcolor: 'rgba(15, 15, 15, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundImage: 'none',
                        width: '100%',
                        maxWidth: '500px',
                        minHeight: '400px'
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, fontFamily: 'var(--font-space-grotesk)', pb: 0 }}>
                    Attach Secret
                </DialogTitle>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <Tab label="Credentials" sx={{ fontWeight: 700, fontSize: '0.8rem' }} />
                    <Tab label="TOTP" sx={{ fontWeight: 700, fontSize: '0.8rem' }} />
                </Tabs>
                <DialogContent>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder={`Search ${tab === 0 ? 'credentials' : 'TOTP'}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ mb: 2, mt: 2 }}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />,
                            sx: { borderRadius: '12px', bgcolor: 'rgba(255, 255, 255, 0.05)' }
                        }}
                    />

                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : (
                        <List sx={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {_filteredItems.length === 0 ? (
                                <Typography variant="body2" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                                    No items found.
                                </Typography>
                            ) : (
                                _filteredItems.map((item) => (
                                    <ListItemButton
                                        key={item.$id}
                                        disabled={tab === 0 && !isSelf}
                                        onClick={() => handleSelect(item, tab === 0 ? 'secret' : 'totp')}
                                        sx={{
                                            borderRadius: '12px',
                                            mb: 1,
                                            cursor: tab === 0 && !isSelf ? 'default' : 'pointer',
                                            '&:hover': { bgcolor: tab === 0 && !isSelf ? 'transparent' : 'rgba(255, 255, 255, 0.05)' },
                                            opacity: tab === 0 && !isSelf ? 0.5 : 1
                                        }}
                                    >
                                        <ListItemIcon>
                                            {tab === 0 ? <ShieldIcon sx={{ color: 'primary.main' }} /> : <KeyIcon sx={{ color: '#6366F1' }} />}
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={tab === 0 ? (item.name || 'Unnamed') : (item.issuer || 'Unknown')}
                                            secondary={tab === 0 ? item.username : item.accountName}
                                            primaryTypographyProps={{ fontWeight: 600 }}
                                        />
                                        {tab === 0 && !isSelf && (
                                            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>Self-only</Typography>
                                        )}
                                    </ListItemButton>
                                ))
                            )}
                        </List>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
                </DialogActions>
            </Dialog>

            <SudoModal
                isOpen={unlockModalOpen}
                onCancel={() => setUnlockModalOpen(false)}
                onSuccess={async () => {
                    setUnlockModalOpen(false);
                    if (pendingSelection) {
                        const { item, type } = pendingSelection;
                        try {
                            if (type === 'totp') {
                                const decryptedSecret = await ecosystemSecurity.decrypt(item.secretKey);
                                const code = speakeasy.totp({ 
                                    secret: decryptedSecret.replace(/\s+/g, '').toUpperCase(),
                                    encoding: 'base32'
                                });
                                onSelect({ ...item, currentCode: code }, 'totp');
                            }
 else {
                                onSelect(item, 'secret');
                            }
                            setPendingSelection(null);
                            onClose();
                        } catch (e: unknown) {
                            console.error('Processing after unlock failed', e);
                        }
                    }
                }}
            />
        </>
    );
};
