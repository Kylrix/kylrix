'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function handleApprovePayment(bag: any) {
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

    if (!pendingPayment || !user?.$id) return;
    setSigning(true);
    setPendingPayment((prev) => (prev ? { ...prev, phase: 'processing' } : prev));
    try {
      const privKey = await WalletService.derivePrivateKey(user.$id, 'arbitrum');
      const signature = `0x${privKey.slice(0, 10)}...mock_signature...${Date.now()}`;
      const { submitGasRelayAction } = await import('@/lib/actions/secure-ops/arbitrum-rail');
      const { jwt } = await account.createJWT().catch(() => ({ jwt: null }));
      
      const result = await submitGasRelayAction({
        jwt: jwt || undefined,
        intentId: pendingPayment.intentId,
        signature: signature,
        userAddress: '0x' + user.$id.slice(-40),
        targetAddress: '0x' + pendingPayment.agentId.slice(-40),
        amount: pendingPayment.amount,
        chainId: pendingPayment.chainId
      });

      toast.success('Agent funded successfully!');
      window.dispatchEvent(new CustomEvent('kylrix:payment-completed', {
        detail: {
          intentId: pendingPayment.intentId,
          txHash: result.txHash,
          agentId: pendingPayment.agentId
        }
      }));

      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        role: 'assistant',
        content: `✅ Agent payment of ${pendingPayment.amount} ARB approved. On-chain Stream funded! Tx: ${result.txHash}`
      }]);
      setPendingPayment((prev) => (prev ? { ...prev, phase: 'done' } : prev));
      setTimeout(() => setPendingPayment(null), 900);
    } catch (err: any) {
      toast.error(err.message || 'Payment approval failed');
      setPendingPayment((prev) => (prev ? { ...prev, phase: 'review' } : prev));
    } finally {
      setSigning(false);
    }
}
