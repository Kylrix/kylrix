'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function handleShareSession(bag: any) {
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

    e.stopPropagation();
    try {
      const { toggleAgentSessionShareAction } = await import('@/lib/actions/agentic');
      const { getResourcePublicGuestSecure } = await import('@/lib/actions/secure-ops/misc');
      const { account } = await import('@/lib/appwrite/client');
      const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => undefined);
      const mode = currentlyShared ? 'make_private' : 'publish';
      const shareRes = await toggleAgentSessionShareAction(sessionId, mode, jwt);
      const status = await getResourcePublicGuestSecure({
        resourceType: 'agent_session',
        resourceId: sessionId,
        jwt});
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, isPublic: status.isPublic === true, isGuest: status.isGuest === true }
            : s));
      if (user?.$id) {
        await AgenticSessionLocalStore.patchSessionMeta(user.$id, sessionId, {
          isPublic: status.isPublic === true,
          isGuest: status.isGuest === true});
      }
      const didPublish = status.isPublic === true || status.isGuest === true;
      if (mode === 'publish' && !didPublish) {
        throw new Error('Session share did not persist on the server yet.');
      }
      if (!currentlyShared && didPublish) {
        const url = (shareRes as any)?.publicUrl || `https://www.kylrix.space/agents/session/${sessionId}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success('Session link copied');
        } catch {
          toast.success('Session is now public');
        }
      } else if (mode === 'make_private' && !didPublish) {
        toast.success('Session is private again');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update session sharing');
    }
}
