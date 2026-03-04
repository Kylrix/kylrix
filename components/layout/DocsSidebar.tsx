'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemText,
  Collapse,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import { 
  ChevronRight, 
  ChevronDown,
  Menu as MenuIcon,
  X
} from 'lucide-react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';

export const DOCS_SECTIONS = [
  { 
    title: 'Introduction', 
    items: [
      { label: 'Overview', href: '/docs' },
      { label: 'Quick Start', href: '/docs/quick-start' },
      { label: 'Architecture', href: '/docs/architecture' }
    ] 
  },
  { 
    title: 'Core Systems', 
    items: [
      { label: 'Identity & WebAuthn', href: '/docs/identity' },
      { label: 'Zero-Knowledge Vault', href: '/docs/vault' },
      { label: 'P2P Communication', href: '/docs/connect' },
      { label: 'Flow Orchestration', href: '/docs/flow' }
    ] 
  },
  { 
    title: 'Guides', 
    items: [
      { label: 'Building Extensions', href: '/docs/extensions' },
      { label: 'Client Integration', href: '/docs/integration' },
      { label: 'Security Best Practices', href: '/docs/security' }
    ] 
  },
  { 
    title: 'SDKs & Reference', 
    items: [
      { 
        label: 'TypeScript SDK', 
        href: '/docs/sdks/typescript',
        subItems: [
          { label: 'Installation', href: '/docs/sdks/typescript#installation' },
          { label: 'Quick Start', href: '/docs/sdks/typescript#quick-start' },
          { label: 'Core Client', href: '/docs/sdks/typescript#core-client' }
        ]
      },
      { label: 'Go SDK', href: '/docs/sdks/go' },
      { label: 'Python SDK', href: '/docs/sdks/python' },
      { label: 'Dart SDK', href: '/docs/sdks/dart' },
      { label: 'CLI Commands', href: '/docs/cli' },
      { label: 'API Reference', href: '/docs/api' }
    ] 
  }
];

interface SidebarContentProps {
  onClose?: () => void;
}

const SidebarContent = ({ onClose }: SidebarContentProps) => {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpand = (label: string) => {
    setExpandedItems(prev => 
      prev.includes(label) ? prev.filter(i => i !== label) : [...prev, label]
    );
  };

  const isSelected = (href: string) => pathname === href;

  return (
    <Stack spacing={4} sx={{ px: { xs: 2, md: 4 }, py: { xs: 4, md: 0 } }}>
      {DOCS_SECTIONS.map((section) => (
        <Box key={section.title}>
          <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.primary', opacity: 0.3, letterSpacing: '0.15em', fontWeight: 900, fontSize: '0.7rem', textTransform: 'uppercase' }}>
            {section.title}
          </Typography>
          <List disablePadding>
            {section.items.map((item) => (
              <Box key={item.label}>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton 
                    href={item.href}
                    component={NextLink}
                    onClick={() => {
                        if (onClose) onClose();
                        if (item.subItems) toggleExpand(item.label);
                    }}
                    selected={isSelected(item.href)}
                    sx={{ 
                      borderRadius: 2, 
                      px: 2, 
                      py: 1,
                      transition: 'all 0.2s',
                      '&.Mui-selected': {
                        bgcolor: 'rgba(99, 102, 241, 0.08)',
                        color: '#6366F1',
                        '& .MuiListItemText-primary': { fontWeight: 700, opacity: 1 }
                      },
                      '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.05)', color: '#6366F1' }
                    }}
                  >
                    <ListItemText 
                      primary={item.label} 
                      primaryTypographyProps={{ 
                        variant: 'body2', 
                        sx: { fontWeight: 500, fontSize: '0.9rem', opacity: isSelected(item.href) ? 1 : 0.6 } 
                      }} 
                    />
                    {item.subItems && (
                      <IconButton 
                        size="small" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleExpand(item.label);
                        }}
                      >
                        {expandedItems.includes(item.label) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </IconButton>
                    )}
                  </ListItemButton>
                </ListItem>
                
                {item.subItems && (
                  <Collapse in={expandedItems.includes(item.label) || isSelected(item.href)} timeout="auto" unmountOnExit>
                    <List disablePadding sx={{ ml: 3, borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                      {item.subItems.map((sub) => (
                        <ListItem key={sub.label} disablePadding>
                          <ListItemButton 
                            href={sub.href}
                            component={NextLink}
                            onClick={onClose}
                            sx={{ 
                              py: 0.5, 
                              px: 2, 
                              borderRadius: 1,
                              '&:hover': { color: '#6366F1' } 
                            }}
                          >
                            <ListItemText 
                              primary={sub.label} 
                              primaryTypographyProps={{ 
                                variant: 'caption', 
                                sx: { fontWeight: 500, fontSize: '0.75rem', opacity: 0.5 } 
                              }} 
                            />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                )}
              </Box>
            ))}
          </List>
        </Box>
      ))}
    </Stack>
  );
};

const DocsSidebar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <Box 
          sx={{ 
            position: 'fixed', 
            bottom: 24, 
            right: 24, 
            zIndex: 1100,
            display: { xs: 'flex', md: 'none' }
          }}
        >
          <IconButton 
            onClick={() => setMobileOpen(true)}
            sx={{ 
              bgcolor: '#6366F1', 
              color: 'white', 
              width: 56, 
              height: 56,
              boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
              '&:hover': { bgcolor: '#4F46E5' }
            }}
          >
            <MenuIcon size={24} />
          </IconButton>
        </Box>

        <Drawer
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          PaperProps={{
            sx: {
              width: '85%',
              maxWidth: 320,
              bgcolor: theme.palette.mode === 'dark' ? 'rgba(10, 10, 10, 0.98)' : 'rgba(253, 252, 251, 0.98)',
              backdropFilter: 'blur(20px)',
              backgroundImage: 'none'
            }
          }}
        >
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton onClick={() => setMobileOpen(false)}>
              <X size={24} />
            </IconButton>
          </Box>
          <SidebarContent onClose={() => setMobileOpen(false)} />
        </Drawer>
      </>
    );
  }

  return (
    <Box 
      sx={{ 
        width: 300, 
        pt: 15, 
        pb: 10, 
        position: 'fixed', 
        height: '100vh', 
        overflowY: 'auto', 
        borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        display: { xs: 'none', md: 'block' },
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' }
      }}
    >
      <SidebarContent />
    </Box>
  );
};

export default DocsSidebar;
