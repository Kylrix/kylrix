'use client';

import { useMemo } from 'react';
import {
  Calendar,
  ChevronRight,
  FileText,
  Flag,
  FolderKanban,
  Image as ImageIcon,
  LayoutGrid,
  Paperclip,
  Sparkles} from 'lucide-react';
import { useNotes } from '@/context/NotesContext';
import { useTask } from '@/context/TaskContext';
import { useDataNexus } from '@/context/DataNexusContext';
import {
  ecosystemDomainLabel,
  hydrateEcosystemHitsSync,
  type HydratedEcosystemHit} from '@/lib/agentic/hydrate-ecosystem-hits';
import type { EcosystemHitRef } from '@/lib/agentic/message-blocks';
import type { SearchPlan } from '@/lib/agentic/search-engine';

const DOMAIN_ICONS: Record<HydratedEcosystemHit['domain'], React.ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>> = {
  all: Sparkles,
  idea: Sparkles,
  goal: Flag,
  event: Calendar,
  form: FileText,
  project: FolderKanban,
  tag: Paperclip,
  ui: LayoutGrid};

function HitCard({ hit, onOpen }: { hit: HydratedEcosystemHit; onOpen: () => void }) {
  const IconComponent = DOMAIN_ICONS[hit.domain] || FileText;
  const preview = hit.meta?.previewImageUrl;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-[14px] border border-white/8 bg-[#0B0A09] hover:bg-[#12100F] hover:border-white/12 transition group overflow-hidden"
    >
      <div className="flex gap-3 p-3">
        <div className="relative shrink-0 w-11 h-11 rounded-xl overflow-hidden border border-white/8 bg-[#161412] flex items-center justify-center">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <IconComponent size={16} style={{ color: hit.accent }} />
          )}
          {hit.meta?.hasImage && !preview ? (
            <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-black/70 flex items-center justify-center">
              <ImageIcon size={9} className="text-white/80" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border"
              style={{ color: hit.accent, borderColor: `${hit.accent}33`, backgroundColor: `${hit.accent}10` }}
            >
              {ecosystemDomainLabel(hit.domain)}
            </span>
            {hit.meta?.status ? (
              <span className="text-[9px] font-bold text-white/35 uppercase tracking-wide">{hit.meta.status}</span>
            ) : null}
          </div>
          <p className="text-[13px] font-extrabold text-white leading-snug line-clamp-2 group-hover:text-white">
            {hit.title}
          </p>
          {hit.snippet ? (
            <p className="mt-1 text-[11px] text-[#9B9691] leading-relaxed line-clamp-2">{hit.snippet}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-white/35 font-mono">
            <span className="truncate max-w-[120px]">{hit.id}</span>
            {hit.meta?.attachmentCount ? (
              <span className="inline-flex items-center gap-0.5">
                <Paperclip size={10} />
                {hit.meta.attachmentCount}
              </span>
            ) : null}
            {hit.meta?.dueDate ? (
              <span className="text-[#A855F7]/80">
                Due {new Date(hit.meta.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            ) : null}
          </div>
          {hit.tags?.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {hit.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/6 text-white/50"
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <ChevronRight size={14} className="shrink-0 text-white/20 group-hover:text-white/50 mt-2 transition" />
      </div>
    </button>
  );
}

export function EcosystemHitCards({
  query,
  plan,
  hits,
  onPick}: {
  query: string;
  plan?: Pick<SearchPlan, 'reasoning' | 'temporal' | 'domains'>;
  hits: EcosystemHitRef[];
  onPick?: (hit: HydratedEcosystemHit) => void;
}) {
  const { notes } = useNotes();
  const { tasks } = useTask();
  const { getCachedData } = useDataNexus();

  const hydrated = useMemo(
    () =>
      hydrateEcosystemHitsSync(hits, {
        notes,
        tasks,
        getCachedData}),
    [hits, notes, tasks, getCachedData]);

  if (!hydrated.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-[12px] text-[#9B9691]">
        No matches in your local copy yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-black uppercase tracking-wider text-[#9B9691]">
          {hydrated.length} result{hydrated.length === 1 ? '' : 's'}
          {query ? ` · "${query}"` : ''}
        </p>
        {plan?.temporal && plan.temporal !== 'none' ? (
          <span className="text-[9px] font-bold text-[#A855F7] uppercase tracking-wide">{plan.temporal}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 max-h-[min(52vh,420px)] overflow-y-auto pr-1 py-1">
        {hydrated.map((hit) => (
          <HitCard
            key={`${hit.domain}:${hit.id}`}
            hit={hit}
            onOpen={() => {
              onPick?.(hit);
            }}
          />
        ))}
      </div>
    </div>
  );
}
