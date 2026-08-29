'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, FileText, Target, FolderKanban, Shield, Key, Bot } from 'lucide-react';
import type { SecondaryObjectPayload } from '@/lib/note-object-secondary';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/lib/auth';

const KIND_LABELS: Record<string, string> = {
  note: 'Idea',
  task: 'Goal',
  form: 'Form',
  vault: 'Vault',
  session: 'Session',
  image: 'Image',
  file: 'File',
  voice: 'Voice',
  link: 'Link',
};

function ChatObjectKindIcon({ payload }: { payload: SecondaryObjectPayload }) {
  const iconProps = { size: 18, strokeWidth: 2 as const };
  const subTab = String(payload.metadata?.subTab || '');
  if (subTab === 'goals' || payload.childKind === 'task') return <Target {...iconProps} />;
  if (subTab === 'projects') return <FolderKanban {...iconProps} />;
  if (subTab === 'totps' || subTab === 'vault' || payload.childKind === 'vault') {
    return <Key {...iconProps} />;
  }
  if (subTab === 'sessions' || payload.childKind === 'session') return <Bot {...iconProps} />;
  if (payload.childKind === 'form') return <FileText {...iconProps} />;
  return <Shield {...iconProps} />;
}

export function ChatObjectPreview({
  payload,
  onRemove,
}: {
  payload: SecondaryObjectPayload;
  onRemove?: () => void;
}) {
  const { user } = useAuth();
  const [title, setTitle] = useState(payload.label || 'Attachment');

  const thumb = useMemo(() => {
    const mime = String(payload.metadata?.mimeType || '');
    if (payload.childKind !== 'image' && !mime.startsWith('image/')) return null;
    try {
      const bucket = payload.bucketId || 'notes_attachments';
      return StorageService.getFilePreview(payload.childId, bucket, 96, 96).toString();
    } catch {
      return null;
    }
  }, [payload]);

  useEffect(() => {
    let cancelled = false;
    const subTab = String(payload.metadata?.subTab || '');
    const uid = user?.$id;

    void (async () => {
      try {
        if (subTab === 'ideas' || payload.childKind === 'note') {
          const cached = [
            ...(uid ? (await LocalEngine.cacheGet<any[]>(`f_notes_list_${uid}`)) || [] : []),
            ...((await LocalEngine.cacheGet<any[]>('f_notes_list')) || []),
          ];
          const hit = cached.find((n) => (n.$id || n.id) === payload.childId);
          if (!cancelled && hit?.title) setTitle(String(hit.title));
          return;
        }
        if (subTab === 'goals' || payload.childKind === 'task') {
          const cached = [
            ...(uid ? (await LocalEngine.cacheGet<any[]>(`f_goals_list_${uid}`)) || [] : []),
            ...((await LocalEngine.cacheGet<any[]>('f_goals_list')) || []),
          ];
          const hit = cached.find((g) => (g.$id || g.id) === payload.childId);
          if (!cancelled && (hit?.title || hit?.name)) setTitle(String(hit.title || hit.name));
          return;
        }
        if (subTab === 'projects') {
          const projects = (await LocalEngine.cacheGet<any[]>('f_projects_list')) || [];
          const hit = projects.find((p) => (p.$id || p.id) === payload.childId);
          if (!cancelled && (hit?.title || hit?.name)) setTitle(String(hit.title || hit.name));
        }
      } catch {
        /* local cache optional */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [payload, user?.$id]);

  const kindLabel =
    KIND_LABELS[String(payload.metadata?.subTab || payload.childKind)] ||
    KIND_LABELS[payload.childKind] ||
    'Object';

  return (
    <div className="mx-1 flex items-stretch gap-0 rounded-xl border border-white/[0.08] bg-[#0A0908] overflow-hidden">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="h-14 w-14 shrink-0 object-cover bg-[#161412]" />
      ) : (
        <div className="grid h-14 w-14 shrink-0 place-items-center bg-[#161412] text-[#A855F7]">
          <ChatObjectKindIcon payload={payload} />
        </div>
      )}
      <div className="min-w-0 flex-1 flex flex-col justify-center px-3 py-2 border-l border-white/[0.06]">
        <p className="m-0 truncate text-xs font-bold text-white font-satoshi">{title}</p>
        <p className="m-0 mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/35 font-mono">
          {kindLabel}
        </p>
      </div>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 px-3 text-white/35 hover:text-white hover:bg-white/[0.04] transition-colors"
          aria-label="Remove attachment"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}
