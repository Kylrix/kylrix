'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Fab,
  Typography,
  Backdrop,
  Zoom,
  alpha,
  useMediaQuery,
  useTheme,
} from '@/lib/openbricks/primitives';
import { Plus, X, Trash2, Pin, CheckSquare } from 'lucide-react';
import { useFAB } from '@/context/FABContext';
import { useSelection } from '@/context/SelectionContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useNotes } from '@/context/NotesContext';
import { useTask } from '@/context/TaskContext';
import { useEvents } from '@/context/EventsContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useAuth } from '@/context/auth/AuthContext';
import { useSudo } from '@/context/SudoContext';
import toast from 'react-hot-toast';
import { usePathname } from 'next/navigation';
import { useLocalContext } from '@/lib/context-engine';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { isFlowPath, isWorkspacesPath, isGoalsSurfacePath } from '@/lib/routing/app-paths';

const FAB_BOTTOM = {
  landing: 32,
  app: { xs: 'calc(104px + env(safe-area-inset-bottom))', md: 32 }} as const;

export default function UniversalFAB() {
  const { config } = useFAB();
  const selection = useSelection();
  const { removeNote, pinNote, unpinNote, isPinned: checkNotePinned } = useNotes();
  const { deleteTask, togglePinTask } = useTask();
  const { removeEvent } = useEvents();
  const { togglePin } = useResourcePins();
  const { user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { requestSudo } = useSudo();
  const { isDrawerOpen } = useDrawerState();
  const { isOpen: isAgenticDrawerOpen } = useAgenticDrawer();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  const [_isProcessing, setIsProcessing] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {} = useLocalContext();

  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      let maxScroll = scrollY;
      const scrollables = document.querySelectorAll('main, [data-scrollable="true"], .overflow-y-auto');
      scrollables.forEach((el) => {
        if (el instanceof HTMLElement && el.scrollTop > maxScroll) {
          maxScroll = el.scrollTop;
        }
      });
      if (maxScroll > 180) {
        setIsScrolling(true);
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 2500);
      } else {
        setIsScrolling(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true });
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [pathname]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
    const scrollables = document.querySelectorAll('main, [data-scrollable="true"], .overflow-y-auto');
    scrollables.forEach((el) => {
      if (el instanceof HTMLElement) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
    setIsScrolling(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kylrix:refresh-feed'));
    }
  }, []);


  const isLandingPage = pathname === '/';

  const isAppRoute = pathname && (
    isWorkspacesPath(pathname) ||
    pathname.startsWith('/app') ||
    isFlowPath(pathname) ||
    isGoalsSurfacePath(pathname) ||
    pathname.startsWith('/vault') ||
    (pathname.startsWith('/connect') && !pathname.includes('/invite/'))
  );

  if (isDrawerOpen || isAgenticDrawerOpen) return null;
  // Desktop: no FABs — actions live in native page chrome / sidebars.
  if (isDesktop) return null;
  if (!config.isVisible && !isAppRoute) return null;

  const actions = config.actions || [];
  const mainIcon = config.mainIcon;
  const mainColor = config.mainColor || '#6366F1';
  const onMainClick = config.onMainClick;

  const fabBottom = isLandingPage
    ? FAB_BOTTOM.landing
    : FAB_BOTTOM.app;

  const anchorSx = {
    position: 'fixed' as const,
    bottom: fabBottom,
    right: { xs: 16, md: 32 },
    zIndex: 1505,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: 1.5,
    pointerEvents: 'none' as const};

  const childPointerEvents = { pointerEvents: 'auto' as const };

  if (selection.isSelectMode) {
    const count = selection.selectedIds.length;
    const kindLabel = selection.activeKind === 'credential' ? 'secret' : selection.activeKind || 'item';

    const handleDeleteSelected = async () => {
      if (count === 0) return;
      const performDelete = async () => {
        setIsProcessing(true);
        toast.loading(`Deleting ${count} ${kindLabel}(s)...`, { id: 'fab-bulk-delete' });
        try {
          const { autonomicSyncEngine } = await import('@/lib/services/sync-engine');
          const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
          const db = await getRxDB().catch(() => null);

          for (const id of selection.selectedIds) {
            autonomicSyncEngine.cancelPending(id);
            if (db) {
              db.cache.findOne(`goal_${id}`).remove().catch(() => {});
              db.cache.findOne(`note_${id}`).remove().catch(() => {});
              db.notes.findOne(id).remove().catch(() => {});
            }

            if (selection.activeKind === 'note') {
              removeNote(id);
              try {
                const { deleteNote } = await import('@/lib/actions/client-ops');
                await deleteNote(id).catch(() => null);
              } catch {}
            } else if (selection.activeKind === 'goal' || selection.activeKind === 'task') {
              deleteTask(id);
              try {
                const { tasks } = await import('@/lib/kylrixflow');
                await tasks.delete(id).catch(() => null);
              } catch {}
            } else if (selection.activeKind === 'event') {
              removeEvent(id);
              try {
                const { events } = await import('@/lib/kylrixflow');
                await events.delete(id).catch(() => null);
              } catch {}
            } else if (selection.activeKind === 'credential') {
              try {
                const { deleteCredential } = await import('@/lib/appwrite');
                await deleteCredential(id).catch(() => null);
              } catch {}
            } else if (selection.activeKind === 'totp') {
              try {
                const { deleteTotp } = await import('@/lib/appwrite');
                await deleteTotp(id).catch(() => null);
              } catch {}
            }
          }

          toast.success(`Deleted ${count} ${kindLabel}(s)!`, { id: 'fab-bulk-delete' });
          selection.exitSelectMode();
        } catch (err: any) {
          toast.error(`Delete failed: ${err.message}`, { id: 'fab-bulk-delete' });
        } finally {
          setIsProcessing(false);
        }
      };

      if (selection.activeKind === 'credential' || selection.activeKind === 'totp') {
        requestSudo({
          onSuccess: () => {
            openUnified('delete-confirm', {
              title: `Delete ${count} ${kindLabel}(s)?`,
              description: `This will permanently remove ${count} ${kindLabel}(s) from your vault.`,
              confirmLabel: `Delete (${count})`,
              onConfirm: performDelete,
            });
          },
        });
      } else {
        openUnified('delete-confirm', {
          title: `Delete ${count} ${kindLabel}(s)?`,
          description: `This will remove ${count} ${kindLabel}(s) from your active view.`,
          confirmLabel: `Delete (${count})`,
          onConfirm: performDelete,
        });
      }
    };

    const handleTogglePinSelected = async () => {
      if (count === 0) return;
      setIsProcessing(true);
      toast.loading(`Updating pins...`, { id: 'fab-bulk-pin' });
      try {
        for (const id of selection.selectedIds) {
          if (selection.activeKind === 'note') {
            const isPin = checkNotePinned(id);
            if (isPin) await unpinNote(id).catch(() => {});
            else await pinNote(id).catch(() => {});
          } else if (selection.activeKind === 'goal' || selection.activeKind === 'task') {
            await togglePinTask(id).catch(() => {});
          } else if (selection.activeKind === 'event') {
            await togglePin({
              resourceType: 'event',
              resourceId: id,
              ownerId: user?.$id || 'guest',
              rowIsPinned: false,
              setOwnerRowPin: async () => {},
            }).catch(() => {});
          }
        }
        toast.success(`Updated pins for ${count} item(s)`, { id: 'fab-bulk-pin' });
        selection.exitSelectMode();
      } catch (err: any) {
        toast.error(`Pin update failed: ${err.message}`, { id: 'fab-bulk-pin' });
      } finally {
        setIsProcessing(false);
      }
    };

    const selectionActions = [
      {
        id: 'done-select',
        label: 'DONE',
        icon: <X size={20} />,
        onClick: () => selection.exitSelectMode(),
      },
      {
        id: 'pin-select',
        label: 'PIN / UNPIN',
        icon: <Pin size={20} className="text-[#F59E0B]" />,
        onClick: handleTogglePinSelected,
      },
      {
        id: 'delete-select',
        label: `DELETE (${count})`,
        icon: <Trash2 size={20} className="text-[#FF453A]" />,
        onClick: handleDeleteSelected,
      },
    ];

    return (
      <>
        <Backdrop open={isExpanded} onClick={() => setIsExpanded(false)} />

        <Box sx={anchorSx}>
          {selectionActions.map((action, index) => {
            const delay = `${index * 0.055}s`;
            return (
              <Box
                key={action.id}
                component="button"
                type="button"
                onClick={() => {
                  action.onClick();
                  setIsExpanded(false);
                }}
                aria-label={action.label}
                sx={{
                  ...childPointerEvents,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 0.5,
                  py: 0.25,
                  border: 'none',
                  background: 'transparent',
                  cursor: isExpanded ? 'pointer' : 'default',
                  textAlign: 'right',
                  opacity: isExpanded ? 1 : 0,
                  visibility: isExpanded ? 'visible' : 'hidden',
                  pointerEvents: isExpanded ? 'auto' : 'none',
                  transform: isExpanded ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.9)',
                  transition: `opacity 0.32s ease ${delay}, transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}, visibility 0.32s ${delay}`}}
              >
                <Box
                  sx={{
                    px: 1.75,
                    py: 1,
                    borderRadius: '12px',
                    bgcolor: 'rgba(10, 10, 10, 0.94)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)'}}
                >
                  <Typography
                    component="span"
                    sx={{
                      color: '#FFFFFF',
                      fontWeight: 800,
                      fontSize: '0.72rem',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      display: 'block'}}
                  >
                    {action.label}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '16px',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    bgcolor: '#0A0908',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.88)',
                    boxShadow: '0 10px 28px rgba(0,0,0,0.5)',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                    '&:active': { transform: 'scale(0.92)' }}}
                >
                  {action.icon}
                </Box>
              </Box>
            );
          })}

          <Fab
            onClick={() => setIsExpanded((open) => !open)}
            aria-label={isExpanded ? 'Close selection menu' : 'Open selection options'}
            sx={{
              ...childPointerEvents,
              width: 64,
              height: 64,
              bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.08)' : '#10B981',
              color: isExpanded ? '#fff' : '#000',
              borderRadius: '20px',
              border: isExpanded ? '1px solid rgba(255, 255, 255, 0.18)' : 'none',
              boxShadow: isExpanded ? '0 12px 40px rgba(0,0,0,0.55)' : `0 10px 34px ${alpha('#10B981', 0.45)}`,
              transform: isExpanded ? 'rotate(0deg)' : 'none',
              transition: 'all 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
              '&:active': { transform: 'scale(0.94)' }}}
          >
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
                transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'}}
            >
              {isExpanded ? <X size={28} strokeWidth={2} /> : <CheckSquare size={28} strokeWidth={2} />}
            </Box>
          </Fab>
        </Box>
      </>
    );
  }

  const chevronUpIcon = (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  );

  if (onMainClick) {
    return (
      <Box sx={anchorSx}>
        <Zoom in>
          <Fab
            onClick={isScrolling ? scrollToTop : onMainClick}
            aria-label={isScrolling ? 'Back to top' : 'Add'}
            title={isScrolling ? 'Back to top' : 'Add'}
            sx={{
              ...childPointerEvents,
              width: 56,
              height: 56,
              bgcolor: isScrolling ? '#10B981' : mainColor,
              color: '#000000',
              borderRadius: '16px',
              border: isScrolling ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(0,0,0,0.12)',
              boxShadow: isScrolling ? '0 10px 34px rgba(16, 185, 129, 0.45)' : '0 8px 24px rgba(0,0,0,0.45)',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              '&:hover': {
                bgcolor: isScrolling ? '#10B981' : mainColor,
                transform: 'translateY(-2px)',
                boxShadow: isScrolling ? '0 12px 38px rgba(16, 185, 129, 0.55)' : '0 10px 28px rgba(0,0,0,0.5)',
              },
              '&:active': { transform: 'scale(0.96)' },
            }}
          >
            {isScrolling ? chevronUpIcon : (mainIcon || <Plus size={26} strokeWidth={2.5} />)}
          </Fab>
        </Zoom>
      </Box>
    );
  }

  const speedDialActions = actions;

  return (
    <>
      <Backdrop open={isExpanded} onClick={() => setIsExpanded(false)} />

      <Box sx={anchorSx}>
        {speedDialActions.map((action, index) => {
          const delay = `${index * 0.055}s`;
          return (
            <Box
              key={action.id}
              component="button"
              type="button"
              onClick={() => {
                action.onClick();
                setIsExpanded(false);
              }}
              aria-label={action.label}
              sx={{
                ...childPointerEvents,
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: 0.5,
                py: 0.25,
                border: 'none',
                background: 'transparent',
                cursor: isExpanded ? 'pointer' : 'default',
                textAlign: 'right',
                opacity: isExpanded ? 1 : 0,
                visibility: isExpanded ? 'visible' : 'hidden',
                pointerEvents: isExpanded ? 'auto' : 'none',
                transform: isExpanded ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.9)',
                transition: `opacity 0.32s ease ${delay}, transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}, visibility 0.32s ${delay}`}}
            >
              <Box
                sx={{
                  px: 1.75,
                  py: 1,
                  borderRadius: '12px',
                  bgcolor: 'rgba(10, 10, 10, 0.94)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.45)'}}
              >
                <Typography
                  component="span"
                  sx={{
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.72rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    display: 'block'}}
                >
                  {action.label}
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '16px',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  bgcolor: '#0A0908',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.88)',
                  boxShadow: '0 10px 28px rgba(0,0,0,0.5)',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  '&:active': { transform: 'scale(0.92)' }}}
              >
                {action.icon}
              </Box>
            </Box>
          );
        })}

        <Fab
          onClick={() => {
            if (isExpanded) {
              setIsExpanded(false);
            } else if (isScrolling) {
              scrollToTop();
            } else {
              setIsExpanded((open) => !open);
            }
          }}
          aria-label={isExpanded ? 'Close actions' : isScrolling ? 'Back to top' : 'Open actions'}
          title={isExpanded ? 'Close actions' : isScrolling ? 'Back to top' : 'Open actions'}
          sx={{
            ...childPointerEvents,
            width: 64,
            height: 64,
            bgcolor: isExpanded ? 'rgba(255, 255, 255, 0.08)' : isScrolling ? '#10B981' : mainColor,
            color: isExpanded ? '#fff' : '#000',
            borderRadius: '20px',
            border: isExpanded ? '1px solid rgba(255, 255, 255, 0.18)' : isScrolling ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
            boxShadow: isExpanded ? '0 12px 40px rgba(0,0,0,0.55)' : isScrolling ? '0 12px 40px rgba(16, 185, 129, 0.55)' : `0 10px 34px ${alpha(mainColor, 0.45)}`,
            transform: isExpanded ? 'rotate(0deg)' : 'none',
            transition: 'all 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)',
            '&:active': { transform: 'scale(0.94)' }}}
        >
          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
              transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)'}}
          >
            {isExpanded ? (
              <X size={28} strokeWidth={2} />
            ) : isScrolling ? (
              chevronUpIcon
            ) : (
              mainIcon || <Plus size={28} strokeWidth={2} />
            )}
          </Box>
        </Fab>
      </Box>
    </>
  );
}
