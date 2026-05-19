'use client';

import React, { useState, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Box, 
  Fab, 
  Typography, 
  Backdrop, 
  Zoom,
  alpha,
} from '@mui/material';
import { 
  Plus as PlusIcon,
  CheckSquare as TaskIcon,
  FileText as FormIcon,
  Zap as EventIcon,
  MessageSquare as ChatIcon,
  Phone as CallIcon,
  MessageCircle as ReplyIcon,
  Hash as ChannelIcon,
  Users as GroupIcon,
} from 'lucide-react';
import { useTask } from '@/context/TaskContext';
import { useNoteDrawer } from '@/context/NoteDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import Logo from '@/components/common/Logo';

export default function GlobalFAB() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { setTaskDialogOpen } = useTask();
  const { open: openNoteDrawer } = useNoteDrawer();
  const [isExpanded, setIsExpanded] = useState(false);

  // Define app contexts
  const isLandingPage = pathname === '/';
  const isSettingsPage = pathname === '/settings' || pathname?.includes('/settings');
  const isNotePage = pathname.startsWith('/note/');
  const isFlowPage = pathname.startsWith('/flow');
  const isConnectPage = pathname.startsWith('/connect');
  const isAccountsPage = pathname.startsWith('/accounts');
  
  // Specific detail pages
  const isChatsPage = pathname === '/connect/chats';

  const actions = useMemo(() => {
      if (isChatsPage) {
          return [
              { id: 'chat', name: 'NEW CHAT', icon: <ChatIcon size={22} />, color: '#F59E0B', onClick: () => { router.push('/connect/chats?new=1'); setIsExpanded(false); } },
              { id: 'huddle', name: 'START HUDDLE', icon: <CallIcon size={22} />, color: '#F59E0B', onClick: () => { router.push('/connect/calls?start=1'); setIsExpanded(false); } },
              { id: 'channel', name: 'NEW CHANNEL', icon: <ChannelIcon size={22} />, color: '#F59E0B', onClick: () => { router.push('/connect/chats?type=channel&new=1'); setIsExpanded(false); } },
          ];
      }
      return [];
  }, [isChatsPage, router]);

  const fabConfig = useMemo(() => {
      return { icon: <ChatIcon size={32} strokeWidth={2} />, color: '#F59E0B' };
  }, []);
  // Hide conditions
  const shouldHide = isSettingsPage || (isAccountsPage && !isSettingsPage) || actions.length === 0;

  if (shouldHide) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: isLandingPage ? 32 : 110,
        right: 24,
        zIndex: 1400,
        display: { xs: 'flex', md: isLandingPage ? 'flex' : 'none' },
        flexDirection: 'column',
        alignItems: 'flex-end',
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

      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1.5, 
          mb: 2,
          pointerEvents: isExpanded ? 'auto' : 'none'
        }}
      >
        {actions.map((action, index) => (
          <Zoom 
            key={action.id} 
            in={isExpanded} 
            style={{ 
                transitionDelay: isExpanded ? `${(actions.length - 1 - index) * 50}ms` : '0ms'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography 
                variant="caption" 
                sx={{ 
                    fontWeight: 900, 
                    color: 'white', 
                    bgcolor: 'rgba(25, 22, 20, 0.8)', 
                    px: 1.5, 
                    py: 0.5, 
                    borderRadius: '8px', 
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    letterSpacing: '0.1em',
                    fontSize: '0.65rem'
                }}
              >
                {action.name}
              </Typography>
              <Fab
                size="medium"
                onClick={() => {
                    if (action.onClick) action.onClick();
                    if (action.href) router.push(action.href);
                }}
                sx={{
                  bgcolor: 'rgba(15, 13, 12, 0.9)',
                  backdropFilter: 'blur(10px)',
                  color: action.color,
                  border: `1px solid ${alpha(action.color, 0.3)}`,
                  width: 48,
                  height: 48,
                  '&:hover': { 
                    bgcolor: 'rgba(25, 22, 20, 1)',
                    borderColor: action.color,
                    boxShadow: `0 0 20px ${alpha(action.color, 0.4)}`
                  }
                }}
              >
                {action.icon}
              </Fab>
            </Box>
          </Zoom>
        ))}
      </Box>

      <Fab
        onClick={() => setIsExpanded(!isExpanded)}
        sx={{
          width: 64,
          height: 64,
          bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.05)' : fabConfig.color,
          color: isExpanded ? 'white' : 'black',
          borderRadius: '20px',
          border: isExpanded ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
          boxShadow: isExpanded ? 'none' : `0 8px 32px ${alpha(fabConfig.color, 0.4)}`,
          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: isExpanded ? 'rotate(45deg)' : 'none',
          '&:hover': {
            bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.1)' : fabConfig.color,
            transform: isExpanded ? 'rotate(45deg) scale(1.05)' : 'translateY(-4px)',
          }
        }}
      >
        {isExpanded ? <PlusIcon size={32} strokeWidth={2} /> : fabConfig.icon}
      </Fab>
    </Box>
  );
}
