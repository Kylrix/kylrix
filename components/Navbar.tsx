'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Stack, 
  AppBar, 
  Toolbar, 
  Link as MuiLink,
  IconButton,
  alpha,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  Tooltip,
  useTheme,
  useMediaQuery,
  Avatar,
  ListItemIcon
} from '@mui/material';
import { 
  Sun,
  Moon,
  Github,
  Menu as MenuIcon,
  X,
  ChevronDown,
  LayoutGrid,
  Zap,
  Shield,
  FileText,
  Waypoints,
  Settings,
  ExternalLink,
  LogOut,
  User as UserIcon,
  Download
} from 'lucide-react';
import NextLink from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import Logo from './Logo';
import EcosystemPortal from './EcosystemPortal';
import { ECOSYSTEM_APPS, getEcosystemUrl, KYLRIX_AUTH_URI } from '@/lib/ecosystem';
import { useAuth } from '@/context/auth/AuthContext';
import { useColorMode } from '@/context/ThemeContext';
import { getUserProfilePicId } from '@/lib/utils';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profilePreview';

export const Navbar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated, isLoading, logout, openIDMWindow } = useAuth();
  const { toggleColorMode, mode } = useColorMode();
  
  const [isEcosystemPortalOpen, setIsEcosystemPortalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Dropdown states
  const [anchorElProducts, setAnchorElProducts] = useState<null | HTMLElement>(null);
  const [anchorElDevelopers, setAnchorElDevelopers] = useState<null | HTMLElement>(null);
  const [anchorElAccount, setAnchorElAccount] = useState<null | HTMLElement>(null);

  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const profilePicId = getUserProfilePicId(user);

  useEffect(() => {
    let mounted = true;
    const cached = getCachedProfilePreview(profilePicId);
    if (cached !== undefined) setProfileUrl(cached);

    const loadProfile = async () => {
      if (profilePicId) {
        const url = await fetchProfilePreview(profilePicId);
        if (mounted) setProfileUrl(url);
      }
    };
    loadProfile();
    return () => { mounted = false; };
  }, [profilePicId]);

  const isActive = (href: string) => pathname === href;

  const handleLaunchClick = () => {
    if (isAuthenticated) {
      router.push(getEcosystemUrl('note'));
    } else {
      openIDMWindow();
    }
  };

  const handleLogout = async () => {
    setAnchorElAccount(null);
    await logout();
  };

  const navItems = [
    { 
      label: 'Products', 
      type: 'dropdown',
      anchorEl: anchorElProducts,
      setAnchorEl: setAnchorElProducts,
      items: [
        ...ECOSYSTEM_APPS.filter(app => app.type === 'app').map(app => ({
          label: app.label,
          desc: app.description,
          icon: app.icon,
          color: app.color,
          href: getEcosystemUrl(app.subdomain)
        })),
        {
          label: 'Downloads',
          desc: 'Get Kylrix for Desktop and Mobile',
          icon: 'download',
          color: '#6366F1',
          href: '/downloads'
        }
      ]
    },
    { 
      label: 'Developers', 
      type: 'dropdown',
      anchorEl: anchorElDevelopers,
      setAnchorEl: setAnchorElDevelopers,
      items: [
        { label: 'Documentation', href: '/docs', icon: 'file-text' },
        { label: 'API Reference', href: '/docs/api', icon: 'zap' },
        { label: 'SDKs & Tools', href: '/downloads', icon: 'settings' },
        { label: 'GitHub', href: 'https://github.com/kylrix', icon: 'github', external: true },
      ]
    },
    { label: 'Pricing', href: '/pricing' }
  ];

  const renderIcon = (iconName: string, color?: string) => {
    const icons: Record<string, any> = {
      'file-text': FileText,
      'shield': Shield,
      'zap': Zap,
      'waypoints': Waypoints,
      'settings': Settings,
      'github': Github,
      'download': Download,
    };
    const IconComp = icons[iconName] || Zap;
    return <IconComp size={18} strokeWidth={1.5} color={color || 'currentColor'} />;
  };

  return (
    <>
      <AppBar 
        position="fixed" 
        sx={{ 
          bgcolor: mode === 'dark' ? 'rgba(5, 5, 5, 0.01)' : 'rgba(255, 255, 255, 0.01)', 
          backdropFilter: 'blur(25px) saturate(180%)', 
          boxShadow: 'none', 
          borderBottom: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
          backgroundImage: 'none',
          zIndex: (theme) => theme.zIndex.drawer + 1
        }}
      >
        <Container maxWidth="xl">
          <Toolbar 
            disableGutters 
            sx={{ 
              height: { xs: 72, md: 88 }, 
              justifyContent: 'space-between',
              px: { xs: 0, md: 2 }
            }}
          >
            <Logo 
              size={36} 
              sx={{ 
                textDecoration: 'none',
                mr: 4,
                '&:hover': { opacity: 0.8 }
              }} 
              component={NextLink}
              href="/"
            />
            
            <Stack 
              direction="row" 
              spacing={1} 
              sx={{ 
                display: { xs: 'none', md: 'flex' }, 
                alignItems: 'center',
                bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                px: 1,
                py: 0.5,
                borderRadius: '100px',
                border: mode === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)'
              }}
            >
              {navItems.map((item) => (
                <Box key={item.label}>
                  {item.type === 'dropdown' ? (
                    <Button
                      onMouseEnter={(_e) => item.setAnchorEl(_e.currentTarget)}
                      onClick={(_e) => item.setAnchorEl(_e.currentTarget)}
                      endIcon={<ChevronDown size={14} style={{ 
                        transform: Boolean(item.anchorEl) ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s'
                      }} />}
                      sx={{ 
                        px: 3,
                        py: 1,
                        borderRadius: '100px',
                        fontWeight: 700, 
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: Boolean(item.anchorEl) ? '#6366F1' : (mode === 'dark' ? '#fff' : '#09090B'),
                        opacity: Boolean(item.anchorEl) ? 1 : 0.5,
                        '&:hover': { 
                          opacity: 1, 
                          color: '#6366F1',
                          bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                        }
                      }}
                    >
                      {item.label}
                    </Button>
                  ) : (
                    <MuiLink
                      component={NextLink}
                      href={item.href || '#'}
                      underline="none"
                      sx={{ 
                        px: 3,
                        py: 1,
                        display: 'inline-block',
                        borderRadius: '100px',
                        fontWeight: 700, 
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        color: isActive(item.href || '') ? '#6366F1' : (mode === 'dark' ? '#fff' : '#09090B'),
                        opacity: isActive(item.href || '') ? 1 : 0.5,
                        bgcolor: isActive(item.href || '') ? alpha('#6366F1', 0.05) : 'transparent',
                        '&:hover': { 
                          opacity: 1, 
                          color: '#6366F1', 
                          bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
                        }
                      }}
                    >
                      {item.label}
                    </MuiLink>
                  )}

                  {item.type === 'dropdown' && (
                    <Menu
                      anchorEl={item.anchorEl}
                      open={Boolean(item.anchorEl)}
                      onClose={() => item.setAnchorEl(null)}
                      MenuListProps={{ onMouseLeave: () => item.setAnchorEl(null) }}
                      elevation={0}
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                      PaperProps={{
                        sx: {
                          mt: 2,
                          width: 280,
                          bgcolor: 'rgba(10, 10, 10, 0.95)',
                          backdropFilter: 'blur(20px) saturate(180%)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '24px',
                          backgroundImage: 'none',
                          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                          p: 1
                        }
                      }}
                    >
                        {item.items?.map((subItem: any) => {
                          const isApp = ECOSYSTEM_APPS.some(app => app.label === subItem.label);
                          return (
                            <MenuItem 
                              key={subItem.label}
                              onClick={() => {
                                window.location.assign(subItem.href);
                                item.setAnchorEl(null);
                              }}
                              sx={{ 
                                borderRadius: '16px',
                                py: 1.5,
                                gap: 2,
                                '&:hover': { 
                                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                                  '& .subitem-icon': { transform: 'scale(1.1)' }
                                }
                              }}
                            >
                              {isApp ? (
                                <Logo 
                                  app={subItem.label.toLowerCase() as any} 
                                  size={36} 
                                  variant="icon"
                                  className="subitem-icon"
                                  sx={{ 
                                    transition: 'transform 0.2s',
                                  }}
                                />
                              ) : (
                                <Box 
                                  className="subitem-icon"
                                  sx={{ 
                                    width: 36, 
                                    height: 36, 
                                    borderRadius: '10px', 
                                    bgcolor: subItem.color ? alpha(subItem.color, 0.1) : 'rgba(255,255,255,0.05)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'transform 0.2s',
                                    color: subItem.color || '#fff'
                                  }}
                                >
                                  {renderIcon(subItem.icon, subItem.color)}
                                </Box>
                              )}
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>{subItem.label}</Typography>
                                {subItem.desc && (
                                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block' }}>
                                    {subItem.desc}
                                  </Typography>
                                )}
                              </Box>
                            </MenuItem>
                          );
                        })}
                    </Menu>
                  )}
                </Box>
              ))}
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Ecosystem Portal">
                <IconButton 
                  onClick={() => setIsEcosystemPortalOpen(true)}
                  sx={{ 
                    color: '#6366F1',
                    bgcolor: alpha('#6366F1', 0.05),
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    width: 42,
                    height: 42,
                    transition: 'all 0.3s',
                    position: 'relative',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '1px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '12px'
                    },
                    '&:hover': { 
                      bgcolor: alpha('#6366F1', 0.1), 
                      boxShadow: '0 0 15px rgba(99, 102, 241, 0.2), 0 1px 0 rgba(0,0,0,0.4)',
                      borderColor: '#6366F1'
                    },
                    display: { xs: 'none', sm: 'flex' }
                  }}
                >
                  <LayoutGrid size={20} strokeWidth={1.5} />
                </IconButton>
              </Tooltip>

              {user ? (
                <IconButton 
                  onClick={(e) => setAnchorElAccount(e.currentTarget)}
                  sx={{ 
                    p: 0.5,
                    '&:hover': { transform: 'scale(1.05)' },
                    transition: 'transform 0.2s'
                  }}
                >
                  <Avatar 
                    src={profileUrl || undefined}
                    sx={{ 
                      width: { xs: 32, sm: 38 }, 
                      height: { xs: 32, sm: 38 }, 
                      bgcolor: '#6366F1',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: '#000',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '10px',
                      boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '10px'
                      }
                    }}
                  >
                    {user?.name ? user.name[0].toUpperCase() : 'U'}
                  </Avatar>
                </IconButton>
              ) : (
                <Button
                  onClick={handleLaunchClick}
                  variant="contained"
                  size="small"
                  sx={{
                    ml: 1,
                    bgcolor: '#6366F1',
                    color: '#000',
                    fontWeight: 800,
                    borderRadius: '10px',
                    textTransform: 'none',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '1px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '10px'
                    },
                    '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
                  }}
                >
                  Connect
                </Button>
              )}

              {user && (
                <Menu
                  anchorEl={anchorElAccount}
                  open={Boolean(anchorElAccount)}
                  onClose={() => setAnchorElAccount(null)}
                  PaperProps={{
                    sx: {
                      mt: 1.5,
                      width: 280,
                      bgcolor: 'rgba(10, 10, 10, 0.95)',
                      backdropFilter: 'blur(25px) saturate(180%)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '24px',
                      backgroundImage: 'none',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                      overflow: 'hidden'
                    }
                  }}
                >
                  <Box sx={{ px: 3, py: 2.5, bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      Account Identity
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'white', mt: 0.5, opacity: 0.9 }}>
                      {user?.email}
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
                  <Box sx={{ py: 1 }}>
                    <MenuItem 
                      onClick={() => {
                        window.location.href = `${getEcosystemUrl('accounts')}/settings?source=${encodeURIComponent(window.location.origin)}`;
                        setAnchorElAccount(null);
                      }}
                      sx={{ py: 1.5, px: 3, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } }}
                    >
                      <ListItemIcon><Settings size={18} strokeWidth={1.5} color="rgba(255, 255, 255, 0.4)" /></ListItemIcon>
                      <ListItemText primary="Settings" primaryTypographyProps={{ variant: 'caption', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'white' }} />
                    </MenuItem>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
                  <MenuItem onClick={handleLogout} sx={{ py: 2, px: 3, color: '#FF4D4D', '&:hover': { bgcolor: alpha('#FF4D4D', 0.05) } }}>
                    <ListItemIcon><LogOut size={18} strokeWidth={1.5} color="#FF4D4D" /></ListItemIcon>
                    <ListItemText primary="Sign Out" primaryTypographyProps={{ variant: 'caption', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                  </MenuItem>
                </Menu>
              )}

                  <IconButton 
                    onClick={() => setMobileMenuOpen(true)}
                    sx={{ 
                      display: { xs: 'flex', md: 'none' },
                      color: mode === 'dark' ? 'white' : 'black',
                      bgcolor: mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                      borderRadius: '12px',
                      width: 42,
                      height: 42,
                      zIndex: 2000 // Ensure it's clickable
                    }}
                  >
                <MenuIcon size={24} />
              </IconButton>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 2 }}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 320,
            bgcolor: 'rgba(5, 5, 5, 0.98)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            backgroundImage: 'none'
          }
        }}
      >
        <Box sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
            <Logo size={32} />
            <IconButton onClick={() => setMobileMenuOpen(false)} sx={{ color: 'white' }}>
              <X size={24} />
            </IconButton>
          </Stack>

          <List sx={{ gap: 1, display: 'flex', flexDirection: 'column' }}>
            {navItems.map((item) => (
              <Box key={item.label} sx={{ mb: 2 }}>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    px: 2, 
                    mb: 1, 
                    display: 'block', 
                    fontWeight: 900, 
                    color: 'rgba(255, 255, 255, 0.3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em'
                  }}
                >
                  {item.label}
                </Typography>
                
                        {item.type === 'dropdown' ? (
                          <Stack spacing={0.5}>
                            {item.items?.map((subItem: any) => {
                              const isApp = ECOSYSTEM_APPS.some(app => app.label === subItem.label);
                              return (
                                <ListItemButton 
                                  key={subItem.label}
                                  onClick={() => {
                                    window.location.assign(subItem.href);
                                    setMobileMenuOpen(false);
                                  }}
                                  sx={{ 
                                    borderRadius: '12px',
                                    py: 1.5,
                                    gap: 2,
                                    bgcolor: 'rgba(255, 255, 255, 0.02)'
                                  }}
                                >
                                  {isApp ? (
                                    <Logo 
                                      app={subItem.label.toLowerCase() as any} 
                                      size={32} 
                                      variant="icon"
                                    />
                                  ) : (
                                    <Box sx={{ color: subItem.color || '#6366F1', display: 'flex' }}>
                                      {renderIcon(subItem.icon)}
                                    </Box>
                                  )}
                                  <ListItemText 
                                    primary={subItem.label} 
                                    primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}
                                    secondary={subItem.desc}
                                    secondaryTypographyProps={{ fontSize: '0.7rem', color: 'white', sx: { opacity: 0.5 } }}
                                  />
                                </ListItemButton>
                              );
                            })}
                          </Stack>
                        ) : (
                  <ListItemButton 
                    onClick={() => {
                      window.location.assign(item.href || '#');
                      setMobileMenuOpen(false);
                    }}
                    sx={{ 
                      borderRadius: '12px',
                      bgcolor: isActive(item.href || '') ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: isActive(item.href || '') ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent'
                    }}
                  >
                    <ListItemText 
                      primary={item.label} 
                      primaryTypographyProps={{ 
                        fontWeight: 700, 
                        color: isActive(item.href || '') ? '#6366F1' : 'white' 
                      }} 
                    />
                    <ExternalLink size={14} style={{ opacity: 0.3, color: 'white' }} />
                  </ListItemButton>
                )}
              </Box>
            ))}
          </List>

          <Divider sx={{ my: 4, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          
          {user ? (
            <ListItemButton 
              onClick={() => {
                router.push(getEcosystemUrl('note'));
                setMobileMenuOpen(false);
              }}
              sx={{ 
                borderRadius: '12px',
                bgcolor: alpha('#6366F1', 0.05),
                border: '1px solid rgba(255, 255, 255, 0.05)',
                mb: 2,
                boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '1px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '12px'
                }
              }}
            >
              <Avatar 
                src={profileUrl || undefined}
                sx={{ 
                  width: 32, 
                  height: 32, 
                  mr: 2,
                  bgcolor: '#050505',
                  color: '#6366F1',
                  borderRadius: '8px',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '0.8rem',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}
              >
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </Avatar>
              <ListItemText 
                primary={user?.name || 'User'} 
                primaryTypographyProps={{ fontWeight: 700, color: '#6366F1' }} 
              />
            </ListItemButton>
          ) : (
            <Button 
              fullWidth 
              variant="contained" 
              size="large"
              onClick={handleLaunchClick}
                      sx={{ 
                        py: 2, 
                        borderRadius: '16px',
                        fontWeight: 900,
                        boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2), 0 1px 0 rgba(0,0,0,0.4)',
                        mb: 4,
                        bgcolor: '#6366F1',
                        color: '#000',
                        textTransform: 'none',
                        position: 'relative',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '1px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '16px'
                        },
                        '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
                      }}
            >
              Connect
            </Button>
          )}

          {isAuthenticated && (
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={handleLogout}
              startIcon={<LogOut size={18} />}
              sx={{ 
                py: 1.5, 
                borderRadius: '12px',
                color: '#FF4D4D',
                borderColor: 'rgba(255, 77, 77, 0.2)',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#FF4D4D',
                  bgcolor: 'rgba(255, 77, 77, 0.05)'
                }
              }}
            >
              Disconnect
            </Button>
          )}
          
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', gap: 3 }}>
            <IconButton sx={{ color: 'rgba(255, 255, 255, 0.4)' }} component="a" href="https://github.com/kylrix">
              <Github size={24} />
            </IconButton>
            <IconButton 
              sx={{ color: 'rgba(255, 255, 255, 0.4)' }} 
              onClick={() => {
                setIsEcosystemPortalOpen(true);
                setMobileMenuOpen(false);
              }}
            >
              <LayoutGrid size={24} />
            </IconButton>
          </Box>
        </Box>
      </Drawer>

      <EcosystemPortal 
        open={isEcosystemPortalOpen} 
        onClose={() => setIsEcosystemPortalOpen(false)} 
      />
    </>
  );
};

export default Navbar;
