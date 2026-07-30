'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { SocialService } from '@/lib/services/social';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
import { ArrowLeft, Heart, MessageCircle, Link2 } from 'lucide-react';

/**
 * Slim post / moment detail view (scorched-earth LOC cut).
 * Keeps load, like, reply, share-link, and back — drops export/pulse/edit chrome.
 */
export function PostViewClient({ id: propId, onBack }: { id?: string; onBack?: () => void } = {}) {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const momentId = propId || (Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined));

  const [moment, setMoment] = useState<any>(null);
  const [creator, setCreator] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!momentId) return;
    setLoading(true);
    try {
      const data = await SocialService.getMomentById(momentId);
      setMoment(data);
      const creatorId = data?.userId || data?.creatorId;
      if (creatorId) {
        try {
          setCreator(await UsersService.getProfileById(creatorId));
        } catch {
          setCreator(null);
        }
      }
      try {
        const thread = await SocialService.getReplies(momentId, user?.$id);
        setReplies(Array.isArray(thread) ? thread : []);
      } catch {
        setReplies([]);
      }
    } catch (e) {
      console.error('Failed to load moment', e);
      setMoment(null);
    } finally {
      setLoading(false);
    }
  }, [momentId, user?.$id]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  const toggleLike = async () => {
    if (!momentId || !user?.$id || busy) return;
    setBusy(true);
    try {
      await SocialService.toggleLike(user.$id, momentId, moment?.userId || moment?.creatorId, moment?.caption);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    const text = replyContent.trim();
    if (!momentId || !user || !text || busy) return;
    setBusy(true);
    try {
      await SocialService.createMoment(user.$id, text, 'reply', [], 'public', undefined, undefined, momentId);
      setReplyContent('');
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-white/50 text-sm">
        Loading…
      </div>
    );
  }

  if (!moment) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 text-white px-6">
        <p className="text-sm text-white/60">This post is not available.</p>
        <button type="button" onClick={handleBack} className="text-sm font-bold text-[#F59E0B]">
          Go back
        </button>
      </div>
    );
  }

  const likes = moment.stats?.likes ?? moment.likeCount ?? 0;
  const who = creator?.displayName || creator?.username || 'Someone';

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 text-white">
      <button
        type="button"
        onClick={handleBack}
        className="mb-4 inline-flex items-center gap-2 text-white/50 hover:text-white text-sm font-bold"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="rounded-2xl border border-white/8 bg-[#161412] p-5 space-y-4">
        <div className="text-xs font-bold text-white/40 uppercase tracking-wider">{who}</div>
        {moment.caption ? (
          <p className="text-base leading-relaxed whitespace-pre-wrap">{moment.caption}</p>
        ) : null}
        {moment.mediaUrl || moment.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={moment.mediaUrl || moment.imageUrl}
            alt=""
            className="w-full rounded-xl border border-white/5 object-cover max-h-[420px]"
          />
        ) : null}

        <div className="flex items-center gap-4 pt-2 border-t border-white/5">
          <button
            type="button"
            disabled={!user || busy}
            onClick={() => void toggleLike()}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white/60 hover:text-[#EC4899] disabled:opacity-40"
          >
            <Heart size={16} className={moment.isLiked ? 'fill-[#EC4899] text-[#EC4899]' : ''} />
            {likes}
          </button>
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white/40">
            <MessageCircle size={16} />
            {replies.length}
          </span>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white/60 hover:text-white ml-auto"
          >
            <Link2 size={16} /> Copy link
          </button>
        </div>
      </div>

      {user ? (
        <div className="mt-4 flex gap-2">
          <input
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void sendReply();
              }
            }}
            placeholder="Write a reply…"
            className="flex-1 rounded-xl bg-white/[0.03] border border-white/8 px-3 py-2 text-sm outline-none focus:border-white/20"
          />
          <button
            type="button"
            disabled={busy || !replyContent.trim()}
            onClick={() => void sendReply()}
            className="rounded-xl bg-[#F59E0B] text-black font-bold text-sm px-4 disabled:opacity-40"
          >
            Reply
          </button>
        </div>
      ) : null}

      <ul className="mt-6 space-y-3">
        {replies.map((r: any) => (
          <li key={r.$id || r.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-sm">
            <p className="text-white/80 whitespace-pre-wrap">{r.caption || r.content || r.text || ''}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
