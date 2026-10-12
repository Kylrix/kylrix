'use client';

import React, { useState } from 'react';
import { Info, Ghost, X, ShieldCheck } from 'lucide-react';
import { Drawer } from '@/lib/openbricks/primitives';
import { GHOST_FIELDS_REGISTRY } from '@/lib/forms/ghost-fields';

interface GhostFieldsNoticeProps {
  ghostFields: string[];
}

export function GhostFieldsNotice({ ghostFields }: GhostFieldsNoticeProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!ghostFields || ghostFields.length === 0) return null;

  const activeDefinitions = ghostFields
    .map((id) => GHOST_FIELDS_REGISTRY[id])
    .filter(Boolean);

  if (activeDefinitions.length === 0) return null;

  return (
    <>
      {/* Small Notice Banner */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-[#161412] border border-[#6366F1]/30 text-white text-xs font-satoshi font-semibold">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/40 flex items-center justify-center text-[#6366F1] shrink-0">
            <Ghost size={14} />
          </div>
          <span className="truncate text-white font-bold text-xs">
            Diagnostic Context Collected
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="px-2.5 py-1 bg-[#6366F1]/20 hover:bg-[#6366F1]/30 border border-[#6366F1]/40 text-white rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title="Learn more about collected info"
        >
          <Info size={13} />
          <span>Details</span>
        </button>
      </div>

      {/* Info Bottom Drawer (Strict OpenBricks 4.0 Standard) */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: false, disablePortal: true }}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 600,
            mx: 'auto',
            borderRadius: '28px 28px 0 0',
            bgcolor: '#161412',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
            borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            backgroundImage: 'none',
            p: 0,
            zIndex: 1400,
            height: '60dvh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Drawer Header with Top Action Controls */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-[#161412]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#6366F1]/20 border border-[#6366F1]/40 text-[#6366F1] flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="font-clash font-extrabold text-base text-white tracking-tight truncate">
                Collected Diagnostic Information
              </h3>
              <p className="text-[11px] font-mono text-white tracking-wider uppercase font-bold truncate">
                {activeDefinitions.length} System {activeDefinitions.length === 1 ? 'Parameter' : 'Parameters'} Disclosed
              </p>
            </div>
          </div>

          {/* Top Dismiss Action */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/20 border border-white/15 flex items-center justify-center text-white transition-all shrink-0 cursor-pointer"
            title="Dismiss"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 font-satoshi text-white scrollbar-thin">
          <div className="p-4 rounded-[20px] bg-[#000000] border border-white/10">
            <p className="text-xs text-white leading-relaxed font-semibold m-0">
              The form creator configured this link to automatically include system parameters when you submit your response. This helps prioritize and resolve issues effectively.
            </p>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white block">
              Active Parameters
            </span>
            <div className="space-y-2.5">
              {activeDefinitions.map((def) => (
                <div
                  key={def.id}
                  className="p-4 rounded-[22px] bg-[#000000] border border-white/15 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-white font-clash">{def.label}</span>
                    <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-lg bg-[#161412] text-white border border-white/20 font-bold">
                      {def.category}
                    </span>
                  </div>
                  <p className="text-xs text-white leading-relaxed font-medium m-0">
                    {def.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fixed Non-Scrolling Action Footer */}
        <div className="p-4 border-t border-white/10 bg-[#161412] shrink-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="w-full py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-clash font-extrabold text-xs tracking-wide transition-all cursor-pointer shadow-lg shadow-[#6366F1]/20"
          >
            Got It
          </button>
        </div>
      </Drawer>
    </>
  );
}
