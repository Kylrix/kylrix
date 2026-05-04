'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Dialog,
    Box,
    Typography,
    IconButton,
    Grid,
    Paper,
    InputBase,
    alpha
} from '@mui/material';
import {
    Search as SearchIcon,
    Close as CloseIcon,
    AutoAwesome as PulseIcon,
} from '@mui/icons-material';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '../../lib/constants';
import { EcosystemWidgets } from '../../ecosystem/integration/Widgets';
import type { KylrixApp } from '@/lib/sdk/design';

import Logo from './Logo';

interface EcosystemPortalProps {
    open: boolean;
    onClose: () => void;
}

export default function EcosystemPortal({ open, onClose }: EcosystemPortalProps) {
    const [search, setSearch] = useState('');

    const filteredApps = ECOSYSTEM_APPS.filter(app =>
        app.type === 'app' && (
            app.label.toLowerCase().includes(search.toLowerCase()) ||
            app.description.toLowerCase().includes(search.toLowerCase())
        )
    );

    const handleAppClick = (subdomain: string) => {
        window.location.href = getEcosystemUrl(subdomain);
        onClose();
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (open) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, handleKeyDown]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            hideBackdrop
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    position: 'fixed',
                    top: { xs: 72, sm: 88 },
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'min(960px, calc(100vw - 24px))',
                    maxHeight: 'calc(100vh - 32px)',
                    m: 0,
                    bgcolor: 'var(--color-surface)',
                    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.7), 0 0 120px rgba(0, 240, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderTop: 'none',
                    borderRadius: '0 0 32px 32px',
                    backgroundImage: 'none',
                    overflow: 'hidden'
                }
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
                <Paper
                    sx={{
                        p: 0,
                        borderRadius: 0,
                        bgcolor: 'var(--color-surface)',
                        border: 'none',
                        boxShadow: 'none',
                        overflow: 'hidden'
                    }}
                >
                    <Box sx={{ p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.07)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <PulseIcon sx={{ color: '#00F0FF', fontSize: 24 }} />
                            <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em', color: 'white' }}>
                                KYLRIX <Box component="span" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>PORTAL</Box>
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton
                                onClick={onClose}
                                size="small"
                                sx={{
                                    color: 'rgba(255, 255, 255, 0.7)',
                                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '12px',
                                    width: 36,
                                    height: 36,
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.08)',
                                        borderColor: '#00F0FF'
                                    }
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>

                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            bgcolor: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '16px',
                            px: 2,
                            py: 1.5,
                            mt: 2,
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            '&:focus-within': {
                                borderColor: 'rgba(0, 240, 255, 0.5)',
                                bgcolor: 'rgba(255, 255, 255, 0.06)'
                            }
                        }}>
                            <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: 20 }} />
                            <InputBase
                                autoFocus
                                placeholder="Jump to app or search actions..."
                                fullWidth
                                value={search}
                                onChange={(_e) => setSearch(_e.target.value)}
                                sx={{
                                    color: 'white',
                                    fontFamily: 'var(--font-inter)',
                                    fontSize: '1rem',
                                    fontWeight: 500
                                }}
                            />
                            <Box sx={{
                                px: 1,
                                py: 0.5,
                                borderRadius: '6px',
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                                color: 'rgba(255, 255, 255, 0.4)',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                fontFamily: 'monospace'
                            }}>
                                ESC
                            </Box>
                        </Box>
                    </Box>

                    <Box sx={{ p: 3, maxHeight: '60vh', overflow: 'auto' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 2, display: 'block' }}>
                            Available Gateways
                        </Typography>
                        <Grid container spacing={2}>
                            {filteredApps.map((app) => (
                                <Grid size={{ xs: 12, sm: 6 }} key={app.id}>
                                    <Box
                                        component="button"
                                        onClick={() => handleAppClick(app.subdomain)}
                                        sx={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            p: 2,
                                            borderRadius: '20px',
                                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid rgba(255, 255, 255, 0.06)',
                                            color: 'white',
                                            textAlign: 'left',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer',
                                            '&:hover': {
                                                bgcolor: 'rgba(255, 255, 255, 0.06)',
                                                borderColor: alpha(app.color, 0.4),
                                                transform: 'translateY(-2px)',
                                                boxShadow: `0 8px 24px ${alpha(app.color, 0.1)}`
                                            },
                                            '&:active': {
                                                transform: 'scale(0.98)'
                                            }
                                        }}
                                    >
                                        <Box sx={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: '12px',
                                            bgcolor: alpha(app.color, 0.15),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: `1px solid ${alpha(app.color, 0.2)}`
                                        }}>
                                            <Logo app={app.id as KylrixApp} size={28} variant="icon" />
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                                {app.label}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block' }}>
                                                {app.description}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>

                        {search.length === 0 && (
                            <EcosystemWidgets />
                        )}
                    </Box>
                </Paper>
            </motion.div>
        </Dialog>
    );
}
