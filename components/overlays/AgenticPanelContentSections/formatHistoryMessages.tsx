'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function formatHistoryMessages(bag: any) {
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

  const toolsByConversation = new Map<string, ToolCallDisplay[]>();
  for (const tc of toolCalls) {
    if (!tc.conversationId) continue;
    const list = toolsByConversation.get(tc.conversationId) || [];
    list.push({
      toolKey: tc.toolKey,
      specifier: tc.specifier,
      status: tc.status,
      resultSummary: tc.resultSummary,
      args: tc.args});
    toolsByConversation.set(tc.conversationId, list);
  }

  return (Array.isArray(historyArr) ? historyArr : []).map((h: any, idx: number) => {
    const id = typeof h.id === 'string' && h.id ? h.id : `hist-${idx}`;
    const role = h.role === 'assistant' ? 'assistant' : 'user';
    const tools = role === 'assistant' ? toolsByConversation.get(id) : undefined;
    const blocksFromTools =
      tools
        ?.map((t) => parseBlocksFromToolSummary(t.resultSummary))
        .filter((b): b is AgenticMessageBlock[] => Array.isArray(b) && b.length > 0)
        .flat() || [];
    return {
      id,
      role,
      content: visibleChatContent(role, h.content),
      blocks: blocksFromTools.length ? blocksFromTools : undefined,
      syncStatus: h.syncStatus === 'pending' || h.syncStatus === 'error' ? h.syncStatus : 'synced',
      isPublic: h.isPublic === true,
      isGuest: h.isGuest === true,
      tools,
      nextSteps: role === 'assistant' ? normalizeNextSteps(h.nextSteps) : undefined};
  });
}
