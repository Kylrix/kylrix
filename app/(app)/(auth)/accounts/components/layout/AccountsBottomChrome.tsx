'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  alpha,
} from '@mui/material';
import {
  UserCircle as ProfileIcon,
  ShieldCheck as SecurityIcon,
  MonitorSmartphone as SessionsIcon,
  History as ActivityIcon,
  Fingerprint as IdentityIcon,
  Sliders as PreferencesIcon,
  Settings2 as RootAccountIcon,
  Plus,
  X,
} from 'lucide-react';

const BRAND_INDIGO = '#6366F1';

/**
 * Specialized bottom chrome for Accounts app.
 * 4 main items in bottom bar, 3 secondary items in a premium FAB SpeedDial.
 * Utilizes the global FAB styling and high-fidelity icons.
 */
export function AccountsBottomChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  // Map subsettings from URL
  const currentSubsetting = useMemo(() => {
    const parts = pathname?.split('/');
    return parts?.[parts.length - 1] || 'profile';
  }, [pathname]);

  const mainItems = [
    { value: 'profile', icon: ProfileIcon, label: 'Profile', path: '/accounts/settings/profile' },
    { value: 'security', icon: SecurityIcon, label: 'Security', path: '/accounts/settings/security' },
    { value: 'sessions', icon: SessionsIcon, label: 'Sessions', path: '/accounts/settings/sessions' },
    { value: 'activity', icon: ActivityIcon, label: 'Activity', path: '/accounts/settings/activity' },
  ];

  const secondaryItems = [
    { value: 'identities', icon: IdentityIcon, label: 'Identities', path: '/accounts/settings/identities' },
    { value: 'preferences', icon: PreferencesIcon, label: 'Preferences', path: '/accounts/settings/preferences' },
    { value: 'account', icon: RootAccountIcon, label: 'Account', path: '/accounts/settings/account' },
  ];

  const handleNavChange = (_: React.SyntheticEvent, newValue: string) => {
    const item = mainItems.find(i => i.value === newValue);
    if (item) router.push(item.path);
  };

  return (
    <Box
      component="footer"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1300,
        display: { xs: 'block', md: 'none' }, // Only on mobile
      }}
    >
      {/* Premium FAB SpeedDial for secondary items */}
      <SpeedDial
        ariaLabel="Account sub-settings"
        sx={{
          position: 'absolute',
          bottom: 88, 
          right: 20,
          '& .MuiFab-primary': {
            width: 64,
            height: 64,
            borderRadius: '20px',
            bgcolor: speedDialOpen ? '#1F1D1B' : BRAND_INDIGO,
            color: speedDialOpen ? '#fff' : '#000',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: speedDialOpen ? 'none' : `0 18px 40px ${alpha('#000', 0.55)}`,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              bgcolor: speedDialOpen ? '#1F1D1B' : '#5254E8',
              transform: 'translateY(-2px)',
            },
          },
          '& .MuiSpeedDialAction-fab': {
            bgcolor: '#161412',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.7)',
            width: 52,
            height: 52,
            '&:hover': {
              bgcolor: alpha(BRAND_INDIGO, 0.12),
              color: BRAND_INDIGO,
              borderColor: alpha(BRAND_INDIGO, 0.5),
              transform: 'translateY(-4px)',
            },
          },
          '& .MuiSpeedDialAction-staticTooltipLabel': {
            bgcolor: 'rgba(22, 20, 18, 0.92)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '8px 14px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
          }
        }}
        icon={<SpeedDialIcon icon={<Plus size={26} strokeWidth={2.5} />} openIcon={<X size={26} strokeWidth={2.5} />} />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {secondaryItems.map((action) => (
          <SpeedDialAction
            key={action.value}
            icon={<action.icon size={22} strokeWidth={2} />}
            tooltipTitle={action.label}
            tooltipOpen
            onClick={() => {
              setSpeedDialOpen(false);
              router.push(action.path);
            }}
            sx={{
                '& .MuiSpeedDialAction-fab': {
                    color: currentSubsetting === action.value ? BRAND_INDIGO : 'inherit',
                    borderColor: currentSubsetting === action.value ? BRAND_INDIGO : 'rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }
            }}
          />
        ))}
      </SpeedDial>

      <Paper
        elevation={0}
        sx={{
          width: '100%',
          bgcolor: '#161412',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderBottom: 0,
          borderRadius: '24px 24px 0 0',
          px: 1,
          pt: 0.5,
          pb: 'max(0.5rem, env(safe-area-inset-bottom))',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.4)',
        }}
      >
        <BottomNavigation
          value={currentSubsetting}
          onChange={handleNavChange}
          showLabels={false}
          sx={{
            backgroundColor: 'transparent',
            height: 72,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto',
              padding: '0',
              color: 'rgba(255, 255, 255, 0.4)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&.Mui-selected': {
                color: BRAND_INDIGO,
                '& .lucide': {
                  transform: 'scale(1.2) translateY(-2px)',
                  filter: `drop-shadow(0 0 10px ${BRAND_INDIGO}90)`,
                }
              },
            },
          }}
        >
          {mainItems.map((item) => (
            <BottomNavigationAction
              key={item.value}
              value={item.value}
              icon={<item.icon size={24} strokeWidth={2} className="lucide" />}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
