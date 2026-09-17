'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, ChevronDown, Check, Zap } from 'lucide-react';

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
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1 rounded-xl bg-[#161412] hover:bg-[#1C1917] border border-white/10 hover:border-white/20 transition-all cursor-pointer text-xs font-satoshi"
        >
          <div className="w-4 h-4 rounded-full bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
            <Zap size={10} className="text-purple-300" />
          </div>
          {!compact && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-bold text-white truncate max-w-[110px]">{activeWallet.name}</span>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                {activeWallet.balance} {activeWallet.symbol}
              </span>
            </div>
          )}
          <ChevronDown size={13} className={`text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-[#161412] border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.9)] p-2 z-[99999] flex flex-col gap-1 backdrop-blur-xl">
            <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-white/40 uppercase tracking-wider">
                KeeperHub Turnkey Accounts
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Testnet Active
              </span>
            </div>

            {DEMO_TESTNET_WALLETS.map((w) => {
              const isSelected = w.id === activeWallet.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => handleSelectWallet(w)}
                  className={`w-full p-2.5 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                      : 'hover:bg-white/5 border border-transparent text-white/70 hover:text-white'
                  }`}
                >
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs font-satoshi truncate">{w.name}</span>
                      <ShieldCheck size={12} className="text-purple-400 shrink-0" />
                    </div>
                    <span className="text-[10px] font-mono text-white/40 truncate">
                      {w.address.slice(0, 8)}...{w.address.slice(-6)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end shrink-0 ml-2">
                    <span className="text-xs font-mono font-bold text-purple-300">{w.balance}</span>
                    <span className="text-[9px] text-white/40">{w.symbol}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-purple-400 ml-1 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
