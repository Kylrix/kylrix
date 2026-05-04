'use client';

import { useColors, useTheme } from '@/lib/theme-context';
import { useEffect, useState, Suspense, useMemo } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSource } from '@/lib/source-context';
import { LogoutDialog } from '@/components/LogoutDialog';
import { createBottomBarSurface } from '@/lib/sdk/bottombar';
import {
  Box,
  Typography,
  CircularProgress,
  alpha,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Fab,
  Zoom,
  Backdrop,
} from '@mui/material';
import { 
  Person, 
  Lock, 
  History, 
  Link as LinkIcon, 
  ArrowBack, 
  Devices as SessionsIcon,
  Tune as PreferencesIcon,
  ManageAccounts as AccountIcon,
  Add as PlusIcon,
} from '@mui/icons-material';
import Link from 'next/link';

interface UserData {
  email: string;
  name: string;
  userId: string;
  lastUsernameEdit?: string;
  profilePicId?: string | null;
}

function SettingsLayoutContent({ children }: { children: React.ReactNode }) {
  const dynamicColors = useColors();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setSource, getBackUrl } = useSource();

  // Robustly derive active tab from pathname
  const activeTab = pathname.split('/').filter(Boolean).pop() || 'profile';

  // Create bottom bar surface early (before any early returns) to maintain hook order
  const bottomBarSurface = useMemo(() => 
    createBottomBarSurface({
      activeHref: pathname || '/accounts/settings/profile',
      items: [
        { id: 'profile', label: 'Profile', href: '/accounts/settings/profile' },
        { id: 'security', label: 'Security', href: '/accounts/settings/security' },
        { id: 'preferences', label: 'Preferences', href: '/accounts/settings/preferences' },
        { id: 'account', label: 'Account', href: '/accounts/settings/account' },
      ],
    }),
    [pathname]
  );

  useEffect(() => {
    let mounted = true;
    async function initializeSettings() {
      try {
        const source = searchParams.get('source');
        if (source) {
          setSource(source);
        }

        const userData = await account.get();
        if (mounted) {
          setUser({
            email: userData.email,
            name: userData.prefs?.username || userData.name || userData.email.split('@')[0],
            userId: userData.$id,
            lastUsernameEdit: userData.prefs?.last_username_edit,
            profilePicId: userData.prefs?.profilePicId || null,
          });
          setLoading(false);
        }
      } catch (_err: unknown) {
        if (mounted) {
          setLoading(false);
          const source = searchParams.get('source');
          router.replace('/accounts/login' + (source ? `?source=${encodeURIComponent(source)}` : ''));
        }
      }
    }
    initializeSettings();
    return () => { mounted = false; };
  }, [router, searchParams, setSource]);

  const handleLogoutComplete = () => {
    localStorage.removeItem('id_redirect_source');
    const source = searchParams.get('source');
    if (source) {
      router.replace(`/accounts/login?source=${encodeURIComponent(source)}`);
    } else {
      router.replace('/accounts/login');
    }
  };

  if (loading || !user) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: dynamicColors.background, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: dynamicColors.primary }} />
      </Box>
    );
  }

  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const textColor = isDark ? '#FFFFFF' : '#000000';
  const surfaceColor = isDark ? 'rgba(15, 13, 12, 0.6)' : 'rgba(245, 245, 245, 0.6)';
  const brandIndigo = '#6366F1';
  const secondaryText = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';

  const navItems = [
    { id: 'profile', label: 'profile', icon: Person },
    { id: 'security', label: 'security', icon: Lock },
    { id: 'identities', label: 'identities', icon: LinkIcon },
    { id: 'sessions', label: 'sessions', icon: SessionsIcon },
    { id: 'activity', label: 'activity', icon: History },
    { id: 'preferences', label: 'preferences', icon: PreferencesIcon },
    { id: 'account', label: 'account', icon: AccountIcon },
  ];

  const sidebarContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        p: { xs: 3, md: 4 },
        backgroundColor: dynamicColors.background,
        height: '100%',
        gap: 2
      }}
    >
      <Box
        sx={{
          p: 3,
          borderRadius: '24px',
          backgroundColor: surfaceColor,
          border: `1px solid ${borderColor}`,
          mb: 2,
          backdropFilter: 'blur(20px)'
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: '16px',
              backgroundColor: alpha(dynamicColors.primary, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: dynamicColors.primary,
              fontSize: '24px',
              flexShrink: 0,
              border: `1px solid ${alpha(dynamicColors.primary, 0.2)}`
            }}
          >
            👤
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '1.15rem', fontWeight: 900, color: textColor, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
              {user.name}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.8rem',
                color: secondaryText,
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                opacity: 0.8
              }}
            >
              {user.email}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {getBackUrl() && (
            <Box
                onClick={() => {
                    const backUrl = getBackUrl();
                    if (backUrl) window.location.href = backUrl;
                }}
                sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    p: '0.85rem 1.25rem',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    mb: 1,
                    backgroundColor: alpha(dynamicColors.primary, 0.05),
                    border: `1px solid ${alpha(dynamicColors.primary, 0.1)}`,
                    '&:hover': { 
                        backgroundColor: alpha(dynamicColors.primary, 0.1),
                        borderColor: alpha(dynamicColors.primary, 0.3)
                    },
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <ArrowBack sx={{ color: dynamicColors.primary, fontSize: 18 }} />
                <Typography
                    sx={{
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        color: dynamicColors.primary,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase'
                    }}
                >
                    Return to Source
                </Typography>
            </Box>
          )}

          {navItems.map(({ id, label, icon: Icon }) => (
            <Box
              key={id}
              component={Link}
              href={`/settings/${id}`}
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                p: '0.85rem 1.25rem',
                borderRadius: '14px',
                cursor: 'pointer',
                backgroundColor: activeTab === id ? alpha(brandIndigo, 0.12) : 'transparent',
                border: '1px solid',
                borderColor: activeTab === id ? alpha(brandIndigo, 0.2) : 'transparent',
                '&:hover': { 
                  backgroundColor: activeTab === id ? alpha(brandIndigo, 0.15) : alpha('#fff', 0.03),
                },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                textDecoration: 'none'
              }}
            >
              <Icon sx={{ color: activeTab === id ? brandIndigo : secondaryText, fontSize: 20, transition: 'color 0.2s' }} />
              <Typography
                sx={{
                  fontSize: '0.9rem',
                  fontWeight: activeTab === id ? 800 : 600,
                  color: activeTab === id ? textColor : secondaryText,
                  fontFamily: 'var(--font-satoshi)',
                  textTransform: 'capitalize'
                }}
              >
                {label}
              </Typography>
            </Box>
          ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: dynamicColors.background, color: textColor, display: 'flex', flexDirection: 'column' }}>
      
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          p: 2.5,
          px: 3,
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: alpha(dynamicColors.background, 0.8),
          backdropFilter: 'blur(20px)',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2
        }}
      >
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, color: textColor, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'capitalize' }}>
          {navItems.find(i => i.id === activeTab)?.label}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flex: 1 }}>
        {/* Desktop Sidebar */}
        <Box
          sx={{
            width: { xs: '0', md: '300px', lg: '340px' },
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            borderRight: `1px solid ${borderColor}`,
            backgroundColor: dynamicColors.background,
            height: 'calc(100vh - 104px)',
            position: 'sticky',
            top: '104px',
            overflowY: 'auto',
            zIndex: 1200,
          }}
        >
          {sidebarContent}
        </Box>

        <Box sx={{ flex: 1, p: { xs: 3, md: 6, lg: 8 }, pb: { xs: 12, md: 6, lg: 8 }, maxWidth: '1400px', mx: 'auto', width: '100%' }}>
          {children}
        </Box>
      </Box>

      <LogoutDialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        onLogoutComplete={handleLogoutComplete}
      />

      {/* MOBILE FAB - Mimicking Note App */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 100, // Above Bottom Navigation
          right: 24,
          zIndex: 1400,
          display: { xs: 'flex', md: 'none' },
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2
        }}
      >
        <Backdrop
          open={isExpanded}
          onClick={() => setIsExpanded(false)}
          sx={{ 
            zIndex: -1, 
            bgcolor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)'
          }}
        />

        {/* Expanded Action Buttons */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 1 }}>
          {navItems.filter(item => ['identities', 'sessions', 'activity'].includes(item.id)).map((action, index) => (
            <Zoom 
              key={action.id} 
              in={isExpanded} 
              style={{ 
                transitionDelay: isExpanded ? `${(3 - 1 - index) * 50}ms` : '0ms',
                transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontWeight: 800, 
                    color: 'white', 
                    bgcolor: 'rgba(0,0,0,0.6)', 
                    px: 1.5, 
                    py: 0.5, 
                    borderRadius: '8px', 
                    backdropFilter: 'blur(10px)', 
                    textTransform: 'capitalize',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {action.label}
                </Typography>
                <Fab
                  size="medium"
                  onClick={() => {
                    setIsExpanded(false);
                    router.push(`/settings/${action.id}`);
                  }}
                  sx={{
                    bgcolor: 'rgba(15, 13, 12, 0.9)',
                    backdropFilter: 'blur(10px)',
                    color: activeTab === action.id ? brandIndigo : textColor,
                    border: `1px solid ${activeTab === action.id ? alpha(brandIndigo, 0.4) : 'rgba(255,255,255,0.1)'}`,
                    '&:hover': { 
                      bgcolor: 'rgba(25, 22, 20, 1)',
                      borderColor: brandIndigo,
                      boxShadow: `0 0 20px ${alpha(brandIndigo, 0.4)}`
                    },
                  }}
                >
                  <action.icon />
                </Fab>
              </Box>
            </Zoom>
          ))}
        </Box>

        {/* Main FAB Button */}
        <Fab
          onClick={() => setIsExpanded(!isExpanded)}
          sx={{
            width: 64,
            height: 64,
            bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.05)' : brandIndigo,
            color: isExpanded ? 'white' : 'black',
            borderRadius: '20px',
            border: isExpanded ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
            backdropFilter: isExpanded ? 'blur(10px)' : 'none',
            boxShadow: isExpanded ? 'none' : `0 8px 32px ${alpha(brandIndigo, 0.4)}`,
            transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            transform: isExpanded ? 'rotate(45deg)' : 'none',
            '&:hover': {
              bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.1)' : brandIndigo,
              transform: isExpanded ? 'rotate(45deg) scale(1.05)' : 'translateY(-4px)',
              boxShadow: isExpanded ? 'none' : `0 12px 40px ${alpha(brandIndigo, 0.5)}`,
            }
          }}
        >
          <PlusIcon sx={{ fontSize: 32 }} />
        </Fab>
      </Box>

      {/* BOTTOM NAVIGATION */}
      <Paper 
        elevation={0}
        sx={{ 
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: { xs: 'block', md: 'none' },
          zIndex: 1000,
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'rgba(255, 255, 255, 0.06)',
          bgcolor: '#161412',
          backgroundImage: 'none',
          boxShadow: '0 -12px 36px rgba(0, 0, 0, 0.34)',
        }} 
      >
        <BottomNavigation
          showLabels={false}
          value={activeTab}
          onChange={(_, newValue) => {
            router.push(`/settings/${newValue}`);
          }}
          sx={{ 
            bgcolor: '#161412',
            backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 18%, #161412 100%)',
            height: bottomBarSurface.mobileDockHeight,
            pb: 'env(safe-area-inset-bottom)',
            px: 1,
            justifyContent: 'space-around',
          }}
        >
          {bottomBarSurface.items.map((item) => {
            const navItem = navItems.find(n => n.id === item.id);
            const IconComponent = navItem?.icon;
            return (
              <BottomNavigationAction
                key={item.id}
                value={item.id}
                icon={IconComponent && <IconComponent sx={{ color: item.active ? brandIndigo : secondaryText, fontSize: 24 }} />}
                sx={{
                  minWidth: 0,
                  py: 1.25,
                  color: secondaryText,
                  '&.Mui-selected': {
                    color: textColor,
                    '& .MuiSvgIcon-root': {
                      color: brandIndigo,
                      transform: 'scale(1.2) translateY(-2px)',
                      filter: `drop-shadow(0 0 8px ${alpha(brandIndigo, 0.5)})`,
                    }
                  },
                  '& .MuiBottomNavigationAction-label': {
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'capitalize',
                    marginTop: '2px',
                  }
                }}
              />
            );
          })}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    }>
      <SettingsLayoutContent>{children}</SettingsLayoutContent>
    </Suspense>
  );
}
