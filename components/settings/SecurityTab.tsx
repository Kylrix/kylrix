'use client';

import React from 'react';
import {
  Fingerprint,
  Lock,
  LockOpen,
  Trash2,
  Plus,
  Mail,
  Smartphone,
} from 'lucide-react';
import { RememberUnlockSettings } from '@/components/settings/RememberUnlockSettings';
import { formatDateWithFallback } from '@/lib/date-utils';

type PasskeyEntry = {
  $id: string;
  $createdAt?: string;
  authPasskey?: boolean;
  params?: {
    name?: string;
    created?: string;
    transports?: string[];
    rpId?: string;
    prf?: boolean;
  };
};

type Props = {
  isUnlocked: boolean;
  onLockVault: () => void;
  onUnlockVault: () => void;
  loadingPasskeys: boolean;
  passkeyEntries: PasskeyEntry[];
  onAddPasskey: () => void;
  onRemovePasskey: (id: string) => void;
  accountMfaEnabled: boolean;
  mfaFactors: { email?: boolean; totp?: boolean } | null;
  onManageMfa: () => void;
};

function passkeyCreatedAt(pk: PasskeyEntry): string | null {
  return pk.params?.created || pk.$createdAt || null;
}

function passkeyDeviceKind(pk: PasskeyEntry): string {
  const transports = pk.params?.transports || [];
  if (transports.includes('internal') || transports.includes('hybrid')) return 'This device';
  if (transports.some((t) => ['usb', 'nfc', 'ble'].includes(t))) return 'Security key';
  return 'Passkey';
}

function passkeyUseLabels(pk: PasskeyEntry): string[] {
  const labels: string[] = ['Unlock'];
  if (pk.authPasskey) labels.unshift('Sign in');
  return labels;
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#1C1A18] border-b border-white/[0.04]">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55 font-satoshi">
          {title}
        </h3>
        {action}
      </div>
      <div className="p-3 bg-[#0A0908] space-y-2">{children}</div>
    </section>
  );
}

function Row({
  icon,
  title,
  meta,
  trailing,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-[#161412] border border-white/[0.04] px-3 py-3">
      <div className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-[#6366F1] shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white truncate">{title}</p>
        {meta ? <div className="mt-1 text-[11px] text-white/40 font-satoshi">{meta}</div> : null}
      </div>
      {trailing}
    </div>
  );
}

export function SecurityTab({
  isUnlocked,
  onLockVault,
  onUnlockVault,
  loadingPasskeys,
  passkeyEntries,
  onAddPasskey,
  onRemovePasskey,
  accountMfaEnabled,
  mfaFactors,
  onManageMfa,
}: Props) {
  return (
    <div className="flex flex-col gap-3 pb-24 max-w-3xl text-white">
      <Section
        title="Vault"
        action={
          <button
            type="button"
            onClick={isUnlocked ? onLockVault : onUnlockVault}
            className={`py-1.5 px-3 rounded-lg text-[11px] font-extrabold cursor-pointer border-none ${
              isUnlocked
                ? 'bg-amber-500 text-black'
                : 'bg-[#6366F1] text-white'
            }`}
          >
            {isUnlocked ? 'Lock' : 'Unlock'}
          </button>
        }
      >
        <Row
          icon={isUnlocked ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          title={isUnlocked ? 'Unlocked' : 'Locked'}
          meta="This device"
        />
      </Section>

      <Section
        title="Passkeys"
        action={
          <button
            type="button"
            onClick={onAddPasskey}
            className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-[#0A0908] border border-white/[0.08] text-white/80 text-[11px] font-extrabold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        }
      >
        {loadingPasskeys ? (
          <div className="py-8 flex justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#6366F1]" />
          </div>
        ) : passkeyEntries.length === 0 ? (
          <button
            type="button"
            onClick={onAddPasskey}
            className="w-full flex items-center gap-3 rounded-[16px] bg-[#161412] border border-dashed border-white/10 px-3 py-4 text-left cursor-pointer"
          >
            <div className="p-2 rounded-xl bg-[#0A0908] border border-white/[0.06] text-[#6366F1]">
              <Fingerprint className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-white/70">Add a passkey</span>
          </button>
        ) : (
          passkeyEntries.map((pk) => {
            const created = passkeyCreatedAt(pk);
            return (
              <Row
                key={pk.$id}
                icon={<Fingerprint className="w-4 h-4" />}
                title={pk.params?.name || 'Device passkey'}
                meta={
                  <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <span>{passkeyUseLabels(pk).join(' · ')}</span>
                    <span>{passkeyDeviceKind(pk)}</span>
                    {created ? (
                      <span>
                        {formatDateWithFallback(created, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    ) : null}
                  </span>
                }
                trailing={
                  <button
                    type="button"
                    onClick={() => onRemovePasskey(pk.$id)}
                    className="p-2 rounded-lg bg-[#0A0908] border border-red-500/20 text-red-400 cursor-pointer shrink-0"
                    aria-label="Remove passkey"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                }
              />
            );
          })
        )}
      </Section>

      <RememberUnlockSettings />

      <Section
        title="2FA"
        action={
          <button
            type="button"
            onClick={onManageMfa}
            className="py-1.5 px-3 rounded-lg bg-[#6366F1] text-white text-[11px] font-extrabold cursor-pointer border-none"
          >
            {accountMfaEnabled ? 'Manage' : 'Set up'}
          </button>
        }
      >
        <Row
          icon={<Mail className="w-4 h-4" />}
          title="Email codes"
          trailing={
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wide ${
                mfaFactors?.email ? 'text-emerald-400' : 'text-white/35'
              }`}
            >
              {mfaFactors?.email ? 'On' : 'Off'}
            </span>
          }
        />
        <Row
          icon={<Smartphone className="w-4 h-4" />}
          title="Authenticator"
          trailing={
            <span
              className={`text-[10px] font-extrabold uppercase tracking-wide ${
                mfaFactors?.totp ? 'text-emerald-400' : 'text-white/35'
              }`}
            >
              {mfaFactors?.totp ? 'On' : 'Off'}
            </span>
          }
        />
      </Section>
    </div>
  );
}
