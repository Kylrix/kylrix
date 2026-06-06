'use client';

import React, { useState } from 'react';
import { X, Users, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TeamDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export default function TeamDialog({ open, onClose, onSubmit }: TeamDialogProps) {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      await onSubmit(name.trim());
      setName('');
      onClose();
    } catch (err) {
      // Error handled by parent via toast
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1400] cursor-default"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 md:left-auto md:right-0 md:top-0 md:w-[480px] bg-[#161412] border-t md:border-t-0 md:border-l border-white/10 z-[1401] flex flex-col shadow-2xl rounded-t-[32px] md:rounded-t-0 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#161412]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center">
                  <Users size={22} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-white text-lg font-black tracking-tight leading-tight uppercase font-clash">
                    New Ecosystem Team
                  </h3>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mt-0.5">
                    Orchestrate collaborative execution
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 bg-[#0A0908]">
              {/* Context Notice */}
              <div className="p-4 rounded-2xl bg-[#161412] border border-white/5 space-y-2">
                <div className="flex items-center gap-2 text-[#10B981]">
                  <Shield size={14} />
                  <span className="text-[11px] font-black uppercase tracking-wider">Authoritative Protocol</span>
                </div>
                <p className="text-white/50 text-[12px] font-semibold leading-relaxed">
                  Teams are first-class ecosystem citizens. Creating a team allows you to securely share notes, vault items, and launch persistent huddles with a verified roster.
                </p>
              </div>

              {/* Input Field */}
              <div className="flex flex-col gap-2">
                <label className="text-white/30 text-[10px] font-black uppercase tracking-[0.2em] ml-1">
                  Team Identity
                </label>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alpha Execution Unit"
                  className="w-full bg-[#161412] text-white border border-white/8 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-[#10B981]/50 transition-all placeholder:text-white/10"
                />
              </div>

              {/* Action */}
              <div className="mt-auto pt-6 border-t border-white/4">
                <button
                  onClick={handleCreate}
                  disabled={isSaving || !name.trim()}
                  className="w-full group flex items-center justify-between p-5 rounded-2xl bg-[#10B981] text-black transition-all hover:bg-[#0fa976] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_12px_40px_-12px_rgba(16,185,129,0.4)]"
                >
                  <div className="flex items-center gap-3">
                    {isSaving ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Users size={20} strokeWidth={2.5} />
                    )}
                    <span className="font-black text-sm uppercase tracking-tight">
                      {isSaving ? 'Spinning Up Team...' : 'Provision Team'}
                    </span>
                  </div>
                  <ArrowRight size={18} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            {/* Footer Persistence Ledger */}
            <div className="p-4 bg-[#161412] border-t border-white/5 flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-white/20 font-black text-[9px] uppercase tracking-[0.15em] font-mono">
                System Ledger: Provisioning Collaborative Node
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
