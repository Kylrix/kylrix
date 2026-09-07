'use client';

import { Query } from 'appwrite';
import React, { useEffect, useState, useRef, useTransition, useMemo } from 'react';
import { ChatService } from '@/lib/services/chat';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { useRouter, useSearchParams } from 'next/navigation';
import { tablesDB, realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatTime } from '@/lib/time-util';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import {

export function ChatWindowView(bag: any) {
  const {
    _handleAttachClick,
    _handleDeleteMessage,
    _isPending,
    _loading,
    _partnerPresence,
    _searchParams,
    _setTypingUsers,
    _showFirstContactWarning,
    a,
    actor,
    anchorEl,
    applyDisplayName,
    atRest,
    atRestOrdered,
    attachAnchorEl,
    attachment,
    audioChunksRef,
    avatarUrl,
    base,
    blob,
    cached,
    cachedConv,
    cachedMessages,
    cancelled,
    chan,
    channel,
    chatSettingsOpen,
    clearOptionsOpen,
    clientReadSegments,
    closeReactionPopover,
    conv,
    convForDecrypt,
    conversation,
    conversationDisplayName,
    conversationId,
    conversationReadAt,
    cutoff,
    data,
    decryptedSettings,
    displayMessages,
    existing,
    fallback,
    fallbackIsSelf,
    fallbackName,
    fileInputRef,
    fromList,
    groupMentionTargets,
    groupParticipantIds,
    grouped,
    groups,
    handleAttachClose,
    handleClearChat,
    handleCopy,
    handleExport,
    handleFileSelect,
    handleMessageContextMenu,
    handleNoteSelect,
    handleReact,
    handleReply,
    handleSecretSelect,
    handleSend,
    handleTip,
    handleTogglePinMessage,
    hasRepliedToPartner,
    hit,
    hydrateMembers,
    hydrateSenders,
    hydrated,
    initRealtime,
    initialLoadRef,
    input,
    isMobile,
    isProPlan,
    isRecording,
    isSelf,
    isSelfBookmarks,
    isTyping,
    isUnlocked,
    layout,
    loadConversation,
    loadMessages,
    loadReactions,
    looksEncrypted,
    mediaRecorderRef,
    messageAnchorEl,
    messageReactions,
    messageSenderIds,
    messages,
    messagesEndRef,
    messagesLoading,
    metadata,
    missingIds,
    msg,
    myClearedAt,
    myName,
    myProfile,
    name,
    next,
    noteModalOpen,
    onBack,
    onFileChange,
    openReactionPopover,
    ordered,
    otherId,
    ownLinkPreviewsEnabled,
    ownOnlineEnabled,
    ownTypingEnabled,
    participantIds,
    partnerId,
    partnerOnlineEnabled,
    partnerProfile,
    partnerTypingEnabled,
    partnerVerification,
    pendingObject,
    pr,
    profile,
    reactionPopoverAnchorEl,
    reactionPopoverGroups,
    reactionPopoverMessage,
    reactionPopoverMessageId,
    reactionPopoverRows,
    reactionRows,
    reactionsByMessageId,
    readAt,
    recordingTimerRef,
    replyingTo,
    resolved,
    response,
    rosterHit,
    router,
    rows,
    scrollToBottom,
    secretModalOpen,
    seedTitle,
    senderProfiles,
    sending,
    setAnchorEl,
    setAttachAnchorEl,
    setAttachment,
    setChatSettingsOpen,
    setClearOptionsOpen,
    setConversation,
    setConversationReadAt,
    setIsRecording,
    setIsUnlocked,
    setLoading,
    setMessageAnchorEl,
    setMessageReactions,
    setMessages,
    setMessagesLoading,
    setNoteModalOpen,
    setOwnLinkPreviewsEnabled,
    setOwnOnlineEnabled,
    setOwnTypingEnabled,
    setPartnerOnlineEnabled,
    setPartnerPresence,
    setPartnerProfile,
    setPartnerTypingEnabled,
    setPartnerVerification,
    setPendingObject,
    setReactionPopoverAnchorEl,
    setReactionPopoverMessageId,
    setReplyingTo,
    setSecretModalOpen,
    setSenderProfiles,
    setSending,
    setUnlockModalOpen,
    settings,
    shouldReload,
    startTransition,
    t,
    theme,
    threadId,
    timeout,
    toggleRecording,
    type,
    typingTimeoutRef,
    typingUsers,
    uid,
    unlockModalOpen,
    unsub,
    unsubscribe,
    url,
    useSelf,
    username
  } = bag as any;
  return (
        <Box sx={{
            bgcolor: '#0A0908',
            position: layout === 'fill' ? 'absolute' : 'fixed',
            top: layout === 'fill' ? 0 : '88px',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: layout === 'fill' ? 1 : 1200,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'}}>

            <MuralPattern />
            <AppBar position="absolute" color="transparent" elevation={0} sx={{ 
                top: 0,
                left: 0,
                right: 0,
                borderBottom: '1px solid #1C1A18', 
                bgcolor: '#0A0908',
                zIndex: 10,
                pt: 'env(safe-area-inset-top)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'}}>
                <Toolbar sx={{ gap: 1, minHeight: '72px' }}>
                    <IconButton edge="start" onClick={() => (onBack ? onBack() : router.back())} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff', bgcolor: '#161412' } }}>
                        <ChevronLeft size={20} strokeWidth={2} />
                    </IconButton>
                    <Box
                        onClick={() => {
                            const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900;
                            const isGroup = conversation?.type === 'group' || conversation?.type === 'channel';
                            const uid = isGroup ? null : partnerId;
                            const node = (
                              <ProfileSidebar
                                userId={uid}
                                username={partnerProfile?.username}
                                conversationId={conversationId}
                                conversation={conversation}
                                seed={isGroup ? null : {
                                  displayName: partnerProfile?.displayName || conversationDisplayName,
                                  username: partnerProfile?.username,
                                  bio: partnerProfile?.bio,
                                  avatar: partnerProfile?.avatar || conversation?.avatarUrl,
                                }}
                                onClose={isDesktop ? closeSidebar : closeOverlay}
                              />
                            );
                            const key = `profile-${uid || partnerProfile?.username || conversationId}`;
                            if (isDesktop) openSidebar(node, key, { hideHeader: true });
                            else openOverlay(node);
                        }}
                        sx={{ display: 'flex', items: 'center', gap: 1.5, flex: 1, cursor: 'pointer', '&:hover': { opacity: 0.85 } }}
                    >
                        <IdentityAvatar 
                            userId={isSelf ? user?.$id : partnerId}
                            src={
                                conversation?.avatarUrl?.startsWith?.('http')
                                    ? conversation.avatarUrl
                                    : null
                            }
                            fileId={
                                conversation?.avatarUrl?.startsWith?.('http')
                                    ? null
                                    : (conversation?.avatar || conversation?.avatarUrl || null)
                            }
                            alt={conversationDisplayName}
                            fallback={
                                (conversationDisplayName || user?.name || 'Y')
                                    .replace(/\(You\)/gi, '')
                                    .replace(/^@/, '')
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase() || 'Y'
                            }
                            size={38}
                        />
                        <Box>
                            {conversation?.type === 'direct' && !isSelf ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <IdentityName
                                        verified={partnerVerification.verified}
                                        sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.1, color: '#fff', fontSize: '1rem' }}
                                    >
                                        {conversationDisplayName}
                                    </IdentityName>
                                    {conversation?.isEncrypted ? (
                                        <Lock size={13} strokeWidth={2.5} color="#F59E0B" aria-label="Secure chat" />
                                    ) : null}
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.1, color: isSelf ? '#6366F1' : '#fff', fontSize: '1rem' }}>
                                        {conversationDisplayName}
                                    </Typography>
                                    {conversation?.isEncrypted ? (
                                        <Lock size={13} strokeWidth={2.5} color="#F59E0B" aria-label="Secure chat" />
                                    ) : null}
                                </Box>
                            )}
                            {conversation?.type === 'group' && (
                                <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem', fontFamily: 'var(--font-mono)' }}>
                                    {(conversation?.participantCount || conversation?.participants?.length || 0)} members
                                </Typography>
                            )}
                            {!isSelf && conversation?.type === 'direct' && (
                                <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    {(() => {
                                        const otherId = conversation.participants.find((p: string) => p !== user?.$id);
                                        const otherPresence = globalPresence?.[otherId];
                                        if (!otherPresence) return 'Offline';

                                        const isOnline = otherPresence.state === 'online' && (Date.now() - new Date(otherPresence.lastSeen || 0).getTime() < 1000 * 60 * 5);

                                        if (isOnline) return (
                                            <>
                                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#6366F1', boxShadow: '0 0 8px #6366F1' }} />
                                                Online
                                            </>
                                        );
                                        return 'Offline';
                                    })()}
                                </Typography>
                            )}
                            {isSelf && (
                                <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 700, fontSize: '0.75rem' }}>
                                    Secured Cloud
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ pointerEvents: 'auto' }}>
                        <IconButton
                            onClick={(e: React.MouseEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
                                if (isDesktop) {
                                  const node = (
                                    <ChatSettingsPanel
                                      conversation={conversation}
                                      conversationId={conversationId}
                                      isSelf={!!isSelf}
                                      messages={messages}
                                      onClose={closeSidebar}
                                      onExport={handleExport}
                                      onClearMe={() => handleClearChat('me')}
                                      onClearEveryone={() => handleClearChat('everyone')}
                                      onNuclear={() => handleClearChat('nuclear')}
                                    />
                                  );
                                  openSidebar(node, `chat-settings-${conversationId}`, { hideHeader: true });
                                } else {
                                  // Mobile: bottom drawer z-[1401] per chrome-surfaces / openbricks opaque
                                  setChatSettingsOpen(true);
                                }
                            }}
                            sx={{ color: 'text.secondary', pointerEvents: 'auto', position: 'relative', zIndex: 2 }}
                            aria-label="Hangout settings"
                            // ensure hit area above AppBar stacking context trap
                        >
                            <MoreVertical size={20} strokeWidth={1.5} />
                        </IconButton>
                    </Stack>
                </Toolbar>
            </AppBar>

            {/* Clear Options Drawer */}
            <Drawer
                anchor="bottom"
                open={clearOptionsOpen}
                onClose={() => setClearOptionsOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#161412',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '24px 24px 0 0',
                        p: 3,
                        pb: isMobile ? 6 : 4,
                        zIndex: 2000}
                }}
            >
                <Box sx={{ maxWidth: 500, mx: 'auto', width: '100%' }}>
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 900, mb: 1 }}>Clear Chat</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', mb: 3 }}>
                        Choose how you want to clear the messages in this conversation.
                    </Typography>
                    
                    <Stack gap={1.5}>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={() => handleClearChat('me')}
                            sx={{ 
                                py: 1.5, 
                                borderRadius: '14px', 
                                color: 'white', 
                                borderColor: 'rgba(255,255,255,0.1)',
                                textTransform: 'none',
                                fontWeight: 700,
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.2)' }
                            }}
                        >
                            For Me (Soft Delete)
                        </Button>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => handleClearChat('everyone')}
                            sx={{ 
                                py: 1.5, 
                                borderRadius: '14px', 
                                bgcolor: '#ff4d4d', 
                                color: 'white', 
                                textTransform: 'none',
                                fontWeight: 800,
                                '&:hover': { bgcolor: '#ff3333' }
                            }}
                        >
                            For Everyone (Messages + Reactions)
                        </Button>
                        {conversation?.type === 'direct' && (
                            <Button
                                fullWidth
                                onClick={() => handleClearChat('nuclear')}
                                sx={{ color: '#ff4d4d', textTransform: 'none', fontWeight: 800, mt: 0.5 }}
                            >
                                Permanently delete for everyone
                            </Button>
                        )}
                        <Button
                            fullWidth
                            onClick={() => setClearOptionsOpen(false)}
                            sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'none', fontWeight: 600, mt: 1 }}
                        >
                            Cancel
                        </Button>
                    </Stack>
                </Box>
            </Drawer>

            {/* Hangout settings: mobile bottom drawer z-[1401] / desktop via NativeSidebarBridge */}
            {chatSettingsOpen && (
              <Drawer
                anchor="bottom"
                open={chatSettingsOpen}
                onClose={() => setChatSettingsOpen(false)}
                keepMounted={false}
                disablePortal={true}
                slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.5)' } } }}
                PaperProps={{
                  sx: {
                    bgcolor: '#0A0908',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '24px 24px 0 0',
                    maxHeight: '86dvh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1401,
                  },
                }}
              >
                <ChatSettingsPanel
                  conversation={conversation}
                  conversationId={conversationId}
                  isSelf={!!isSelf}
                  messages={messages}
                  onClose={() => setChatSettingsOpen(false)}
                  onExport={() => { handleExport(); setChatSettingsOpen(false); }}
                  onClearMe={() => { setChatSettingsOpen(false); handleClearChat('me'); }}
                  onClearEveryone={() => { setChatSettingsOpen(false); handleClearChat('everyone'); }}
                  onNuclear={() => { setChatSettingsOpen(false); handleClearChat('nuclear'); }}
                />
              </Drawer>
            )}

            {/* Messages Area */}
            <Box data-scroll-remember={`chat-window-${conversationId}`} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: { xs: 2.5, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2, pb: 'calc(128px + env(safe-area-inset-bottom))', pt: 'calc(84px + env(safe-area-inset-top))', position: 'relative', zIndex: 2 }}>
                {!isUnlocked && conversation?.isEncrypted && (
                    <Box sx={{ p: 2.5, mb: 2, bgcolor: '#161412', borderRadius: '24px', border: '1px solid #1C1A18', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ mb: 2, fontWeight: 800, color: '#6366F1', fontFamily: 'var(--font-clash)', fontSize: '1rem' }}>
                            End-to-End Encrypted Channel
                        </Typography>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => setUnlockModalOpen(true)}
                            startIcon={<Key size={16} strokeWidth={2} />}
                            sx={{ 
                                borderRadius: '12px', 
                                fontWeight: 900,
                                bgcolor: '#6366F1',
                                color: '#fff',
                                textTransform: 'none',
                                px: 3,
                                '&:hover': {
                                    bgcolor: '#575CF0'}
                            }}
                        >
                            Unlock to Read
                        </Button>
                    </Box>
                )}
                {messagesLoading && messages.length === 0 ? (
                    <div className="flex flex-col gap-3 py-2 animate-pulse">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className="h-12 w-[55%] rounded-2xl bg-white/[0.04] border border-white/[0.04]" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        {messages.map((msg, index) => (
                        <React.Fragment key={msg.$id}>
                            {index === clientReadSegments.firstUnreadIncomingIndex && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                                    <Box sx={{ px: 2, py: 0.6, borderRadius: '999px', bgcolor: '#161412', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                                        <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#F59E0B', fontFamily: 'var(--font-mono)' }}>
                                            Unread payload
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                        {(() => {
                            const isOutgoing = msg.senderId === user?.$id;
                            const senderProfile = senderProfiles[msg.senderId] || getCachedIdentityById(msg.senderId);
                            const senderVerification = getVerificationState(senderProfile?.preferences || null);
                            const senderName = isOutgoing
                                ? 'You'
                                : senderProfile?.displayName || senderProfile?.username || (conversation?.type === 'direct' ? conversationDisplayName || 'Partner' : `@${String(msg.senderId || '').slice(0, 7)}`);

                            return (
                                <div
                                    id={`msg-${msg.$id}`}
                                    className="chat-message-bubble w-full flex relative z-[2]"
                                    style={{ justifyContent: isOutgoing ? 'flex-end' : 'flex-start' }}
                                >
                                    <div
                                        className={`flex items-end gap-2.5 w-full max-w-[88%] sm:max-w-[80%] ${
                                            isOutgoing ? 'flex-row-reverse' : 'flex-row'
                                        }`}
                                    >
                                        <div className="shrink-0 mb-0.5">
                                            <IdentityAvatar
                                                userId={msg.senderId}
                                                fileId={senderProfile?.avatar || null}
                                                alt={senderName}
                                                fallback={senderName.slice(0, 1).toUpperCase()}
                                                size={30}
                                                borderRadius="50%"
                                            />
                                        </div>
                                        <div
                                            className={`min-w-0 flex-1 flex flex-col gap-1 ${
                                                isOutgoing ? 'items-end' : 'items-start'
                                            }`}
                                        >
                                            {!isOutgoing && (
                                                <span className="px-1 text-[11px] font-bold text-white/40 font-mono tracking-wide">
                                                    {senderName}
                                                    {senderVerification.verified ? ' ✓' : ''}
                                                </span>
                                            )}
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onContextMenu={(e: React.MouseEvent) => handleMessageContextMenu(e, msg)}
                                                className={`relative w-fit max-w-full rounded-[18px] px-3.5 py-2.5 text-left ${
                                                    isOutgoing
                                                        ? 'bg-[#161412] border border-white/[0.06] rounded-br-md'
                                                        : 'bg-[#161412] border border-white/[0.06] rounded-bl-md'
                                                }`}
                                            >
                                                {msg.isPinned ? (
                                                    <span className="inline-flex items-center gap-1 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F59E0B]">
                                                        <Pin size={10} fill="#F59E0B" color="#F59E0B" />
                                                        Pinned
                                                    </span>
                                                ) : null}
                                                {msg.replyTo && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const el = document.getElementById(`msg-${msg.replyTo}`);
                                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        }}
                                                        className="mb-2 w-full text-left rounded-xl bg-[#0A0908] border border-white/[0.04] border-l-[3px] border-l-[#F59E0B] px-2.5 py-1.5"
                                                    >
                                                        <span className="block text-[11px] font-extrabold text-[#F59E0B] mb-0.5">
                                                            {messages.find(m => m.$id === msg.replyTo)?.senderId === user?.$id ? 'You' : (conversationDisplayName || 'Partner')}
                                                        </span>
                                                        <span className="block text-xs text-white/50 line-clamp-2 leading-[1.35] font-satoshi">
                                                            {messages.find(m => m.$id === msg.replyTo)?.content || 'Original message'}
                                                        </span>
                                                    </button>
                                                )}
                                                <div className="min-w-0 [overflow-wrap:anywhere] text-[0.9375rem] leading-[1.45] font-satoshi font-medium text-[#F5F2ED]">
                                                    <ChatMessageContent
                                                        msg={msg}
                                                        isUnlocked={isUnlocked}
                                                        conversationId={conversationId}
                                                        linkPreviewsEnabled={ownLinkPreviewsEnabled}
                                                        onDecrypted={(id, decrypted) =>
                                                            setMessages((prev) =>
                                                                prev.map((m) =>
                                                                    (m.$id || m.id) === id ? { ...m, content: decrypted } : m
                                                                )
                                                            )
                                                        }
                                                    />
                                                </div>
                                            </div>
                                            {(() => {
                                                const reactionGroups = sortReactionGroups(reactionsByMessageId[msg.$id] || [], user?.$id).slice(0, 3);
                                                if (!reactionGroups.length) return null;

                                                return (
                                                    <div
                                                        className={`flex flex-wrap gap-1.5 px-1 ${
                                                            isOutgoing ? 'justify-end' : 'justify-start'
                                                        }`}
                                                    >
                                                        {reactionGroups.map((reaction) => (
                                                            <button
                                                                key={reaction.emoji}
                                                                type="button"
                                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => openReactionPopover(e, msg.$id)}
                                                                className="text-base leading-none opacity-95 hover:opacity-100"
                                                            >
                                                                {reaction.emoji}
                                                            </button>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                            <div
                                                className={`flex items-center gap-1 px-1 ${
                                                    isOutgoing ? 'flex-row-reverse' : 'flex-row'
                                                }`}
                                            >
                                                <span className="text-[10px] font-semibold text-white/40 tabular-nums">
                                                    {formatTime(new Date(msg.$createdAt || Date.now()), { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                </span>
                                                {isOutgoing && (
                                                    <span className="inline-flex items-center text-white/40">
                                                        {(msg as any).status === 'error' ? (
                                                            <span className="text-[10px] text-[#ff4d4d]">Failed</span>
                                                        ) : (
                                                            <SyncStatusDot
                                                                pending={
                                                                    String(msg.$id).startsWith('optimistic-') ||
                                                                    (msg as any).status === 'sending'
                                                                }
                                                            />
                                                        )}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        </React.Fragment>
                        ))}
                    </>
                )}
                <div ref={messagesEndRef} />
            </Box>

            <Popover
                open={Boolean(reactionPopoverAnchorEl && reactionPopoverMessageId)}
                anchorEl={reactionPopoverAnchorEl}
                onClose={closeReactionPopover}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                PaperProps={{
                    sx: {
                        mt: 1.5,
                        minWidth: 240,
                        maxWidth: 320,
                        borderRadius: '16px',
                        bgcolor: '#1C1A18',
                        border: '1px solid #34322F',
                        backgroundImage: 'none',
                        p: 2,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.5)'}
                }}
            >
                <Stack spacing={1}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        Reactions
                    </Typography>
                    {reactionPopoverGroups.length ? (
                        reactionPopoverGroups.map((group) => (
                            <Box key={group.emoji} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography component="div" sx={{ fontSize: '1rem', lineHeight: 1 }}>
                                    {group.emoji}
                                </Typography>
                                <Stack spacing={0.35}>
                                    {group.actors.map((actor) => (
                                        <Typography
                                            key={`${group.emoji}-${actor.userId}`}
                                            variant="body2"
                                            sx={{
                                                fontSize: '0.82rem',
                                                color: actor.isSelf ? '#F59E0B' : 'text.secondary',
                                                fontWeight: actor.isSelf ? 700 : 500}}
                                        >
                                            {actor.label}
                                        </Typography>
                                    ))}
                                </Stack>
                            </Box>
                        ))
                    ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                            No reactions yet.
                        </Typography>
                    )}
                    {reactionPopoverMessage && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem', lineHeight: 1.4 }}>
                            {String(reactionPopoverMessage.content || '').slice(0, 96)}
                        </Typography>
                    )}
                </Stack>
            </Popover>

            {/* Input Area — fixed to chat shell bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-3 sm:px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[#0A0908] border-t border-white/[0.06]">
                {replyingTo && (
                    <div className="mb-2 flex items-center gap-2 rounded-2xl bg-[#161412] border border-white/[0.06] border-l-4 border-l-[#F59E0B] px-3 py-2.5">
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#F59E0B] font-mono">
                                Replying to {replyingTo.senderId === user?.$id ? 'yourself' : (conversationDisplayName || 'Partner')}
                            </span>
                            <span className="text-sm text-white/50 font-satoshi truncate">
                                {replyingTo.content}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplyingTo(null)}
                            className="shrink-0 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06]"
                            aria-label="Cancel reply"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
                <div className="relative z-[2]">
                    <input type="file" hidden ref={fileInputRef} onChange={onFileChange} />

                    <Menu
                        anchorEl={attachAnchorEl}
                        open={Boolean(attachAnchorEl)}
                        onClose={() => setAttachAnchorEl(null)}
                        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        PaperProps={{
                            sx: {
                                mb: 1.5,
                                borderRadius: '16px',
                                bgcolor: '#1C1A18',
                                border: '1px solid #34322F',
                                backgroundImage: 'none',
                                minWidth: 200,
                                boxShadow: '0 12px 32px rgba(0,0,0,0.5)'}
                        }}
                    >
                        <MenuItem onClick={() => { handleFileSelect('*'); setAttachAnchorEl(null); }} sx={{ gap: 1.5, py: 1.5, px: 2, fontWeight: 700, fontSize: '0.85rem', '&:hover': { bgcolor: '#252321' } }}>
                            <FileIcon size={18} strokeWidth={2} color="#9B9691" /> Upload File
                        </MenuItem>
                        <MenuItem onClick={() => { setNoteModalOpen(true); setAttachAnchorEl(null); }} sx={{ gap: 1.5, py: 1.5, px: 2, fontWeight: 700, fontSize: '0.85rem', '&:hover': { bgcolor: '#252321' } }}>
                            <FileText size={18} strokeWidth={2} color="#9B9691" /> Attach Note
                        </MenuItem>
                        <MenuItem onClick={() => { setSecretModalOpen(true); setAttachAnchorEl(null); }} sx={{ gap: 1.5, py: 1.5, px: 2, fontWeight: 700, fontSize: '0.85rem', '&:hover': { bgcolor: '#252321' } }}>
                            <Key size={18} strokeWidth={2} color="#9B9691" /> Attach Secret
                        </MenuItem>
                    </Menu>

                    <ChatDraftInput
                        key={conversationId}
                        attachment={attachment}
                        pendingObject={pendingObject}
                        sending={sending}
                        isRecording={isRecording}
                        attachmentDisabled={!isProPlan}
                        enableMentions={conversation?.type === 'group'}
                        mentionTargets={groupMentionTargets}
                        canBroadcastTyping={conversation?.type === 'direct' && ownTypingEnabled && partnerTypingEnabled}
                        isDirect={conversation?.type === 'direct'}
                        onAttach={() => {
                            openFileDrawer({
                                title: 'Attach to chat',
                                onSelectFile: (file: any) => {
                                    const parsed = parseChatAttachFile(file);
                                    if (parsed) setPendingObject(parsed);
                                },
                            });
                        }}
                        onClearAttachment={() => setAttachment(null)}
                        onClearPendingObject={() => setPendingObject(null)}
                        onUpgradeRequested={() => showUpgradeIsland('attach files/images/videos')}
                        onSend={handleSend}
                        onToggleRecording={toggleRecording}
                        typingUsers={typingUsers}
                        conversationId={conversationId}
                        typingTimeoutRef={typingTimeoutRef}
                    />
                </div>
            </div>

            <NoteSelectorModal
                open={noteModalOpen}
                onClose={() => setNoteModalOpen(false)}
                onSelect={handleNoteSelect}
            />
            <SecretSelectorModal
                open={secretModalOpen}
                onClose={() => setSecretModalOpen(false)}
                onSelect={handleSecretSelect}
                isSelf={isSelf || false}
            />
            <SudoModal
                isOpen={unlockModalOpen}
                onCancel={() => setUnlockModalOpen(false)}
                onSuccess={() => {
                    setUnlockModalOpen(false);
                    setIsUnlocked(true);
                    loadMessages();
                    loadConversation();
                }}
            />

            {/* OpenBricks Message Actions Bottom Drawer */}
            <Drawer
                anchor="bottom"
                open={Boolean(messageAnchorEl)}
                onClose={() => setMessageAnchorEl(null)}
                keepMounted={false}
                disablePortal={false}
                sx={{ zIndex: 11000 }}
                PaperProps={{
                    sx: {
                        position: 'fixed !important',
                        bottom: '0 !important',
                        left: '0 !important',
                        right: '0 !important',
                        borderTopLeftRadius: '24px',
                        borderTopRightRadius: '24px',
                        bgcolor: '#161412',
                        borderTop: '1px solid #34322F',
                        backgroundImage: 'none',
                        maxWidth: 600,
                        width: '100%',
                        mx: 'auto',
                        p: 2.5,
                        pb: 'max(24px, env(safe-area-inset-bottom))',
                        pointerEvents: 'auto'
                    }
                }}
                ModalProps={{
                    keepMounted: false,
                    disableScrollLock: false
                }}
            >
                {messageAnchorEl?.msg && (
                    <div className="flex flex-col gap-3.5 select-none font-satoshi">
                        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" aria-hidden />

                        {/* Scrollable Quick Reactions Row */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {['👍', '❤️', '🔥', '⚡', '😂', '😮', '😢', '👏', '🎉', '🚀', '💯'].map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleReact(emoji)}
                                    className="h-10 w-10 shrink-0 rounded-2xl bg-[#0A0908] border border-white/[0.06] hover:border-amber-400/40 hover:bg-white/5 flex items-center justify-center text-lg transition-all"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>

                        {/* Actions List */}
                        <div className="space-y-1.5 pt-1">
                            {/* Zap Message */}
                            <button
                                type="button"
                                onClick={() => {
                                    const msg = messageAnchorEl.msg;
                                    setMessageAnchorEl(null);
                                    openUnifiedDrawer('zap', {
                                        targetId: msg.$id,
                                        source: 'ecosystem',
                                        targetKind: 'chat',
                                        targetOwnerId: msg.senderId,
                                        authorName: conversationDisplayName || 'Message Author',
                                    });
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-sm font-bold text-amber-300 hover:bg-amber-400/20 transition-all text-left cursor-pointer"
                            >
                                <Zap size={16} className="text-amber-400 fill-current" />
                                <span>Zap Message (Send rix)</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleReply(messageAnchorEl.msg)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0A0908] border border-white/[0.04] text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
                            >
                                <Reply size={16} className="text-white/60" />
                                <span>Reply</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleCopy(messageAnchorEl.msg.content as string)}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0A0908] border border-white/[0.04] text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
                            >
                                <Copy size={16} className="text-white/60" />
                                <span>Copy Text</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleTogglePinMessage}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#0A0908] border border-white/[0.04] text-sm font-bold text-white hover:bg-white/5 transition-all text-left cursor-pointer"
                            >
                                <Pin size={16} className={messageAnchorEl.msg.isPinned ? 'text-[#F59E0B]' : 'text-white/60'} />
                                <span>{messageAnchorEl.msg.isPinned ? 'Unpin message' : 'Pin message'}</span>
                            </button>

                            {messageAnchorEl.msg.senderId === user?.$id && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        _handleDeleteMessage(messageAnchorEl.msg.$id, true);
                                        setMessageAnchorEl(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm font-bold text-red-400 hover:bg-red-500/20 transition-all text-left cursor-pointer"
                                >
                                    <Trash2 size={16} className="text-red-400" />
                                    <span>Delete</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>
        </Box>
    );
}
