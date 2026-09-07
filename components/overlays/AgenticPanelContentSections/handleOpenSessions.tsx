'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function handleOpenSessions(bag: any) {
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

    setShowSessionsDrawer(true);
    let hadLocal = false;
    if (user?.$id) {
      // Clean up any empty duplicates before listing
      await AgenticSessionLocalStore.findAndPruneEmptySessions(user.$id, activeSessionId);
      const local = await AgenticSessionLocalStore.getSessionsList(user.$id);
      if (local.length) {
        hadLocal = true;
        setSessions(local);
      }
    }
    setLoadingSessions(!hadLocal);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }
    try {
      const { listAgentSessions } = await import('@/lib/actions/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      const list = await listAgentSessions(jwt);
      setSessions(list);
      if (user?.$id) await AgenticSessionLocalStore.setSessionsList(user.$id, list);
    } catch (err) {
      console.error(err);
      if (!sessions.length) toast.error('Failed to load sessions list');
    } finally {
      setLoadingSessions(false);
    }
}
