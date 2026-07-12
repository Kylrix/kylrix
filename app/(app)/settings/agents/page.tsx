'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  Check,
  ChevronRight,
  Cpu,
  Key,
  Lock,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { useSudo } from '@/context/SudoContext';
import { toast } from 'react-hot-toast';
import { BYOKManager } from '@/lib/ai/byok';
import { account } from '@/lib/appwrite/client';

const FRAMEWORKS = [
  {
    id: 'kylrix',
    title: 'Kylrix Internal',
    description: 'Native stack for tasks, notes, and calendar automations.',
    status: 'Active' as const,
  },
  {
    id: 'openclaw',
    title: 'OpenClaw Platform',
    description: 'External tool bridges and third-party agent hooks.',
    status: 'Coming Soon' as const,
  },
  {
    id: 'hermes',
    title: 'Hermes Orchestrator',
    description: 'Fast dialogue routing and lightweight response flows.',
    status: 'Coming Soon' as const,
  },
];

export default function AssistantSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { promptSudo } = useSudo();

  const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
  const [byokKeyInput, setByokKeyInput] = useState('');
  const [hasByok, setHasByok] = useState(false);
  const [byokLoading, setByokLoading] = useState(true);
  const [byokSaving, setByokSaving] = useState(false);
  const [showByokInput, setShowByokInput] = useState(false);
  const [selectedFramework, setSelectedFramework] = useState('kylrix');

  const handleUnlockVault = async () => {
    const success = await promptSudo('unlock');
    if (success) toast.success('Vault unlocked.');
  };

  const handleSaveByok = async () => {
    if (!user?.$id || !byokKeyInput.trim()) {
      toast.error('Enter a valid API key.');
      return;
    }
    setByokSaving(true);
    try {
      await BYOKManager.saveKey(user.$id, 'gemini', byokKeyInput.trim());
      toast.success('Private key saved.');
      setHasByok(true);
      setByokKeyInput('');
      setShowByokInput(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not save key.');
    } finally {
      setByokSaving(false);
    }
  };

  const handleDeleteByok = async () => {
    if (!user?.$id) return;
    if (!window.confirm('Remove your private AI key? Assistants will use default keys.')) return;
    setByokSaving(true);
    try {
      await BYOKManager.deleteKey(user.$id, 'gemini');
      toast.success('Private key removed.');
      setHasByok(false);
      setByokKeyInput('');
      setShowByokInput(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not remove key.');
    } finally {
      setByokSaving(false);
    }
  };

  useEffect(() => {
    const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
      setIsUnlocked(status.isUnlocked);
    });

    if (user?.$id && isUnlocked) {
      setByokLoading(true);
      BYOKManager.hasKey(user.$id, 'gemini')
        .then((present) => {
          setHasByok(present);
          setByokLoading(false);
        })
        .catch(() => setByokLoading(false));
    } else {
      setByokLoading(false);
    }

    return unsubscribe;
  }, [isUnlocked, user?.$id]);

  return (
    <div className="min-h-screen bg-[#0A0908] text-white font-satoshi">
      <div className="max-w-[840px] mx-auto px-4 md:px-6 pt-4 md:pt-6 pb-16">
        <button
          type="button"
          onClick={() => router.push('/settings')}
          className="inline-flex items-center gap-2 mb-6 px-3.5 py-2 rounded-xl border border-white/10 text-white/75 text-sm font-bold hover:bg-white/[0.04] hover:text-white transition"
        >
          <ArrowLeft size={16} />
          Back to settings
        </button>

        <header className="mb-8 flex flex-col gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9B9691] font-clash">
            Smart system
          </span>
          <h1 className="text-white text-2xl md:text-[28px] font-extrabold font-clash tracking-tight leading-tight">
            Assistant settings
          </h1>
          <p className="text-[#9B9691] text-sm font-semibold leading-relaxed max-w-[560px]">
            Configure assistants, private keys, and the runtime that routes background work.
          </p>
        </header>

        <div className="flex flex-col gap-5">
          {/* Workspace gateway */}
          <button
            type="button"
            onClick={() => router.push('/agents')}
            className="w-full text-left rounded-[28px] border border-white/5 bg-[#161412] p-5 md:p-6 hover:bg-[#1C1A18] hover:border-[#6366F1]/30 transition group"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-[42px] h-[42px] rounded-[14px] bg-[#6366F1]/12 border border-[#6366F1]/25 text-[#6366F1] flex items-center justify-center flex-shrink-0">
                <Bot size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-1 pr-2">
                <span className="text-white text-[15px] font-extrabold font-clash leading-tight">
                  Open assistants workspace
                </span>
                <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">
                  Launch, review, and coordinate active smart assistants.
                </span>
              </div>
              <ArrowUpRight size={18} className="text-white/25 group-hover:text-white/60 flex-shrink-0" />
            </div>
          </button>

          {/* Vault & keys */}
          <section className="rounded-[28px] border border-white/5 bg-[#161412] overflow-hidden">
            <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#6366F1] flex items-center justify-center flex-shrink-0">
                  <Shield size={18} />
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <h2 className="text-white text-base font-extrabold font-clash leading-tight">
                    Vault and credentials
                  </h2>
                  <p className="text-[#9B9691] text-xs font-semibold leading-relaxed">
                    Private keys are encrypted locally before they are saved.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 md:px-6 py-5 md:py-6 flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-[20px] bg-[#0B0A09] border border-white/5">
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <span className="text-white text-sm font-extrabold leading-tight">Vault access</span>
                  <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">
                    {isUnlocked ? 'Unlocked — keys can be viewed or rotated' : 'Locked — unlock to manage keys'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={isUnlocked ? undefined : () => void handleUnlockVault()}
                  disabled={isUnlocked}
                  className={`h-10 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 flex-shrink-0 transition ${
                    isUnlocked
                      ? 'border border-white/10 text-white/60 bg-white/[0.02]'
                      : 'bg-[#6366F1] hover:bg-[#5458E8] text-white'
                  }`}
                >
                  {isUnlocked ? <Lock size={14} /> : <Shield size={14} />}
                  {isUnlocked ? 'Unlocked' : 'Unlock vault'}
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Key size={16} className="text-[#6366F1] flex-shrink-0" />
                    <span className="text-white text-sm font-extrabold font-clash leading-tight">
                      Private AI key
                    </span>
                  </div>
                  <p className="text-[#9B9691] text-xs font-semibold leading-relaxed pl-6">
                    Optional Gemini key for assistants. Stored encrypted in your vault.
                  </p>
                </div>

                {byokLoading ? (
                  <div className="py-6 flex justify-center">
                    <RefreshCw size={18} className="animate-spin text-[#6366F1]" />
                  </div>
                ) : !isUnlocked ? (
                  <div className="p-4 rounded-[18px] bg-[#0B0A09] border border-white/5">
                    <p className="text-[#9B9691] text-xs font-semibold leading-relaxed text-center">
                      Unlock your vault to configure or rotate private keys.
                    </p>
                  </div>
                ) : hasByok && !showByokInput ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-[18px] bg-[#0B0A09] border border-white/5">
                    <span className="text-[#10B981] text-xs font-bold font-mono leading-relaxed flex-1 min-w-0 break-all">
                      Encrypted key on file
                    </span>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowByokInput(true)}
                        className="h-9 px-3 rounded-lg text-[#6366F1] text-xs font-extrabold hover:bg-[#6366F1]/10 transition"
                      >
                        Rotate
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteByok()}
                        disabled={byokSaving}
                        className="h-9 px-3 rounded-lg text-red-400 text-xs font-extrabold hover:bg-red-500/10 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <input
                      type="password"
                      value={byokKeyInput}
                      onChange={(e) => setByokKeyInput(e.target.value)}
                      placeholder="Paste Gemini API key"
                      className="w-full h-11 px-4 rounded-xl bg-[#0B0A09] border border-white/8 text-white text-sm font-mono placeholder:text-[#9B9691]/45 focus:outline-none focus:border-[#6366F1]/40"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveByok()}
                        disabled={byokSaving || !byokKeyInput.trim()}
                        className="h-10 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white text-xs font-extrabold disabled:opacity-40 transition"
                      >
                        {byokSaving ? 'Saving…' : 'Save key'}
                      </button>
                      {hasByok && (
                        <button
                          type="button"
                          onClick={() => setShowByokInput(false)}
                          className="h-10 px-4 rounded-xl text-[#9B9691] text-xs font-extrabold hover:text-white transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Framework selection */}
          <section className="rounded-[28px] border border-white/5 bg-[#161412] overflow-hidden">
            <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#6366F1] flex items-center justify-center flex-shrink-0">
                  <Cpu size={18} />
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <h2 className="text-white text-base font-extrabold font-clash leading-tight">
                    Assistant runtime
                  </h2>
                  <p className="text-[#9B9691] text-xs font-semibold leading-relaxed">
                    Choose the stack that routes background automated work.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 md:px-6 py-5 md:py-6 flex flex-col gap-3">
              {FRAMEWORKS.map((fw) => {
                const selected = selectedFramework === fw.id;
                const disabled = fw.status !== 'Active';

                return (
                  <button
                    key={fw.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedFramework(fw.id)}
                    className={`w-full text-left flex items-center gap-4 p-4 rounded-[20px] border transition ${
                      selected
                        ? 'bg-[#6366F1]/8 border-[#6366F1]/35'
                        : 'bg-[#0B0A09] border-white/5 hover:border-white/10'
                    } ${disabled ? 'opacity-55 cursor-not-allowed' : ''}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        selected ? 'border-[#6366F1] bg-[#6366F1]' : 'border-white/20'
                      }`}
                    >
                      {selected && <Check size={12} className="text-black" strokeWidth={3} />}
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col gap-1 pr-2">
                      <span className="text-white text-sm font-extrabold font-clash leading-tight">
                        {fw.title}
                      </span>
                      <span className="text-[#9B9691] text-xs font-semibold leading-relaxed">
                        {fw.description}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md flex-shrink-0 ${
                        fw.status === 'Active'
                          ? 'bg-[#10B981]/12 text-[#10B981] border border-[#10B981]/25'
                          : 'bg-white/[0.03] text-[#9B9691] border border-white/5'
                      }`}
                    >
                      {fw.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Agent Permissions Allowlist Settings */}
          <AgentPermissionsAllowlist />
        </div>
      </div>
    </div>
  );
}

function AgentPermissionsAllowlist() {
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWhitelist = async () => {
      try {
        const current = await account.getPrefs();
        setWhitelist(Array.isArray(current?.authorizedTools) ? current.authorizedTools : []);
      } catch (err) {
        console.error('Failed to load whitelisted preferences:', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchWhitelist();
  }, []);

  const handleToggleAllowAll = async () => {
    try {
      const current = await account.getPrefs();
      let nextList = [...whitelist];
      if (nextList.includes('allow_all')) {
        nextList = nextList.filter(item => item !== 'allow_all');
      } else {
        nextList.push('allow_all');
      }
      await account.updatePrefs({ ...current, authorizedTools: nextList });
      setWhitelist(nextList);
      toast.success(nextList.includes('allow_all') ? 'Full Agent access sweeping enabled.' : 'Custom permissions mode active.');
    } catch {
      toast.error('Failed to update settings preferences.');
    }
  };

  const handleToggleTool = async (toolKey: string) => {
    try {
      const current = await account.getPrefs();
      let nextList = [...whitelist];
      if (nextList.includes(toolKey)) {
        nextList = nextList.filter(item => item !== toolKey);
      } else {
        nextList.push(toolKey);
      }
      await account.updatePrefs({ ...current, authorizedTools: nextList });
      setWhitelist(nextList);
      toast.success('Agent permission updated.');
    } catch {
      toast.error('Failed to update settings preferences.');
    }
  };

  if (loading) {
    return (
      <div className="py-6 flex justify-center border border-white/5 rounded-[28px] bg-[#161412]">
        <RefreshCw size={18} className="animate-spin text-[#6366F1]" />
      </div>
    );
  }

  const isAllowAll = whitelist.includes('allow_all');

  return (
    <section className="rounded-[28px] border border-white/5 bg-[#161412] overflow-hidden">
      <div className="px-5 md:px-6 pt-5 md:pt-6 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
            <Shield size={18} />
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <h2 className="text-white text-base font-extrabold font-clash leading-tight">
              Agent action permissions
            </h2>
            <p className="text-[#9B9691] text-xs font-semibold leading-relaxed">
              Define which tools assistants are whitelisted to execute automatically.
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-6 py-5 md:py-6 flex flex-col gap-4 text-left">
        <div className="flex items-center justify-between p-4 rounded-[20px] bg-[#0B0A09] border border-white/5 hover:border-white/10 transition">
          <div className="flex-1 min-w-0 pr-4">
            <span className="text-white text-sm font-extrabold leading-tight block">Sweep Allow All</span>
            <span className="text-[#9B9691] text-xs leading-relaxed block mt-0.5">
              Allow agents to execute all ecosystem actions automatically without prompt authorizations.
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleAllowAll}
            className={`h-9 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
              isAllowAll
                ? 'bg-amber-500 hover:bg-amber-600 text-black'
                : 'border border-white/10 text-white hover:bg-white/[0.04]'
            }`}
          >
            {isAllowAll ? 'Enabled (Sweeping)' : 'Enable Sweep'}
          </button>
        </div>

        {!isAllowAll && (
          <div className="space-y-3">
            <div className="text-xs font-black uppercase text-[#9B9691]/60 px-1">
              Custom Whitelists
            </div>
            {[
              { key: 'create_note', name: 'Create Notes', desc: 'Allows agents to write new ideas context notes.' },
              { key: 'update_note', name: 'Update Notes', desc: 'Allows agents to edit titles/content of notes.' },
              { key: 'create_goal', name: 'Create Goals', desc: 'Allows agents to schedule tasks/due dates.' },
              { key: 'update_goal', name: 'Update Goals', desc: 'Allows agents to modify task parameters.' },
              { key: 'create_project', name: 'Create Projects', desc: 'Allows agents to create旗舰 projects workspaces.' },
              { key: 'toggle_privacy', name: 'Toggle Visibility', desc: 'Allows visibility settings sweeps (requires secure confirmations).' }
            ].map(t => {
              const allowed = whitelist.includes(t.key);
              return (
                <div key={t.key} className="flex items-center justify-between p-4 rounded-[18px] bg-[#0B0A09] border border-white/5 hover:border-white/10 transition">
                  <div className="flex-1 min-w-0 pr-4">
                    <span className="text-white text-xs font-extrabold leading-tight block">{t.name}</span>
                    <span className="text-[#9B9691] text-[10px] leading-relaxed block mt-0.5">{t.desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleTool(t.key)}
                    className={`h-8 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center transition ${
                      allowed
                        ? 'bg-white text-black hover:bg-zinc-200'
                        : 'border border-white/10 text-white/60 hover:bg-white/[0.03]'
                    }`}
                  >
                    {allowed ? 'Allowed' : 'Authorize'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
