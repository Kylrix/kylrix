'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function handleToggleSessionPinned(bag: any) {
  const {
  accent,
  activeSessionId,
  agentCount,
  appendMessage,
  chatInput,
  chatScrollRef,
  clearSessionLongPress,
  composerHints,
  composerLongPressTimerRef,
  composerMenuItems,
  composerMenuOpen,
  executing,
  handleApprovePayment,
  handleComposerClear,
  handleComposerCopyAll,
  handleComposerKeyDown,
  handleComposerPaste,
  handleComposerSelectAll,
  handleComposerTouchEnd,
  handleComposerTouchMove,
  handleComposerTouchStart,
  handleCopyMessage,
  handleCreateNewSessionFromDrawer,
  handleDeleteSession,
  handleExportSession,
  handleInputChange,
  handleMessageTouchEnd,
  handleMessageTouchMove,
  handleMessageTouchStart,
  handleOpenSessions,
  handleRetryMessage,
  handleSelectSession,
  handleShareSession,
  handleStartConversationFromPrompt,
  handleStartNewSession,
  handleSubmit,
  handleToggleSessionPinned,
  handleWorkflow,
  isPro,
  isWorkspaceReadOnly,
  loadingSessions,
  longPressTimerRef,
  messageMenuItems,
  messageMenuTarget,
  messages,
  openComposerMenu,
  openMessageMenu,
  openSessionActionsDrawer,
  pageContext,
  pathname,
  pendingObject,
  pendingPayment,
  pendingToolAuth,
  raw,
  recordSessionObject,
  router,
  runPrompt,
  runningWorkflowId,
  selectedSessionActionTarget,
  sessionLongPressTimerRef,
  sessions,
  setActiveSessionId,
  setAgentCount,
  setChatInput,
  setComposerMenuOpen,
  setExecuting,
  setLoadingSessions,
  setMessageMenuTarget,
  setMessages,
  setPendingObject,
  setPendingPayment,
  setPendingToolAuth,
  setRunningWorkflowId,
  setSelectedSessionActionTarget,
  setSessions,
  setShowSessionActionsDrawer,
  setShowSessionsDrawer,
  setSigning,
  showSessionActionsDrawer,
  showSessionsDrawer,
  signing,
  syncTimeoutRef,
  textareaRef,
  touchStartPosRef,
  workflows
  } = bag as any;

    try {
      const { setAgentSessionPinnedAction } = await import('@/lib/actions/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      await setAgentSessionPinnedAction(sessionId, pinned, jwt);
      const nextSessions = sessions
        .map((s) => (s.id === sessionId ? { ...s, isPinned: pinned } : s))
        .sort((a, b) => {
          const pinDelta = Number(b.isPinned === true) - Number(a.isPinned === true);
          if (pinDelta !== 0) return pinDelta;
          return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
        });
      setSessions(nextSessions);
      if (user?.$id) {
        await AgenticSessionLocalStore.patchSessionMeta(user.$id, sessionId, { isPinned: pinned });
      }
      toast.success(pinned ? 'Session pinned.' : 'Session unpinned.');
    } catch (err) {
      console.error(err);
      toast.error('Could not update pin state');
    }
}
