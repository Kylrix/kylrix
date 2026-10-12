'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { Loader2, Send, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function TelegramConnectPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#000000] text-white flex items-center justify-center font-mono text-sm">
          <Loader2 className="animate-spin text-[#0088cc]" size={24} />
        </div>
      }
    >
      <TelegramConnectContent />
    </Suspense>
  );
}

function TelegramConnectContent() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { open: openDrawer } = useUnifiedDrawer();

  useEffect(() => {
    if (isLoading) return;

    if (user?.$id) {
      // User is already logged in -> redirect straight into settings with Telegram drawer triggered
      router.replace('/settings?tab=general&drawer=telegram');
    }
  }, [user?.$id, isLoading, router]);

  const handleSignIn = () => {
    openDrawer('login');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center p-4 selection:bg-[#0088cc]/30">
      <div className="max-w-md w-full bg-[#0A0908] border-2 border-white/20 rounded-[28px] p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#0088cc]/20 blur-3xl pointer-events-none rounded-full" />

        {/* Telegram Icon Badge */}
        <div className="w-16 h-16 rounded-2xl bg-[#0088cc]/10 border-2 border-[#0088cc]/30 text-[#0088cc] flex items-center justify-center mb-6 shadow-lg shadow-[#0088cc]/10">
          <Send size={30} className="-ml-0.5 mt-0.5 text-[#0088cc]" />
        </div>

        <h1 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white mb-2">
          Connect Telegram
        </h1>
        <p className="text-xs sm:text-sm text-white/60 font-medium mb-6 leading-relaxed">
          Link your Kylrix sovereign workspace to receive instant alerts, search ideas, and dispatch commands right inside Telegram.
        </p>

        {isLoading ? (
          <div className="flex items-center gap-2 text-white/50 text-xs font-mono py-4">
            <Loader2 className="animate-spin" size={16} />
            <span>Verifying session...</span>
          </div>
        ) : user?.$id ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono">
              <ShieldCheck size={16} />
              <span>Signed in as {user.name || user.email}</span>
            </div>
            <Link
              href="/settings?tab=general&drawer=telegram"
              className="w-full py-3 px-5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#0088cc]/20 border-2 border-[#0088cc]"
            >
              <span>Open Telegram Setup</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={handleSignIn}
              className="w-full py-3.5 px-5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#0088cc]/20 border-2 border-[#0088cc] cursor-pointer"
            >
              <span>Sign In to Link Telegram</span>
              <ArrowRight size={15} />
            </button>
            <p className="text-[11px] text-white/40 font-mono mt-1">
              No account? Creating one takes 10 seconds.
            </p>
          </div>
        )}

        {/* Feature List */}
        <div className="w-full border-t border-white/10 mt-6 pt-5 grid grid-cols-2 gap-3 text-left">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0088cc] mt-1.5 shrink-0" />
            <span className="text-[11px] text-white/70 font-medium">💡 Idea search & quick capture</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0088cc] mt-1.5 shrink-0" />
            <span className="text-[11px] text-white/70 font-medium">🎯 Milestone & goal tracking</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0088cc] mt-1.5 shrink-0" />
            <span className="text-[11px] text-white/70 font-medium">🔒 Encrypted token pairing</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0088cc] mt-1.5 shrink-0" />
            <span className="text-[11px] text-white/70 font-medium">⚡ Persistent interactive menu</span>
          </div>
        </div>
      </div>
    </div>
  );
}
