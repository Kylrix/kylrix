'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function handleSelectSession(bag: any) {
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

    try {
      const local = await AgenticSessionLocalStore.getSession(sessionId);
      if (local?.chatHistory?.length) {
        setActiveSessionId(sessionId);
        if (user?.$id) await AgenticSessionLocalStore.setActiveSessionId(user.$id, sessionId);
        setMessages(
          local.chatHistory.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            blocks: m.blocks,
            syncStatus: m.syncStatus || 'synced',
            isPublic: m.isPublic,
            isGuest: m.isGuest,
            nextSteps: m.nextSteps})));
        setShowSessionsDrawer(false);
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      }

      const { selectAgentSession, listAgentToolCallsAction } = await import('@/lib/actions/agentic');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      const res = await selectAgentSession(sessionId, jwt);
      if (res.success) {
        setActiveSessionId(sessionId);
        if (user?.$id) await AgenticSessionLocalStore.setActiveSessionId(user.$id, sessionId);
        const historyArr = JSON.parse(res.session.chatHistory || '[]');
        const toolCalls = await listAgentToolCallsAction(sessionId, jwt).catch(() => []);
        const formatted = formatHistoryMessages(historyArr, toolCalls);
        setMessages(formatted);
        if (user?.$id) {
          await AgenticSessionLocalStore.upsertSession({
            id: sessionId,
            userId: user.$id,
            chatHistory: formatted.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              blocks: m.blocks,
              syncStatus: m.syncStatus || 'synced',
              isPublic: m.isPublic,
              isGuest: m.isGuest,
              nextSteps: m.nextSteps})),
            isPublic: res.session.isPublic,
            isGuest: res.session.isGuest,
            isPinned: res.session.isPinned,
            createdAt: res.session.createdAt,
            updatedAt: res.session.updatedAt});
        }
        setShowSessionsDrawer(false);
        toast.success('Switched agent session.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to select session');
    }
}
