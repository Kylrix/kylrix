'use client';

import React, { useState } from 'react';
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
  useMediaQuery
} from '@mui/material';
import { 
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
  ExternalLink
} from 'lucide-react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

import Logo from './Logo';
import EcosystemPortal from './EcosystemPortal';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';

export const Navbar = () => {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [isEcosystemPortalOpen, setIsEcosystemPortalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Dropdown states
  const [anchorElProducts, setAnchorElProducts] = useState<null | HTMLElement>(null);
  const [anchorElDevelopers, setAnchorElDevelopers] = useState<null | HTMLElement>(null);

  const isActive = (href: string) => pathname === href;

  const handleLaunchClick = () => {
    const accountsUrl = getEcosystemUrl('accounts');
    const authUrl = `${accountsUrl}/login`;
    const sourceUrl = window.location.origin + pathname;
    const targetUrl = `${authUrl}?source=${encodeURIComponent(sourceUrl)}`;

    if (isMobile) {
      window.location.href = targetUrl;
    } else {
      const width = 560;
      const height = 750;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      window.open(
        targetUrl,
        'KylrixAccounts',
        `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
      );
    }
  };

  const navItems = [
    { 
      label: 'Products', 
      type: 'dropdown',
      anchorEl: anchorElProducts,
      setAnchorEl: setAnchorElProducts,
      items: ECOSYSTEM_APPS.filter(app => app.type === 'app').map(app => ({
        label: app.label,
        desc: app.description,
        icon: app.icon,
        color: app.color,
        href: getEcosystemUrl(app.subdomain)
      }))
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
    { label: 'Docs', href: '/docs' },
    { label: 'Downloads', href: '/downloads' }
  ];

  const renderIcon = (iconName: string, color?: string) => {
    const icons: Record<string, any> = {
      'file-text': FileText,
      'shield': Shield,
      'zap': Zap,
      'waypoints': Waypoints,
      'settings': Settings,
      'github': Github,
    };
    const IconComp = icons[iconName] || Zap;
    return <IconComp size={18} strokeWidth={1.5} color={color || 'currentColor'} />;
  };

  return (
    <>
      <AppBar 
        position="fixed" 
        sx={{ 
          bgcolor: 'rgba(5, 5, 5, 0.8)', 
          backdropFilter: 'blur(20px) saturate(180%)', 
          boxShadow: 'none', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'none',
          zIndex: (theme) => theme.zIndex.drawer + 1
        }}
      >
        <Container maxWidth="xl">
          <Toolbar 
            disableGutters 
            sx={{ 
              height: { xs: 72, md: 88 }, 
              justifyContent: 'space-between'
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
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                px: 1,
                py: 0.5,
                borderRadius: '100px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              {navItems.map((item) => (
                <Box key={item.label}>
                  {item.type === 'dropdown' ? (
                    <Button
                      onMouseEnter={(_e) => item.setAnchorEl(e.currentTarget)}
                      onClick={(_e) => item.setAnchorEl(e.currentTarget)}
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
                        color: Boolean(item.anchorEl) ? '#00F5FF' : '#fff',
                        opacity: Boolean(item.anchorEl) ? 1 : 0.5,
                        '&:hover': { 
                          opacity: 1, 
                          color: '#00F5FF',
                          bgcolor: 'rgba(255, 255, 255, 0.05)'
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
                        color: isActive(item.href || '') ? '#00F5FF' : '#fff',
                        opacity: isActive(item.href || '') ? 1 : 0.5,
                        bgcolor: isActive(item.href || '') ? 'rgba(0, 245, 255, 0.05)' : 'transparent',
                        '&:hover': { 
                          opacity: 1, 
                          color: '#00F5FF',
                          bgcolor: 'rgba(255, 255, 255, 0.05)'
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
                      {item.items?.map((subItem: any) => (
                        <MenuItem 
                          key={subItem.label}
                          onClick={() => {
                            window.location.href = subItem.href;
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
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'white' }}>{subItem.label}</Typography>
                            {subItem.desc && (
                              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', display: 'block' }}>
                                {subItem.desc}
                              </Typography>
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </Menu>
                  )}
                </Box>
              ))}
            </Stack>

            <Stack direction="row" spacing={2} alignItems="center">
              <Tooltip title="Ecosystem Portal">
                <IconButton 
                  onClick={() => setIsEcosystemPortalOpen(true)}
                  sx={{ 
                    color: '#00F5FF',
                    bgcolor: 'rgba(0, 245, 255, 0.05)',
                    border: '1px solid rgba(0, 245, 255, 0.1)',
                    borderRadius: '12px',
                    width: 42,
                    height: 42,
                    transition: 'all 0.3s',
                    '&:hover': { 
                      bgcolor: 'rgba(0, 245, 255, 0.1)', 
                      boxShadow: '0 0 15px rgba(0, 245, 255, 0.2)',
                      borderColor: '#00F5FF'
                    },
                    display: { xs: 'none', sm: 'flex' }
                  }}
                >
                  <LayoutGrid size={20} strokeWidth={1.5} />
                </IconButton>
              </Tooltip>

              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleLaunchClick}
                sx={{ 
                  borderRadius: '12px', 
                  px: { xs: 2, md: 4 },
                  py: 1,
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 15px rgba(0, 245, 255, 0.2)',
                  '&:hover': {
                    boxShadow: '0 6px 20px rgba(0, 245, 255, 0.4)'
                  }
                }}
              >
                Launch
              </Button>

              <IconButton 
                onClick={() => setMobileMenuOpen(true)}
                sx={{ 
                  display: { xs: 'flex', md: 'none' },
                  color: 'white',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
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
                    {item.items?.map((subItem: any) => (
                      <ListItemButton 
                        key={subItem.label}
                        onClick={() => {
                          window.location.href = subItem.href;
                          setMobileMenuOpen(false);
                        }}
                        sx={{ 
                          borderRadius: '12px',
                          py: 1.5,
                          gap: 2,
                          bgcolor: 'rgba(255, 255, 255, 0.02)'
                        }}
                      >
                        <Box sx={{ color: subItem.color || '#00F5FF', display: 'flex' }}>
                          {renderIcon(subItem.icon)}
                        </Box>
                        <ListItemText 
                          primary={subItem.label} 
                          primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}
                          secondary={subItem.desc}
                          secondaryTypographyProps={{ fontSize: '0.7rem', color: 'white', sx: { opacity: 0.5 } }}
                        />
                      </ListItemButton>
                    ))}
                  </Stack>
                ) : (
                  <ListItemButton 
                    onClick={() => {
                      window.location.href = item.href || '#';
                      setMobileMenuOpen(false);
                    }}
                    sx={{ 
                      borderRadius: '12px',
                      bgcolor: isActive(item.href || '') ? 'rgba(0, 245, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: isActive(item.href || '') ? '1px solid rgba(0, 245, 255, 0.2)' : '1px solid transparent'
                    }}
                  >
                    <ListItemText 
                      primary={item.label} 
                      primaryTypographyProps={{ 
                        fontWeight: 700, 
                        color: isActive(item.href || '') ? '#00F5FF' : 'white' 
                      }} 
                    />
                    <ExternalLink size={14} style={{ opacity: 0.3, color: 'white' }} />
                  </ListItemButton>
                )}
              </Box>
            ))}
          </List>

          <Divider sx={{ my: 4, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          
          <Button 
            fullWidth 
            variant="contained" 
            size="large"
            onClick={handleLaunchClick}
            sx={{ 
              py: 2, 
              borderRadius: '16px',
              fontWeight: 900,
              boxShadow: '0 8px 24px rgba(0, 245, 255, 0.2)'
            }}
          >
            Launch Ecosystem
          </Button>
          
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
