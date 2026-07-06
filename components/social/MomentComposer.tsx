'use client';

import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface MomentComposerProps {
  publishing: boolean;
  onPublish: (text: string) => Promise<boolean>;
  filterTags: string[];
  placeholder?: string;
  className?: string;
}

export function MomentComposer({
  publishing,
  onPublish,
  filterTags,
  placeholder = "Share your build, ideas, or engineering notes with the global Nostr network...",
  className = ""
}: MomentComposerProps) {
  const [text, setText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || publishing) return;

    const success = await onPublish(text);
    if (success) {
      setText('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`bg-[#161412] border border-white/5 rounded-3xl p-5 flex flex-col gap-4 shadow-lg ${className}`}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        disabled={publishing}
        className="w-full bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/10 resize-none min-h-[90px]"
      />
      <div className="flex justify-between items-center">
        <div className="flex gap-1.5 flex-wrap">
          {filterTags.slice(0, 3).map(tag => (
            <span 
              key={tag} 
              onClick={() => !publishing && setText(prev => prev + ` #${tag}`)}
              className="text-[10px] font-mono text-[#F59E0B] bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10 cursor-pointer border border-[#F59E0B]/10 px-2 py-0.5 rounded-md transition-all"
            >
              #{tag}
            </span>
          ))}
        </div>
        <button
          type="submit"
          disabled={publishing || !text.trim()}
          className="px-5 py-2 bg-white text-black font-extrabold text-xs rounded-xl hover:bg-white/90 disabled:bg-white/40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
        >
          {publishing ? 'Publishing...' : 'Publish Post'}
          <Send size={12} />
        </button>
      </div>
    </form>
  );
}
