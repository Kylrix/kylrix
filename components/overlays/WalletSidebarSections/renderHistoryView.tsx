"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {

export function renderHistoryView(bag: any) {
  const {
  renderHistoryView,
  renderReceiveDrawer,
  renderReceiveView,
  renderSendView,
  renderWalletContent
  } = bag as any;

        return (
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-base font-extrabold font-clash text-white tracking-tight">
                        Ledger Activity
                    </div>
                    <Button
                        size="small"
                        onClick={() => void loadLedgerHistory()}
                        disabled={ledgerHistoryLoading}
                        sx={{ color: ACCENT, textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', minWidth: 0 }}
                    >
                        Refresh
                    </Button>
                </div>

                {ledgerHistoryLoading && (
                    <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress size={28} sx={{ color: ACCENT }} />
                    </Box>
                )}

                {ledgerHistoryError && (
                    <Typography sx={{ color: '#fca5a5', fontSize: '0.8rem', mb: 1 }}>
                        {ledgerHistoryError}
                    </Typography>
                )}

                {!ledgerHistoryLoading && !ledgerHistoryError && sortedLedgerHistory.length === 0 && (
                    <Paper sx={{ p: 3, borderRadius: '16px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}` }}>
                        <Typography sx={{ color: MUTED, fontSize: '0.82rem', lineHeight: 1.45 }}>
                            No ledger movements recorded for this session yet.
                        </Typography>
                    </Paper>
                )}

                <Stack gap={1.5} sx={{ mt: 1 }}>
                    {!ledgerHistoryLoading && sortedLedgerHistory.map((row, index) => {
                        const deltaStr = formatLedgerDelta(row.deltaMicro);
                        let deltaColor = '#4ade80';
                        let isReceive = true;
                        try {
                            const n = BigInt(String(row.deltaMicro ?? '0'));
                            if (n < 0n) {
                                deltaColor = '#f87171';
                                isReceive = false;
                            } else if (n === 0n) {
                                deltaColor = MUTED;
                            }
                        } catch {
                            deltaColor = MUTED;
                        }
                        const after = formatLedgerBalanceAfter(row.balanceAfterMicro);
                        const status = String(row.status || '').toLowerCase();
                        return (
                            <Box
                                key={ledgerRowKey(row, index)}
                                sx={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.75,
                                    px: 2.25,
                                    py: 1.5,
                                    borderRadius: '18px',
                                    bgcolor: '#161412',
                                    border: `1px solid ${EDGE}`
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: '12px',
                                        display: 'grid',
                                        placeItems: 'center',
                                        flexShrink: 0,
                                        bgcolor: isReceive ? 'rgba(21, 128, 61, 0.15)' : 'rgba(185, 28, 28, 0.15)',
                                        border: `1px solid ${isReceive ? '#15803d' : '#b91c1c'}`,
                                        color: isReceive ? '#4ade80' : '#f87171'
                                    }}
                                >
                                    {isReceive ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                </Box>
                                <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35, pr: 0.5 }}>
                                    <Typography component="span" sx={{ fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.25, color: 'white' }} noWrap>
                                        {describeLedgerRow(row)}
                                    </Typography>
                                    <Typography component="span" sx={{ color: MUTED, fontWeight: 600, fontSize: '0.74rem', lineHeight: 1.35 }}>
                                        {formatLedgerWhen(row)} {after ? `· after: ${after} ${kylrixTicker(tokenBalance?.symbol)}` : ''}
                                    </Typography>
                                </Box>
                                <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.35 }}>
                                    <Typography component="span" sx={{ color: deltaColor, fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.25 }}>
                                        {deltaStr}
                                    </Typography>
                                    {status === 'pending' && (
                                        <Typography component="span" sx={{ color: '#FBBF24', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }}>
                                            Pending
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            </div>
        );
}
