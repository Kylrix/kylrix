'use client';

import React, { useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Box, Paper, Tooltip } from '@/lib/openbricks/primitives';
import {
  FileText as NotesIcon,
  Target as GoalsIcon,
  Lock as VaultIcon,
  GitFork as FlowIcon,
  Users as MomentsIcon,
  MessageCircleMore as HangoutIcon,
  Share2 as ShareIcon,
  MoreVertical as MoreIcon,
} from 'lucide-react';

import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useAuth } from '@/context/auth/AuthContext';
import { executeInstantShare } from '@/lib/share/instant-share';

type NavId = 'note' | 'goal' | 'vault' | 'connect' | 'moments' | 'hangout' | 'flow';

/** Same order + accents as UnifiedBottomBar: ideas → goals → vault → connect → flows */
const NAV_COLORS: Record<NavId, string> = {
  note: '#EC4899',
  goal: '#A855F7',
  vault: '#10B981',
  connect: '#F59E0B',
  moments: '#F59E0B',
  hangout: '#F59E0B',
  flow: '#A855F7',
};


import { useWorkspace } from '@/context/WorkspaceContext';
import { ChevronDown as WorkspaceChevronIcon, Plus as PlusIcon, Check as CheckIcon, Bot as BotIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { isFlowPath } from '@/lib/routing/app-paths';

export function UnifiedLeftSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const navPush = useCallback((href: string) => router.push(href), [router]);
  const { open: openUnified } = useUnifiedDrawer();
  const { } = useAppChrome();
  const { } = useDrawerState();
  const { isOpen: _isOverlayOpen } = useOverlay();
  const { isCollapsed } = useSidebar();
  const { user: _user, updatePreferences } = useAuth();
  const { activeWorkspace, workspaces, ownedWorkspaces, sharedWorkspaces, agentWorkspaces, setActiveWorkspaceId, markWorkspacePublic } = useWorkspace();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const [agentWorkspacesExpanded, setAgentWorkspacesExpanded] = React.useState(false);
  const workspaceSectionRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isCollapsed) setWorkspaceMenuOpen(false);
  }, [isCollapsed]);

  const handleShareWorkspace = useCallback(
    (e: React.MouseEvent, w: (typeof workspaces)[number]) => {
      e.stopPropagation();
      setWorkspaceMenuOpen(false);
      markWorkspacePublic(w.id);
      void executeInstantShare('project', w.id, {
        resourceTitle: w.title,
        isPublic: true,
        isGuest: true,
      });
      openUnified('share-context', {
        resourceType: 'project',
        resourceId: w.id,
        resourceTitle: w.title,
        isPublic: true,
        isGuest: true,
        accentColor: '#10B981',
      });
    },
    [markWorkspacePublic, openUnified]
  );

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const root = workspaceSectionRef.current;
      const target = event.target as Node | null;
      if (root && target && !root.contains(target)) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
    };
  }, [workspaceMenuOpen]);


  const getCurrentTab = (): NavId | null => {
    if (pathname?.startsWith('/app')) return 'note';
    if (pathname?.startsWith('/goals') || pathname?.startsWith('/events') || pathname?.startsWith('/goal')) return 'goal';
    if (pathname?.startsWith('/vault')) return 'vault';
    // Desktop split: /connect → moments, /connect/chats (+ chat) → hangout
    if (pathname?.startsWith('/connect/chats') || pathname?.startsWith('/connect/chat')) return 'hangout';
    if (pathname?.startsWith('/connect')) return 'moments';
    if (isFlowPath(pathname)) return 'flow';
    return null;
  };

  const handleNavChange = (navId: NavId) => {
    const routes: Record<NavId, string> = {
      note: '/app',
      goal: '/goals',
      vault: '/vault',
      connect: '/connect',
      moments: '/connect',
      hangout: '/connect/chats',
      flow: '/flows',
    };
    navPush(routes[navId] || '/app');
  };


  if (pathname?.startsWith('/accounts')) return null;

  const currentTab = getCurrentTab();

  const navItems: { id: NavId; label: string; icon: typeof NotesIcon }[] = [
    { id: 'note', label: 'Ideas', icon: NotesIcon },
    { id: 'goal', label: 'Goals', icon: GoalsIcon },
    { id: 'vault', label: 'Vault', icon: VaultIcon },
    { id: 'moments', label: 'Moments', icon: MomentsIcon },
    { id: 'hangout', label: 'Hangout', icon: HangoutIcon },
    { id: 'flow', label: 'Flows', icon: FlowIcon },
  ];

  return (
    <Box
      component="nav"
      className="kylrix-sidebar"
      sx={{
        width: isCollapsed ? 72 : 240,
        flexShrink: 0,
        height: 'calc(100vh - 96px)',
        position: 'fixed',
        top: '96px',
        left: 0,
        zIndex: 10,
        display: { xs: 'none', md: 'block' },
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'}}
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
          overflow: 'hidden',
          overflowY: 'hidden',
          overflowX: 'hidden',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'}}
      >
        {/* Workspace Switcher Header */}
        <Box sx={{ mb: 2, px: isCollapsed ? 0 : 0.5, width: '100%', flexShrink: 0, position: 'relative', zIndex: 2 }}>
          <Tooltip title={activeWorkspace?.title || 'Workspace'} placement="right">
            <Box
              onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
              sx={{
                width: '100%',
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                gap: 1,
                p: isCollapsed ? 1 : '10px 12px',
                borderRadius: '14px',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                minWidth: 0,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.06)',
                  borderColor: 'rgba(255, 255, 255, 0.12)'}}}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0, flex: 1 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    bgcolor: activeWorkspace?.isAgentic ? 'rgba(99, 102, 241, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: activeWorkspace?.isAgentic ? '#818CF8' : '#F59E0B',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 900,
                    fontSize: '0.8rem',
                    flexShrink: 0}}
                >
                  {activeWorkspace?.isAgentic ? <BotIcon size={14} color="#818CF8" /> : (activeWorkspace?.title || 'W').charAt(0).toUpperCase()}
                </Box>
                {!isCollapsed && (
                  <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                    <span
                      style={{
                        display: 'block',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        fontFamily: 'var(--font-satoshi)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {activeWorkspace?.title || 'Workspace'}
                    </span>
                    <span style={{ display: 'block', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 600, fontSize: '0.68rem', fontFamily: 'var(--font-satoshi)' }}>
                      {activeWorkspace?.isPersonal ? 'Default workspace' : activeWorkspace?.isAgentic ? 'Agent workspace' : 'Workspace'}
                    </span>
                  </Box>
                )}
              </Box>
              {!isCollapsed && (
                <WorkspaceChevronIcon
                  size={16}
                  style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    transition: 'transform 0.2s',
                    transform: workspaceMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    flexShrink: 0}}
                />
              )}
            </Box>
          </Tooltip>

          {/* Inline workspaces accordion list — pushes core nav items down */}
          {workspaceMenuOpen && !isCollapsed && (
            <Box
              sx={{
                mt: 1,
                mb: 1.5,
                p: 1,
                borderRadius: '16px',
                bgcolor: '#0A0908',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                maxHeight: 'min(280px, 35vh)',
                overflowY: 'auto',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
                <Box sx={{ px: 1, py: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Workspaces
                  </span>
                  <Box
                    onClick={() => {
                      setWorkspaceMenuOpen(false);
                      openUnified('new-project');
                    }}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      color: '#F59E0B',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      '&:hover': { textDecoration: 'underline' }}}
                  >
                    <PlusIcon size={12} /> New
                  </Box>
                </Box>
                {/* 1. Personal & Owned Workspaces */}
                {[
                  ...workspaces.filter((w) => w.isPersonal),
                  ...ownedWorkspaces,
                ].map((w) => {
                  const isActive = w.id === activeWorkspace?.id;
                  return (
                    <Box
                      key={w.id}
                      onClick={() => {
                        setActiveWorkspaceId(w.id);
                        setWorkspaceMenuOpen(false);
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        borderRadius: '10px',
                        cursor: 'pointer',
                        minWidth: 0,
                        bgcolor: isActive ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                        color: isActive ? '#F59E0B' : '#FFFFFF',
                        '&:hover': {
                          bgcolor: isActive ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                          color: isActive ? '#F59E0B' : '#fff'}}}
                    >
                      <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.78rem',
                            fontWeight: isActive ? 800 : 600,
                            fontFamily: 'var(--font-satoshi)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {w.title}
                        </span>
                        <span style={{ display: 'block', fontSize: '0.65rem', color: isActive ? 'rgba(245, 158, 11, 0.8)' : 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)' }}>
                          {w.isPersonal ? 'Default workspace' : 'Workspace'}
                        </span>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        {!w.isPersonal && (
                          <>
                            <Box
                              component="span"
                              onClick={(e: React.MouseEvent) => handleShareWorkspace(e, w)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 0.5,
                                borderRadius: '6px',
                                color: w.isPublic ? '#10B981' : 'rgba(255, 255, 255, 0.35)',
                                bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  color: w.isPublic ? '#10B981' : '#F59E0B',
                                  bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                                  transform: 'scale(1.08)',
                                },
                              }}
                              title={w.isPublic ? 'Public sharing enabled (click to manage)' : 'Share workspace'}
                            >
                              <ShareIcon size={13} />
                            </Box>
                            <Box
                              component="span"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                openUnified('project-settings', { project: w });
                              }}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 0.5,
                                borderRadius: '6px',
                                color: 'rgba(255, 255, 255, 0.35)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  color: '#FFFFFF',
                                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                                  transform: 'scale(1.08)',
                                },
                              }}
                              title="Workspace settings"
                            >
                              <MoreIcon size={13} />
                            </Box>
                          </>
                        )}
                        {isActive && <CheckIcon size={14} color="#F59E0B" style={{ flexShrink: 0 }} />}
                      </Box>
                    </Box>
                  );
                })}

                {/* 2. Shared Workspaces Section */}
                {sharedWorkspaces.length > 0 && (
                  <>
                    <Box sx={{ px: 1, pt: 1, pb: 0.25 }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Shared Workspaces
                      </span>
                    </Box>
                    {sharedWorkspaces.map((w) => {
                      const isActive = w.id === activeWorkspace?.id;
                      return (
                        <Box
                          key={w.id}
                          onClick={() => {
                            setActiveWorkspaceId(w.id);
                            setWorkspaceMenuOpen(false);
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            px: 1.5,
                            py: 1,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            minWidth: 0,
                            bgcolor: isActive ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                            color: isActive ? '#6366F1' : '#FFFFFF',
                            '&:hover': {
                              bgcolor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                              color: isActive ? '#6366F1' : '#fff'}}}
                        >
                          <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            <span
                              style={{
                                display: 'block',
                                fontSize: '0.78rem',
                                fontWeight: isActive ? 800 : 600,
                                fontFamily: 'var(--font-satoshi)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {w.title}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: isActive ? 'rgba(99, 102, 241, 0.8)' : 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)' }}>
                              {w.role ? `Shared (${w.role})` : 'Shared with you'}
                            </span>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Box
                              component="span"
                              onClick={(e: React.MouseEvent) => handleShareWorkspace(e, w)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 0.5,
                                borderRadius: '6px',
                                color: '#10B981',
                                bgcolor: 'rgba(16, 185, 129, 0.12)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  color: '#10B981',
                                  bgcolor: 'rgba(16, 185, 129, 0.22)',
                                  transform: 'scale(1.08)',
                                },
                              }}
                              title="Share workspace link"
                            >
                              <ShareIcon size={13} />
                            </Box>
                            <Box
                              component="span"
                              onClick={(e: React.MouseEvent) => handleShareWorkspace(e, w)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 0.5,
                                borderRadius: '6px',
                                color: 'rgba(255, 255, 255, 0.35)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  color: '#FFFFFF',
                                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                                  transform: 'scale(1.08)',
                                },
                              }}
                              title="More options"
                            >
                              <MoreIcon size={13} />
                            </Box>
                            {isActive && <CheckIcon size={14} color="#6366F1" style={{ flexShrink: 0 }} />}
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                )}

                {/* 3. Agent Workspaces Section (Expanded when active or toggled) */}
                {agentWorkspaces.length > 0 && (() => {
                  const isAgentSectionOpen = agentWorkspacesExpanded || Boolean(activeWorkspace?.isAgentic);
                  return (
                    <>
                      <Box
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          setAgentWorkspacesExpanded(!isAgentSectionOpen);
                        }}
                        sx={{
                          px: 1,
                          pt: 1,
                          pb: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          userSelect: 'none',
                          '&:hover span': { color: 'rgba(255,255,255,0.7)' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <BotIcon size={12} color="#818CF8" />
                          <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Agent Workspaces ({agentWorkspaces.length})
                          </span>
                        </Box>
                        <Box sx={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}>
                          {isAgentSectionOpen ? <WorkspaceChevronIcon size={12} /> : <ChevronRightIcon size={12} />}
                        </Box>
                      </Box>
                      {isAgentSectionOpen && agentWorkspaces.map((w) => {
                        const isActive = w.id === activeWorkspace?.id;
                        return (
                          <Box
                            key={w.id}
                            onClick={() => {
                              setActiveWorkspaceId(w.id);
                              setWorkspaceMenuOpen(false);
                            }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            px: 1.5,
                            py: 1,
                            borderRadius: '10px',
                            cursor: 'pointer',
                            minWidth: 0,
                            bgcolor: isActive ? 'rgba(99, 102, 241, 0.14)' : 'transparent',
                            color: isActive ? '#818CF8' : '#FFFFFF',
                            '&:hover': {
                              bgcolor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                              color: isActive ? '#818CF8' : '#fff',
                            },
                          }}
                        >
                          <Box sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                            <span
                              style={{
                                display: 'block',
                                fontSize: '0.78rem',
                                fontWeight: isActive ? 800 : 600,
                                fontFamily: 'var(--font-satoshi)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {w.title}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: isActive ? 'rgba(129, 140, 248, 0.8)' : 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)' }}>
                              Agent Workspace
                            </span>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                            <Box
                              component="span"
                              onClick={(e: React.MouseEvent) => handleShareWorkspace(e, w)}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 0.5,
                                borderRadius: '6px',
                                color: w.isPublic ? '#10B981' : 'rgba(255, 255, 255, 0.35)',
                                bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  color: w.isPublic ? '#10B981' : '#818CF8',
                                  bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                                  transform: 'scale(1.08)',
                                },
                              }}
                              title={w.isPublic ? 'Public sharing enabled (click to manage)' : 'Share workspace'}
                            >
                              <ShareIcon size={13} />
                            </Box>
                            <Box
                              component="span"
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation();
                                openUnified('project-settings', { project: w });
                              }}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 0.5,
                                borderRadius: '6px',
                                color: 'rgba(255, 255, 255, 0.35)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                  color: '#FFFFFF',
                                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                                  transform: 'scale(1.08)',
                                },
                              }}
                              title="Workspace settings"
                            >
                              <MoreIcon size={13} />
                            </Box>
                            {isActive && <CheckIcon size={14} color="#818CF8" style={{ flexShrink: 0 }} />}
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                );
              })()}
            </Box>
          )}
        </Box>

        <Stack
          spacing={1.25}
          sx={{
            width: '100%',
            alignItems: isCollapsed ? 'center' : 'stretch',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
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
                  color: isSelected ? itemColor : '#FFFFFF',
                  bgcolor: isSelected ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: isSelected ? `1px solid ${itemColor}33` : '1px solid transparent',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  '&:hover': {
                    color: isSelected ? itemColor : '#FFFFFF',
                    bgcolor: 'rgba(255, 255, 255, 0.06)',
                    transform: 'translateY(-1px)',
                    ...(isSelected ? {} : { borderColor: 'rgba(255,255,255,0.08)' })},
                  '&:active': {
                    transform: 'translateY(0px)'}}}
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
                      boxShadow: `0 0 12px ${itemColor}`}}
                  />
                )}

                <Icon
                  size={20}
                  strokeWidth={1.5}
                  style={{
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    ...(isSelected && {
                      transform: 'scale(1.1)',
                      filter: `drop-shadow(0 0 6px ${itemColor}60)`})}}
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

        <Box sx={{ mt: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 1, px: isCollapsed ? 0 : 0.5, flexShrink: 0, pt: 1.5 }}>
          {/* GitHub CTA */}
          <Tooltip title="View Source on GitHub" placement="right" arrow={isCollapsed}>
            <a
              href="https://github.com/Kylrix/kylrix"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: isCollapsed ? '0px' : '14px',
                width: isCollapsed ? '46px' : '100%',
                height: '40px',
                borderRadius: '12px',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.85)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                transition: 'all 0.25s ease',
                textDecoration: 'none',
                boxSizing: 'border-box',
                paddingLeft: isCollapsed ? '0px' : '14px',
                paddingRight: isCollapsed ? '0px' : '14px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <svg 
                style={{ width: '18px', height: '18px', fill: 'currentColor', flexShrink: 0 }} 
                viewBox="0 0 24 24"
              >
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              {!isCollapsed && (
                <span style={{ 
                  fontFamily: 'var(--font-satoshi)', 
                  fontWeight: 700, 
                  fontSize: '0.82rem',
                  letterSpacing: '0.01em',
                  color: '#FFFFFF',
                }}>
                  GitHub
                </span>
              )}
            </a>
          </Tooltip>

          {/* Discord CTA */}
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
                gap: isCollapsed ? '0px' : '14px',
                width: isCollapsed ? '46px' : '100%',
                height: '40px',
                borderRadius: '12px',
                cursor: 'pointer',
                color: '#FFFFFF',
                backgroundColor: 'rgba(88, 101, 242, 0.08)',
                border: '1px solid rgba(88, 101, 242, 0.28)',
                transition: 'all 0.25s ease',
                textDecoration: 'none',
                boxSizing: 'border-box',
                paddingLeft: isCollapsed ? '0px' : '14px',
                paddingRight: isCollapsed ? '0px' : '14px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.backgroundColor = 'rgba(88, 101, 242, 0.16)';
                e.currentTarget.style.borderColor = 'rgba(88, 101, 242, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#FFFFFF';
                e.currentTarget.style.backgroundColor = 'rgba(88, 101, 242, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(88, 101, 242, 0.28)';
              }}
            >
              <svg 
                style={{ width: '18px', height: '18px', fill: 'currentColor', flexShrink: 0, transition: 'all 0.3s' }} 
                viewBox="0 0 127.14 96.36"
              >
                <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36c2.65-3.6,5-7.46,7-11.5a68.88,68.88,0,0,1-11-5.26c.92-.68,1.82-1.39,2.69-2.13A75.14,75.14,0,0,0,96.5,77.47c.87.74,1.77,1.45,2.69,2.13a68.88,68.88,0,0,1-11,5.26c2,4,4.35,7.9,7,11.5a105.73,105.73,0,0,0,31-18.83C129,54.65,122.68,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.9,46,53.9,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.14,46,96.14,53,91,65.69,84.69,65.69Z"/>
              </svg>
              {!isCollapsed && (
                <span style={{ 
                  fontFamily: 'var(--font-satoshi)', 
                  fontWeight: 700, 
                  fontSize: '0.82rem',
                  letterSpacing: '0.01em',
                  color: '#FFFFFF',
                }}>
                  Join Discord
                </span>
              )}
            </a>
          </Tooltip>
        </Box>
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
        ...sx}}
    >
      {children}
    </Box>
  );
}
