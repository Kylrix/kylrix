'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {

export function AgenticPanelContentViewPart1(bag: any) {
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
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-[#161412]">
      {/* Sticky header */}
      <div className="flex-shrink-0 px-4 sm:px-5 pt-2.5 pb-3.5 border-b border-white/20 bg-[#0E0D0C] relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: `radial-gradient(ellipse 80% 120% at 0% 0%, ${accent}18 0%, transparent 55%)`}}
        />
        <div className="relative flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 border-2 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
            style={{ borderColor: `${accent}70`, backgroundColor: `${accent}18`, color: accent }}
          >
            <span className="font-clash font-black text-[16px] leading-none tracking-tight">K</span>
          </div>
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <h2 className="text-white font-extrabold text-[16px] font-clash tracking-tight leading-tight truncate">
              Kylie
            </h2>
            <p className="text-[#9B9691] text-xs font-semibold leading-snug truncate">
              Here for {zoneLabel(pageContext.zone).toLowerCase()}
              {agentCount > 0 ? ` · ${agentCount} helper${agentCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenSessions}
            title="Past chats with Kylie"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:text-white bg-[#161412] hover:bg-white/[0.08] border border-white/20 flex-shrink-0 transition-colors cursor-pointer"
          >
            <History size={16} />
          </button>
          <button
            type="button"
            onClick={handleExportSession}
            title="Export session conversation as JSON"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:text-white bg-[#161412] hover:bg-white/[0.08] border border-white/20 flex-shrink-0 transition-colors cursor-pointer"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white/60 hover:text-white bg-[#161412] hover:bg-white/[0.08] border border-white/20 flex-shrink-0 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <p className="relative mt-2 text-[#9B9691] text-xs font-semibold leading-relaxed line-clamp-2">
          {pageContext.subtitle}
        </p>
      </div>

      {/* Sticky quick actions — grid scrolls inside band; header + composer stay put */}
      {messages.length === 0 && (
        <div className="flex-shrink-0 border-b border-white/20 bg-[#161412] px-4 sm:px-5 py-3 flex flex-col min-h-0 max-h-[min(240px,36%)]">
          <div className="flex items-center justify-between gap-2 mb-2.5 flex-shrink-0">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9B9691] font-clash">
              Try with Kylie
            </span>
            <span className="text-[10px] font-semibold text-white/40">{workflows.length} actions</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pb-0.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {workflows.map((action) => {
                const Icon = QUICK_ICON_MAP[action.icon] || Sparkles;
                const isRunning = runningWorkflowId === action.id;

                return (
                  <button
                    key={action.id}
                    type="button"
                    disabled={isRunning || executing}
                    onClick={() => void handleWorkflow(action)}
                    title={action.description}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-[#000000] border-2 border-white/20 hover:border-white/40 transition disabled:opacity-50 text-left cursor-pointer"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/20"
                      style={{ color: accent, borderColor: `${accent}50`, backgroundColor: `${accent}15` }}
                    >
                      {isRunning ? (
                        <RefreshCw size={15} className="animate-spin" />
                      ) : (
                        <Icon size={15} strokeWidth={2.2} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                      <span className="text-white text-[13px] font-extrabold font-clash leading-tight">
                        {action.label}
                      </span>
                      <span className="text-[#9B9691] text-[11px] font-semibold leading-snug line-clamp-2">
                        {action.description}
                      </span>
                    </div>
                    <ChevronRight size={14} className="text-white/30 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable chat only */}
      <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 flex flex-col gap-3">
        {messages.length === 0 && !executing && (
          <div className="rounded-2xl border-2 border-white/20 bg-[#000000] px-4 py-3.5">
            <p className="text-white text-[13px] font-bold font-clash leading-snug mb-1">
              Hey — I&apos;m Kylie.
            </p>
            <p className="text-[#9B9691] text-xs font-semibold leading-relaxed">
              Pick a suggestion above or just ask. I&apos;ll keep this chat right here.
            </p>
          </div>
        )}

        {messages.filter((m: any) => !m.isHiddenFromUI).map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
            {msg.role === 'assistant' && (
              <div
                className="mt-1 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/20 text-[11px] font-clash font-black"
                style={{ borderColor: `${accent}60`, backgroundColor: `${accent}15`, color: accent }}
              >
                K
              </div>
            )}
            <div
              role="button"
              tabIndex={0}
              className={`max-w-[88%] min-w-0 rounded-2xl px-4 py-3 select-none break-words [word-break:break-word] overflow-hidden ${
                msg.role === 'user'
                  ? 'bg-[#1C1A18] border-2 border-white/25 text-white'
                  : 'bg-[#000000] border-2 border-white/20 text-white/95'
              }`}
              style={
                msg.role === 'assistant'
                  ? { boxShadow: `inset 3px 0 0 0 ${accent}70` }
                  : undefined
              }
              onContextMenu={(e) => {
                e.preventDefault();
                openMessageMenu(msg);
              }}
              onTouchStart={(e) => handleMessageTouchStart(e, msg)}
              onTouchMove={handleMessageTouchMove}
              onTouchEnd={handleMessageTouchEnd}
              onTouchCancel={handleMessageTouchEnd}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-black tracking-wider text-[#9B9691] leading-none">
                  {msg.role === 'user' ? 'You' : 'Kylie'}
                </p>
                <AgenticMessageActions
                  messageId={msg.id}
                  sessionId={activeSessionId}
                  isPublic={msg.isPublic}
                  isGuest={msg.isGuest}
                  syncStatus={msg.syncStatus || 'synced'}
                  accent={accent}
                  onShareChange={(next) => {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === msg.id ? { ...m, ...next } : m)));
                  }}
                />
              </div>
              <AgenticMessageBody
                content={msg.content}
                blocks={msg.blocks}
                onPickHit={(hit) => {
                  void runPrompt(`Load "${hit.title}" (${hit.id}) and explain its core details and interesting parts in plain language.`);
                }}
                onSelectChain={(chain) => {
                  void runPrompt(`Fetch my ${chain} wallet balance and address`);
                }}
              />
              {msg.role === 'assistant' && msg.tools && msg.tools.length > 0 && (
                <div className="mt-2.5 flex flex-col gap-1.5">
                  {msg.tools.map((tool, toolIdx) => (
                    <div
                      key={`${msg.id}-tool-${toolIdx}`}
                      className="rounded-xl border border-white/20 bg-black/40 px-2.5 py-2 text-left"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-[#9B9691]">
                        <Zap size={11} style={{ color: accent }} />
                        <span>Tool · {tool.toolKey}</span>
                        {tool.status ? (
                          <span className={tool.status === 'success' ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {tool.status}
                          </span>
                        ) : null}
                      </div>
                      {tool.specifier ? (
                        <p className="mt-1 text-[10px] font-mono text-white/50 truncate">Target: {tool.specifier}</p>
                      ) : null}
                      {tool.resultSummary ? (
                        <p className="mt-1 text-[11px] font-semibold text-white/80 leading-snug">{tool.resultSummary}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {msg.role === 'assistant' && msg.nextSteps && msg.nextSteps.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#9B9691]">
                    Next with Kylie
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {msg.nextSteps.map((step, stepIdx) => (
                      <button
                        key={`${msg.id}-step-${stepIdx}`}
                        type="button"
                        disabled={executing}
                        onClick={() => void runPrompt(step.prompt)}
                        className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/25 transition text-xs font-semibold text-white/90 disabled:opacity-50"
                      >
                        {step.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {executing && (
          <div className="flex justify-start gap-2">
            <div
              className="mt-1 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 border border-white/20 text-[11px] font-clash font-black"
              style={{ borderColor: `${accent}60`, backgroundColor: `${accent}15`, color: accent }}
            >
              K
            </div>
            <div className="rounded-2xl px-4 py-3 bg-[#000000] border-2 border-white/20 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin" style={{ color: accent }} />
              <span className="text-[#9B9691] text-xs font-semibold leading-snug">Kylie is on it…</span>
            </div>
          </div>
        )}
      </div>

      {/* Sticky composer */}
      <div className="flex-shrink-0 border-t border-white/20 bg-[#0E0D0C] px-3 sm:px-5 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom,20px))]">
        {pendingPayment ? (
          <div className="mb-3 p-4 rounded-2xl bg-[#000000] border-2 border-white/20 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Wallet size={16} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white text-xs font-bold leading-tight">Authorize Agent Funding</h3>
                <p className="text-[#9B9691] text-[10px] leading-snug mt-0.5">
                  Deposit {pendingPayment.amount} ARB to fund Agent {pendingPayment.agentId.substring(0, 8)}...
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={signing}
                onClick={handleApprovePayment}
                className="flex-1 py-2 px-3 rounded-xl bg-white text-black text-xs font-black hover:bg-zinc-200 transition disabled:opacity-50 cursor-pointer"
              >
                {signing ? 'Signing with MEK...' : 'Sign & Fund Stream'}
              </button>
              <button
                type="button"
                disabled={signing}
                onClick={() => setPendingPayment(null)}
                className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/20 text-white text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {isWorkspaceReadOnly ? (
          <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Lock size={16} className="shrink-0 text-amber-400" />
            <span className="leading-relaxed">
              Viewing agentic session in shared workspace (read-only). Switch to your personal workspace or request edit access to chat.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            {composerHints.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {composerHints.map((hint) => (
                  <button
                    key={hint.id}
                    type="button"
                    onClick={() => {
                      if (hint.route) {
                        router.push(hint.route);
                        return;
                      }
                      if (hint.prompt) handleInputChange(hint.prompt);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-white/20 bg-[#000000] text-[10px] font-bold text-white/70 hover:text-white hover:border-white/40 transition cursor-pointer"
                  >
                    {hint.label}
                  </button>
                ))}
              </div>
            ) : null}

            {/* Pending Attachment Preview */}
            {pendingObject ? (
              <div className="mb-1">
                <ChatObjectPreview payload={pendingObject.payload} onRemove={() => setPendingObject(null)} />
              </div>
            ) : null}

            {/* OpenBricks 4.0 Pill Composer with Attachment Button */}
            <div
              className="flex items-end gap-1 rounded-[22px] bg-[#000000] border-2 border-white/20 pl-1.5 pr-1.5 py-1.5 transition-all focus-within:border-white/50 focus-within:ring-1 focus-within:ring-white/20"
              style={{ boxShadow: executing ? `0 0 0 2px ${accent}60` : undefined }}
              onContextMenu={(e) => {
                e.preventDefault();
                openComposerMenu();
              }}
              onTouchStart={handleComposerTouchStart}
              onTouchMove={handleComposerTouchMove}
              onTouchEnd={handleComposerTouchEnd}
              onTouchCancel={handleComposerTouchEnd}
            >
              <button
                type="button"
                onClick={() => {
                  openFileDrawer({
                    title: 'Attach to Kylie',
                    onSelectFile: (file: any) => {
                      const parsed = parseChatAttachFile(file);
                      if (parsed) setPendingObject(parsed);
                    },
                  });
                }}
                aria-label="Attach to chat"
                title="Attach object, file, or media"
                className="shrink-0 w-9 h-9 mb-0.5 rounded-full inline-flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <Paperclip size={18} strokeWidth={2} />
              </button>

              <textarea
                ref={textareaRef}
                value={chatInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openComposerMenu();
                }}
                placeholder="Ask Kylie to help you with anything…"
                disabled={executing}
                rows={1}
                className="flex-1 min-w-0 resize-none bg-transparent border-0 outline-none shadow-none ring-0 focus:ring-0 focus:outline-none text-[0.9375rem] leading-[1.45] text-white font-satoshi font-medium placeholder:text-white/35 py-2 px-1 disabled:opacity-50 max-h-[120px]"
              />

              <button
                type="submit"
                disabled={executing || (!chatInput.trim() && !pendingObject)}
                className="shrink-0 w-9 h-9 mb-0.5 rounded-full inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: (chatInput.trim() || pendingObject) && !executing ? (accent || '#F59E0B') : 'rgba(255,255,255,0.06)',
                  color: (chatInput.trim() || pendingObject) && !executing ? '#000000' : 'rgba(255,255,255,0.3)',
                }}
                aria-label="Send"
              >
                {executing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} strokeWidth={2.5} className={(chatInput.trim() || pendingObject) ? 'translate-x-[1px]' : ''} />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] text-white/40 font-semibold leading-snug">
                Enter to send · Shift+Enter for new line
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isPro && (
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                    Pro
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/settings/agents');
                  }}
                  className="text-[10px] font-bold text-white/40 hover:text-white transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} />
                  Agents
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {composerMenuOpen && (
        <ContextMenu
          x={0}
          y={0}
          onCloseAction={() => setComposerMenuOpen(false)}
          items={composerMenuItems}
        />
      )}

      {messageMenuTarget && (
        <ContextMenu
          x={0}
          y={0}
          onCloseAction={() => setMessageMenuTarget(null)}
          items={messageMenuItems}
        />
      )}

      {/* Sessions Bottom Drawer (Capped at 60% height permanently) */}
      {showSessionsDrawer && (
        <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end transition-opacity duration-300">
          <div className="bg-[#0B0A09] border-t border-white/10 rounded-t-[20px] w-full max-h-[60%] min-h-[40%] flex flex-col overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={16} style={{ color: accent }} />
                <h3 className="text-white font-extrabold text-[14px] font-clash tracking-tight">
                  Agentic sessions
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateNewSessionFromDrawer}
                  title="New Session"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/60 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5"
                >
                  <Plus size={14} />
                </button>
    </>
  );
}
