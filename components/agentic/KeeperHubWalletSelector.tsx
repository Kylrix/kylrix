'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ChevronDown, Check, Zap } from 'lucide-react';
import { getKeeperHubStatusAction } from '@/lib/actions/keeperhub';

export interface WalletAccount {
  id: string;
  name: string;
  address: string;
  balance: string;
  symbol: string;
  enclave: string;
}

export const DEMO_TESTNET_WALLETS: WalletAccount[] = [
  {
    id: 'vault-1',
    name: 'Primary Turnkey Vault',
    address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    balance: '1.500',
    symbol: 'Sepolia ETH',
    enclave: 'KeeperHub Enclave #1',
  },
  {
    id: 'vault-2',
    name: 'Bounty Execution Account',
    address: '0x3a19F02b48d2A4210D49C73351C9B38908fC8201',
    balance: '2.850',
    symbol: 'Sepolia ETH',
    enclave: 'KeeperHub Enclave #2',
  },
  {
    id: 'vault-3',
    name: 'Hackathon Agent Enclave',
    address: '0x9b1C28e7eF8682613d5A0a427B9e49aEDd13e312',
    balance: '0.750',
    symbol: 'Sepolia ETH',
    enclave: 'KeeperHub TEE',
  },
];

export function KeeperHubWalletSelector({ compact = false }: { compact?: boolean }) {
  const [testnetMode, setTestnetMode] = useState<boolean>(true);
  const [activeWallet, setActiveWallet] = useState<WalletAccount>(DEMO_TESTNET_WALLETS[0]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [integrationStatus, setIntegrationStatus] = useState<{
    status: 'connected' | 'demo_ready' | 'offline';
    enclave: string;
    latencyMs: number;
  }>({ status: 'demo_ready', enclave: 'Turnkey TEE Enclave #1', latencyMs: 42 });

  useEffect(() => {
    void getKeeperHubStatusAction().then((res) => {
      if (res.success) {
        setIntegrationStatus({
          status: res.status,
          enclave: res.enclave,
          latencyMs: res.latencyMs,
        });
      }
    });
  }, []);


  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('kylrix_wallet_testnet_mode');
    if (stored !== null) {
      setTestnetMode(stored === '1');
    }
    const savedAccount = localStorage.getItem('kylrix_active_wallet_account');
    if (savedAccount) {
      const match = DEMO_TESTNET_WALLETS.find((w) => w.id === savedAccount);
      if (match) setActiveWallet(match);
    }
  }, []);

  const handleToggleTestnet = () => {
    const next = !testnetMode;
    setTestnetMode(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kylrix_wallet_testnet_mode', next ? '1' : '0');
      window.dispatchEvent(new CustomEvent('kylrix:wallet-testnet-toggle', { detail: { testnetMode: next } }));
    }
  };

  const handleSelectWallet = (w: WalletAccount) => {
    setActiveWallet(w);
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kylrix_active_wallet_account', w.id);
      window.dispatchEvent(new CustomEvent('kylrix:wallet-account-changed', { detail: { account: w } }));
    }
  };

  return (
    <div className="relative inline-flex items-center gap-2 select-none">
      {/* Testnet Badge / Toggle Button */}
      <button
        type="button"
        onClick={handleToggleTestnet}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold transition-all cursor-pointer ${
          testnetMode
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
            : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
        }`}
        title="Toggle Testnet / Mainnet Mode"
      >
        <span className={`w-2 h-2 rounded-full ${testnetMode ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
        <span>{testnetMode ? 'Sepolia Testnet' : 'Mainnet Mode'}</span>
      </button>

      {/* Account Selector Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#161412] hover:bg-[#1C1917] border border-white/10 hover:border-white/20 transition-all cursor-pointer text-xs font-satoshi"
      >
        <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
          <Zap size={10} className="text-purple-300" />
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-white truncate max-w-[110px]">{activeWallet.name}</span>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-1.5 rounded border border-purple-500/20">
              {activeWallet.balance} {activeWallet.symbol}
            </span>
          </div>
        )}
        <ChevronDown size={13} className="text-white/40" />
      </button>

      {/* Bottom Drawer — fixed, layered above agentic panel (z-[200]) */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[200] flex flex-col justify-end"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-[#0B0A09] border-t border-white/10 rounded-t-[24px] w-full max-h-[60dvh] flex flex-col overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex-shrink-0 pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Zap size={15} />
                </div>
                <div>
                  <h3 className="text-white font-extrabold text-[13px] font-clash tracking-tight">KeeperHub Accounts</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-white/40">{integrationStatus.enclave}</span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {integrationStatus.status === 'connected' ? 'Live MCP' : 'Demo Ready'} ({integrationStatus.latencyMs}ms)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  testnetMode
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-white/50'
                }`}>
                  {testnetMode ? 'Sepolia Testnet' : 'Mainnet'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/45 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 cursor-pointer"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>


            {/* Wallet list */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
              {DEMO_TESTNET_WALLETS.map((w) => {
                const isSelected = w.id === activeWallet.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleSelectWallet(w)}
                    className={`w-full p-3.5 rounded-2xl text-left transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                        : 'bg-[#161412] hover:bg-white/[0.04] border border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm font-satoshi truncate">{w.name}</span>
                        <ShieldCheck size={12} className="text-purple-400 shrink-0" />
                      </div>
                      <span className="text-[11px] font-mono text-white/40 truncate">
                        {w.address.slice(0, 8)}...{w.address.slice(-6)}
                      </span>
                      <span className="text-[10px] font-mono text-white/30">{w.enclave}</span>
                    </div>
                    <div className="flex flex-col items-end shrink-0 ml-3 gap-1">
                      <span className="text-sm font-mono font-bold text-purple-300">{w.balance}</span>
                      <span className="text-[10px] text-white/40">{w.symbol}</span>
                      {isSelected && <Check size={13} className="text-purple-400" />}
                    </div>
                  </button>
                );
              })}
              <div className="pb-4" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
