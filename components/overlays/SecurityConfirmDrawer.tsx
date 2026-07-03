'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, Shield, X } from 'lucide-react';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  getSecurityConfirmSteps,
  type SecurityConfirmFlow,
  type SecurityConfirmStep,
} from '@/lib/settings/security-confirm-steps';

export interface SecurityConfirmDrawerData {
  flow: SecurityConfirmFlow;
  onAfterConfirmations: () => void | Promise<void>;
}

const TONE_STYLES: Record<
  SecurityConfirmStep['tone'],
  { accent: string; border: string; bg: string }
> = {
  warning: {
    accent: '#F59E0B',
    border: 'rgba(245, 158, 11, 0.28)',
    bg: 'rgba(245, 158, 11, 0.08)',
  },
  danger: {
    accent: '#EF4444',
    border: 'rgba(239, 68, 68, 0.28)',
    bg: 'rgba(239, 68, 68, 0.08)',
  },
  neutral: {
    accent: '#6366F1',
    border: 'rgba(99, 102, 241, 0.28)',
    bg: 'rgba(99, 102, 241, 0.08)',
  },
};

export function SecurityConfirmDrawer() {
  const { drawerData, close } = useUnifiedDrawer();
  const data = drawerData as SecurityConfirmDrawerData | null;

  const steps = useMemo(
    () => (data?.flow ? getSecurityConfirmSteps(data.flow) : []),
    [data?.flow],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setStepIndex(0);
    setChecked(false);
    setLoading(false);
  }, [data?.flow]);

  if (!data || steps.length === 0) return null;

  const step = steps[stepIndex];
  const tone = TONE_STYLES[step.tone];
  const isLastStep = stepIndex === steps.length - 1;
  const requiresCheckbox = Boolean(step.checkboxLabel);
  const canContinue = !requiresCheckbox || checked;

  const handleContinue = async () => {
    if (!canContinue) return;

    if (!isLastStep) {
      setStepIndex((prev) => prev + 1);
      setChecked(false);
      return;
    }

    setLoading(true);
    try {
      close();
      await data.onAfterConfirmations();
    } catch (err) {
      console.error('[SecurityConfirm] Flow failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 text-white font-satoshi flex flex-col gap-5 relative select-none max-h-[60dvh] overflow-y-auto">
      <div
        className="absolute top-0 left-0 right-0 h-32 pointer-events-none opacity-25"
        style={{
          backgroundImage: `radial-gradient(circle at top, ${tone.accent}33 0%, transparent 70%)`,
        }}
      />

      <div className="flex justify-between items-start gap-3 relative z-10 flex-shrink-0">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-[38px] h-[38px] rounded-xl flex items-center justify-center flex-shrink-0 border"
            style={{ color: tone.accent, borderColor: tone.border, backgroundColor: tone.bg }}
          >
            {step.tone === 'neutral' ? <Shield size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="min-w-0 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9B9691] font-clash">
              {step.stepLabel}
            </span>
            <h3 className="font-extrabold text-lg text-white font-clash tracking-tight leading-tight">
              {step.title}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="p-1.5 text-white/50 hover:text-white transition rounded-lg hover:bg-white/5 border border-white/5 flex-shrink-0"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative z-10 flex flex-col gap-3">
        <p className="text-[13px] text-white/70 font-semibold leading-relaxed">
          {step.description}
        </p>

        {step.bullets && step.bullets.length > 0 && (
          <ul className="flex flex-col gap-2 pl-1">
            {step.bullets.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tone.accent }}
                />
                <span className="text-xs text-[#9B9691] font-semibold leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        )}

        {step.checkboxLabel && (
          <label className="flex items-start gap-3 px-4 py-3.5 rounded-[18px] bg-[#0B0A09] border border-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 accent-[#6366F1] flex-shrink-0"
            />
            <span className="text-xs text-white/85 font-semibold leading-relaxed">
              {step.checkboxLabel}
            </span>
          </label>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 relative z-10 pt-1">
        {steps.map((s, index) => (
          <span
            key={s.id}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: index === stepIndex ? 24 : 8,
              backgroundColor: index <= stepIndex ? tone.accent : 'rgba(255,255,255,0.12)',
            }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2.5 relative z-10 flex-shrink-0 pt-1">
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={!canContinue || loading}
          className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white disabled:opacity-45 transition flex items-center justify-center gap-2"
          style={{
            backgroundColor: step.tone === 'danger' ? '#EF4444' : step.tone === 'warning' ? '#D97706' : '#6366F1',
          }}
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>{step.confirmLabel}</span>
              <ChevronRight size={16} />
            </>
          )}
        </button>
        <button
          type="button"
          onClick={close}
          disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-xs text-white/45 hover:text-white transition hover:bg-white/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
