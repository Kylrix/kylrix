'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Paper, Tooltip } from '@/lib/openbricks/primitives';
import {
  FileText as NotesIcon,
  Lock as VaultIcon,
  CheckSquare as FlowIcon,
  MessageCircle as ConnectIcon,
  FolderKanban as ProjectsIcon,
  Tag as TagsIcon,
} from 'lucide-react';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useCallLauncher } from '@/context/CallLauncherContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useAuth } from '@/context/auth/AuthContext';

type NavId = 'note' | 'flow' | 'vault' | 'connect' | 'projects' | 'tags';

const NAV_COLORS: Record<NavId, string> = {
  note: '#EC4899',
  flow: '#A855F7',
  vault: '#10B981',
  connect: '#F59E0B',
  projects: '#F59E0B',
  tags: '#6366F1',
};

const NOTE_DETAIL_EXCLUDED = 'shared|landing|admin|pitch|popout|notes|extensions';

export function UnifiedLeftSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeContent } = useUnifiedDrawer();
  const { mode } = useAppChrome();
  const { isDrawerOpen } = useDrawerState();
  const { isOpen: isCallLauncherOpen } = useCallLauncher();
  const { isOpen: isOverlayOpen } = useOverlay();
  const { isCollapsed } = useSidebar();
  const { user, updatePreferences } = useAuth();

  const appContext = useMemo((): NavId | null => {
    if (pathname?.startsWith('/tags')) return 'tags';
    if (pathname?.startsWith('/projects')) return 'projects';
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/connect')) return 'connect';
    return null;
  }, [pathname]);

  const getCurrentTab = (): NavId | null => {
    if (pathname?.startsWith('/tags')) return 'tags';
    if (pathname?.startsWith('/projects')) return 'projects';
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/flow')) return 'flow';
    if (pathname?.startsWith('/vault')) return 'vault';
    if (pathname?.startsWith('/connect')) return 'connect';
    return null;
  };

  const handleNavChange = (navId: NavId) => {
    const routes: Record<NavId, string> = {
      note: '/app',
      flow: '/flow',
      vault: '/vault',
      connect: '/connect',
      projects: '/projects',
      tags: '/tags',
    };
    router.push(routes[navId] || '/app');
  };

  const isNoteFullPageDetail = Boolean(
    pathname?.match(new RegExp(`^/app/(?!${NOTE_DETAIL_EXCLUDED})[^/]+$`)),
  );
  const isConnectCallDetail = Boolean(pathname?.match(/^\/connect\/call\/[^/]+$/));
  const isConnectChatPage =
    pathname?.startsWith('/connect/chats') || pathname?.match(/^\/connect\/chat\/[^/]+$/);

  if (pathname?.startsWith('/accounts')) return null;

  if (
    isConnectChatPage ||
    mode === 'compact'
  ) return null;

  const currentTab = getCurrentTab();

  const navItems: { id: NavId; label: string; icon: typeof NotesIcon }[] = [
    { id: 'note', label: 'Ideas', icon: NotesIcon },
    { id: 'flow', label: 'Flow', icon: FlowIcon },
    { id: 'vault', label: 'Vault', icon: VaultIcon },
    { id: 'connect', label: 'Connect', icon: ConnectIcon },
    { id: 'projects', label: 'Workspaces', icon: ProjectsIcon },
  ];

  return (
    <Box
      component="nav"
      className="kylrix-sidebar"
      sx={{
        position: 'fixed',
        left: 0,
        top: '88px',
        bottom: 0,
        width: isCollapsed ? 80 : 240,
        zIndex: 1100,
        display: { xs: 'none', md: 'block' },
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          height: '100%',
          width: '100%',
          bgcolor: '#161412',
          backgroundImage: 'none',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: isCollapsed ? 'center' : 'stretch',
          py: 2.5,
          px: isCollapsed ? 0 : 2,
          boxSizing: 'border-box',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Stack spacing={2} sx={{ width: '100%', alignItems: isCollapsed ? 'center' : 'stretch' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isSelected = currentTab === item.id;
            const itemColor = NAV_COLORS[item.id];
            
            const itemContent = (
              <Box
                onClick={() => handleNavChange(item.id)}
                sx={{
                  position: 'relative',
                  width: isCollapsed ? 46 : '100%',
                  height: 46,
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  px: isCollapsed ? 0 : 2,
                  gap: isCollapsed ? 0 : 2,
                  cursor: 'pointer',
                  color: isSelected ? itemColor : 'rgba(255, 255, 255, 0.4)',
                  bgcolor: isSelected ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isSelected ? `1px solid ${itemColor}33` : '1px solid transparent',
                  boxSizing: 'border-box',
                  '&:hover': {
                    color: isSelected ? itemColor : '#fff',
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    transform: 'translateY(-1px)',
                    ...(isSelected ? {} : { borderColor: 'rgba(255,255,255,0.08)' }),
                  },
                  '&:active': {
                    transform: 'translateY(0px)',
                  },
                }}
              >
                {isSelected && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: isCollapsed ? -16 : 0,
                      width: 4,
                      height: 22,
                      borderRadius: '0 4px 4px 0',
                      bgcolor: itemColor,
                      boxShadow: `0 0 12px ${itemColor}`,
                    }}
                  />
                )}

                <Icon
                  size={20}
                  strokeWidth={1.5}
                  style={{
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    ...(isSelected && {
                      transform: 'scale(1.1)',
                      filter: `drop-shadow(0 0 6px ${itemColor}60)`,
                    }),
                  }}
                />

                {!isCollapsed && (
                  <span style={{ 
                    fontFamily: 'var(--font-satoshi)', 
                    fontWeight: isSelected ? 800 : 600, 
                    fontSize: '0.86rem',
                    letterSpacing: '0.01em'
                  }}>
                    {item.label}
                  </span>
                )}
              </Box>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={item.id} title={item.label} placement="right" arrow>
                  {itemContent}
                </Tooltip>
              );
            }

            return React.cloneElement(itemContent, { key: item.id });
          })}
        </Stack>

        {!user?.prefs?.discordJoined && (
          <Box sx={{ mt: 'auto', width: '100%', display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-start', px: isCollapsed ? 0 : 2 }}>
            <Tooltip title="Join our Discord Community" placement="right" arrow={isCollapsed}>
              <a
                href="https://discord.gg/YjF5yCBCmx"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (typeof updatePreferences === 'function') {
                    void updatePreferences({ discordJoined: true }).catch(() => {});
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: isCollapsed ? '0px' : '16px',
                  width: isCollapsed ? '46px' : '100%',
                  height: '46px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  color: 'rgba(255, 255, 255, 0.4)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(88, 101, 242, 0.2)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                  paddingLeft: isCollapsed ? '0px' : '16px',
                  paddingRight: isCollapsed ? '0px' : '16px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#5865F2';
                  e.currentTarget.style.backgroundColor = 'rgba(88, 101, 242, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(88, 101, 242, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                  e.currentTarget.style.borderColor = 'rgba(88, 101, 242, 0.2)';
                }}
              >
                <svg 
                  style={{ width: '20px', height: '20px', fill: 'currentColor', flexShrink: 0, transition: 'all 0.3s' }} 
                  viewBox="0 0 127.14 96.36"
                >
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36c2.65-3.6,5-7.46,7-11.5a68.88,68.88,0,0,1-11-5.26c.92-.68,1.82-1.39,2.69-2.13A75.14,75.14,0,0,0,96.5,77.47c.87.74,1.77,1.45,2.69,2.13a68.88,68.88,0,0,1-11,5.26c2,4,4.35,7.9,7,11.5a105.73,105.73,0,0,0,31-18.83C129,54.65,122.68,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.9,46,53.9,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.14,46,96.14,53,91,65.69,84.69,65.69Z"/>
                </svg>
                {!isCollapsed && (
                  <span style={{ 
                    fontFamily: 'var(--font-satoshi)', 
                    fontWeight: 600, 
                    fontSize: '0.86rem',
                    letterSpacing: '0.01em'
                  }}>
                    Join Discord
                  </span>
                )}
              </a>
            </Tooltip>
          </Box>
        )}
      </Paper>
    </Box>
  );
}

function Stack({ children, spacing, sx }: { children: React.ReactNode; spacing: number; sx?: any }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${spacing * 8}px`,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
