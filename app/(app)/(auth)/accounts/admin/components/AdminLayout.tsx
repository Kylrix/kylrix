"use client";

import React from 'react';
import { useMediaQuery, useTheme, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { 
  Box, 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  Typography,
  Divider,
  alpha
} from '@mui/material';
import { 
  LayoutDashboard, 
  Users, 
  Mail, 
  Settings,
  ShieldCheck,
  ChevronRight,
  Ticket
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import AdminGuard from './AdminGuard';

const DRAWER_WIDTH = 280;

const menuItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { label: 'Users', icon: Users, href: '/admin/users' },
  { label: 'Email Center', icon: Mail, href: '/admin/emails' },
  { label: 'Coupons', icon: Ticket, href: '/admin/coupons' },
  { label: 'System Settings', icon: Settings, href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <AdminGuard>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#0A0908' }}>
        {!isMobile ? (
          <Drawer
            variant="permanent"
            sx={{
              width: DRAWER_WIDTH,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                bgcolor: '#161412',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                p: 3,
              },
            }}
          >
            <Box sx={{ mb: 6, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Logo app="accounts" variant="icon" size={32} />
              <Box>
                <Typography sx={{
                  fontFamily: 'var(--font-clash)',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  color: 'white',
                  lineHeight: 1,
                }}>
                  ADMIN
                </Typography>
                <Typography sx={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  color: '#6366F1',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  mt: 0.5,
                }}>
                  Ecosystem Core
                </Typography>
              </Box>
            </Box>

            <List sx={{ flex: 1 }}>
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <ListItem key={item.label} disablePadding sx={{ mb: 1 }}>
                    <ListItemButton
                      onClick={() => router.push(item.href)}
                      sx={{
                        borderRadius: '14px',
                        py: 1.5,
                        px: 2,
                        bgcolor: isActive ? alpha('#6366F1', 0.08) : 'transparent',
                        border: `1px solid ${isActive ? alpha('#6366F1', 0.2) : 'transparent'}`,
                        color: isActive ? 'white' : alpha('#FFFFFF', 0.5),
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&:hover': {
                          bgcolor: alpha('#6366F1', 0.05),
                          color: 'white',
                          '& .MuiListItemIcon-root': { color: 'white' },
                        },
                      }}
                    >
                      <ListItemIcon sx={{
                        minWidth: 40,
                        color: isActive ? '#6366F1' : 'inherit',
                        transition: 'color 0.3s',
                      }}>
                        <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{
                          sx: {
                            fontWeight: isActive ? 800 : 600,
                            fontSize: '0.875rem',
                          },
                        }}
                      />
                      {isActive && <ChevronRight size={14} />}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>

            <Box sx={{ mt: 'auto' }}>
              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)', my: 3 }} />
              <Box sx={{
                p: 2,
                borderRadius: '16px',
                bgcolor: alpha('#6366F1', 0.03),
                border: '1px solid rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}>
                <Box sx={{
                  p: 1,
                  borderRadius: '10px',
                  bgcolor: alpha('#6366F1', 0.1),
                  color: '#6366F1',
                }}>
                  <ShieldCheck size={20} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.75rem', color: 'white' }}>
                    Secure Access
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: alpha('#FFFFFF', 0.4) }}>
                    Admin Privileges Active
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Drawer>
        ) : null}

        {/* Content Area */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, md: 6 },
            pb: isMobile ? 10 : 6,
            overflowY: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
      {isMobile && (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: theme.zIndex.drawer + 2,
            bgcolor: '#161412',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            boxShadow: '0 -12px 36px rgba(0,0,0,0.34)',
            overflow: 'hidden',
          }}
        >
          <BottomNavigation
            showLabels={false}
            value={pathname}
            onChange={(_, next) => router.push(next)}
            sx={{
              bgcolor: 'transparent',
              height: 72,
              '& .MuiBottomNavigationAction-root': {
                color: 'rgba(255,255,255,0.45)',
                minWidth: 0,
              },
              '& .Mui-selected': {
                color: '#6366F1',
              },
            }}
          >
            {menuItems.map((item) => (
              <BottomNavigationAction key={item.href} value={item.href} icon={<item.icon size={20} />} />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </AdminGuard>
  );
}
