'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Trash2,
  RefreshCw,
  X,
  ShieldCheck,
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { toast } from 'react-hot-toast';

interface SanitizeDrawerProps {
  targetKind?: 'form' | 'note' | 'general';
  targetId?: string;
  targetTitle?: string;
  onClose: () => void;
  onSanitized?: () => void;
}

interface DetectedIssue {
  id: string;
  type: 'duplicate' | 'spam' | 'empty' | 'anomaly';
  title: string;
  reason: string;
  preview: string;
  rawItem: any;
}

export function SanitizeDrawer({
  targetKind = 'form',
  targetId,
  targetTitle,
  onClose,
  onSanitized,
}: SanitizeDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [issues, setIssues] = useState<DetectedIssue[]>([]);
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [totalScanned, setTotalScanned] = useState(0);

  const scanResponses = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      // 1. Check local engine cached responses first
      const cacheKey = `form_responses_${targetId}`;
      let responses = await LocalEngine.cacheGet<any[]>(cacheKey, 60000);

      // 2. If not in local cache or empty, ask FormsService and cache locally
      if (!responses || !Array.isArray(responses) || responses.length === 0) {
        const remote = await FormsService.listSubmissions(targetId);
        responses = (remote.rows || []).filter((s: any) => {
          try {
            const meta = JSON.parse(s.metadata || '{}');
            return !meta.isDraft && !s.isTrash;
          } catch {
            return !s.isTrash;
          }
        });
        await LocalEngine.cacheSet(cacheKey, responses);
      }

      setTotalScanned(responses.length);

      // 3. Local Sanitization Engine: Detect spam, duplicates, junk
      const detected: DetectedIssue[] = [];
      const seenPayloads = new Map<string, string>(); // normalized payload -> first submissionId

      for (const res of responses) {
        let parsedPayload: Record<string, any> = {};
        try {
          parsedPayload = JSON.parse(res.payload || '{}');
        } catch {
          parsedPayload = { raw: res.payload };
        }

        const values = Object.values(parsedPayload).filter(Boolean);
        const combinedText = values.join(' ').trim();
        const normalized = combinedText.toLowerCase().replace(/\s+/g, ' ');

        // Check A: Empty / Blank submission
        if (values.length === 0 || combinedText.length === 0) {
          detected.push({
            id: res.$id,
            type: 'empty',
            title: 'Empty Submission',
            reason: 'No field values recorded in this response',
            preview: 'Blank / Empty response payload',
            rawItem: res,
          });
          continue;
        }

        // Check B: Duplicates (identical normalized answer payload)
        if (seenPayloads.has(normalized)) {
          const originalId = seenPayloads.get(normalized)!;
          detected.push({
            id: res.$id,
            type: 'duplicate',
            title: 'Duplicate Response',
            reason: `Matches identical content from earlier response (${originalId.slice(0, 6)}...)`,
            preview: combinedText.slice(0, 80) + (combinedText.length > 80 ? '...' : ''),
            rawItem: res,
          });
          continue;
        } else {
          seenPayloads.set(normalized, res.$id);
        }

        // Check C: Spam heuristics (repetitive gibberish, common spam patterns, excessive URLs)
        const urlMatches = combinedText.match(/https?:\/\/[^\s]+/gi) || [];
        const isRepeatedChars = /(.)\1{7,}/.test(combinedText);
        const hasSpamKeywords = /\b(buy now|cheap|viagra|casino|crypto pump|free money|click here|telegram: @)\b/i.test(combinedText);

        if (urlMatches.length >= 3 || isRepeatedChars || hasSpamKeywords) {
          detected.push({
            id: res.$id,
            type: 'spam',
            title: 'Spam / Junk Detected',
            reason: urlMatches.length >= 3
              ? 'Contains excessive links (> 2 URLs)'
              : isRepeatedChars
              ? 'Contains excessive character repetition'
              : 'Contains flagged spam / promotional keywords',
            preview: combinedText.slice(0, 80) + (combinedText.length > 80 ? '...' : ''),
            rawItem: res,
          });
        }
      }

      setIssues(detected);
      // Auto-select all flagged issues for 1-click clean
      setSelectedIssueIds(new Set(detected.map((d) => d.id)));
    } catch (err: any) {
      console.error('[SanitizeDrawer] Error scanning items:', err);
      toast.error('Failed to scan responses');
    } finally {
      setLoading(false);
    }
  }, [targetId]);

  useEffect(() => {
    void scanResponses();
  }, [scanResponses]);

  const toggleIssueSelection = (id: string) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handle1ClickSanitize = async () => {
    if (selectedIssueIds.size === 0 || !targetId) return;

    setIsCleaning(true);
    const count = selectedIssueIds.size;
    const toastId = toast.loading(`Sanitizing ${count} flagged item(s)...`);

    try {
      const cacheKey = `form_responses_${targetId}`;
      const cached = (await LocalEngine.cacheGet<any[]>(cacheKey)) || [];

      // 1. Instant local engine update
      const updatedLocal = cached.filter((item) => !selectedIssueIds.has(item.$id));
      await LocalEngine.cacheSet(cacheKey, updatedLocal);

      // 2. Perform background deletions
      const idsToDelete = Array.from(selectedIssueIds);
      for (const id of idsToDelete) {
        try {
          await FormsService.deleteSubmission(id);
        } catch (e) {
          console.warn(`[Sanitize] Remote delete failed for ${id}, handled locally:`, e);
        }
      }

      toast.success(`Sanitized! Removed ${count} junk response(s).`, { id: toastId });
      onSanitized?.();
      onClose();
    } catch (err: any) {
      console.error('[SanitizeDrawer] Error sanitizing:', err);
      toast.error('Sanitization failed', { id: toastId });
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="px-5 pb-6 pt-3 bg-[#161412] flex flex-col gap-4 text-white font-satoshi select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/6 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center text-[#6366F1] shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="font-clash font-extrabold text-base text-white tracking-tight truncate">
              Sanitize {targetTitle ? `"${targetTitle}"` : 'Form'}
            </h3>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">
              Local Engine Clean & Deduplication
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-lg bg-[#0A0908] border border-white/8 text-white/40 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 bg-[#0A0908] border border-white/6 rounded-xl flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
            Scanned Responses
          </span>
          <span className="text-lg font-black text-white font-clash">
            {loading ? '...' : totalScanned}
          </span>
        </div>

        <div className="p-3 bg-[#0A0908] border border-white/6 rounded-xl flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-mono">
            Flagged for Cleanup
          </span>
          <span className={`text-lg font-black font-clash ${issues.length > 0 ? 'text-[#FF453A]' : 'text-[#10B981]'}`}>
            {loading ? '...' : issues.length}
          </span>
        </div>
      </div>

      {/* List of Detected Issues */}
      <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
        {loading ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
            <RefreshCw size={20} className="text-[#6366F1] animate-spin" />
            <span className="text-xs text-white/50 font-medium">
              Analyzing local responses with local engine...
            </span>
          </div>
        ) : issues.length === 0 ? (
          <div className="p-6 text-center bg-[#0A0908] border border-white/6 rounded-2xl flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <h4 className="text-sm font-bold text-white font-clash">Clean & Optimized</h4>
            <p className="text-xs text-white/50 max-w-xs">
              No duplicate entries, blank submissions, or spam patterns detected.
            </p>
          </div>
        ) : (
          issues.map((issue) => {
            const isSelected = selectedIssueIds.has(issue.id);
            return (
              <div
                key={issue.id}
                onClick={() => toggleIssueSelection(issue.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  isSelected
                    ? 'bg-[#1C1A18] border-[#FF453A]/40'
                    : 'bg-[#0A0908] border-white/6 opacity-60 hover:opacity-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleIssueSelection(issue.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 accent-[#FF453A] rounded cursor-pointer"
                />

                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase font-mono tracking-wider border ${
                        issue.type === 'duplicate'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          : issue.type === 'spam'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : 'bg-white/10 border-white/20 text-white/70'
                      }`}
                    >
                      {issue.type}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{issue.title}</span>
                  </div>

                  <p className="text-[11px] text-white/50 leading-relaxed">{issue.reason}</p>

                  <div className="mt-1 p-1.5 bg-[#000000] border border-white/5 rounded-lg text-[10px] font-mono text-white/60 truncate">
                    &quot;{issue.preview}&quot;
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / 1-Click Action */}
      <div className="flex items-center gap-2.5 pt-2 border-t border-white/6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-white/8 bg-[#0A0908] hover:bg-[#1C1A18] text-xs font-bold text-white/80 hover:text-white transition-colors cursor-pointer"
        >
          Cancel
        </button>

        {issues.length > 0 && (
          <button
            type="button"
            disabled={selectedIssueIds.size === 0 || isCleaning}
            onClick={handle1ClickSanitize}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              selectedIssueIds.size === 0 || isCleaning
                ? 'opacity-40 bg-[#161412] border-white/5 text-white/40 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700 text-white border-red-500/30 shadow-[0_4px_16px_rgba(220,38,38,0.25)]'
            }`}
          >
            <Trash2 size={14} />
            <span>
              {isCleaning
                ? 'Sanitizing...'
                : `1-Click Sanitize (${selectedIssueIds.size})`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
