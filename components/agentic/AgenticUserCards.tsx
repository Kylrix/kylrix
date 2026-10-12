'use client';

import React from 'react';
import { Users, Send } from 'lucide-react';
import type { UserSearchHit } from '@/lib/agentic/message-blocks';
import { useWalletOverlay } from '@/context/WalletOverlayContext';

export function AgenticUserCards({
  query,
  users,
}: {
  query: string;
  users: UserSearchHit[];
}) {
  const { openWalletWithIntent } = useWalletOverlay();

  if (!users.length) {
    return (
      <div className="p-3 rounded-xl bg-[#161412] border border-white/[0.06] text-xs text-white/40 font-satoshi text-center my-2">
        No directory users found matching &ldquo;{query}&rdquo;.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 my-2 w-full">
      <div className="flex items-center gap-1.5 text-xs font-bold text-white/70 font-satoshi px-1">
        <Users size={14} className="text-[#6366F1]" />
        <span>Directory Results ({users.length})</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="p-3 rounded-2xl bg-[#161412] border border-white/[0.08] flex items-center justify-between gap-3 shadow-sm hover:border-white/20 transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#0A0908] border border-white/[0.08] flex items-center justify-center font-bold text-xs text-white/70 shrink-0 font-satoshi">
                  {user.displayName ? user.displayName[0]?.toUpperCase() : 'U'}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white font-satoshi truncate">
                  {user.displayName}
                </div>
                <div className="text-[10px] text-white/40 font-mono truncate">
                  @{user.username}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                openWalletWithIntent({
                  mode: 'send',
                  toUser: {
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                  },
                });
              }}
              className="py-1 px-2.5 rounded-lg bg-[#6366F1]/15 hover:bg-[#6366F1]/25 border border-[#6366F1]/30 text-[#6366F1] hover:text-white text-xs font-bold font-satoshi flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              <Send size={11} />
              <span>Tip</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
