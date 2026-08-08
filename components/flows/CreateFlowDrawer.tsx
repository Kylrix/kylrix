'use client';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GripVertical, Plus, Trash2, Sparkles, X, Wand2, AlertCircle, Check, Layers, Copy } from 'lucide-react';
import type { WorkflowChain, WorkflowStep } from '@/lib/workflow-engine';
import { KNOWN_ACTION_IDS, parseFlowJson, buildFlowJsonTemplate, suggestActionIds, autocorrectActionId, heuristicGenerateFlow, validateFlowStructure } from '@/lib/flows/syntax-engine';
import toast from 'react-hot-toast';
import { saveWorkflowAction } from '@/lib/actions/workflows';

const NICHES = ['workspace','productivity','security','connect','intelligence','billing','system'] as const;

type Props = {
  onClose: () => void;
  onCreated: (wf: WorkflowChain) => void;
};

export function CreateFlowDrawer({ onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [niche, setNiche] = useState<typeof NICHES[number]>('workspace');
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [jsonText, setJsonText] = useState(() => buildFlowJsonTemplate('Untitled'));
  const [jsonTouched, setJsonTouched] = useState(false);
  const [agenticPrompt, setAgenticPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [toolFilter, setToolFilter] = useState('');

  // keep json in sync when metadata/steps change (unless user edited json)
  useEffect(() => {
    if (jsonTouched) return;
    const t = title.trim() || 'Untitled';
    setJsonText(buildFlowJsonTemplate(t, { niche, description, steps }));
  }, [title, niche, description, steps, jsonTouched]);

  // when json edited, try to parse and sync steps/title live
  const parsed = useMemo(() => parseFlowJson(jsonText), [jsonText]);
  const diagnostics = useMemo(() => parsed.ok ? parsed.diagnostics : parsed.diagnostics, [parsed]);
  const hasError = useMemo(() => diagnostics.some(d=>d.severity==='error'), [diagnostics]);
  const errorMsg = useMemo(() => diagnostics.find(d=>d.severity==='error')?.message, [diagnostics]);

  const suggestions = useMemo(() => suggestActionIds(toolFilter, 12), [toolFilter]);

  const handleJsonChange = (v: string) => {
    setJsonText(v);
    setJsonTouched(true);
    // live preview: if valid JSON, sync preview
    try {
      const obj = JSON.parse(v);
      if (obj.name !== undefined) setTitle(obj.name);
      if (obj.description !== undefined) setDescription(obj.description);
      if (obj.niche && NICHES.includes(obj.niche)) setNiche(obj.niche);
      if (Array.isArray(obj.steps)) {
        // autocorrect inline
        const fixed = obj.steps.map((s:any)=> {
          if (s?.actionId && !KNOWN_ACTION_IDS.includes(s.actionId)) {
            const ac = autocorrectActionId(s.actionId);
            if (ac) return { ...s, actionId: ac };
          }
          return s;
        });
        // only sync if structurally valid
        const diags = validateFlowStructure({ ...obj, steps: fixed });
        if (!diags.some(d=>d.severity==='error' && d.path.includes('actionId'))) {
          setSteps(fixed.map((s:any)=>({ actionId: String(s.actionId), timestamp: s.timestamp || new Date().toISOString(), importance: s.importance==='low'?'low':'high' })));
        }
      }
    } catch {}
  };

  const addStep = (actionId: string) => {
    setSteps(s => [...s, { actionId, timestamp: new Date().toISOString(), importance:'high' }]);
    setJsonTouched(false);
  };
  const removeStep = (idx: number) => {
    setSteps(s => s.filter((_,i)=>i!==idx));
    setJsonTouched(false);
  };
  const moveStep = (from: number, to: number) => {
    setSteps(s => {
      const a=[...s]; const [it]=a.splice(from,1); a.splice(to,0,it); return a;
    });
    setJsonTouched(false);
  };

  const handleGenerate = () => {
    const p = agenticPrompt.trim();
    if (!p) { toast.error('Describe what the flow should do'); return; }
    const wf = heuristicGenerateFlow(p, title.trim() || p.slice(0, 40));
    setSteps(wf.steps);
    setDescription(wf.description);
    setJsonTouched(false);
    toast.success(`Generated ${wf.steps.length} steps`);
  };

  const canCreate = title.trim().length >= 2 && !hasError && steps.length > 0;

  const handleCreate = async () => {
    if (!canCreate) { toast.error(!title.trim() ? 'Title required' : hasError ? errorMsg || 'Fix JSON errors' : 'Add at least one tool'); return; }
    setBusy(true);
    try {
      // prefer jsonText as source of truth if user edited
      let payload: WorkflowChain;
      if (jsonTouched && parsed.ok && !hasError) {
        const obj = parsed.parsed;
        payload = {
          id: String(obj.id || title.toLowerCase().replace(/[^a-z0-9]+/g,'-')).slice(0,40) || `flow-${Date.now()}`,
          name: String(obj.name || title),
          description: String(obj.description || description),
          niche: (obj.niche || niche) as any,
          steps: (Array.isArray(obj.steps) ? obj.steps : steps).map((s:any)=>({ actionId:String(s.actionId), timestamp:s.timestamp || new Date().toISOString(), importance: s.importance==='low'?'low':'high' })),
          isPublic: false,
          isAnonymized: true,
          createdAt: new Date().toISOString(),
        };
      } else {
        payload = {
          id: (title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40) || `flow-${Date.now()}`),
          name: title.trim(),
          description: description.trim(),
          niche: niche as any,
          steps,
          isPublic: false,
          isAnonymized: true,
          createdAt: new Date().toISOString(),
        };
      }
      const res = await saveWorkflowAction(payload);
      if (!res.success) throw new Error(res.error || 'Save failed');
      toast.success('Flow created');
      onCreated(payload);
      onClose();
    } catch (e:any) { toast.error(e?.message || 'Failed to create flow'); } finally { setBusy(false); }
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col bg-[#161412] text-white font-satoshi">
      <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/[0.06] shrink-0">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1.5"><Layers size={12}/> Create Flow</p>
          <h2 className="font-clash text-lg font-semibold truncate">{title.trim() || 'Untitled'}</h2>
          <p className="text-[11px] text-white/40">Manual tools + JSON + agentic prompt. Create is disabled until title is set.</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-white/45 hover:text-white cursor-pointer shrink-0"><X size={16}/></button>
      </header>

      <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
        {/* Title / niche */}
        <div className="grid grid-cols-1 gap-3">
          <label className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/50">Title *</span>
            <input value={title} onChange={e=>{setTitle(e.target.value); setJsonTouched(false);}} placeholder="e.g. Research → Goal" className="w-full rounded-xl bg-[#0A0908] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#A855F7]/40"/>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/50">Description</span>
            <input value={description} onChange={e=>{setDescription(e.target.value); setJsonTouched(false);}} placeholder="What this flow does" className="w-full rounded-xl bg-[#0A0908] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/15"/>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {NICHES.map(n=>(
              <button key={n} type="button" onClick={()=>{setNiche(n); setJsonTouched(false);}} className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${niche===n ? 'bg-[#A855F7] border-[#A855F7] text-white' : 'bg-[#0A0908] border-white/[0.08] text-white/50 hover:text-white'}`}>{n}</button>
            ))}
          </div>
        </div>

        {/* Agentic prompt bar */}
        <div className="rounded-[18px] bg-[#0A0908] border border-white/[0.06] p-4 space-y-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#A855F7]/15 border border-[#A855F7]/20 text-[#A855F7]"><Wand2 size={14}/></div>
            <h3 className="text-sm font-bold text-white">Agentic prompt → flow</h3>
            <span className="ml-auto text-[10px] font-bold text-white/25">Knows all tools, outputs correct JSON</span>
          </div>
          <div className="flex gap-2">
            <input value={agenticPrompt} onChange={e=>setAgenticPrompt(e.target.value)} placeholder='e.g. "When I save an idea, create a goal and search my notes"' className="flex-1 rounded-xl bg-[#161412] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#A855F7]/30"/>
            <button type="button" onClick={handleGenerate} className="px-4 py-2.5 rounded-xl bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"><Sparkles size={14}/> Generate</button>
          </div>
          <p className="text-[11px] text-white/30">Generates steps + preview + JSON. Uses flowSyntaxEngine heuristic (client) — LLM path can be wired later.</p>
        </div>

        {/* Manual tools */}
        <div className="rounded-[18px] bg-[#0A0908] border border-white/[0.06] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">Add tools</h3>
            <input value={toolFilter} onChange={e=>setToolFilter(e.target.value)} placeholder="Filter tools…" className="w-36 rounded-lg bg-[#161412] border border-white/[0.08] px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 outline-none"/>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-auto">
            {suggestions.map(id=>(
              <button key={id} type="button" onClick={()=>addStep(id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-[#161412] border border-white/[0.08] text-[11px] font-mono text-white/70 hover:text-white hover:border-[#A855F7]/30 cursor-pointer"><Plus size={10}/> {id}</button>
            ))}
          </div>
        </div>

        {/* Flow preview — draggable */}
        <div className="rounded-[18px] bg-[#0A0908] border border-white/[0.06] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">Flow preview — drag to reorder</h3>
            <span className="text-[10px] font-bold text-white/30">{steps.length} steps</span>
          </div>
          {steps.length===0 ? <p className="text-xs text-white/30 py-2">No steps yet. Add tools above or generate via prompt.</p> : (
            <div className="space-y-1.5">
              {steps.map((s, idx)=>(
                <div key={idx} draggable onDragStart={()=>setDragIdx(idx)} onDragOver={e=>e.preventDefault()} onDrop={()=>{ if (dragIdx!==null && dragIdx!==idx) moveStep(dragIdx, idx); setDragIdx(null); }} className={`flex items-center gap-2 rounded-xl bg-[#161412] border px-3 py-2 ${dragIdx===idx ? 'border-[#A855F7]/40' : 'border-white/[0.05]'}`}>
                  <GripVertical size={12} className="text-white/20 cursor-grab shrink-0"/>
                  <span className="text-[11px] font-mono text-white/60 truncate flex-1">{idx+1}. {s.actionId}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${s.importance==='high' ? 'bg-[#A855F7]/15 border-[#A855F7]/20 text-[#A855F7]' : 'bg-white/[0.04] border-white/[0.06] text-white/30'}`}>{s.importance}</span>
                  <button type="button" onClick={()=>removeStep(idx)} className="p-1 rounded-lg text-white/30 hover:text-red-400 cursor-pointer"><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* JSON pane — {flowname}.json */}
        <div className={`rounded-[18px] border p-4 space-y-2 ${hasError ? 'bg-red-950/10 border-red-500/25' : 'bg-[#0A0908] border-white/[0.06]'}`}>
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">{(title.trim() || 'Untitled').toLowerCase().replace(/[^a-z0-9]+/g,'-')}.json</h3>
            <div className="flex items-center gap-2">
              {hasError ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertCircle size={12}/>{errorMsg?.slice(0,80)}</span> : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400"><Check size={12}/> Valid</span>}
              <button type="button" onClick={()=>navigator.clipboard.writeText(jsonText).then(()=>toast.success('Copied'))} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white cursor-pointer"><Copy size={12}/></button>
            </div>
          </div>
          <div className="relative">
            <textarea value={jsonText} onChange={e=>handleJsonChange(e.target.value)} spellCheck={false} rows={14} className={`w-full rounded-xl bg-[#161412] border px-3 py-3 text-[11px] font-mono text-white/75 outline-none resize-y ${hasError ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/[0.08] focus:border-white/15'}`} />
            {hasError && <div className="absolute inset-x-0 bottom-0 h-0.5 bg-red-500/60 rounded-full" />}
          </div>
          {diagnostics.length>0 && (
            <ul className="space-y-1">
              {diagnostics.map((d,i)=>(
                <li key={i} className={`text-[11px] ${d.severity==='error' ? 'text-red-400' : 'text-amber-400'}`}>{d.path}: {d.message} {d.suggestion && <span className="text-white/50">— {d.suggestion}</span>}</li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-white/25">Live syntax + autocorrect. Unknown actionIds get red underline + suggestion (e.g. {autocorrectActionId('creat_note') || 'create_note'}).</p>
        </div>
      </div>

      <div className="p-5 border-t border-white/[0.06] shrink-0 space-y-2">
        {!title.trim() && <p className="text-[11px] font-bold text-amber-400 flex items-center gap-1"><AlertCircle size={12}/> Title required — create is disabled</p>}
        {title.trim() && steps.length===0 && <p className="text-[11px] font-bold text-amber-400">Add at least one tool</p>}
        <button type="button" disabled={!canCreate || busy} onClick={handleCreate} className={`w-full py-3 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2 transition ${canCreate ? 'bg-[#A855F7] hover:bg-[#9333EA] text-white cursor-pointer' : 'bg-white/[0.06] text-white/25 cursor-not-allowed blur-[0.3px]'}`}>
          {busy ? 'Creating…' : `Create ${title.trim() || 'Untitled'}`}
        </button>
      </div>
    </div>
  );
}
