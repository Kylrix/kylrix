'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {

export function renderSearchPanel(bag: any) {
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

    if (!searchOpen) return null;

    const query = searchQuery.trim().toLowerCase();
    const hasQuery = query.length >= 2;

    const searchContent = (
      <Box
        onWheel={(event: React.WheelEvent) => {
          if (isDesktop) return;
          const node = event.currentTarget;
          if (event.deltaY < 0 && isTopbarScrollAtTop(node as HTMLElement)) {
            event.preventDefault();
            handleCloseAll();
          }
        }}
        sx={{
          width: '100%',
          px: isDesktop ? 0 : { xs: 1, sm: 2 },
          py: isDesktop ? 1 : 1.25,
          flex: isDesktop ? 'none' : 1,
          minHeight: 0,
          maxHeight: isDesktop ? 'none' : 'calc(60dvh - 120px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <Stack spacing={2.5}>
              {searchShortcutsView ? (
            <Box sx={{ display: 'grid', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#fff' }}>
                    <Keyboard size={16} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1rem', lineHeight: 1.1 }}>
                      Keyboard shortcuts
                    </Typography>
                    <Typography sx={{ color: '#fff', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Quick keys
                    </Typography>
                  </Box>
                </Box>
                <Button
                  onClick={() => setSearchShortcutsView(false)}
                  sx={{
                    minWidth: 0,
                    borderRadius: '12px',
                    bgcolor: '#161412',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    px: 1.5,
                    py: 0.75,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    textTransform: 'none',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', color: '#fff' }}}
                >
                  Back to search
                </Button>
              </Box>
              {renderShortcutsList()}
            </Box>
          ) : !hasQuery ? (
            <>
              {/* Keyboard shortcuts — top so keys are easy to find */}
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Keyboard shortcuts
                </Typography>
                <Box
                  component="button"
                  onClick={openSearchShortcuts}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 2,
                    py: 1.5,
                    borderRadius: '16px',
                    bgcolor: '#161412',
                    border: '2px solid rgba(255, 255, 255, 0.22)',
                    color: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.04)',
                      borderColor: 'rgba(255,255,255,0.4)',
                      transform: 'translateX(2px)'}}}
                >
                  <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#fff', flexShrink: 0 }}>
                    <Keyboard size={15} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    <Typography component="span" sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }}>
                      View all shortcuts
                    </Typography>
                    <Typography component="span" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.72rem', lineHeight: 1.3 }}>
                      Quick keys · Ctrl+F to search
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Applications section */}
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Apps
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25 }}>
                  {[
                    { name: 'note', label: 'Ideas', color: '#EC4899', href: '/app', Icon: FileText },
                    { name: 'goals', label: 'Goals', color: '#A855F7', href: '/goals', Icon: Target },
                    { name: 'vault', label: 'Vault', color: '#10B981', href: '/vault', Icon: Lock },
                    { name: 'connect', label: 'Connect', color: '#F59E0B', href: '/connect', Icon: MessageCircle },
                    { name: 'tags', label: 'Tags', color: '#F87171', action: () => openUnified('tags'), Icon: TagIcon },
                    { name: 'trash', label: 'Trash', color: '#EF4444', action: () => openUnified('trash'), Icon: TrashIcon },
                  ].map((app) => {
                    const AppIcon = app.Icon;
                    return (
                    <ButtonBase
                      key={app.name}
                      onClick={() => {
                        handleCloseAll();
                        if (app.action) {
                          app.action();
                        } else if (app.href) {
                          router.push(app.href);
                        }
                      }}
                      sx={{
                        borderRadius: '16px',
                        bgcolor: '#161412',
                        border: '2px solid rgba(255, 255, 255, 0.22)',
                        px: 2,
                        py: 1.75,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 1.25,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.04)',
                          borderColor: alpha(app.color, 0.4),
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <Box sx={{ width: 34, height: 34, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: `${app.color}18`, color: app.color }}>
                        <AppIcon size={16} strokeWidth={2} />
                      </Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.82rem' }}>
                        {app.label}
                      </Typography>
                    </ButtonBase>
                    );
                  })}
                </Box>
              </Box>

              {/* Quick Actions */}
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Quick Actions
                </Typography>
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Box
                    component="button"
                    onClick={() => {
                      handleCloseAll();
                      router.push('/flows');
                    }}
                    sx={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.25,
                      px: 2,
                      py: 1.5,
                      borderRadius: '16px',
                      bgcolor: '#161412',
                      border: '2px solid rgba(255, 255, 255, 0.22)',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.04)',
                        borderColor: 'rgba(168, 85, 247, 0.4)',
                        transform: 'translateX(2px)'}}}
                  >
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(168, 85, 247, 0.15)', color: '#A855F7', flexShrink: 0 }}>
                      <GitFork size={15} strokeWidth={2} />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography component="span" sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }}>
                        Workflows
                      </Typography>
                      <Typography component="span" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.72rem', lineHeight: 1.3 }}>
                        Open flows and automations
                      </Typography>
                    </Box>
                  </Box>

                  {/* Rest of the dynamic quick actions */}
                  {dynamicQuickActions.filter(a => a.id !== 'hist-note' && a.id !== 'hist-flow').map((action) => (
                    <Box
                      key={action.id}
                      component="button"
                      onClick={() => {
                        handleCloseAll();
                        router.push(action.href);
                      }}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 2,
                        py: 1.5,
                        borderRadius: '16px',
                        bgcolor: '#161412',
                        border: '2px solid rgba(255, 255, 255, 0.22)',
                        color: '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255,255,255,0.04)',
                          borderColor: 'rgba(255,255,255,0.4)',
                          transform: 'translateX(2px)'
                        }
                      }}
                    >
                      <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}18`, color: action.accent, flexShrink: 0 }}>
                        {action.kind === 'note' ? (
                          <FileText size={15} strokeWidth={2} />
                        ) : action.kind === 'vault' ? (
                          <Lock size={15} strokeWidth={2} />
                        ) : action.kind === 'connect' ? (
                          <MessageCircle size={15} strokeWidth={2} />
                        ) : action.kind === 'flow' ? (
                          <GitFork size={15} strokeWidth={2} />
                        ) : (
                          <Sparkles size={15} strokeWidth={2} />
                        )}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Typography component="span" sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                          {action.title}
                        </Typography>
                        <Typography component="span" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.72rem', lineHeight: 1.3 }}>
                          {action.description}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </>
          ) : (
            /* Results View */
            <Box sx={{ display: 'grid', gap: 2 }}>
              {/* Live Feed Moments Results */}
              {feedSearchResults.length > 0 && (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    Feed Moments · {feedSearchResults.length}
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {feedSearchResults.map((moment) => (
                      <Box
                        key={moment.$id || moment.id}
                        component="button"
                        onClick={() => {
                          handleCloseAll();
                          const mid = String(moment.$id || moment.id || '');
                          if (!mid) return;
                          openMomentObjectDetail({
                            momentId: mid,
                            source: 'ecosystem',
                            preview: {
                              authorName: moment.userName || moment.username,
                              content: moment.caption || moment.content,
                            },
                            openSidebar,
                            openOverlay,
                            closeSidebar,
                            closeOverlay,
                          });
                        }}
                        sx={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          px: 2,
                          py: 1.5,
                          borderRadius: '16px',
                          bgcolor: '#161412',
                          border: '2px solid rgba(255, 255, 255, 0.22)',
                          color: '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)', borderColor: 'rgba(245, 158, 11, 0.5)' }
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography component="span" sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                            {moment.userName || moment.user?.name || moment.username || 'Moment'}
                          </Typography>
                          <Typography component="span" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.72rem', lineHeight: 1.3 }} noWrap>
                            {moment.caption || moment.content || 'Shared an update'}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Global LocalEngine Results — miniature cards, desktop uses sidebar grid */}
              {globalResults.length > 0 && (
                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  {Object.entries(groupedGlobalResults).map(([kind, items]) => (
                    <Box key={kind} sx={{ display: 'grid', gap: 0.75 }}>
                      <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                        {kind} · {items.length}
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr' }}>
                        {items.slice(0, isDesktop ? 6 : 4).map((r) => (
                          <Box
                            key={`${r.kind}-${r.id}`}
                            component="button"
                            onClick={() => {
                              handleCloseAll();
                              if (r.kind === 'note' && r.raw) {
                                const noteItem = r.raw;
                                setActiveDetail({ type: 'note', id: r.id, data: noteItem });
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                const NoteDetailSidebarComp = require('@/components/ui/NoteDetailSidebar').NoteDetailSidebar;
                                if (isWide) {
                                  openSidebar(
                                    <NoteDetailSidebarComp note={noteItem} onClose={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <NoteDetailSidebarComp note={noteItem} onClose={closeOverlay} />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'goal') {
                                selectTask(r.id);
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                const GoalObjectDetailComp = require('@/components/objects/GoalObjectDetail').GoalObjectDetail;
                                if (isWide) {
                                  openSidebar(
                                    <GoalObjectDetailComp taskId={r.id} embedded onClose={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <GoalObjectDetailComp taskId={r.id} onClose={closeOverlay} embedded />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'moment') {
                                const MomentObjectDetailComp = require('@/components/objects/MomentObjectDetail').MomentObjectDetail;
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                const source = r.raw?.source || (r.id.startsWith('nostr_') ? 'nostr' : 'internal');
                                const cleanId = r.id.replace(/^nostr_/, '');
                                const preview = r.raw ? {
                                  authorName: r.raw.authorName || r.raw.author?.name || r.raw.authorUsername,
                                  authorAvatar: r.raw.authorAvatar || r.raw.author?.avatar,
                                  content: r.raw.content || r.raw.caption,
                                } : undefined;
                                if (isWide) {
                                  openSidebar(
                                    <MomentObjectDetailComp momentId={cleanId} source={source} embedded preview={preview} onClose={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <MomentObjectDetailComp momentId={cleanId} source={source} preview={preview} onClose={closeOverlay} embedded />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'chat' || r.kind === 'thread') {
                                const CommObjectDetailComp = require('@/components/objects/CommObjectDetail').CommObjectDetail;
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                const commKind = r.kind === 'thread' ? 'thread' : 'chat';
                                if (isWide) {
                                  openSidebar(
                                    <CommObjectDetailComp conversationId={r.id} kind={commKind} embedded title={r.title} onClose={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <CommObjectDetailComp conversationId={r.id} kind={commKind} title={r.title} onClose={closeOverlay} embedded />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'event') {
                                const EventDetailsComp = require('@/components/events/EventDetails').default;
                                const isWide = typeof window !== 'undefined' && window.innerWidth >= 900;
                                if (isWide) {
                                  openSidebar(
                                    <EventDetailsComp eventId={r.id} initialData={r.raw} onClose={closeSidebar} onBack={closeSidebar} />,
                                    r.id,
                                    { hideHeader: true }
                                  );
                                } else {
                                  openOverlay(
                                    <EventDetailsComp eventId={r.id} initialData={r.raw} onClose={closeOverlay} onBack={closeOverlay} />
                                  );
                                }
                                return;
                              }
                              if (r.kind === 'tag') {
                                openUnified('tags', { tagId: r.id });
                                return;
                              }
                              if (r.kind === 'trash') {
                                openUnified('trash');
                                return;
                              }
                              navPush(r.href);
                            }}
                            sx={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.25,
                              px: 2,
                              py: 1.35,
                              borderRadius: '16px',
                              bgcolor: '#161412',
                              border: '2px solid rgba(255, 255, 255, 0.22)',
                              color: '#fff',
                              textAlign: 'left',
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.4)' },
                            }}
                          >
                            <Box sx={{ width: 30, height: 30, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: `${r.accent}22`, color: r.accent, flexShrink: 0, fontSize: '0.72rem', fontWeight: 900 }}>
                              {r.kind[0].toUpperCase()}
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.15 }}>
                              <Typography component="span" sx={{ color: '#fff', fontWeight: 800, fontSize: '0.84rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.title}
                              </Typography>
                              <Typography component="span" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.72rem', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {r.subtitle || r.kind}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
              {globalResults.length === 0 && searchQuery.trim().length >= 2 && !searchingPeople && (
                <Typography sx={{ color: '#fff', fontSize: '0.84rem', px: 0.5, fontWeight: 500 }}>No local matches — try people or check spelling.</Typography>
              )}

              {/* On-Page Results Matches */}
              {onPageResults.length > 0 && (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    On-Page Matches ({onPageResults.length})
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 0.75 }}>
                    {onPageResults.map((match, idx) => (
                      <Box
                        key={idx}
                        component="button"
                        onClick={() => {
                          handleCloseAll();
                          highlightElement(match.element);
                        }}
                        sx={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.25,
                          px: 2,
                          py: 1.5,
                          borderRadius: '16px',
                          bgcolor: '#161412',
                          border: '2px solid rgba(255, 255, 255, 0.22)',
                          color: '#fff',
                          textAlign: 'left',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.4)' }
                        }}
                      >
                        <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#fff', flexShrink: 0 }}>
                          <Search size={15} />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                          <Typography component="span" sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                            {match.text}
                          </Typography>
                          <Typography component="span" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            element: &lt;{match.tag}&gt;
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* People Search Results */}
              {(searchingPeople || peopleResults.length > 0) && (
                <Box sx={{ display: 'grid', gap: 0.75 }}>
                  <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                    People
                  </Typography>
                  {searchingPeople ? (
                    <Typography sx={{ color: '#fff', fontSize: '0.8rem', px: 0.5, fontWeight: 500 }}>
                      Searching users...
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 0.75 }}>
                      {peopleResults.slice(0, 3).map((person) => (
                        <Box
                          key={person.$id || person.id}
                          component="button"
                          onClick={() => {
                            const username = person.username || person.prefs?.username;
                            if (username) {
                              stageProfileView(person, person.avatar || null);
                              handleCloseAll();
                              router.push(`/u/${encodeURIComponent(username.replace(/^@+/, ''))}?transition=profile`);
                            }
                          }}
                          sx={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.25,
                            px: 2,
                            py: 1.5,
                            borderRadius: '16px',
                            bgcolor: '#161412',
                            border: '2px solid rgba(255, 255, 255, 0.22)',
                            color: '#fff',
                            textAlign: 'left',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.4)' }
                          }}
                        >
                          <IdentityAvatar
                            userId={person.userId || person.$id}
                            size={36}
                            fallback={(person.displayName || person.name || String(person.username || 'U').replace(/^@+/, '') || 'U')[0].toUpperCase()}
                            borderRadius="10px"
                          />
                          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                            <Typography component="span" sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                              {person.displayName || person.name}
                            </Typography>
                            <Typography component="span" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.72rem', lineHeight: 1.3 }} noWrap>
                              @{String(person.username || person.prefs?.username || 'user').replace(/^@+/, '')}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              )}

              {/* Fallback Search Targets */}
              <Box sx={{ display: 'grid', gap: 0.75 }}>
                <Typography sx={{ color: '#fff', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5 }}>
                  Ecosystem Search
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr' : { xs: '1fr', sm: '1fr 1fr' }, gap: 0.75 }}>
                  {searchSurface.searchTargets.slice(0, 4).map((action) => (
                    <Box
                      key={action.id}
                      component="button"
                      onClick={() => {
                        handleCloseAll();
                        router.push(action.href);
                      }}
                      sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 2,
                        py: 1.5,
                        borderRadius: '16px',
                        bgcolor: '#161412',
                        border: '2px solid rgba(255, 255, 255, 0.22)',
                        color: '#fff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.4)' }
                      }}
                    >
                      <Box sx={{ width: 36, height: 36, borderRadius: '10px', display: 'grid', placeItems: 'center', bgcolor: `${action.accent}18`, color: action.accent, flexShrink: 0 }}>
                        <Logo app={action.kind as any} size={15} variant="icon" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Typography component="span" sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem', lineHeight: 1.2 }} noWrap>
                          {action.title}
                        </Typography>
                        <Typography component="span" sx={{ color: '#fff', fontWeight: 500, fontSize: '0.72rem', lineHeight: 1.3 }} noWrap>
                          {action.description}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
        </Stack>
      </Box>
    );

    if (isDesktop) {
      if (nativeSidebar) {
        return (
          <NativeSidebarMount
            active={searchOpen}
            sidebarKey="topbar-search"
            width={560}
            title="Search"
          >
            <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#000000', boxSizing: 'border-box' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                  Search
                </Typography>
                <IconButton onClick={handleCloseAll} sx={{ color: '#fff', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' }, width: 30, height: 30 }}>
                  <CloseIcon size={15} />
                </IconButton>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: '#161412',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  px: 2,
                  py: 1.25,
                  mb: 2.5,
                  transition: 'all 0.15s ease',
                  '&:focus-within': {
                    borderColor: '#6366F1',
                    boxShadow: '0 0 0 1px #6366F1',
                  }
                }}
              >
                <Search size={16} style={{ color: '#fff', marginRight: 10, flexShrink: 0 }} />
                <InputBase
                  inputRef={searchInputRef}
                  value={searchQuery}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
                  placeholder="Search globally..."
                  fullWidth
                  autoFocus
                  sx={{
                    color: '#fff',
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    '& input::placeholder': { color: '#fff', opacity: 0.4 }}}
                  onKeyDown={(event: React.KeyboardEvent) => {
                    if (event.key === 'Escape') handleCloseAll();
                  }}
                />
                {searchQuery && (
                  <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: '#fff', ml: 0.5, p: 0.25 }}>
                    <CloseIcon size={13} />
                  </IconButton>
                )}
              </Box>
              <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{searchContent}</Box>
            </Box>
          </NativeSidebarMount>
        );
      }
      return (
        <Drawer
          anchor="right"
          open={searchOpen}
          onClose={handleCloseAll}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#000000',
              width: 480,
              height: '100vh',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box'}
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
              Search
            </Typography>
            <IconButton onClick={handleCloseAll} sx={{ color: '#fff', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' }, width: 30, height: 30 }}>
              <CloseIcon size={15} />
            </IconButton>
          </Box>
          
          {/* Search Input for Desktop */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#161412',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              px: 2,
              py: 1.25,
              mb: 2.5,
              transition: 'all 0.15s ease',
              '&:focus-within': {
                borderColor: '#6366F1',
                boxShadow: '0 0 0 1px #6366F1',
              }
            }}
          >
            <Search size={16} style={{ color: '#fff', marginRight: 10, flexShrink: 0 }} />
            <InputBase
              inputRef={searchInputRef}
              value={searchQuery}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
              placeholder="Search globally..."
              fullWidth
              autoFocus
              sx={{
                color: '#fff',
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 600,
                fontSize: '0.88rem',
                '& input::placeholder': { color: '#fff', opacity: 0.4 }}}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key === 'Escape') {
                  handleCloseAll();
                } else if (event.key === 'Enter' && searchQuery.trim()) {
                  const query = searchQuery.trim();
                  // In feed search mode or in connect routes: apply filter directly to live feed and close search drawer instantly
                  if (typeof window !== 'undefined') {
                    const words = query.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || [];
                    if (words.length) {
                      void import('@/lib/connect/feed-settings').then(({ recordFeedInteraction }) => {
                        recordFeedInteraction({ topics: words, searchWeight: 3 });
                      });
                    }
                    window.dispatchEvent(new CustomEvent('kylrix:feed-search-submit', { detail: { query } }));
                  }
                  handleCloseAll();
                }
              }}
            />
            {searchQuery && (
              <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: '#fff', ml: 0.5, p: 0.25 }}>
                <CloseIcon size={13} />
              </IconButton>
            )}
          </Box>
          
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {searchContent}
          </Box>
        </Drawer>
      );
    }

    return (
      <Box
        data-kylrix-topbar-panel
        data-note-search-surface="true"
        sx={{
          width: '100%',
          maxWidth: '100vw',
          maxHeight: '60dvh',
          display: 'flex',
          flexDirection: 'column',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          borderBottom: '2px solid rgba(255,255,255,0.25)',
          borderRadius: '0 0 28px 28px',
          bgcolor: '#000000',
          overflow: 'hidden',
          boxShadow: '0 16px 42px rgba(0,0,0,0.6)',
          p: { xs: 2, sm: 2.5 },
          boxSizing: 'border-box',
        }}
      >
        {/* Mobile Search Header & Input */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1.5, px: { xs: 0.5, sm: 1 }, shrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '8px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
                <Logo app={activeApp} size={14} variant="icon" />
              </Box>
              <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '0.95rem' }}>
                Search
              </Typography>
            </Box>
            <IconButton onClick={handleCloseAll} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: 'white' }, width: 28, height: 28 }}>
              <CloseIcon size={14} />
            </IconButton>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: '#161412',
              border: '2px solid rgba(255, 255, 255, 0.22)',
              borderRadius: '16px',
              px: 2,
              py: 1,
              mx: { xs: 0.5, sm: 1 },
              boxSizing: 'border-box',
              transition: 'all 0.15s ease',
              '&:focus-within': {
                borderColor: '#6366F1',
                boxShadow: '0 0 0 1px #6366F1',
              }
            }}
          >
            <Search size={16} style={{ color: '#fff', opacity: 0.8, marginRight: 10, flexShrink: 0 }} />
            <InputBase
              id="topbar-search-field"
              inputRef={searchInputRef}
              value={searchQuery}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(event.target.value)}
              placeholder="Search globally..."
              fullWidth
              autoFocus
              sx={{
                color: '#fff',
                fontFamily: 'var(--font-satoshi)',
                fontWeight: 600,
                fontSize: '0.88rem',
                '& input': { px: 0.5, py: 0.25 },
                '& input::placeholder': { color: '#fff', opacity: 0.45 }}}
              onKeyDown={(event: React.KeyboardEvent) => {
                if (event.key === 'Escape') {
                  handleCloseAll();
                }
              }}
            />
            {searchQuery && (
              <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5, p: 0.25 }}>
                <CloseIcon size={13} />
              </IconButton>
            )}
          </Box>
        </Box>
        {searchContent}
      </Box>
    );
}
