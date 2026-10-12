'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, ArrowRight, Wand2, Check, RefreshCw, MessageSquare, Send, Bot, User as UserIcon } from 'lucide-react';
import { Drawer } from '@/lib/openbricks/primitives';
import { generateObjectAssistSchemaAction } from '@/lib/actions/ai';
import { executeSidekickAction, executeSidekickChat } from '@/lib/actions/sidekick';
import { LocalEngine } from '@/lib/services/LocalEngine';
import { useAuth } from '@/context/auth/AuthContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { getAgenticUserMessage } from '@/lib/agentic/errors';
import toast from 'react-hot-toast';

export interface ObjectAssistDrawerProps {
  open: boolean;
  onClose: () => void;
  kind?: 'form' | 'event' | 'goal' | 'note' | string;
  targetId?: string;
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

const SAMPLE_CACHE_KEY = 'form_assist_samples';

export function ObjectAssistDrawer({
  open,
  onClose,
  kind = 'form',
  targetId,
  title,
  subtitle,
  onApply,
}: ObjectAssistDrawerProps) {
  const { user, getJWT } = useAuth();
  const { openProUpgrade } = useProUpgrade();

  const getJWTToken = async () => {
    try {
      if (getJWT) {
        const token = await getJWT();
        if (token) return token;
      }
      const { account } = await import('@/lib/appwrite/client');
      const res = await account.createJWT();
      return res?.jwt || undefined;
    } catch {
      return undefined;
    }
  };
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<any | null>(null);

  // Sidekick session & Samples state
  const [activeTab, setActiveTab] = useState<'assist' | 'sidekick'>('assist');
  const [samples, setSamples] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isPro = hasPaidKylrixPlan(user);
  const effectiveTargetId = targetId || 'new_form';

  const presets = KIND_PRESETS[kind] || KIND_PRESETS['form'];
  const displayTitle = title || `Kylrix Assist — ${kind.toUpperCase()} Generator`;
  const displaySubtitle = subtitle || `Prompt AI to automatically design and populate your ${kind} schema in seconds.`;

  // 1. Load dynamic samples from LocalEngine cache on open
  useEffect(() => {
    if (!open) return;
    const loadSamplesAndCache = async () => {
      const cached = await LocalEngine.cacheGet<string[]>(SAMPLE_CACHE_KEY).catch(() => null);
      if (cached && cached.length > 0) {
        setSamples(cached);
      } else {
        setSamples(presets);
        void LocalEngine.cacheSet(SAMPLE_CACHE_KEY, presets).catch(() => {});
      }

      // Restore sidekick chat history from LocalEngine if present
      const cachedChat = await LocalEngine.cacheGet<any[]>(`sidekick:chat:${kind}:${effectiveTargetId}`).catch(() => null);
      if (cachedChat) {
        setChatMessages(cachedChat);
      }
    };
    void loadSamplesAndCache();
  }, [open, kind, effectiveTargetId]);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'sidekick') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const handleGenerate = async (targetPrompt?: string) => {
    const activePrompt = targetPrompt || prompt;
    if (!activePrompt.trim()) {
      toast.error('Please enter a prompt or pick a sample');
      return;
    }

    setLoading(true);
    setGeneratedResult(null);

    try {
      const jwt = await getJWTToken();
      const res = await generateObjectAssistSchemaAction({
        kind,
        prompt: activePrompt.trim(),
        jwt,
      });

      if (res.success && res.data) {
        setGeneratedResult(res.data);
        toast.success(`${kind.toUpperCase()} generated! Review and apply.`);

        // Dynamically append new prompt sample to LocalEngine cache
        const nextSamples = Array.from(new Set([activePrompt.trim(), ...samples])).slice(0, 10);
        setSamples(nextSamples);
        void LocalEngine.cacheSet(SAMPLE_CACHE_KEY, nextSamples).catch(() => {});
      } else {
        toast.error(res.error || 'Failed to generate content');
      }
    } catch (err: any) {
      console.error('[ObjectAssistDrawer] Exception:', err);
      toast.error(getAgenticUserMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Sidekick session handler
  const handleOpenSidekick = async () => {
    if (!isPro) {
      openProUpgrade('Sidekick Session');
      return;
    }

    setActiveTab('sidekick');

    if (chatMessages.length === 0) {
      setChatLoading(true);
      try {
        const jwt = await getJWTToken();
        const res = await executeSidekickAction({
          target: {
            type: kind,
            id: effectiveTargetId,
            title: displayTitle,
          },
          jwt,
        });
        if (res.success && res.result) {
          setSessionId(res.sessionId || null);
          const initMsg = {
            role: 'assistant',
            content: `I'm your dedicated ${kind} sidekick session! How can we refine or expand this ${kind}?`,
          };
          setChatMessages([initMsg]);
          void LocalEngine.cacheSet(`sidekick:chat:${kind}:${effectiveTargetId}`, [initMsg]).catch(() => {});
        } else {
          toast.error(res.error || 'Failed to start Sidekick session');
        }
      } catch (e: any) {
        console.error('Sidekick session start failed:', e);
      } finally {
        setChatLoading(false);
      }
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    if (!isPro) {
      openProUpgrade('Sidekick Session');
      return;
    }

    const userMsg = { role: 'user', content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    const msgText = chatInput.trim();
    setChatInput('');
    setChatLoading(true);

    try {
      const jwt = await getJWTToken();
      const res = await executeSidekickChat({
        target: { type: kind, id: effectiveTargetId, title: displayTitle },
        message: msgText,
        sessionId: sessionId || undefined,
        jwt,
      });

      if (res.success && res.response) {
        if (res.sessionId) setSessionId(res.sessionId);
        const assistantMsg = { role: 'assistant', content: res.response };
        const finalMessages = [...updatedMessages, assistantMsg];
        setChatMessages(finalMessages);
        void LocalEngine.cacheSet(`sidekick:chat:${kind}:${effectiveTargetId}`, finalMessages).catch(() => {});

        // Check if sidekick output contains a raw JSON schema to auto-apply/preview
        try {
          const cleaned = res.response.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
          const parsed = JSON.parse(cleaned);
          if (parsed && (parsed.fields || parsed.title)) {
            setGeneratedResult(parsed);
            toast.success('Updated schema generated from sidekick feedback!');
          }
        } catch (_e) {}
      } else {
        toast.error(res.error || 'Sidekick failed to respond');
      }
    } catch (err: any) {
      console.error('Sidekick chat error:', err);
      toast.error(getAgenticUserMessage(err));
    } finally {
      setChatLoading(false);
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

        <div className="flex items-center gap-2">
          {/* Sidekick Session Switcher */}
          <button
            type="button"
            onClick={activeTab === 'assist' ? handleOpenSidekick : () => setActiveTab('assist')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-satoshi font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'sidekick'
                ? 'bg-[#6366F1]/20 border-[#6366F1] text-white'
                : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
            }`}
          >
            <MessageSquare size={14} />
            <span>{activeTab === 'sidekick' ? 'Generator' : 'Sidekick Session'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="p-5 flex-1 overflow-y-auto space-y-5 scrollbar-thin">
        {activeTab === 'assist' ? (
          <>
            {/* Dynamic Samples & Preset Chips */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40 block">
                Instant 1-Click Samples (Cached Locally)
              </span>
              <div className="flex flex-wrap gap-2">
                {samples.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setPrompt(sample);
                      void handleGenerate(sample);
                    }}
                    disabled={loading}
                    className="px-3 py-1.5 rounded-xl bg-[#000000] border border-white/10 hover:border-[#6366F1]/50 hover:bg-[#6366F1]/10 text-white/80 hover:text-white font-satoshi text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    {sample}
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
          </>
        ) : (
          /* Sidekick Chat Session Panel */
          <div className="space-y-4 flex flex-col h-full min-h-[320px]">
            <div className="p-3 rounded-2xl bg-[#000000] border border-[#6366F1]/20 flex items-center gap-2">
              <Bot size={16} className="text-[#6366F1]" />
              <span className="text-xs font-satoshi font-bold text-white">
                Interactive Sidekick Session for {kind}
              </span>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] pr-1 scrollbar-thin">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 text-xs font-satoshi ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role !== 'user' && (
                    <div className="w-6 h-6 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/30 flex items-center justify-center text-[#6366F1] shrink-0 mt-0.5">
                      <Bot size={12} />
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#6366F1] text-white font-semibold'
                        : 'bg-[#000000] border border-white/10 text-white/90'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-white/70 shrink-0 mt-0.5">
                      <UserIcon size={12} />
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-[#6366F1] font-mono p-2">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Sidekick is thinking...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat Input Row */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSendChat()}
                placeholder="Iterate on questions or request changes..."
                className="flex-1 bg-[#000000] border border-white/10 focus:border-[#6366F1] rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-satoshi"
              />
              <button
                type="button"
                onClick={() => void handleSendChat()}
                disabled={chatLoading || !chatInput.trim()}
                className="p-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white transition-all disabled:opacity-40 cursor-pointer"
              >
                <Send size={14} />
              </button>
            </div>
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
