import type { Metadata } from 'next';
import { SocialService } from '@/lib/services/social';
import { UsersService } from '@/lib/services/users';
import { resolveIdentity } from '@/lib/identity-format';
import { PostViewClient } from '@/app/(app)/connect/post/[id]/PostViewClient';

function collapseWs(input: string) {
  return input.replace(/\s+/g, ' ').trim();
}

function trimMax(input: string, max: number) {
  const t = collapseWs(input);
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const params = await props.params;
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    const cleanId = id.startsWith('nostr_') ? id.slice(6) : id;
    if (/^[0-9a-f]{64}$/i.test(cleanId) || id.startsWith('nostr_')) {
      return { title: 'Moment — Kylrix' };
    }

    const moment = await SocialService.getMomentById(cleanId);
    const creatorId = moment.userId || moment.creatorId;
    const creator = await UsersService.getProfileById(creatorId);
    const who = resolveIdentity(creator, creatorId);
    const captionRaw = typeof moment.caption === 'string' ? moment.caption.trim() : '';
    const description = captionRaw
      ? trimMax(captionRaw, 260)
      : `Moment by ${who.displayName}`;
    const title = captionRaw
      ? `${trimMax(captionRaw, 72)} — ${who.displayName}`
      : `${who.displayName} · Moment`;

    return {
      title,
      description,
      alternates: { canonical: `/moment/${cleanId}` },
    };
  } catch {
    return { title: 'Moment — Kylrix' };
  }
}

/** Canonical share surface: /moment/[id] (also accepts nostr_<hex>). */
export default function MomentSharePage() {
  return (
    <div className="min-h-[100dvh] bg-[#000000] pt-6 pb-16">
      <PostViewClient />
    </div>
  );
}
