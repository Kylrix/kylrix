'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  createCredential,
  updateCredential,
} from '@/lib/appwrite';
import type { Credentials, CredentialsCreate } from '@/lib/appwrite/types';
import { useAppwriteVault } from '@/context/appwrite-context';
import { generateRandomPassword } from '@/utils/password';
import { useDrawerState } from '@/components/ui/DrawerStateContext';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  Globe,
  Lock,
  Plus,
  RotateCw,
  Save,
  Tag,
  Trash2,
  UploadCloud,
  User,
  X,
  CreditCard,
} from 'lucide-react';
import { useSection } from '@/context/SectionContext';
import { useSudo } from '@/context/SudoContext';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { useWorkspace } from '@/context/WorkspaceContext';
import { NativeSidebarMount } from '@/components/layout/NativeSidebarMount';
import {
  ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS,
  measureEnvFieldsJson,
  normalizeCustomFields,
  parseEnvText,
  type EnvField,
} from '@/lib/vault/parse-env';
import {
  clearSealedVaultDraft,
  readSealedVaultDraft,
  wipeLegacyPlainVaultDrafts,
  writeSealedVaultDraft,
} from '@/lib/vault/sealed-draft';

type CustomField = EnvField;

const inputClass =
  'w-full bg-black text-white placeholder-white border border-white/20 rounded-xl px-4 py-3 text-sm font-satoshi focus:outline-none focus:border-white/40 transition-colors';
const labelClass =
  'text-[0.72rem] font-bold text-white tracking-[0.08em] uppercase font-satoshi';

export default function CredentialDialog({
  open,
  onClose,
  initial,
  onSaved,
  prefill,
  defaultType = 'login',
}: {
  open: boolean;
  onClose: () => void;
  initial?: Credentials | null;
  onSaved: (saved?: Credentials) => void;
  prefill?: { name?: string; url?: string; username?: string };
  defaultType?: string;
}) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { user } = useAppwriteVault();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const { setIsDrawerOpen } = useDrawerState();
  const { setActiveDetail } = useSection();
  const { requestSudo } = useSudo();
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    onClose();
    setIsExpanded(false);
    setIsNameManuallyEdited(false);
  };

  useEffect(() => {
    setIsDrawerOpen(open);
    return () => setIsDrawerOpen(false);
  }, [open, setIsDrawerOpen]);

  const [showPassword, setShowPassword] = useState(false);
  const [isEnvMode, setIsEnvMode] = useState(false);
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    tags: '',
    cardNumber: '',
    cardholderName: '',
    cardExpiry: '',
    cardCVV: '',
    cardPIN: '',
    cardType: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [envHint, setEnvHint] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wipe legacy plaintext drafts once.
  useEffect(() => {
    wipeLegacyPlainVaultDrafts();
  }, []);

  // Create-only: hydrate sealed draft (MEK) into RAM form.
  useEffect(() => {
    if (!open || initial || !user?.$id) {
      setDraftReady(!open || Boolean(initial));
      return;
    }
    let cancelled = false;
    setDraftReady(false);
    (async () => {
      const empty = () => {
        setForm({
          name: prefill?.name || '',
          username: prefill?.username || '',
          password: '',
          url: prefill?.url || '',
          notes: '',
          tags: '',
          cardNumber: '',
          cardholderName: '',
          cardExpiry: '',
          cardCVV: '',
          cardPIN: '',
          cardType: '',
        });
        setCustomFields([]);
        setIsEnvMode(false);
        setIsNameManuallyEdited(Boolean(prefill?.name));
        setAttachments([]);
        setEnvHint(null);
        setError(null);
      };

      if (!masterPassCrypto.isVaultUnlocked()) {
        if (!cancelled) {
          empty();
          setDraftReady(true);
        }
        return;
      }
      const draft = await readSealedVaultDraft(user.$id, 'secret');
      if (cancelled) return;
      if (!draft) {
        empty();
        setDraftReady(true);
        return;
      }
      setForm((f) => ({
        ...f,
        name: '',
        username: '',
        password: '',
        url: '',
        notes: '',
        tags: '',
        cardNumber: '',
        cardholderName: '',
        cardExpiry: '',
        cardCVV: '',
        cardPIN: '',
        cardType: '',
        ...draft.form,
      }));
      setCustomFields(draft.customFields || []);
      setIsEnvMode(Boolean(draft.isEnvMode));
      setIsNameManuallyEdited(Boolean(draft.isNameManuallyEdited));
      setAttachments([]);
      setEnvHint(null);
      setError(null);
      setDraftReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initial, user?.$id, prefill?.name, prefill?.username, prefill?.url]);

  // Create-only: debounce seal → LocalEngine draft key (never plaintext).
  useEffect(() => {
    if (!open || initial || !draftReady || !user?.$id) return;
    if (!masterPassCrypto.isVaultUnlocked()) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      void writeSealedVaultDraft(user.$id, 'secret', {
        form,
        customFields,
        isEnvMode,
        isNameManuallyEdited,
        defaultType,
      });
    }, 450);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    open,
    initial,
    draftReady,
    user?.$id,
    form,
    customFields,
    isEnvMode,
    isNameManuallyEdited,
    defaultType,
  ]);

  // Edit-only: decrypt row into RAM form (never write decrypted to LocalEngine).
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      if (!initial || !open) return;

      let row: any = { ...initial };
      try {
        const { looksEncrypted, decryptField } = await import('@/lib/masterpass-crypto');
        if (masterPassCrypto.isVaultUnlocked()) {
          let dekKey: CryptoKey | null = null;
          if (row.dek) {
            try {
              const dekBase64 = await decryptField(row.dek);
              const rawKey = new Uint8Array(atob(dekBase64).split('').map((c) => c.charCodeAt(0)));
              dekKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
            } catch {}
          }
          const fields = ['name', 'username', 'password', 'url', 'notes', 'customFields', 'cardNumber', 'cardholderName', 'cardExpiry', 'cardCVV', 'cardPIN'];
          for (const field of fields) {
            const val = row[field];
            if (typeof val === 'string' && val && looksEncrypted(val)) {
              try {
                if (dekKey) {
                  const dataBytes = atob(val).split('').map((c: string) => c.charCodeAt(0));
                  const dataIv = new Uint8Array(dataBytes.slice(0, 16));
                  const dataEncrypted = new Uint8Array(dataBytes.slice(16));
                  const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dataIv }, dekKey, dataEncrypted);
                  row[field] = new TextDecoder().decode(dec);
                } else {
                  row[field] = await decryptField(val);
                }
              } catch {}
            }
          }
        }
      } catch {}

      if (cancelled) return;
      setForm({
        name: row.name || '',
        username: row.username || '',
        password: row.password || '',
        url: row.url || '',
        notes: row.notes || '',
        tags: row.tags ? row.tags.join(', ') : '',
        cardNumber: row.cardNumber || '',
        cardholderName: row.cardholderName || '',
        cardExpiry: row.cardExpiry || '',
        cardCVV: row.cardCVV || '',
        cardPIN: row.cardPIN || '',
        cardType: row.cardType || '',
      });
      setCustomFields(normalizeCustomFields(row.customFields));
      setIsEnvMode(Boolean(row.isEnv));
      setIsNameManuallyEdited(true);
      try {
        setAttachments(row.attachments ? JSON.parse(row.attachments) : []);
      } catch {
        setAttachments([]);
      }
      setEnvHint(null);
      setError(null);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [initial, open]);

  const applyEnvText = useCallback((text: string) => {
    const parsed = parseEnvText(text);
    if (!parsed.length) {
      setEnvHint('No KEY=VALUE lines found.');
      return;
    }
    if (measureEnvFieldsJson(parsed) > ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS) {
      setError('This file is too large for one secret. Split it into smaller bundles.');
      return;
    }
    setCustomFields(parsed);
    setIsEnvMode(true);
    setEnvHint(`${parsed.length} variable${parsed.length === 1 ? '' : 's'} ready`);
    setError(null);
    const autoTitle = parsed[0]?.label?.trim() || 'Env';
    setForm((f) => {
      if (isNameManuallyEdited && f.name.trim()) return f;
      return { ...f, name: autoTitle };
    });
  }, [isNameManuallyEdited]);

  const handlePasteEnv = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      applyEnvText(text);
    } catch {
      setError('Could not read clipboard. Paste into a text file and upload instead.');
    }
  }, [applyEnvText]);

  const handleEnvFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const text = await file.text();
        applyEnvText(text);
        if (!isNameManuallyEdited) {
          const base = file.name.replace(/\.(env|txt|dotenv)$/i, '').trim();
          if (base) {
            setForm((f) => ({ ...f, name: base }));
          }
        }
      } catch {
        setError('Could not read that file.');
      }
    },
    [applyEnvText, isNameManuallyEdited],
  );

  const syncNameFromUsername = useCallback(
    (username: string) => {
      setForm((f) => ({
        ...f,
        username,
        name: isNameManuallyEdited ? f.name : username.trim(),
      }));
    },
    [isNameManuallyEdited],
  );

  const resolveSecretName = useCallback((): string => {
    const explicit = form.name.trim();
    if (explicit) return explicit;
    if (isEnvMode) {
      const first = customFields.find((f) => f.label.trim())?.label.trim();
      return first || 'Env';
    }
    return form.username.trim() || form.cardholderName.trim() || 'Untitled Secret';
  }, [form.name, form.username, form.cardholderName, isEnvMode, customFields]);

  const handleGeneratePassword = () => {
    setForm({ ...form, password: generateRandomPassword(16) });
  };

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: Date.now().toString(), label: '', value: '' },
    ]);
  };

  const updateCustomField = (id: string, field: 'label' | 'value', value: string) => {
    setCustomFields(customFields.map((cf) => (cf.id === id ? { ...cf, [field]: value } : cf)));
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter((cf) => cf.id !== id));
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !initial?.$id) return;
    setUploadingAttachment(true);
    setError(null);
    try {
      const { addAttachmentToCredential } = await import('@/lib/appwrite/vault');
      const updated = await addAttachmentToCredential(initial.$id, file);
      setAttachments(updated.attachments ? JSON.parse(updated.attachments) : []);
    } catch (err: any) {
      setError(err.message || 'Failed to upload attachment.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (fileId: string) => {
    if (!initial?.$id) return;
    setError(null);
    try {
      const { deleteCredentialAttachment } = await import('@/lib/appwrite/vault');
      const updated = await deleteCredentialAttachment(initial.$id, fileId);
      setAttachments(updated.attachments ? JSON.parse(updated.attachments) : []);
    } catch (err: any) {
      setError(err.message || 'Failed to delete attachment.');
    }
  };

  const buildCredentialData = (): CredentialsCreate => {
    if (!user) throw new Error('Not authenticated');
    const type = initial?.itemType || defaultType;
    const credentialData: CredentialsCreate = {
      userId: user.$id,
      itemType: type,
      name: resolveSecretName(),
      url: null,
      username: null,
      notes: null,
      totpId: initial?.totpId || null,
      cardNumber: null,
      cardholderName: null,
      cardExpiry: null,
      cardCVV: null,
      cardPIN: null,
      cardType: null,
      folderId: initial?.folderId || null,
      tags: null,
      customFields: null,
      faviconUrl: null,
      isFavorite: initial?.isFavorite || false,
      isDeleted: initial?.isDeleted || false,
      deletedAt: initial?.deletedAt || null,
      lastAccessedAt: initial?.lastAccessedAt || null,
      passwordChangedAt: initial?.passwordChangedAt || null,
      password: null,
      isEnv: Boolean(isEnvMode),
      createdAt:
        initial && initial.createdAt ? initial.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isEnvMode) {
      const usable = customFields.filter((f) => f.label.trim());
      if (!usable.length) throw new Error('Add at least one environment variable.');
      if (measureEnvFieldsJson(usable) > ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS) {
        throw new Error('Environment bundle is too large. Split into smaller secrets.');
      }
      if (!resolveSecretName()) throw new Error('Title is required.');
      credentialData.name = resolveSecretName();
      credentialData.customFields = JSON.stringify(usable);
      credentialData.password = null;
      credentialData.username = null;
      credentialData.url = null;
      credentialData.isEnv = true;
    } else if (type === 'login') {
      credentialData.username = form.username.trim();
      credentialData.password = form.password.trim();
      if (form.url && form.url.trim()) credentialData.url = form.url.trim();
      if (customFields.length > 0) {
        credentialData.customFields = JSON.stringify(customFields);
      }
    } else if (type === 'card') {
      credentialData.cardNumber = form.cardNumber.trim();
      credentialData.cardholderName = form.cardholderName.trim();
      credentialData.cardExpiry = form.cardExpiry.trim();
      credentialData.cardCVV = form.cardCVV.trim();
      credentialData.cardPIN = form.cardPIN.trim();
      credentialData.cardType = form.cardType.trim();
    }

    if (form.notes && form.notes.trim()) credentialData.notes = form.notes.trim();
    if (form.tags && form.tags.trim()) {
      const tagsArr = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (tagsArr.length > 0) credentialData.tags = tagsArr;
    }

    return credentialData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!masterPassCrypto.isVaultUnlocked()) {
      requestSudo({
        onSuccess: () => {
          const fake = { preventDefault() {} } as React.FormEvent;
          void handleSubmit(fake);
        },
      });
      return;
    }

    setLoading(true);
    try {
      const credentialData = buildCredentialData();
      const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
      if (isCustomWorkspace) {
        (credentialData as any).isWorkspace = true;
      }

      // RAM-only optimistic UX. Never write plaintext secrets to LocalEngine / RxDB /
      // localStorage — disk cache must stay ciphertext (raw Appwrite rows only).
      if (initial && initial.$id) {
        const saved = await updateCredential(initial.$id, credentialData);
        onSaved((saved || { ...initial, ...credentialData, $id: initial.$id }) as any);
      } else {
        const created = await createCredential(credentialData);
        if (isCustomWorkspace && (created?.$id || (created as any)?.id)) {
          void attachEntityToActiveWorkspace(
            'credential',
            created.$id || (created as any).id,
          );
        }
        if (user?.$id) await clearSealedVaultDraft(user.$id, 'secret');
        onSaved(created as any);
      }
      handleClose();
      setLoading(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || 'Failed to save credential.');
      setLoading(false);
    }
  };

  const handleMorphToDetail = async () => {
    if (!resolveSecretName()) return;
    if (!masterPassCrypto.isVaultUnlocked()) {
      requestSudo({ onSuccess: () => void handleMorphToDetail() });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const credentialData = buildCredentialData();
      let saved: any;
      if (initial && initial.$id) {
        saved = await updateCredential(initial.$id, credentialData);
      } else {
        saved = await createCredential(credentialData);
        if (user?.$id) await clearSealedVaultDraft(user.$id, 'secret');
      }
      onSaved();
      if (saved && (saved.$id || saved.id)) {
        setActiveDetail({ type: 'secret', id: saved.$id || saved.id, data: saved });
      }
      handleClose();
      setLoading(false);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || 'Failed to save credential.');
      setLoading(false);
    }
  };

  const currentType = initial?.itemType || defaultType;
  const showLoginFields = currentType === 'login' && !isEnvMode;

  const credentialForm = (
    <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0 overflow-hidden bg-[#161412]">
      <div className="px-5 py-4 flex items-center justify-between shrink-0 font-clash">
        <div className="flex items-center gap-3 text-base font-bold text-white">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
          <span>
            {initial ? 'Edit' : 'New'}{' '}
            {isEnvMode ? 'Env' : currentType.charAt(0).toUpperCase() + currentType.slice(1)}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {resolveSecretName().length > 0 && (
            <button
              type="button"
              onClick={handleMorphToDetail}
              className="p-1.5 rounded-lg text-white hover:bg-black transition-colors"
              title="Open detail"
            >
              <ArrowUpRight className="w-5 h-5" />
            </button>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-white hover:bg-black transition-colors"
              aria-label={isExpanded ? 'Collapse' : 'Expand fullscreen'}
            >
              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full bg-black border border-white/20 text-white hover:border-white/40 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-5 pb-5 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 font-satoshi">
        {currentType === 'login' && (
          <div className="flex flex-col gap-2 w-full">
            <label className={labelClass}>
              Title <span className="text-[#ef4444]">*</span>
            </label>
            <input
              type="text"
              placeholder={isEnvMode ? 'e.g. Production API' : 'e.g. GitHub, Gmail'}
              value={form.name}
              onChange={(e) => {
                setIsNameManuallyEdited(true);
                setForm({ ...form, name: e.target.value });
              }}
              required
              className={inputClass}
            />
          </div>
        )}

        {currentType === 'login' && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/20 bg-black px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileCode2 className="w-4 h-4 text-white shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  {isMobile ? 'Env variables' : 'Environment variables'}
                </p>
                <p className="text-[0.72rem] font-medium text-white tracking-wide uppercase">
                  One secret · many keys
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isEnvMode}
              onClick={() => {
                setIsEnvMode((v) => {
                  const next = !v;
                  if (next && !isNameManuallyEdited) {
                    const first = customFields.find((f) => f.label.trim())?.label.trim();
                    if (first) setForm((f) => ({ ...f, name: first }));
                  }
                  return next;
                });
                setEnvHint(null);
                setError(null);
              }}
              className={`relative h-7 w-12 rounded-full border border-white/25 transition-colors shrink-0 ${
                isEnvMode ? 'bg-[#10B981]' : 'bg-[#161412]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5.5 w-5.5 rounded-full bg-white transition-transform ${
                  isEnvMode ? 'translate-x-5' : 'translate-x-0'
                }`}
                style={{ height: 22, width: 22 }}
              />
            </button>
          </div>
        )}

        {isEnvMode && currentType === 'login' && (
          <div className="flex flex-col gap-3 rounded-xl border border-white/20 bg-black p-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePasteEnv}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/20 bg-[#161412] text-white text-sm font-bold hover:border-white/40 transition-colors"
              >
                <ClipboardPaste className="w-4 h-4" />
                Paste
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/20 bg-[#161412] text-white text-sm font-bold hover:border-white/40 transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".env,.txt,text/plain"
                className="hidden"
                onChange={handleEnvFile}
              />
            </div>
            {envHint && (
              <p className="text-[0.72rem] font-medium text-white tracking-wide uppercase px-0.5">
                {envHint}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className={labelClass}>Variables</span>
              <button
                type="button"
                onClick={addCustomField}
                className="flex items-center gap-1 text-xs font-bold text-[#10B981] hover:bg-[#10B981]/10 px-2 py-1 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
            {customFields.length === 0 ? (
              <p className="text-sm text-white py-2">
                Paste a .env or upload a file — keys show up here.
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-[28dvh] overflow-y-auto pr-0.5">
                {customFields.map((field) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="KEY"
                      value={field.label}
                      onChange={(e) => updateCustomField(field.id, 'label', e.target.value)}
                      className={`${inputClass} flex-[0.9] py-2.5 font-mono text-xs`}
                    />
                    <input
                      type="text"
                      placeholder="value"
                      value={field.value}
                      onChange={(e) => updateCustomField(field.id, 'value', e.target.value)}
                      className={`${inputClass} flex-[1.1] py-2.5 font-mono text-xs`}
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(field.id)}
                      className="p-2 text-white hover:bg-[#161412] rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showLoginFields && (
          <>
            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>Username / Email</label>
              <div className="relative w-full">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
                <input
                  type="text"
                  placeholder="you@example.com"
                  value={form.username}
                  onChange={(e) => syncNameFromUsername(e.target.value)}
                  className={`${inputClass} pl-11`}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>Secret</label>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Secret"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className={`${inputClass} pl-11 pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white"
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="flex items-center justify-center bg-black text-[#10B981] border border-white/20 rounded-xl w-12 h-12 shrink-0 hover:border-[#10B981]/50"
                  title="Generate"
                >
                  <RotateCw className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>Website URL</label>
              <div className="relative w-full">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className={`${inputClass} pl-11`}
                />
              </div>
            </div>
          </>
        )}

        {currentType === 'card' && (
          <>
            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>
                Card Number <span className="text-[#ef4444]">*</span>
              </label>
              <div className="relative w-full">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
                <input
                  type="text"
                  placeholder="•••• •••• •••• ••••"
                  value={form.cardNumber}
                  onChange={(e) => setForm({ ...form, cardNumber: e.target.value })}
                  required
                  className={`${inputClass} pl-11`}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <label className={labelClass}>
                Cardholder Name <span className="text-[#ef4444]">*</span>
              </label>
              <input
                type="text"
                placeholder="JOHN DOE"
                value={form.cardholderName}
                onChange={(e) => {
                  const cardholderName = e.target.value;
                  setForm((f) => ({
                    ...f,
                    cardholderName,
                    name: isNameManuallyEdited ? f.name : cardholderName.trim(),
                  }));
                }}
                required
                className={inputClass}
              />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-2 flex-1">
                <label className={labelClass}>
                  Expiry <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="MM/YY"
                  value={form.cardExpiry}
                  onChange={(e) => setForm({ ...form, cardExpiry: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className={labelClass}>
                  CVV <span className="text-[#ef4444]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="•••"
                  value={form.cardCVV}
                  onChange={(e) => setForm({ ...form, cardCVV: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-2 w-full">
          <label className={labelClass}>Tags</label>
          <div className="relative w-full">
            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-white pointer-events-none" />
            <input
              type="text"
              placeholder="work, api, private"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className={`${inputClass} pl-11`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <label className={labelClass}>
            {currentType === 'note' ? 'Note Content' : 'Notes'}
          </label>
          <div className="relative w-full">
            <FileText className="absolute left-4 top-3 w-[18px] h-[18px] text-white pointer-events-none" />
            <textarea
              rows={currentType === 'note' ? 8 : 2}
              placeholder={
                currentType === 'note' ? 'Write your secure note here...' : 'Optional notes...'
              }
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={`${inputClass} pl-11 resize-none`}
            />
          </div>
        </div>

        {!isEnvMode && (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between">
              <span className={labelClass}>Custom Fields</span>
              <button
                type="button"
                onClick={addCustomField}
                className="flex items-center gap-1.5 text-xs text-[#10B981] font-bold hover:bg-[#10B981]/10 px-2.5 py-1.5 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {customFields.map((field) => (
              <div key={field.id} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Label"
                  value={field.label}
                  onChange={(e) => updateCustomField(field.id, 'label', e.target.value)}
                  className={`${inputClass} flex-1 py-2.5`}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) => updateCustomField(field.id, 'value', e.target.value)}
                  className={`${inputClass} flex-1 py-2.5`}
                />
                <button
                  type="button"
                  onClick={() => removeCustomField(field.id)}
                  className="p-2 text-white hover:bg-black rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Attachments</span>
            {initial && initial.$id && (
              <label
                className={`flex items-center gap-1.5 text-xs text-[#10B981] font-bold hover:bg-[#10B981]/10 px-2.5 py-1.5 rounded-lg cursor-pointer ${
                  uploadingAttachment ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {uploadingAttachment ? (
                  <div className="w-4 h-4 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>{uploadingAttachment ? 'Uploading…' : 'Upload'}</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadAttachment}
                  disabled={uploadingAttachment}
                />
              </label>
            )}
          </div>
          {initial && initial.$id ? (
            attachments.length === 0 ? (
              <p className="text-sm text-white">No files yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {attachments.map((att: any, idx: number) => (
                  <div
                    key={att.id || idx}
                    className="flex justify-between items-center p-3 rounded-xl bg-black border border-white/20"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-sm font-bold text-white truncate">{att.name}</p>
                      <p className="text-[0.72rem] text-white uppercase tracking-wide">
                        {(att.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="p-2 text-white hover:bg-[#161412] rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-white">Save first to attach files.</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-black text-[#ef4444] p-3 rounded-xl border border-white/20 text-xs font-medium">
            {error}
          </div>
        )}
      </div>

      <div className="px-5 py-4 shrink-0 border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold bg-[#10B981] hover:bg-[#0fa976] text-black disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-clash"
        >
          {!loading && <Save className="w-4 h-4" />}
          <span>
            {loading ? 'Saving…' : initial ? 'Update' : isEnvMode ? 'Save Env' : 'Save Secret'}
          </span>
        </button>
      </div>
    </form>
  );

  if (!open) return null;

  if (!isMobile) {
    return (
      <NativeSidebarMount
        active={open}
        sidebarKey="create-secret"
        width={520}
        title={initial ? 'Edit Secret' : isEnvMode ? 'New Env' : 'New Secret'}
      >
        <div className="h-full bg-[#161412] flex flex-col overflow-hidden">{credentialForm}</div>
      </NativeSidebarMount>
    );
  }

  // Portal + high z-index so fullscreen sits above topbar/bottom chrome (matches ObjectCreateDrawer).
  return createPortal(
    <div className="fixed inset-0 z-[14000] flex pointer-events-auto overflow-hidden">
      <div
        className="absolute inset-0 bg-black/80 transition-opacity duration-200"
        onClick={handleClose}
      />
      <div
        className={
          isExpanded
            ? 'fixed inset-0 h-[100dvh] max-h-[100dvh] w-full bg-[#161412] border-0 rounded-none z-[14001] flex flex-col overflow-hidden'
            : 'fixed bottom-0 left-1/2 -translate-x-1/2 h-[60dvh] max-h-[60dvh] w-full max-w-[720px] bg-[#161412] border border-white/20 border-b-0 rounded-t-[24px] z-[14001] flex flex-col overflow-hidden'
        }
      >
        {credentialForm}
      </div>
    </div>,
    document.body,
  );
}
