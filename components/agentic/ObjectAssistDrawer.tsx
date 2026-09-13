'use client';

import React, { useState } from 'react';
import { Sparkles, X, ArrowRight, Wand2, Check, RefreshCw } from 'lucide-react';
import { Drawer } from '@/lib/openbricks/primitives';
import { generateObjectAssistSchemaAction } from '@/lib/actions/ai';
import toast from 'react-hot-toast';

export interface ObjectAssistDrawerProps {
  open: boolean;
  onClose: () => void;
  kind?: 'form' | 'event' | 'goal' | 'note' | string;
  title?: string;
  subtitle?: string;
  currentData?: any;
  onApply: (generatedResult: any) => void;
}

const KIND_PRESETS: Record<string, string[]> = {
  form: [
    'Customer Feedback & NPS Survey',
    'Event Registration & Dietary Preferences',
    'Job Application & Candidate Info',
    'Support Ticket & Bug Report',
    'Product Feature Request & Voting',
  ],
  event: [
    'Weekly Team Sync with Video Call',
    'Community Developer Meetup',
    'Design Sprint Review Session',
  ],
  goal: [
    'Launch Product v1.0 Roadmap',
    'Increase Quarterly User Engagement',
  ],
  note: [
    'Meeting Notes and Key Action Items',
    'Project Brief and Tech Spec',
  ],
};

export function ObjectAssistDrawer({
  open,
  onClose,
  kind = 'form',
  title,
  subtitle,
  onApply,
}: ObjectAssistDrawerProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);

  const presets = KIND_PRESETS[kind] || KIND_PRESETS['form'];
  const displayTitle = title || `Kylrix Assist — ${kind.toUpperCase()} Generator`;
  const displaySubtitle = subtitle || `Prompt AI to automatically design and populate your ${kind} schema in seconds.`;

  const handleGenerate = async (targetPrompt?: string) => {
    const activePrompt = targetPrompt || prompt;
    if (!activePrompt.trim()) {
      toast.error('Please enter a prompt or pick a preset');
      return;
    }

    setLoading(true);
    setGeneratedResult(null);

    try {
      const res = await generateObjectAssistSchemaAction({
        kind,
        prompt: activePrompt.trim(),
      });

      if (res.success && res.data) {
        setGeneratedResult(res.data);
        toast.success(`${kind.toUpperCase()} generated! Review and apply.`);
      } else {
        toast.error(res.error || 'Failed to generate content');
      }
    } catch (err: any) {
      console.error('[ObjectAssistDrawer] Exception:', err);
      toast.error('AI Service unavailable or request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedResult) return;
    onApply(generatedResult);
    toast.success('Applied to editor!');
    onClose();
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: false, disablePortal: true }}
      PaperProps={{
        sx: {
          width: '100%',
          maxWidth: 720,
          mx: 'auto',
          borderRadius: '28px 28px 0 0',
          bgcolor: '#161412',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          backgroundImage: 'none',
          p: 0,
          zIndex: 1400,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Drawer Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between gap-4 shrink-0 bg-[#161412]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6366F1]/20 to-[#EC4899]/20 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1] shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <h3 className="font-clash font-extrabold text-base text-white tracking-tight truncate">
              {displayTitle}
            </h3>
            <p className="text-xs font-satoshi text-white/50 truncate">
              {displaySubtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all shrink-0 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="p-5 flex-1 overflow-y-auto space-y-5 scrollbar-thin">
        {/* Preset Chips */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40 block">
            Suggested Presets
          </span>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setPrompt(preset);
                  void handleGenerate(preset);
                }}
                disabled={loading}
                className="px-3 py-1.5 rounded-xl bg-[#000000] border border-white/10 hover:border-[#6366F1]/50 hover:bg-[#6366F1]/10 text-white/80 hover:text-white font-satoshi text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40 block">
            Custom Prompt
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Describe the ${kind} or questions you want Kylrix Assist to create...`}
              className="w-full bg-[#000000] border border-white/10 focus:border-[#6366F1] rounded-2xl p-3.5 text-xs text-white placeholder-white/30 outline-none resize-none font-satoshi leading-relaxed transition-all"
            />
          </div>
        </div>

        {/* Generate Button */}
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={loading || !prompt.trim()}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] hover:from-[#5254E8] hover:to-[#7C3AED] text-white font-clash font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_4px_16px_rgba(99,102,241,0.3)] disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Generating with Kylrix Assist...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Generate {kind.toUpperCase()} Schema</span>
            </>
          )}
        </button>

        {/* Generated Schema Preview */}
        {generatedResult && (
          <div className="p-4 rounded-2xl bg-[#000000] border border-[#6366F1]/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6366F1] flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Generated Preview
              </span>
              {generatedResult.fields && (
                <span className="text-[10px] font-mono text-white/40">
                  {generatedResult.fields.length} questions
                </span>
              )}
            </div>

            {generatedResult.title && (
              <div>
                <h4 className="font-clash font-extrabold text-sm text-white">
                  {generatedResult.title}
                </h4>
                {generatedResult.description && (
                  <p className="text-xs font-satoshi text-white/60 mt-0.5">
                    {generatedResult.description}
                  </p>
                )}
              </div>
            )}

            {Array.isArray(generatedResult.fields) && (
              <div className="space-y-2 pt-1 border-t border-white/5">
                {generatedResult.fields.map((f: any, idx: number) => (
                  <div
                    key={f.id || idx}
                    className="p-2.5 rounded-xl bg-[#161412] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="font-satoshi font-bold text-white block truncate">
                        {idx + 1}. {f.label}
                      </span>
                      {f.options && (
                        <span className="text-[10px] text-white/40 font-mono block truncate">
                          Options: {f.options.join(', ')}
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-mono font-bold text-white/70 uppercase shrink-0">
                      {f.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer Actions */}
      {generatedResult && (
        <div className="p-4 border-t border-white/5 bg-[#161412] shrink-0">
          <button
            type="button"
            onClick={handleApply}
            className="w-full py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-clash font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/20"
          >
            <span>Apply to Form Editor</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}
    </Drawer>
  );
}
