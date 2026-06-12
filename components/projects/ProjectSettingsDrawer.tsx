'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface ProjectSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  project: any;
  onSave: (title: string, summary: string, status: 'active' | 'completed' | 'archived' | 'paused' | 'on_hold') => Promise<void>;
}

export default function ProjectSettingsDrawer({
  open,
  onClose,
  project,
  onSave
}: ProjectSettingsDrawerProps) {
  const [title, setTitle] = useState(project?.title || '');
  const [summary, setSummary] = useState(project?.summary || '');
  const [status, setStatus] = useState<'active' | 'completed' | 'archived' | 'paused' | 'on_hold'>(project?.status || 'active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setSummary(project.summary || '');
      setStatus(project.status || 'active');
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(title.trim(), summary.trim(), status);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 z-[9990]"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className="fixed right-0 top-0 bottom-0 h-dvh bg-[#161412] border-l border-white/5 shadow-2xl flex flex-col z-[9995] w-full sm:w-[480px] font-satoshi text-white p-6 md:p-8 animate-slide-in-right relative"
      >
        {/* Spotlight Ambient Glow */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-radial-glow pointer-events-none opacity-20" 
             style={{ backgroundImage: 'radial-gradient(circle at top, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-8 relative z-10 flex-shrink-0">
          <div>
            <h3 className="text-white text-lg font-black font-clash tracking-tight">
              Project Settings
            </h3>
            <p className="text-xs text-[#9B9691] font-semibold mt-1">
              Configure parameters & metadata
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white bg-white/2 hover:bg-white/5 transition-all border border-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6 relative z-10 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#9B9691] tracking-wider uppercase font-clash">
              Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q3 Product Launch"
              required
              className="w-full px-4 py-3 rounded-xl bg-[#0B0A09] border border-white/5 text-sm text-white font-semibold placeholder:text-[#9B9691]/40 focus:outline-none focus:border-[#6366F1]/50 transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#9B9691] tracking-wider uppercase font-clash">
              Project Description / Summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief summary of the goals and scopes..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-[#0B0A09] border border-white/5 text-sm text-white font-semibold placeholder:text-[#9B9691]/40 focus:outline-none focus:border-[#6366F1]/50 transition resize-none leading-relaxed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-[#9B9691] tracking-wider uppercase font-clash">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['active', 'completed', 'archived', 'paused', 'on_hold'] as const).map((s) => {
                const active = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`px-4 py-3 rounded-xl border text-xs font-black uppercase tracking-wider transition ${
                      active 
                        ? 'border-[#6366F1] bg-[#6366F1]/10 text-white' 
                        : 'border-white/5 bg-[#0B0A09] text-white/60 hover:text-white hover:bg-white/3'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-auto pt-6 flex-shrink-0 flex gap-3">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm bg-[#6366F1] hover:bg-[#575CF0] text-white disabled:opacity-50 transition cursor-pointer"
            >
              <Save size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
