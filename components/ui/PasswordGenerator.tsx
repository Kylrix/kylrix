"use client";

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, RefreshCw, History } from 'lucide-react';
import { generateRandomPassword } from '@/utils/password';
import toast from 'react-hot-toast';

interface PasswordGeneratorProps {
  onPasswordSelect?: (password: string) => void;
  currentPassword?: string;
}

export default function PasswordGenerator({ onPasswordSelect, currentPassword }: PasswordGeneratorProps) {
  const [length, setLength] = useState(16);
  const [password, setPassword] = useState(() => currentPassword || generateRandomPassword(16));
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ value: string; ts: number }[]>([]);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      // On mount, if parent is empty, auto-generate and select
      if (!currentPassword) {
        const newPassword = generateRandomPassword(length);
        setPassword(newPassword);
        if (onPasswordSelect) {
          onPasswordSelect(newPassword);
        }
      } else {
        // If parent already has password, use it internally
        setPassword(currentPassword);
      }
      return;
    }

    // On subsequent length changes, generate new
    const newPassword = generateRandomPassword(length);
    setPassword(newPassword);
    if (onPasswordSelect) {
      onPasswordSelect(newPassword);
    }
  }, [length]);

  const handleGenerate = () => {
    const newPassword = generateRandomPassword(length);
    setPassword(newPassword);
    setCopied(false);
    setHistory((prev) => {
      const next = [{ value: newPassword, ts: Date.now() }, ...prev];
      return next.slice(0, 20);
    });
    if (onPasswordSelect) {
      onPasswordSelect(newPassword);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    toast.success('Copied to clipboard', {
      style: {
        background: '#161412',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: 'white',
      },
    });
  };

  return (
    <div className="w-full bg-[#161412] border border-[#34322F] rounded-2xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black tracking-wider text-white/90 uppercase font-clash">
          Password Generator
        </span>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-[9px] font-black text-white/40 tracking-widest uppercase">
            HISTORY
          </span>
          <div className="relative">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#161412] after:border-white/10 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#10B981]" />
          </div>
        </label>
      </div>

      {/* Generated Password Box */}
      <div className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-[#1C1A18] border border-white/5 rounded-xl min-h-[44px]">
        <span className="font-mono text-xs sm:text-sm font-semibold text-[#10B981] break-all select-all">
          {password}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy Password"
            className="p-1.5 rounded-lg text-white/40 hover:text-[#10B981] hover:bg-white/5 transition-colors"
          >
            {copied ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            title="Regenerate Password"
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Length Controls */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[9px] font-black text-white/30 tracking-widest">
          <span>LENGTH</span>
          <span className="font-mono text-[#10B981] text-xs font-black">{length} CHR</span>
        </div>
        <input
          type="range"
          min="8"
          max="64"
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#10B981] focus:outline-none"
        />
      </div>

      {/* Generate Button */}
      <button
        type="button"
        onClick={handleGenerate}
        className="w-full py-2 px-4 bg-[#10B981] hover:bg-[#0d9b70] text-black font-black text-xs rounded-xl tracking-wider font-clash transition-colors duration-200"
      >
        Generate Password
      </button>

      {/* History */}
      {showHistory && (
        <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 px-0.5 text-white/40">
            <History size={12} />
            <span className="text-[9px] font-black tracking-widest uppercase">
              RECENT PASSWORDS
            </span>
          </div>
          {history.length === 0 ? (
            <span className="text-[10px] text-white/30 italic px-0.5">
              No history yet.
            </span>
          ) : (
            <div className="max-h-28 overflow-y-auto pr-1 flex flex-col gap-1.5">
              {history.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span className="font-mono text-xs text-white/80 truncate">
                      {item.value}
                    </span>
                    <span className="text-[8px] text-white/30">
                      {new Date(item.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(item.value);
                      if (onPasswordSelect) onPasswordSelect(item.value);
                      toast.success('Copied from history');
                    }}
                    className="p-1 rounded text-white/30 hover:text-white hover:bg-white/5 transition-colors shrink-0"
                    title="Copy & Use"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
