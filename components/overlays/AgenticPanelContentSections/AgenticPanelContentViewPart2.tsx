'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function AgenticPanelContentViewPart2(bag: any) {
  const {
    NoteDetailSidebar,
    a,
    accent,
    activeSessionId,
    agentCount,
    agentPrefs,
    appPrefs,
    appendMessage,
    assistantId,
    blob,
    byId,
    cancelled,
    chatInput,
    chatScrollRef,
    clearSessionLongPress,
    composerHints,
    composerLongPressTimerRef,
    composerMenuItems,
    composerMenuOpen,
    contextualPrompt,
    conversationId,
    currentPrefs,
    draftSessionId,
    dx,
    dy,
    el,
    end,
    executing,
    fetchRemoteDraft,
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
    handlePaymentRequest,
    handleRetryMessage,
    handleSelectSession,
    handleShareSession,
    handleStartConversationFromPrompt,
    handleStartNewSession,
    handleSubmit,
    handleToggleSessionPinned,
    handleWorkflow,
    hardVerification,
    hasText,
    id,
    idx,
    isDesktop,
    isPreAuthorized,
    isPro,
    isWorkspaceReadOnly,
    jsonStr,
    jwt,
    liveNextSteps,
    loadSessionHistory,
    loadingSessions,
    longPressTimerRef,
    messageMenuItems,
    messageMenuTarget,
    messages,
    next,
    nextSessions,
    node,
    onClose,
    openComposerMenu,
    openMessageMenu,
    openSessionActionsDrawer,
    pageContext,
    pathname,
    payload,
    pending,
    pendingObject,
    pendingPayment,
    pendingToolAuth,
    pinDelta,
    pos,
    prompt,
    promptText,
    promptWithAttachment,
    recordSessionObject,
    recordToolCall,
    remoteDraft,
    res,
    result,
    router,
    runPrompt,
    runningWorkflowId,
    selectedSessionActionTarget,
    sessionIdForObjects,
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
    sid,
    signing,
    start,
    starter,
    steps,
    syncTimeoutRef,
    synced,
    tagged,
    targetNote,
    text,
    textareaRef,
    toolDef,
    touch,
    touchStartPosRef,
    trimmed,
    truncateTo,
    unlocked,
    url,
    userIdx,
    userMsgId,
    workflows,
    wsId
  } = bag as any;
  return (
    <>
                <button
                  type="button"
                  onClick={() => setShowSessionsDrawer(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/45 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {loadingSessions && workspaceFilteredSessions.length === 0 ? (
                <div className="flex items-center justify-center py-12 gap-2.5">
                  <RefreshCw size={15} className="animate-spin text-[#9B9691]" />
                  <span className="text-[#9B9691] text-xs font-semibold">Loading past chats…</span>
                </div>
              ) : workspaceFilteredSessions.length === 0 ? (
                <div className="text-center py-12 text-[#9B9691] text-xs font-medium flex flex-col items-center gap-2">
                  <History size={24} className="text-white/20" />
                  <span>No past sessions in this workspace. Click + above to start a fresh chat.</span>
                </div>
              ) : (
                workspaceFilteredSessions
                  .filter((sess) => String((sess as any).targetType || '') !== 'momentDoppelganger')
                  .map((sess) => {
                  const isObjectSession = Boolean((sess as any).targetType && (sess as any).targetId);
                  const isSelected = sess.id === activeSessionId;
                  const objectIcon = (() => {
                    const t = String((sess as any).targetType || '');
                    if (t === 'idea' || t === 'note') return '💡';
                    if (t === 'goal' || t === 'task') return '🎯';
                    if (t === 'project') return '📦';
                    if (t === 'form') return '📝';
                    if (t === 'vault' || t === 'credential') return '🔐';
                    if (t === 'event') return '📅';
                    return '🔗';
                  })();
                  let previewText = 'Empty conversation';
                  let titleText = `Chat from ${new Date(sess.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                  try {
                    const parsed = JSON.parse(sess.chatHistory || '[]');
                    const firstUser = parsed.find((m: any) => m.role === 'user');
                    const lastMsg = parsed[parsed.length - 1];
                    if (firstUser?.content) {
                      titleText = visibleChatContent('user', firstUser.content).slice(0, 80) || titleText;
                    }
                    if (lastMsg) {
                      let body = visibleChatContent(lastMsg.role, lastMsg.content);
                      if (isObjectSession) {
                        try {
                          const j = JSON.parse(body);
                          if (j?.oneLiner) body = j.oneLiner;
                          else if (j?.response) body = String(j.response).slice(0, 80);
                          else if (typeof j === 'object') body = j.oneLiner || j.title || 'Sidekick session';
                        } catch {}
                      }
                      body = body.replace(/\s+/g, ' ').trim().slice(0, 110);
                      previewText = `${lastMsg.role === 'user' ? 'You' : 'Kylie'}: ${body}`;
                    }
                  } catch {}

                  return (
                    <div
                      key={sess.id}
                      onClick={() => {
                        if (isObjectSession) {
                          const t = (sess as any).targetType as string;
                          const id = (sess as any).targetId as string;
                          setShowSessionsDrawer(false);
                          onClose();
                          window.dispatchEvent(new CustomEvent('kylrix:open-sidekick', { detail: { type: t, id } }));
                          return;
                        }
                        handleSelectSession(sess.id);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openSessionActionsDrawer(sess);
                      }}
                      onTouchStart={() => {
                        clearSessionLongPress();
                        sessionLongPressTimerRef.current = setTimeout(() => {
                          openSessionActionsDrawer(sess);
                        }, 450);
                      }}
                      onTouchEnd={clearSessionLongPress}
                      onTouchMove={clearSessionLongPress}
                      onTouchCancel={clearSessionLongPress}
                      className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer text-left group select-none ${
                        isSelected
                          ? 'bg-white/[0.08] border-[#A855F7]/40 ring-1 ring-[#A855F7]/30'
                          : isObjectSession
                          ? 'bg-[#A855F7]/10 border-[#A855F7]/20 hover:bg-[#A855F7]/15 hover:border-[#A855F7]/35'
                          : 'bg-[#141210] border-white/8 hover:bg-[#1A1816] hover:border-white/15'
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex flex-col gap-1.5 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          {isObjectSession && <span className="shrink-0 text-xs">{objectIcon}</span>}
                          <span className="text-white text-xs font-bold font-clash leading-tight truncate">
                            {titleText}
                          </span>
                          {isObjectSession && (
                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-[#A855F7]/20 text-[#E9D5FF] text-[9px] font-black uppercase tracking-wider font-mono">
                              {String((sess as any).targetType)}
                            </span>
                          )}
                          {((sess as any).isPublic === true || (sess as any).isGuest === true) && (
                            <span className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-500/15 text-[#818CF8] text-[9px] font-black border border-indigo-500/20 font-mono">
                              SHARED
                            </span>
                          )}
                          {sess.isPinned === true && (
                            <span className="shrink-0 text-[10px] text-[#F59E0B] font-black font-mono">
                              PINNED
                            </span>
                          )}
                        </div>
                        <p className="text-[#9B9691] text-[11px] font-satoshi leading-relaxed truncate m-0">
                          {previewText}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <button
                          type="button"
                          onClick={(e) => handleShareSession(e, sess.id, sess.isPublic === true || sess.isGuest === true)}
                          title={sess.isPublic || sess.isGuest ? 'Session is shared' : 'Share session'}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-colors ${
                            sess.isPublic || sess.isGuest
                              ? 'text-[#818CF8] bg-indigo-500/15 border-indigo-500/20'
                              : 'text-white/40 hover:text-white hover:bg-white/[0.08] border-transparent'
                          }`}
                        >
                          <Share2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openSessionActionsDrawer(sess);
                          }}
                          title="More options"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] border border-transparent transition-colors"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      {showSessionActionsDrawer && selectedSessionActionTarget && (
        <div className="absolute inset-0 bg-black/70 z-[60] flex flex-col justify-end">
          <div className="bg-[#161412] border-t border-white/10 rounded-t-[24px] w-full max-h-[60dvh] px-5 py-4 flex flex-col gap-3 animate-slide-up">
            <div className="w-10 h-1 rounded-full bg-white/10 mx-auto" />
            <div className="text-center">
              <div className="text-white text-sm font-extrabold">Session actions</div>
              <div className="text-[#9B9691] text-[11px] mt-1 line-clamp-1">
                {selectedSessionActionTarget.context || 'Manage this chat thread'}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                handleShareSession(
                  e as any,
                  selectedSessionActionTarget.id,
                  selectedSessionActionTarget.isPublic === true || selectedSessionActionTarget.isGuest === true);
                setShowSessionActionsDrawer(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm font-bold"
            >
              <Share2 size={16} />
              <span>{selectedSessionActionTarget.isPublic || selectedSessionActionTarget.isGuest ? 'Copy shared link / make private' : 'Share session'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void handleToggleSessionPinned(
                  selectedSessionActionTarget.id,
                  !(selectedSessionActionTarget.isPinned === true));
                setShowSessionActionsDrawer(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-white text-sm font-bold"
            >
              <Flag size={16} />
              <span>{selectedSessionActionTarget.isPinned === true ? 'Unpin session' : 'Pin session'}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                handleDeleteSession(e as any, selectedSessionActionTarget.id);
                setShowSessionActionsDrawer(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors"
            >
              <Trash2 size={16} />
              <span>Delete session</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSessionActionsDrawer(false)}
              className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-white/[0.02] border border-white/5 text-white/70 text-sm font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Top z-index Agentic Confirmation Bottom Drawer */}
      {pendingToolAuth && (
        <div className="absolute inset-0 bg-black/80 z-[80] flex flex-col justify-end">
          <div className="bg-[#161412] border-t border-white/10 rounded-t-[28px] w-full h-[60dvh] max-h-[60dvh] p-6 flex flex-col justify-between shadow-2xl animate-slide-up">
            <div className="flex flex-col gap-4 overflow-y-auto">
              <div className="w-12 h-1.5 rounded-full bg-white/15 mx-auto shrink-0" />

              <div className="flex items-center gap-3.5 shrink-0">
                <div className="w-11 h-11 rounded-2xl bg-[#6366F1]/15 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1] shrink-0">
                  {pendingToolAuth.toolKey.startsWith('wallet_') ? <Wallet size={20} /> : <Shield size={20} />}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white text-sm font-bold font-satoshi truncate">
                      {pendingToolAuth.toolKey.startsWith('wallet_') ? 'Agentic Wallet Access' : 'Authorize Action'}
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#6366F1]/20 text-[#818cf8]">
                      Kylie Inbuilt
                    </span>
                  </div>
                  <p className="text-white/60 text-xs font-satoshi mt-0.5">
                    Allow <strong>Kylie</strong> {pendingToolAuth.toolKey === 'wallet_get_balance' ? 'to read your wallet balances and on-chain addresses?' : `to execute ${pendingToolAuth.name}?`}
                  </p>
                </div>
              </div>

              {/* Permissions & Scope Overview */}
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-2.5 text-left shrink-0">
                <div className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider font-satoshi">
                  Requested Scope & Chains
                </div>
                {(() => {
                  const rawToken = String(pendingToolAuth.args?.token || pendingToolAuth.args?.chain || 'ALL').toUpperCase();
                  const isAll = rawToken === 'ALL';
                  return (
                    <div className="grid grid-cols-2 gap-2 text-xs font-satoshi">
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-white/80 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate">{isAll ? 'Kylrix Ledger' : `${rawToken} Network`}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04] text-white/80 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate">{isAll ? 'Solana & EVM Chains' : 'Read Balance & Address'}</span>
                      </div>
                    </div>
                  );
                })()}
                {pendingToolAuth.args && (
                  <div className="text-[11px] text-white/40 font-mono pt-2 border-t border-white/[0.04] truncate">
                    Intent: {pendingToolAuth.toolKey} {JSON.stringify(pendingToolAuth.args)}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-white/5 space-y-2 shrink-0">
              <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const auth = pendingToolAuth;
                    setPendingToolAuth(null);
                    toast.success(`Authorized ${auth.name}`);
                    try {
                      const { executeAgenticToolCallWithToast } = await import('@/lib/agentic/client-executor');
                      const result = await executeAgenticToolCallWithToast(
                        { toolKey: auth.toolKey, specifier: auth.specifier, args: auth.args },
                        {
                          user,
                          router,
                          onClose,
                          setActiveWorkspaceId,
                          tasks,
                          notes: allNotes,
                          setCachedData,
                          pushLiveNote,
                          removeNote,
                          registerComposeSession,
                          unregisterComposeSession,
                          migrateDraftNoteId,
                          addTask,
                          updateTask: async (id: string, patch: any) => { updateTask(id, patch); },
                          deleteTask: async (id: string) => { deleteTask(id); },
                          appendMessage,
                          openDrawer: (type: string, payload?: Record<string, unknown>) => { openUnified(type as any, payload); },
                          openWalletWithIntent,
                        },
                        auth.name
                      );

                      if (auth.assistantId) {
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === auth.assistantId
                              ? {
                                  ...m,
                                  blocks: [
                                    ...(m.blocks || []).map((b) =>
                                      b.type === 'pending_auth' && b.toolKey === auth.toolKey
                                        ? { ...b, status: 'authorized' as const }
                                        : b
                                    ),
                                    ...(result.messageBlocks || []),
                                  ],
                                }
                              : m
                          )
                        );
                      }
                    } catch (execErr: any) {
                      console.error('Failed to run authorized tool:', execErr);
                      toast.error(`Execution failed: ${execErr?.message || 'Unknown error'}`);
                    }
                  }}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-[#6366F1] hover:bg-[#4f46e5] text-white text-xs font-black transition cursor-pointer"
                >
                  Allow Access
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const auth = pendingToolAuth;
                    setPendingToolAuth(null);
                    try {
                      const current = await account.getPrefs();
                      const whitelist = Array.isArray(current?.authorizedTools) ? current.authorizedTools : [];
                      if (!whitelist.includes(auth.toolKey)) {
                        whitelist.push(auth.toolKey);
                      }
                      await account.updatePrefs({ ...current, authorizedTools: whitelist });
                      toast.success(`Always allow whitelisted for ${auth.name}`);

                      const { executeAgenticToolCallWithToast } = await import('@/lib/agentic/client-executor');
                      const result = await executeAgenticToolCallWithToast(
                        { toolKey: auth.toolKey, specifier: auth.specifier, args: auth.args },
                        {
                          user,
                          router,
                          onClose,
                          setActiveWorkspaceId,
                          tasks,
                          notes: allNotes,
                          setCachedData,
                          pushLiveNote,
                          removeNote,
                          registerComposeSession,
                          unregisterComposeSession,
                          migrateDraftNoteId,
                          addTask,
                          updateTask: async (id: string, patch: any) => { updateTask(id, patch); },
                          deleteTask: async (id: string) => { deleteTask(id); },
                          appendMessage,
                          openDrawer: (type: string, payload?: Record<string, unknown>) => { openUnified(type as any, payload); },
                          openWalletWithIntent,
                        },
                        auth.name
                      );

                      if (auth.assistantId) {
                        setMessages((prev) =>
                          prev.map((m) =>
                            m.id === auth.assistantId
                              ? {
                                  ...m,
                                  blocks: [
                                    ...(m.blocks || []).map((b) =>
                                      b.type === 'pending_auth' && b.toolKey === auth.toolKey
                                        ? { ...b, status: 'authorized' as const }
                                        : b
                                    ),
                                    ...(result.messageBlocks || []),
                                  ],
                                }
                              : m
                          )
                        );
                      }
                    } catch (err) {
                      console.error('Failed to whitelist/execute:', err);
                    }
                  }}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-xs font-bold transition cursor-pointer"
                >
                  Always Allow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingToolAuth.assistantId) {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === pendingToolAuth.assistantId
                            ? {
                                ...m,
                                blocks: (m.blocks || []).map((b) =>
                                  b.type === 'pending_auth' && b.toolKey === pendingToolAuth.toolKey
                                    ? { ...b, status: 'rejected' }
                                    : b
                                ),
                              }
                            : m
                        )
                      );
                    }
                    setPendingToolAuth(null);
                  }}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 text-white/50 hover:text-white text-xs transition cursor-pointer"
                >
                  Deny
                </button>
              </div>

              <div className="text-[10px] text-center text-white/40 pt-1">
                Protected by Kylrix MasterPass & Security Enclave.{' '}
                <Link href="/settings/agents" className="text-[#818cf8] hover:underline">
                  Manage agent permissions
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
    </>
  );
}
