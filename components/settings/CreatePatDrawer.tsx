'use client';

import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Copy, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Drawer,
  useTheme,
  useMediaQuery,
} from '@/lib/openbricks/primitives';
import { PAT_SCOPES, PAT_SCOPE_META, type PatScope } from '@/lib/api/scopes';
import { createPat } from '@/lib/actions/client-ops';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

type Step = 'name' | 'scopes' | 'done';

const DEFAULT_SCOPES: PatScope[] = ['profile:read', 'notes:read', 'notes:write'];

function paperSx(isDesktop: boolean) {
  return {
    bgcolor: '#161412',
    backgroundImage: 'none',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.06)',
    boxSizing: 'border-box' as const,
    ...(isDesktop
      ? {
          height: '100dvh',
          width: 'min(100vw, 420px)',
          borderRadius: '26px 0 0 26px',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }
      : {
          // OpenBricks: bottom drawers are a fixed ~60% of the viewport
          height: '60dvh',
          maxHeight: '60dvh',
          width: '100%',
          borderRadius: '26px 26px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }),
  };
}

export function CreatePatDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<PatScope[]>(DEFAULT_SCOPES);
  const [creating, setCreating] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep('name');
    setName('');
    setSelected(DEFAULT_SCOPES);
    setCreating(false);
    setToken(null);
  }, [open]);

  if (!open) return null;

  const toggleScope = (s: PatScope) => {
    setSelected((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.success(text);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    if (selected.length === 0) {
      toast.error('Pick at least one permission');
      return;
    }
    setCreating(true);
    try {
      const res = await createPat({ name: name.trim(), scopes: selected });
      setToken(res.token);
      setStep('done');
      try {
        await navigator.clipboard.writeText(res.token);
        toast.success('Token created and copied');
      } catch {
        toast.success('Token created — copy it now');
      }
      onCreated?.();
    } catch (err: any) {
      toast.error(err?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      onClose={onClose}
      keepMounted={false}
      disablePortal
      ModalProps={{ keepMounted: false }}
      slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
      PaperProps={{ sx: paperSx(isDesktop) }}
    >
      <div className="flex flex-col h-full font-satoshi overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/40">
              Personal access token
            </p>
            <h2 className="text-lg font-black font-clash text-white tracking-tight truncate">
              {step === 'name' && 'Name'}
              {step === 'scopes' && 'Permissions'}
              {step === 'done' && 'Save your token'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-white/50 hover:text-white cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-4">
          {step === 'name' && (
            <>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Local CLI"
                className="w-full rounded-2xl bg-[#0A0908] border border-white/10 px-4 py-3.5 text-sm text-white outline-none focus:border-[#6366F1]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) setStep('scopes');
                }}
              />
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => setStep('scopes')}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </>
          )}

          {step === 'scopes' && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {PAT_SCOPES.map((s) => {
                  const on = selected.includes(s);
                  const meta = PAT_SCOPE_META[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleScope(s)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer border ${
                        on
                          ? meta.danger
                            ? 'bg-red-500/15 border-red-500/30 text-red-300'
                            : 'bg-[#6366F1]/20 border-[#6366F1]/40 text-[#A5B4FC]'
                          : 'bg-[#0A0908] border-white/[0.06] text-white/35'
                      }`}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('name')}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-white/10 text-white/70 text-sm font-extrabold cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
                <button
                  type="button"
                  disabled={creating || selected.length === 0}
                  onClick={() => void handleCreate()}
                  className="inline-flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer disabled:opacity-40"
                >
                  <KeyRound size={16} />
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && token && (
            <>
              <div className="rounded-2xl bg-[#0A0908] border border-amber-500/25 p-4 space-y-2">
                <p className="text-[11px] font-bold text-amber-400">
                  Shown once. Copied to clipboard.
                </p>
                <code className="block text-[11px] font-mono text-white/80 break-all select-all">
                  {token}
                </code>
              </div>
              <button
                type="button"
                onClick={() => void copy(token)}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/10 text-white text-sm font-extrabold cursor-pointer"
              >
                <Copy size={16} />
                Copy again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl bg-[#6366F1] text-white text-sm font-extrabold cursor-pointer"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
}
