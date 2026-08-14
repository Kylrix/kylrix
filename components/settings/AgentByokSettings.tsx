'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Trash2, Check, ShieldCheck, Sparkles } from 'lucide-react';
import {
  listAgentByokKeysAction,
  saveAgentByokKeyAction,
  deleteAgentByokKeyAction,
  type AgentByokKeySummary
} from '@/lib/actions/secure-ops';
import toast from 'react-hot-toast';

const SUPPORTED_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-proj-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-api03-...' },
  { id: 'google', name: 'Google Gemini', placeholder: 'AIzaSy...' },
  { id: 'groq', name: 'Groq', placeholder: 'gsk_...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-v1-...' },
  { id: 'deepseek', name: 'DeepSeek', placeholder: 'sk-...' }
];

export function AgentByokSettings() {
  const [keys, setKeys] = useState<AgentByokKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('google');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    try {
      const list = await listAgentByokKeysAction();
      setKeys(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) return;
    setSaving(true);
    try {
      await saveAgentByokKeyAction({
        provider: selectedProvider,
        apiKey: cleanKey
      });
      setApiKeyInput('');
      setShowAdd(false);
      await loadKeys();
      toast.success(`${selectedProvider.toUpperCase()} BYOK key saved and sealed`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save BYOK key');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, provider: string) => {
    if (!confirm(`Delete your BYOK key for ${provider.toUpperCase()}?`)) return;
    setDeletingId(id);
    try {
      await deleteAgentByokKeyAction({ keyId: id });
      await loadKeys();
      toast.success('BYOK key removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete BYOK key');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
              Autonomous Agent BYOK Keys
            </h3>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[9px] font-bold font-mono text-[#F59E0B]">
              <Sparkles size={10} /> Server Sealed (KYLRIX_MEK)
            </span>
          </div>
          <p className="text-[10px] text-white/35 font-bold mt-1">
            Provide your own API keys for unmanned background agents without requiring your vault to remain unlocked.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(prev => !prev)}
          className="py-1.5 px-3 rounded-lg bg-[#6366F1] hover:bg-[#4F46E5] text-white text-[11px] font-extrabold border-none cursor-pointer transition-colors inline-flex items-center gap-1"
        >
          {showAdd ? 'Cancel' : <><Plus size={13} /> Add BYOK Key</>}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleSave} className="space-y-3 rounded-xl bg-[#0A0908] border border-[#6366F1]/30 p-3.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white">Select AI Provider</span>
            <span className="text-[10px] font-mono text-white/40">Sealed with KYLRIX_MEK</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {SUPPORTED_PROVIDERS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProvider(p.id)}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold font-mono border transition-all text-center truncate ${
                  selectedProvider === p.id
                    ? 'bg-[#6366F1] text-white border-[#6366F1]'
                    : 'bg-[#161412] text-white/60 border-white/[0.06] hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <input
            type="password"
            value={apiKeyInput}
            onChange={e => setApiKeyInput(e.target.value)}
            placeholder={SUPPORTED_PROVIDERS.find(p => p.id === selectedProvider)?.placeholder || 'Enter API Key'}
            className="w-full h-9 rounded-lg bg-[#161412] border border-white/[0.06] px-3 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1]/50"
          />

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white/40 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !apiKeyInput.trim()}
              className="h-8 px-4 rounded-lg bg-[#6366F1] text-white text-xs font-black disabled:opacity-40 hover:bg-[#4F46E5] transition-colors"
            >
              {saving ? 'Encrypting & Saving…' : 'Save Key'}
            </button>
          </div>
        </form>
      )}

      {/* Keys List */}
      <div className="space-y-2">
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex items-center justify-between gap-3 rounded-[16px] bg-[#0A0908] border border-white/[0.04] px-3.5 py-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-[#6366F1] shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white uppercase font-mono m-0">
                  {k.provider}
                </p>
                <p className="text-[11px] text-white/40 font-mono m-0 mt-0.5">
                  Key: <span className="text-white/70">{k.keyHint}</span> • Added {new Date(k.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <Check size={10} /> Ready
              </span>
              <button
                type="button"
                disabled={deletingId === k.id}
                onClick={() => handleDelete(k.id, k.provider)}
                className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Remove BYOK key"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {!loading && keys.length === 0 && !showAdd && (
          <div className="rounded-xl bg-[#0A0908] border border-white/[0.04] p-4 text-center">
            <p className="text-xs text-white/35 font-satoshi m-0">
              No BYOK keys configured. Agents will default to standard workspace and token balance execution.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
