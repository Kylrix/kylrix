"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {

export function renderReceiveDrawer(bag: any) {
  const {
  renderHistoryView,
  renderReceiveDrawer,
  renderReceiveView,
  renderSendView,
  renderWalletContent
  } = bag as any;

        if (!receiveModalData) return null;
        const { token, chainName, address, color } = receiveModalData;

        const handleDownloadQR = () => {
            const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
            if (!canvas) {
                toast.error('QR code not available');
                return;
            }
            const link = document.createElement('a');
            link.download = `${token.toLowerCase()}-receive-address-qr.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            toast.success('QR Code downloaded');
        };

        return (
            <Drawer
                anchor="bottom"
                open={receiveModalData !== null}
                onClose={() => setReceiveModalData(null)}
                PaperProps={{
                    sx: {
                        bgcolor: SURFACE,
                        borderTop: `1px solid ${EDGE}`,
                        borderRadius: '32px 32px 0 0',
                        backgroundImage: 'none',
                        p: 3,
                        maxHeight: '85dvh',
                        zIndex: 1600,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2.5
                    }
                }}
                ModalProps={{
                    sx: {
                        zIndex: 1590
                    }
                }}
            >
                <Box sx={{ width: 40, height: 4, bgcolor: '#3E3B37', borderRadius: '2px', alignSelf: 'center', mb: 0.5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                        <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)', mb: 0.5 }}>
                            Receive / Deposit
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', fontSize: '1.25rem', lineHeight: 1.1 }}>
                            {token} ({chainName})
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setReceiveModalData(null)} sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                        <X size={20} />
                    </IconButton>
                </Box>

                <div className="flex flex-col items-center gap-4 py-2">
                    {/* QR Code */}
                    <div className="p-3.5 bg-white rounded-2xl shadow-xl flex items-center justify-center">
                        <QRCodeCanvas value={address || 'Unavailable'} size={180} />
                    </div>

                    {/* Address Box */}
                    <div className="w-full p-3 rounded-2xl bg-[#0A0908] border border-white/[0.08] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-satoshi font-bold text-white/50">Deposit Address</span>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/5" style={{ color: color || ACCENT }}>
                                {token}
                            </span>
                        </div>
                        <div className="text-xs font-mono text-white/90 break-all select-all leading-relaxed">
                            {address || 'Address not provisioned'}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="w-full grid grid-cols-2 gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={() => handleCopyAddress(address)}
                            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#161412] hover:bg-[#1f1d1a] border border-white/10 text-white font-satoshi font-bold text-xs transition-all cursor-pointer active:scale-[0.98]"
                        >
                            <Copy size={15} className="text-[#6366F1]" />
                            <span>Copy Address</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadQR}
                            className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#161412] hover:bg-[#1f1d1a] border border-white/10 text-white font-satoshi font-bold text-xs transition-all cursor-pointer active:scale-[0.98]"
                        >
                            <Download size={15} className="text-[#14F195]" />
                            <span>Save QR</span>
                        </button>
                    </div>

                    <p className="text-[11px] text-white/40 font-satoshi text-center leading-relaxed px-2">
                        Only send <strong className="text-white/80">{token}</strong> or compatible assets on <strong className="text-white/80">{chainName}</strong> to this specific address.
                    </p>
                </div>
            </Drawer>
        );
}
