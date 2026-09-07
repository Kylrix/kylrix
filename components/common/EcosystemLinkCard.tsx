'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ExternalLink,
  FileText,
  Target,
  Calendar,
  FolderKanban,
  Lock,
  Key,
  Radio,
  Zap,
  Bot,
  User,
  MessageSquare,
  FileCode,
} from 'lucide-react';
import type { ParsedPublicResource } from '@/lib/share/parse-public-url';
import { splitEcosystemLinks } from '@/lib/share/parse-public-url';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/lib/auth';
import { openMomentObjectDetail } from '@/components/objects/MomentObjectDetail';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { parseMomentRouteId } from '@/lib/connect/moment-engagement';
import { FormattedText } from '@/components/common/FormattedText';
import { useEffect, useState } from 'react';

function KindIcon({ parsed }: { parsed: ParsedPublicResource }) {
  const props = { size: 18, strokeWidth: 2 as const };
  switch (parsed.resourceType) {
    case 'note':
      return <FileText {...props} />;
    case 'goal':
    case 'task':
      return <Target {...props} />;
    case 'event':
      return <Calendar {...props} />;
    case 'form':
      return <FileCode {...props} />;
    case 'project':
      return <FolderKanban {...props} />;
    case 'credential':
      return <Lock {...props} />;
    case 'totp':
      return <Key {...props} />;
    case 'moment':
      return <Radio {...props} />;
    case 'flow':
      return <Zap {...props} />;
    case 'agent_session':
    case 'agent_conversation':
      return <Bot {...props} />;
    case 'profile':
      return <User {...props} />;
    case 'connect':
      return <MessageSquare {...props} />;
    default:
      return <FileText {...props} />;
  }
}

async function resolveTitle(
  parsed: ParsedPublicResource,
  userId?: string,
): Promise<string | null> {
  if (!parsed.id) return null;
  const uid = userId;
  try {
    if (parsed.resourceType === 'note') {
      const lists = [
        ...(uid ? ((await LocalEngine.cacheGet<any[]>(`f_notes_list_${uid}`)) || []) : []),
        ...((await LocalEngine.cacheGet<any[]>('f_notes_list')) || []),
      ];
      const hit = lists.find((n) => (n.$id || n.id) === parsed.id);
      if (hit?.title) return String(hit.title);
    }
    if (parsed.resourceType === 'goal' || parsed.resourceType === 'task') {
      const lists = [
        ...(uid ? ((await LocalEngine.cacheGet<any[]>(`f_goals_list_${uid}`)) || []) : []),
        ...((await LocalEngine.cacheGet<any[]>('f_goals_list')) || []),
      ];
      const hit = lists.find((g) => (g.$id || g.id) === parsed.id);
      if (hit?.title || hit?.name) return String(hit.title || hit.name);
    }
    if (parsed.resourceType === 'project') {
      const projects = (await LocalEngine.cacheGet<any[]>('f_projects_list')) || [];
      const hit = projects.find((p) => (p.$id || p.id) === parsed.id);
      if (hit?.title || hit?.name) return String(hit.title || hit.name);
    }
    if (parsed.resourceType === 'form') {
      const forms =
        (uid ? (await LocalEngine.cacheGet<any[]>(`f_forms_list_${uid}`)) : null) ||
        (await LocalEngine.cacheGet<any[]>('f_forms_list')) ||
        [];
      const hit = forms.find((f) => (f.$id || f.id) === parsed.id);
      if (hit?.title || hit?.name) return String(hit.title || hit.name);
    }
    if (parsed.resourceType === 'event') {
      const events =
        (uid ? (await LocalEngine.cacheGet<any[]>(`f_events_list_${uid}`)) : null) ||
        (await LocalEngine.cacheGet<any[]>('f_events_list')) ||
        [];
      const hit = events.find((ev) => (ev.$id || ev.id) === parsed.id);
      if (hit?.title || hit?.name) return String(hit.title || hit.name);
    }
    if (parsed.resourceType === 'moment') {
      const moments = (await LocalEngine.cacheGet<any[]>('f_moments_list')) || [];
      const clean = parseMomentRouteId(parsed.id).id;
      const hit = moments.find((m) => (m.$id || m.id) === clean || (m.$id || m.id) === parsed.id);
      if (hit?.caption || hit?.content) {
        return String(hit.caption || hit.content).slice(0, 80);
      }
    }
  } catch {
    /* local cache optional */
  }
  return null;
}

/** Engineered Kylrix object card — not a scraped OG preview. */
export function EcosystemLinkCard({
  parsed,
  className = '',
}: {
  parsed: ParsedPublicResource;
  className?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const [title, setTitle] = useState(
    parsed.resourceType === 'profile' && parsed.id
      ? `@${parsed.id.replace(/^@/, '')}`
      : parsed.label,
  );
  const [subtitle, setSubtitle] = useState(
    parsed.id ? `${parsed.label} · in Kylrix` : 'Open in Kylrix',
  );

  useEffect(() => {
    let cancelled = false;
    void resolveTitle(parsed, user?.$id).then((hit) => {
      if (cancelled || !hit) return;
      setTitle(hit);
      setSubtitle(parsed.label);
    });
    return () => {
      cancelled = true;
    };
  }, [parsed, user?.$id]);

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (parsed.resourceType === 'moment' && parsed.id) {
      const { source, id } = parseMomentRouteId(parsed.id);
      openMomentObjectDetail({
        momentId: id,
        source,
        preview: { content: title !== parsed.label ? title : undefined },
        openSidebar,
        openOverlay,
        closeSidebar,
        closeOverlay,
      });
      return;
    }

    router.push(parsed.pathname || '/app');
  };

  return (
    <a
      href={parsed.pathname || parsed.href}
      onClick={open}
      className={`flex items-stretch gap-0 rounded-xl border overflow-hidden no-underline transition-colors hover:border-white/25 ${className}`}
      style={{
        borderColor: `${parsed.color}44`,
        background: '#0A0908',
      }}
    >
      <div
        className="grid h-14 w-14 shrink-0 place-items-center"
        style={{ background: `${parsed.color}18`, color: parsed.color }}
      >
        <KindIcon parsed={parsed} />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center px-3 py-2 border-l border-white/[0.06]">
        <p className="m-0 truncate text-xs font-bold text-white font-satoshi">{title}</p>
        <p
          className="m-0 mt-0.5 text-[10px] font-semibold uppercase tracking-wide font-mono"
          style={{ color: `${parsed.color}cc` }}
        >
          {subtitle}
        </p>
      </div>
      <div className="shrink-0 px-3 grid place-items-center text-white/30">
        <ExternalLink size={14} />
      </div>
    </a>
  );
}

/**
 * Moment / feed body renderer: prose + engineered Kylrix link cards.
 * Ecosystem URLs are lifted out of the text and shown as tasteful object cards.
 */
export function EcosystemRichText({
  text,
  className = '',
  proseClassName = '',
}: {
  text: string;
  className?: string;
  proseClassName?: string;
}) {
  const { prose, links } = useMemo(() => splitEcosystemLinks(text || ''), [text]);

  if (!prose && !links.length) return null;

  return (
    <div className={`space-y-2 min-w-0 ${className}`}>
      {prose ? (
        <div
          className={`text-xs sm:text-sm text-white/90 leading-relaxed break-words whitespace-pre-wrap font-satoshi ${proseClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <FormattedText text={prose} linkPreviewsEnabled={false} />
        </div>
      ) : null}
      {links.length > 0 ? (
        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
          {links.map((link) => (
            <EcosystemLinkCard
              key={`${link.resourceType}:${link.id || link.pathname}`}
              parsed={link}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
