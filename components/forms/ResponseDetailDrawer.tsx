'use client';

import React, { useState } from 'react';
import { 
  X, 
  ArrowLeft, 
  Clock, 
  User, 
  Database,
  Target,
  Ghost,
  Crown
} from 'lucide-react';
import { GHOST_FIELDS_REGISTRY } from '@/lib/forms/ghost-fields';
import { useToast } from '@/components/ui/Toast';
import { convertResponseToGoal } from '@/lib/actions/client-ops';
import { useAuth } from '@/lib/auth';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useProUpgrade } from '@/context/ProUpgradeContext';

interface ResponseDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  submission: any | null;
  schemaMap?: Record<string, string>;
}

export function ResponseDetailDrawer({ isOpen, onClose, submission, schemaMap }: ResponseDetailDrawerProps) {
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const { showSuccess, showError } = useToast();
  
  // Execution goal state
  const [convertingGoal, setConvertingGoal] = useState(false);

  if (!submission || !isOpen) return null;

  let payloadData: any = {};
  try {
    payloadData = JSON.parse(submission.payload);
  } catch (_e) {
    payloadData = { raw: submission.payload };
  }

  // Instant goal creation handler
  const handleCreateGoalInstantly = async () => {
    if (!hasPaidKylrixPlan(user)) {
      openProUpgrade('Execution Goal Action');
      return;
    }

    setConvertingGoal(true);
    try {
      await convertResponseToGoal(submission.$id);
      showSuccess('Created Execution Goal instantly in workspace!');
      onClose();
    } catch (err: any) {
      showError('Failed to create goal', err?.message || 'Error converting response to goal');
    } finally {
      setConvertingGoal(false);
    }
  };

  return (
    <div className="flex flex-col h-dvh md:h-full bg-[#000] text-[#F2F2F2] font-satoshi justify-between overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-center justify-between border-b border-white/5 bg-[linear-gradient(to_bottom,rgba(16,185,129,0.05),transparent)] shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold font-clash text-white tracking-tight uppercase leading-tight">Response Detail</h3>
            <span className="block text-[10px] text-[#9B9691] font-mono font-bold">ID: {submission.$id.slice(-8)}</span>
          </div>
        </div>
        <button 
          type="button"
          onClick={onClose}
          className="p-1.5 bg-white/5 hover:bg-white/10 text-[#9B9691] hover:text-white rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
        {/* Metadata Section */}
        <div className="space-y-3">
          <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">METADATA</span>
          <div className="grid grid-cols-1 gap-2.5">
            <div className="p-3.5 rounded-xl bg-[#161412] border border-white/5 flex items-center gap-3">
              <Clock className="w-5 h-5 text-[#9B9691] shrink-0" />
              <div>
                <span className="block text-[9px] text-[#9B9691] font-black font-mono">SUBMITTED AT</span>
                <span className="text-xs font-bold text-white">
                  {submission.$createdAt || submission.createdAt ? new Date(submission.$createdAt || submission.createdAt).toLocaleString() : 'Recently'}
                </span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#161412] border border-white/5 flex items-center gap-3">
              <User className="w-5 h-5 text-[#9B9691] shrink-0" />
              <div>
                <span className="block text-[9px] text-[#9B9691] font-black font-mono">SUBMITTER</span>
                <span className="text-xs font-bold text-white">{submission.submitterName || 'Anonymous User'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Account & Ghost Telemetry Context Card (if captured) */}
        {payloadData._ghost && typeof payloadData._ghost === 'object' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Ghost className="w-4 h-4 text-[#6366F1]" />
              <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">
                ACCOUNT TELEMETRY & CONTEXT
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-[#6366F1]/10 border border-[#6366F1]/30 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.entries(payloadData._ghost).map(([gKey, gVal]: [string, any]) => {
                  const gfDef = GHOST_FIELDS_REGISTRY[gKey];
                  const label = gfDef?.label || gKey;
                  const displayVal = typeof gVal === 'object' ? JSON.stringify(gVal) : String(gVal);
                  const isPro = gKey === 'subscription_tier' && ['PRO', 'TEAM', 'LIFETIME', 'ORG'].includes(String(gVal).toUpperCase());

                  return (
                    <div key={gKey} className="p-3 rounded-xl bg-[#000000] border border-white/10 flex flex-col justify-between">
                      <span className="text-[9px] font-mono font-bold uppercase text-[#9B9691] truncate block">
                        {label}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {isPro && <Crown size={12} className="text-amber-400 shrink-0" />}
                        <span className={`text-xs font-bold font-mono truncate ${isPro ? 'text-amber-300' : 'text-white'}`}>
                          {displayVal}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Response Data Section */}
        <div className="space-y-4">
          <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">RESPONSE DATA</span>
          <div className="space-y-3.5">
            {Object.entries(payloadData)
              .filter(([key]) => key !== '_ghost')
              .map(([key, value]: [string, any]) => (
                <div key={key} className="space-y-1.5">
                  <span className="block text-xs font-bold text-[#9B9691] capitalize font-satoshi">
                    {schemaMap?.[key] || key.split(/(?=[A-Z])/).join(' ').replace(/_/g, ' ') || 'Field'}
                  </span>
                  <div className="p-4 rounded-[18px] bg-[#161412] border border-white/5 hover:border-[#10B981]/30 hover:bg-[#10B981]/[0.02] transition-all duration-200">
                    {Array.isArray(value) ? (
                      <div className="flex flex-wrap gap-1">
                        {value.map((v, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/60">
                            {String(v)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-white break-words leading-relaxed font-satoshi">
                        {String(value)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Workflow Action Triggers */}
        <div className="space-y-3 pt-2">
          <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">INTELLIGENT WORKFLOW ACTIONS</span>
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              disabled={convertingGoal}
              onClick={handleCreateGoalInstantly}
              className="w-full py-3.5 bg-[#10B981] hover:bg-[#0ea673] text-black font-extrabold text-xs rounded-xl shadow-[0_8px_30px_rgb(16,185,129,0.2)] hover:translate-y-[-1px] transition-all duration-200 font-satoshi flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Target size={14} />
              <span>{convertingGoal ? 'Spinning up Execution Goal...' : 'Spin up Execution Goal in Workspace'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer raw dump */}
      <div className="p-5 bg-[#090909] border-t border-white/5 shrink-0">
        <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono mb-2">RAW SUBMISSION</span>
        <pre className="p-3.5 rounded-xl bg-[#161412] border border-white/5 text-[10px] text-[#10B981]/80 overflow-auto max-h-[120px] font-mono scrollbar-thin">
          {JSON.stringify(payloadData, null, 2)}
        </pre>
      </div>
    </div>
  );
}
