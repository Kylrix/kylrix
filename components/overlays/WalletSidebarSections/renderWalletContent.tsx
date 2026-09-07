"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {

export function renderWalletContent(bag: any) {
  const {
  renderHistoryView,
  renderReceiveDrawer,
  renderReceiveView,
  renderSendView,
  renderWalletContent
  } = bag as any;

        const pinnedWallet = pinnedToken === 'KYLRIX' || pinnedToken === 'SOL'
            ? null 
            : orderedWallets.find((wallet) => wallet.chain === tokenToChain(pinnedToken)) || null;

        if (showSignConfirmation) {
            return (
                <WalletSignConfirmation
                    signDestination={signDestination}
                    signMessageText={signMessageText}
                    signConfirmLoading={signConfirmLoading}
                    onCancel={() => setShowSignConfirmation(false)}
                    onConfirm={handleConfirmSignature}
                />
            );
        }
        if (showSettings) {
            return (
                <WalletSettingsPanel
                    ktsMode={ktsMode}
                    setKtsModeState={setKtsModeState}
                    testnetMode={testnetMode}
                    handleToggleTestnet={handleToggleTestnet}
                    smartDelegation={smartDelegation}
                    handleToggleSmartDelegation={handleToggleSmartDelegation}
                    gasRelay={gasRelay}
                    handleToggleGasRelay={handleToggleGasRelay}
                    recurringBilling={recurringBilling}
                    handleToggleRecurringBilling={handleToggleRecurringBilling}
                    handleExportSecrets={handleExportSecrets}
                    exportedMnemonic={exportedMnemonic}
                    exportedPrivateKey={exportedPrivateKey}
                    setExportedMnemonic={setExportedMnemonic}
                    setExportedPrivateKey={setExportedPrivateKey}
                    setShowSettings={setShowSettings}
                    triggerTestSignature={triggerTestSignature}
                />
            );
        }
        return (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

                {!user ? (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3 }}>
                        <Typography variant="body2" sx={{ color: MUTED, maxWidth: 260, fontFamily: 'var(--font-satoshi)' }}>
                            Sign in to initialize your wallet mesh.
                        </Typography>
                    </Box>
                ) : hasMasterpass === false ? (
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        px: 3
                    }}>
                        <Box sx={{
                            width: 64,
                            height: 64,
                            borderRadius: '20px',
                            bgcolor: SURFACE,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 3,
                            border: `1px solid ${EDGE}`,
                            color: MUTED
                        }}>
                            <Lock size={32} />
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                            Vault Setup Required
                        </Typography>
                        <Typography variant="body2" sx={{ color: MUTED, mb: 4, maxWidth: 260, fontFamily: 'var(--font-satoshi)' }}>
                            Wallet provisioning becomes automatic once your MasterPass exists for Tier 3 encryption.
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => {
                                requestSudo({
                                    intent: 'initialize',
                                    onSuccess: async () => {
                                        await refreshWallets();
                                    }
                                });
                            }}
                            sx={{
                                bgcolor: 'white',
                                color: '#000',
                                fontWeight: 900,
                                borderRadius: '14px',
                                px: 4,
                                py: 1.5,
                                textTransform: 'none',
                                fontFamily: 'var(--font-satoshi)',
                                border: `1px solid ${EDGE}`,
                                '&:hover': { bgcolor: '#E4E4E7', transform: 'translateY(-1px)' },
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            Setup MasterPass
                        </Button>
                    </Box>
                ) : !isUnlocked ? (
                    <Box 
                        onClick={handleUnlock}
                        sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            px: 3,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            '&:hover': { opacity: 0.8 }
                        }}
                    >
                        <Box sx={{
                            position: 'relative',
                            width: 68,
                            height: 68,
                            borderRadius: '22px',
                            bgcolor: SURFACE,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 3,
                            border: `1px solid ${EDGE}`,
                            color: ACCENT
                        }}>
                            <Fingerprint size={34} strokeWidth={1.75} />
                            <Box sx={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                width: 22,
                                height: 22,
                                borderRadius: '8px',
                                bgcolor: '#1C1A18',
                                border: `1px solid ${EDGE}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                            }}>
                                <Lock size={11} />
                            </Box>
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                            Wallet is Locked
                        </Typography>
                        <Typography variant="body2" sx={{ color: MUTED, mb: 4, maxWidth: 240, fontFamily: 'var(--font-satoshi)' }}>
                            Click to unlock with your passkey or MasterPass to view balances and sign actions.
                        </Typography>
                    </Box>
                ) : loading ? (
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        px: 3
                    }}>
                        <CircularProgress sx={{ color: ACCENT, mb: 3 }} />
                        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                            Auto-Provisioning Wallets
                        </Typography>
                        <Typography variant="body2" sx={{ color: MUTED, maxWidth: 280, fontFamily: 'var(--font-satoshi)' }}>
                            {loadingLabel}
                        </Typography>
                    </Box>
                ) : error ? (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Paper sx={{
                            p: 3,
                            bgcolor: '#221111',
                            border: '1px solid #7f1d1d',
                            borderRadius: '16px',
                            textAlign: 'center',
                            maxWidth: 280
                        }}>
                            <Typography sx={{ color: '#ef4444', fontWeight: 800, mb: 1, fontSize: '0.88rem', fontFamily: 'var(--font-satoshi)' }}>
                                Provisioning Error
                            </Typography>
                            <Typography sx={{ color: '#fca5a5', fontSize: '0.78rem', mb: 3, lineHeight: 1.45, fontFamily: 'var(--font-satoshi)' }}>
                                {error}
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={() => void refreshWallets()}
                                sx={{
                                    borderColor: '#ef4444',
                                    color: '#fca5a5',
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontFamily: 'var(--font-satoshi)',
                                    '&:hover': { bgcolor: HIGHLIGHT, borderColor: '#4A4743' }
                                }}
                            >
                                Retry
                            </Button>
                        </Paper>
                    </Box>
                ) : activeSubView === 'send' ? (
                    renderSendView()
                ) : activeSubView === 'receive' ? (
                    renderReceiveView()
                ) : activeSubView === 'history' ? (
                    renderHistoryView()
                ) : activeSubView === 'settings' ? (
                    <WalletSettingsPanel
                        ktsMode={ktsMode}
                        setKtsModeState={setKtsModeState}
                        testnetMode={testnetMode}
                        handleToggleTestnet={(val) => {
                            setTestnetMode(val);
                            localStorage.setItem('kylrix_wallet_testnet_mode', val ? '1' : '0');
                        }}
                        smartDelegation={smartDelegation}
                        handleToggleSmartDelegation={(val) => {
                            setSmartDelegation(val);
                            localStorage.setItem('kylrix_wallet_smart_delegation', val ? '1' : '0');
                        }}
                        gasRelay={gasRelay}
                        handleToggleGasRelay={(val) => {
                            setGasRelay(val);
                            localStorage.setItem('kylrix_wallet_gas_relay', val ? '1' : '0');
                        }}
                        recurringBilling={recurringBilling}
                        handleToggleRecurringBilling={(val) => {
                            setRecurringBilling(val);
                            localStorage.setItem('kylrix_wallet_recurring_billing', val ? '1' : '0');
                        }}
                        exportedMnemonic={exportedMnemonic}
                        exportedPrivateKey={exportedPrivateKey}
                        setExportedMnemonic={setExportedMnemonic}
                        setExportedPrivateKey={setExportedPrivateKey}
                        handleExportSecrets={handleExportSecrets}
                        setShowSettings={(val) => { if (!val) setActiveSubView('dashboard'); }}
                        triggerTestSignature={() => {}}
                    />
                ) : (
                    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5 space-y-5">
                        {/* OpenBricks Modern Balance Card */}
                        <div className="p-5 rounded-2xl bg-[#161412] border border-white/[0.08] flex flex-col gap-4 shadow-sm">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-white/50 font-satoshi">
                                        {ktsMode ? 'Kylrix Ledger Balance' : 'Estimated Portfolio'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-[#0A0908] border border-white/[0.06] text-[10px] font-mono text-white/60">
                                        {ktsMode ? 'KTS Mode' : `${wallets.length} Networks`}
                                    </span>
                                </div>
                                <div className="text-3xl md:text-4xl font-extrabold font-clash text-white tracking-tight leading-normal py-1">
                                    {ktsMode ? (
                                        <div className="flex items-baseline gap-2">
                                            <span>{tokenBalance?.amount || '0'}</span>
                                            <span className="text-[#6366F1] font-mono text-2xl font-bold">{kylrixTicker(tokenBalance?.symbol)}</span>
                                        </div>
                                    ) : (
                                        <div>
                                            <div>$0.00</div>
                                            <div className="mt-2 flex items-center gap-2 text-sm font-mono font-medium text-white/60">
                                                <span>{tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}</span>
                                                <span className="text-[11px] text-white/40 font-satoshi px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.04]">Ledger</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tactile Action Grid */}
                            <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={() => setActiveSubView('send')}
                                    className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl bg-[#0A0908] border border-white/[0.06] hover:border-white/20 transition-all text-white active:scale-[0.98] cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#161412] border border-white/[0.04] flex items-center justify-center text-white/80">
                                        <ArrowUpRight size={16} />
                                    </div>
                                    <span className="text-xs font-bold font-satoshi">Send</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveSubView('receive')}
                                    className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl bg-[#0A0908] border border-white/[0.06] hover:border-white/20 transition-all text-white active:scale-[0.98] cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#161412] border border-white/[0.04] flex items-center justify-center text-white/80">
                                        <ArrowDownLeft size={16} />
                                    </div>
                                    <span className="text-xs font-bold font-satoshi">Receive</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        toast.success('Cross-chain swap router active soon');
                                    }}
                                    className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl bg-[#0A0908] border border-white/[0.06] hover:border-white/20 transition-all text-white/70 hover:text-white active:scale-[0.98] cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#161412] border border-white/[0.04] flex items-center justify-center text-white/60">
                                        <Plus size={16} />
                                    </div>
                                    <span className="text-xs font-bold font-satoshi">Swap</span>
                                </button>
                            </div>
                        </div>

                        {ktsMode ? (
                        <div className="space-y-2.5 mb-4">
                            <span className="text-[11px] font-extrabold text-[#6366F1] uppercase tracking-wider font-satoshi block">
                                Kylrix
                            </span>
                            <div className="p-4 rounded-2xl bg-[#161412] border border-[#6366F1]/30 hover:border-[#6366F1] transition-all">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0">
                                            <Logo app="root" variant="icon" size={22} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-extrabold text-white font-satoshi truncate">
                                                Kylrix
                                            </div>
                                            <div className="text-xs font-mono text-white/40 truncate">
                                                {user?.$id ? shortenUserId(user.$id) : '—'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                                        <div className="text-sm font-extrabold text-[#6366F1] font-mono whitespace-nowrap">
                                            {tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}
                                        </div>
                                        {user?.$id ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyAddress(user.$id)}
                                                    className="p-1 rounded text-white/40 hover:text-[#6366F1] transition-colors cursor-pointer"
                                                    aria-label="Copy Kylrix wallet id"
                                                >
                                                    <Copy size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveSubView('history')}
                                                    className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                    aria-label="Open Kylrix ledger"
                                                >
                                                    <PanelRight size={13} />
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-white/40 text-center leading-relaxed px-2 font-satoshi">
                                KTS mode shows your Kylrix ledger balance as the headline total. Turn off the toggle to expose Solana, ETH, and other networks.
                            </p>
                        </div>
                        ) : (
                        <>
                            {/* Pinned Solana + KYLRIX */}
                            <div className="space-y-3 mb-4">
                                <span className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider font-satoshi block">
                                    Pinned Networks
                                </span>
                                
                                {/* 1. Kylrix Card (Always Visible, Default Pinned) */}
                                <div
                                    onClick={() => setReceiveModalData({
                                        token: 'KYLRIX',
                                        chainName: 'Kylrix Ledger',
                                        address: user?.$id || '',
                                        color: '#6366F1'
                                    })}
                                    onMouseDown={() => handlePressStart('KYLRIX')}
                                    onMouseUp={handlePressEnd}
                                    onMouseLeave={handlePressEnd}
                                    onTouchStart={() => handlePressStart('KYLRIX')}
                                    onTouchEnd={handlePressEnd}
                                    className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0">
                                            <Logo app="root" variant="icon" size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-2">
                                            <span className="font-extrabold text-white font-satoshi text-sm leading-tight truncate">
                                                Kylrix
                                            </span>
                                            <span className="text-xs text-white/40 font-mono leading-tight truncate">
                                                {user?.$id ? shortenUserId(user.$id) : '—'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
                                            <span className="font-extrabold text-[#6366F1] font-mono text-xs leading-tight whitespace-nowrap">
                                                {tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}
                                            </span>
                                            {user?.$id ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleCopyAddress(user.$id); }}
                                                        className="p-1 rounded text-white/40 hover:text-[#6366F1] transition-colors cursor-pointer"
                                                        aria-label="Copy Kylrix wallet id"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setActiveSubView('history'); }}
                                                        className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                        aria-label="Open Kylrix ledger"
                                                    >
                                                        <PanelRight size={13} />
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Solana Card (Always Visible, Default Pinned) */}
                                <div
                                    onClick={() => {
                                        if (solWallet) {
                                            setReceiveModalData({
                                                token: 'SOL',
                                                chainName: 'Solana Network',
                                                address: solWallet.address,
                                                color: '#14F195'
                                            });
                                        }
                                    }}
                                    onMouseDown={() => handlePressStart('SOL')}
                                    onMouseUp={handlePressEnd}
                                    onMouseLeave={handlePressEnd}
                                    onTouchStart={() => handlePressStart('SOL')}
                                    onTouchEnd={handlePressEnd}
                                    className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0">
                                            <PinnedNetworkIconSolana size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-2">
                                            <span className="font-extrabold text-white font-satoshi text-sm leading-tight truncate">
                                                {solWallet?.label || 'Solana'}
                                            </span>
                                            <span className="text-xs text-white/40 font-mono leading-tight truncate">
                                                {solWallet ? shortenAddress(solWallet.address) : 'Auto-provisioning'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
                                            <span className="font-extrabold text-[#14F195] font-mono text-xs leading-tight whitespace-nowrap">
                                                {onChainBalances['SOL'] || '0.00'} SOL
                                            </span>
                                            {solWallet ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleCopyAddress(solWallet.address); }}
                                                        className="p-1 rounded text-white/40 hover:text-[#14F195] transition-colors cursor-pointer"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const explorerUrl = getExplorerUrl(solWallet);
                                                            if (explorerUrl) {
                                                                window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                                                            }
                                                        }}
                                                        className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleAddNetwork('sol'); }}
                                                    disabled={pendingChain !== null}
                                                    className="px-2.5 py-1 rounded-lg border border-white/10 hover:border-white/25 bg-[#0A0908] text-white font-satoshi text-xs font-semibold transition-all cursor-pointer"
                                                >
                                                    Add SOL
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Custom Pinned Card (Rendered if pinnedToken is not KYLRIX and not SOL) */}
                                {pinnedToken !== 'KYLRIX' && pinnedToken !== 'SOL' && (
                                    <div
                                        onClick={() => {
                                            if (pinnedWallet) {
                                                setReceiveModalData({
                                                    token: pinnedToken,
                                                    chainName: pinnedWallet.label,
                                                    address: pinnedWallet.address,
                                                    color: getNetworkColor(tokenToChain(pinnedToken)) || ACCENT
                                                });
                                            }
                                        }}
                                        onMouseDown={() => handlePressStart(pinnedToken)}
                                        onMouseUp={handlePressEnd}
                                        onMouseLeave={handlePressEnd}
                                        onTouchStart={() => handlePressStart(pinnedToken)}
                                        onTouchEnd={handlePressEnd}
                                        className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <div
                                                className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0 font-extrabold text-sm"
                                                style={{ color: getNetworkColor(tokenToChain(pinnedToken)) || ACCENT }}
                                            >
                                                {getNetworkLogo(tokenToChain(pinnedToken)) || pinnedToken[0]}
                                            </div>
                                            <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-2">
                                                <span className="font-extrabold text-white font-satoshi text-sm leading-tight truncate">
                                                    {pinnedWallet?.label || pinnedToken}
                                                </span>
                                                <span className="text-xs text-white/40 font-mono leading-tight truncate">
                                                    {pinnedWallet ? shortenAddress(pinnedWallet.address) : 'Provisioning required'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
                                                <span
                                                    className="font-extrabold font-mono text-xs leading-tight whitespace-nowrap"
                                                    style={{ color: getNetworkColor(tokenToChain(pinnedToken)) || 'white' }}
                                                >
                                                    {onChainBalances[pinnedToken.toUpperCase()] || '0.00'} {pinnedToken}
                                                </span>
                                                {pinnedWallet ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleCopyAddress(pinnedWallet.address); }}
                                                            className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                        >
                                                            <Copy size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const explorerUrl = getExplorerUrl(pinnedWallet);
                                                                if (explorerUrl) {
                                                                    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                                                                }
                                                            }}
                                                            className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                        >
                                                            <ExternalLink size={13} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleAddNetwork(tokenToChain(pinnedToken)); }}
                                                        disabled={pendingChain !== null}
                                                        className="px-2.5 py-1 rounded-lg border border-white/10 hover:border-white/25 bg-[#0A0908] text-white font-satoshi text-xs font-semibold transition-all cursor-pointer"
                                                    >
                                                        Add {pinnedToken}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        {/* Other Live Networks */}
                        {orderedWallets.filter(w => w.chain !== 'sol').length > 0 && (
                            <div className="space-y-3 mb-4">
                                <span className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider font-satoshi block">
                                    Live Networks
                                </span>
                                {orderedWallets.filter(w => w.chain !== 'sol').map((wallet) => (
                                    <div
                                        key={wallet.chain}
                                        onClick={() => setReceiveModalData({
                                            token: wallet.symbol,
                                            chainName: wallet.label,
                                            address: wallet.address,
                                            color: getNetworkColor(wallet.chain) || ACCENT
                                        })}
                                        onMouseDown={() => handlePressStart(wallet.symbol)}
                                        onMouseUp={handlePressEnd}
                                        onMouseLeave={handlePressEnd}
                                        onTouchStart={() => handlePressStart(wallet.symbol)}
                                        onTouchEnd={handlePressEnd}
                                        className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <div
                                                className="w-9 h-9 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0 font-extrabold text-sm"
                                                style={{ color: getNetworkColor(wallet.chain) }}
                                            >
                                                {getNetworkLogo(wallet.chain)}
                                            </div>
                                            <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-2">
                                                <span className="font-extrabold text-white font-satoshi text-sm leading-tight truncate">
                                                    {wallet.label}
                                                </span>
                                                <span className="text-xs text-white/40 font-mono leading-tight truncate">
                                                    {shortenAddress(wallet.address)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
                                                <span
                                                    className="font-extrabold font-mono text-xs leading-tight whitespace-nowrap"
                                                    style={{ color: getNetworkColor(wallet.chain) }}
                                                >
                                                    {onChainBalances[wallet.chain.toUpperCase()] || '0.00'} {wallet.symbol}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleCopyAddress(wallet.address); }}
                                                        className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const explorerUrl = getExplorerUrl(wallet);
                                                            if (explorerUrl) {
                                                                window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                                                            }
                                                        }}
                                                        className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {addableNetworks.length > 0 && (
                            <div className="space-y-3 mb-6">
                                <span className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider font-satoshi block">
                                    Add Network
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {addableNetworks.map((chain) => (
                                        <button
                                            key={chain}
                                            type="button"
                                            onClick={() => handleAddNetwork(chain)}
                                            disabled={pendingChain !== null}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/25 bg-[#161412] text-white/80 hover:text-white font-satoshi text-xs font-bold transition-all cursor-pointer"
                                        >
                                            {pendingChain === chain ? (
                                                <CircularProgress size={13} color="inherit" />
                                            ) : (
                                                <Plus size={13} />
                                            )}
                                            <span>{WalletService.networkDefinitions[chain].label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        </>
                        )}
                    </div>
                )}


            </Box>
        );
}
