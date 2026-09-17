'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Workflow,
  Sparkles,
  CheckSquare,
  FileText,
  Calendar,
  Lock,
  Send,
  Plus,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import {
  getWorkflowsForObject,
  WorkflowObjectType,
  BuiltinObjectWorkflow,
  sanitizePromptInput,
} from '@/lib/workflows/object-workflows';
import { convertNoteToGoalAgentic, convertObjectToIdeasAgentic } from '@/lib/ai-actions';
import { useWorkspace } from '@/context/WorkspaceContext';

interface ObjectWorkflowsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  objectType: WorkflowObjectType;
  targetObject: {
    id: string;
    title: string;
    content?: string;
    description?: string;
    tags?: string[];
    raw?: any;
  };
  installedFlows?: any[];
  onOpenFormResponsesWorkflow?: () => void;
}

export function ObjectWorkflowsDrawer({
  isOpen,
  onClose,
  objectType,
  targetObject,
  installedFlows = [],
  onOpenFormResponsesWorkflow,
}: ObjectWorkflowsDrawerProps) {
  const { showSuccess, showError, showInfo } = useToast();
  const { activeWorkspace } = useWorkspace();
  const [customWorkflowPrompt, setCustomWorkflowPrompt] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  if (!isOpen) return null;

  const availableWorkflows = getWorkflowsForObject(objectType, installedFlows);
  const isVaultItem = objectType === 'secret' || objectType === 'totp';

  const handleExecuteWorkflow = async (wf: BuiltinObjectWorkflow) => {
    if (wf.handlerKind === 'form_responses_drawer') {
      onClose();
      onOpenFormResponsesWorkflow?.();
      return;
    }

    if (wf.handlerKind === 'vault_export_copy') {
      try {
        const textToCopy = `${targetObject.title}: ${targetObject.content || targetObject.description || ''}`;
        await navigator.clipboard.writeText(textToCopy);
        showSuccess('Vault item details copied securely');
        onClose();
      } catch (err: any) {
        showError('Failed to copy vault item details');
      }
      return;
    }

    setIsExecuting(true);
    showInfo(`Executing workflow: ${wf.name}...`);

    try {
      const workspaceOpts = {
        activeWorkspaceId: activeWorkspace?.id || null,
        projectId: activeWorkspace?.id || null,
        isWorkspace: Boolean(activeWorkspace?.id),
      };

      if (wf.handlerKind === 'convert_idea_to_goal') {
        await convertNoteToGoalAgentic(targetObject.raw || (targetObject as any), workspaceOpts);
        showSuccess('Created goal(s) in Kylrix Flow');
      } else if (
        wf.handlerKind === 'convert_goal_to_idea' ||
        wf.handlerKind === 'convert_event_to_idea'
      ) {
        await convertObjectToIdeasAgentic(
          {
            id: targetObject.id,
            title: targetObject.title,
            content: targetObject.content || targetObject.description,
            type: objectType === 'goal' ? 'goal' : 'event',
          },
          workspaceOpts
        );
        showSuccess('Created idea(s) in Ideas directory');
      } else if (wf.handlerKind === 'convert_event_to_goal' || wf.handlerKind === 'convert_idea_to_event') {
        const { unifiedCreate } = await import('@/lib/services/unified-object-service');
        if (wf.handlerKind === 'convert_event_to_goal') {
          await unifiedCreate('goal', {
            title: `Task from Event: ${targetObject.title}`,
            description: targetObject.content || targetObject.description || '',
            status: 'todo',
            priority: 'medium',
            ...(workspaceOpts.projectId ? { projectId: workspaceOpts.projectId, isWorkspace: true } : {}),
          });
          showSuccess('Task created from Event');
        } else {
          const now = new Date();
          const start = new Date(now.getTime() + 3600000).toISOString();
          const end = new Date(now.getTime() + 7200000).toISOString();
          await unifiedCreate('event', {
            title: `Event for: ${targetObject.title}`,
            description: targetObject.content || targetObject.description || '',
            startTime: start,
            endTime: end,
            ...(workspaceOpts.projectId ? { projectId: workspaceOpts.projectId, isWorkspace: true } : {}),
          });
          showSuccess('Event scheduled in Calendar');
        }
      } else {
        // Generic action hook execution
        showSuccess(`Executed workflow ${wf.name}`);
      }

      onClose();
    } catch (err: any) {
      showError('Workflow Failed', err?.message || 'Execution error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunCustomWorkflow = async () => {
    const raw = customWorkflowPrompt.trim();
    if (!raw) return;

    if (isVaultItem) {
      showError('Security Guard', 'AI workflows are disabled for encrypted vault items.');
      return;
    }

    setIsExecuting(true);
    showInfo('Running custom workflow...');

    try {
      const sanitized = sanitizePromptInput(raw);
      const workspaceOpts = {
        activeWorkspaceId: activeWorkspace?.id || null,
        projectId: activeWorkspace?.id || null,
        isWorkspace: Boolean(activeWorkspace?.id),
      };

      if (objectType === 'idea') {
        await convertNoteToGoalAgentic(
          {
            ...((targetObject.raw as any) || {}),
            $id: targetObject.id,
            title: targetObject.title,
            content: `${targetObject.content || ''}\n\n[Custom Workflow Instruction: ${sanitized}]`,
          } as any,
          workspaceOpts
        );
      } else {
        await convertObjectToIdeasAgentic(
          {
            id: targetObject.id,
            title: targetObject.title,
            content: `${targetObject.content || targetObject.description || ''}\n\n[Custom Workflow Instruction: ${sanitized}]`,
            type: objectType === 'goal' ? 'goal' : 'event',
          },
          workspaceOpts
        );
      }

      showSuccess('Custom workflow completed successfully!');
      setCustomWorkflowPrompt('');
      onClose();
    } catch (err: any) {
      showError('Custom Workflow Failed', err?.message || 'Execution error');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10090] bg-black/80 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#161412]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20">
            <Workflow size={24} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold font-clash text-white">
              Workflows for {targetObject.title || 'Selected Object'}
            </h2>
            <p className="text-xs text-[#9B9691] font-satoshi">
              Object Type: <span className="uppercase text-white font-mono font-bold">{objectType}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-3 rounded-2xl text-[#9B9691] hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-y-auto max-w-4xl w-full mx-auto space-y-8 font-satoshi">
        {/* Custom Ad-Hoc Workflow Field */}
        <div className="p-6 rounded-3xl bg-[#161412] border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#A855F7]" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Specify Custom Workflow</h3>
            </div>
            {isVaultItem ? (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                <ShieldAlert size={14} />
                <span>Non-AI Local Security Mode</span>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={customWorkflowPrompt}
              onChange={(e) => setCustomWorkflowPrompt(e.target.value)}
              disabled={isVaultItem || isExecuting}
              placeholder={
                isVaultItem
                  ? 'Custom AI workflows are disabled for encrypted vault items.'
                  : 'Add custom workflow (e.g., "Summarize risks and draft 3 milestone tasks")...'
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleRunCustomWorkflow();
              }}
              className="flex-1 bg-[#000000] border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white placeholder-[#9B9691] focus:outline-none focus:border-[#A855F7] disabled:opacity-50 transition-all"
            />
            <button
              type="button"
              onClick={handleRunCustomWorkflow}
              disabled={isVaultItem || isExecuting || !customWorkflowPrompt.trim()}
              className="px-5 py-3.5 rounded-2xl bg-[#A855F7] text-white font-bold text-xs hover:bg-[#A855F7]/90 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
            >
              <Send size={14} />
              <span>Run Custom</span>
            </button>
          </div>
        </div>

        {/* Inbuilt & Action Hook Workflows List */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#9B9691] uppercase tracking-wider px-2">Available Workflows</h3>

          {availableWorkflows.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#161412] border border-white/5 text-center text-[#9B9691] text-xs">
              No applicable workflows for this object type.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableWorkflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => !isExecuting && handleExecuteWorkflow(wf)}
                  className="group p-5 rounded-3xl bg-[#161412] hover:bg-[#1C1917] border border-white/10 hover:border-[#A855F7]/50 cursor-pointer transition-all duration-200 flex flex-col justify-between gap-4 shadow-lg hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#000000] border border-white/10 text-[#A855F7] group-hover:border-[#A855F7]/40 transition-colors">
                        {wf.icon === 'CheckSquare' ? (
                          <CheckSquare size={18} />
                        ) : wf.icon === 'FileText' ? (
                          <FileText size={18} />
                        ) : wf.icon === 'Calendar' ? (
                          <Calendar size={18} />
                        ) : wf.icon === 'Lock' ? (
                          <Lock size={18} />
                        ) : (
                          <Workflow size={18} />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-[#A855F7] transition-colors">
                          {wf.name}
                        </h4>
                        <p className="text-xs text-[#9B9691] leading-relaxed line-clamp-2">{wf.description}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-auto text-xs text-[#9B9691] font-semibold">
                    <span>{wf.requiresAI ? 'AI Agentic Workflow' : 'Local Non-AI Action'}</span>
                    <div className="flex items-center gap-1 text-[#A855F7] group-hover:translate-x-1 transition-transform">
                      <span>Execute</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
