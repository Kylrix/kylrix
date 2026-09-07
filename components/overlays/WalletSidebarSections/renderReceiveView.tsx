"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {

export function renderReceiveView(bag: any) {
  const {
  renderHistoryView,
  renderReceiveDrawer,
  renderReceiveView,
  renderSendView,
  renderWalletContent
  } = bag as any;

        const chains = [
            {
                token: 'KYLRIX',
                label: 'Kylrix Ledger',
                address: user?.$id || '',
                color: '#6366F1',
                logo: <Logo app="root" variant="icon" size={20} />
            },
            {
                token: 'SOL',
                label: 'Solana Network',
                address: solWallet?.address || '',
                color: '#14F195',
                logo: <PinnedNetworkIconSolana size={20} />
            },
            ...orderedWallets.filter(w => w.chain !== 'sol').map(w => ({
                token: w.symbol,
                label: w.label,
                address: w.address,
                color: getNetworkColor(w.chain) || ACCENT,
                logo: getNetworkLogo(w.chain) || w.symbol[0]
            }))
        ];

        return (
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-base font-extrabold font-clash text-white tracking-tight">
                        Receive & Deposit
                    </div>
                    <span className="text-xs text-white/40 font-satoshi">
                        Click card for QR Code
                    </span>
                </div>

                <div className="space-y-3">
                    {chains.map((chain) => (
                        <div
                            key={chain.token}
                            onClick={() => {
                                if (chain.address) {
                                    setReceiveModalData({
                                        token: chain.token,
                                        chainName: chain.label,
                                        address: chain.address,
                                        color: chain.color
                                    });
                                } else {
                                    toast.error(`${chain.label} address not provisioned yet`);
                                }
                            }}
                            className="p-4 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm active:scale-[0.99] space-y-2.5"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0 font-extrabold text-sm" style={{ color: chain.color }}>
                                        {chain.logo}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-extrabold text-white font-satoshi truncate">
                                            {chain.label}
                                        </div>
                                        <div className="text-[11px] font-mono text-white/40 uppercase">
                                            {chain.token}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (chain.address) handleCopyAddress(chain.address);
                                        }}
                                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-satoshi text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                        title="Copy address"
                                    >
                                        <Copy size={13} />
                                        <span>Copy</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (chain.address) {
                                                setReceiveModalData({
                                                    token: chain.token,
                                                    chainName: chain.label,
                                                    address: chain.address,
                                                    color: chain.color
                                                });
                                            }
                                        }}
                                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                                        title="View QR Code"
                                    >
                                        <QrCode size={15} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.04] text-xs font-mono text-white/60 break-all select-all">
                                {chain.address || 'Address not provisioned'}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
}
