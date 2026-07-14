'use client';

import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Check } from 'lucide-react';
import { SweptService } from '@/lib/services/swept';

interface ProjectAutoSweepDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle?: string;
  onSaved?: (enabled: boolean) => void;
}

export default function ProjectAutoSweepDrawer({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  onSaved,
}: ProjectAutoSweepDrawerProps) {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    let cancelled = false;
    setLoading(true);
    SweptService.getConfig(projectId)
      .then((config) => {
        if (!cancelled) {
          setEnabled(config.enabled !== false);
        }
      })
      .catch(() => {
        if (!cancelled) setEnabled(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, projectId]);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await SweptService.setEnabled(projectId, enabled);
      onSaved?.(enabled);
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
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />
      <div
        className={`fixed bg-[#161412] border-[#34322F] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 z-50 ${
          isDesktop
            ? 'top-0 right-0 h-screen w-[480px] border-l rounded-l-none'
            : 'bottom-0 left-0 right-0 max-h-[90dvh] h-auto border-t rounded-t-[28px] max-w-[720px] mx-auto'
        }`}
      >
        {!isDesktop && (
          <div className="flex justify-center py-3 cursor-pointer select-none" onClick={onClose}>
            <div className="w-10 h-1 rounded bg-[#3D3A36]" />
          </div>
        )}

        <div className="p-6 pb-4 flex items-center justify-between border-b border-[#1C1A18] shrink-0">
          <div>
            <h3 className="text-white text-lg font-black tracking-tight">Auto-Sweep Settings</h3>
            <p className="text-xs text-[#9B9691] font-semibold mt-1">
              {projectTitle ? `"${projectTitle}" tagged resources` : 'Control what gets swept into this project'}
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

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 h-full">
            <div className="p-4 rounded-2xl border border-[#6366F1]/20 bg-[#6366F1]/5">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={16} className="text-[#6366F1]" />
                <span className="text-xs font-black uppercase tracking-wider text-[#6366F1]">How it works</span>
              </div>
              <p className="text-xs text-white/55 leading-relaxed font-medium">
                When auto-sweep is on, items you create with this project&apos;s tags appear here for other members.
                Turn it off to keep new tagged items private to your account only.
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => setEnabled((v) => !v)}
              className={`p-4 rounded-2xl border text-left transition duration-200 flex items-start gap-4 w-full ${
                enabled
                  ? 'border-[#6366F1] bg-[#6366F1]/5'
                  : 'border-[#1C1A18] bg-[#0A0908] hover:border-white/10'
              }`}
            >
              <div className={`p-2.5 rounded-xl border ${enabled ? 'border-[#6366F1]/20 bg-[#6366F1]/10 text-[#6366F1]' : 'border-white/5 bg-[#161412] text-white/40'}`}>
                <RefreshCw size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-extrabold text-sm text-white">Auto-sweep my tagged items</span>
                  {enabled ? <Check size={16} className="text-[#6366F1] shrink-0" /> : null}
                </div>
                <p className="text-xs text-white/40 leading-relaxed mt-1">
                  {enabled
                    ? 'Your new notes, goals, and other items with project tags will show up in Tagged Resources.'
                    : 'Your tagged items stay in your workspace and will not appear in this project list.'}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
                    {loading ? 'Loading…' : enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <div
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ${
                      enabled ? 'bg-[#6366F1]' : 'bg-[#1C1A18]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                        enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </button>

            <div className="mt-auto pt-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm bg-[#6366F1] hover:bg-[#575CF0] text-white disabled:opacity-50 transition cursor-pointer"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Save Settings</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
