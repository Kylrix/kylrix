'use client';

import { useState } from 'react';
import { Copy, Check, Braces } from 'lucide-react';

export function JsonRenderer({ raw, collapsed = false }: { raw: string; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);
  const [copied, setCopied] = useState(false);
  let pretty = raw;
  let valid = true;
  try {
    const parsed = JSON.parse(raw);
    pretty = JSON.stringify(parsed, null, 2);
  } catch {
    valid = false;
  }
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div className="rounded-[12px] border border-white/8 bg-[#0B0A09] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-white/60">
          <Braces size={12} className="text-white/40" />
          <span>{valid ? 'JSON' : 'Raw'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setOpen((v) => !v)} className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/8 text-[11px] font-bold text-white/60 hover:text-white">
            {open ? 'Collapse' : 'Expand'}
          </button>
          <button type="button" onClick={handleCopy} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/8 text-white/60 hover:text-white">
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      {open && (
        <pre className="p-3 text-[11px] font-mono text-white/80 whitespace-pre-wrap break-words max-h-[360px] overflow-auto">{pretty}</pre>
      )}
    </div>
  );
}

export function looksLikeJson(s: string): boolean {
  const t = String(s || '').trim();
  if (!t) return false;
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      JSON.parse(t);
      return true;
    } catch {
      return t.includes('"toolCalls"') || t.includes('"toolKey"') || t.includes('"specifier"');
    }
  }
  return (t.includes('"toolCalls"') && t.includes('"toolKey"')) || (t.includes('"response"') && t.includes('"toolCalls"'));
}
