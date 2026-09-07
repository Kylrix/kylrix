'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function handleStartNewSession(bag: any) {
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
  formatHistoryMessages,
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
  loadSessionHistory,
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
  recordToolCall,
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
  toolsByConversation,
  touchStartPosRef,
  workflows
  } = bag as any;

    if (isWorkspaceReadOnly) {
      toast.error('Cannot start sessions in a view-only shared workspace. Switch to your personal workspace to create.');
      return;
    }
    try {
      if (user?.$id) {
        // 1. Scan LocalEngine and prune redundant empty sessions
        const { reusableSessionId } = await AgenticSessionLocalStore.findAndPruneEmptySessions(
          user.$id,
          activeSessionId
        );

        if (reusableSessionId) {
          setActiveSessionId(reusableSessionId);
          await AgenticSessionLocalStore.setActiveSessionId(user.$id, reusableSessionId);
          const local = await AgenticSessionLocalStore.getSession(reusableSessionId);
          setMessages((local?.chatHistory as any) || []);
          try {
            const { account } = await import('@/lib/appwrite/client');
            const prefs = await account.getPrefs().catch(() => ({}));
            await account.updatePrefs({ ...prefs, activeAgentSessionId: reusableSessionId }).catch(() => {});
          } catch {}
          toast.success('Switched to clean session.');
          return;
        }
      }

      // 2. Otherwise request fresh session from server action (which also reuses/prunes empty)
      const { startNewAgentSession } = await import('@/lib/actions/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      const res = await startNewAgentSession(jwt);
      if (res?.sessionId) {
        setActiveSessionId(res.sessionId);
        if (user?.$id) {
          await AgenticSessionLocalStore.setActiveSessionId(user.$id, res.sessionId);
        }
        if (activeWorkspace && !activeWorkspace.isPersonal) {
          void attachEntityToActiveWorkspace('agent_session', res.sessionId);
        }
      }
      setMessages([]);
      toast.success('Started a new conversation session.');
    } catch (err) {
      console.error('Failed to start new session:', err);
      toast.error('Could not start new session.');
    }
}
