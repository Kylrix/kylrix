'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, CheckCircle } from 'lucide-react';

interface CdrProcessingDrawerProps {
  open: boolean;
  onClose: () => void;
  isDemoMode?: boolean;
  walletAddress?: string;
  onFinished: () => void;
}

export function CdrProcessingDrawer({
  open,
  onClose,
  isDemoMode = false,
  walletAddress = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  onFinished,
}: CdrProcessingDrawerProps) {
  const [step, setStep] = useState(0);
  const [txHash, setTxHash] = useState('');
  const [cid, setCid] = useState('');
  const [showAuthDrawer, setShowAuthDrawer] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setTxHash('');
    setCid('');
    setShowAuthDrawer(false);

    // Initial step progression
    const timer1 = setTimeout(() => setStep(1), 1000);
    const timer2 = setTimeout(() => {
      setStep(2);
      setShowAuthDrawer(true); // Open the wallet signature drawer on top
    }, 2000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [open]);

  const handleAuthorize = () => {
    setShowAuthDrawer(false);
    // Set step to 3 immediately to prevent flashing the "Sign Request" button/state
    setStep(3);
    setTxHash('0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
    setCid('QmStoryDemoIPFS' + Math.random().toString(36).substring(2, 10));

    // Show finalizing state for 1000ms, then transition to complete and auto-close
    setTimeout(() => {
      setStep(4);
      setTimeout(() => {
        onFinished();
      }, 800);
    }, 1000);
  };

  const steps = [
    { label: 'Deriving EVM Key', desc: 'Querying secure RAM keystore' },
    { label: 'Encrypting Payload', desc: 'TEE threshold ECIES wrap' },
    { label: 'Story Contract Submission', desc: 'Awaiting signature verification' },
    { label: 'Finalizing Data Rail', desc: 'Registering asset on-chain' },
  ];

  if (!open || !mounted) return null;

  return createPortal(
    <>
      {/* 1. Gateway Processing Drawer */}
      <div className="fixed inset-0 z-[1500] flex items-end justify-center">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" />
        
        {/* Drawer Content Container */}
        <div className="relative w-full max-w-[480px] bg-[#161412] border-t border-l border-r border-white/5 rounded-t-[28px] p-6 pb-8 text-white z-10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between max-h-[60dvh] overflow-hidden animate-in slide-in-from-bottom duration-300">
          
          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin mb-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center flex-shrink-0">
                <Shield size={20} />
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <span className="font-extrabold text-sm font-mono leading-tight">
                  Story CDR Gateway
                </span>
                <span className="text-[#10B981] text-[10px] font-black font-mono mt-0.5 tracking-wider">
                  {step < 4 ? 'SECURE TRANSACTION IN PROGRESS' : 'TRANSACTION COMPLETE'}
                </span>
              </div>
            </div>

            {/* Account Details */}
            <div className="p-4 bg-black/40 border border-white/5 rounded-xl mb-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-white/40 font-black text-[9px] uppercase tracking-wider font-mono">
                    Active EVM Account
                  </span>
                  <span className="text-white/80 text-xs font-mono break-all leading-normal">
                    {walletAddress}
                  </span>
                </div>

                <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-white/40 font-black text-[9px] uppercase tracking-wider font-mono">
                      Testnet Balance
                    </span>
                    <span className="text-white text-xs font-mono font-extrabold">
                      {isDemoMode ? '4,200.00 IP' : '0.15 IP'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-white/40 font-black text-[9px] uppercase tracking-wider font-mono">
                      Aeneid Gas Fee
                    </span>
                    <span className="text-[#F59E0B] text-xs font-mono font-extrabold">
                      0.00021 IP
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Steps list */}
            <div className="flex flex-col gap-5 mb-4">
              {steps.map((s, idx) => {
                const isActive = step === idx;
                const isCompleted = step > idx;
                return (
                  <div key={idx} className="flex gap-4 items-center">
                    <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                      {isCompleted ? (
                        <span className="text-[#10B981]">
                          <CheckCircle size={18} />
                        </span>
                      ) : isActive ? (
                        <div className="animate-spin rounded-full h-4.5 w-4.5 border-t-2 border-b-2 border-[#6366F1]" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-white/15" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col">
                      <span className={`font-mono text-xs ${isCompleted || isActive ? 'text-white font-extrabold' : 'text-white/30'}`}>
                        {s.label}
                      </span>
                      <span className={`text-[11px] font-sans ${isCompleted || isActive ? 'text-white/50' : 'text-white/20'}`}>
                        {s.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Transaction Metadata & Receipt */}
            {step >= 3 && (
              <div className="p-3 bg-[#10B981]/5 border border-dashed border-[#10B981]/20 rounded-xl mt-4">
                <span className="text-[#10B981] font-black uppercase font-mono text-[10px] tracking-wider block mb-1">
                  Transaction Receipt (Aeneid Explorer)
                </span>
                <span className="text-white/50 text-[11px] font-mono break-all block leading-tight">
                  Hash: {txHash.substring(0, 24)}...
                </span>
                <span className="text-white/50 text-[11px] font-mono break-all block mt-1 leading-tight">
                  CID: {cid}
                </span>
              </div>
            )}
          </div>

          {/* Fixed Footer Buttons */}
          <div className="pt-4 border-t border-white/5 flex flex-col gap-3 flex-shrink-0">
            {step === 2 && !showAuthDrawer && (
              <button
                onClick={() => setShowAuthDrawer(true)}
                className="w-full py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-black text-xs font-mono transition duration-200"
              >
                Sign Request
              </button>
            )}

            {step === 4 && (
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white font-black text-xs font-mono transition duration-200"
              >
                Done
              </button>
            )}
          </div>

        </div>
      </div>

      {/* 2. Stacked Wallet Authorization Drawer (MetaMask/Rabby simulation) */}
      {showAuthDrawer && (
        <div className="fixed inset-0 z-[1600] flex items-end justify-center">
          {/* Backdrop (semi-transparent overlay on top of Gateway drawer) */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300"
            onClick={() => setShowAuthDrawer(false)}
          />

          {/* Drawer Content Container */}
          <div className="relative w-full max-w-[480px] bg-[#161412] border-t border-l border-r border-white/5 rounded-t-[28px] p-6 pb-8 text-white z-10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] flex flex-col justify-between max-h-[60dvh] overflow-hidden animate-in slide-in-from-bottom duration-300">
            
            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto pr-0.5 scrollbar-thin mb-4">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#10B981] rounded-xl flex items-center justify-center text-black font-black text-sm font-mono flex-shrink-0 shadow-[0_4px_12px_rgba(16,185,129,0.2)]">
                    K
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-sm font-mono leading-tight tracking-tight">
                      Kylrix Wallet
                    </span>
                    <span className="text-white/40 text-[10px] font-mono mt-0.5 leading-tight">
                      Aeneid Testnet (Story)
                    </span>
                  </div>
                </div>
                <div className="px-2.5 py-1 rounded-full bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex-shrink-0 animate-pulse">
                  <span className="text-[#F59E0B] text-[9px] font-black font-mono tracking-wider">
                    SIGN REQUEST
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="p-4 bg-black/40 border border-white/5 rounded-xl mb-4">
                <span className="text-white/40 font-black uppercase tracking-wider font-mono text-[9px] block mb-2.5">
                  Transaction Details
                </span>
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/50 font-mono">Contract</span>
                    <span className="font-mono text-white/90 font-bold">OwnerWriteCondition</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/50 font-mono">Target Action</span>
                    <span className="font-mono text-[#10B981] font-extrabold bg-[#10B981]/10 px-2 py-0.5 rounded-lg border border-[#10B981]/10">
                      registerIPAssetAndDataCondition
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#ef4444]/80 font-mono">Estimated Gas</span>
                    <span className="font-mono text-[#F59E0B] font-extrabold">0.00021 IP</span>
                  </div>
                </div>
              </div>

              {/* Hex Data */}
              <div className="p-4 bg-black/50 border border-white/5 rounded-xl">
                <span className="text-white/40 text-[9px] font-mono font-black uppercase tracking-wider block mb-2">
                  HEX DATA PAYLOAD
                </span>
                <div className="max-h-[80px] overflow-y-auto pr-1 scrollbar-thin">
                  <span className="text-white/50 text-[10px] font-mono break-all block leading-normal select-all">
                    0x5649454d5f5349474e5f4d455441444154415f53544f52595f4344525f5452414e53414354494f4e5f44454d4f5f4f4e5f41454e454944
                  </span>
                </div>
              </div>
            </div>

            {/* Fixed Action Buttons */}
            <div className="pt-4 border-t border-white/5 flex gap-3 flex-shrink-0 font-mono">
              <button
                onClick={() => setShowAuthDrawer(false)}
                className="flex-1 py-3 rounded-xl border border-white/5 text-white/50 hover:text-white hover:bg-white/5 hover:border-white/10 font-bold text-xs transition duration-200"
              >
                Reject
              </button>
              <button
                onClick={handleAuthorize}
                className="flex-1 py-3 rounded-xl bg-[#10B981] hover:bg-[#0fa976] text-black font-black text-xs shadow-[0_8px_20px_rgba(16,185,129,0.2)] hover:shadow-[0_12px_25px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Confirm & Sign
              </button>
            </div>

          </div>
        </div>
      )}
    </>,
    document.body
  );
}
