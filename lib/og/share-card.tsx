import type { Metadata } from 'next';
import React from 'react';

type OgAccent = 'indigo' | 'violet' | 'amber' | 'emerald' | 'rose';

export type ObjectIconType =
  | 'idea'
  | 'note'
  | 'goal'
  | 'agent'
  | 'session'
  | 'chat'
  | 'form'
  | 'event'
  | 'vault'
  | 'secret'
  | 'credential'
  | 'totp'
  | 'logo';

export type ShareCardProps = {
  productLabel: string;
  eyebrow: string;
  title: string;
  description?: string;
  accent?: OgAccent;
  hostLabel?: string;
  ownerLabel?: string;
  ownerName?: string;
  ownerAvatarDataUrl?: string | null;
  chips?: string[];
  previewImageDataUrl?: string | null;
  previewImageAlt?: string;

  cardType?: 'profile' | 'object' | 'default';
  userId?: string | null;
  objectIcon?: ObjectIconType;
  objectColor?: string;
  mediaDataUrl?: string | null;
};

const ACCENTS: Record<OgAccent, { solid: string; soft: string; border: string; glow: string }> = {
  indigo: { solid: '#818CF8', soft: '#C7D2FE', border: 'rgba(129,140,248,0.28)', glow: 'rgba(99,102,241,0.22)' },
  violet: { solid: '#C084FC', soft: '#E9D5FF', border: 'rgba(192,132,252,0.28)', glow: 'rgba(168,85,247,0.22)' },
  amber: { solid: '#FBBF24', soft: '#FDE68A', border: 'rgba(251,191,36,0.28)', glow: 'rgba(245,158,11,0.22)' },
  emerald: { solid: '#34D399', soft: '#A7F3D0', border: 'rgba(52,211,153,0.28)', glow: 'rgba(16,185,129,0.22)' },
  rose: { solid: '#FB7185', soft: '#FECDD3', border: 'rgba(251,113,133,0.28)', glow: 'rgba(244,63,94,0.22)' }};

export function buildOgMetadata({
  title,
  description,
  imageUrl,
  type = 'website',
  siteName = 'Kylrix',
  robots = {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}: {
  title: string;
  description: string;
  imageUrl: string;
  type?: 'website' | 'article' | 'profile';
  siteName?: string;
  robots?: Metadata['robots'];
}): Metadata {
  return {
    title,
    description,
    robots,
    openGraph: {
      title,
      description,
      type,
      siteName,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

function KylrixLogo({ size = 220 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      style={{ display: 'flex', flexShrink: 0 }}
    >
      <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" strokeWidth="5.5" strokeLinecap="round" />
      <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="50" cy="10" r="5" fill="#6366F1" />
      <circle cx="15" cy="30" r="5" fill="#6366F1" />
      <circle cx="85" cy="30" r="5" fill="#6366F1" />
      <circle cx="15" cy="70" r="5" fill="#6366F1" />
      <circle cx="50" cy="90" r="5" fill="#6366F1" />
      <circle cx="85" cy="70" r="5" fill="#6366F1" />
      <circle cx="50" cy="50" r="7" fill="#6366F1" />
    </svg>
  );
}

function hashUserId(str: string): number[] {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const bytes: number[] = [];
  for (let i = 0; i < 16; i++) {
    const combined = (i % 2 === 0 ? h1 : h2) ^ (i * 0x5bd1e995);
    bytes.push(Math.abs(combined >> ((i % 4) * 8)) & 0xff);
  }
  return bytes;
}

const IDENTICON_COLORS = [
  '#818CF8', // Indigo
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#6366F1', // Violet
  '#14B8A6', // Teal
  '#F43F5E', // Rose
];

export function UserIdenticon({ userId, size = 260 }: { userId: string; size?: number }) {
  const bytes = hashUserId(userId || 'kylrix_user');
  const primaryColor = IDENTICON_COLORS[bytes[0] % IDENTICON_COLORS.length];
  const secondaryColor = IDENTICON_COLORS[(bytes[1] + 3) % IDENTICON_COLORS.length];

  const cellSize = Math.round(size * 0.138);
  const gap = Math.round(size * 0.03);
  const totalGrid = 5 * cellSize + 4 * gap;
  const offset = Math.round((size - totalGrid) / 2);

  const cells: Array<{ x: number; y: number; fill: string; opacity: number }> = [];

  for (let col = 0; col < 5; col++) {
    const sourceCol = col < 3 ? col : 4 - col;
    for (let row = 0; row < 5; row++) {
      const bitIndex = sourceCol * 5 + row;
      const byte = bytes[Math.floor(bitIndex / 8) + 1] || 0;
      const isFilled = ((byte >> (bitIndex % 8)) & 1) === 1;
      const isCenter = col === 2 && row === 2;
      const filled = isFilled || isCenter;

      const posX = offset + col * (cellSize + gap);
      const posY = offset + row * (cellSize + gap);

      if (filled) {
        const useSecondary = ((bytes[2] >> (row % 8)) & 1) === 1 && (col === 1 || col === 3);
        cells.push({
          x: posX,
          y: posY,
          fill: useSecondary ? secondaryColor : primaryColor,
          opacity: 1,
        });
      } else {
        cells.push({
          x: posX,
          y: posY,
          fill: 'rgba(255,255,255,0.04)',
          opacity: 0.4,
        });
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{
        display: 'flex',
        borderRadius: size > 100 ? '52px' : '999px',
        background: '#13110F',
        border: `1.5px solid ${primaryColor}40`,
      }}
    >
      {cells.map((c, i) => (
        <rect
          key={i}
          x={c.x}
          y={c.y}
          width={cellSize}
          height={cellSize}
          rx={Math.round(cellSize * 0.22)}
          ry={Math.round(cellSize * 0.22)}
          fill={c.fill}
          opacity={c.opacity}
        />
      ))}
    </svg>
  );
}

const OBJECT_DEFAULTS: Record<string, { color: string; icon: ObjectIconType }> = {
  note: { color: '#EC4899', icon: 'idea' },
  idea: { color: '#EC4899', icon: 'idea' },
  goal: { color: '#A855F7', icon: 'goal' },
  agent: { color: '#818CF8', icon: 'agent' },
  session: { color: '#818CF8', icon: 'agent' },
  chat: { color: '#818CF8', icon: 'agent' },
  form: { color: '#3B82F6', icon: 'form' },
  event: { color: '#F59E0B', icon: 'event' },
  vault: { color: '#10B981', icon: 'vault' },
  secret: { color: '#10B981', icon: 'vault' },
  credential: { color: '#10B981', icon: 'vault' },
  totp: { color: '#6366F1', icon: 'totp' },
  logo: { color: '#818CF8', icon: 'logo' },
};

function ObjectIconComponent({
  icon,
  color,
  size = 130,
}: {
  icon: ObjectIconType;
  color: string;
  size?: number;
}) {
  switch (icon) {
    case 'idea':
    case 'note':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'flex' }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
      );
    case 'goal':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'flex' }}
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'agent':
    case 'session':
    case 'chat':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'flex' }}
        >
          <rect width="18" height="12" x="3" y="6" rx="2" />
          <circle cx="9" cy="12" r="1.5" fill={color} />
          <circle cx="15" cy="12" r="1.5" fill={color} />
          <path d="M12 2v4" />
          <path d="M2 12h1" />
          <path d="M21 12h1" />
          <path d="M9 16a3 3 0 0 0 6 0" />
        </svg>
      );
    case 'form':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'flex' }}
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M8 13h2" />
          <path d="M14 13h2" />
          <path d="M8 17h2" />
          <path d="M14 17h2" />
        </svg>
      );
    case 'event':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'flex' }}
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'vault':
    case 'secret':
    case 'credential':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'flex' }}
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'totp':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'flex' }}
        >
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    default:
      return <KylrixLogo size={size} />;
  }
}

function clampText(value: string, limit: number) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Dense branded OG card:
 * - packed copy on the left (short title + one-liner)
 * - right visual: user avatar/identicon (for profiles) OR media/object icon (for objects) OR Kylrix logo (default)
 * - owner avatar / identicon in footer
 */
export function renderKylrixShareCard({
  productLabel,
  eyebrow,
  title,
  description = '',
  accent = 'indigo',
  hostLabel = 'kylrix.space',
  ownerLabel = 'Shared by',
  ownerName,
  ownerAvatarDataUrl,
  chips = [],
  previewImageDataUrl,
  previewImageAlt,
  cardType = 'default',
  userId,
  objectIcon,
  objectColor,
  mediaDataUrl,
}: ShareCardProps) {
  const palette = ACCENTS[accent];
  const compactChips = chips.filter(Boolean).slice(0, 3);
  const targetMedia = mediaDataUrl || previewImageDataUrl || null;
  const isProfile = cardType === 'profile';
  const isObject = cardType === 'object' || Boolean(objectIcon);
  const shortDesc = clampText(description, 90);
  const displayOwner = ownerName || productLabel;
  const initial = displayOwner.replace(/^@/, '').slice(0, 1).toUpperCase() || 'K';

  // Determine right visual graphic
  let rightGraphic: React.ReactNode = null;

  if (isProfile) {
    const avatarUrl = ownerAvatarDataUrl || targetMedia;
    if (avatarUrl) {
      rightGraphic = (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '260px',
            height: '260px',
            borderRadius: '52px',
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.03)',
            border: `2px solid ${palette.border}`,
          }}
        >
          <img
            src={avatarUrl}
            alt={displayOwner}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      );
    } else {
      // Deterministic identicon from userId (strict privacy: never email)
      rightGraphic = <UserIdenticon userId={userId || displayOwner} size={260} />;
    }
  } else if (targetMedia) {
    // First media in object
    rightGraphic = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '260px',
          height: '260px',
          borderRadius: '44px',
          overflow: 'hidden',
          background: '#161412',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <img
          src={targetMedia}
          alt={previewImageAlt || title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    );
  } else if (isObject && objectIcon && objectIcon !== 'logo') {
    // Object icon with internal color
    const config = OBJECT_DEFAULTS[objectIcon] || { color: palette.solid, icon: objectIcon };
    const iconColor = objectColor || config.color;
    rightGraphic = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '260px',
          height: '260px',
          borderRadius: '52px',
          background: `${iconColor}15`,
          border: `1.5px solid ${iconColor}40`,
        }}
      >
        <ObjectIconComponent icon={config.icon} color={iconColor} size={124} />
      </div>
    );
  } else {
    // Default site / landing card
    rightGraphic = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '260px',
          height: '260px',
          borderRadius: '52px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <KylrixLogo size={196} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        background: '#0A0908',
        color: '#F5F3EF',
        padding: '36px 40px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 92% 48%, ${palette.glow} 0%, rgba(10,9,8,0) 40%)`,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          zIndex: 1,
          minWidth: 0,
          paddingRight: '20px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '7px 14px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${palette.border}`,
                color: palette.solid,
                fontSize: '17px',
                fontWeight: 800,
              }}
            >
              {eyebrow}
            </div>
            <span
              style={{
                fontSize: '15px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(245,243,239,0.42)',
                fontWeight: 700,
              }}
            >
              {productLabel}
            </span>
          </div>

          <div
            style={{
              fontSize: '70px',
              lineHeight: 0.96,
              letterSpacing: '-0.06em',
              fontWeight: 900,
              maxWidth: '720px',
            }}
          >
            {clampText(title, 52)}
          </div>

          {shortDesc ? (
            <div
              style={{
                fontSize: '24px',
                lineHeight: 1.2,
                color: 'rgba(245,243,239,0.7)',
                maxWidth: '640px',
                fontWeight: 600,
              }}
            >
              {shortDesc}
            </div>
          ) : null}

          {compactChips.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {compactChips.map((chip) => (
                <div
                  key={chip}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '7px 12px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F5F3EF',
                    fontSize: '15px',
                    fontWeight: 700,
                  }}
                >
                  {chip}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            {ownerAvatarDataUrl ? (
              <img
                src={ownerAvatarDataUrl}
                alt={displayOwner}
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '999px',
                  objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.14)',
                  flexShrink: 0,
                }}
              />
            ) : isProfile ? (
              <UserIdenticon userId={userId || displayOwner} size={56} />
            ) : (
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '999px',
                  background: '#161412',
                  border: '2px solid rgba(255,255,255,0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: palette.solid,
                  fontSize: '24px',
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {initial}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'rgba(245,243,239,0.42)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {ownerLabel}
              </span>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#F5F3EF' }}>
                {clampText(displayOwner, 28)}
              </span>
            </div>
          </div>
          <span style={{ fontSize: '17px', fontWeight: 700, color: palette.soft, flexShrink: 0 }}>
            {hostLabel}
          </span>
        </div>
      </div>

      {/* Right Visual Graphic */}
      <div
        style={{
          width: '300px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        {rightGraphic}
      </div>
    </div>
  );
}
