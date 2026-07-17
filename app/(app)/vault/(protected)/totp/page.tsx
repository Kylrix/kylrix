"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Shield, Copy, Pencil, Trash2, Search, Pin, Lock, Link as LinkIcon } from 'lucide-react';
import { useAppwriteVault } from '@/context/appwrite-context';
import { listTotpSecrets, deleteTotpSecret, listFolders } from '@/lib/appwrite';
import { generateTOTP } from '@/lib/totp-util';
import toast from 'react-hot-toast';
import NewTotpDialog from '@/components/app/totp/new';
import { useSudo } from '@/context/SudoContext';
import { useFAB } from '@/context/FABContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';
import { useMemo, useCallback } from 'react';
import SudoModal from '@/components/overlays/SudoModal';

export const dynamic = 'force-dynamic';

export function TOTPPageContent({ isTabMode = false }: { isTabMode?: boolean }) {
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, needsMasterPassword, isVaultUnlocked, isVaultBlurEnabled } = useAppwriteVault();
  const { setConfiguration, resetConfiguration } = useFAB();
  
  // Master password modal state
  const [showMasterPassDrawer, setShowMasterPassDrawer] = useState(!!user && (needsMasterPassword || !isVaultUnlocked()));
  
  type TotpItem = {
    $id: string;
    issuer?: string | null;
    accountName?: string | null;
    secretKey: string;
    period?: number | null;
    digits?: number | null;
    algorithm?: string | null;
    folderId?: string | null;
    sharedFrom?: string | null;
    url?: string | null;
    isPublic?: boolean | null;
    isGuest?: boolean | null;
    isPinned?: boolean | null;
    dek?: string | null;
  };
  
  const [totpCodes, setTotpCodes] = useState<TotpItem[]>([]);
  const [folders, setFolders] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [editingTotp, setEditingTotp] = useState<TotpItem | null>(null);
  const [selectedTotp, setSelectedTotp] = useState<TotpItem | null>(null);

  useEffect(() => {
    if (totpCodes.length > 0 && !selectedTotp) {
      setSelectedTotp(totpCodes[0]);
    }
  }, [totpCodes, selectedTotp]);

  const { requestSudo } = useSudo();

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#10B981',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: () => setShowNew(true),
      actions: [
        { id: 'add-totp', label: 'ADD CODE', icon: <Plus size={20} />, onClick: () => setShowNew(true) }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration]);

  // Handle action query param
  useEffect(() => {
    const action = searchParams?.get('action');
    if (action === 'add-totp') {
      setEditingTotp(null);
      setShowNew(true);
      
      const params = new URLSearchParams(window.location.search);
      params.delete('action');
      const newRelativePathQuery = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      router.replace(newRelativePathQuery);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!user?.$id) return;

    if (!isVaultUnlocked()) {
      return;
    }

    setLoading(true);
    Promise.allSettled([listTotpSecrets(user.$id), listFolders(user.$id)])
      .then(([secretsResult, foldersResult]) => {
        if (secretsResult.status === "fulfilled") {
          setTotpCodes(secretsResult.value);
        } else {
          console.error("Failed to fetch TOTP secrets", secretsResult.reason);
        }

        if (foldersResult.status === "fulfilled") {
          const folderMap = new Map<string, string>();
          foldersResult.value.forEach((f) => folderMap.set(f.$id, f.name));
          setFolders(folderMap);
        }
      })
      .catch((err) => {
        console.error("Error loading TOTP data:", err);
        toast.error("Failed to load data.");
      })
      .finally(() => setLoading(false));
  }, [user, showNew, isVaultUnlocked]);

  useEffect(() => {
    if (user && (needsMasterPassword || !isVaultUnlocked())) {
      setShowMasterPassDrawer(true);
    } else {
      setShowMasterPassDrawer(false);
    }
  }, [user, needsMasterPassword, isVaultUnlocked]);

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
    setDeleteDialog({ open: true, id });
  };

  const getTimeRemaining = (period: number = 30): number => {
    return period - (Math.floor(currentTime / 1000) % period);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard");
  };

  const openEditDialog = (totp: TotpItem) => {
    setEditingTotp(totp);
    setShowNew(true);
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

  const { openMenu } = useContextMenu();
  const { isPinned: isResourcePinned, togglePin } = useResourcePins();

  const TOTPCard = ({ totp }: { totp: TotpItem }) => {
    const code = generateTOTP(
      totp.secretKey,
      {
        step: totp.period || 30,
        digits: totp.digits || 6
      }
    );

    const timeRemaining = getTimeRemaining(totp.period || 30);
    const progress = (timeRemaining / (totp.period || 30)) * 100;
    const folderName = totp.folderId ? folders.get(totp.folderId) : null;
    const faviconUrl = getFaviconUrl(totp.url);
    const issuerInitials = totp.issuer ? totp.issuer.trim().charAt(0).toUpperCase() : "?";

    const isSelected = selectedTotp?.$id === totp.$id;
    const pinned = isResourcePinned('totp', totp.$id, user?.$id, (totp as any).isPinned);

    const handlePinToggle = async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      try {
        await togglePin({
          resourceType: 'totp',
          resourceId: totp.$id,
          ownerId: user?.$id || '',
          rowIsPinned: (totp as any).isPinned,
          setOwnerRowPin: async (pinned) => {
              // Update via local refresh for now or implement updateTotpSecret
          },
        });
      } catch (err: any) {
        console.error('Failed to toggle pin:', err);
      }
    };

    const handleShareDecryptedKey = async () => {
      try {
        if (!totp.isPublic) {
          const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
          const res = await toggleResourcePublicGuest({
            resourceType: 'totp',
            resourceId: totp.$id,
            mode: 'publish'
          });
          if (!res?.success) {
            toast.error('Failed to make TOTP public.');
            return;
          }
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
          
          let decryptedSecret = totp.secretKey;
          if (decryptedSecret && typeof decryptedSecret === 'string' && decryptedSecret.length > 20 && /^[A-Za-z0-9+/=]+$/.test(decryptedSecret)) {
            decryptedSecret = await decryptField(decryptedSecret);
          }
          
          let decryptedIssuer = totp.issuer;
          if (decryptedIssuer && typeof decryptedIssuer === 'string' && decryptedIssuer.length > 20 && /^[A-Za-z0-9+/=]+$/.test(decryptedIssuer)) {
            decryptedIssuer = await decryptField(decryptedIssuer);
          }

          let decryptedAccount = totp.accountName;
          if (decryptedAccount && typeof decryptedAccount === 'string' && decryptedAccount.length > 20 && /^[A-Za-z0-9+/=]+$/.test(decryptedAccount)) {
            decryptedAccount = await decryptField(decryptedAccount);
          }
          
          // Pass plaintext fields + wrappedDek; VaultService will encrypt with new DEK
          await VaultService.updateTOTPSecret(totp.$id, {
            dek: wrappedDek,
            secretKey: decryptedSecret,
            issuer: decryptedIssuer ?? undefined,
            accountName: decryptedAccount ?? undefined,
          });
          
          totp.dek = wrappedDek;
          totp.secretKey = decryptedSecret;
          currentDek = wrappedDek;
        }

        let keyFragment = '';
        if (currentDek) {
          const { decryptField } = await import('@/lib/masterpass-crypto');
          const dekBase64 = await decryptField(currentDek);
          const urlSafeDek = dekBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
          keyFragment = `/${urlSafeDek}`;
        }
        const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
        const baseUrl = buildPublicResourceUrl('totp', totp.$id);
        const fullUrl = keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;
        await navigator.clipboard.writeText(fullUrl);
        toast.success('Public seed sharing link copied.');
      } catch (err: any) {
        toast.error('Failed to share: ' + err.message);
      }
    };

    const handleShareSixtySeconds = async () => {
      try {
        if (!totp.isPublic) {
          const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
          const res = await toggleResourcePublicGuest({
            resourceType: 'totp',
            resourceId: totp.$id,
            mode: 'publish'
          });
          if (!res?.success) {
            toast.error('Failed to make TOTP public.');
            return;
          }
          totp.isPublic = true;
        }

        // Build sixty seconds TOTP share parameters containing key metrics: start unix timestamp, digits, step, algorithm
        const now = Math.floor(Date.now() / 1000);
        const seedValue = totp.secretKey; // Already client-decrypted in list mapping
        const options = {
          start: now,
          digits: totp.digits || 6,
          step: totp.period || 30,
          algo: totp.algorithm || 'SHA1'
        };
        const encodedParams = btoa(JSON.stringify({
          seed: seedValue,
          ...options
        })).replace(/=/g, ''); // Trim base64 padding for url safety
        
        const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
        const baseUrl = buildPublicResourceUrl('totp', totp.$id);
        const fullUrl = `${baseUrl}/temp/${encodedParams}`;
        await navigator.clipboard.writeText(fullUrl);
        toast.success('Temporary sixty second sharing link copied.');
      } catch (err: any) {
        toast.error('Failed to copy sixty second link: ' + err.message);
      }
    };

    const contextMenuItems = useMemo(() => [
        { label: pinned ? 'Unpin Code' : 'Pin Code', icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />, onClick: handlePinToggle },
        { 
          label: 'Share Options', 
          icon: <LinkIcon size={16} className="text-emerald-500" />,
          submenu: [
            { label: 'Share Seed (DEK)', icon: <LinkIcon size={14} />, onClick: handleShareDecryptedKey },
            { label: 'Share Sixty Seconds Only', icon: <LinkIcon size={14} className="text-[#F59E0B]" />, onClick: handleShareSixtySeconds }
          ]
        },
        { label: 'Edit', icon: <Pencil size={16} />, onClick: () => openEditDialog(totp) },
        { label: 'Delete', icon: <Trash2 size={16} />, variant: 'destructive' as const, onClick: () => openDeleteDialog(totp.$id) }
    ], [pinned, totp]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        openMenu({
            x: e.clientX,
            y: e.clientY,
            items: contextMenuItems,
            appType: 'vault'
        });
    };

    // SVG variables
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div
        onClick={() => setSelectedTotp(totp)}
        onContextMenu={handleContextMenu}
        className={`p-5 rounded-3xl transition-all duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between cursor-pointer border ${
          isSelected 
            ? 'bg-[#1C1A18] border-emerald-500/40' 
            : 'bg-[#161412] border-[#1C1A18] hover:bg-[#1C1A18] hover:border-emerald-500/20'
        } hover:-translate-y-0.5 shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),0_2px_3px_-3px_rgba(37,35,33,0.9)]`}
      >
        {/* Left Side: Logo/Avatar & Info */}
        <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
          {faviconUrl ? (
            <div className="w-[52px] h-[52px] rounded-2xl bg-white/2 border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors">
              <img 
                src={faviconUrl} 
                alt={totp.issuer || 'app favicon'}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-7 h-7 rounded-md" 
              />
            </div>
          ) : (
            <div className="w-[52px] h-[52px] rounded-2xl bg-white/2 border border-white/5 flex items-center justify-center flex-shrink-0 transition-colors">
              <span className="font-black text-emerald-500 text-xl font-clash">
                {issuerInitials}
              </span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="text-[1.05rem] font-extrabold text-white font-clash leading-tight truncate">
              {totp.issuer || "Smart Code"}
            </div>
            <div 
              className="text-sm font-medium text-[#9B9691] font-satoshi mt-0.5 truncate transition-[filter] duration-300"
              style={{ filter: isVaultBlurEnabled ? 'blur(4.5px)' : 'none' }}
            >
              {totp.accountName || "No account info"}
            </div>
            
            <div className="flex flex-wrap gap-1 mt-2">
              {folderName && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-black bg-white/4 text-[#9B9691] uppercase tracking-wider">
                  {folderName}
                </span>
              )}
              {totp.sharedFrom && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.6rem] font-black bg-emerald-500/10 text-emerald-500 uppercase tracking-wider">
                  Received
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Code, Timer & Actions */}
        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto mt-5 sm:mt-0 pt-5 sm:pt-0 border-t sm:border-t-0 border-white/5">
          {/* 6-Digit Code & Copy Button */}
          <div className="flex items-center gap-3">
            <span 
              className="text-xl font-black font-mono tracking-wider text-emerald-500 transition-[filter] duration-300"
              style={{ filter: isVaultBlurEnabled ? 'blur(6px)' : 'none' }}
            >
              {code.substring(0, 3)} {code.substring(3)}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(code);
              }} 
              className="p-2 text-emerald-500 bg-emerald-500/5 border border-emerald-500/10 rounded-xl hover:bg-emerald-500/10 transition-colors"
            >
              <Copy className="h-[15px] w-[15px]" />
            </button>
          </div>

          {/* Time Countdown Indicator */}
          <div className="flex items-center gap-3">
            <span className={`text-xs font-black min-w-[22px] text-right ${
              timeRemaining <= 5 ? 'text-red-500' : 'text-[#9B9691]'
            }`}>
              {timeRemaining}s
            </span>
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-7 h-7 transform -rotate-90">
                <circle
                  cx="14"
                  cy="14"
                  r={radius}
                  className="stroke-white/5 fill-transparent"
                  strokeWidth="2.5"
                />
                <circle
                  cx="14"
                  cy="14"
                  r={radius}
                  className={`fill-transparent transition-[stroke-dashoffset] duration-1000 ${
                    timeRemaining <= 5 ? 'stroke-[#EF4444]' : 'stroke-[#10B981]'
                  }`}
                  strokeWidth="2.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Action Buttons (Pin, Lock/Link) */}
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={handlePinToggle}
              className={`p-1.5 rounded-lg transition-all duration-200 ${pinned ? 'text-[#F59E0B] bg-[#F59E0B]/5' : 'text-white/20 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'}`}
              title={pinned ? 'Unpin' : 'Pin'}
            >
              <Pin size={16} className={pinned ? 'fill-[#F59E0B]' : ''} />
            </button>
            <ShareLockButton 
                resourceType="totp"
                resourceId={totp.$id}
                isPublic={!!totp.isPublic}
                isGuest={!!totp.isGuest}
                accentColor="#10B981"
                canPublish={true}
                getCustomShareUrl={async () => {
                  let currentDek = (totp as any).dek;
                  if (!currentDek) {
                    const { decryptField, encryptField } = await import('@/lib/masterpass-crypto');
                    const { ecosystemSecurity } = await import('@/lib/ecosystem/security');
                    const { VaultService } = await import('@/lib/appwrite/vault');
                    
                    const newDek = await ecosystemSecurity.generateRandomMEK();
                    const rawKey = await crypto.subtle.exportKey("raw", newDek);
                    const dekBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
                    const wrappedDek = await encryptField(dekBase64);
                    
                    let decryptedSecret = totp.secretKey;
                    if (decryptedSecret && typeof decryptedSecret === 'string' && decryptedSecret.length > 20 && /^[A-Za-z0-9+/=]+$/.test(decryptedSecret)) {
                      decryptedSecret = await decryptField(decryptedSecret);
                    }
                    
                    let decryptedIssuer = totp.issuer;
                    if (decryptedIssuer && typeof decryptedIssuer === 'string' && decryptedIssuer.length > 20 && /^[A-Za-z0-9+/=]+$/.test(decryptedIssuer)) {
                      decryptedIssuer = await decryptField(decryptedIssuer);
                    }

                    let decryptedAccount = totp.accountName;
                    if (decryptedAccount && typeof decryptedAccount === 'string' && decryptedAccount.length > 20 && /^[A-Za-z0-9+/=]+$/.test(decryptedAccount)) {
                      decryptedAccount = await decryptField(decryptedAccount);
                    }
                    
                    // Pass plaintext fields + wrappedDek; VaultService will encrypt with new DEK
                    await VaultService.updateTOTPSecret(totp.$id, {
                      dek: wrappedDek,
                      secretKey: decryptedSecret,
                      issuer: decryptedIssuer ?? undefined,
                      accountName: decryptedAccount ?? undefined,
                    });
                    
                    totp.dek = wrappedDek;
                    totp.secretKey = decryptedSecret;
                    currentDek = wrappedDek;
                  }

                  let keyFragment = '';
                  if (currentDek) {
                    const { decryptField } = await import('@/lib/masterpass-crypto');
                    const dekBase64 = await decryptField(currentDek);
                    const urlSafeDek = dekBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                    keyFragment = `/${urlSafeDek}`;
                  }
                  const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
                  const baseUrl = buildPublicResourceUrl('totp', totp.$id);
                  return keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;
                }}
            />
          </div>
        </div>
      </div>
    );
  };

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
            onClick={() => setShowNew(true)}
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
        ) : totpCodes.length === 0 ? (
          <div className="p-24 text-center rounded-[32px] bg-[#161412] border border-dashed border-[#1C1A18] max-w-3xl">
            <Shield className="h-16 w-16 mx-auto mb-6 text-white/5" />
            <h2 className="text-xl font-black text-white mb-2 font-clash">
              No Smart Codes
            </h2>
            <p className="text-[#9B9691] max-w-xs mx-auto mb-8 text-sm">
              Your secure vault is ready to manage two-step verification codes.
            </p>
            <button 
              onClick={() => setShowNew(true)} 
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
              .map((totp) => (
                <TOTPCard key={totp.$id} totp={totp} />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
        className="flex-1 flex flex-col transition-[filter,opacity] duration-300"
        style={{
          filter: showMasterPassDrawer ? 'blur(8px)' : 'none',
          pointerEvents: showMasterPassDrawer ? 'none' : 'auto',
          opacity: showMasterPassDrawer ? 0.3 : 1,
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
