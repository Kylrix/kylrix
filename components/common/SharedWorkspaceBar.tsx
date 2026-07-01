'use client';

import React from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { getEcosystemUrl } from '@/constants/ecosystem';
import Link from 'next/link';

interface SharedWorkspaceBarProps {
  objectType: 'note' | 'goal' | 'form' | 'event' | 'call';
}

export function SharedWorkspaceBar({ objectType }: SharedWorkspaceBarProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <div className="w-full max-w-3xl mx-auto mb-6 px-4">
      <div className="relative group overflow-hidden rounded-2xl border border-white/5 bg-[#141210]/60 backdrop-blur-md p-4 transition-all duration-300 hover:border-white/10">
        {/* Subtle ambient light */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#A855F7]/30 to-transparent pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/5 font-mono text-xs font-black text-[#A855F7]">
              KX
            </div>
            <div>
              <p className="text-xs font-bold text-white font-satoshi">
                Viewing shared {objectType}
              </p>
              <p className="text-[10px] font-bold text-[#9B9691] font-mono tracking-wide uppercase">
                {isAuthenticated ? "Workspace active" : "Read-only view"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-white/5 border border-white/5 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 hover:border-white/20 transition-all font-satoshi"
              >
                Go to Workspace
              </Link>
            ) : (
              <Link
                href={`${getEcosystemUrl('accounts')}/login?source=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin + window.location.pathname) : ''}`}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#A855F7] px-4 py-2 text-xs font-black text-white hover:bg-[#9333EA] transition-all font-satoshi"
              >
                Create your own {objectType}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
