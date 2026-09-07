'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { motion } from 'framer-motion';
import { 
import { handleManualMint as handleManualMint_ext } from './SettingsPageInnerSections/handleManualMint';



export function SettingsPageInnerView(bag: any) {
  const {
    FEATURE_FORM_ID,
    _confirmDeleteOpen,
    _confirmExportOpen,
    _demoModeEnabled,
    _hasMasterpass,
    _isAuthPassConfigured,
    _isLocalhost,
    _masterpassChangedAt,
    _nativeSidebar,
    _profileAvatarUrl,
    _pushEnabled,
    _setConfirmDeleteOpen,
    _setConfirmExportOpen,
    _setPushEnabled,
    _setStatusEnabled,
    _statusEnabled,
    accountMfaEnabled,
    active,
    activeTab,
    adminSubTab,
    allowed,
    appPrefs,
    bag,
    balance,
    baseUri,
    billingDrawerOpen,
    cached,
    checkAdmin,
    checkTg,
    close,
    computeBalance,
    copiedReferral,
    data,
    dataStr,
    downloadAnchor,
    effUsername,
    el,
    entries,
    exportData,
    factors,
    fetchAvatar,
    fetchCompute,
    fetchProfile,
    handleBack,
    handleCopyReferral,
    handleExport,
    handleManualMint,
    handleRemovePasskey,
    hasHistory,
    hash,
    isAdmin,
    isArgon,
    isDesktop,
    isEditModalOpen,
    isPro,
    isUnlocked,
    jwt,
    link,
    loadPasskeys,
    loadingPasskeys,
    mfaFactors,
    minting,
    mounted,
    node,
    openPorter,
    openTwoFactorSurface,
    originalBorder,
    panel,
    passkeyEntries,
    passkeySetupOpen,
    passwordEntry,
    pkEntries,
    profile,
    profilePicId,
    refParam,
    referralStats,
    referrer,
    refreshMfaFactors,
    res,
    result,
    router,
    sameOriginReferrer,
    scrollToHash,
    searchParams,
    section,
    sessions,
    setAccountMfaEnabled,
    setActiveTab,
    setAdminSubTab,
    setBillingDrawerOpen,
    setComputeBalance,
    setCopiedReferral,
    setDemoModeEnabled,
    setHasMasterpass,
    setIsAdmin,
    setIsArgon,
    setIsAuthPassConfigured,
    setIsEditModalOpen,
    setIsLocalhost,
    setIsUnlocked,
    setLoadingPasskeys,
    setMasterpassChangedAt,
    setMfaFactors,
    setMinting,
    setPasskeyEntries,
    setPasskeySetupOpen,
    setProfile,
    setProfileAvatarUrl,
    setReferralStats,
    setTelegramConnected,
    setTgDrawerOpen,
    shouldScroll,
    tab,
    tabsList,
    telegramConnected,
    tgDrawerOpen,
    timer,
    triggerDeleteAccount,
    triggerExport,
    unlocked,
    unsubscribe,
    url,
    username
  } = bag as any;
  return (
        <MultiSectionContainer>
            <div className="relative w-full max-w-full mx-auto pt-4 md:pt-6 pb-12 px-3 md:px-4 z-10 select-none transition-all duration-300 overflow-x-hidden">

            {/* Back Button */}
            <button
                onClick={handleBack}
                className="mb-6 h-9 px-4 rounded-xl border-2 border-white/20 hover:border-white/40 bg-[#000000] hover:bg-[#161412] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all select-none"
            >
                <ArrowLeft size={16} />
                <span>Back</span>
            </button>

            {/* Header Title Section / Compact Account Summary */}
            <header 
                onClick={() => {
                    const username = getEffectiveUsername(user);
                    if (username) router.push(`/u/${username}`);
                }}
                className="mb-6 p-5 sm:p-6 bg-[#000000] border-2 border-white/20 rounded-[24px] shadow-2xl overflow-hidden relative group cursor-pointer hover:border-white/40 transition-all"
            >
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#6366F1]/10 rounded-full pointer-events-none" />
                
                <div className={`flex flex-col gap-6 items-center relative z-10 ${isRightRailPushing ? 'xl:flex-row' : 'md:flex-row'}`}>
                    {/* Profile */}
                    <div className="flex-shrink-0">
                        <IdentityAvatar 
                            userId={user?.$id}
                            pro={isPro}
                            size={56}
                            fallback={getEffectiveDisplayName(user).slice(0, 1).toUpperCase()}
                        />
                    </div>

                    {/* Account Info */}
                    <div className="flex-1 min-w-0 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-white font-black text-xl tracking-tight leading-tight font-mono truncate">
                                {getEffectiveDisplayName(user)}
                            </h1>
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                                <span className="text-[10px] font-black text-[#EC4899] uppercase tracking-wider">
                                    {currentTier} PLAN
                                </span>
                                {isPro && expiresAt && (
                                    <span className="text-[10px] font-bold text-white/50 uppercase font-mono">
                                        • Ends {new Date(expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditModalOpen(true);
                            }}
                            className="py-2.5 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 border-2 border-[#6366F1] shadow-[0_0_12px_rgba(99,102,241,0.35)] select-none w-full md:w-auto cursor-pointer"
                        >
                            <Edit3 size={14} />
                            <span>Edit Profile</span>
                        </button>
                    </div>

                    {/* AI Compute Section (Usage 0-100%) */}
                    <div className={`w-full flex flex-col gap-2 ${isRightRailPushing ? 'xl:w-[220px]' : 'md:w-[220px]'}`}>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black text-white/50 tracking-widest uppercase font-mono">
                                AI Compute Usage
                            </span>
                            <span className="text-sm font-black font-mono text-white">
                                {computeBalance ? Math.round(100 - computeBalance.percent) : '0'}%
                            </span>
                        </div>
                        
                        <div className="h-2.5 w-full bg-[#161412] rounded-full overflow-hidden border-2 border-white/20">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${100 - (computeBalance?.percent ?? 100)}%` }}
                                transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                                className="h-full bg-gradient-to-r from-[#6366F1] to-[#EC4899] relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shine" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Desktop: fluid canvas — vertical nav + content; Mobile: horizontal pills */}
            <div className={`grid grid-cols-1 gap-6 items-start ${isRightRailPushing ? 'xl:grid-cols-[220px_1fr] xl:gap-6' : 'lg:grid-cols-[240px_1fr] lg:gap-8'} min-w-0 w-full`}>
                {/* Desktop vertical nav — hidden on mobile, sticky, aware of right rail */}
                <aside className={`${isRightRailPushing ? 'hidden xl:block' : 'hidden lg:block'} sticky top-[96px] self-start z-10 min-w-0`}>
                    <nav className="flex flex-col gap-1.5 p-2 bg-[#000000] border-2 border-white/20 rounded-2xl shadow-xl">
                        {tabsList.map((t) => {
                            const Icon = t.icon;
                            const isActive = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setActiveTab(t.id as any)}
                                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left w-full cursor-pointer ${
                                        isActive
                                            ? 'bg-[#6366F1] text-white border-2 border-[#6366F1] shadow-[0_0_12px_rgba(99,102,241,0.35)]'
                                            : 'text-white/70 hover:text-white hover:bg-white/[0.06] border-2 border-transparent hover:border-white/20'
                                    }`}
                                >
                                    <Icon size={16} className={isActive ? 'text-white' : 'text-white/60'} />
                                    <span className="truncate">{t.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                    <div className="mt-4 p-3 bg-[#000000] border-2 border-white/20 rounded-xl shadow-md">
                        <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Tip</p>
                        <p className="text-xs text-white/70 leading-relaxed mt-1">Right sidebar pushes this layout — no overlay. Resize to see fluid reflow.</p>
                    </div>
                </aside>

                {/* Mobile horizontal tabs — visible below aside breakpoint */}
                <div className={`${isRightRailPushing ? 'xl:hidden' : 'lg:hidden'} col-span-1 -mx-3 md:-mx-4 px-3 md:px-4 flex gap-2 overflow-x-auto pb-3 border-b-2 border-white/20 scrollbar-none select-none snap-x snap-mandatory`}>
                    {tabsList.map((t) => {
                        const Icon = t.icon;
                        const isActive = activeTab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setActiveTab(t.id as any)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer snap-start ${
                                    isActive 
                                        ? 'bg-[#6366F1] text-white border-2 border-[#6366F1] shadow-[0_0_12px_rgba(99,102,241,0.35)]' 
                                        : 'bg-[#000000] hover:bg-[#161412] text-white/70 border-2 border-white/20 hover:border-white/40'
                                }`}
                            >
                                <Icon size={14} />
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content — fluid, right-rail aware */}
                <div className="w-full relative min-h-[400px] min-w-0 overflow-x-hidden col-span-1 lg:col-span-1">
                {activeTab === 'agents' && (
                    <AgentsSettingsTab />
                )}

                {activeTab === 'workspace' && (
                    <WorkspaceTab onGoToDevelopers={() => setActiveTab('developers')} />
                )}

                {activeTab === 'general' && (
                    <div className={`grid gap-8 items-start ${isRightRailPushing ? 'grid-cols-1 xl:grid-cols-[1.1fr_1fr]' : 'grid-cols-1 md:grid-cols-[1.1fr_1fr]'}`}>
                        {/* Left Column: Discoverability, Integrations & Feedback */}
                        <div className="flex flex-col gap-8">
                            {/* Referral Program */}
                            <div className="p-5 md:p-6 bg-[#000000] border-2 border-white/20 rounded-[22px] shadow-2xl flex flex-col gap-4 max-w-full overflow-hidden">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 border-2 border-[#6366F1]/30 text-[#818CF8] flex items-center justify-center shrink-0">
                                            <Users size={18} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                 <h4 className="text-white font-bold text-sm md:text-base font-clash m-0 truncate">
                                                     Referral & Growth
                                                 </h4>
                                                 <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                                                     +1.5 $KYL / invite
                                                 </span>
                                             </div>
                                             <p className="text-white/60 text-xs font-medium mt-0.5 m-0 line-clamp-2 sm:line-clamp-none">
                                                 Earn 1.5 $KYL for each user who joins with your link, plus 0.5 $KYL for 30-day activity.
                                             </p>
                                         </div>
                                    </div>

                                    {/* Inset Metric Badges */}
                                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                                        <div className="bg-[#161412] border-2 border-white/20 rounded-xl px-3 py-1.5 flex flex-col items-center justify-center min-w-[70px]">
                                            <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest font-mono">Referred</span>
                                            <span className="text-white font-black text-xs font-mono">{referralStats?.totalReferred ?? 0}</span>
                                        </div>
                                        <div className="bg-[#161412] border-2 border-emerald-500/30 rounded-xl px-3 py-1.5 flex flex-col items-center justify-center min-w-[85px]">
                                            <span className="text-[9px] font-bold text-emerald-400/80 uppercase tracking-widest font-mono">Earned</span>
                                            <span className="text-emerald-400 font-black text-xs font-mono">+{referralStats?.totalTokensEarned ?? '0.0'} $KYL</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Shareable Link Box */}
                                <div className="flex items-center gap-2 bg-[#161412] p-1.5 pl-3 rounded-xl border-2 border-white/20 max-w-full min-w-0">
                                    <input 
                                        type="text"
                                        readOnly
                                        value={typeof window !== 'undefined' ? `${window.location.origin}/?ref=${getEffectiveUsername(user) ? `u_${getEffectiveUsername(user)}` : `id_${user?.$id || ''}`}` : ''}
                                        className="flex-1 bg-transparent text-xs font-mono text-[#818CF8] border-none outline-none truncate min-w-0 select-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCopyReferral}
                                        className="h-8 px-3.5 rounded-lg bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs flex items-center gap-1.5 transition-all select-none shrink-0 cursor-pointer shadow-md"
                                    >
                                        {copiedReferral ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                                        <span>{copiedReferral ? 'Copied' : 'Copy Link'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Daily Token Mint */}
                            <div className="p-6 bg-[#000000] border-2 border-white/20 rounded-[28px] shadow-2xl flex flex-col gap-3">
                                <h4 className="text-white font-black text-base font-mono">Daily Token Mint</h4>
                                <p className="text-white/60 text-xs font-semibold leading-relaxed">
                                    Manually trigger your daily token minting reward.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleManualMint}
                                    disabled={minting}
                                    className="h-11 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all select-none disabled:opacity-40 w-fit cursor-pointer border-2 border-[#6366F1]"
                                >
                                    {minting ? <SpinnerIcon className="animate-spin text-white" size={16} /> : <RefreshCw size={16} />}
                                    <span>{minting ? 'Minting...' : 'Mint Daily Tokens'}</span>
                                </button>
                            </div>

                            {/* Feature Requests Section */}
                            <div>
                                <h3 className="text-white font-black text-lg tracking-tight leading-tight flex items-center gap-2 mb-3 font-mono">
                                    <Lightbulb size={20} className="text-[#6366F1]" />
                                    <span>Feedback & Intelligence</span>
                                </h3>
                                <div className="p-6 bg-[#000000] border-2 border-white/20 rounded-[28px] shadow-2xl hover:border-white/40 transition-all duration-300">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div className="min-w-0">
                                            <h4 className="text-white font-extrabold text-sm truncate">
                                                Feature Request & Bug Report
                                            </h4>
                                            <p className="text-white/60 text-xs font-semibold font-sans mt-0.5 leading-relaxed">
                                                Help us improve the Kylrix ecosystem by reporting issues or suggesting new features.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openDrawer('form', { formId: FEATURE_FORM_ID })}
                                            className="h-10 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-extrabold text-xs flex items-center justify-center transition-all w-full md:w-auto cursor-pointer border-2 border-[#6366F1]"
                                        >
                                            Open Portal
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="flex flex-col gap-8">
                            {/* Smart Assistants */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('agents')}
                                className="w-full text-left p-6 bg-[#000000] border-2 border-white/20 hover:border-white/40 rounded-[28px] shadow-2xl flex items-center justify-between gap-4 transition-all duration-300 group cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-[#6366F1]/10 text-[#6366F1] border-2 border-[#6366F1]/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                        <Bot size={22} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-white font-black text-base leading-tight font-mono">
                                            Smart Assistants
                                        </h4>
                                        <p className="text-white/60 text-xs font-semibold mt-0.5 leading-relaxed">
                                            Configure private AI keys, automated assistant systems, and active workspaces.
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-white/40 group-hover:text-white transition-colors" />
                            </button>

                            {/* Trash Management Card */}
                            <button
                                type="button"
                                onClick={() => openDrawer('trash')}
                                className="w-full text-left p-6 bg-[#000000] border-2 border-white/20 hover:border-white/40 rounded-[28px] shadow-2xl flex items-center justify-between gap-4 transition-all duration-300 group cursor-pointer"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-[#EF4444]/10 text-[#EF4444] border-2 border-[#EF4444]/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                        <Trash2 size={22} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-white font-black text-base leading-tight font-mono">
                                            Trash bin
                                        </h4>
                                        <p className="text-white/60 text-xs font-semibold mt-0.5 leading-relaxed">
                                            Review and manage recently soft-deleted notes, credentials, tags, forms, events, and tasks.
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-white/40 group-hover:text-white transition-colors" />
                            </button>

                            {/* Telegram panel */}
                            <div className="p-6 bg-[#000000] border-2 border-white/20 rounded-[28px] shadow-2xl flex flex-col gap-5">
                                <div className="flex items-center justify-between border-b-2 border-white/10 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/30 flex items-center justify-center">
                                            <TelegramIcon />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-sm text-white">Telegram Notifications</h4>
                                            <p className="text-[10px] text-white/50 font-bold">Push notifications outlet</p>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                        telegramConnected 
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                            : 'bg-white/5 border-white/10 text-white/40'
                                    }`}>
                                        {telegramConnected ? 'active' : 'off'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTgDrawerOpen(true)}
                                    className="py-3 px-5 rounded-xl border-2 border-white/20 text-white hover:text-white font-extrabold text-xs hover:border-white/40 transition-all text-center w-full bg-transparent cursor-pointer"
                                >
                                    {telegramConnected ? 'Manage Link' : 'Link Telegram Bot'}
                                </button>
                            </div>

                            {/* Primary Account Email Card */}
                            <div className="p-6 bg-[#000000] border-2 border-white/20 rounded-[28px] shadow-2xl flex flex-col gap-3">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div>
                                        <span className="text-[10px] text-white/50 font-bold font-mono uppercase tracking-wider block mb-1">
                                            Primary Mail Relay
                                        </span>
                                        <span className="text-sm md:text-base text-white font-extrabold font-mono tracking-tight break-all">
                                            {user?.email || 'No email attached'}
                                        </span>
                                    </div>
                                    {user?.email && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(String(user.email));
                                                toast.success('Email copied');
                                            }}
                                            className="py-2 px-4 rounded-xl border-2 border-white/20 text-white font-bold text-xs hover:border-[#6366F1] hover:bg-[#6366F1]/10 transition-all cursor-pointer flex-shrink-0"
                                        >
                                            Copy Email
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'billing' && (
                    <div className="pb-24 max-w-3xl">
                        <BillingContent />
                    </div>
                )}

                {activeTab === 'security' && (
                    <SecurityTab
                        isUnlocked={isUnlocked}
                        hasMasterpass={_hasMasterpass}
                        isArgon={isArgon}
                        isAuthPassConfigured={_isAuthPassConfigured}
                        masterpassChangedAt={_masterpassChangedAt}
                        onLockVault={() => {
                            ecosystemSecurity.lock();
                            setIsUnlocked(false);
                            toast.success('Vault locked successfully');
                        }}
                        onUnlockVault={() => {
                            requestSudo({
                                intent: 'unlock',
                                forcePrompt: true,
                                onSuccess: () => {
                                    setIsUnlocked(true);
                                    toast.success('Vault unlocked successfully');
                                }
                            });
                        }}
                        onSetupVault={() => {
                            requestSudo({
                                intent: 'initialize',
                                onSuccess: () => {
                                    // Refresh masterpass state
                                    if (user?.$id) {
                                        KeychainService.listKeychainEntries(user.$id).then(entries => {
                                            const pe = entries.find((e: any) => e.type === 'password');
                                            setHasMasterpass(!!pe);
                                            setIsAuthPassConfigured(!!pe?.authPass);
                                            setMasterpassChangedAt(pe?.$updatedAt || pe?.$createdAt || null);
                                        }).catch(() => {});
                                    }
                                    // Prompt passkey setup after masterpass is configured
                                    setTimeout(() => {
                                        toast((t) => (
                                            <span className="flex items-center gap-2 text-sm">
                                                Vault set up! Add a passkey as a backup unlock method?
                                                <button
                                                    className="ml-2 px-2 py-1 rounded bg-[#6366F1] text-white text-xs font-bold"
                                                    onClick={() => { toast.dismiss(t.id); setPasskeySetupOpen(true); }}
                                                >
                                                    Set up passkey
                                                </button>
                                            </span>
                                        ), { duration: 8000 });
                                    }, 600);
                                }
                            });
                        }}
                        onManageVault={() => {
                            if (isUnlocked) {
                                if (!isArgon) {
                                    requestSudo({
                                        intent: 'upgrade',
                                        forcePrompt: true,
                                        onSuccess: () => {
                                            setIsArgon(true);
                                            toast.success('Vault upgraded to T5 Argon2id');
                                        }
                                    });
                                } else {
                                    requestSudo({
                                        intent: 'change-masterpass',
                                        forcePrompt: true,
                                        onSuccess: () => {
                                            if (user?.$id) {
                                                KeychainService.listKeychainEntries(user.$id).then((entries: any[]) => {
                                                    const pe = entries.find((e: any) => e.type === 'password');
                                                    setMasterpassChangedAt(pe?.$updatedAt || pe?.$createdAt || null);
                                                }).catch(() => {});
                                            }
                                            toast.success('Master password updated');
                                        }
                                    });
                                }
                            } else {
                                requestSudo({
                                    intent: 'unlock',
                                    forcePrompt: true,
                                    onSuccess: () => {
                                        setIsUnlocked(true);
                                        toast.success('Vault unlocked');
                                    }
                                });
                            }
                        }}
                        onChangeMasterpass={() => {
                            requestSudo({
                                intent: 'change-masterpass',
                                forcePrompt: true,
                                onSuccess: () => {
                                    if (user?.$id) {
                                        KeychainService.listKeychainEntries(user.$id).then((entries: any[]) => {
                                            const pe = entries.find((e: any) => e.type === 'password');
                                            setMasterpassChangedAt(pe?.$updatedAt || pe?.$createdAt || null);
                                        }).catch(() => {});
                                    }
                                    toast.success('Master password updated');
                                }
                            });
                        }}
                        onResetVault={() => {
                            requestSudo({
                                intent: 'reset',
                                forcePrompt: true,
                                onSuccess: () => {
                                    setHasMasterpass(false);
                                    setIsUnlocked(false);
                                    toast.success('Vault reset complete');
                                }
                            });
                        }}
                        loadingPasskeys={loadingPasskeys}
                        passkeyEntries={passkeyEntries}
                        onAddPasskey={() => setPasskeySetupOpen(true)}
                        onRemovePasskey={handleRemovePasskey}
                        accountMfaEnabled={accountMfaEnabled}
                        mfaFactors={mfaFactors}
                        onManageMfa={openTwoFactorSurface}
                    />
                )}

                {activeTab === 'privacy' && (
                    <div className="pb-24 max-w-3xl">
                        <PrivacyTab />
                    </div>
                )}

                {activeTab === 'developers' && <DevelopersTab />}

                {activeTab === 'sessions' && (
                    <div id="active-sessions" className="space-y-4 pb-24 max-w-3xl">
                        <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
                            Sessions
                        </h2>
                        <div className="bg-[#000000] border-2 border-white/20 rounded-[28px] p-6 md:p-8 shadow-2xl">
                            <SessionsManager />
                        </div>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div id="activity-log" className="space-y-4 pb-24 max-w-3xl">
                        <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
                            Activity
                        </h2>
                        <div className="bg-[#000000] border-2 border-white/20 rounded-[28px] p-6 md:p-8 shadow-2xl">
                            <ActivityLogs />
                        </div>
                    </div>
                )}

                {activeTab === 'identities' && (
                    <div id="oauth" className="pb-24 max-w-3xl space-y-4">
                        <h2 className="text-xl font-black font-clash text-white tracking-tight">
                            Connected Apps
                        </h2>
                        <ConnectedIdentities />
                    </div>
                )}

                {activeTab === 'preferences' && (
                    <div id="env-prefs" className="space-y-4 pb-24 max-w-3xl">
                        <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
                            Preferences
                        </h2>
                        <div className="bg-[#000000] border-2 border-white/20 rounded-[28px] p-6 md:p-8 shadow-2xl">
                            <PreferencesManager />
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div id="root-mgmt" className="space-y-6 pb-24 max-w-3xl select-none">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40 m-0">
                                Sovereignty & Lifecycle
                            </p>
                            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize mt-0.5">
                                Account Management
                            </h2>
                        </div>

                        {/* Export & Data Sovereignty Card */}
                        <div className="p-6 md:p-7 bg-[#000000] border-2 border-white/20 rounded-[28px] shadow-2xl space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center shrink-0 border-2 border-[#6366F1]/30">
                                    <Download size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-black text-white font-clash m-0">
                                            Export Sovereign Account Archive
                                        </h3>
                                        <span className="px-2 py-0.5 rounded bg-white/5 border-2 border-white/15 text-[9px] font-mono text-white/60 font-bold uppercase">
                                            JSON
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/50 leading-relaxed font-medium mt-1 m-0">
                                        Download a complete, offline snapshot of your public identity, app preferences, and active authentication session records. Client-side encrypted secrets remain protected under your local master key.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-[#161412] border-2 border-white/15">
                                <div className="p-2.5 rounded-xl bg-[#000000] border-2 border-white/10">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 font-bold block">
                                        Portability
                                    </span>
                                    <span className="text-xs font-mono text-white font-bold block mt-0.5">
                                        100% Sovereign
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-[#000000] border-2 border-white/10">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 font-bold block">
                                        Encryption
                                    </span>
                                    <span className="text-xs font-mono text-emerald-400 font-bold block mt-0.5">
                                        Client Sealed
                                    </span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-[#000000] border-2 border-white/10">
                                    <span className="text-[9px] font-mono uppercase tracking-wider text-white/40 font-bold block">
                                        Format
                                    </span>
                                    <span className="text-xs font-mono text-white font-bold block mt-0.5">
                                        Formatted JSON
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={triggerExport}
                                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#6366F1]/10 border-2 border-[#6366F1]"
                            >
                                <Download size={14} />
                                <span>Download Account Archive</span>
                            </button>

                            <button
                                type="button"
                                onClick={openPorter}
                                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-[#000000] hover:bg-[#161412] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border-2 border-white/20"
                            >
                                <ArrowUpDown size={14} />
                                <span>Transfer Secrets &amp; Codes</span>
                            </button>
                        </div>

                        {/* Irreversible Account Purge (Danger Zone) */}
                        <div className="p-6 md:p-7 bg-[#000000] border-2 border-rose-500/40 rounded-[28px] shadow-2xl space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border-2 border-rose-500/40">
                                    <AlertTriangle size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-black text-rose-400 font-clash m-0">
                                            Permanent Master Purge
                                        </h3>
                                        <span className="px-2 py-0.5 rounded bg-rose-500/10 border-2 border-rose-500/30 text-[9px] font-mono text-rose-300 font-bold uppercase">
                                            No Undo
                                        </span>
                                    </div>
                                    <p className="text-xs text-white/50 leading-relaxed font-medium mt-1 m-0">
                                        Instantly destroy all account records, vault credentials, private notes, workspaces, and identity bindings. There is no grace period, no recycle bin, and no recovery possible.
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#161412] border-2 border-rose-500/20 space-y-2">
                                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400/80 m-0">
                                    Purge Scope Breakdown
                                </p>
                                <ul className="text-xs text-white/70 space-y-1.5 list-disc pl-4 m-0 font-medium leading-relaxed">
                                    <li>All vault secrets, TOTP keys, keychain identities, and encrypted rows</li>
                                    <li>All workspaces, ideas, goals, tasks, forms, feeds, and thread discussions</li>
                                    <li>Instant termination of active sessions across all devices</li>
                                </ul>
                            </div>

                            <button
                                type="button"
                                onClick={triggerDeleteAccount}
                                className="w-full sm:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-rose-600/20 border-2 border-rose-500"
                            >
                                <Trash2 size={14} />
                                <span>Initiate Account Purge</span>
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'admin' && isAdmin && (
                    <div className="flex flex-col lg:flex-row gap-6 pb-24 w-full">
                        {/* Admin sub-menu */}
                        <div className="flex flex-col gap-2 w-full lg:w-[200px] flex-shrink-0">
                            <button type="button" onClick={() => setAdminSubTab('dashboard')} className={`p-3.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-colors ${adminSubTab === 'dashboard' ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20' : 'text-white/40 hover:bg-white/5'}`}>System Dashboard</button>
                            <button type="button" onClick={() => setAdminSubTab('users')} className={`p-3.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-colors ${adminSubTab === 'users' ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20' : 'text-white/40 hover:bg-white/5'}`}>User Directory</button>
                            <button type="button" onClick={() => setAdminSubTab('email')} className={`p-3.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-colors ${adminSubTab === 'email' ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20' : 'text-white/40 hover:bg-white/5'}`}>Email Orchestrator</button>
                            <button type="button" onClick={() => setAdminSubTab('coupons')} className={`p-3.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-colors ${adminSubTab === 'coupons' ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20' : 'text-white/40 hover:bg-white/5'}`}>Coupons Registry</button>
                        </div>
                        {/* Render the selected admin subpage */}
                        <div className="flex-grow min-w-0">
                            {adminSubTab === 'dashboard' && <AdminDashboardPage />}
                            {adminSubTab === 'users' && <UsersManagement />}
                            {adminSubTab === 'email' && <EmailOrchestrator />}
                            {adminSubTab === 'coupons' && <AdminCouponsPage />}
                        </div>
                    </div>
                )}
                </div>
            </div>

        {/* TOS & Privacy Policy Links */}
        <footer className="mt-12 pt-6 border-t border-white/5 flex items-center justify-center gap-4 text-xs font-semibold text-white/30 select-none">
            <button 
                onClick={() => router.push('/terms-of-service')}
                className="hover:text-white/60 transition-colors cursor-pointer"
            >
                Terms of Service
            </button>
            <span>•</span>
            <button 
                onClick={() => router.push('/privacy-policy')}
                className="hover:text-white/60 transition-colors cursor-pointer"
            >
                Privacy Policy
            </button>
        </footer>

        </div>

        {/* Conditionally unmounted overlays/drawers mathematically preventing click blocking */}
        {tgDrawerOpen && (
            <TelegramDrawer
                open={tgDrawerOpen}
                onClose={() => setTgDrawerOpen(false)}
                onSuccess={() => {
                    setTgDrawerOpen(false);
                }}
            />
        )}
        {profile && (
            <EditProfileModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                profile={profile}
                onUpdate={async () => {
                    await refreshUser(true);
                    await fetchProfile();
                }}
            />
        )}
        {billingDrawerOpen && (
            <BillingDrawer
                isOpen={billingDrawerOpen}
                onClose={() => setBillingDrawerOpen(false)}
            />
        )}
        {passkeySetupOpen && (
            <PasskeySetup
                open={passkeySetupOpen}
                onClose={() => setPasskeySetupOpen(false)}
                userId={user?.$id || ""}
                onSuccess={() => {
                    setPasskeySetupOpen(false);
                    loadPasskeys();
                }}
                trustUnlocked={true}
            />
        )}
    </MultiSectionContainer>
  );
}
