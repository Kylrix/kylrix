import type { Metadata } from 'next';
import React from 'react';

type OgAccent = 'indigo' | 'violet' | 'amber' | 'emerald' | 'rose';

type ShareCardProps = {
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
  imageUrl}: {
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
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }]},
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl]}};
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

function clampText(value: string, limit: number) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Dense branded OG card:
 * - packed copy on the left (short title + one-liner)
 * - huge Kylrix logo anchored on the right
 * - owner avatar (or letter dummy) always visible
 * - optional content thumbnail tucked under the copy
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
  previewImageAlt}: ShareCardProps) {
  const palette = ACCENTS[accent];
  const compactChips = chips.filter(Boolean).slice(0, 3);
  const hasPreview = Boolean(previewImageDataUrl);
  const shortDesc = clampText(description, 90);
  const displayOwner = ownerName || productLabel;
  const initial = displayOwner.replace(/^@/, '').slice(0, 1).toUpperCase() || 'K';

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
        fontFamily: 'Arial, Helvetica, sans-serif'}}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 92% 48%, ${palette.glow} 0%, rgba(10,9,8,0) 40%)`}}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          zIndex: 1,
          minWidth: 0,
          paddingRight: '20px'}}
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
                fontWeight: 800}}
            >
              {eyebrow}
            </div>
            <span
              style={{
                fontSize: '15px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(245,243,239,0.42)',
                fontWeight: 700}}
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
              maxWidth: '720px'}}
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
                fontWeight: 600}}
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
                    fontWeight: 700}}
                >
                  {chip}
                </div>
              ))}
            </div>
          )}

          {hasPreview && previewImageDataUrl ? (
            <div
              style={{
                display: 'flex',
                marginTop: '6px',
                width: '220px',
                height: '140px',
                borderRadius: '18px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#161412'}}
            >
              <img
                src={previewImageDataUrl}
                alt={previewImageAlt || title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : null}
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
                  flexShrink: 0}}
              />
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
                  flexShrink: 0}}
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
                  letterSpacing: '0.08em'}}
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

      {/* Huge logo — fills the empty right half */}
      <div
        style={{
          width: '300px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1}}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '260px',
            height: '260px',
            borderRadius: '52px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)'}}
        >
          <KylrixLogo size={196} />
        </div>
      </div>
    </div>
  );
}
