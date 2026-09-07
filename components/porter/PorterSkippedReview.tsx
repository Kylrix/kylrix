'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Info, KeyRound, Lock } from 'lucide-react';
import type { PorterCredentialDraft, PorterDiscernResult, PorterTotpDraft } from '@/lib/porter';

type FilterTab = 'all' | 'duplicate' | 'invalid' | 'enabled';

type SkippedCred = PorterCredentialDraft & { _idx: number };
type SkippedTotp = PorterTotpDraft & { _idx: number };

export type PorterSkippedReviewProps = {
  discerned: PorterDiscernResult;
  onChange: (next: PorterDiscernResult) => void;
  onDone: () => void;
};

function mask(value: string, reveal: boolean): string {
  if (!value) return '—';
  if (reveal) return value;
  if (value.length <= 4) return '••••';
  return `${value.slice(0, 2)}${'•'.repeat(Math.min(10, value.length - 2))}${value.slice(-1)}`;
}

function ReasonPill({ status, forced }: { status?: string; forced?: boolean }) {
  if (forced) {
    return (
      <span className="inline-flex items-center rounded-lg bg-black border border-[#10B981] px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[#10B981]">
        You enabled
      </span>
    );
  }
  if (status === 'duplicate') {
    return (
      <span className="inline-flex items-center rounded-lg bg-black border border-white/25 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-white">
        Already in vault
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-lg bg-black border border-white/25 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-white">
      Unreadable
    </span>
  );
}

function ValueRow({
  label,
  value,
  secret,
}: {
  label: string;
  value: string | null | undefined;
  secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  const raw = value == null || value === '' ? '' : String(value);
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.08em] text-[#A3A3A3]">{label}</p>
        <p className="text-sm font-medium text-white break-all font-satoshi mt-0.5">
          {secret ? mask(raw, show) : raw || '—'}
        </p>
      </div>
      {secret && raw ? (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="shrink-0 p-1.5 rounded-lg border border-white/20 bg-black text-white"
          aria-label={show ? 'Hide value' : 'Show value'}
        >
          {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      ) : null}
    </div>
  );
}

function ImportToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
        enabled ? 'bg-[#10B981] border-[#10B981]' : 'bg-black border-white/30'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function PorterSkippedReview({ discerned, onChange, onDone }: PorterSkippedReviewProps) {
  const [tab, setTab] = useState<FilterTab>('all');
  const [openKey, setOpenKey] = useState<string | null>(null);

  const skippedCreds = useMemo((): SkippedCred[] => {
    return (discerned.credentials || [])
      .map((c, _idx) => ({ ...c, _idx }))
      .filter((c) => c._status === 'duplicate' || c._status === 'invalid');
  }, [discerned.credentials]);

  const skippedTotps = useMemo((): SkippedTotp[] => {
    return (discerned.totpSecrets || [])
      .map((t, _idx) => ({ ...t, _idx }))
      .filter((t) => t._status === 'duplicate' || t._status === 'invalid');
  }, [discerned.totpSecrets]);

  const filteredCreds = useMemo(() => {
    if (tab === 'enabled') return skippedCreds.filter((c) => c._forceImport);
    if (tab === 'duplicate') return skippedCreds.filter((c) => c._status === 'duplicate');
    if (tab === 'invalid') return skippedCreds.filter((c) => c._status === 'invalid');
    return skippedCreds;
  }, [skippedCreds, tab]);

  const filteredTotps = useMemo(() => {
    if (tab === 'enabled') return skippedTotps.filter((t) => t._forceImport);
    if (tab === 'duplicate') return skippedTotps.filter((t) => t._status === 'duplicate');
    if (tab === 'invalid') return skippedTotps.filter((t) => t._status === 'invalid');
    return skippedTotps;
  }, [skippedTotps, tab]);

  const enabledCount =
    skippedCreds.filter((c) => c._forceImport).length +
    skippedTotps.filter((t) => t._forceImport).length;

  const setCredForce = (idx: number, force: boolean) => {
    const credentials = (discerned.credentials || []).map((c, i) =>
      i === idx ? { ...c, _forceImport: force || undefined } : c,
    );
    onChange({ ...discerned, credentials });
  };

  const setTotpForce = (idx: number, force: boolean) => {
    const totpSecrets = (discerned.totpSecrets || []).map((t, i) =>
      i === idx ? { ...t, _forceImport: force || undefined } : t,
    );
    onChange({ ...discerned, totpSecrets });
  };

  const tabs: Array<{ id: FilterTab; label: string }> = [
    { id: 'all', label: `All (${skippedCreds.length + skippedTotps.length})` },
    {
      id: 'duplicate',
      label: `In vault (${skippedCreds.filter((c) => c._status === 'duplicate').length + skippedTotps.filter((t) => t._status === 'duplicate').length})`,
    },
    {
      id: 'invalid',
      label: `Unreadable (${skippedCreds.filter((c) => c._status === 'invalid').length + skippedTotps.filter((t) => t._status === 'invalid').length})`,
    },
    { id: 'enabled', label: `Enabled (${enabledCount})` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/20 bg-black px-5 py-4 flex gap-3">
        <Info className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="text-base font-black text-white font-clash">What was held back</p>
          <p className="text-sm font-medium text-white">
            These items were not queued for import. Open any row to see the values we read, then turn
            on Import if you disagree.
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2 rounded-xl text-[0.7rem] font-bold uppercase tracking-[0.06em] border transition-colors ${
              tab === t.id
                ? 'bg-[#10B981] text-black border-[#10B981]'
                : 'bg-black text-white border-white/20'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-white/20 bg-black divide-y divide-white/10 overflow-hidden">
        {filteredCreds.length === 0 && filteredTotps.length === 0 && (
          <p className="px-4 py-8 text-center text-sm font-medium text-white">
            Nothing in this filter.
          </p>
        )}

        {filteredCreds.map((c) => {
          const key = `c-${c._idx}`;
          const open = openKey === key;
          return (
            <div key={key} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <Lock className="w-4 h-4 text-white shrink-0 mt-1" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setOpenKey(open ? null : key)}
                >
                  <p className="text-sm font-bold text-white truncate">{c.name || 'Untitled secret'}</p>
                  <p className="text-[0.72rem] font-medium text-[#A3A3A3] mt-0.5 line-clamp-2">
                    {c._skipReason ||
                      (c._status === 'duplicate' ? 'Already in your vault' : "Can't import")}
                  </p>
                  <div className="mt-2">
                    <ReasonPill status={c._status} forced={c._forceImport} />
                  </div>
                </button>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <ImportToggle
                    enabled={Boolean(c._forceImport)}
                    onToggle={() => setCredForce(c._idx, !c._forceImport)}
                  />
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[#A3A3A3]">
                    Import
                  </span>
                </div>
              </div>
              {open && (
                <div className="mt-3 ml-7 rounded-xl border border-white/20 bg-[#161412] px-3 py-2">
                  <ValueRow label="Name" value={c.name} />
                  <ValueRow label="Username" value={c.username} />
                  <ValueRow label="Password" value={c.password} secret />
                  <ValueRow label="Website" value={c.url} />
                  <ValueRow label="Notes" value={c.notes} />
                  {c._sourceHint ? <ValueRow label="From" value={c._sourceHint} /> : null}
                </div>
              )}
            </div>
          );
        })}

        {filteredTotps.map((t) => {
          const key = `t-${t._idx}`;
          const open = openKey === key;
          return (
            <div key={key} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <KeyRound className="w-4 h-4 text-white shrink-0 mt-1" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setOpenKey(open ? null : key)}
                >
                  <p className="text-sm font-bold text-white truncate">
                    {t.issuer || 'Smart code'} · {t.accountName || 'Account'}
                  </p>
                  <p className="text-[0.72rem] font-medium text-[#A3A3A3] mt-0.5 line-clamp-2">
                    {t._skipReason ||
                      (t._status === 'duplicate' ? 'Already in your vault' : "Can't import")}
                  </p>
                  <div className="mt-2">
                    <ReasonPill status={t._status} forced={t._forceImport} />
                  </div>
                </button>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <ImportToggle
                    enabled={Boolean(t._forceImport)}
                    onToggle={() => setTotpForce(t._idx, !t._forceImport)}
                  />
                  <span className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-[#A3A3A3]">
                    Import
                  </span>
                </div>
              </div>
              {open && (
                <div className="mt-3 ml-7 rounded-xl border border-white/20 bg-[#161412] px-3 py-2">
                  <ValueRow label="Issuer" value={t.issuer} />
                  <ValueRow label="Account" value={t.accountName} />
                  <ValueRow label="Secret key" value={t.secretKey} secret />
                  <ValueRow label="Algorithm" value={t.algorithm || 'SHA1'} />
                  <ValueRow
                    label="Digits · period"
                    value={`${t.digits || 6} · ${t.period || 30}s`}
                  />
                  {t._sourceHint ? <ValueRow label="From" value={t._sourceHint} /> : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="w-full py-3 rounded-xl font-bold bg-[#10B981] text-black font-clash"
      >
        {enabledCount > 0
          ? `Done · ${enabledCount} enabled for import`
          : 'Back to preview'}
      </button>
    </div>
  );
}
