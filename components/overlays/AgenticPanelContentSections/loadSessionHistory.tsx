'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function loadSessionHistory(bag: any) {
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

      if (!user?.$id) return;
      try {
        const activeId = await AgenticSessionLocalStore.getActiveSessionId(user.$id);
        if (activeId) {
          const localSession: any = await AgenticSessionLocalStore.getSession(activeId);
          if (localSession?.chatHistory?.length && !localSession?.targetType && !localSession?.targetId) {
            setActiveSessionId(activeId);
            setMessages(
              localSession.chatHistory.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                blocks: m.blocks,
                syncStatus: m.syncStatus || 'synced',
                isPublic: m.isPublic,
                isGuest: m.isGuest,
                nextSteps: m.nextSteps})));
          } else if (localSession?.targetType) {
            // Active is object sidekick — find latest general session instead
            const list = await AgenticSessionLocalStore.getSessionsList(user.$id);
            const general = list.find((s: any) => !s.targetType && !s.targetId);
            if (general) {
              const genSession: any = await AgenticSessionLocalStore.getSession(general.id);
              if (genSession?.chatHistory?.length) {
                setActiveSessionId(general.id);
                setMessages(
                  genSession.chatHistory.map((m: any) => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    blocks: m.blocks,
                    syncStatus: m.syncStatus || 'synced',
                    isPublic: m.isPublic,
                    isGuest: m.isGuest,
                    nextSteps: m.nextSteps})));
                await AgenticSessionLocalStore.setActiveSessionId(user.$id, general.id);
                try {
                  const { account } = await import('@/lib/appwrite/client');
                  const prefs = await account.getPrefs().catch(() => ({}));
                  await account.updatePrefs({ ...prefs, activeAgentSessionId: general.id }).catch(() => {});
                } catch {}
              }
            }
          }
        }
      } catch {
        /* non-fatal */
      }
      try {
        const { account } = await import('@/lib/appwrite/client');
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
        const { getAgentSession, listAgentToolCallsAction } = await import('@/lib/actions/agentic');
        const session: any = await getAgentSession(jwt);
        // General Kylie sidebar must not auto-adopt object Sidekick session as default
        if (session?.targetType || session?.targetId) {
          // skip — keep current general messages, don't overwrite with Sidekick
          return;
        }
        if (session.rowId) setActiveSessionId(session.rowId);
        const historyArr = JSON.parse(session.chatHistory || '[]');
        if (Array.isArray(historyArr) && historyArr.length > 0) {
          const sessionId = session.rowId || '';
          const toolCalls = sessionId
            ? await listAgentToolCallsAction(sessionId, jwt).catch(() => [])
            : [];
          const formatted = formatHistoryMessages(historyArr, toolCalls);
          setMessages(formatted);
          if (user?.$id && session.rowId) {
            await AgenticSessionLocalStore.upsertSession({
              id: session.rowId,
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
              isPinned: (session as any).isPinned === true});
            await AgenticSessionLocalStore.setActiveSessionId(user.$id, session.rowId);
          }
        }
      } catch (err) {
        console.error('Failed to load session history on client:', err);
      }
}
