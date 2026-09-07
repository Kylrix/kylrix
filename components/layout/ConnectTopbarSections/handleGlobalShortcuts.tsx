'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {

export function handleGlobalShortcuts(bag: any) {
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

      if (!event.ctrlKey && !event.metaKey) return;
      
      const key = event.key.toLowerCase();

      // Leave Ctrl/Cmd+A for native select-all — never bind or preventDefault it.
      if (key === 'a') return;

      if (event.shiftKey && key === 'v') {
        event.preventDefault();
        handleCloseAll();
        router.push('/vault');
        return;
      }
      
      // Load user-defined custom shortcuts if any
      let customShortcuts: any[] = [];
      try {
        const stored = localStorage.getItem('user-shortcuts');
        if (stored) customShortcuts = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse user-shortcuts:', e);
      }

      const customMatch = customShortcuts.find(
        (s: any) => s.key.toLowerCase() === key && (s.ctrlKey ?? true)
      );

      if (customMatch) {
        event.preventDefault();
        handleCloseAll();
        if (customMatch.action === 'navigate' && customMatch.targetUrl) {
          router.push(customMatch.targetUrl);
        } else if (customMatch.action === 'custom') {
          window.dispatchEvent(new CustomEvent('custom-shortcut-triggered', { detail: customMatch }));
        } else {
          triggerBuiltInAction(customMatch.action);
        }
        return;
      }

      // Default system shortcuts
      const builtInActions: Record<string, string> = {
        f: 'search',
        k: 'agent',
        s: 'apps',
        u: 'profile',
        p: '/app',
        n: '/app',
        t: '/tags',
        x: '/settings',
        g: '/goals',
        q: '/forms',
        e: '/events',
        h: 'hangouts',
        m: 'moments',
      };

      const action = builtInActions[key];
      if (action) {
        event.preventDefault();
        handleCloseAll();
        if (action.startsWith('/')) {
          router.push(action);
        } else {
          triggerBuiltInAction(action);
        }
      }
}
