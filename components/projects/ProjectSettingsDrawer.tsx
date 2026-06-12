'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface ProjectSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onSave: (title: string, summary: string, status: 'active' | 'completed' | 'archived' | 'paused' | 'on_hold') => Promise<void>;
}

export default function ProjectSettingsDrawer({
  isOpen,
  onClose,
  project,
  onSave
}: ProjectSettingsDrawerProps) {
  const [title, setTitle] = useState(project?.title || '');
  const [summary, setSummary] = useState(project?.summary || '');
  const [status, setStatus] = useState<'active' | 'completed' | 'archived' | 'paused' | 'on_hold'>(project?.status || 'active');
  const [saving, setSaving] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setSummary(project.summary || '');
      setStatus(project.status || 'active');
    }
  }, [project]);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed bg-[#161412] border-[#34322F] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-50 ${
          isDesktop 
            ? 'top-0 right-0 h-screen w-[480px] border-l rounded-l-none'
            : 'bottom-0 left-0 right-0 max-h-[90dvh] h-auto border-t rounded-t-[28px] max-w-[720px] mx-auto'
        }`}
      >
        {/* Mobile Drag Handle */}
        {!isDesktop && (
          <div 
            className="flex justify-center py-3 cursor-pointer select-none"
            onClick={onClose}
          >
            <div className="w-10 h-1 rounded bg-[#3D3A36]" />
          </div>
        )}

        {/* Spotlight Ambient Glow */}
        {isDesktop && (
          <div className="absolute top-0 left-0 right-0 h-48 bg-radial-glow pointer-events-none opacity-20" 
               style={{ backgroundImage: 'radial-gradient(circle at top, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
        )}

        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-[#1C1A18] shrink-0 relative z-10">
          <div>
            <h3 className="text-white text-lg font-black font-clash tracking-tight font-clash">
              Project Settings
            </h3>
            <p className="text-xs text-[#9B9691] font-semibold mt-1">
              Configure parameters & metadata
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-white/50 hover:text-white transition rounded-lg hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin relative z-10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 h-full">
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
      </div>
    </>
  );
}
