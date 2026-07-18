'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAI } from '../../hooks/useAI';
import { useTask } from '@/context/TaskContext';
import { useToast } from '@/components/ui/Toast';
import { Sparkles, Check, X, Send } from 'lucide-react';

interface SuggestedMilestone {
  title: string;
  selected: boolean;
}

export function AiMilestoneSuggesterDrawer() {
  const { drawerData, close } = useUnifiedDrawer();
  const { generate } = useAI();
  const { addSubtask } = useTask();
  const { showSuccess, showError } = useToast();

  const taskId = drawerData?.taskId;
  const taskTitle = drawerData?.taskTitle;
  const existingMilestones = drawerData?.existingMilestones || [];

  const [steerInput, setSteerInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedMilestone[]>([]);

  const fetchSuggestions = useCallback(async (customSteering = '') => {
    if (!taskTitle) return;
    setLoading(true);
    try {
      const steeringPrompt = customSteering 
        ? `Adjust requirements: "${customSteering}".`
        : '';
      const existingPrompt = existingMilestones.length > 0
        ? `Existing milestones already present: [${existingMilestones.join(', ')}]. Build on top or augment these.`
        : '';

      const prompt = `You are a Project Manager. The goal is: "${taskTitle}". ${existingPrompt}
Generate a JSON array of 5 concrete, actionable, sequential milestone titles. 
${steeringPrompt}
Return ONLY the JSON array of strings. Example: ["Setup database schema", "Build API endpoints"].`;

      const result = await generate(prompt);
      const text = typeof result === 'string' ? result : (result as any).text;
      const jsonString = text.replace(/```json\n|\n```/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonString);

      if (Array.isArray(parsed)) {
        setSuggestions(
          parsed.map((title: string) => ({
            title: String(title).trim(),
            selected: true,
          }))
        );
      } else {
        throw new Error('AI output was not a valid array');
      }
    } catch (err: any) {
      console.error(err);
      showError('Milestone Generation Failed', err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [taskTitle, existingMilestones, generate, showError]);

  useEffect(() => {
    void fetchSuggestions();
  }, [fetchSuggestions]);

  const handleToggleSelect = (index: number) => {
    setSuggestions((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleEditTitle = (index: number, newTitle: string) => {
    setSuggestions((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, title: newTitle } : item
      )
    );
  };

  const handleSteerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!steerInput.trim() || loading) return;
    void fetchSuggestions(steerInput);
    setSteerInput('');
  };

  const handleApply = async () => {
    const selected = suggestions.filter((s) => s.selected && s.title.trim());
    if (selected.length === 0) {
      showError('No Selection', 'Please select at least one milestone to import.');
      return;
    }
    setLoading(true);
    try {
      await Promise.all(selected.map((s) => addSubtask(taskId, s.title)));
      showSuccess('Milestones Added', `Successfully imported ${selected.length} milestones.`);
      close();
    } catch (err: any) {
      showError('Failed to import milestones', err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#161412] text-[#F5F2ED] font-satoshi relative overflow-hidden">
      {/* Top spotlight ambient gradient */}
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_50%_-20%,rgba(168,85,247,0.15),transparent_70%)] pointer-events-none z-0" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5 bg-[#161412]/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#A855F7]/10 border border-[#A855F7]/20 flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.1)]">
            <Sparkles className="w-5 h-5 text-[#A855F7] animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest font-mono text-[#A855F7]">Kylie Autocomplete</h3>
            <p className="text-[10px] text-[#9B9691] font-mono mt-0.5 max-w-[280px] truncate">
              GOAL: {taskTitle}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="p-2 rounded-xl text-[#9B9691] hover:text-white hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Suggested Milestones Area */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4 max-h-[340px] scrollbar-thin">
        {loading && suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative">
              <div className="w-8 h-8 border-2 border-[#A855F7]/20 border-t-[#A855F7] rounded-full animate-spin" />
              <div className="absolute inset-0 bg-[#A855F7]/10 blur-md rounded-full animate-pulse" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-black uppercase tracking-widest text-[#A855F7] font-mono">Generating</span>
              <span className="text-[10px] text-[#9B9691] font-mono">Kylie is mapping milestones...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 hover:translate-y-[-1px] ${
                  item.selected
                    ? 'bg-[#0B0A09] border-[#A855F7]/30 shadow-[0_4px_16px_rgba(168,85,247,0.06)]'
                    : 'bg-[#0B0A09]/40 border-white/5 opacity-50 hover:opacity-80'
                }`}
              >
                {/* Custom Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggleSelect(idx)}
                  className={`w-5.5 h-5.5 rounded-lg border flex items-center justify-center transition-all ${
                    item.selected
                      ? 'bg-[#A855F7] border-[#A855F7] text-[#0A0908] shadow-[0_0_12px_rgba(168,85,247,0.4)] scale-[1.05]'
                      : 'border-white/10 bg-transparent hover:border-[#A855F7]/30'
                  }`}
                >
                  {item.selected && <Check className="w-4 h-4 stroke-[3]" />}
                </button>

                {/* Editable Title Input */}
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleEditTitle(idx, e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-[#F5F2ED] focus:ring-0 focus:outline-none py-0.5 font-bold tracking-tight"
                  placeholder="Milestone title..."
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Steering Input Form & Footer Actions */}
      <div className="relative z-10 p-6 border-t border-white/5 bg-[#0B0A09] space-y-4">
        <form onSubmit={handleSteerSubmit} className="flex gap-2">
          <input
            type="text"
            value={steerInput}
            onChange={(e) => setSteerInput(e.target.value)}
            placeholder="Not satisfied? Tell Kylie how to restructure..."
            disabled={loading}
            className="flex-1 bg-[#161412] border border-white/5 rounded-xl px-4 py-3 text-xs text-[#F5F2ED] outline-none focus:border-[#A855F7]/25 focus:bg-[#161412]/80 transition-all font-satoshi placeholder-[#9B9691]/50"
          />
          <button
            type="submit"
            disabled={loading || !steerInput.trim()}
            className="p-3 bg-[#A855F7] text-[#0A0908] rounded-xl hover:bg-[#9333EA] transition-all duration-200 disabled:opacity-30 flex items-center justify-center shrink-0 shadow-[0_4px_12px_-4px_rgba(168,85,247,0.4)] active:scale-[0.98]"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={handleApply}
          disabled={loading || suggestions.filter((s) => s.selected).length === 0}
          className="w-full py-3.5 bg-[#A855F7] text-[#0A0908] font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_8px_24px_-8px_rgba(168,85,247,0.5)] hover:bg-[#9333EA] hover:translate-y-[-1px] transition-all duration-200 disabled:opacity-20 active:translate-y-[0px]"
        >
          {loading ? 'Importing Milestones...' : 'Add Selected Milestones'}
        </button>
      </div>
    </div>
  );
}
