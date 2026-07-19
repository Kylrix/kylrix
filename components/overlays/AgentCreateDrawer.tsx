'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, Plus, X } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/context/auth/AuthContext';
import { AgenticService } from '@/lib/services/agentic';
import { toast } from 'react-hot-toast';

type AgentRow = {
  $id: string;
  config?: string;
};

function agentName(agent: AgentRow): string {
  try {
    const parsed = JSON.parse(agent.config || '{}');
    return String(parsed?.name || 'Unnamed Agent');
  } catch {
    return 'Unnamed Agent';
  }
}

export function AgentCreateDrawer() {
  const { activeContent, drawerData, close } = useUnifiedDrawer();
  const { user } = useAuth();
  const isOpen = activeContent === 'agent-create';

  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');

  const onSelect = drawerData?.onSelect as ((payload: { agentId: string; name: string }) => void) | undefined;
  const suggestedGoal = useMemo(() => String(drawerData?.goal || ''), [drawerData?.goal]);

  useEffect(() => {
    if (!isOpen || !user?.$id) return;
    setGoal(suggestedGoal);
    setName('');
    setLoading(true);
    AgenticService.listMyAgents(user.$id, true)
      .then((rows: any) => setAgents(Array.isArray(rows) ? rows : []))
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, [isOpen, user?.$id, suggestedGoal]);

  if (!isOpen) return null;

  const handlePick = (agent: AgentRow) => {
    onSelect?.({ agentId: agent.$id, name: agentName(agent) });
    close();
  };

  const handleCreate = async () => {
    if (!user?.$id) return;
    const finalName = name.trim() || 'New Agent';
    setCreating(true);
    try {
      const created: any = await AgenticService.createMyAgent({
        userId: user.$id,
        name: finalName,
        goal: goal.trim() || undefined,
      });
      onSelect?.({ agentId: created?.$id || '', name: finalName });
      close();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="fixed z-[1301] bottom-0 left-0 right-0 h-[60dvh] max-h-[60dvh] bg-[#161412] border-t border-[#34322F] rounded-t-[28px] max-w-[640px] mx-auto flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#6366F1]">Agent Routing</p>
            <h3 className="text-white font-extrabold text-base">Select or create an agent</h3>
          </div>
          <button onClick={close} className="w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/5 grid place-items-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 border-b border-white/5 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New agent name"
            className="w-full bg-[#0A0908] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1]/40"
          />
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Optional: what this agent should focus on"
            rows={2}
            className="w-full bg-[#0A0908] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1]/40 resize-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full h-10 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white text-xs font-black transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Plus size={14} />
            {creating ? 'Creating…' : 'Create Agent'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <p className="text-xs text-white/50">Loading agents…</p>
          ) : agents.length === 0 ? (
            <p className="text-xs text-white/40">No existing agents yet.</p>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.$id}
                onClick={() => handlePick(agent)}
                className="w-full text-left p-3.5 rounded-2xl bg-white/[0.02] border border-white/8 hover:border-[#6366F1]/35 hover:bg-[#6366F1]/10 transition flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-[#6366F1]/15 border border-[#6366F1]/30 grid place-items-center text-[#818CF8]">
                  <Bot size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-black truncate">{agentName(agent)}</p>
                  <p className="text-[10px] text-white/35 font-mono truncate">{agent.$id}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

