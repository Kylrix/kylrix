'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { parseEnvText, measureEnvFieldsJson, ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS, type EnvField } from '@/lib/vault/parse-env';
import { createCredential } from '@/lib/appwrite';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { useSudo } from '@/context/SudoContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { KeyRound, Lock, Loader2, X, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface ObjectQuickActionCardProps {
  content?: string | null;
  title?: string;
  objectId?: string;
  objectKind?: 'idea' | 'note' | 'goal' | 'task';
  className?: string;
  onActionComplete?: () => void;
}

export function ObjectQuickActionCard({
  content,
  title,
  objectId: _objectId,
  objectKind = 'idea',
  className = '',
  onActionComplete,
}: ObjectQuickActionCardProps) {
  const { requestSudo } = useSudo();
  const { activeWorkspace, attachEntityToActiveWorkspace } = useWorkspace();
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [savedTitle, setSavedTitle] = useState<string>('');

  // Extract env variables from content
  const envFields = useMemo<EnvField[]>(() => {
    if (!content || typeof content !== 'string') return [];
    return parseEnvText(content);
  }, [content]);

  // Derive an appropriate title for the secret
  const resolvedSecretTitle = useMemo(() => {
    const trimmedTitle = (title || '').trim();
    const isGenericTitle =
      !trimmedTitle ||
      /^(untitled|note|idea|new goal|new task|new idea|goal)$/i.test(trimmedTitle);

    if (!isGenericTitle) {
      return trimmedTitle.endsWith('(Env)') || trimmedTitle.endsWith('Env')
        ? trimmedTitle
        : `${trimmedTitle} (Env)`;
    }

    if (envFields.length > 0) {
      const firstKey = envFields[0].label;
      const cleaned = firstKey
        .replace(/(_URL|_DATABASE_URL|_AUTH_TOKEN|_TOKEN|_SECRET|_KEY|_API_KEY|_URI)$/i, '')
        .replace(/_/g, ' ')
        .trim();
      const prefix = cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase() : firstKey;
      return `${prefix} Configuration`;
    }

    return 'Environment Secret';
  }, [title, envFields]);

  const executeSecretCreation = useCallback(async () => {
    if (envFields.length === 0) return;
    setStatus('saving');

    try {
      const usable = envFields.filter((f) => f.label.trim());
      if (!usable.length) {
        throw new Error('No valid environment keys found.');
      }
      if (measureEnvFieldsJson(usable) > ENV_CUSTOM_FIELDS_SOFT_MAX_CHARS) {
        throw new Error('Environment bundle is too large.');
      }

      const credentialData: any = {
        itemType: 'secret',
        name: resolvedSecretTitle,
        customFields: JSON.stringify(usable),
        isEnv: true,
        password: null,
        username: null,
        url: null,
        notes: `Extracted from ${objectKind}${title ? `: ${title}` : ''}`,
        tags: ['env', objectKind],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const created = await createCredential(credentialData);
      const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
      if (isCustomWorkspace && (created?.$id || (created as any)?.id)) {
        void attachEntityToActiveWorkspace(
          'credential',
          created.$id || (created as any).id
        );
      }

      setSavedTitle(resolvedSecretTitle);
      setStatus('saved');
      toast.success(`Saved "${resolvedSecretTitle}" as encrypted Vault secret`);
      onActionComplete?.();
    } catch (err: any) {
      console.error('[QuickAction] Failed to create secret:', err);
      toast.error(err?.message || 'Failed to save secret to Vault');
      setStatus('idle');
    }
  }, [envFields, resolvedSecretTitle, objectKind, title, activeWorkspace, attachEntityToActiveWorkspace, onActionComplete]);

  const handleActionClick = useCallback(() => {
    if (status === 'saving' || status === 'saved') return;

    // Evaluation System:
    // 1. Can we carry out the action without user interaction?
    if (masterPassCrypto.isVaultUnlocked()) {
      void executeSecretCreation();
      return;
    }

    // 2. Vault is locked: prompt specifically for MasterPass to unlock, then carry out immediately.
    requestSudo({
      onSuccess: () => {
        void executeSecretCreation();
      },
    });
  }, [status, executeSecretCreation, requestSudo]);

  // If dismissed or no env variables detected, take zero space
  if (dismissed || envFields.length === 0) {
    return null;
  }

  if (status === 'saved') {
    return (
      <div className={`p-3 rounded-2xl bg-[#141210] border border-emerald-500/30 flex items-center justify-between gap-3 text-xs select-none transition-all ${className}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center shrink-0 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <div className="truncate">
            <span className="font-bold text-white font-satoshi">Saved in Vault: </span>
            <span className="text-emerald-400 font-mono font-medium">{savedTitle}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-white/40 hover:text-white transition-colors p-1"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const varCount = envFields.length;
  const sampleKeys = envFields.slice(0, 2).map((f) => f.label).join(', ') + (varCount > 2 ? '…' : '');

  return (
    <div
      className={`p-3 rounded-2xl bg-[#161412] border border-amber-500/25 hover:border-amber-500/40 shadow-sm flex items-center justify-between gap-3 select-none transition-all ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0 text-amber-400">
          <KeyRound className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 font-mono">
              Quick Action
            </span>
            <span className="text-[9px] text-white/40 font-mono">·</span>
            <span className="text-[10px] text-white/50 truncate font-mono">
              {sampleKeys}
            </span>
          </div>
          <span className="text-xs font-semibold text-white/90 font-satoshi truncate">
            Save {varCount} environment variable{varCount > 1 ? 's' : ''} to encrypted Vault
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleActionClick}
          disabled={status === 'saving'}
          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/35 text-xs font-bold font-satoshi flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          {status === 'saving' ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving…</span>
            </>
          ) : (
            <>
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Save to Vault</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg text-white/35 hover:text-white transition-colors"
          title="Dismiss suggestion"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
