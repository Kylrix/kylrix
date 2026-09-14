import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Clock, 
  Globe,
  Ghost,
  Target,
  Sparkles,
  Crown
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { GHOST_FIELDS_REGISTRY, getEnabledGhostFields } from '@/lib/forms/ghost-fields';
import { Forms, FormsStatus } from '@/generated/appwrite/types';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';

interface FormSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  form: Forms | null;
  onSaved: () => void;
}

export default function FormSettingsDialog({ open, onClose, form, onSaved }: FormSettingsDialogProps) {
  const { showSuccess } = useToast();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const isPaidUser = hasPaidKylrixPlan(user);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [allowAnonymousView, setAllowAnonymousView] = useState(false);
  const [allowAnonymousFill, setAllowAnonymousFill] = useState(false);
  const [autoGoalAction, setAutoGoalAction] = useState(true);
  const [aiTriageEnabled, setAiTriageEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [enabledGhostFields, setEnabledGhostFields] = useState<string[]>([]);

  useEffect(() => {
    if (form && open) {
      setStatus(form.status as any);
      let settings: any = {};
      try {
        settings = JSON.parse(form.settings || '{}');
      } catch (_e) {}
      
      // Migrate to the new direct column paradigms
      setAllowAnonymousView(form.isPublic ?? (status === 'published'));
      setAllowAnonymousFill(form.isGuest ?? settings.allowAnonymousFill ?? false);
      setAutoGoalAction(settings.autoGoalAction !== false);
      setAiTriageEnabled(Boolean(settings.aiTriageEnabled));
      setExpiresAt(settings.expiresAt ? settings.expiresAt.slice(0, 16) : '');
      setEnabledGhostFields(getEnabledGhostFields(settings));
    }
  }, [form, open, status]);

  if (!open || !form) return null;

  const toggleGhostField = (key: string) => {
    setEnabledGhostFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      let existingSettings: any = {};
      try {
        existingSettings = JSON.parse(form.settings || '{}');
      } catch (_e) {}

      const settings = {
        ...existingSettings,
        allowAnonymousView,
        allowAnonymousFill,
        autoGoalAction,
        aiTriageEnabled: isPaidUser ? aiTriageEnabled : false,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        ghostFields: enabledGhostFields,
      };

      await FormsService.updateForm(form.$id, {
        status: status as FormsStatus,
        settings: JSON.stringify(settings),
        isPublic: status === 'published',
        isGuest: allowAnonymousFill,
      } as any);
      
      onSaved();
      onClose();
      showSuccess('Saved', 'Portal settings updated.');
    } catch (error) {
      console.error('Failed to update form settings', error);
    } finally {
      setLoading(false);
    }
  };

  const copyPublicLink = () => {
    const url = `${window.location.origin}/form/${form.$id}`;
    navigator.clipboard.writeText(url);
    showSuccess('Link Copied', 'Portal URL is on your clipboard.');
  };

  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-[9990]"
        onClick={onClose}
      />

      {/* Slide-over Container */}
      <div className="fixed right-0 top-0 bottom-0 h-dvh bg-[#0a0a0a] border-l border-white/5 shadow-2xl flex flex-col z-[9995] w-full sm:w-[480px] font-satoshi text-[#F2F2F2]">
        {/* Header */}
        <div className="p-4 md:p-5 flex items-center justify-between border-b border-white/5 bg-black shrink-0">
          <div>
            <h3 className="text-sm font-extrabold font-clash text-white tracking-tight uppercase leading-tight">
              Portal Configuration
            </h3>
            <span className="block text-[10px] text-[#9B9691] font-mono font-bold uppercase truncate max-w-[280px]">
              {form.title}
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-[#9B9691] hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 scrollbar-thin">
          {/* Deployment */}
          <div className="space-y-3">
            <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">DEPLOYMENT</span>
            
            <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all duration-300 ${
              status === 'published' 
                ? 'bg-[#10B981]/5 border-[#10B981]/20' 
                : 'bg-white/[0.02] border-white/5'
            }`}>
              <div className="flex items-center gap-3">
                <Globe className={`w-5 h-5 shrink-0 ${status === 'published' ? 'text-[#10B981]' : 'text-[#9B9691]'}`} />
                <div>
                  <span className="block text-xs font-bold text-white font-satoshi">Public Visibility</span>
                  <span className="block text-[10px] text-[#9B9691] font-medium leading-normal">
                    {status === 'published' ? 'Accessible via unique URL' : 'Internal access only'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatus(status === 'published' ? 'draft' : 'published')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  status === 'published' ? 'bg-[#10B981]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                    status === 'published' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {status === 'published' && (
              <button
                type="button"
                onClick={copyPublicLink}
                className="w-full py-2.5 border border-dashed border-[#34322F] hover:border-[#6366F1] hover:text-[#6366F1] font-bold text-xs text-white rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Portal Link</span>
              </button>
            )}
          </div>

          <div className="border-t border-white/5" />

          {/* Automated Response Actions */}
          <div className="space-y-3">
            <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">AUTOMATED RESPONSE ACTIONS</span>

            {/* Default Form Action: Response to Goal */}
            <div className="p-3.5 rounded-xl bg-black border border-white/10 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-[#10B981]" />
                  <span className="text-xs font-bold text-white font-satoshi">Auto-create Goal in Workspace</span>
                </div>
                <span className="block text-[10px] text-[#9B9691] mt-0.5 leading-normal">
                  Automatically convert incoming form responses into execution Goals in this workspace.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAutoGoalAction(!autoGoalAction)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  autoGoalAction ? 'bg-[#10B981]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                    autoGoalAction ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* AI Auto-Triage Action */}
            <div className="p-3.5 rounded-xl bg-black border border-white/10 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#6366F1]" />
                  <span className="text-xs font-bold text-white font-satoshi">AI Response Auto-Triage</span>
                  {!isPaidUser && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold font-mono uppercase flex items-center gap-1">
                      <Crown size={10} />
                      PRO
                    </span>
                  )}
                </div>
                <span className="block text-[10px] text-[#9B9691] mt-0.5 leading-normal">
                  Automatically categorize, score, and extract action items from form responses using AI.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isPaidUser) {
                    openProUpgrade('AI Response Triage');
                    return;
                  }
                  setAiTriageEnabled(!aiTriageEnabled);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  aiTriageEnabled && isPaidUser ? 'bg-[#6366F1]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                    aiTriageEnabled && isPaidUser ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* Access Control */}
          <div className="space-y-3">
            <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">ACCESS CONTROL</span>
            
            <div className="flex items-center justify-between gap-4 p-1">
              <div>
                <span className="block text-xs font-bold text-white font-satoshi">Allow guest submissions</span>
                <span className="block text-[10px] text-[#9B9691] leading-normal mt-0.5">If off, only signed-in users can respond</span>
              </div>
              <button
                type="button"
                onClick={() => setAllowAnonymousFill(!allowAnonymousFill)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shrink-0 ${
                  allowAnonymousFill ? 'bg-[#6366F1]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                    allowAnonymousFill ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* Modular Ghost Fields Telemetry */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Ghost className="w-4 h-4 text-[#6366F1]" />
              <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">
                TELEMETRY & GHOST FIELDS
              </span>
            </div>
            <p className="text-[11px] text-[#9B9691] leading-relaxed">
              Enable background account telemetry fields. When enabled, submitters are notified transparently via an info icon drawer on the form link.
            </p>

            <div className="space-y-2 pt-1">
              {Object.values(GHOST_FIELDS_REGISTRY).map((gf) => {
                const isChecked = enabledGhostFields.includes(gf.id);
                return (
                  <div
                    key={gf.id}
                    onClick={() => toggleGhostField(gf.id)}
                    className={`p-3 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-[#6366F1]/10 border-[#6366F1]/40'
                        : 'bg-black border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white font-satoshi">
                          {gf.label}
                        </span>
                        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 font-bold">
                          {gf.category}
                        </span>
                      </div>
                      <span className="block text-[10px] text-[#9B9691] mt-0.5 leading-normal">
                        {gf.description}
                      </span>
                    </div>

                    <div
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0 mt-0.5 ${
                        isChecked ? 'bg-[#6366F1]' : 'bg-white/10'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-black transition-transform ${
                          isChecked ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* Auto-Closure */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className={`w-4 h-4 ${isExpired ? 'text-red-400' : 'text-[#9B9691]'}`} />
              <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">AUTO-CLOSURE</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-[#9B9691] uppercase tracking-wider font-mono">Closure Timestamp</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-black border border-[#34322F] text-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 hover:border-[#6366F1] transition-all font-satoshi text-sm"
              />
              <span className="text-[10px] text-white/30 italic block mt-0.5">Responses will be rejected after this time.</span>
            </div>

            {isExpired && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold font-satoshi text-center">
                Form is currently closed.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 border-t border-white/5 bg-black flex gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-xs font-bold text-[#9B9691] hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="flex-1 py-3 bg-[#6366F1] text-black font-extrabold text-xs rounded-xl shadow-[0_8px_30px_rgb(99,102,241,0.2)] hover:bg-[#5254E8] active:translate-y-[0.5px] transition-all disabled:opacity-50"
          >
            Update Configuration
          </button>
        </div>
      </div>
    </>
  );
}
