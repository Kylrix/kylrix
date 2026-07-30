'use client';

import React from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { getEcosystemUrl } from '@/constants/ecosystem';
import Link from 'next/link';

interface SharedWorkspaceBarProps {
  objectType: 'note' | 'goal' | 'form' | 'event' | 'call' | 'session' | 'message';
}

export function SharedWorkspaceBar({ objectType }: SharedWorkspaceBarProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mb-6">
      <div className="relative overflow-hidden rounded-2xl border border-[#34322F] bg-[#161412] p-4 transition-all duration-300 hover:border-white/10">
        {/* Subtle ambient light */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#6366F1]/30 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B0A09] border border-white/5 font-mono text-xs font-black text-[#6366F1]">
              KX
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-0.5">
              <p className="text-xs font-bold text-white font-satoshi leading-snug truncate">
                Viewing shared {objectType}
              </p>
              <p className="text-[10px] font-bold text-[#9B9691] font-mono tracking-wide uppercase leading-snug">
                {isAuthenticated ? 'Workspace active' : 'Read-only view'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center flex-shrink-0">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#0B0A09] border border-white/8 px-4 py-2 text-xs font-bold text-white hover:bg-white/5 hover:border-white/15 transition-all font-satoshi"
              >
                Go to Workspace
              </Link>
            ) : (
              <Link
                href={`${getEcosystemUrl('accounts')}/login?source=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin + window.location.pathname) : ''}`}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#6366F1] px-4 py-2 text-xs font-black text-white hover:bg-[#5254E8] transition-all font-satoshi"
              >
                Create your own {objectType === 'session' || objectType === 'message' ? 'chat' : objectType}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
