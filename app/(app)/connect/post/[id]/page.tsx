import type { Metadata } from 'next';
import { SocialService } from '@/lib/services/social';
import { UsersService } from '@/lib/services/users';
import { resolveIdentity } from '@/lib/identity-format';
import { PostViewClient } from './PostViewClient';

function collapseWs(input: string) {
    return input.replace(/\s+/g, ' ').trim();
}

function trimMax(input: string, max: number) {
    const t = collapseWs(input);
    if (t.length <= max) return t;
    return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
    try {
        const params = await props.params;
        const id = Array.isArray(params.id) ? params.id[0] : params.id;
        const moment = await SocialService.getMomentById(id);
        const creatorId = moment.userId || moment.creatorId;
        const creator = await UsersService.getProfileById(creatorId);

        const who = resolveIdentity(creator, creatorId);
        const captionRaw = typeof moment.caption === 'string' ? moment.caption.trim() : '';
        const likes = moment.stats?.likes ?? 0;
        const replies = moment.stats?.replies ?? 0;
        const pulses = moment.stats?.pulses ?? 0;
        const engagement = `${likes} likes · ${replies} replies${pulses > 0 ? ` · ${pulses} pulses` : ''}`;
        const description = captionRaw
            ? `${trimMax(captionRaw, 260)} · ${engagement}`
            : `Moment by ${who.displayName} (${who.handle}). ${engagement}.`;
        const title = captionRaw
            ? `${trimMax(captionRaw, 72)} — ${who.displayName}`
            : `${who.displayName} (${who.handle}) · Kylrix Connect`;
        const domain = process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space';
        const url = `https://connect.${domain}/post/${id}`;
        const metadataBase = new URL(
            (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://kylrix.space').replace(
                /\/$/,
                '',
            ),
        );

        return {
            metadataBase,
            title,
            description,
            alternates: { canonical: url },
            openGraph: {
                title,
                description,
                url,
                siteName: 'Kylrix Connect',
                type: 'article',
                locale: 'en_US',
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
            },
        };
    } catch (_e: unknown) {
        return { title: 'Moment - Kylrix Connect' };
    }
}

export default function PostView() {
    return <PostViewClient />;
}
