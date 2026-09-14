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
      <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#818CF8] text-xs font-satoshi font-semibold">
        <div className="flex items-center gap-2 min-w-0">
          <Ghost size={14} className="shrink-0 text-[#6366F1]" />
          <span className="truncate">
            This form collects extra diagnostic context upon submission
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-1 hover:bg-[#6366F1]/20 text-[#818CF8] rounded-lg transition-colors shrink-0 cursor-pointer flex items-center gap-1 text-[11px] font-bold"
          title="Learn more about collected info"
        >
          <Info size={14} />
          <span className="hidden sm:inline">Details</span>
        </button>
      </div>

      {/* Info Bottom Drawer */}
      <Drawer
        anchor="bottom"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: false, disablePortal: true }}
        PaperProps={{
          sx: {
            width: '100%',
            maxWidth: 580,
            mx: 'auto',
            borderRadius: '24px 24px 0 0',
            bgcolor: '#161412',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundImage: 'none',
            p: 5,
            pb: 6,
            zIndex: 1400,
            maxHeight: '80vh',
            overflowY: 'auto',
          },
        }}
      >
        <div className="space-y-4 font-satoshi text-white">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#6366F1]" />
              <h3 className="font-clash font-extrabold text-base text-white">
                Collected Diagnostic Information
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="p-1.5 rounded-xl bg-white/5 text-white/70 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-xs text-white/60 leading-relaxed">
            The form creator configured this link to automatically include the following system parameters when you submit your response. This helps prioritize and resolve issues effectively.
          </p>

          <div className="space-y-2.5 pt-2">
            {activeDefinitions.map((def) => (
              <div
                key={def.id}
                className="p-3.5 rounded-2xl bg-[#000000] border border-white/5 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{def.label}</span>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 font-bold">
                      {def.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 mt-1 leading-relaxed">
                    {def.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="w-full py-2.5 mt-2 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-clash font-extrabold text-xs transition-all cursor-pointer"
          >
            Got it
          </button>
        </div>
      </Drawer>
    </>
  );
}
