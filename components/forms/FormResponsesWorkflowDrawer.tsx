'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Filter, Send, Sparkles, X, ShieldCheck } from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { sanitizePromptInput } from '@/lib/workflows/object-workflows';
import { FormsService } from '@/lib/services/forms';

interface FormResponsesWorkflowDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  submissions?: any[];
  liveFields?: Array<{ id: string; label: string; type: string }>;
  activeWorkspaceId?: string | null;
}

export function FormResponsesWorkflowDrawer({
  isOpen,
  onClose,
  formId,
  formTitle,
  submissions = [],
  liveFields = [],
  activeWorkspaceId,
}: FormResponsesWorkflowDrawerProps) {
  const { showSuccess, showError, showInfo } = useToast();
  const [loadedSubmissions, setLoadedSubmissions] = useState<any[]>(submissions);
  const [_isLoadingSubmissions, setIsLoadingSubmissions] = useState<boolean>(false);

  const [selectedLiveField, setSelectedLiveField] = useState<string>('');
  const [liveFilterOp, setLiveFilterOp] = useState<'not_empty' | 'equals'>('not_empty');
  const [liveFilterVal, setLiveFilterVal] = useState<string>('');

  const [ghostProOnly, setGhostProOnly] = useState<boolean>(false);
  const [ghostAuthOnly, setGhostAuthOnly] = useState<boolean>(false);

  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !formId) return;
    let cancelled = false;
    setIsLoadingSubmissions(true);

    FormsService.listSubmissions(formId)
      .then((res: any) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : res?.rows || [];
        setLoadedSubmissions(list.length > 0 ? list : submissions);
      })
      .catch(() => {
        if (!cancelled) setLoadedSubmissions(submissions);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSubmissions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, formId, submissions]);

  const effectiveSubmissions = loadedSubmissions.length > 0 ? loadedSubmissions : submissions;

  // Filter submissions based on specified live & ghost field criteria
  const filteredSubmissions = useMemo(() => {
    return effectiveSubmissions.filter((sub) => {
      const data = sub.data || sub.payload || {};
      const ghost = sub._ghost || sub.ghostData || {};

      // Live field filter
      if (selectedLiveField) {
        const val = data[selectedLiveField];
        if (liveFilterOp === 'not_empty' && (val === undefined || val === null || val === '')) {
          return false;
        }
        if (liveFilterOp === 'equals' && String(val || '').toLowerCase() !== liveFilterVal.toLowerCase()) {
          return false;
        }
      }

      // Ghost field filter: Pro Tier
      if (ghostProOnly && ghost.planTier !== 'pro' && !ghost.isPro) {
        return false;
      }

      // Ghost field filter: Authenticated Identity
      if (ghostAuthOnly && !ghost.userId && !sub.userId) {
        return false;
      }

      return true;
    });
  }, [effectiveSubmissions, selectedLiveField, liveFilterOp, liveFilterVal, ghostProOnly, ghostAuthOnly]);

  if (!isOpen) return null;

  const handleRunWorkflow = async () => {
    if (filteredSubmissions.length === 0) {
      showError('No submissions match the selected filters');
      return;
    }

    setIsProcessing(true);
    showInfo(`Processing ${filteredSubmissions.length} form responses...`);

    try {
      const sanitizedUserPrompt = sanitizePromptInput(customPrompt);
      const responsesSummary = filteredSubmissions
        .map((s, idx) => {
          const mainContent = JSON.stringify(s.data || s.payload || {});
          return `Response #${idx + 1}: ${mainContent}`;
        })
        .join('\n\n');

      const fullSourceText = `Form: ${formTitle}\nTotal Filtered Submissions: ${filteredSubmissions.length}\n${sanitizedUserPrompt ? `User Specific Guidelines: ${sanitizedUserPrompt}\n` : ''}\nSubmissions:\n${responsesSummary}`;

      const { unifiedCreate } = await import('@/lib/services/unified-object-service');
      const { generateAIContent } = await import('@/lib/actions/ai');

      const systemInstruction = `You are Kylrix AI, an agentic goal architect.
Analyze the provided form submission responses and extract actionable Goals for Kylrix Flow.

Return ONLY a JSON array of goal objects:
[
  {
    "title": "Clear Goal Title",
    "description": "Comprehensive goal description detailing background and actionable targets.",
    "priority": "low | medium | high"
  }
]`;

      const aiRes = await generateAIContent({
        mode: 'GENERIC_CHAT',
        prompt: fullSourceText,
        systemInstruction,
      });

      if (aiRes.success && aiRes.data) {
        let jsonText = aiRes.data.replace(/```json/g, '').replace(/```/g, '').trim();
        let parsed = JSON.parse(jsonText);
        if (!Array.isArray(parsed)) parsed = [parsed];

        for (const item of parsed) {
          if (item?.title) {
            await unifiedCreate('goal', {
              title: item.title,
              description: `${item.description || ''}\n\n--- Synthesized from Form Responses (${formTitle}) ---`,
              status: 'todo',
              priority: item.priority || 'medium',
              ...(activeWorkspaceId ? { projectId: activeWorkspaceId, isWorkspace: true } : {}),
            });
          }
        }
      } else {
        await unifiedCreate('goal', {
          title: `Goal from Form: ${formTitle}`,
          description: fullSourceText,
          status: 'todo',
          priority: 'medium',
          ...(activeWorkspaceId ? { projectId: activeWorkspaceId, isWorkspace: true } : {}),
        });
      }

      showSuccess(`Created actionable goals from ${filteredSubmissions.length} form responses!`);
      onClose();
    } catch (err: any) {
      showError('Workflow Failed', err?.message || 'Could not process form responses');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10090] bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl h-full bg-[#161412] text-white border-l border-white/10 flex flex-col p-6 overflow-y-auto font-satoshi shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold font-clash text-white">Form Responses Workflow</h3>
              <p className="text-xs text-[#9B9691]">Synthesize goals & ideas from submissions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#9B9691] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters section */}
        <div className="space-y-6 flex-1">
          {/* Live fields criteria */}
          <div className="p-4 rounded-2xl bg-[#000000] border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#A855F7] uppercase tracking-wider">
              <Filter size={14} />
              <span>Filter by Live Fields</span>
            </div>
            {liveFields.length === 0 ? (
              <p className="text-xs text-[#9B9691]">No live fields detected for this form.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={selectedLiveField}
                  onChange={(e) => setSelectedLiveField(e.target.value)}
                  className="bg-[#161412] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-[#A855F7]"
                >
                  <option value="">-- All Live Fields --</option>
                  {liveFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label || f.id}
                    </option>
                  ))}
                </select>

                <select
                  value={liveFilterOp}
                  onChange={(e) => setLiveFilterOp(e.target.value as any)}
                  className="bg-[#161412] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-[#A855F7]"
                >
                  <option value="not_empty">Is Not Empty</option>
                  <option value="equals">Equals</option>
                </select>

                {liveFilterOp === 'equals' ? (
                  <input
                    type="text"
                    value={liveFilterVal}
                    onChange={(e) => setLiveFilterVal(e.target.value)}
                    placeholder="Value..."
                    className="bg-[#161412] border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-[#A855F7]"
                  />
                ) : null}
              </div>
            )}
          </div>

          {/* Ghost fields criteria */}
          <div className="p-4 rounded-2xl bg-[#000000] border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#10B981] uppercase tracking-wider">
              <ShieldCheck size={14} />
              <span>Filter by Ghost Fields</span>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ghostProOnly}
                  onChange={(e) => setGhostProOnly(e.target.checked)}
                  className="rounded border-white/20 bg-[#161412] text-[#10B981] focus:ring-0"
                />
                <span className="text-xs text-white/90 font-medium">Only responses from Pro users</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ghostAuthOnly}
                  onChange={(e) => setGhostAuthOnly(e.target.checked)}
                  className="rounded border-white/20 bg-[#161412] text-[#10B981] focus:ring-0"
                />
                <span className="text-xs text-white/90 font-medium">
                  Only responses from authenticated/logged-in users
                </span>
              </label>
            </div>
          </div>

          {/* Submission Counter */}
          <div className="flex items-center justify-between px-2 text-xs text-[#9B9691] font-semibold">
            <span>Matching Submissions:</span>
            <span className="text-white font-mono bg-white/10 px-2.5 py-1 rounded-lg">
              {filteredSubmissions.length} of {submissions.length}
            </span>
          </div>

          {/* Additional prompt input (Optional) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white uppercase tracking-wider">
              Specify Preferences / Custom Instructions <span className="text-[#9B9691] font-normal">(Optional)</span>
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              placeholder="Specify preferences (optional) e.g., Extract bug reports, prioritize feature requests, or organize by urgency..."
              className="w-full bg-[#000000] border border-white/10 rounded-2xl p-3.5 text-xs text-white placeholder-[#9B9691] focus:outline-none focus:border-[#A855F7] transition-all resize-none font-satoshi"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-white/10 pt-4 mt-6 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-[#9B9691] hover:text-white hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleRunWorkflow}
            disabled={isProcessing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A855F7] text-white font-bold text-xs hover:bg-[#A855F7]/90 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send size={14} />
            <span>{isProcessing ? 'Generating...' : 'Synthesize Workflow'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
