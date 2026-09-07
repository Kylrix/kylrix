'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {

export function renderAppPanel(bag: any) {
  const {
  _isClient,
  _searchMode,
  _setDismissedHintId,
  activeApp,
  activePanel,
  agentWorkspacesExpanded,
  appAccent,
  appMenuAnchorEl,
  appPanelMotion,
  cachedIdentity,
  copyState,
  dismissedHintId,
  dynamicQuickActions,
  feedSearchResults,
  globalResults,
  groupedGlobalResults,
  handleCloseAll,
  handleCopyReferralLink,
  handleCopyUsername,
  handleGenerateUsername,
  handleGlobalShortcuts,
  headerRef,
  isDesktop,
  isDrawerExpanded,
  isGeneratingUsername,
  isMounted,
  isPro,
  localForms,
  localMoments,
  localTags,
  localTrash,
  localVaultCreds,
  localVaultTotp,
  nativeSidebar,
  navPush,
  notifHint,
  notificationsOpen,
  onPageResults,
  openAgenticFromTopbar,
  openAppMenu,
  openProfileMenu,
  openSearch,
  openSearchShortcuts,
  pathname,
  peopleResults,
  previewManager,
  profileAvatarUrl,
  profileDisplayName,
  profileMenuAnchorEl,
  profileName,
  profilePicId,
  profileSeed,
  profileUsername,
  rawUsername,
  renderAppPanel,
  renderNotificationDrawer,
  renderProfilePanel,
  renderSearchPanel,
  router,
  searchInputRef,
  searchOpen,
  searchQuery,
  searchShortcutsView,
  searchSurface,
  searchingPeople,
  setAgentWorkspacesExpanded,
  setAppMenuAnchorEl,
  setCopyState,
  setFeedSearchResults,
  setIsClient,
  setIsGeneratingUsername,
  setIsMounted,
  setLocalForms,
  setLocalMoments,
  setLocalTags,
  setLocalTrash,
  setLocalVaultCreds,
  setLocalVaultTotp,
  setNotifHint,
  setNotificationsOpen,
  setOnPageResults,
  setPeopleResults,
  setProfileAvatarUrl,
  setProfileMenuAnchorEl,
  setSearchMode,
  setSearchOpen,
  setSearchQuery,
  setSearchShortcutsView,
  setSearchingPeople,
  setShowWebMcpTopbar,
  showWebMcpTopbar,
  theme,
  toggleNotifications
  } = bag as any;

    if (!appMenuAnchorEl) return null;

    const workspaceSwitcher = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflowX: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5, width: '100%', minWidth: 0 }}>
          <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, color: '#9B9691', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Workspaces
          </Typography>
          <Button
            size="small"
            onClick={() => {
              handleCloseAll();
              openUnified('new-project');
            }}
            sx={{ color: '#6366F1', fontWeight: 800, fontSize: '0.75rem', textTransform: 'none', minWidth: 0, px: 1, py: 0.25, borderRadius: '8px', bgcolor: 'rgba(99, 102, 241, 0.1)', '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)' } }}
          >
            + New
          </Button>
        </Box>

        {loadingWorkspaces && workspaces.length <= 1 ? (
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', px: 0.5 }}>
            Loading workspaces…
          </Typography>
        ) : null}

        {/* 1. Personal & Owned Workspaces */}
        {[
          ...workspaces.filter((w) => w.isPersonal),
          ...ownedWorkspaces,
        ].map((w) => {
          const isActive = activeWorkspace?.id === w.id;
          return (
            <Box
              key={w.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveWorkspaceId(w.id);
                handleCloseAll();
              }}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveWorkspaceId(w.id);
                  handleCloseAll();
                }
              }}
              sx={{
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: { xs: 1.25, sm: 2 },
                py: 1.25,
                borderRadius: '14px',
                bgcolor: isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                border: '1px solid',
                borderColor: isActive ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                color: 'white',
                textAlign: 'left',
                cursor: 'pointer',
                minWidth: 0,
                overflow: 'hidden',
                '&:hover': {
                  bgcolor: isActive ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255,255,255,0.04)',
                },
              }}
            >
              <Box sx={{ minWidth: 0, flex: '1 1 0%', pr: 1, overflow: 'hidden' }}>
                <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: isActive ? '#6366F1' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%', width: '100%' }} noWrap>
                  {w.title}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%', width: '100%' }} noWrap>
                  {w.isPersonal ? 'Default workspace' : 'Workspace'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, flexGrow: 0 }}>
                {!w.isPersonal && (
                  <>
                    <IconButton
                      size="small"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleCloseAll();
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
                      }}
                      sx={{
                        color: w.isPublic ? '#10B981' : 'rgba(255, 255, 255, 0.35)',
                        bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                        p: 0.75,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: w.isPublic ? '#10B981' : '#6366F1',
                          bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.22)' : 'rgba(99, 102, 241, 0.15)',
                          transform: 'scale(1.08)',
                        },
                      }}
                      title={w.isPublic ? 'Public sharing enabled (click to manage)' : 'Share workspace'}
                    >
                      <ShareIcon size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleCloseAll();
                        openUnified('project-settings', { project: w });
                      }}
                      sx={{
                        color: 'rgba(255, 255, 255, 0.35)',
                        p: 0.75,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: '#FFFFFF',
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          transform: 'scale(1.08)',
                        },
                      }}
                      title="Workspace settings"
                    >
                      <MoreIcon size={14} />
                    </IconButton>
                  </>
                )}
                {isActive ? (
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6366F1', boxShadow: '0 0 8px #6366F1', flexShrink: 0 }} />
                ) : null}
              </Box>
            </Box>
          );
        })}

        {/* 2. Shared Workspaces Section */}
        {sharedWorkspaces.length > 0 && (
          <>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', px: 1, pt: 1 }}>
              Shared Workspaces
            </Typography>
            {sharedWorkspaces.map((w) => {
              const isActive = activeWorkspace?.id === w.id;
              return (
                <Box
                  key={w.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setActiveWorkspaceId(w.id);
                    handleCloseAll();
                  }}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveWorkspaceId(w.id);
                      handleCloseAll();
                    }
                  }}
                  sx={{
                    width: '100%',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: { xs: 1.25, sm: 2 },
                    py: 1.25,
                    borderRadius: '14px',
                    bgcolor: isActive ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid',
                    borderColor: isActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.15)',
                    color: 'white',
                    textAlign: 'left',
                    cursor: 'pointer',
                    minWidth: 0,
                    overflow: 'hidden',
                    '&:hover': {
                      bgcolor: isActive ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255,255,255,0.04)',
                    },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: '1 1 0%', pr: 1, overflow: 'hidden' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: isActive ? '#6366F1' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%', width: '100%' }} noWrap>
                      {w.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(99, 102, 241, 0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%', width: '100%' }} noWrap>
                      {w.role ? `Shared (${w.role})` : 'Shared with you'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, flexGrow: 0 }}>
                    <IconButton
                      size="small"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleCloseAll();
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
                      }}
                      sx={{
                        color: '#10B981',
                        bgcolor: 'rgba(16, 185, 129, 0.12)',
                        p: 0.75,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: '#10B981',
                          bgcolor: 'rgba(16, 185, 129, 0.22)',
                          transform: 'scale(1.08)',
                        },
                      }}
                      title="Share workspace link"
                    >
                      <ShareIcon size={14} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        handleCloseAll();
                        openUnified('share-context', {
                          resourceType: 'project',
                          resourceId: w.id,
                          resourceTitle: w.title,
                          isPublic: true,
                          isGuest: true,
                          accentColor: '#10B981',
                        });
                      }}
                      sx={{
                        color: 'rgba(255, 255, 255, 0.35)',
                        p: 0.75,
                        borderRadius: '8px',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          color: '#FFFFFF',
                          bgcolor: 'rgba(255, 255, 255, 0.1)',
                          transform: 'scale(1.08)',
                        },
                      }}
                      title="More options"
                    >
                      <MoreIcon size={14} />
                    </IconButton>
                    {isActive ? (
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#6366F1', boxShadow: '0 0 8px #6366F1', flexShrink: 0 }} />
                    ) : null}
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
                role="button"
                tabIndex={0}
                onClick={() => setAgentWorkspacesExpanded(!isAgentSectionOpen)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setAgentWorkspacesExpanded(!isAgentSectionOpen);
                  }
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 1,
                  pt: 1.5,
                  pb: 0.5,
                  cursor: 'pointer',
                  userSelect: 'none',
                  '&:hover p': { color: 'rgba(255,255,255,0.7)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Bot size={12} color="#818CF8" />
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Agent Workspaces ({agentWorkspaces.length})
                  </Typography>
                </Box>
                <Box sx={{ color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}>
                  {isAgentSectionOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </Box>
              </Box>
              {isAgentSectionOpen && agentWorkspaces.map((w) => {
                const isActive = activeWorkspace?.id === w.id;
                return (
                  <Box
                    key={w.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setActiveWorkspaceId(w.id);
                      handleCloseAll();
                    }}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveWorkspaceId(w.id);
                        handleCloseAll();
                      }
                    }}
                    sx={{
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: { xs: 1.25, sm: 2 },
                      py: 1.25,
                      borderRadius: '14px',
                      bgcolor: isActive ? 'rgba(99, 102, 241, 0.16)' : 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid',
                      borderColor: isActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(99, 102, 241, 0.15)',
                      color: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      minWidth: 0,
                      overflow: 'hidden',
                      '&:hover': {
                        bgcolor: isActive ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255,255,255,0.04)',
                      },
                    }}
                  >
                    <Box sx={{ minWidth: 0, flex: '1 1 0%', pr: 1, overflow: 'hidden' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: isActive ? '#818CF8' : '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%', width: '100%' }} noWrap>
                        {w.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'rgba(129, 140, 248, 0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: '100%', width: '100%' }} noWrap>
                        Agent Workspace
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0, flexGrow: 0 }}>
                      <IconButton
                        size="small"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          handleCloseAll();
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
                            accentColor: '#818CF8',
                          });
                        }}
                        sx={{
                          color: w.isPublic ? '#10B981' : 'rgba(255, 255, 255, 0.35)',
                          bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                          p: 0.75,
                          borderRadius: '8px',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            color: w.isPublic ? '#10B981' : '#818CF8',
                            bgcolor: w.isPublic ? 'rgba(16, 185, 129, 0.22)' : 'rgba(99, 102, 241, 0.15)',
                            transform: 'scale(1.08)',
                          },
                        }}
                        title={w.isPublic ? 'Public sharing enabled (click to manage)' : 'Share workspace'}
                      >
                        <ShareIcon size={14} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          handleCloseAll();
                          openUnified('project-settings', { project: w });
                        }}
                        sx={{
                          color: 'rgba(255, 255, 255, 0.35)',
                          p: 0.75,
                          borderRadius: '8px',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            color: '#FFFFFF',
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                            transform: 'scale(1.08)',
                          },
                        }}
                        title="Workspace settings"
                      >
                        <MoreIcon size={14} />
                      </IconButton>
                      {isActive ? (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#818CF8', boxShadow: '0 0 8px #818CF8', flexShrink: 0 }} />
                      ) : null}
                    </Box>
                  </Box>
                );
              })}
            </>
          );
        })()}
      </Box>
    );

    const githubCta = (
      <a
        href="https://github.com/Kylrix/kylrix"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleCloseAll()}
        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-all font-satoshi text-xs font-bold text-white/90 min-w-0 flex-1 overflow-hidden"
      >
        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
        <span className="truncate">GitHub</span>
      </a>
    );

    const discordCta = !user?.prefs?.discordJoined ? (
      <a
        href="https://discord.gg/YjF5yCBCmx"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          handleCloseAll();
          if (typeof updatePreferences === 'function') {
            void updatePreferences({ discordJoined: true }).catch(() => {});
          }
        }}
        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl border border-[#5865F2]/20 bg-[#5865F2]/5 hover:bg-[#5865F2]/10 transition-all font-satoshi text-xs font-bold text-[#5865F2] min-w-0 flex-1 overflow-hidden"
      >
        <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 127.14 96.36">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36c2.65-3.6,5-7.46,7-11.5a68.88,68.88,0,0,1-11-5.26c.92-.68,1.82-1.39,2.69-2.13A75.14,75.14,0,0,0,96.5,77.47c.87.74,1.77,1.45,2.69,2.13a68.88,68.88,0,0,1-11,5.26c2,4,4.35,7.9,7,11.5a105.73,105.73,0,0,0,31-18.83C129,54.65,122.68,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.9,46,53.9,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.14,46,96.14,53,91,65.69,84.69,65.69Z"/>
        </svg>
        <span className="truncate">Discord</span>
      </a>
    ) : null;

    const ecosystemBody = (
      <Box sx={{ display: 'grid', gap: 1.5, width: '100%', minWidth: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: discordCta ? '1fr 1fr' : '1fr', gap: 1.25, width: '100%', minWidth: 0 }}>
          {githubCta}
          {discordCta}
        </Box>
        {workspaceSwitcher}
      </Box>
    );

    if (isDesktop) {
      if (nativeSidebar) {
        return (
          <NativeSidebarMount
            active={Boolean(appMenuAnchorEl)}
            sidebarKey="topbar-ecosystem"
            width={380}
            title="Ecosystem"
          >
            <Box sx={{ p: 2 }}>
              {ecosystemBody}
            </Box>
          </NativeSidebarMount>
        );
      }
      return (
        <Drawer
          anchor="left"
          open={Boolean(appMenuAnchorEl)}
          onClose={() => setAppMenuAnchorEl(null)}
          keepMounted={false}
          disablePortal={true}
          slotProps={{
            backdrop: {
              sx: {
                top: `88px`,
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                bgcolor: 'rgba(0,0,0,0.4)'
              }
            }
          }}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              width: 340,
              height: '100vh',
              borderRight: '1px solid rgba(255, 255, 255, 0.06)',
              p: 2.75,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'}
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.75 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
              Ecosystem
            </Typography>
            <IconButton onClick={() => setAppMenuAnchorEl(null)} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              borderRadius: '26px',
              bgcolor: '#161412',
              border: `1px solid ${alpha(appAccent, 0.22)}`,
              overflow: 'hidden',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ p: 1.25, overflowY: 'auto', flex: 1 }}>
              {ecosystemBody}
            </Box>
          </Paper>
        </Drawer>
      );
    }

    return (
      <motion.div
        key="app-panel"
        initial={appPanelMotion.initial}
        animate={appPanelMotion.animate}
        exit={appPanelMotion.exit}
        transition={appPanelMotion.transition}
        style={{ width: '100%', maxWidth: '100vw', overflowX: 'hidden', transformOrigin: 'top center' }}
      >
        <Box
          data-kylrix-topbar-panel
          sx={{
            width: '100%',
            maxWidth: '100vw',
            bgcolor: '#161412',
            overflowX: 'hidden',
            overflowY: 'hidden',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '0 0 28px 28px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            boxSizing: 'border-box',
          }}
        >
          <Box
            onWheel={(event: React.WheelEvent) => {
              const node = event.currentTarget;
              if (event.deltaY < 0 && isTopbarScrollAtTop(node as HTMLElement)) {
                event.preventDefault();
                handleCloseAll();
              }
            }}
            sx={{ px: { xs: 1.5, sm: 2.25, md: 4 }, py: 1.25, maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
          >
            <Paper
              elevation={0}
              sx={{
                width: '100%',
                maxWidth: '100%',
                borderRadius: '26px',
                bgcolor: '#161412',
                border: `1px solid ${alpha(appAccent, 0.22)}`,
                overflowX: 'hidden',
                overflowY: 'hidden',
                boxSizing: 'border-box',
              }}
            >
              <Box sx={{ p: { xs: 1.25, sm: 2 }, width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 1.25 }}>
                  <IconButton onClick={handleCloseAll} size="small" sx={{ width: 28, height: 28, borderRadius: '999px', color: alpha('#fff', 0.6), bgcolor: alpha('#fff', 0.05), border: '1px solid rgba(255,255,255,0.06)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}>
                    <CloseIcon size={14} />
                  </IconButton>
                </Box>
                {ecosystemBody}
              </Box>
            </Paper>
          </Box>
        </Box>
      </motion.div>
    );
}
