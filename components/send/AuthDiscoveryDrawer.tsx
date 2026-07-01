'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';

const PRIMARY = '#6366F1';

function getPathTitle(path: string): string {
  if (path.startsWith('/projects')) return 'Projects';
  if (path.startsWith('/app')) return 'Note';
  if (path.startsWith('/flow')) return 'Flow';
  if (path.startsWith('/vault')) return 'Vault';
  if (path.startsWith('/connect')) return 'Connect';
  if (path.startsWith('/accounts')) return 'Accounts';
  if (path.startsWith('/settings')) return 'Settings';
  if (path.startsWith('/agents')) return 'Agents';
  return 'your dashboard';
}

export function AuthDiscoveryDrawer() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  
  const [open, setOpen] = useState(false);
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const source = sessionStorage.getItem('kylrix_send_redirect_source');
      if (source) {
        setTargetPath(source);
        setOpen(true);
      }
    }
  }, [isLoading, isAuthenticated]);

  const handleReturn = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    sessionStorage.removeItem('kylrix_send_redirect_source');
    setOpen(false);
    if (targetPath) {
      router.push(targetPath);
    }
  }, [targetPath, router]);

  useEffect(() => {
    if (open && countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, countdown]);

  // Manual return only — no auto-redirect countdown (prevents phantom bounce after auth blips).

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    sessionStorage.removeItem('kylrix_send_redirect_source');
    setOpen(false);
  };

  if (!open || !targetPath) return null;

  return (
    <div className="fixed bottom-6 right-6 left-6 md:left-auto z-50 max-w-md w-full animate-in slide-in-from-bottom duration-300 select-none">
      <div className="bg-[#161412] border border-white/8 shadow-[0_20px_40px_rgba(0,0,0,0.6)] rounded-[24px] p-6 relative overflow-hidden">
        
        {/* Countdown Progress Bar */}
        <div 
          style={{ 
            width: `${(countdown / 5) * 100}%`,
            transition: 'width 1s linear'
          }} 
          className="absolute top-0 left-0 h-[3px] bg-[#6366F1]"
        />
        
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex-shrink-0 flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-white font-mono leading-tight">
                Authenticated account detected
              </h4>
              <p className="text-white/60 text-xs font-semibold mt-1">
                Returning to {getPathTitle(targetPath)} in {countdown}...
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleCancel}
              className="p-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <button
              onClick={handleReturn}
              className="h-10 px-4 rounded-xl bg-[#6366F1] hover:bg-[#6366F1]/90 text-black font-extrabold text-xs flex items-center justify-center gap-1 transition-all flex-1 sm:flex-none whitespace-nowrap"
            >
              <span>Go Now</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
