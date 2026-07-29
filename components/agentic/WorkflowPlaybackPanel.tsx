'use client';

import { Play, Workflow } from 'lucide-react';
import type { WorkflowChain } from '@/lib/workflow-engine';
import { triggerWorkflowAgentRun } from '@/lib/agentic/workflow-bridge';

interface WorkflowPlaybackPanelProps {
  workflows: WorkflowChain[];
  resourceId?: string;
  resourceType?: string;
}

export function WorkflowPlaybackPanel({
  workflows,
  resourceId,
  resourceType,
}: WorkflowPlaybackPanelProps) {
  if (!workflows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-[#9B9691] text-sm">
        No saved workflows yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workflows.map((wf) => (
        <div
          key={wf.id}
          className="rounded-2xl border border-white/8 bg-[#161412] p-4 flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Workflow size={14} className="text-[#6366F1]" />
              <span className="text-sm font-extrabold text-white truncate">{wf.name}</span>
            </div>
            <p className="text-xs text-[#9B9691] leading-relaxed">{wf.description || `${wf.steps.length} steps`}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              void triggerWorkflowAgentRun(wf, {
                resourceId,
                resourceType,
              })
            }
            className="shrink-0 h-9 px-3 rounded-xl bg-[#6366F1] text-black text-xs font-extrabold flex items-center gap-1.5"
          >
            <Play size={14} />
            Run
          </button>
        </div>
      ))}
    </div>
  );
}
