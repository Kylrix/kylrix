"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Shield, Copy, Pencil, Trash2, Search, Pin, Link as LinkIcon, CheckSquare } from 'lucide-react';
import { useSelection } from '@/context/SelectionContext';
import { useAppwriteVault } from '@/context/appwrite-context';
import { getCurrentUserSnapshot } from '@/lib/appwrite/client';
import { listTotpSecrets, deleteTotpSecret } from '@/lib/appwrite';
import { generateTOTP } from '@/lib/totp-util';
import toast from 'react-hot-toast';
import NewTotpDialog from '@/components/app/totp/new';
import { useSudo } from '@/context/SudoContext';
import { useFAB } from '@/context/FABContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { useMemo, useCallback } from 'react';
import SudoModal from '@/components/overlays/SudoModal';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import type { TotpSecrets as TotpItem } from '@/types/appwrite';
import { looksEncrypted } from '@/lib/masterpass-crypto';
import { ecosystemSecurity } from '@/lib/ecosystem/security';


// Stable TOTPCard - defined outside parent to prevent remount on every currentTime tick (1s).
// Previously defined inside TOTPPageContent, its function identity changed each second, causing
// React to unmount/mount cards and reset displayTotp from decrypted back to encrypted -> flash.
function TOTPCardStable({
  totp,
  folders,
  currentTime: _currentTime,
  getTimeRemaining,
  getFaviconUrl,
  selectedTotp,
  setSelectedTotp,
  requireUnlock,
  openEditDialog,
  openDeleteDialog,
  copyToClipboard,
}: {
  totp: TotpItem;
  folders: Map<string, string>;
  currentTime: number;
  getTimeRemaining: (period?: number) => number;
  getFaviconUrl: (url: string | null | undefined) => string | null;
  selectedTotp: TotpItem | null;
  setSelectedTotp: (t: TotpItem | null) => void;
  requireUnlock: (cb: () => void) => void;
  openEditDialog: (t: TotpItem) => void;
  openDeleteDialog: (id: string) => void;
  copyToClipboard: (text: string) => void;
}) {
  const { user, isVaultBlurEnabled } = useAppwriteVault();
  const contextMenu = useContextMenu();
  const openMenu = contextMenu?.openMenu;
  const { isPinned: isResourcePinned, togglePin, setLocalPin } = useResourcePins();
  const [displayTotp, setDisplayTotp] = useState<TotpItem>(totp);
  const [isVaultUnlockedState, setIsVaultUnlockedState] = useState(() => {
    try {
      const { masterPassCrypto } = require('@/lib/masterpass-crypto');
      return !!(ecosystemSecurity.status.isUnlocked || masterPassCrypto.isVaultUnlocked());
    } catch { return !!ecosystemSecurity.status.isUnlocked; }
  });
  useEffect(() => {
    setDisplayTotp((prev) => (prev.$id === totp.$id ? prev : totp));
  }, [totp.$id]);
  useEffect(() => {
    if (!isVaultUnlockedState && (looksEncrypted(totp.issuer) || looksEncrypted(totp.accountName) || looksEncrypted(totp.secretKey))) {
      setDisplayTotp(totp);
    }
  }, [totp.issuer, totp.accountName, totp.secretKey, isVaultUnlockedState]);
  useEffect(() => {
    const syncUnlock = () => {
      try {
        const { masterPassCrypto } = require('@/lib/masterpass-crypto');
        setIsVaultUnlockedState(!!(ecosystemSecurity.status.isUnlocked || masterPassCrypto.isVaultUnlocked()));
      } catch { setIsVaultUnlockedState(!!ecosystemSecurity.status.isUnlocked); }
    };
    const unsub = ecosystemSecurity.onStatusChange((s: any) => setIsVaultUnlockedState(!!s.isUnlocked));
    const onUnlock = () => setIsVaultUnlockedState(true);
    const onLock = () => setIsVaultUnlockedState(false);
    window.addEventListener('vault-unlocked', onUnlock);
    window.addEventListener('kylrix:vault-unlocked', onUnlock);
    window.addEventListener('vault-locked', onLock);
    syncUnlock();
    return () => {
      unsub();
      window.removeEventListener('vault-unlocked', onUnlock);
      window.removeEventListener('kylrix:vault-unlocked', onUnlock);
      window.removeEventListener('vault-locked', onLock);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const tryDecrypt = async () => {
      const isEncrypted = looksEncrypted(totp.issuer) || looksEncrypted(totp.accountName) || looksEncrypted(totp.secretKey) || looksEncrypted((totp as any).dek);
      if (!isEncrypted) { if (!cancelled) setDisplayTotp(totp); return; }
      if (!isVaultUnlockedState) return;
      try {
        const { masterPassCrypto } = await import('@/lib/masterpass-crypto');
        if (!masterPassCrypto.isVaultUnlocked()) return;
        const { decryptField } = await import('@/lib/masterpass-crypto');
        const updated: any = { ...totp };
        let changed = false;
        let dekKey: any = null;
        if ((totp as any).dek && looksEncrypted((totp as any).dek)) {
          try {
            const dekBase64 = await decryptField((totp as any).dek);
            const rawKey = new Uint8Array(atob(dekBase64).split('').map((c: any) => c.charCodeAt(0)));
            dekKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
          } catch {}
        }
        for (const field of ['issuer','accountName','secretKey','url'] as const) {
          const val = (totp as any)[field];
          if (val && typeof val === 'string' && looksEncrypted(val)) {
            try {
              let plain: string | null = null;
              if (dekKey) plain = await ecosystemSecurity.decryptWithKey(val, dekKey);
              else plain = await decryptField(val);
              if (plain && plain !== val) { updated[field] = plain; changed = true; }
            } catch {}
          }
        }
        if (changed && !cancelled) setDisplayTotp(updated);
      } catch {}
    };
    void tryDecrypt();
    return () => { cancelled = true; };
  }, [totp.$id, totp.issuer, totp.accountName, totp.secretKey, (totp as any).dek, isVaultUnlockedState]);
  const isLockedEncrypted = !isVaultUnlockedState && looksEncrypted(displayTotp.secretKey);
  const code = isLockedEncrypted ? '--- ---' : generateTOTP(displayTotp.secretKey, { step: displayTotp.period || 30, digits: displayTotp.digits || 6 });
  const timeRemaining = getTimeRemaining(displayTotp.period || 30);
  const progress = (timeRemaining / (displayTotp.period || 30)) * 100;
  const folderName = displayTotp.folderId ? folders.get(displayTotp.folderId) : null;
  const faviconUrl = !looksEncrypted(displayTotp.url) ? getFaviconUrl(displayTotp.url) : null;
  const issuerInitials = !looksEncrypted(displayTotp.issuer) && displayTotp.issuer ? displayTotp.issuer.trim().charAt(0).toUpperCase() : "?";
  const isCardActive = selectedTotp?.$id === totp.$id;
  const ownerId = totp.userId || user?.$id || '';
  const pinned = isResourcePinned('totp', totp.$id, ownerId, totp.isPinned);
  const handlePinToggle = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user?.$id) return;
    const currentlyPinned = isResourcePinned('totp', totp.$id, ownerId, totp.isPinned);
    const isOwner = user.$id === ownerId;
    try {
      const nextPinned = await togglePin({ resourceType: 'totp', resourceId: totp.$id, ownerId, rowIsPinned: totp.isPinned, setOwnerRowPin: async (pinned) => { const { setTotpPinned } = await import('@/lib/appwrite'); await setTotpPinned(totp.$id, pinned); }});
      if (!isOwner) setLocalPin('totp', totp.$id, currentlyPinned);
      toast.success(nextPinned ? 'Pinned to top' : 'Unpinned');
    } catch (err: unknown) {
      if (!isOwner) setLocalPin('totp', totp.$id, currentlyPinned);
      console.error('Failed to toggle pin:', err);
      toast.error('Failed to toggle pin');
    }
  };
  const handleShareDecryptedKey = async () => {
    try {
      if (!totp.isPublic) {
        const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
        const res = await toggleResourcePublicGuest({ resourceType: 'totp', resourceId: totp.$id, mode: 'publish' });
        if (!res?.success) { toast.error('Failed to make TOTP public.'); return; }
        totp.isPublic = true;
      }
      let currentDek = (totp as any).dek;
      if (!currentDek) {
        const { decryptField, encryptField } = await import('@/lib/masterpass-crypto');
        const { ecosystemSecurity } = await import('@/lib/ecosystem/security');
        const { VaultService } = await import('@/lib/appwrite/vault');
        const newDek = await ecosystemSecurity.generateRandomMEK();
        const rawKey = await crypto.subtle.exportKey("raw", newDek);
        const dekBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
        const wrappedDek = await encryptField(dekBase64);
        let decryptedSecret = totp.secretKey; if (looksEncrypted(decryptedSecret)) decryptedSecret = await decryptField(decryptedSecret);
        let decryptedIssuer = totp.issuer; if (looksEncrypted(decryptedIssuer)) decryptedIssuer = await decryptField(decryptedIssuer);
        let decryptedAccount = totp.accountName; if (looksEncrypted(decryptedAccount)) decryptedAccount = await decryptField(decryptedAccount);
        await VaultService.updateTOTPSecret(totp.$id, { dek: wrappedDek, secretKey: decryptedSecret, issuer: decryptedIssuer ?? undefined, accountName: decryptedAccount ?? undefined});
        totp.dek = wrappedDek; totp.secretKey = decryptedSecret; currentDek = wrappedDek;
      }
      let keyFragment = '';
      if (currentDek) { const { decryptField } = await import('@/lib/masterpass-crypto'); const dekBase64 = await decryptField(currentDek); const urlSafeDek = dekBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); keyFragment = `/${urlSafeDek}`; }
      const { buildPublicResourceUrl } = await import('@/lib/share/public-url'); const baseUrl = buildPublicResourceUrl('totp', totp.$id); const fullUrl = keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;
      await navigator.clipboard.writeText(fullUrl); toast.success('Public seed sharing link copied.');
    } catch (err: any) { toast.error('Failed to share: ' + err.message); }
  };
  const handleShareSixtySeconds = async () => {
    try {
      if (!totp.isPublic) {
        const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
        const res = await toggleResourcePublicGuest({ resourceType: 'totp', resourceId: totp.$id, mode: 'publish' });
        if (!res?.success) { toast.error('Failed to make TOTP public.'); return; }
        totp.isPublic = true;
      }
      const now = Math.floor(Date.now() / 1000);
      const seedValue = totp.secretKey;
      const options = { start: now, digits: totp.digits || 6, step: totp.period || 30, algo: totp.algorithm || 'SHA1' };
      const encodedParams = btoa(JSON.stringify({ seed: seedValue, ...options })).replace(/=/g, '');
      const { buildPublicResourceUrl } = await import('@/lib/share/public-url'); const baseUrl = buildPublicResourceUrl('totp', totp.$id); const fullUrl = `${baseUrl}/temp/${encodedParams}`;
      await navigator.clipboard.writeText(fullUrl); toast.success('Temporary sixty second sharing link copied.');
    } catch (err: any) { toast.error('Failed to copy sixty second link: ' + err.message); }
  };
  const selection = useSelection();
  const isSelected = selection.isSelected(totp.$id, 'totp');

  const contextMenuItems = useMemo(() => [
      { label: pinned ? 'Unpin Code' : 'Pin Code', icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />, onClick: handlePinToggle },
      { label: 'Select', icon: <CheckSquare size={16} className="text-[#10B981]" />, onClick: () => selection.enterSelectMode('totp', totp.$id) },
      { label: 'Share Options', icon: <LinkIcon size={16} className="text-emerald-500" />, submenu: [
          { label: 'Share Seed (DEK)', icon: <LinkIcon size={14} />, onClick: handleShareDecryptedKey },
          { label: 'Share Sixty Seconds Only', icon: <LinkIcon size={14} className="text-[#F59E0B]" />, onClick: handleShareSixtySeconds }
        ]},
      { label: 'Edit', icon: <Pencil size={16} />, onClick: () => openEditDialog(totp) },
      { label: 'Delete', icon: <Trash2 size={16} />, variant: 'destructive' as const, onClick: () => openDeleteDialog(totp.$id) }
  ], [pinned, totp, selection]);
  const handleContextMenu = (e: React.MouseEvent) => {
    if (selection.isSelectMode) return;
    e.preventDefault();
    e.stopPropagation();
    if (openMenu) openMenu({ x: e.clientX, y: e.clientY, items: contextMenuItems, appType: 'vault' });
  };
  const radius = 10; const circumference = 2 * Math.PI * radius; const strokeDashoffset = circumference - (progress / 100) * circumference;
  return (
    <div
      onClick={() => {
        if (selection.isSelectMode) {
          selection.toggleSelect(totp.$id, 'totp');
          return;
        }
        requireUnlock(() => setSelectedTotp(displayTotp));
      }}
      onContextMenu={selection.isSelectMode ? (e) => e.preventDefault() : handleContextMenu}
      className={`h-full p-5 rounded-3xl transition-all duration-300 flex flex-col gap-4 cursor-pointer border ${isCardActive ? 'ring-1 ring-[#10B981]' : ''} ${isSelected ? 'bg-[#1C1A18] border-emerald-500/40 ring-2 ring-emerald-500' : 'bg-[#161412] border-[#1C1A18] hover:bg-[#1C1A18] hover:border-emerald-500/20'} hover:-translate-y-0.5 shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),0_2px_3px_-3px_rgba(37,35,33,0.9)]`}
    >
      <div className="flex items-center gap-3.5 min-w-0 w-full">
        {selection.isSelectMode ? (
          <div
            className="shrink-0 flex items-center justify-center pr-1"
            onClick={(e) => {
              e.stopPropagation();
              selection.toggleSelect(totp.$id, 'totp');
            }}
          >
            <div
              className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                isSelected ? 'bg-[#10B981] border-[#10B981] text-[#0A0908]' : 'border-[#9B9691] bg-transparent'
              }`}
            >
              {isSelected && <CheckSquare className="w-4 h-4" />}
            </div>
          </div>
        ) : faviconUrl ? (<div className="w-[52px] h-[52px] rounded-2xl bg-white/2 border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors"><img src={faviconUrl} alt={totp.issuer || 'app favicon'} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} className="w-7 h-7 rounded-md" /></div>) : (<div className="w-[52px] h-[52px] rounded-2xl bg-white/2 border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors"><span className="font-black text-emerald-500 text-xl font-clash">{issuerInitials}</span></div>)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <div className="text-[1.05rem] font-extrabold text-white font-clash leading-tight truncate flex-1 min-w-0">{looksEncrypted((displayTotp as any).issuer) ? "Encrypted Code" : ((displayTotp as any).issuer || "Smart Code")}</div>
            <SyncStatusDot resourceId={displayTotp.$id} kind="totp" row={displayTotp as unknown as Record<string, unknown>} />
          </div>
          <div className="text-sm font-medium text-[#9B9691] font-satoshi mt-0.5 truncate transition-[filter] duration-300" style={{ filter: isVaultBlurEnabled ? 'blur(4.5px)' : 'none' }}>{looksEncrypted((displayTotp as any).accountName) ? "••••••••" : ((displayTotp as any).accountName || "No account info")}</div>
          <div className="flex flex-wrap gap-1 mt-2">{folderName && (<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-black bg-white/4 text-[#9B9691] uppercase tracking-wider">{folderName}</span>)}{totp.sharedFrom && (<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-black bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">Received</span>)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 w-full mt-auto pt-4 border-t border-white/5">
        <div className="flex items-center gap-3"><span className="text-xl font-black font-mono tracking-wider text-emerald-500 transition-[filter] duration-300" style={{ filter: isVaultBlurEnabled || isLockedEncrypted ? 'blur(6px)' : 'none' }}>{isLockedEncrypted ? '••• •••' : `${code.substring(0, 3)} ${code.substring(3)}`}</span><button onClick={(e) => { e.stopPropagation(); copyToClipboard(code); }} className="p-2 text-emerald-500 bg-emerald-500/5 border border-emerald-500/10 rounded-xl hover:bg-emerald-500/10 transition-colors"><Copy className="h-[15px] w-[15px]" /></button></div>
        <div className="flex items-center gap-3"><span className={`text-xs font-black min-w-[22px] text-right ${timeRemaining <= 5 ? 'text-red-500' : 'text-[#9B9691]'}`}>{timeRemaining}s</span><div className="relative inline-flex items-center justify-center"><svg className="w-7 h-7 transform -rotate-90"><circle cx="14" cy="14" r={radius} className="stroke-white/5 fill-transparent" strokeWidth="2.5" /><circle cx="14" cy="14" r={radius} className={`fill-transparent transition-[stroke-dashoffset] duration-1000 ${timeRemaining <= 5 ? 'stroke-[#EF4444]' : 'stroke-[#10B981]'}`} strokeWidth="2.5" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" /></svg></div></div>
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}><button onClick={handlePinToggle} className={`p-1.5 rounded-lg transition-all duration-200 ${pinned ? 'text-[#F59E0B] bg-[#F59E0B]/5' : 'text-white/20 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'}`} title={pinned ? 'Unpin' : 'Pin'}><Pin size={16} className={pinned ? 'fill-[#F59E0B]' : ''} /></button><ShareLockButton resourceType="totp" resourceId={totp.$id} isPublic={!!totp.isPublic} isGuest={!!totp.isGuest} accentColor="#10B981" canPublish={true} getCustomShareUrl={async () => { let currentDek = (totp as any).dek; if (!currentDek) { const { decryptField, encryptField } = await import('@/lib/masterpass-crypto'); const { ecosystemSecurity } = await import('@/lib/ecosystem/security'); const { VaultService } = await import('@/lib/appwrite/vault'); const newDek = await ecosystemSecurity.generateRandomMEK(); const rawKey = await crypto.subtle.exportKey("raw", newDek); const dekBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey))); const wrappedDek = await encryptField(dekBase64); let decryptedSecret = totp.secretKey; if (looksEncrypted(decryptedSecret)) decryptedSecret = await decryptField(decryptedSecret); let decryptedIssuer = totp.issuer; if (looksEncrypted(decryptedIssuer)) decryptedIssuer = await decryptField(decryptedIssuer); let decryptedAccount = totp.accountName; if (looksEncrypted(decryptedAccount)) decryptedAccount = await decryptField(decryptedAccount); await VaultService.updateTOTPSecret(totp.$id, { dek: wrappedDek, secretKey: decryptedSecret, issuer: decryptedIssuer ?? undefined, accountName: decryptedAccount ?? undefined}); totp.dek = wrappedDek; totp.secretKey = decryptedSecret; currentDek = wrappedDek; } let keyFragment = ''; if (currentDek) { const { decryptField } = await import('@/lib/masterpass-crypto'); const dekBase64 = await decryptField(currentDek); const urlSafeDek = dekBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); keyFragment = `/${urlSafeDek}`; } const { buildPublicResourceUrl } = await import('@/lib/share/public-url'); const baseUrl = buildPublicResourceUrl('totp', totp.$id); return keyFragment ? `${baseUrl}${keyFragment}` : baseUrl; }} /></div>
      </div>
    </div>
  );
}


export const dynamic = 'force-dynamic';

export function TOTPPageContent({ isTabMode = false }: { isTabMode?: boolean }) {
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, needsMasterPassword, isVaultUnlocked } = useAppwriteVault();
  const { setConfiguration, resetConfiguration } = useFAB();
  const [totpCodes, setTotpCodes] = useState<TotpItem[]>([]);
  const scopedTotpCodes = totpCodes;
  const [folders, _setFolders] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showMasterPassDrawer, setShowMasterPassDrawer] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [editingTotp, setEditingTotp] = useState<TotpItem | null>(null);
  const [selectedTotp, setSelectedTotp] = useState<TotpItem | null>(null);

  useEffect(() => {
    if (!isVaultUnlocked()) return;
    if (totpCodes.length > 0 && !selectedTotp) {
      setSelectedTotp(totpCodes[0]);
    }
  }, [totpCodes, selectedTotp, isVaultUnlocked]);

  const { requestSudo, unlockOnDemand } = useSudo();

  const requireUnlock = useCallback(
    (onSuccess: () => void) => {
      if (isVaultUnlocked()) {
        onSuccess();
        return;
      }
      requestSudo({ onSuccess });
    },
    [isVaultUnlocked, requestSudo]
  );

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#10B981',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: () => requireUnlock(() => setShowNew(true)),
      actions: [
        { id: 'add-totp', label: 'ADD CODE', icon: <Plus size={20} />, onClick: () => requireUnlock(() => setShowNew(true)) }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, requireUnlock]);

  // Handle action query param
  useEffect(() => {
    const action = searchParams?.get('action');
    if (action === 'add-totp') {
      setEditingTotp(null);
      requireUnlock(() => setShowNew(true));
      
      const params = new URLSearchParams(window.location.search);
      params.delete('action');
      const newRelativePathQuery = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      router.replace(newRelativePathQuery);
    }
  }, [searchParams, router, requireUnlock]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVaultChange = async () => {
      try {
        const { VaultService } = await import('@/lib/appwrite/vault-service');
        VaultService.clearVaultCaches();
      } catch {}
      if (user?.$id) {
        listTotpSecrets(user.$id).then(setTotpCodes).catch(() => {});
      }
    };

    window.addEventListener('vault-unlocked', handleVaultChange);
    window.addEventListener('vault-locked', handleVaultChange);
    return () => {
      window.removeEventListener('vault-unlocked', handleVaultChange);
      window.removeEventListener('vault-locked', handleVaultChange);
    };
  }, [user?.$id]);

  useEffect(() => {
    const activeUserId = user?.$id || (typeof window !== 'undefined' ? (getCurrentUserSnapshot()?.$id || '') : '');
    if (!activeUserId) return;
    let isCancelled = false;
    const cacheKey = `vault_totp_${activeUserId}`;

    // Instant local copy read on mount
    (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cached = await LocalEngine.cacheGet<any[]>(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0 && !isCancelled) {
          setTotpCodes(cached as any);
          setLoading(false);
        }
      } catch {}
    })();

    (async () => {
      try {
        const { TablesDB, Client, Query } = await import('appwrite');
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

        const client = new Client()
          .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
          .setProject(APPWRITE_CONFIG.PROJECT_ID);

        const tablesDB = new TablesDB(client);
        const res = await tablesDB.listRows(
          APPWRITE_CONFIG.DATABASES.VAULT,
          APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS,
          [Query.equal('userId', activeUserId)]
        );

        if (!isCancelled && res?.rows) {
          console.log(`[TOTP] Direct Client SDK listRows returned ${res.rows.length} TOTP codes for user: ${activeUserId}`);
          setTotpCodes(res.rows as any);
          void import('@/lib/services/LocalEngine').then(({ LocalEngine }) => {
            void LocalEngine.cacheSet(cacheKey, res.rows);
          });
        }
      } catch (err: any) {
        console.error('[TOTP] Failed to load direct TOTP secrets:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [user, showNew, isVaultUnlocked, unlockOnDemand]);

  useEffect(() => {
    if (unlockOnDemand) {
      setShowMasterPassDrawer(false);
      return;
    }
    if (user && (needsMasterPassword || !isVaultUnlocked())) {
      setShowMasterPassDrawer(true);
    } else {
      setShowMasterPassDrawer(false);
    }
  }, [user, needsMasterPassword, isVaultUnlocked, unlockOnDemand]);

  const handleMasterPassSuccess = useCallback(() => {
    setShowMasterPassDrawer(false);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: string) => {
    if (!user?.$id) return;
    try {
      await deleteTotpSecret(id);
      setTotpCodes((codes) => codes.filter((c) => c.$id !== id));
      toast.success("Verification code deleted.");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message || "Failed to delete verification code.");
    } finally {
      setDeleteDialog({ open: false, id: null });
    }
  };

  const openDeleteDialog = (id: string) => {
    requireUnlock(() => setDeleteDialog({ open: true, id }));
  };

  const getTimeRemaining = (period: number = 30): number => {
    return period - (Math.floor(currentTime / 1000) % period);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard");
  };

  const openEditDialog = (totp: TotpItem) => {
    requireUnlock(() => {
      setEditingTotp(totp);
      setShowNew(true);
    });
  };

  const getFaviconUrl = (url: string | null | undefined) => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      try {
        if (url.includes('.') && !url.startsWith('http')) {
          return `https://www.google.com/s2/favicons?domain=${url}&sz=64`;
        }
      } catch {}
      return null;
    }
  };

  // TOTPCard moved to TOTPCardStable (outside) to prevent per-second remount flash
  const { isPinned: isResourcePinned } = useResourcePins();

  const innerContent = (
    <>
        {/* Filter/Search Bar & Add Button Stack */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-8 max-w-3xl">
          <div className="relative w-full sm:max-w-[400px] flex-grow">
            <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="text-white/30 h-[18px] w-[18px]" />
            </span>
            <input
              type="text"
              placeholder="Search codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-2xl bg-[#161412] border border-[#1C1A18] text-white placeholder-white/30 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <button 
            onClick={() => requireUnlock(() => setShowNew(true))}
            className="flex items-center justify-center gap-2 px-8 h-12 font-black bg-[#10B981] text-black hover:bg-[#059669] rounded-2xl transition-colors shadow-[0_8px_16px_rgba(16, 185, 129, 0.1)]"
          >
            <Plus size={18} />
            Add Code
          </button>
        </div>

        {/* Main List Area */}
        {loading ? (
          <div className="flex justify-center py-24 max-w-3xl">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : scopedTotpCodes.length === 0 ? (
          <div className="p-24 text-center rounded-[32px] bg-[#161412] border border-dashed border-[#1C1A18] max-w-3xl">
            <Shield className="h-16 w-16 mx-auto mb-6 text-white/5" />
            <h2 className="text-xl font-black text-white mb-2 font-clash">
              No Smart Codes
            </h2>
            <p className="text-[#9B9691] max-w-xs mx-auto mb-8 text-sm">
              Your secure vault is ready to manage two-step verification codes.
            </p>
            <button 
              onClick={() => requireUnlock(() => setShowNew(true))} 
              className="inline-flex items-center gap-2 px-6 h-12 bg-[#10B981] hover:bg-[#059669] text-black font-black rounded-2xl transition-colors"
            >
              <Plus size={18} />
              Add Code
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5 max-w-3xl">
            {totpCodes
              .filter((totp) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return (
                  (totp.issuer && totp.issuer.toLowerCase().includes(q)) ||
                  (totp.accountName &&
                    totp.accountName.toLowerCase().includes(q))
                );
              })
              .sort((a, b) => {
                const aPinned = isResourcePinned('totp', a.$id, a.userId || user?.$id || '', a.isPinned);
                const bPinned = isResourcePinned('totp', b.$id, b.userId || user?.$id || '', b.isPinned);
                if (aPinned && !bPinned) return -1;
                if (!aPinned && bPinned) return 1;
                return 0;
              })
              .map((totp) => (
                <TOTPCardStable key={totp.$id} totp={totp} folders={folders} currentTime={currentTime} getTimeRemaining={getTimeRemaining} getFaviconUrl={getFaviconUrl} selectedTotp={selectedTotp} setSelectedTotp={setSelectedTotp} requireUnlock={requireUnlock} openEditDialog={openEditDialog} openDeleteDialog={openDeleteDialog} copyToClipboard={copyToClipboard} />
              ))}
          </div>
        )}

      {/* Dialogs */}
      {showNew && (
        <NewTotpDialog
          open={showNew}
          onClose={() => {
            setShowNew(false);
            setEditingTotp(null);
          }}
          initialData={editingTotp || undefined}
        />
      )}

      {deleteDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md p-6 rounded-[24px] bg-[#161412] border border-[#1C1A18] shadow-[0_40px_80px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black font-clash text-white mb-3">
              Delete Smart Code
            </h3>
            <div className="mb-4">
              <p className="text-sm text-[#9B9691] leading-relaxed">
                Are you sure you want to delete this verification code? This action cannot be undone.
              </p>
            </div>
            
            <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-[#0A0908] border border-white/5 mb-6">
              {(() => {
                const selected = totpCodes.find((t) => t.$id === deleteDialog.id);
                if (!selected) return null;
                return (
                  <>
                    <div>
                      <span className="text-[10px] text-[#9B9691] block mb-0.5 font-black uppercase tracking-wider">Issuer</span>
                      <span className="text-sm font-extrabold text-white">{selected.issuer || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#9B9691] block mb-0.5 font-black uppercase tracking-wider">Account</span>
                      <span className="text-sm font-extrabold text-white">{selected.accountName || "—"}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteDialog({ open: false, id: null })}
                className="w-1/2 py-3 px-4 border border-white/10 text-white font-extrabold rounded-xl hover:border-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (deleteDialog.id) {
                    requestSudo({
                      onSuccess: () => handleDelete(deleteDialog.id!)
                    });
                  }
                }}
                className="w-1/2 py-3 px-4 bg-[#EF4444] text-white font-extrabold rounded-xl hover:bg-[#DC2626] transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isTabMode) {
    return innerContent;
  }

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-[#0A0908] pt-4 md:pt-8 relative">
      <div 
        className="flex-1 flex flex-col transition-opacity duration-300"
        style={{
          pointerEvents: showMasterPassDrawer ? 'none' : 'auto',
          opacity: showMasterPassDrawer ? 0.3 : 1
        }}
      >
        <MultiSectionContainer panels={['secrets', 'secret_chat']} contextId={selectedTotp?.issuer || selectedTotp?.accountName || undefined}>
        {/* Header & Back Action */}
        <div className="px-4 md:px-12">
          <div className="flex items-center gap-3.5 mb-8">
          <button 
            onClick={() => router.back()} 
            className="p-2 text-white bg-[#161412] border border-[#1C1A18] rounded-xl hover:bg-[#1C1A18] transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-black font-clash text-white">
            Smart Codes
          </h1>
        </div>
        
        {innerContent}
      </div>
      </MultiSectionContainer>
      </div>

      {showMasterPassDrawer && (
        <SudoModal
          isOpen={showMasterPassDrawer}
          app="vault"
          onSuccess={handleMasterPassSuccess}
          onCancel={() => { }}
        />
      )}
    </div>
  );
}

export default function TOTPPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#0A0908]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      }
    >
      <TOTPPageContent />
    </Suspense>
  );
}
