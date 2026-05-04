"use client";

import React, { useState } from 'react';
import { 
  Box, 
  Fab, 
  Typography, 
  Backdrop, 
  Zoom,
  alpha
} from '@mui/material';
import { 
  Plus, 
  KeyRound, 
  CreditCard, 
  ShieldCheck
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export const VaultFAB: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Only show on Dashboard, TOTP and Sharing pages
  const showFab = pathname === '/dashboard' || pathname === '/totp' || pathname === '/sharing';
  
  if (!showFab) return null;

  const handleAction = (url: string) => {
    setIsExpanded(false);
    router.push(url);
    
    // Force searchParams update detection on same page
    if (url.startsWith(pathname)) {
        setTimeout(() => {
            window.dispatchEvent(new Event('popstate'));
        }, 100);
    }
  };

  const actions = [
    { 
      label: 'Login', 
      icon: KeyRound, 
      color: '#10B981', 
      url: '/dashboard?action=add-login'
    },
    { 
      label: 'Card', 
      icon: CreditCard, 
      color: '#6366F1', 
      url: '/dashboard?action=add-card'
    },
    { 
      label: 'TOTP', 
      icon: ShieldCheck, 
      color: '#F59E0B', 
      url: '/totp?action=add-totp'
    },
  ];

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 110, lg: 32 },
        right: { xs: 24, lg: 32 },
        zIndex: 1400,
        display: 'flex',
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
          bgcolor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)'
        }}
      />

      {/* Expanded Action Buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 1 }}>
        {actions.map((action, index) => (
          <Zoom 
            key={action.label} 
            in={isExpanded} 
            style={{ transitionDelay: isExpanded ? `${(actions.length - index) * 50}ms` : '0ms' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontWeight: 800, 
                  color: 'white', 
                  bgcolor: 'rgba(22, 20, 18, 0.8)', 
                  px: 1.5, 
                  py: 0.5, 
                  borderRadius: '8px', 
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  fontFamily: 'var(--font-space-grotesk)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {action.label}
              </Typography>
              <Fab
                size="medium"
                onClick={() => handleAction(action.url)}
                sx={{
                  bgcolor: action.color,
                  color: '#000',
                  '&:hover': { 
                    bgcolor: alpha(action.color, 0.8),
                    transform: 'scale(1.1)'
                  },
                  boxShadow: `0 8px 24px ${alpha(action.color, 0.4)}`,
                  transition: 'all 0.2s ease'
                }}
              >
                <action.icon size={20} strokeWidth={2.5} />
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
          bgcolor: '#10B981',
          color: '#000',
          borderRadius: '20px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)',
          '&:hover': {
            bgcolor: '#0fa976',
            transform: 'translateY(-4px)',
            boxShadow: '0 12px 40px rgba(16, 185, 129, 0.5)'
          },
          ...(isExpanded && {
            transform: 'rotate(45deg)',
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: 'none'
          })
        }}
      >
        <Plus size={32} strokeWidth={2.5} />
      </Fab>
    </Box>
  );
};
