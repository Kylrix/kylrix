'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useNostrIdentity } from '@/hooks/useNostrIdentity';
import {
  createMomentComment,
  loadMomentEngagement,
  parseMomentRouteId,
  toggleMomentLike,
  type MomentComment,
  type MomentSource,
} from '@/lib/connect/moment-engagement';
import { extractPostImages } from '@/lib/connect/moment-media';
import { SocialService } from '@/lib/services/social';
import { UsersService } from '@/lib/services/users';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { ArrowLeft, Globe, Heart, Link2, Lock, MessageCircle, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

type PreviewSeed = {
  authorName?: string;
  authorAvatar?: string;
  content?: string;
};

function initials(name: string) {
  const parts = name.replace(/^@/, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

/**
 * Moment detail body — overflow-locked for mobile fullscreen object detail.
 */
export function PostViewClient({
  id: propId,
  onBack,
  preview,
}: {
  id?: string;
  onBack?: () => void;
  preview?: PreviewSeed;
} = {}) {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { identity, isVaultLocked, unlockAndLoad } = useNostrIdentity();
  const rawId =
    propId || (Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined));
  const parsed = rawId ? parseMomentRouteId(rawId) : null;

  const [source, setSource] = useState<MomentSource>(parsed?.source || 'ecosystem');
  const [momentId, setMomentId] = useState(parsed?.id || '');
  const [moment, setMoment] = useState<any>(
    preview?.content
      ? { caption: preview.content, content: preview.content }
      : null,
  );
  const [creator, setCreator] = useState<any>(
    preview?.authorName
      ? { displayName: preview.authorName, avatarUrl: preview.authorAvatar }
      : null,
  );
  const [replies, setReplies] = useState<MomentComment[]>([]);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(!preview?.content);
  const [replyContent, setReplyContent] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!parsed) return;
    setSource(parsed.source);
    setMomentId(parsed.id);
  }, [parsed?.source, parsed?.id]);

  const load = useCallback(async () => {
    if (!momentId) return;
    if (!preview?.content) setLoading(true);
    try {
      if (source === 'ecosystem') {
        const data = await SocialService.getMomentById(momentId);
        setMoment(data);
        const creatorId = data?.userId || data?.creatorId;
        if (creatorId) {
          try {
            setCreator(await UsersService.getProfileById(creatorId));
          } catch {
            /* keep preview */
          }
        }
      } else {
        try {
          const cached = localStorage.getItem('kylrix_nostr_feed_cache');
          if (cached) {
            const events = JSON.parse(cached) as Array<{
              id: string;
              content: string;
              pubkey: string;
              created_at: number;
            }>;
            const hit = events.find((e) => e.id === momentId);
            if (hit) {
              setMoment({
                id: hit.id,
                caption: hit.content,
                content: hit.content,
                pubkey: hit.pubkey,
                createdAt: hit.created_at * 1000,
              });
            }
          }
        } catch {
          /* ignore */
        }
      }

      const engagement = await loadMomentEngagement({
        source,
        id: momentId,
        userId: user?.$id,
      });
      setReplies(engagement.comments);
      setLikes(engagement.likesCount);
      setLiked(Boolean(engagement.isLiked));
    } catch (e) {
      console.error('Failed to load moment', e);
      if (!preview?.content) setMoment(null);
    } finally {
      setLoading(false);
    }
  }, [momentId, source, user?.$id, preview?.content]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  const toggleLike = async () => {
    if (!momentId || busy) return;
    if (source === 'nostr' && (isVaultLocked || !identity)) {
      toast.error('Unlock vault to like on Nostr');
      void unlockAndLoad();
      return;
    }
    if (source === 'ecosystem' && !user?.$id) return;

    setBusy(true);
    const prevLiked = liked;
    const prevLikes = likes;
    setLiked(!prevLiked);
    setLikes(prevLiked ? Math.max(0, prevLikes - 1) : prevLikes + 1);
    try {
      await toggleMomentLike({
        source,
        id: momentId,
        userId: user?.$id,
        creatorId: moment?.userId || moment?.creatorId,
        contentSnippet: moment?.caption || moment?.content,
        privateKeyBytes: identity?.privateKeyBytes,
        rootPubkey: moment?.pubkey,
      });
    } catch (e) {
      setLiked(prevLiked);
      setLikes(prevLikes);
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    const text = replyContent.trim();
    if (!momentId || !text || busy) return;

    if (source === 'nostr' && (isVaultLocked || !identity)) {
      toast.error('Unlock vault to comment on Nostr');
      void unlockAndLoad();
      return;
    }
    if (source === 'ecosystem' && !user) return;

    setBusy(true);
    try {
      const created = await createMomentComment({
        source,
        id: momentId,
        content: text,
        userId: user?.$id,
        privateKeyBytes: identity?.privateKeyBytes,
        rootPubkey: moment?.pubkey,
      });
      setReplyContent('');
      if (created) setReplies((prev) => [...prev, created]);
      else await load();
    } catch (e) {
      console.error(e);
      toast.error('Could not post reply');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      const url =
        source === 'nostr'
          ? `${window.location.origin}/moment/nostr_${momentId}`
          : buildPublicResourceUrl('moment', momentId);
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      /* ignore */
    }
  };

  const who = useMemo(() => {
    if (source === 'nostr') {
      if (preview?.authorName) return preview.authorName.replace(/^@/, '');
      if (moment?.pubkey) return `npub…${String(moment.pubkey).slice(-8)}`;
      return 'Nostr';
    }
    return (
      creator?.displayName ||
      creator?.username ||
      preview?.authorName ||
      'Someone'
    );
  }, [source, preview?.authorName, moment?.pubkey, creator]);

  const avatarUrl =
    creator?.avatarUrl || creator?.prefs?.avatarUrl || preview?.authorAvatar;
  const handle =
    creator?.username ||
    (source === 'nostr' && moment?.pubkey
      ? `npub…${String(moment.pubkey).slice(-8)}`
      : who);
  const rawBody = moment?.caption || moment?.content || preview?.content || '';
  const { text: body, images } = extractPostImages(rawBody);
  const isNostr = source === 'nostr';

  if (loading) {
    return (
      <div className="h-full w-full max-w-full min-w-0 overflow-x-hidden flex items-center justify-center text-white/50 text-sm">
        Loading…
      </div>
    );
  }

  if (!moment && !preview?.content && source === 'ecosystem') {
    return (
      <div className="h-full w-full max-w-full min-w-0 overflow-x-hidden flex flex-col items-center justify-center gap-3 text-white px-6">
        <p className="text-sm text-white/60">This post is not available.</p>
        <button type="button" onClick={handleBack} className="text-sm font-bold text-[#F59E0B]">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto text-white bg-[#0A0908]">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-[#0A0908] border-b border-[#34322F]">
        <button
          type="button"
          onClick={handleBack}
          className="p-2 rounded-xl bg-[#161412] border border-[#34322F] text-white/60 hover:text-white shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm font-extrabold font-clash truncate">Moment</span>
      </div>

      <div className="px-3 sm:px-4 py-4 space-y-3 min-w-0 max-w-full">
        <article className="rounded-[22px] border border-[#34322F] bg-[#161412] p-4 space-y-3 min-w-0 max-w-full overflow-hidden">
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-[11px] font-black border border-white/[0.06] overflow-hidden bg-[#0A0908]"
              style={{ color: isNostr ? '#F59E0B' : '#34D399' }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials(who)
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-[15px] font-extrabold text-white font-satoshi truncate m-0">
                  {who}
                </p>
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0A0908] border border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-white/45">
                  {isNostr ? (
                    <Globe size={11} className="text-[#F59E0B]" />
                  ) : (
                    <Shield size={11} className="text-emerald-400" />
                  )}
                  {isNostr ? 'Nostr' : 'Kylrix'}
                </span>
              </div>
              <p className="text-[13px] text-white/40 font-medium truncate m-0 mt-0.5">
                {handle.startsWith('@') || handle.startsWith('npub') ? handle : `@${handle}`}
              </p>
            </div>
          </div>

          {body ? (
            <p className="text-[16px] leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-satoshi text-white/[0.92] m-0 max-w-full">
              {body}
            </p>
          ) : null}

          {images.length > 0 ? (
            <div
              className={`w-full max-w-full h-[200px] rounded-xl overflow-hidden border border-white/[0.06] bg-[#0A0908] grid ${
                images.length > 1 ? 'grid-cols-2 gap-0.5' : 'grid-cols-1'
              }`}
            >
              {images.slice(0, 2).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="w-full h-full max-w-full object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : null}

          {moment?.mediaUrl || moment?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={moment.mediaUrl || moment.imageUrl}
              alt=""
              className="w-full max-w-full h-[200px] rounded-xl border border-white/[0.06] object-cover bg-[#0A0908]"
            />
          ) : null}

          <div className="flex items-center gap-4 pt-2 border-t border-white/[0.06] min-w-0">
            <button
              type="button"
              disabled={busy}
              onClick={() => void toggleLike()}
              className={`inline-flex items-center gap-1.5 text-sm font-bold disabled:opacity-40 shrink-0 ${
                liked ? 'text-[#F91880]' : 'text-white/60 hover:text-[#F91880]'
              }`}
            >
              <Heart size={16} className={liked ? 'fill-[#F91880]' : ''} />
              {likes}
            </button>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white/40 shrink-0">
              <MessageCircle size={16} />
              {replies.length}
            </span>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-white/60 hover:text-white ml-auto shrink-0"
            >
              <Link2 size={16} />
              <span className="hidden sm:inline">Copy link</span>
            </button>
          </div>
        </article>

        <div className="flex gap-2 min-w-0 max-w-full">
          <input
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void sendReply();
              }
            }}
            placeholder={
              source === 'nostr' && isVaultLocked
                ? 'Unlock vault to reply…'
                : 'Write a reply…'
            }
            className="min-w-0 flex-1 rounded-xl bg-[#161412] border border-[#34322F] px-4 py-2.5 text-sm outline-none focus:border-white/20"
          />
          {source === 'nostr' && isVaultLocked ? (
            <button
              type="button"
              onClick={() => void unlockAndLoad()}
              className="shrink-0 rounded-xl bg-[#F59E0B]/15 text-[#F59E0B] font-bold text-sm px-3 inline-flex items-center gap-1.5 border border-[#F59E0B]/30"
            >
              <Lock size={14} /> Unlock
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !replyContent.trim() || (source === 'ecosystem' && !user)}
              onClick={() => void sendReply()}
              className="shrink-0 rounded-xl bg-[#F59E0B] text-black font-bold text-sm px-4 disabled:opacity-40"
            >
              Reply
            </button>
          )}
        </div>

        <ul className="space-y-2 min-w-0 max-w-full list-none p-0 m-0">
          {replies.length === 0 ? (
            <li className="rounded-[18px] border border-[#34322F] bg-[#161412] px-4 py-8 text-center text-sm text-white/35">
              No comments yet
            </li>
          ) : (
            replies.map((r) => (
              <li
                key={r.id}
                className="rounded-[18px] border border-[#34322F] bg-[#161412] px-4 py-3.5 min-w-0 max-w-full overflow-hidden"
              >
                <div className="text-[11px] font-bold text-white/40 mb-1 truncate">
                  {r.authorName}
                </div>
                <p className="text-[14px] text-white/85 whitespace-pre-wrap break-words [overflow-wrap:anywhere] m-0 font-satoshi max-w-full">
                  {r.content}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
