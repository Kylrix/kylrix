'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import {

export function CommentMomentRow(bag: any) {
  const {
  CommentMomentRow,
  avatarUrl,
  busy,
  c,
  creator,
  d,
  dualNostrId,
  engagementDrawer,
  eventType,
  first,
  handle,
  handleBack,
  handleShare,
  isNostr,
  isReaction,
  isReply,
  isRepost,
  liked,
  likes,
  loading,
  moment,
  momentId,
  nostrEvent,
  nostrKind,
  onRepost,
  onZap,
  openCommentProfile,
  openReplyComposer,
  params,
  parentEvent,
  parentLoading,
  parsed,
  parts,
  preview,
  rawBody,
  rawId,
  reactionContent,
  ref,
  replies,
  reply,
  reposted,
  reposts,
  root,
  router,
  setBusy,
  setCreator,
  setEngagementDrawer,
  setLiked,
  setLikes,
  setLoading,
  setMoment,
  setMomentId,
  setNostrEvent,
  setParentEvent,
  setParentLoading,
  setReplies,
  setReposted,
  setReposts,
  setSource,
  setZaps,
  showParent,
  source,
  toggleLike,
  who,
  zaps
  } = bag as any;

  const { open: openUnifiedDrawer } = useUnifiedDrawer();
  const [liked, setLiked] = useState(Boolean(comment.isLiked));
  const [likes, setLikes] = useState(Number(comment.likesCount || 0));
  const [reposts, setReposts] = useState(
    Number((comment.raw as any)?.stats?.pulses || (comment.raw as any)?.repostCount || 0),
  );
  const [zaps, setZaps] = useState(
    Number((comment.raw as any)?.stats?.zaps || (comment.raw as any)?.zapCount || 0),
  );
  const [reposted, setReposted] = useState(false);
  const [busy, setBusy] = useState(false);
  const isNostr = comment.source === 'nostr';
  const avatarUrl = comment.authorAvatar;
  const dualNostrId = !isNostr
    ? String((comment.raw as any)?.nostrId || '').trim() || undefined
    : undefined;

  const toggleLike = async () => {
    if (busy) return;
    if (isNostr) {
      if (isVaultLocked || !identity) {
        toast.error('Unlock vault to like on Nostr');
        void unlockAndLoad();
        return;
      }
    } else if (!userId) {
      toast.error('Sign in to like');
      return;
    }
    setBusy(true);
    const prevLiked = liked;
    const prevLikes = likes;
    setLiked(!prevLiked);
    setLikes(prevLiked ? Math.max(0, prevLikes - 1) : prevLikes + 1);
    try {
      await toggleMomentLike({
        source: comment.source,
        id: comment.id,
        userId,
        creatorId: comment.authorUserId,
        contentSnippet: comment.content.slice(0, 80),
        privateKeyBytes: identity?.privateKeyBytes,
        nsec: identity?.nsec,
        rootPubkey: comment.authorPubkey,
        nostrId: dualNostrId,
      });
    } catch (err) {
      setLiked(prevLiked);
      setLikes(prevLikes);
      console.error(err);
      toast.error('Could not update like');
    } finally {
      setBusy(false);
    }
  };

  const onRepost = async () => {
    if (busy || reposted) return;
    if (isNostr) {
      if (isVaultLocked || !identity) {
        toast.error('Unlock vault to pulse on Nostr');
        void unlockAndLoad();
        return;
      }
    } else if (!userId) {
      toast.error('Sign in to pulse');
      return;
    }
    setBusy(true);
    setReposted(true);
    setReposts((n) => n + 1);
    try {
      const { repostMoment } = await import('@/lib/connect/moment-engagement');
      await repostMoment({
        source: comment.source,
        id: comment.id,
        userId,
        creatorId: comment.authorUserId,
        privateKeyBytes: identity?.privateKeyBytes,
        nsec: identity?.nsec,
        rootPubkey: comment.authorPubkey,
        nostrId: dualNostrId || (isNostr ? comment.id : undefined),
      });
      toast.success('Pulsed to feed');
    } catch (err: any) {
      setReposted(false);
      setReposts((n) => Math.max(0, n - 1));
      toast.error(err?.message || 'Could not pulse');
    } finally {
      setBusy(false);
    }
  };

  const onZap = () => {
    const availableSources: Array<'ecosystem' | 'nostr'> = [];
    if (!isNostr) availableSources.push('ecosystem');
    if (isNostr || dualNostrId) availableSources.push('nostr');
    openUnifiedDrawer('zap', {
      targetId: comment.id,
      source: isNostr ? 'nostr' : 'ecosystem',
      availableSources,
      ecosystemTargetId: isNostr ? undefined : comment.id,
      nostrTargetId: isNostr ? comment.id : dualNostrId,
      targetKind: 'moment',
      targetOwnerId: comment.authorUserId,
      targetPubkey: comment.authorPubkey,
      authorName: comment.authorName,
      onZapSuccess: (amount: number) => setZaps((n) => n + amount),
    });
  };

  return (
    <li className="rounded-[18px] border-2 border-white/20 bg-[#000000] px-4 py-3.5 min-w-0 max-w-full overflow-hidden list-none">
      <div className="flex items-start gap-3 min-w-0">
        <button
          type="button"
          onClick={() => onOpenProfile(comment)}
          className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black border-2 border-white/20 overflow-hidden bg-[#161412] cursor-pointer"
          style={{ color: isNostr ? '#F59E0B' : '#34D399' }}
          aria-label={`Open ${comment.authorName} profile`}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials(comment.authorName)
          )}
        </button>
        <div className="min-w-0 flex-1 overflow-hidden space-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => onOpenProfile(comment)}
              className="text-[14px] font-extrabold text-white font-satoshi truncate m-0 cursor-pointer hover:underline text-left bg-transparent border-0 p-0"
            >
              {comment.authorName}
            </button>
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#161412] border border-white/15 text-[9px] font-bold uppercase tracking-wider text-white/70">
              {isNostr ? <Globe size={10} className="text-[#F59E0B]" /> : <Shield size={10} className="text-emerald-400" />}
              {isNostr ? 'Nostr' : 'Kylrix'}
            </span>
            <span className="ml-auto text-[10px] text-white/35 font-mono shrink-0">
              {formatTs(comment.createdAt)}
            </span>
          </div>
          <EcosystemRichText text={comment.content} proseClassName="text-[14px] text-white" />
          <div className="flex items-center gap-4 pt-2 border-t border-white/15 min-w-0 flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleLike()}
              className={`inline-flex items-center gap-1.5 text-xs font-bold disabled:opacity-40 shrink-0 ${liked ? 'text-[#F91880]' : 'text-white hover:text-[#F91880]'}`}
            >
              <Heart size={14} className={liked ? 'fill-[#F91880]' : ''} />
              <span className="font-mono">{likes}</span>
            </button>
            <button
              type="button"
              onClick={() => onReply(comment)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-[#F59E0B] shrink-0"
            >
              <MessageCircle size={14} />
              <span className="font-mono">{comment.repliesCount || 0}</span>
            </button>
            <button
              type="button"
              disabled={busy || reposted}
              onClick={() => void onRepost()}
              className={`inline-flex items-center gap-1.5 text-xs font-bold disabled:opacity-40 shrink-0 ${reposted ? 'text-[#00BA7C]' : 'text-white hover:text-[#00BA7C]'}`}
            >
              <Repeat2 size={14} />
              <span className="font-mono">{reposts}</span>
            </button>
            <button
              type="button"
              onClick={onZap}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:text-[#F59E0B] shrink-0"
            >
              <Zap size={14} className={zaps > 0 ? 'text-[#F59E0B] fill-[#F59E0B]' : ''} />
              <span className="font-mono">{zaps}</span>
            </button>
            <button
              type="button"
              onClick={() =>
                openUnifiedDrawer('share-context', {
                  resourceType: 'moment',
                  resourceId: isNostr ? `nostr_${comment.id}` : comment.id,
                  resourceTitle: `${comment.authorName.replace(/^@/, '')}'s comment`,
                  content: comment.content,
                  accentColor: '#F59E0B',
                })
              }
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-white ml-auto shrink-0"
            >
              <Share2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
