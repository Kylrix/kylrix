'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    Box,
    Typography,
    IconButton,
    Grid,
    Paper,
    InputBase,
    alpha,
} from '@mui/material';
import {
    Search,
    X,
    Zap,
    Fingerprint,
    FileText,
    Shield,
    Waypoints,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';
import Logo, { KylrixApp } from './Logo';

/**
 * Premium Icon Mapper
 */
const PremiumIcon = ({ name, size = 20, color = 'currentColor' }: { name: string, size?: number, color?: string }) => {
    const icons: Record<string, any> = {
        'fingerprint': Fingerprint,
        'file-text': FileText,
        'shield': Shield,
        'waypoints': Waypoints,
        'zap': Zap,
    };
    
    const IconComponent = icons[name] || Zap;
    return <IconComponent size={size} color={color} strokeWidth={1.5} />;
};

interface EcosystemPortalProps {
    open: boolean;
    onClose: () => void;
}

export default function EcosystemPortal({ open, onClose }: EcosystemPortalProps) {
    const [search, setSearch] = useState('');

    const filteredApps = ECOSYSTEM_APPS.filter(app =>
        app.label.toLowerCase().includes(search.toLowerCase()) ||
        app.description.toLowerCase().includes(search.toLowerCase())
    );

    const handleAppClick = (subdomain: string) => {
        const url = getEcosystemUrl(subdomain);
        window.location.assign(url);
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
            fullWidth
            maxWidth="sm"
            PaperProps={{
                sx: {
                    bgcolor: 'transparent',
                    boxShadow: 'none',
                    backgroundImage: 'none',
                    overflow: 'visible'
                }
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
                <Paper
                    sx={{
                        p: 0,
                        borderRadius: '32px',
                        bgcolor: 'rgba(10, 10, 10, 0.8)',
                        backdropFilter: 'blur(40px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: '0 32px 64px rgba(0,0,0,0.7), 0 0 100px rgba(0, 240, 255, 0.05)',
                        overflow: 'hidden'
                    }}
                >
                    {/* Header / Search */}
                    <Box sx={{ p: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <Zap size={24} color="#00F0FF" strokeWidth={1.5} />
                            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.02em', color: 'white' }}>
                                KYLRIX <Box component="span" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>PORTAL</Box>
                            </Typography>
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                                <X size={20} />
                            </IconButton>
                        </Box>

                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            bgcolor: 'rgba(255, 255, 255, 0.04)',
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
                            <Search size={20} color="rgba(255, 255, 255, 0.3)" strokeWidth={1.5} />
                            <InputBase
                                autoFocus
                                placeholder="Jump to app or search..."
                                fullWidth
                                value={search}
                                onChange={(_e) => setSearch(_e.target.value)}
                                sx={{
                                    color: 'white',
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

                    {/* Grid of Apps */}
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
                                            width: 48,
                                            height: 48,
                                            borderRadius: '14px',
                                            bgcolor: alpha(app.color, 0.15),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: `1px solid ${alpha(app.color, 0.2)}`,
                                            overflow: 'hidden'
                                        }}>
                                            {['note', 'vault', 'flow', 'connect', 'root'].includes(app.id) ? (
                                              <Logo app={app.id as KylrixApp} size={28} variant="icon" />
                                            ) : (
                                              <Image src={app.logo} alt={app.label} width={28} height={28} />
                                            )}
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
                    </Box>

                    {/* Footer */}
                    <Box sx={{ p: 2, bgcolor: 'rgba(0, 240, 255, 0.03)', display: 'flex', justifyContent: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(0, 240, 255, 0.4)', fontWeight: 700, letterSpacing: '0.05em' }}>
                            KYLRIX ECOSYSTEM v1.0
                        </Typography>
                    </Box>
                </Paper>
            </motion.div>
        </Dialog>
    );
}
