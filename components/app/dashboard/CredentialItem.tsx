import { useState, useEffect } from 'react';
import type { Credentials } from '@/lib/appwrite/types';
import { ExternalLink, Edit2, Trash2, User, Lock, Pin, CheckSquare, Sparkles, Wand2, Share2, ShieldCheck, FileCode2, FolderInput, Copy } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useSelection } from '@/context/SelectionContext';
import { ShareLockButton } from '@/components/share/ShareLockButton';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';
import { SyncStatusDot } from '@/components/ui/SyncStatusDot';
import { looksEncrypted } from '@/lib/masterpass-crypto';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getWorkflowSubmenuItems } from '@/components/workflows/workflow-submenu';

export default function CredentialItem({
  credential,
  onCopy,
  onEdit,
  onDelete,
  onClick,
  onTogglePin,
  isBlurEnabled = false,
  isSelectMode: propSelectMode,
  isSelected: propSelected,
  onToggleSelect,
  onShared}: {
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
  const { open: openUnified } = useUnifiedDrawer();
  const selection = useSelection();
  const isSelectMode = propSelectMode ?? (selection.isSelectMode && selection.activeKind === 'credential');
  const isSelected = propSelected ?? selection.isSelected(credential.$id, 'credential');
  const toggleSelectionHandler = onToggleSelect ?? (() => selection.toggleSelect(credential.$id, 'credential'));
  const { isPinned: isResourcePinned } = useResourcePins();
  const pinned = isResourcePinned('credential', credential.$id, credential.userId, credential.isPinned);
  const contextMenu = useContextMenu();
  const openMenu = contextMenu?.openMenu;
  const [localIsPublic, setLocalIsPublic] = useState(!!credential.isPublic);
  const [localIsGuest, setLocalIsGuest] = useState(!!credential.isGuest);
  const [displayCredential, setDisplayCredential] = useState<Credentials>(credential);
  const [isVaultUnlockedState, setIsVaultUnlockedState] = useState(() => {
    try {
      const { masterPassCrypto } = require('@/lib/masterpass-crypto');
      return !!(ecosystemSecurity.status.isUnlocked || masterPassCrypto.isVaultUnlocked());
    } catch { return !!ecosystemSecurity.status.isUnlocked; }
  });

  useEffect(() => {
    setDisplayCredential(credential);
  }, [credential]);

  useEffect(() => {
    setLocalIsPublic(!!credential.isPublic);
    setLocalIsGuest(!!credential.isGuest);
  }, [credential.isPublic, credential.isGuest]);

  // Self-heal: subscribe to masterpass unlock and re-evaluate whenever visited or sitting with encrypted placeholder
  useEffect(() => {
    const syncUnlock = () => {
      try {
        const { masterPassCrypto } = require('@/lib/masterpass-crypto');
        setIsVaultUnlockedState(!!(ecosystemSecurity.status.isUnlocked || masterPassCrypto.isVaultUnlocked()));
      } catch { setIsVaultUnlockedState(!!ecosystemSecurity.status.isUnlocked); }
    };
    const unsub = ecosystemSecurity.onStatusChange((s) => setIsVaultUnlockedState(!!s.isUnlocked));
    const onUnlock = () => setIsVaultUnlockedState(true);
    const onLock = () => setIsVaultUnlockedState(false);
    window.addEventListener('vault-unlocked', onUnlock);
    window.addEventListener('kylrix:vault-unlocked', onUnlock);
    window.addEventListener('vault-locked', onLock);
    // evaluate on mount/visit
    syncUnlock();
    return () => {
      unsub();
      window.removeEventListener('vault-unlocked', onUnlock);
      window.removeEventListener('kylrix:vault-unlocked', onUnlock);
      window.removeEventListener('vault-locked', onLock);
    };
  }, []);

  const { activeWorkspace } = useWorkspace();

  useEffect(() => {
    let cancelled = false;
    const tryDecrypt = async () => {
      const isAgentic = Boolean(activeWorkspace?.isAgentic || (credential as any).isAgentic);
      const isShared = Boolean(activeWorkspace && !activeWorkspace.isPersonal && activeWorkspace.isShared);

      // Only decrypt when vault is unlocked or inside an agentic workspace
      if (!isVaultUnlockedState && !isAgentic) {
        if (!cancelled) setDisplayCredential(credential);
        return;
      }

      try {
        const { masterPassCrypto, decryptField } = await import('@/lib/masterpass-crypto');
        const updated: any = { ...credential };
        let changed = false;

        // Personal non-agentic workspace: flat straight decrypt with user MEK
        if (!isAgentic && !isShared) {
          if (!masterPassCrypto.isVaultUnlocked()) {
            if (!cancelled) setDisplayCredential(credential);
            return;
          }

          let dekKey: CryptoKey | null = null;
          if (credential.dek && typeof credential.dek === 'string' && credential.dek.trim().length > 0) {
            try {
              const dekBase64 = await decryptField(credential.dek);
              const rawKey = new Uint8Array(atob(dekBase64).split('').map((c) => c.charCodeAt(0)));
              dekKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
            } catch {}
          }

          for (const field of ['name', 'username', 'url'] as const) {
            const val = (credential as any)[field];
            if (val && typeof val === 'string' && val.trim().length > 0) {
              try {
                let plain: string | null = null;
                if (dekKey) {
                  const dataBytes = atob(val).split('').map((c) => c.charCodeAt(0));
                  const dataIv = new Uint8Array(dataBytes.slice(0, 16));
                  const dataEncrypted = new Uint8Array(dataBytes.slice(16));
                  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dataIv }, dekKey, dataEncrypted);
                  plain = new TextDecoder().decode(dec);
                } else {
                  plain = await decryptField(val);
                }
                if (plain && plain !== val) {
                  updated[field] = plain;
                  changed = true;
                }
              } catch {}
            }
          }

          if (changed && !cancelled) setDisplayCredential(updated);
          else if (!changed && !cancelled) setDisplayCredential(credential);
          return;
        }

        // Agentic / Shared workspace: ecosystemSecurity resolution
        const { ecosystemSecurity } = await import('@/lib/ecosystem/security');
        let dekKey: CryptoKey | null = null;
        if (credential.dek && typeof credential.dek === 'string' && credential.dek.trim().length > 0) {
          try {
            const dekBase64 = await ecosystemSecurity.decryptWithWorkspace(credential.dek, activeWorkspace);
            const rawKey = new Uint8Array(atob(dekBase64).split('').map((c) => c.charCodeAt(0)));
            dekKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
          } catch {}
        }
        for (const field of ['name', 'username', 'url'] as const) {
          const val = (credential as any)[field];
          if (val && typeof val === 'string' && val.trim().length > 0) {
            try {
              let plain: string | null = null;
              if (dekKey) {
                try {
                  plain = await ecosystemSecurity.decryptWithKey(val, dekKey);
                } catch {
                  plain = await ecosystemSecurity.decryptWithWorkspace(val, activeWorkspace, credential.dek);
                }
              } else {
                plain = await ecosystemSecurity.decryptWithWorkspace(val, activeWorkspace, credential.dek);
              }
              if (plain && plain !== val) {
                updated[field] = plain;
                changed = true;
              }
            } catch {}
          }
        }
        if (changed && !cancelled) {
          setDisplayCredential(updated);
        } else if (!changed && !cancelled) {
          setDisplayCredential(credential);
        }
      } catch {}
    };
    void tryDecrypt();
    return () => { cancelled = true; };
  }, [credential, isVaultUnlockedState, activeWorkspace]);

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

  const faviconUrl = getFaviconUrl((displayCredential as any).url ?? credential.url);

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'credential',
    resourceId: credential.$id,
    isPublic: localIsPublic,
    isGuest: localIsGuest,
    resourceTitle: credential.name,
    onUpdate: (updatedFields?: { isPublic: boolean; isGuest: boolean }) => {
      if (updatedFields) {
        setLocalIsPublic(updatedFields.isPublic);
        setLocalIsGuest(updatedFields.isGuest);
        credential.isPublic = updatedFields.isPublic;
        credential.isGuest = updatedFields.isGuest;
        onShared?.(credential.$id);
      }
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
    {
      label: "Move to Workspace",
      icon: <FolderInput size={16} className="text-[#6366F1]" />,
      onClick: () => {
        openUnified('move-to-workspace', {
          entityKind: 'credential',
          entityId: credential.$id,
          entityTitle: credential.name || 'Secret Record',
          currentWorkspaceId: (credential as any).projectId || undefined,
        });
      },
    },
    {
      label: "Workflows",
      icon: <Lock size={16} className="text-[#A855F7]" />,
      submenu: getWorkflowSubmenuItems({
        objectType: 'secret',
        targetObject: {
          id: credential.$id,
          title: (displayCredential as any).name || 'Credential',
          content: (displayCredential as any).username || '',
          description: (displayCredential as any).notes || '',
          raw: credential,
        },
        activeWorkspaceId: activeWorkspace?.id || null,
        showSuccess: (msg) => toast.success(msg),
        showError: (msg) => toast.error(msg),
        showInfo: (msg) => toast(msg),
      }),
    },
    { label: "Select", icon: <CheckSquare size={16} className="text-[#10B981]" />, onClick: () => selection.enterSelectMode('credential', credential.$id) },
    { label: "Copy Public Link (DEK)", icon: <Share2 size={16} className="text-emerald-500" />, onClick: handleShareLink },
    ...accessControlItems,
    { 
        label: "Copy Content",
        icon: <Copy size={16} className="text-[#3B82F6]" />,
        submenu: (() => {
          const sub: any[] = [];
          const dName = (displayCredential as any).name || credential.name;
          const dUser = (displayCredential as any).username || credential.username;
          const dPass = (displayCredential as any).password || credential.password;
          const dUrl = (displayCredential as any).url || credential.url;
          const dNotes = (displayCredential as any).notes || credential.notes;

          if (dName && !looksEncrypted(dName)) {
            sub.push({ label: `Name (${dName.length > 18 ? dName.slice(0, 15) + '...' : dName})`, icon: <User size={16} />, onClick: () => handleCopy(dName) });
          }
          if (dUser && !looksEncrypted(dUser)) {
            sub.push({ label: `Username (${dUser.length > 18 ? dUser.slice(0, 15) + '...' : dUser})`, icon: <User size={16} />, onClick: () => handleCopy(dUser) });
          }
          if (dPass && !looksEncrypted(dPass)) {
            sub.push({ label: "Password / Secret Key", icon: <Lock size={16} className="text-[#10B981]" />, onClick: () => handleCopy(dPass) });
          }
          if (dUrl && !looksEncrypted(dUrl)) {
            sub.push({ label: `URL (${dUrl.length > 18 ? dUrl.slice(0, 15) + '...' : dUrl})`, icon: <ExternalLink size={16} />, onClick: () => handleCopy(dUrl) });
          }
          if (dNotes && !looksEncrypted(dNotes)) {
            sub.push({ label: "Notes", icon: <Copy size={16} />, onClick: () => handleCopy(dNotes) });
          }

          // Custom / Env fields
          try {
            const cfRaw = (displayCredential as any).customFields || credential.customFields;
            if (cfRaw && !looksEncrypted(String(cfRaw))) {
              const parsed = typeof cfRaw === 'string' ? JSON.parse(cfRaw) : cfRaw;
              if (Array.isArray(parsed)) {
                parsed.forEach((f: any, idx: number) => {
                  const key = f.key || f.label || `Field ${idx + 1}`;
                  const val = f.value || f.val || '';
                  if (val) {
                    sub.push({ label: `${key}`, icon: <FileCode2 size={16} className="text-[#10B981]" />, onClick: () => handleCopy(val) });
                  }
                });
              } else if (parsed && typeof parsed === 'object') {
                Object.entries(parsed).forEach(([k, v]) => {
                  if (v !== undefined && v !== null && String(v)) {
                    sub.push({ label: `${k}`, icon: <FileCode2 size={16} className="text-[#10B981]" />, onClick: () => handleCopy(String(v)) });
                  }
                });
              }
            }
          } catch {}

          if (sub.length === 0) {
            sub.push({ label: "Copy Full Record", icon: <Copy size={16} />, onClick: () => handleCopy(JSON.stringify(displayCredential, null, 2)) });
          }
          return sub;
        })()
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
    if (openMenu) {
      openMenu({
        x: e.clientX,
        y: e.clientY,
        items: contextMenuItems,
        appType: 'vault',
        title: credential.name || 'Credential',
      });
    }
  };

  return (
    <>
    <div
      onClick={() => {
        if (isSelectMode) {
          toggleSelectionHandler();
        } else if (onClick) {
          onClick();
        }
      }}
      onContextMenu={handleContextMenu}
      className={`group h-full px-[18px] py-[14px] rounded-[24px] border-2 cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex items-center gap-[12px] shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),0_2px_3px_-3px_rgba(37,35,33,0.9)] ${
        isSelected 
          ? 'bg-[#000000] border-[#10B981] shadow-[0_0_14px_rgba(16,185,129,0.35)]' 
          : 'bg-[#000000] border-white/20 hover:border-[#10B981] hover:shadow-[0_0_12px_rgba(16,185,129,0.2)] hover:-translate-y-0.5'
      }`}
    >
      {isSelectMode && (
        <div className="shrink-0 flex items-center justify-center pr-1">
          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
            isSelected ? 'bg-[#10B981] border-[#10B981] text-[#000000]' : 'border-white/50 bg-transparent'
          }`}>
            {isSelected && <CheckSquare className="w-4 h-4 text-black" />}
          </div>
        </div>
      )}

      {/* Icon */}
      <div 
        className="w-[52px] h-[52px] rounded-[16px] bg-[#161412] flex items-center justify-center shrink-0 border-2 border-white/20 overflow-hidden transition-all duration-300 group-hover:border-[#10B981]/60 group-hover:bg-[#10B981]/5"
      >
        {faviconUrl ? (
          <img src={faviconUrl} className="w-8 h-8 object-contain" alt="" />
        ) : (
          <span className="font-black text-[#10B981] text-[1.3rem] font-clash">
            {(displayCredential as any).name?.charAt(0)?.toUpperCase() || "?"}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px] pr-2">
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {pinned && <Pin className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 fill-[#F59E0B]" />}
          <span className="font-black text-white leading-tight font-clash text-base truncate flex-1 min-w-0">
            {looksEncrypted((displayCredential as any).name)
              ? (credential.isEnv ? 'Encrypted Env' : 'Encrypted Secret')
              : (displayCredential as any).name}
          </span>
          {Boolean(credential.isEnv) && (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black border border-[#10B981]/50 text-[0.62rem] font-bold text-white uppercase tracking-wider">
              <FileCode2 className="w-2.5 h-2.5 text-[#10B981]" />
              Env
            </span>
          )}
          <SyncStatusDot resourceId={credential.$id} kind="secret" row={displayCredential as unknown as Record<string, unknown>} />
        </div>
        <span 
          className="text-white/70 font-medium text-[0.85rem] leading-[1.35] font-satoshi truncate transition-[filter] duration-300"
          style={{ filter: isBlurEnabled ? 'blur(4.5px)' : 'none' }}
        >
          {credential.isEnv
            ? (() => {
                try {
                  const fields = displayCredential.customFields
                    ? JSON.parse(String(displayCredential.customFields))
                    : null;
                  const n = Array.isArray(fields) ? fields.length : fields && typeof fields === 'object' ? Object.keys(fields).length : 0;
                  return n > 0 ? `${n} variable${n === 1 ? '' : 's'}` : 'Environment bundle';
                } catch {
                  return looksEncrypted(String(displayCredential.customFields || ''))
                    ? 'Environment bundle'
                    : 'Environment bundle';
                }
              })()
            : looksEncrypted((displayCredential as any).username)
              ? '••••••••'
              : (displayCredential as any).username}
        </span>
        {(credential as any).sharedFrom && (
          <div className="mt-1 h-5 text-[0.62rem] font-black bg-[#10B981]/10 text-[#10B981] rounded-[6px] px-2 py-0.5 uppercase tracking-[0.02em] inline-flex items-center w-fit">
            Received from {(credential as any).sharedFrom}
          </div>
        )}
      </div>

      {/* Actions (Sidekick, Lock/Link) */}
      <div className="relative flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent('kylrix:open-sidekick', {
                detail: {
                  type: 'credential',
                  id: credential.$id,
                  title: (displayCredential as any).name,
                  content: (displayCredential as any).username || '',
                },
              })
            );
          }}
          className="p-1.5 rounded-lg transition-all duration-200 text-white hover:text-[#10B981] hover:bg-[#10B981]/5"
          title="Sidekick Assist"
          aria-label="Sidekick Assist"
        >
          <Wand2 size={16} />
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
