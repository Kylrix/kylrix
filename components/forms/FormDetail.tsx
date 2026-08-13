'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Settings, 
  Share2, 
  Globe, 
  Lock, 
  Calendar, 
  Trash2, 
  Edit3, 
  FileText, 
  Copy, 
  Check, 
  Send,
  Sparkles,
  ExternalLink,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { Forms, FormsStatus } from '@/generated/appwrite/types';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useToast } from '@/components/ui/Toast';
import { LocalEngine } from '@/lib/services/LocalEngine';
import FormSettingsDialog from './FormSettingsDialog';

interface FormDetailProps {
  formId: string;
  form?: Forms | null;
  onClose: () => void;
  onEdit?: (form: Forms) => void;
  onDelete?: (form: Forms) => void;
  embedded?: boolean;
}

export function FormDetail({
  formId,
  form: initialForm,
  onClose,
  onEdit,
  onDelete,
  embedded = false,
}: FormDetailProps) {
  const { user } = useAuth();
  const { open: openDrawer } = useUnifiedDrawer();
  const { closeSidebar } = useDynamicSidebar();
  const { showSuccess, showError } = useToast();

  const [form, setForm] = useState<Forms | null>(initialForm || null);
  const [loading, setLoading] = useState(!initialForm);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'schema' | 'preview'>('overview');
  const [copied, setCopied] = useState(false);

  const loadForm = useCallback(async () => {
    try {
      if (!initialForm) setLoading(true);
      const res = await FormsService.getForm(formId);
      if (res) {
        setForm(res as unknown as Forms);
      }
    } catch (err: any) {
      showError('Failed to load form', err?.message || 'Form unavailable');
    } finally {
      setLoading(false);
    }
  }, [formId, initialForm, showError]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  const fields = React.useMemo(() => {
    if (!form?.schema) return [];
    try {
      const parsed = typeof form.schema === 'string' ? JSON.parse(form.schema) : form.schema;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [form?.schema]);

  const shareUrl = typeof window !== 'undefined' && form?.$id
    ? `${window.location.origin}/forms/${form.$id}`
    : '';

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    showSuccess('Copied', 'Direct form link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    if (embedded) {
      closeSidebar();
    }
    onClose();
  };

  if (loading && !form) {
    return (
      <div className="h-full flex flex-col bg-[#161412] text-white p-6 justify-center items-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#6366F1] border-t-transparent animate-spin mb-3" />
        <span className="text-xs font-mono text-white/40 tracking-wider uppercase">Loading Form...</span>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="h-full flex flex-col bg-[#161412] text-white p-6 justify-center items-center text-center">
        <FileText size={36} className="text-white/20 mb-3" />
        <p className="font-clash text-lg font-bold text-white mb-2">Form not found</p>
        <button
          type="button"
          onClick={handleClose}
          className="px-4 py-2 bg-[#0A0908] border border-white/10 rounded-xl text-xs font-mono hover:border-white/20 transition-all"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const isPublished = form.status === 'published';

  return (
    <div className="h-full flex flex-col bg-[#161412] text-white overflow-hidden select-none">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4 bg-[#161412] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#0A0908] border border-white/10 flex items-center justify-center text-[#6366F1] shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="font-clash font-extrabold text-base text-white tracking-tight truncate">
              {form.title || 'Untitled Form'}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-black uppercase tracking-wider border ${
                  isPublished
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}
              >
                {form.status || 'draft'}
              </span>
              <span className="text-[11px] font-satoshi text-white/40">
                {fields.length} {fields.length === 1 ? 'field' : 'fields'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(form)}
              className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/10 hover:border-[#6366F1]/40 flex items-center justify-center text-white/70 hover:text-white transition-all"
              title="Edit Form"
            >
              <Edit3 size={15} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/10 hover:border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
            title="Form Settings"
          >
            <Settings size={15} />
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/10 hover:border-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-white/5 flex items-center gap-6 bg-[#161412] shrink-0">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'schema', label: `Fields (${fields.length})` },
          { id: 'preview', label: 'Live Preview' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 text-xs font-bold font-satoshi border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#6366F1] text-[#6366F1]'
                : 'border-transparent text-white/40 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Description Tile */}
            <div className="p-4 bg-[#0A0908] border border-white/6 rounded-2xl">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40 block mb-1.5">
                Description
              </span>
              <p className="text-sm font-satoshi text-white/80 leading-relaxed">
                {form.description || 'No description provided for this form portal.'}
              </p>
            </div>

            {/* Quick Share Link Tile */}
            <div className="p-4 bg-[#0A0908] border border-white/6 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40">
                  Public Intake URL
                </span>
                <span className="text-[10px] font-mono text-white/40">
                  {form.isPublic ? '🌐 Publicly Accessible' : '🔒 Private / Org Only'}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-[#161412] border border-white/10 rounded-xl px-3 py-2">
                <span className="text-xs font-mono text-white/70 truncate flex-1">
                  {shareUrl || `forms/${form.$id}`}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2.5 py-1 bg-[#6366F1] hover:bg-[#5254D8] text-white rounded-lg text-xs font-satoshi font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Metadata Badges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-[#0A0908] border border-white/6 rounded-2xl">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40 block mb-1">
                  Anonymous Fill
                </span>
                <span className="text-xs font-satoshi font-bold text-white">
                  {form.isGuest ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="p-3.5 bg-[#0A0908] border border-white/6 rounded-2xl">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40 block mb-1">
                  Created Date
                </span>
                <span className="text-xs font-satoshi font-bold text-white">
                  {new Date(form.$createdAt || Date.now()).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Actions Tile */}
            <div className="pt-2 flex flex-col gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(form)}
                  className="w-full py-3 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254D8] text-white font-satoshi font-bold text-xs tracking-wide transition-all shadow-[0_4px_16px_rgba(99,102,241,0.25)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Edit3 size={14} />
                  <span>Edit Form Schema</span>
                </button>
              )}

              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(form)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0A0908] border border-red-500/20 hover:border-red-500/40 text-red-400 font-satoshi font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Purge Form</span>
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="space-y-3">
            {fields.length === 0 ? (
              <div className="py-12 text-center bg-[#0A0908] border border-dashed border-white/10 rounded-2xl">
                <FileText size={24} className="mx-auto text-white/20 mb-2" />
                <p className="text-xs font-mono text-white/40">No fields added to this schema yet.</p>
              </div>
            ) : (
              fields.map((field: any, idx: number) => (
                <div
                  key={field.id || idx}
                  className="p-3.5 bg-[#0A0908] border border-white/6 rounded-2xl flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-[#161412] border border-white/10 text-white/40 flex items-center justify-center text-[11px] font-mono shrink-0">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="text-xs font-satoshi font-bold text-white block truncate">
                        {field.label || 'Untitled Field'}
                      </span>
                      <span className="text-[10px] font-mono text-white/40 uppercase">
                        {field.type || 'text'} {field.required ? '• Required' : ''}
                      </span>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-lg bg-[#161412] border border-white/8 text-[10px] font-mono text-white/50 shrink-0">
                    {field.type}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="p-5 bg-[#0A0908] border border-white/6 rounded-2xl space-y-4">
              <div>
                <h3 className="font-clash font-bold text-lg text-white mb-1">{form.title}</h3>
                <p className="text-xs font-satoshi text-white/60">{form.description}</p>
              </div>

              <div className="space-y-3 pt-2">
                {fields.map((f: any, idx: number) => (
                  <div key={f.id || idx} className="space-y-1.5">
                    <label className="text-xs font-satoshi font-bold text-white/80 block">
                      {f.label} {f.required && <span className="text-red-400">*</span>}
                    </label>
                    <input
                      disabled
                      placeholder={f.placeholder || `Enter ${f.label}...`}
                      className="w-full bg-[#161412] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/40 placeholder-white/20 cursor-not-allowed"
                    />
                  </div>
                ))}
              </div>

              <button
                disabled
                type="button"
                className="w-full py-2.5 rounded-xl bg-[#6366F1]/50 text-white/70 font-satoshi font-bold text-xs cursor-not-allowed text-center"
              >
                Submit Response (Preview Mode)
              </button>
            </div>
          </div>
        )}
      </div>

      {settingsOpen && (
        <FormSettingsDialog
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          form={form}
          onSaved={() => {
            void loadForm();
          }}
        />
      )}
    </div>
  );
}
