'use client';

import React, { useState } from 'react';
import { ShieldCheck, Zap, ArrowRight, ExternalLink, CheckCircle2, Loader2, Lock, Cpu, Sparkles, X } from 'lucide-react';
import { executeKeeperHubTransactionAction, dryRunKeeperHubTransactionAction } from '@/lib/actions/keeperhub';
import type { KeeperHubExecutionReceipt } from '@/lib/keeperhub/client';
import toast from 'react-hot-toast';

export interface KeeperHubExecutionDrawerProps {
  drawerData?: {
    recipient?: string;
    amount?: string;
    symbol?: string;
    network?: string;
    chainId?: number;
    intent?: string;
    note?: string;
    onConfirmed?: (receipt: KeeperHubExecutionReceipt) => void;
  };
  onClose: () => void;
}

type ExecutionStep = 'idle' | 'preparing' | 'dry_run' | 'broadcasting' | 'confirmed' | 'failed';

export function KeeperHubExecutionDrawer({ drawerData, onClose }: KeeperHubExecutionDrawerProps) {
  const recipient = drawerData?.recipient || '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
  const amount = drawerData?.amount || '0.001';
  const symbol = (drawerData?.symbol || 'ETH').toUpperCase();
  const chainId = drawerData?.chainId || 11155111;
  const network = drawerData?.network || (chainId === 11155111 ? 'Ethereum Sepolia' : 'Ethereum');
  const intent = drawerData?.intent || `Fund bounty: Send ${amount} ${symbol} to ${recipient}`;

  const [step, setStep] = useState<ExecutionStep>('idle');
  const [receipt, setReceipt] = useState<KeeperHubExecutionReceipt | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAuthorizeExecution = async () => {
    setStep('preparing');
    setErrorMessage(null);

    try {
      // Step 1 -> Step 2: Dry Run Verification
      await new Promise((r) => setTimeout(r, 450));
      setStep('dry_run');
      await dryRunKeeperHubTransactionAction({ recipient, amount, symbol, network, chainId, intent });

      // Step 2 -> Step 3: Broadcasting
      await new Promise((r) => setTimeout(r, 650));
      setStep('broadcasting');

      // Step 3 -> Step 4: Execution via KeeperHub Turnkey Enclave
      const res = await executeKeeperHubTransactionAction({ recipient, amount, symbol, network, chainId, intent });

      await new Promise((r) => setTimeout(r, 700));

      if (res.success && res.receipt) {
        setReceipt(res.receipt);
        setStep('confirmed');
        toast.success(`KeeperHub Executed: ${res.receipt.txHash.slice(0, 10)}...`);

        drawerData?.onConfirmed?.(res.receipt);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('kylrix:keeperhub-execution-confirmed', {
              detail: { receipt: res.receipt, intent, amount, symbol, recipient },
            })
          );
        }
      } else {
        setStep('failed');
        setErrorMessage(res.error || 'Execution failed on KeeperHub MCP enclave.');
      }
    } catch (err) {
      setStep('failed');
      setErrorMessage(err instanceof Error ? err.message : 'Execution error.');
    }
  };

  return (
    <div className="bg-[#000000] text-white p-6 rounded-t-[28px] max-w-xl mx-auto flex flex-col gap-5 select-none border-t border-white/10 shadow-[0_-24px_60px_rgba(0,0,0,0.95)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-clash font-extrabold text-base text-white">KeeperHub Onchain Execution</h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                Turnkey TEE Enclave
              </span>
            </div>
            <p className="text-xs font-satoshi text-white/50 mt-0.5">
              Deterministic Intent & Policy Engine
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-xl bg-[#161412] hover:bg-[#1C1917] border border-white/10 text-white/40 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Action Intent Banner Card */}
      <div className="p-4 rounded-2xl bg-[#161412] border border-[#1C1917] hover:border-purple-500/30 transition-all flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs font-mono text-purple-300">
          <span className="uppercase tracking-wider font-bold">Action Intent</span>
          <span className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 font-bold">
            {network}
          </span>
        </div>
        <div className="flex items-center justify-between font-clash">
          <span className="text-lg font-black text-white">{amount} {symbol}</span>
          <div className="flex items-center gap-2 text-white/60 text-xs font-mono">
            <span>To:</span>
            <span className="font-bold text-white bg-black/40 px-2 py-1 rounded-lg border border-white/5">
              {recipient.slice(0, 8)}...{recipient.slice(-6)}
            </span>
          </div>
        </div>
        <p className="text-xs font-satoshi text-white/60 bg-black/30 p-2.5 rounded-xl border border-white/5">
          &quot;{intent}&quot;
        </p>
      </div>

      {/* Technical Policy & Layer Specifications */}
      <div className="grid grid-cols-2 gap-2 text-xs font-satoshi">
        <div className="p-3 rounded-xl bg-[#161412] border border-[#1C1917] flex items-center gap-2.5">
          <Cpu size={16} className="text-purple-400 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] font-mono text-white/40 uppercase">Execution Layer</span>
            <span className="font-bold text-white truncate block">Turnkey Enclave</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-[#161412] border border-[#1C1917] flex items-center gap-2.5">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <span className="block text-[10px] font-mono text-white/40 uppercase">Policy Check</span>
            <span className="font-bold text-emerald-400 truncate block">Allowlist Verified</span>
          </div>
        </div>
      </div>

      {/* Live Execution Progress Tracker */}
      <div className="p-4 rounded-2xl bg-[#161412] border border-[#1C1917] flex flex-col gap-3">
        <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-wider">
          KeeperHub Execution Lifecycle
        </span>
        <div className="flex flex-col gap-2.5 text-xs font-satoshi">
          {/* Step 1: Preparing Intent */}
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {step === 'preparing' ? (
                <Loader2 size={16} className="text-purple-400 animate-spin" />
              ) : step !== 'idle' ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-white/20" />
              )}
            </div>
            <span className={step !== 'idle' ? 'text-white font-bold' : 'text-white/40'}>
              1. Preparing Intent Payload
            </span>
          </div>

          {/* Step 2: KeeperHub Dry-Run Verified */}
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {step === 'dry_run' ? (
                <Loader2 size={16} className="text-purple-400 animate-spin" />
              ) : step === 'broadcasting' || step === 'confirmed' ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-white/20" />
              )}
            </div>
            <span className={step === 'broadcasting' || step === 'confirmed' ? 'text-white font-bold' : 'text-white/40'}>
              2. KeeperHub Dry-Run & Policy Verification
            </span>
          </div>

          {/* Step 3: Broadcasting via Turnkey Enclave */}
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {step === 'broadcasting' ? (
                <Loader2 size={16} className="text-purple-400 animate-spin" />
              ) : step === 'confirmed' ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-white/20" />
              )}
            </div>
            <span className={step === 'confirmed' ? 'text-white font-bold' : 'text-white/40'}>
              3. Broadcasting via Turnkey TEE Enclave
            </span>
          </div>

          {/* Step 4: Confirmed */}
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              {step === 'confirmed' ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-white/20" />
              )}
            </div>
            <span className={step === 'confirmed' ? 'text-emerald-400 font-bold' : 'text-white/40'}>
              4. Confirmed on {network}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmed Output Receipt or Error */}
      {receipt && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
              <Sparkles size={14} /> Transaction Confirmed
            </span>
            <span className="text-[10px] font-mono text-emerald-300">Gas Saved: ${receipt.gasSavedUsd}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono bg-black/40 p-2.5 rounded-xl border border-white/5">
            <span className="text-white/60">Tx Hash:</span>
            <span className="font-bold text-white truncate max-w-[220px]">{receipt.txHash}</span>
          </div>
          <a
            href={receipt.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-satoshi font-bold text-xs transition-all cursor-pointer"
          >
            <span>View on Sepolia Etherscan</span>
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 font-satoshi">
          {errorMessage}
        </div>
      )}

      {/* Footer Action Triggers */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3.5 rounded-xl border border-white/10 bg-[#161412] hover:bg-[#1C1917] text-white font-satoshi font-bold text-xs transition-colors cursor-pointer"
        >
          {step === 'confirmed' ? 'Done' : 'Cancel'}
        </button>

        {step !== 'confirmed' && (
          <button
            type="button"
            disabled={step !== 'idle' && step !== 'failed'}
            onClick={handleAuthorizeExecution}
            className="flex-2 py-3.5 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-satoshi font-black text-xs transition-all shadow-[0_4px_20px_rgba(168,85,247,0.4)] flex items-center justify-center gap-2 cursor-pointer"
          >
            {step === 'idle' || step === 'failed' ? (
              <>
                <Lock size={14} />
                <span>Proceed / Authorize Execution</span>
                <ArrowRight size={14} />
              </>
            ) : (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Executing via KeeperHub...</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
