'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {

export function renderProfilePanel(bag: any) {
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

    if (!profileMenuAnchorEl || !user) return null;

    const referralCode = profileUsername
      ? `u_${String(profileUsername).replace(/^@+/, '')}`
      : `id_${profileSeed.userId || ''}`;

    const primaryHandle = profileUsername ? `@${profileUsername}` : profileDisplayName;

    const profileBody = (
      <Box sx={{ display: 'grid', gap: 2, minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        {/* 1. Identity Tile */}
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.75,
            px: 2.25,
            py: 1.75,
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.03)',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Avatar slot */}
          <Box sx={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            <IdentityAvatar
              userId={user?.$id}
              size={48}
              pro={isPro}
              fallback={(profileUsername || profileDisplayName || 'U')[0].toUpperCase()}
            />
          </Box>

          {/* Stacked copy column */}
          <Box
            sx={{
              minWidth: 0,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              pr: 0.5,
            }}
          >
            <Box
              component="button"
              type="button"
              onClick={handleCopyUsername}
              title="Click to copy handle"
              sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0, bgcolor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', minWidth: 0, maxWidth: '100%' }}
            >
              <Typography
                component="span"
                sx={{
                  color: 'white',
                  fontWeight: 900,
                  fontSize: '0.98rem',
                  lineHeight: 1.25,
                  fontFamily: 'var(--font-clash)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                  flex: 1,
                  '&:hover': { color: '#818CF8' },
                }}
              >
                {primaryHandle}
              </Typography>
              <Box sx={{ p: 0.5, borderRadius: '6px', color: copyState === 'copied-username' ? '#10B981' : 'rgba(255,255,255,0.35)', bgcolor: copyState === 'copied-username' ? 'rgba(16,185,129,0.15)' : 'transparent', flexShrink: 0 }}>
                {copyState === 'copied-username' ? <Check size={13} /> : <CopyIcon size={13} />}
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
              <Box component="span" sx={{ fontSize: '9px', fontFamily: 'monospace', px: 1.25, py: 0.3, borderRadius: '999px', bgcolor: 'rgba(236,72,153,0.15)', color: '#EC4899', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, lineHeight: 1.2 }}>
                {currentTier} PLAN
              </Box>
              {profileUsername && profileDisplayName && profileDisplayName !== profileUsername && (
                <Typography component="span" sx={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>
                  {profileDisplayName}
                </Typography>
              )}
              {!profileUsername && (
                <Box
                  component="button"
                  type="button"
                  onClick={handleGenerateUsername}
                  disabled={isGeneratingUsername}
                  sx={{ px: 1.25, py: 0.3, borderRadius: '8px', bgcolor: 'rgba(99,102,241,0.2)', color: '#818cf8', fontSize: '10px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, lineHeight: 1.2 }}
                >
                  <Sparkles size={10} />
                  <span>{isGeneratingUsername ? '...' : 'Claim @name'}</span>
                </Box>
              )}
            </Box>
          </Box>

          {/* Close Action slot */}
          <IconButton onClick={handleCloseAll} size="small" sx={{ width: 30, height: 30, borderRadius: '999px', color: alpha('#fff', 0.6), bgcolor: alpha('#fff', 0.05), border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: 'white' } }}>
            <CloseIcon size={15} />
          </IconButton>
        </Box>

        {/* 2. Referral Outlined Tile */}
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            px: 2.25,
            py: 2,
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: 'rgba(255,255,255,0.03)',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, minWidth: 0, px: 0.5 }}>
            <Typography component="span" sx={{ color: 'rgba(255,255,255,0.65)', fontSize: '11px', fontWeight: 900, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1, overflow: 'hidden', lineHeight: 1.3 }}>
              <Users size={13} color="#10B981" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>Referral Link</span>
            </Typography>
            <Box component="span" sx={{ fontSize: '9.5px', fontFamily: 'monospace', color: '#10B981', bgcolor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', px: 1.25, py: 0.35, borderRadius: '6px', fontWeight: 800, flexShrink: 0, lineHeight: 1.2 }}>
              +1.5 $KYL / join
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              bgcolor: 'rgba(0,0,0,0.5)',
              px: 1.75,
              py: 1.25,
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.06)',
              minWidth: 0,
              maxWidth: '100%',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <Typography component="span" sx={{ color: 'rgba(255,255,255,0.9)', fontFamily: 'monospace', fontSize: '11.5px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, userSelect: 'all' }}>
              {typeof window !== 'undefined' ? `${window.location.host}/?ref=${referralCode}` : '/?ref=...'}
            </Typography>
            <Box
              component="button"
              type="button"
              onClick={handleCopyReferralLink}
              sx={{ px: 2.25, py: 0.75, borderRadius: '9px', fontSize: '11.5px', fontWeight: 900, color: 'white', bgcolor: copyState === 'copied-referral' ? '#10B981' : '#6366F1', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, transition: 'all 0.2s', flexShrink: 0, lineHeight: 1.2, '&:hover': { bgcolor: copyState === 'copied-referral' ? '#10B981' : '#5254E8' } }}
            >
              {copyState === 'copied-referral' ? <Check size={12} /> : <CopyIcon size={12} />}
              <span>{copyState === 'copied-referral' ? 'Copied' : 'Copy'}</span>
            </Box>
          </Box>
        </Box>

        {/* 3. Action Buttons (Wallet & Settings side-by-side, Sign Out below) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pt: 0.25, minWidth: 0, width: '100%' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, minWidth: 0, width: '100%' }}>
            <Button
              onClick={() => {
                handleCloseAll();
                openWallet();
              }}
              sx={{ minHeight: 46, borderRadius: '16px', bgcolor: alpha(appAccent, 0.08), border: `1px solid ${alpha(appAccent, 0.16)}`, color: appAccent, px: 2, py: 1.25, fontSize: '0.86rem', textTransform: 'none', fontWeight: 800, minWidth: 0, overflow: 'hidden', '&:hover': { bgcolor: alpha(appAccent, 0.15) } }}
              startIcon={<Wallet size={15} style={{ flexShrink: 0 }} />}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.3 }}>Wallet</span>
            </Button>
            <Button
              onClick={() => {
                handleCloseAll();
                router.push('/settings');
              }}
              sx={{ minHeight: 46, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.03)', color: 'white', border: '1px solid rgba(255,255,255,0.08)', px: 2, py: 1.25, fontSize: '0.86rem', textTransform: 'none', fontWeight: 800, minWidth: 0, overflow: 'hidden', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}
              startIcon={<Settings size={15} style={{ flexShrink: 0 }} />}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.3 }}>Settings</span>
            </Button>
          </Box>

          {!isPro && (
            <Button
              onClick={() => {
                handleCloseAll();
                openProUpgrade();
              }}
              sx={{ minHeight: 44, borderRadius: '16px', bgcolor: 'rgba(236,72,153,0.08)', color: '#EC4899', border: '1px solid rgba(236,72,153,0.22)', px: 2, py: 1.1, fontSize: '0.84rem', textTransform: 'none', fontWeight: 800, minWidth: 0, overflow: 'hidden', '&:hover': { bgcolor: 'rgba(236,72,153,0.15)' } }}
              startIcon={<Sparkles size={14} style={{ flexShrink: 0 }} />}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.3 }}>Upgrade to Pro</span>
            </Button>
          )}

          <Button
            onClick={() => {
              handleCloseAll();
              void logout();
            }}
            sx={{ minHeight: 46, borderRadius: '16px', bgcolor: 'rgba(255,77,77,0.06)', color: '#FF4D4D', border: '1px solid rgba(255,77,77,0.14)', px: 2, py: 1.25, fontSize: '0.86rem', textTransform: 'none', fontWeight: 800, minWidth: 0, overflow: 'hidden', '&:hover': { bgcolor: 'rgba(255,77,77,0.12)' } }}
            startIcon={<LogOut size={15} style={{ flexShrink: 0 }} />}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, lineHeight: 1.3 }}>Sign out</span>
          </Button>
        </Box>
      </Box>
    );

    if (isDesktop) {
      if (nativeSidebar) {
        return (
          <NativeSidebarMount
            active={Boolean(profileMenuAnchorEl)}
            sidebarKey="topbar-profile"
            width={380}
            title="Profile"
          >
            <Box sx={{ p: 2, overflowX: 'hidden', width: '100%', boxSizing: 'border-box' }}>
              {profileBody}
            </Box>
          </NativeSidebarMount>
        );
      }
      return (
        <Drawer
          anchor="right"
          open={Boolean(profileMenuAnchorEl)}
          onClose={() => setProfileMenuAnchorEl(null)}
          keepMounted={false}
          disablePortal={true}
          slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              backgroundImage: 'none',
              width: { xs: '100vw', sm: 380 },
              maxWidth: '100vw',
              borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
              height: '100vh',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflowX: 'hidden',
              p: { xs: 2, sm: 2.75 },
            }
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, color: '#fff', fontSize: '1.1rem' }}>
              Profile
            </Typography>
            <IconButton onClick={() => setProfileMenuAnchorEl(null)} sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: 'white' }, width: 32, height: 32 }}>
              <CloseIcon size={16} />
            </IconButton>
          </Box>

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: '100%',
              borderRadius: '26px',
              bgcolor: '#161412',
              border: `1px solid ${alpha(appAccent, 0.22)}`,
              overflow: 'hidden',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
            }}
          >
            <Box sx={{ p: { xs: 1.5, sm: 2 }, overflowY: 'auto', overflowX: 'hidden', flex: 1, boxSizing: 'border-box' }}>
              {profileBody}
            </Box>
          </Paper>
        </Drawer>
      );
    }

    return (
      <Box
        data-kylrix-topbar-panel
        sx={{
          width: '100%',
          maxWidth: '100vw',
          boxSizing: 'border-box',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '0 0 28px 28px',
          bgcolor: '#161412',
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
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
          sx={{ px: { xs: 1.5, sm: 2.25, md: 4 }, py: { xs: 1.5, sm: 2 }, maxHeight: '45vh', overflowY: 'auto', overflowX: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
        >
          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: '100%',
              borderRadius: '24px',
              bgcolor: '#161412',
              border: `1px solid ${alpha(appAccent, 0.22)}`,
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <Box sx={{ p: { xs: 1.5, sm: 2.25 }, overflowX: 'hidden', boxSizing: 'border-box' }}>
              {profileBody}
            </Box>
          </Paper>
        </Box>
      </Box>
    );
}
