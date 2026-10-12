'use client';

import React, { useState, useEffect } from 'react';
import { X, Globe, Lock, ChevronDown, ChevronUp, Check } from 'lucide-react';

interface ProjectVisibilityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  onSave: (visibility: 'public' | 'private', isGuest: boolean) => Promise<void>;
}

export default function ProjectVisibilityDrawer({
  isOpen,
  onClose,
  project,
  onSave
}: ProjectVisibilityDrawerProps) {
  const [visibility, setVisibility] = useState<'public' | 'private'>(project?.visibility || 'private');
  const [isGuest, setIsGuest] = useState<boolean>(project?.isGuest || false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (project) {
      setVisibility(project.visibility || 'private');
      setIsGuest(!!project.isGuest);
      // Auto expand guest settings if it's already public and isGuest is true
      if (project.visibility === 'public' && project.isGuest) {
        setIsExpanded(true);
      }
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
    setSaving(true);
    try {
      await onSave(visibility, visibility === 'public' ? isGuest : false);
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
        className="fixed inset-0 bg-black/60 z-50 transition-opacity duration-300 animate-in fade-in"
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


        {/* Spotlight Ambient Glow */}
        {isDesktop && (
          <div className="absolute top-0 left-0 right-0 h-48 bg-radial-glow pointer-events-none opacity-20" 
               style={{ backgroundImage: 'radial-gradient(circle at top, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
        )}

        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-[#1C1A18] shrink-0 relative z-10">
          <div>
            <h3 className="text-white text-lg font-black font-clash tracking-tight font-clash">
              Project Visibility
            </h3>
            <p className="text-xs text-[#9B9691] font-semibold mt-1">
              Control access scopes & general visibility
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
            
            {/* Private option card */}
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className={`p-4 rounded-2xl border text-left transition duration-200 flex items-start gap-4 w-full ${
                visibility === 'private'
                  ? 'border-[#6366F1] bg-[#6366F1]/5'
                  : 'border-[#1C1A18] bg-[#0A0908] hover:border-white/10'
              }`}
            >
              <div className={`p-2.5 rounded-xl border ${visibility === 'private' ? 'border-[#6366F1]/20 bg-[#6366F1]/10 text-[#6366F1]' : 'border-white/5 bg-[#161412] text-white/40'}`}>
                <Lock size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-white font-satoshi">Private (Restricted)</span>
                  {visibility === 'private' && <Check size={16} className="text-[#6366F1]" />}
                </div>
                <p className="text-xs text-white/40 leading-relaxed font-satoshi mt-1">
                  Only explicitly invited collaborators can view project workspaces, discussion boards, and internal assets.
                </p>
              </div>
            </button>

            {/* Public option card */}
            <button
              type="button"
              onClick={() => {
                if (visibility !== 'public') {
                  setVisibility('public');
                  setIsGuest(true);
                  setIsExpanded(false);
                }
              }}
              className={`p-4 rounded-2xl border text-left transition duration-200 flex items-start gap-4 w-full ${
                visibility === 'public'
                  ? 'border-[#6366F1] bg-[#6366F1]/5'
                  : 'border-[#1C1A18] bg-[#0A0908] hover:border-white/10'
              }`}
            >
              <div className={`p-2.5 rounded-xl border ${visibility === 'public' ? 'border-[#6366F1]/20 bg-[#6366F1]/10 text-[#6366F1]' : 'border-white/5 bg-[#161412] text-white/40'}`}>
                <Globe size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-white font-satoshi">Public</span>
                  {visibility === 'public' && <Check size={16} className="text-[#6366F1]" />}
                </div>
                <p className="text-xs text-white/40 leading-relaxed font-satoshi mt-1">
                  Any registered user in the ecosystem can discover and read project details. Guest rules apply optionally.
                </p>
              </div>
            </button>

            {/* Expandable guest access setting (only if visibility is public) */}
            {visibility === 'public' && (
              <div className="border border-[#1C1A18] rounded-2xl bg-[#0A0908] overflow-hidden transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.01] transition-colors"
                >
                  <span className="text-xs font-bold text-[#9B9691] tracking-wider uppercase font-clash">
                    Advanced Access Control
                  </span>
                  {isExpanded ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
                </button>

                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-[#1C1A18]/50 flex flex-col gap-4 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between gap-4 mt-4">
                      <div>
                        <span className="font-extrabold text-xs text-white block">
                          Anonymous Guest View
                        </span>
                        <span className="text-[10px] text-white/40 leading-relaxed block mt-0.5 max-w-[280px]">
                          Allow anyone with the link to read project details without registering.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsGuest(!isGuest)}
                        className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                          isGuest ? 'bg-[#6366F1]' : 'bg-[#1C1A18]'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            isGuest ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Button */}
            <div className="mt-auto pt-6 flex-shrink-0 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-extrabold text-sm bg-[#6366F1] hover:bg-[#575CF0] text-white disabled:opacity-50 transition cursor-pointer"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
