"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {

export function renderSendView(bag: any) {
  const {
  renderHistoryView,
  renderReceiveDrawer,
  renderReceiveView,
  renderSendView,
  renderWalletContent
  } = bag as any;

        return (
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5 space-y-4">
                <div className="text-base font-extrabold font-clash text-white tracking-tight">
                    Send Asset
                </div>
                <div className="p-4 rounded-2xl bg-[#161412] border border-white/[0.08] space-y-1">
                    <div className="text-xs text-white/50 font-satoshi">
                        Available {selectedToken}
                    </div>
                    <div
                        className="text-2xl font-black font-mono tracking-tight"
                        style={{ color: selectedToken === 'KYLRIX' ? ACCENT : getNetworkColor(selectedToken.toLowerCase() as any) || 'white' }}
                    >
                        {tokenBalancesMap[selectedToken] || '0'} {selectedToken}
                    </div>
                </div>

                <div className="space-y-3 pt-1">
                    {/* Token Selector Trigger */}
                    <div
                        onClick={() => setShowTokenSelector(!showTokenSelector)}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#161412] border border-white/10 hover:border-white/20 transition-all cursor-pointer"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-[#252321] flex items-center justify-center font-extrabold text-xs" style={{ color: getNetworkColor(selectedToken.toLowerCase() as any) || ACCENT }}>
                                {selectedToken === 'KYLRIX' ? 'K' : getNetworkLogo(selectedToken.toLowerCase() as any) || selectedToken[0]}
                            </div>
                            <div>
                                <div className="text-sm font-extrabold text-white font-satoshi">{selectedToken}</div>
                                <div className="text-[11px] text-white/40 font-mono">Balance: {tokenBalancesMap[selectedToken] || '0'}</div>
                            </div>
                        </div>
                        <ChevronDown size={16} className={`text-white/40 transition-transform ${showTokenSelector ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Amount input */}
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={kylrixSendAmount}
                            onChange={(e) => setKylrixSendAmount(e.target.value)}
                            placeholder={`0.00 ${selectedToken}`}
                            className="w-full bg-[#161412] border border-white/10 focus:border-white/30 rounded-xl text-white px-3.5 py-3 pr-16 outline-none font-mono text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => setKylrixSendAmount(tokenBalancesMap[selectedToken] || '0')}
                            className="absolute right-2 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white font-mono text-xs font-bold transition-colors cursor-pointer"
                        >
                            MAX
                        </button>
                    </div>

                    {kylrixIntentRecipient && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/70 font-satoshi flex items-center justify-between">
                            <span>Recipient:</span>
                            <span className="font-bold text-white font-mono">@{kylrixIntentRecipient.username}</span>
                        </div>
                    )}

                    <Button
                        onClick={handleKylrixSend}
                        disabled={!kylrixSendAmount || Number(kylrixSendAmount) <= 0}
                        fullWidth
                        variant="contained"
                        sx={{ bgcolor: ACCENT, color: 'black', borderRadius: '12px', fontWeight: 800, textTransform: 'none', py: 1.5, '&:hover': { bgcolor: '#eab308' } }}
                    >
                        {kylrixIntentRecipient ? 'Continue to Confirmation' : 'Select Recipient & Confirm MasterPass'}
                    </Button>
                </div>

                {/* Token Selector Drawer */}
                <Drawer
                    anchor="bottom"
                    open={showTokenSelector}
                    onClose={() => setShowTokenSelector(false)}
                    PaperProps={{
                        sx: {
                            bgcolor: SURFACE,
                            borderTop: `1px solid ${EDGE}`,
                            borderRadius: '32px 32px 0 0',
                            p: 3,
                            maxHeight: '50dvh',
                            zIndex: 1600
                        }
                    }}
                >
                    <Box sx={{ width: 40, height: 4, bgcolor: '#4A4743', borderRadius: '2px', alignSelf: 'center', mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 2 }}>
                        Select Asset to Send
                    </Typography>
                    <Stack gap={1.25} sx={{ overflowY: 'auto', pr: 0.5 }}>
                        {Object.keys(tokenBalancesMap).map((token) => (
                            <Box
                                key={token}
                                onClick={() => {
                                    setSelectedToken(token);
                                    setShowTokenSelector(false);
                                }}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: '14px',
                                    cursor: 'pointer',
                                    bgcolor: selectedToken === token ? HIGHLIGHT : '#161412',
                                    border: `1px solid ${EDGE}`,
                                    '&:hover': { bgcolor: HIGHLIGHT }
                                }}
                            >
                                <Stack direction="row" alignItems="center" gap={1.5}>
                                    <Box sx={{ width: 28, height: 28, borderRadius: '6px', bgcolor: '#252321', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '11px', color: getNetworkColor(token.toLowerCase() as any) || ACCENT }}>
                                        {token === 'KYLRIX' ? 'K' : getNetworkLogo(token.toLowerCase() as any) || token[0]}
                                    </Box>
                                    <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem' }}>{token}</Typography>
                                </Stack>
                                <Typography sx={{ color: MUTED, fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>{tokenBalancesMap[token]}</Typography>
                            </Box>
                        ))}
                    </Stack>
                </Drawer>
            </div>
        );
}
