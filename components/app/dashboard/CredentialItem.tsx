import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Credentials } from '@/lib/appwrite/types';
import { Shield, ExternalLink, Copy, Edit2, Trash2, MoreVertical, User, Lock, Pin, CheckSquare, Sparkles, ChevronRight, Share2, ShieldCheck, Key, Link as LinkIcon } from 'lucide-react';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';

export default function CredentialItem({
  credential,
  onCopy,
  _isDesktop,
  onEdit,
  onDelete,
  onClick,
  onTogglePin,
  isBlurEnabled = false,
  isSelectMode = false,
  isSelected = false,
  onToggleSelect,
  onShared,
}: {
  credential: Credentials;
  onCopy: (value: string) => void;
  _isDesktop?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClick?: () => void;
  onTogglePin?: () => void;
  isBlurEnabled?: boolean;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onShared?: (id: string) => void;
}) {
  const { isPinned: isResourcePinned } = useResourcePins();
  const pinned = isResourcePinned('credential', credential.$id, credential.userId, credential.isPinned);
  const { openMenu } = useContextMenu();
  const [localIsPublic, setLocalIsPublic] = useState(!!credential.isPublic);
  const [localIsGuest, setLocalIsGuest] = useState(!!credential.isGuest);

  const handleCopy = (value: string) => {
    onCopy(value);
  };

  const getFaviconUrl = (url: string | null | undefined) => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(credential.url);

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'credential',
    resourceId: credential.$id,
    isPublic: !!credential.isPublic,
    isGuest: !!credential.isGuest,
    resourceTitle: credential.name,
    onUpdate: () => {
      // Parent handles refresh
    }
  });

  const handleShareLink = async () => {
    try {
      if (!localIsPublic) {
        const { toggleResourcePublicGuest } = await import('@/lib/actions/client-ops');
        const res = await toggleResourcePublicGuest({
          resourceType: 'credential',
          resourceId: credential.$id,
          mode: 'publish'
        });
        if (!res?.success) {
          const t = await import('react-hot-toast');
          t.default.error('Failed to make credential public.');
          return;
        }
        credential.isPublic = true;
        setLocalIsPublic(true);
        setLocalIsGuest(true);
      }

      let keyFragment = '';
      if (credential.dek) {
        const { decryptField } = await import('@/lib/masterpass-crypto');
        const dekBase64 = await decryptField(credential.dek);
        keyFragment = `/${encodeURIComponent(dekBase64)}`;
      }
      const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
      const baseUrl = buildPublicResourceUrl('credential', credential.$id);
      const fullUrl = keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;
      await navigator.clipboard.writeText(fullUrl);
      const t = await import('react-hot-toast');
      t.default.success('Public sharing link copied with DEK.');
    } catch (err: any) {
      const t = await import('react-hot-toast');
      t.default.error('Failed to copy share link: ' + err.message);
    }
  };

  const contextMenuItems = [
    { label: pinned ? "Unpin Secret" : "Pin Secret", icon: <Pin size={16} className={pinned ? "text-[#F59E0B]" : ""} />, onClick: () => onTogglePin?.() },
    { label: "Copy Public Link (DEK)", icon: <Share2 size={16} className="text-emerald-500" />, onClick: handleShareLink },
    ...accessControlItems,
    { 
        label: "Identity", 
        icon: <User size={16} />, 
        submenu: [
            { label: "Copy Username", icon: <User size={16} />, onClick: () => handleCopy(credential.username || "") },
            { label: "Copy Secret", icon: <Lock size={16} className="text-[#10B981]" />, onClick: () => handleCopy(credential.password || "") },
            { label: "Copy URL", icon: <ExternalLink size={16} />, onClick: () => handleCopy(credential.url || "") },
        ]
    },
    { 
        label: "Protection", 
        icon: <ShieldCheck size={16} />, 
        submenu: [
            { label: "AI Audit Security", icon: <Sparkles size={16} className="text-[#10B981]" />, onClick: () => { /* AI Logic */ } },
        ]
    },
    { 
        label: "Edit Record", 
        icon: <Edit2 size={16} />, 
        onClick: onEdit 
    },
    { 
        label: "Delete", 
        icon: <Trash2 size={16} className="text-[#FF453A]" />, 
        onClick: onDelete,
        variant: "destructive" as const
    }
  ];

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

  return (
    <div
      onClick={() => {
        if (isSelectMode && onToggleSelect) {
          onToggleSelect();
        } else if (onClick) {
          onClick();
        }
      }}
      onContextMenu={handleContextMenu}
      className={`group px-[18px] py-[14px] mb-3 rounded-[24px] border cursor-pointer transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center gap-[12px] shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),0_2px_3px_-3px_rgba(37,35,33,0.9)] ${
        isSelected 
          ? 'bg-[#1C1A18] border-[#10B981]/40 shadow-[0_8px_10px_-8px_rgba(0,0,0,1),0_6px_8px_-6px_rgba(37,35,33,1.0)]' 
          : 'bg-[#161412] border-[#34322F] hover:bg-[#1C1A18] hover:border-[#10B981]/20 hover:-translate-y-0.5 hover:shadow-[0_8px_10px_-8px_rgba(0,0,0,1),0_6px_8px_-6px_rgba(37,35,33,1.0)]'
      }`}
    >
      {isSelectMode && (
        <div className="shrink-0 flex items-center justify-center pr-1">
          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
            isSelected ? 'bg-[#10B981] border-[#10B981] text-[#0A0908]' : 'border-[#9B9691] bg-transparent'
          }`}>
            {isSelected && <CheckSquare className="w-4 h-4" />}
          </div>
        </div>
      )}

      {/* Icon */}
      <div 
        className="w-[52px] h-[52px] rounded-[16px] bg-white/[0.02] flex items-center justify-center shrink-0 border border-white/[0.05] overflow-hidden transition-all duration-300 group-hover:border-[#10B981]/20 group-hover:bg-[#10B981]/5"
      >
        {faviconUrl ? (
          <img src={faviconUrl} className="w-8 h-8 object-contain" alt="" />
        ) : (
          <span className="font-black text-[#10B981] text-[1.3rem] font-clash">
            {credential.name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px] pr-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {pinned && <Pin className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 fill-[#F59E0B]" />}
          <span className="font-black text-white leading-tight font-clash text-base truncate">
            {credential.name}
          </span>
        </div>
        <span 
          className="text-[#9B9691] font-medium text-[0.85rem] leading-[1.35] font-satoshi truncate transition-[filter] duration-300"
          style={{ filter: isBlurEnabled ? 'blur(4.5px)' : 'none' }}
        >
          {credential.username}
        </span>
        {(credential as any).sharedFrom && (
          <div className="mt-1 h-5 text-[0.62rem] font-black bg-[#10B981]/10 text-[#10B981] rounded-[6px] px-2 py-0.5 uppercase tracking-[0.02em] inline-flex items-center w-fit">
            Received from {(credential as any).sharedFrom}
          </div>
        )}
      </div>

      {/* Actions (Pin, Lock/Link) */}
      <div className="relative flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={(e) => { e.stopPropagation(); onTogglePin?.(); }}
          className={`p-1.5 rounded-lg transition-all duration-200 ${pinned ? 'text-[#F59E0B] bg-[#F59E0B]/5' : 'text-white/20 hover:text-[#F59E0B] hover:bg-[#F59E0B]/5'}`}
          title={pinned ? 'Unpin' : 'Pin'}
        >
          <Pin size={16} className={pinned ? 'fill-[#F59E0B]' : ''} />
        </button>

        <ShareLockButton 
          resourceType="credential"
          resourceId={credential.$id}
          isPublic={localIsPublic}
          isGuest={localIsGuest}
          accentColor="#10B981"
          onPublished={(result) => {
            setLocalIsPublic(result?.isPublic ?? true);
            setLocalIsGuest(result?.isGuest ?? true);
            credential.isPublic = result?.isPublic ?? true;
            credential.isGuest = result?.isGuest ?? true;
            onShared?.(credential.$id);
          }}
          getCustomShareUrl={async () => {
            let keyFragment = '';
            let currentDek = credential.dek;
            if (!currentDek) {
              const { decryptField, encryptField } = await import('@/lib/masterpass-crypto');
              const { ecosystemSecurity } = await import('@/lib/ecosystem/security');
              const { VaultService } = await import('@/lib/appwrite/vault');
              
              const newDek = await ecosystemSecurity.generateRandomMEK();
              const rawKey = await crypto.subtle.exportKey("raw", newDek);
              const dekBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
              const wrappedDek = await encryptField(dekBase64);
              
              // Collect plaintext fields (credential is already decrypted on client)
              const plaintextFields: Record<string, any> = { dek: wrappedDek };
              const fieldsToProcess = ['name', 'url', 'username', 'password', 'notes', 'customFields'];
              for (const field of fieldsToProcess) {
                const val = (credential as any)[field];
                if (val && typeof val === 'string' && val.length > 20 && /^[A-Za-z0-9+/=]+$/.test(val)) {
                  try {
                    plaintextFields[field] = await decryptField(val);
                  } catch {
                    plaintextFields[field] = val;
                  }
                } else {
                  plaintextFields[field] = val;
                }
              }
              
              // VaultService.updateCredential will encrypt fields with the new DEK
              await VaultService.updateCredential(credential.$id, plaintextFields as any);
              credential.dek = wrappedDek;
              for (const field of fieldsToProcess) {
                if (plaintextFields[field] !== undefined) (credential as any)[field] = plaintextFields[field];
              }
              currentDek = wrappedDek;
            }

            if (currentDek) {
              const { decryptField } = await import('@/lib/masterpass-crypto');
              const dekBase64 = await decryptField(currentDek);
              const urlSafeDek = dekBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
              keyFragment = `/${urlSafeDek}`;
            }
            const { buildPublicResourceUrl } = await import('@/lib/share/public-url');
            const baseUrl = buildPublicResourceUrl('credential', credential.$id);
            return keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;
          }}
        />
      </div>
    </div>
  );
}
