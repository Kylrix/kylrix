'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    Box, 
    Drawer, 
    List, 
    ListItem, 
    ListItemButton, 
    ListItemIcon, 
    ListItemText, 
    useTheme,
    alpha,
    Avatar,
    Typography,
    IconButton
} from '@mui/material';
import { 
    Home, 
    MessageSquare, 
    Phone, 
    LogOut,
    Wallet
} from 'lucide-react';
import { useColorMode } from '@/components/providers/ThemeProvider';
import { useAuth } from '@/lib/auth';
import { WalletSidebar } from '../overlays/WalletSidebar';

const drawerWidth = 280;

export const Navigation = () => {
    const pathname = usePathname();
    const theme = useTheme();
    const _colorMode = useColorMode();
    const { user, logout } = useAuth();
    const [isWalletOpen, setIsWalletOpen] = useState(false);

    const navItems = [
        { label: 'Home', href: '/', icon: <Home size={20} strokeWidth={1.5} /> },
        { label: 'Chats', href: '/chats', icon: <MessageSquare size={20} strokeWidth={1.5} /> },
        { label: 'Calls', href: '/calls', icon: <Phone size={20} strokeWidth={1.5} /> },
        { label: 'Wallet', onClick: () => setIsWalletOpen(true), icon: <Wallet size={20} strokeWidth={1.5} /> },
        // Profile moved to account menu -> now links to external/account-managed settings; remove from sidebar
    ];

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                [`& .MuiDrawer-paper`]: { 
                    width: drawerWidth, 
                    boxSizing: 'border-box', 
                    top: 64, 
                    height: 'calc(100% - 64px)',
                    borderRight: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                },
            }}
        >
            <Box sx={{ overflow: 'auto', mt: 2, px: 2, flex: 1 }}>
                <List>
                    {navItems.map((item) => (
                        <ListItem key={item.label} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton 
                                component={item.href ? Link : 'div'} 
                                href={item.href}
                                onClick={item.onClick}
                                selected={item.href ? pathname === item.href : false}
                                sx={{ 
                                    borderRadius: 3, 
                                    py: 1.5,
                                    cursor: 'pointer',
                                    '&.Mui-selected': {
                                        bgcolor: alpha(theme.palette.primary.main, 0.12),
                                        color: 'primary.main',
                                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) },
                                        '& .MuiListItemIcon-root': { color: 'primary.main' }
                                    },
                                    '&:hover': {
                                        bgcolor: alpha(theme.palette.text.primary, 0.04)
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 40, color: (item.href && pathname === item.href) ? 'inherit' : 'text.secondary' }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText 
                                    primary={item.label} 
                                    primaryTypographyProps={{ fontWeight: (item.href && pathname === item.href) ? 600 : 400 }}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Box>

            <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                {/* Ecosystem Pulse */}
                <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    p: 2, 
                    mb: 2,
                    borderRadius: '16px', 
                    bgcolor: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)' 
                }}>
                    <Box sx={{ position: 'relative', display: 'flex' }}>
                        <Box sx={{ 
                            width: 8, 
                            height: 8, 
                            bgcolor: '#10b981', 
                            borderRadius: '50%',
                            boxShadow: '0 0 10px #10b981'
                        }} />
                        <Box sx={{ 
                            position: 'absolute',
                            inset: 0,
                            bgcolor: '#10b981',
                            borderRadius: '50%',
                            animation: 'pulse 2s infinite',
                            opacity: 0.4
                        }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 800, 
                            color: 'white',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Connect
                        </Typography>
                        <Typography sx={{ 
                            fontSize: '0.65rem', 
                            color: 'rgba(255, 255, 255, 0.4)',
                            fontWeight: 600
                        }}>
                            Active Node
                        </Typography>
                    </Box>
                </Box>

                {user && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1, borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.04) }}>
                        <Avatar 
                            sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14, fontWeight: 'bold' }}
                        >
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap fontWeight={600}>
                                {user.name || 'User'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap display="block">
                                {user.email}
                            </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => logout()}>
                            <LogOut size={18} strokeWidth={1.5} />
                        </IconButton>
                    </Box>
                )}
            </Box>
            <WalletSidebar isOpen={isWalletOpen} onClose={() => setIsWalletOpen(false)} />
        </Drawer>
    );
};
