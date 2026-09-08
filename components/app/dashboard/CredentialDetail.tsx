'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ProjectLinker from '@/components/projects/ProjectLinker';
import type { Credentials } from '@/lib/appwrite/types';
import { storage, deleteCredential } from '@/lib/appwrite';
import { useSudo } from '@/context/SudoContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  ArrowLeft,
  X,
  Eye,
  EyeOff,
  Globe,
  ExternalLink,
  Folder,
  Share2,
  Lock,
  Tag as TagIcon,
  Trash2,
  Info,
  Copy,
  Check,
  FileCode2,
} from 'lucide-react';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import { toggleResourcePublicGuest } from '@/lib/actions/client-ops';
import { SyncStatusDot, SyncStatusLabel } from '@/components/ui/SyncStatusDot';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { looksEncrypted } from '@/lib/masterpass-crypto';
import { normalizeCustomFields, formatEnvText } from '@/lib/vault/parse-env';
import toast from 'react-hot-toast';

const labelClass =
  'text-[0.72rem] font-bold text-white tracking-[0.08em] uppercase font-satoshi';

export default function CredentialDetail({
  credential,
  onClose,
  isMobile,
  inline = false,
}: {
  credential: Credentials;
  onClose: () => void;
  isMobile: boolean;
  inline?: boolean;
}) {
  const [liveCredential, setLiveCredential] = useState<Credentials>(credential);
  const [showPassword, setShowPassword] = useState(false);
  const [showProjectLinker, setShowProjectLinker] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(!!credential.isPublic);
  const { requestSudo } = useSudo();
  const { open: openUnified } = useUnifiedDrawer();
  const { activeWorkspace } = useWorkspace();

  useEffect(() => {
    setLiveCredential(credential);
    let isCancelled = false;

    const decryptAllFields = async () => {
      try {
        const { masterPassCrypto, decryptField } = await import('@/lib/masterpass-crypto');
        const isAgentic = Boolean(activeWorkspace?.isAgentic || (credential as any).isAgentic);
        const isShared = Boolean(
          activeWorkspace && !activeWorkspace.isPersonal && activeWorkspace.isShared,
        );

        if (!masterPassCrypto.isVaultUnlocked() && !isAgentic) return;

        const fieldsToDecrypt = ['name', 'username', 'password', 'url', 'notes', 'customFields'];
        const updated = { ...credential };
        let changed = false;

        if (!isAgentic && !isShared) {
          if (!masterPassCrypto.isVaultUnlocked()) return;

          let dekKey: CryptoKey | null = null;
          if (credential.dek) {
            try {
              const dekBase64 = await decryptField(credential.dek);
              const rawKey = new Uint8Array(
                atob(dekBase64)
                  .split('')
                  .map((c) => c.charCodeAt(0)),
              );
              dekKey = await crypto.subtle.importKey(
                'raw',
                rawKey,
                { name: 'AES-GCM', length: 256 },
                true,
                ['decrypt'],
              );
            } catch {}
          }

          for (const field of fieldsToDecrypt) {
            const val = (credential as any)[field];
            if (val && typeof val === 'string' && val.trim().length > 0) {
              try {
                let plain: string | null = null;
                if (dekKey) {
                  const dataBytes = atob(val)
                    .split('')
                    .map((c) => c.charCodeAt(0));
                  const dataIv = new Uint8Array(dataBytes.slice(0, 16));
                  const dataEncrypted = new Uint8Array(dataBytes.slice(16));
                  const dec = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: dataIv },
                    dekKey,
                    dataEncrypted,
                  );
                  plain = new TextDecoder().decode(dec);
                } else {
                  plain = await decryptField(val);
                }
                if (plain && plain !== val) {
                  (updated as any)[field] = plain;
                  changed = true;
                }
              } catch {}
            }
          }

          if (changed && !isCancelled) setLiveCredential(updated);
          return;
        }

        const { ecosystemSecurity } = await import('@/lib/ecosystem/security');
        let dekKey: CryptoKey | null = null;
        if (credential.dek) {
          try {
            const dekBase64 = await ecosystemSecurity.decryptWithWorkspace(
              credential.dek,
              activeWorkspace,
            );
            const rawKey = new Uint8Array(
              atob(dekBase64)
                .split('')
                .map((c) => c.charCodeAt(0)),
            );
            dekKey = await crypto.subtle.importKey(
              'raw',
              rawKey,
              { name: 'AES-GCM', length: 256 },
              true,
              ['decrypt'],
            );
          } catch {}
        }

        for (const field of fieldsToDecrypt) {
          const val = (credential as any)[field];
          if (val && typeof val === 'string' && val.trim().length > 0) {
            try {
              let plain: string | null = null;
              if (dekKey) {
                try {
                  plain = await ecosystemSecurity.decryptWithKey(val, dekKey);
                } catch {
                  plain = await ecosystemSecurity.decryptWithWorkspace(
                    val,
                    activeWorkspace,
                    credential.dek,
                  );
                }
              } else {
                plain = await ecosystemSecurity.decryptWithWorkspace(
                  val,
                  activeWorkspace,
                  credential.dek,
                );
              }
              if (plain && plain !== val) {
                (updated as any)[field] = plain;
                changed = true;
              }
            } catch {}
          }
        }

        if (changed && !isCancelled) setLiveCredential(updated);
      } catch (e) {
        console.error('[CredentialDetail] Decryption error:', e);
      }
    };

    void decryptAllFields();
    return () => {
      isCancelled = true;
    };
  }, [credential, activeWorkspace]);

  const handleShareLink = useCallback(async () => {
    try {
      if (!isPublic) {
        const res = await toggleResourcePublicGuest({
          resourceType: 'credential',
          resourceId: credential.$id,
          mode: 'publish',
        });
        if (!res?.success) {
          toast.error('Failed to make credential public for sharing.');
          return;
        }
        setIsPublic(true);
        if (credential) credential.isPublic = true;
      }

      let currentDek = credential.dek;
      if (!currentDek) {
        const { decryptField, encryptField } = await import('@/lib/masterpass-crypto');
        const { VaultService } = await import('@/lib/appwrite/vault');
        const { ecosystemSecurity } = await import('@/lib/ecosystem/security');

        const newDek = await ecosystemSecurity.generateRandomMEK();
        const rawKey = await crypto.subtle.exportKey('raw', newDek);
        const dekBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
        const wrappedDek = await encryptField(dekBase64);

        const plaintextFields: Record<string, any> = { dek: wrappedDek };
        const fieldsToProcess = ['name', 'url', 'username', 'password', 'notes', 'customFields'];
        for (const field of fieldsToProcess) {
          const val = (liveCredential as any)[field] ?? (credential as any)[field];
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

        await VaultService.updateCredential(credential.$id, plaintextFields as any);
        credential.dek = wrappedDek;
        currentDek = wrappedDek;
      }

      let keyFragment = '';
      if (currentDek) {
        const { decryptField } = await import('@/lib/masterpass-crypto');
        const dekBase64 = await decryptField(currentDek);
        const urlSafeDek = dekBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        keyFragment = `/${urlSafeDek}`;
      }

      const baseUrl = buildPublicResourceUrl('credential', credential.$id);
      const fullUrl = keyFragment ? `${baseUrl}${keyFragment}` : baseUrl;
      await navigator.clipboard.writeText(fullUrl);
      toast.success('Public sharing link copied.');
    } catch (err: any) {
      toast.error('Failed to copy share link: ' + err.message);
    }
  }, [credential, isPublic, liveCredential]);

  const handleCopy = async (
    textToCopy: string | null | undefined,
    field: string,
    successMessage = 'Copied',
  ) => {
    if (!textToCopy) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(field);
      toast.success(successMessage);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Failed to copy');
    }
  };

  // BUGFIX: parse decrypted liveCredential, not encrypted prop
  const customFields = useMemo(
    () => normalizeCustomFields(liveCredential.customFields),
    [liveCredential.customFields],
  );

  const handleCopyAllEnvs = () => {
    if (!customFields.length) {
      toast.error('No variables to copy');
      return;
    }
    const envText = formatEnvText(customFields);
    handleCopy(envText, 'all-envs', 'Copied .env');
  };

  if (!credential) return null;

  const isEnv =
    Boolean(liveCredential.isEnv) ||
    (customFields.length > 0 && !liveCredential.password && !liveCredential.username);

  let attachments: any[] = [];
  try {
    if (liveCredential.attachments) {
      attachments = JSON.parse(liveCredential.attachments as string);
    }
  } catch {
    attachments = [];
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const getFaviconUrl = (url: string) => {
    if (!url) return null;
    try {
      return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(liveCredential.url || '');
  const shortId = liveCredential.$id
    ? `${liveCredential.$id.slice(0, 6)}…${liveCredential.$id.slice(-4)}`
    : '';

  const FieldValue = ({
    children,
    className = '',
    onClick,
    fieldId,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    fieldId?: string;
  }) => {
    const isFieldCopied = copied === fieldId;
    return (
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        className={`relative group p-3.5 rounded-xl bg-black border font-mono text-sm text-white break-all transition-colors ${
          onClick ? 'cursor-pointer hover:border-white/40' : 'cursor-default'
        } ${isFieldCopied ? 'border-[#10B981]' : 'border-white/20'} ${className}`}
      >
        {children}
        {onClick && (
          <span className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isFieldCopied ? (
              <Check className="w-3.5 h-3.5 text-[#10B981]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-white" />
            )}
          </span>
        )}
      </div>
    );
  };

  const content = (
    <div
      className={`h-full flex flex-col ${inline ? 'bg-transparent' : 'bg-[#161412]'} w-full min-h-0 text-white`}
    >
      <div className="px-5 py-4 flex flex-col gap-2.5 shrink-0 bg-[#161412]">
        <div className="flex items-center justify-between min-w-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black border border-white/20 text-white hover:border-white/40 transition-colors shrink-0"
              title="Back"
            >
              {isMobile ? <ArrowLeft className="w-4 h-4" /> : <X className="w-4 h-4" />}
            </button>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black border border-[#10B981]/40 text-[0.65rem] font-bold text-white uppercase tracking-wider font-satoshi shrink-0">
              {isEnv ? <FileCode2 className="w-3 h-3 text-[#10B981]" /> : <Lock className="w-3 h-3 text-[#10B981]" />}
              <span>{isEnv ? 'Env' : 'Secret'}</span>
            </span>
            {liveCredential.$id && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(liveCredential.$id, 'header-id');
                }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border font-mono text-[0.65rem] transition-colors shrink-0 ${
                  copied === 'header-id'
                    ? 'bg-black border-[#10B981] text-white'
                    : 'bg-black border-white/20 text-white hover:border-white/40'
                }`}
                title="Copy full ID"
              >
                {copied === 'header-id' ? (
                  <Check className="w-2.5 h-2.5 text-[#10B981]" />
                ) : (
                  <Copy className="w-2.5 h-2.5" />
                )}
                <span className="tracking-tight">{shortId}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isEnv && customFields.length > 0 && (
              <button
                type="button"
                onClick={handleCopyAllEnvs}
                className={`p-2 rounded-xl border transition-colors ${
                  copied === 'all-envs'
                    ? 'text-[#10B981] bg-black border-[#10B981]'
                    : 'text-white bg-black border-white/20 hover:border-white/40'
                }`}
                title={copied === 'all-envs' ? 'Copied .env' : 'Copy .env'}
              >
                {copied === 'all-envs' ? (
                  <Check className="w-4 h-4 text-[#10B981]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleShareLink}
              className={`p-2 rounded-xl border transition-colors ${
                isPublic
                  ? 'text-white bg-black border-[#10B981]/50'
                  : 'text-white bg-black border-white/20 hover:border-white/40'
              }`}
              title={isPublic ? 'Copy share link' : 'Publish & share'}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowProjectLinker(true)}
              className="p-2 rounded-xl text-white bg-black border border-white/20 hover:border-white/40 transition-colors"
              title="Link project"
            >
              <Folder className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                openUnified('delete-confirm', {
                  title: 'Delete Vault Secret?',
                  description: `Permanently delete "${credential.name}"?`,
                  onConfirm: async () => {
                    await deleteCredential(credential.$id);
                    toast.success('Secret deleted.');
                    onClose();
                  },
                });
              }}
              className="p-2 text-white hover:bg-black rounded-xl border border-transparent hover:border-white/20 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="w-full min-w-0 flex flex-col gap-1.5 pt-0.5">
          <h2
            onClick={() =>
              handleCopy(looksEncrypted(liveCredential.name) ? '' : liveCredential.name || '', 'title')
            }
            title="Click to copy title"
            className="w-full min-w-0 text-lg md:text-xl font-black font-clash text-white tracking-tight break-words [overflow-wrap:anywhere] cursor-pointer hover:underline"
          >
            {looksEncrypted(liveCredential.name) ? 'Encrypted Secret' : liveCredential.name}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <SyncStatusDot
              resourceId={liveCredential.$id}
              kind="secret"
              row={liveCredential as unknown as Record<string, unknown>}
            />
            <SyncStatusLabel
              resourceId={liveCredential.$id}
              kind="secret"
              row={liveCredential as unknown as Record<string, unknown>}
            />
          </div>
        </div>
      </div>

      <ProjectLinker
        open={showProjectLinker}
        onClose={() => setShowProjectLinker(false)}
        entityId={liveCredential.$id}
        entityKind="password"
      />

      <div className="flex-1 overflow-y-auto overscroll-contain p-5 flex flex-col gap-4 font-satoshi">
        {liveCredential.url && !looksEncrypted(liveCredential.url) && (
          <div className="p-4 rounded-2xl bg-black border border-white/20 flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-[#161412] flex items-center justify-center border border-white/20 shrink-0 overflow-hidden">
              {faviconUrl ? (
                <img src={faviconUrl} className="w-6 h-6 object-contain" alt="" />
              ) : (
                <span className="text-lg font-black text-white font-clash">
                  {liveCredential.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 flex flex-col gap-1">
              <span className={labelClass}>Website</span>
              <a
                href={liveCredential.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white hover:underline"
              >
                <Globe className="w-3.5 h-3.5 text-[#10B981]" />
                <span className="truncate">
                  {(() => {
                    try {
                      const u =
                        liveCredential.url.startsWith('http://') ||
                        liveCredential.url.startsWith('https://')
                          ? liveCredential.url
                          : `https://${liveCredential.url}`;
                      return new URL(u).hostname;
                    } catch {
                      return liveCredential.url;
                    }
                  })()}
                </span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {!isEnv && (
            <>
              {(liveCredential.username || !customFields.length) && (
                <div>
                  <div className="mb-1.5">
                    <span className={labelClass}>Username / Email</span>
                  </div>
                  <FieldValue
                    fieldId="username"
                    onClick={() =>
                      handleCopy(liveCredential.username || credential.username, 'username')
                    }
                  >
                    {looksEncrypted(liveCredential.username)
                      ? '••••••••'
                      : liveCredential.username || '—'}
                  </FieldValue>
                </div>
              )}

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-1.5">
                  <span className={labelClass}>Secret</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!showPassword) {
                        requestSudo({ onSuccess: () => setShowPassword(true) });
                      } else {
                        setShowPassword(false);
                      }
                    }}
                    className="h-6 text-[0.72rem] font-bold px-2 rounded-lg hover:bg-black flex items-center gap-1.5 transition-colors text-white border border-white/20"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <FieldValue
                  fieldId="password"
                  onClick={() =>
                    requestSudo({
                      onSuccess: () =>
                        handleCopy(liveCredential.password || credential.password, 'password'),
                    })
                  }
                  className={showPassword ? '' : 'tracking-[0.25em]'}
                >
                  {liveCredential.password
                    ? showPassword
                      ? liveCredential.password
                      : '••••••••••••••••'
                    : '—'}
                </FieldValue>
              </div>
            </>
          )}

          {customFields.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className={labelClass}>{isEnv ? 'Variables' : 'Custom Fields'}</span>
                {isEnv && (
                  <button
                    type="button"
                    onClick={handleCopyAllEnvs}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-satoshi border transition-colors ${
                      copied === 'all-envs'
                        ? 'bg-black border-[#10B981] text-[#10B981]'
                        : 'bg-black border-white/20 text-white hover:border-white/40'
                    }`}
                    title="Copy all variables as .env"
                  >
                    {copied === 'all-envs' ? (
                      <Check className="w-3.5 h-3.5 text-[#10B981]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copied === 'all-envs' ? 'Copied .env' : 'Copy .env'}</span>
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2.5">
                {customFields.map((field, index) => (
                  <div key={field.id || index} className="flex flex-col gap-1">
                    <span className="text-[0.72rem] font-medium text-white tracking-wide font-mono">
                      {field.label || `Field ${index + 1}`}
                    </span>
                    <FieldValue
                      fieldId={`custom-${index}`}
                      onClick={() => handleCopy(field.value || '', `custom-${index}`)}
                      className="text-xs"
                    >
                      {field.value || 'Empty'}
                    </FieldValue>
                  </div>
                ))}
              </div>
            </div>
          )}

          {liveCredential.notes && !looksEncrypted(liveCredential.notes) && (
            <div>
              <div className="mb-1.5">
                <span className={labelClass}>Notes</span>
              </div>
              <FieldValue
                fieldId="notes"
                onClick={() => handleCopy(liveCredential.notes || credential.notes, 'notes')}
                className="whitespace-pre-wrap font-sans text-xs leading-relaxed"
              >
                {liveCredential.notes}
              </FieldValue>
            </div>
          )}

          {credential.tags && credential.tags.length > 0 && (
            <div>
              <div className="mb-1.5">
                <span className={labelClass}>Tags</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {credential.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-black border border-white/20 text-white inline-flex items-center gap-1.5"
                  >
                    <TagIcon size={10} className="text-[#10B981]" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className={labelClass}>Attachments</span>
              {attachments.map((att: any, index: number) => {
                let fileUrl = '';
                try {
                  fileUrl = String(storage.getFileView('vault_attachments', att.id));
                } catch {}
                return (
                  <div
                    key={att.id || index}
                    className="p-3.5 rounded-xl border border-white/20 bg-black"
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <p className="text-xs font-bold text-white break-all">{att.name}</p>
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-md text-[#10B981] hover:bg-[#161412] shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <p className="text-[0.72rem] text-white uppercase tracking-wide">
                      {(att.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <span className={`${labelClass} mb-2.5 flex items-center gap-1.5`}>
              <Info className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Timestamps</span>
            </span>
            <div className="flex flex-col gap-1.5 text-xs text-white bg-black border border-white/20 rounded-xl p-3.5">
              {credential.createdAt && (
                <p className="flex justify-between gap-3">
                  <span className="font-medium uppercase tracking-wide text-[0.72rem]">Created</span>
                  <span className="font-bold">{formatDate(credential.createdAt)}</span>
                </p>
              )}
              {credential.updatedAt && (
                <p className="flex justify-between gap-3">
                  <span className="font-medium uppercase tracking-wide text-[0.72rem]">Updated</span>
                  <span className="font-bold">{formatDate(credential.updatedAt)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      <div className="absolute inset-0 bg-black/80 animate-in fade-in" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[480px] h-full bg-[#161412] border-l border-white/20 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {content}
      </div>
    </div>
  );
}
