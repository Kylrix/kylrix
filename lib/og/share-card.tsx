import type { Metadata } from 'next';
import React from 'react';

type OgAccent = 'indigo' | 'violet' | 'amber' | 'emerald' | 'rose';

type ShareCardProps = {
  productLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  accent?: OgAccent;
  hostLabel?: string;
  ownerLabel?: string;
  ownerName?: string;
  ownerAvatarDataUrl?: string | null;
  chips?: string[];
  previewImageDataUrl?: string | null;
  previewImageAlt?: string;
  footerNote?: string;
};

const ACCENTS: Record<OgAccent, { solid: string; soft: string; border: string; glow: string }> = {
  indigo: { solid: '#818CF8', soft: '#C7D2FE', border: 'rgba(129,140,248,0.28)', glow: 'rgba(99,102,241,0.22)' },
  violet: { solid: '#C084FC', soft: '#E9D5FF', border: 'rgba(192,132,252,0.28)', glow: 'rgba(168,85,247,0.22)' },
  amber: { solid: '#FBBF24', soft: '#FDE68A', border: 'rgba(251,191,36,0.28)', glow: 'rgba(245,158,11,0.22)' },
  emerald: { solid: '#34D399', soft: '#A7F3D0', border: 'rgba(52,211,153,0.28)', glow: 'rgba(16,185,129,0.22)' },
  rose: { solid: '#FB7185', soft: '#FECDD3', border: 'rgba(251,113,133,0.28)', glow: 'rgba(244,63,94,0.22)' },
};

export function buildOgMetadata({
  title,
  description,
  imageUrl,
}: {
  title: string;
  description: string;
  imageUrl: string;
}): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
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

function KylrixLogo() {
  return (
    <svg viewBox="0 0 100 100" width="42" height="42" fill="none" style={{ display: 'flex' }}>
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

function clampText(value: string, limit: number) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

export function renderKylrixShareCard({
  productLabel,
  eyebrow,
  title,
  description,
  accent = 'indigo',
  hostLabel = 'kylrix.space',
  ownerLabel = 'Shared by',
  ownerName,
  ownerAvatarDataUrl,
  chips = [],
  previewImageDataUrl,
  previewImageAlt,
  footerNote = 'The agentic workspace that 10x the productivity of high agency builders.',
}: ShareCardProps) {
  const palette = ACCENTS[accent];
  const compactChips = chips.filter(Boolean).slice(0, 4);
  const hasPreview = Boolean(previewImageDataUrl);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0A0908',
        color: '#F5F3EF',
        padding: '36px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 82% 14%, ${palette.glow} 0%, rgba(10,9,8,0) 34%), radial-gradient(circle at 12% 100%, rgba(236,72,153,0.10) 0%, rgba(10,9,8,0) 32%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '16px',
          borderRadius: '34px',
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00))',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <KylrixLogo />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '14px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(245,243,239,0.56)', fontWeight: 700 }}>
              {productLabel}
            </span>
            <span style={{ fontSize: '26px', letterSpacing: '-0.03em', fontWeight: 900 }}>
              Kylrix
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 16px',
            borderRadius: '999px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            color: palette.soft,
            fontSize: '16px',
            fontWeight: 700,
          }}
        >
          {hostLabel}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '28px',
          zIndex: 1,
          flex: 1,
          alignItems: 'stretch',
          margin: '18px 0 20px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '18px', flex: hasPreview ? 1.15 : 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              padding: '10px 18px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${palette.border}`,
              color: palette.solid,
              fontSize: '18px',
              fontWeight: 800,
            }}
          >
            {eyebrow}
          </div>

          <div style={{ fontSize: hasPreview ? '62px' : '68px', lineHeight: 1.02, letterSpacing: '-0.055em', fontWeight: 900, maxWidth: hasPreview ? '640px' : '940px' }}>
            {clampText(title, hasPreview ? 90 : 110)}
          </div>

          <div style={{ fontSize: hasPreview ? '26px' : '28px', lineHeight: 1.28, color: 'rgba(245,243,239,0.78)', maxWidth: hasPreview ? '650px' : '900px' }}>
            {clampText(description, hasPreview ? 220 : 260)}
          </div>

          {compactChips.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {compactChips.map((chip) => (
                <div
                  key={chip}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#F5F3EF',
                    fontSize: '17px',
                    fontWeight: 700,
                  }}
                >
                  {chip}
                </div>
              ))}
            </div>
          )}
        </div>

        {hasPreview && previewImageDataUrl && (
          <div
            style={{
              width: '400px',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '14px',
                borderRadius: '28px',
                background: '#161412',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
              }}
            >
              <img
                src={previewImageDataUrl}
                alt={previewImageAlt || title}
                style={{
                  width: '100%',
                  height: '252px',
                  objectFit: 'cover',
                  borderRadius: '18px',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '999px', background: palette.solid }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(245,243,239,0.64)' }}>
                  Rich preview
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '20px',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {ownerAvatarDataUrl ? (
            <img
              src={ownerAvatarDataUrl}
              alt={ownerName || 'Owner'}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '999px',
                objectFit: 'cover',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
          ) : (
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '999px',
                background: '#161412',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: palette.solid,
                fontSize: '18px',
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {(ownerName || 'K').replace(/^@/, '').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'rgba(245,243,239,0.44)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {ownerLabel}
            </span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: '#F5F3EF' }}>
              {ownerName || 'Kylrix User'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', maxWidth: '640px', textAlign: 'right' }}>
          <span style={{ fontSize: '16px', lineHeight: 1.35, color: 'rgba(245,243,239,0.60)', fontWeight: 600 }}>
            {footerNote}
          </span>
        </div>
      </div>
    </div>
  );
}
