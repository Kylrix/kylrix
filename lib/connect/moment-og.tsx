import { ImageResponse } from 'next/og';

import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { storage } from '@/lib/appwrite/client';
import { resolveIdentity } from '@/lib/identity-format';
import { SocialService } from '@/lib/services/social';
import { UsersService } from '@/lib/services/users';

export const MOMENT_OG_SIZE = { width: 1200, height: 630 } as const;

function collapseWs(s: string) {
    return s.replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number) {
    const t = collapseWs(s);
    if (t.length <= max) return t;
    return `${t.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function pickAvatarFileId(profile: any | null): string | null {
    if (!profile) return null;
    const raw = profile.avatar || profile.avatarFileId || profile.profilePicId || null;
    if (!raw || typeof raw !== 'string') return null;
    if (raw.startsWith('http')) return null;
    if (raw.length < 8) return null;
    return raw;
}

function pickAvatarHref(profile: any | null): string | null {
    if (!profile) return null;
    
    // Check if that user made their avatar available for all: isAvatar is null or true
    if (profile.isAvatar !== undefined && profile.isAvatar === false) {
        return null; // Not public!
    }

    const id = pickAvatarFileId(profile);
    if (!id) {
        const url = profile?.avatarUrl;
        return typeof url === 'string' && url.startsWith('http') ? url : null;
    }
    try {
        return storage
            .getFilePreview(APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES, id, 320, 320)
            .toString();
    } catch (_e: unknown) {
        return null;
    }
}

async function avatarToDataUri(href: string | null): Promise<string | null> {
    if (!href) return null;
    try {
        const res = await fetch(href);
        if (!res.ok) return null;
        const buffer = Buffer.from(await res.arrayBuffer());
        let ct = (res.headers.get('content-type') || '').split(';')[0].trim();
        if (!ct.startsWith('image/')) ct = 'image/jpeg';
        return `data:${ct};base64,${buffer.toString('base64')}`;
    } catch (_e: unknown) {
        return null;
    }
}

function statLine(likes: number, replies: number, pulses: number) {
    const parts = [`${likes} likes`, `${replies} replies`];
    if (pulses > 0) parts.push(`${pulses} pulses`);
    return parts.join(' · ');
}

function fallbackOg() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(155deg,#0d0c0b 0%,#1f1c18 52%,#0a0908 100%)',
                    color: 'rgba(255,255,255,0.75)',
                    fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
            >
                <svg width="80" height="80" viewBox="0 0 100 100" fill="none" style={{ marginBottom: 24 }}>
                    <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" strokeWidth="6" strokeLinecap="round" />
                    <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" strokeWidth="6" strokeLinecap="round" />
                    <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" strokeWidth="6" strokeLinecap="round" />
                    <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" strokeWidth="6" strokeLinecap="round" />
                    <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" strokeWidth="6" strokeLinecap="round" />
                    <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                    <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" strokeWidth="6" strokeLinecap="round" />
                    <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                    <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" strokeWidth="6" strokeLinecap="round" />
                    <circle cx="50" cy="10" r="5" fill="#6366F1" />
                    <circle cx="15" cy="30" r="5" fill="#6366F1" />
                    <circle cx="85" cy="30" r="5" fill="#6366F1" />
                    <circle cx="15" cy="70" r="5" fill="#6366F1" />
                    <circle cx="50" cy="90" r="5" fill="#6366F1" />
                    <circle cx="85" cy="70" r="5" fill="#6366F1" />
                    <circle cx="50" cy="50" r="7" fill="#6366F1" />
                </svg>
                <div
                    style={{
                        fontSize: 48,
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        color: '#fff',
                        marginBottom: 14,
                    }}
                >
                    Kylrix Connect
                </div>
                <div style={{ fontSize: 26 }}>Moment unavailable</div>
            </div>
        ),
        { ...MOMENT_OG_SIZE },
    );
}

export async function createMomentOpenGraphImage(momentId: string) {
    try {
        const moment = await SocialService.getMomentById(momentId);
        const creatorId = moment?.userId || moment?.creatorId;
        const profile = creatorId ? await UsersService.getProfileById(creatorId) : null;
        const identity = resolveIdentity(profile, creatorId);

        const captionRaw =
            typeof moment?.caption === 'string' ? moment.caption.trim() : '';
        const excerpt = captionRaw
            ? truncate(captionRaw, 320)
            : 'Moment on Kylrix Connect.';
        const likes = typeof moment.stats?.likes === 'number' ? moment.stats!.likes : 0;
        const replies =
            typeof moment.stats?.replies === 'number' ? moment.stats!.replies : 0;
        const pulses =
            typeof moment.stats?.pulses === 'number' ? moment.stats!.pulses : 0;
        const stats = statLine(likes, replies, pulses);

        const avatarHref = pickAvatarHref(profile);
        const avatarDataUri = await avatarToDataUri(avatarHref);
        const initial = (identity.displayName || '?').replace(/^@/, '').charAt(0).toUpperCase() || '?';

        return new ImageResponse(
            (
                <div
                    style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '52px 56px',
                        background: 'linear-gradient(146deg,#0f0e0d 0%,#1f1d1b 42%, #121111 100%)',
                        border: '1px solid rgba(245,158,11,0.35)',
                        boxSizing: 'border-box',
                        fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                        position: 'relative',
                        overflow: 'hidden',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            right: 0,
                            height: 5,
                            background: 'linear-gradient(90deg, #F59E0B 0%, #6366F1 72%, transparent 100%)',
                        }}
                    />

                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 36,
                            color: 'rgba(255,255,255,0.45)',
                            fontSize: 22,
                            fontWeight: 700,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                        }}
                    >
                        <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
                            <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" strokeWidth="6" strokeLinecap="round" />
                            <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" strokeWidth="6" strokeLinecap="round" />
                            <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" strokeWidth="6" strokeLinecap="round" />
                            <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" strokeWidth="6" strokeLinecap="round" />
                            <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" strokeWidth="6" strokeLinecap="round" />
                            <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                            <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" strokeWidth="6" strokeLinecap="round" />
                            <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" strokeWidth="6" strokeLinecap="round" />
                            <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" strokeWidth="6" strokeLinecap="round" />
                            <circle cx="50" cy="10" r="5" fill="#6366F1" />
                            <circle cx="15" cy="30" r="5" fill="#6366F1" />
                            <circle cx="85" cy="30" r="5" fill="#6366F1" />
                            <circle cx="15" cy="70" r="5" fill="#6366F1" />
                            <circle cx="50" cy="90" r="5" fill="#6366F1" />
                            <circle cx="85" cy="70" r="5" fill="#6366F1" />
                            <circle cx="50" cy="50" r="7" fill="#6366F1" />
                        </svg>
                        Connect
                        <span style={{ opacity: 0.35 }}>·</span>
                        <span style={{ letterSpacing: '0.04em', textTransform: 'none', opacity: 0.7 }}>
                            Kylrix
                        </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'row', gap: 36, alignItems: 'flex-start', flex: 1 }}>
                        <div
                            style={{
                                width: 144,
                                height: 144,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                flexShrink: 0,
                                border: '2px solid rgba(255,255,255,0.12)',
                                background: 'rgba(0,0,0,0.35)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow:
                                    '0 18px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
                            }}
                        >
                            {avatarDataUri ? (
                                // OG Image Response markup — plain img + data URI; next/image not applicable here.
                                // eslint-disable-next-line @next/next/no-img-element -- OG raster markup with avatarDataUri
                                <img
                                    src={avatarDataUri}
                                    width={144}
                                    height={144}
                                    alt=""
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block',
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background:
                                            'linear-gradient(145deg, rgba(245,158,11,0.92) 0%, rgba(99,102,241,0.55) 100%)',
                                        color: '#ffffff',
                                        fontSize: 58,
                                        fontWeight: 800,
                                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                                    }}
                                >
                                    {initial}
                                </div>
                            )}
                        </div>

                        <div
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                                gap: 10,
                            }}
                        >
                            <div
                                style={{
                                    fontSize: 34,
                                    fontWeight: 800,
                                    letterSpacing: '-0.025em',
                                    color: '#ffffff',
                                    lineHeight: 1.15,
                                }}
                            >
                                {identity.displayName}
                            </div>
                            <div
                                style={{
                                    fontSize: 24,
                                    color: 'rgba(249,245,239,0.55)',
                                    fontWeight: 600,
                                    marginBottom: 14,
                                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                                }}
                            >
                                {identity.handle}
                            </div>

                            <div
                                style={{
                                    fontSize: 34,
                                    lineHeight: 1.38,
                                    color: 'rgba(254,251,246,0.96)',
                                    fontWeight: 500,
                                    maxHeight: 270,
                                    overflow: 'hidden',
                                    whiteSpace: 'pre-wrap',
                                    wordWrap: 'break-word',
                                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                                    marginBottom: 18,
                                    borderLeft: '4px solid rgba(245,158,11,0.85)',
                                    paddingLeft: 22,
                                }}
                            >
                                {excerpt}
                            </div>

                            <div
                                style={{
                                    marginTop: 'auto',
                                    paddingTop: 22,
                                    borderTop: '1px solid rgba(255,255,255,0.08)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: 16,
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        gap: 22,
                                        fontSize: 24,
                                        color: 'rgba(236,229,217,0.85)',
                                        fontWeight: 600,
                                        alignItems: 'center',
                                        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                                    }}
                                >
                                    <span style={{ color: '#F59E0B' }}>{stats}</span>
                                </div>
                                <div style={{ fontSize: 21, color: 'rgba(255,255,255,0.4)', fontWeight: 650 }}>
                                    kylrix.space · Connect
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ),
            { ...MOMENT_OG_SIZE },
        );
    } catch (_e: unknown) {
        return fallbackOg();
    }
}
