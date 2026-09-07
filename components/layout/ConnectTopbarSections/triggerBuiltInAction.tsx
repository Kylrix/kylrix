'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {

export function triggerBuiltInAction(bag: any) {
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
  toggleNotifications,
  triggerBuiltInAction
  } = bag as any;

      switch (action) {
        case 'search':
          openSearch();
          break;
        case 'apps':
          setAppMenuAnchorEl(document.body);
          break;
        case 'profile':
          setProfileMenuAnchorEl(document.body);
          break;
        case 'agent':
          openAgenticFromTopbar();
          break;
        case 'hangouts':
          openUnified('hangouts');
          break;
        case 'moments':
          openUnified('moments');
          break;
        default:
          break;
      }
}
