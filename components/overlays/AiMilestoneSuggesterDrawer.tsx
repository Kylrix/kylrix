'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAI } from '@/context/AIContext';
import { useTask } from '@/context/TaskContext';
import { useToast } from '@/context/ToastContext';
import { Sparkles, Check, ChevronRight, CornerDownRight, X, Send } from '@/lib/openbricks/icons';

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
    <div className="flex flex-col h-full bg-[#161412] text-[#F5F2ED] font-satoshi relative">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#161412]/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#A855F7]" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider font-mono text-[#A855F7]">Kylie Autocomplete</h3>
            <p className="text-[10px] text-[#9B9691] font-mono mt-0.5 truncate max-w-[300px]">Goal: {taskTitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="p-1.5 rounded-lg text-[#9B9691] hover:text-white hover:bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Suggested Milestones Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[300px]">
        {loading && suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-6 h-6 border-2 border-[#A855F7] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#9B9691] font-mono">Steering Kylie...</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {suggestions.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 ${
                  item.selected
                    ? 'bg-[#A855F7]/5 border-[#A855F7]/20 shadow-[0_0_12px_rgba(168,85,247,0.05)]'
                    : 'bg-[#0A0908]/40 border-white/5 opacity-60'
                }`}
              >
                {/* Custom Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggleSelect(idx)}
                  className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                    item.selected
                      ? 'bg-[#A855F7] border-[#A855F7] text-[#0A0908]'
                      : 'border-white/20 bg-transparent hover:border-white/40'
                  }`}
                >
                  {item.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>

                {/* Editable Title Input */}
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleEditTitle(idx, e.target.value)}
                  className="flex-1 bg-transparent border-0 outline-none text-sm text-[#F5F2ED] focus:ring-0 focus:outline-none py-0.5 font-bold"
                  placeholder="Milestone title..."
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Steering Input Form */}
      <div className="p-5 border-t border-white/5 bg-[#0A0908]/40 space-y-4">
        <form onSubmit={handleSteerSubmit} className="flex gap-2">
          <input
            type="text"
            value={steerInput}
            onChange={(e) => setSteerInput(e.target.value)}
            placeholder="Not satisfied? Tell Kylie how to restructure instead..."
            disabled={loading}
            className="flex-1 bg-white/[0.02] border border-white/5 rounded-xl px-4 py-2.5 text-xs text-[#F5F2ED] outline-none focus:border-[#A855F7]/30 focus:bg-[#0A0908]/80 transition-all font-satoshi"
          />
          <button
            type="submit"
            disabled={loading || !steerInput.trim()}
            className="p-2.5 bg-[#A855F7] text-[#0A0908] rounded-xl hover:bg-[#9333EA] transition-colors disabled:opacity-30 flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={handleApply}
          disabled={loading || suggestions.filter((s) => s.selected).length === 0}
          className="w-full py-3 bg-[#A855F7] text-[#0A0908] font-black text-xs uppercase tracking-widest rounded-2xl shadow-[0_8px_20px_-8px_rgba(168,85,247,0.4)] hover:bg-[#9333EA] transition-colors disabled:opacity-30"
        >
          {loading ? 'Importing...' : 'Add Selected Milestones'}
        </button>
      </div>
    </div>
  );
}
