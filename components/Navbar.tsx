'use client';

import React from 'react';
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
  alpha
} from '@mui/material';
import { 
  Github,
  Menu as MenuIcon
} from 'lucide-react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

export const Navbar = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Products', href: '/products' },
    { label: 'Developers', href: '/developers' },
    { label: 'Docs', href: '/docs' },
    { label: 'Downloads', href: '/downloads' }
  ];

  const isActive = (href: string) => pathname === href;

  return (
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
          {/* Brand Logo & Name */}
          <Box 
            component={NextLink} 
            href="/" 
            sx={{ 
              textDecoration: 'none', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 2,
              mr: 4
            }}
          >
            <Box
              sx={{ 
                width: 36, 
                height: 36, 
                bgcolor: '#00F5FF', 
                borderRadius: '10px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#000',
                fontWeight: 900,
                fontSize: '1.4rem',
                boxShadow: '0 0 20px rgba(0, 245, 255, 0.3)'
              }}
            >
              K
            </Box>
            <Typography 
              variant="h5" 
              sx={{ 
                fontWeight: 900, 
                letterSpacing: '-0.04em', 
                color: '#fff',
                fontSize: { xs: '1.25rem', md: '1.5rem' },
                textTransform: 'uppercase'
              }}
            >
              KYLRIX
            </Typography>
          </Box>
          
          {/* Desktop Navigation */}
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
                <MuiLink
                  component={NextLink}
                  href={item.href}
                  underline="none"
                  sx={{ 
                    px: 3,
                    py: 1,
                    borderRadius: '100px',
                    fontWeight: 700, 
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    color: isActive(item.href) ? '#00F5FF' : '#fff',
                    opacity: isActive(item.href) ? 1 : 0.5,
                    bgcolor: isActive(item.href) ? 'rgba(0, 245, 255, 0.05)' : 'transparent',
                    '&:hover': { 
                      opacity: 1, 
                      color: '#00F5FF',
                      bgcolor: 'rgba(255, 255, 255, 0.05)'
                    }
                  }}
                >
                  {item.label}
                </MuiLink>
              </Box>
            ))}
          </Stack>

          {/* Right Actions */}
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton 
              component="a" 
              href="https://github.com/kylrix" 
              target="_blank"
              sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                transition: 'all 0.3s',
                '&:hover': { 
                  color: '#fff',
                  bgcolor: 'rgba(255, 255, 255, 0.05)'
                },
                display: { xs: 'none', sm: 'flex' }
              }}
            >
              <Github size={20} />
            </IconButton>
            
            <Button 
              variant="contained" 
              color="primary" 
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
              sx={{ 
                display: { xs: 'flex', md: 'none' },
                color: 'white'
              }}
            >
              <MenuIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default Navbar;
