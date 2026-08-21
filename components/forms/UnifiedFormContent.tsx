'use client';

import React, { useEffect, useState } from 'react';
import { 
    Send, 
    CheckCircle2, 
    Upload as UploadIcon, 
    X as XIcon, 
    ChevronDown, 
    ArrowUpRight 
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { Forms } from '@/generated/appwrite/types';
import { useDataNexus } from '@/context/DataNexusContext';
import { secureUploadFile } from '@/lib/actions/client-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

interface UnifiedFormContentProps {
    formId: string;
    onClose: () => void;
}

export function UnifiedFormContent({ formId, onClose }: UnifiedFormContentProps) {
    const { fetchOptimized } = useDataNexus();
    const [form, setForm] = useState<Forms | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [isHydrated, setIsHydrated] = useState(false);

    const handleOpenStandalone = () => {
        if (typeof window !== 'undefined') {
            window.open(`/form/${formId}`, '_blank', 'noopener,noreferrer');
        }
    };

    // Load draft when form schema is loaded
    useEffect(() => {
        if (!formId || !form || typeof window === 'undefined') {
            setIsHydrated(false);
            return;
        }
        try {
            const raw = localStorage.getItem(`kylrix:draft:form:${formId}`);
            if (raw) {
                setFormData(JSON.parse(raw));
            }
        } catch (e) {
            console.error('Failed to parse form draft', e);
        }
        setIsHydrated(true);
    }, [formId, form]);

    // Save draft when formData changes
    useEffect(() => {
        if (!formId || typeof window === 'undefined' || !isHydrated) return;
        try {
            if (Object.keys(formData).length > 0) {
                localStorage.setItem(`kylrix:draft:form:${formId}`, JSON.stringify(formData));
            } else {
                localStorage.removeItem(`kylrix:draft:form:${formId}`);
            }
        } catch {}
    }, [formId, isHydrated, formData]);

    useEffect(() => {
        if (!formId) return;

        let isMounted = true;
        const fetchForm = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchOptimized(`f_form_schema_${formId}`, () => 
                    FormsService.getForm(formId)
                );
                if (isMounted) setForm(data);
            } catch (err: any) {
                if (isMounted) setError(err.message || 'Form not found or inaccessible.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchForm();
        return () => { isMounted = false; };
    }, [formId, fetchOptimized]);

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
        const currentValues = formData[fieldId] || [];
        const nextValues = checked 
            ? [...currentValues, option]
            : currentValues.filter((v: string) => v !== option);
        handleFieldChange(fieldId, nextValues);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            let schema: any[] = [];
            try { schema = JSON.parse(form?.schema || '[]'); } catch (_e) {}

            for (const field of schema) {
                if (field.required && (!formData[field.id] || formData[field.id] === '')) {
                    throw new Error(`Field "${field.label}" is required.`);
                }
            }

            await FormsService.submitForm(formId, JSON.stringify(formData));
            if (typeof window !== 'undefined') {
                localStorage.removeItem(`kylrix:draft:form:${formId}`);
            }
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Failed to submit response.');
        } finally {
            setSubmitting(false);
        }
    };

    const renderField = (field: any) => {
        switch (field.type) {
            case 'select':
                return (
                    <div className="relative">
                        <select
                            value={formData[field.id] || ''}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            required={field.required}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#161412] border border-white/10 text-white focus:outline-none focus:border-[#6366F1] transition-colors text-xs font-sans appearance-none cursor-pointer"
                        >
                            <option value="" disabled hidden className="bg-[#161412] text-white/40">Select an option…</option>
                            {(field.options || []).map((opt: string) => (
                                <option key={opt} value={opt} className="bg-[#161412] text-white">{opt}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white/40">
                            <ChevronDown size={14} />
                        </div>
                    </div>
                );
            case 'radio':
                return (
                    <div className="grid gap-2 pl-0.5">
                        {(field.options || []).map((opt: string) => (
                            <label key={opt} className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input 
                                    type="radio" 
                                    name={field.id}
                                    value={opt}
                                    checked={formData[field.id] === opt}
                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    className="w-4 h-4 text-[#6366F1] bg-[#161412] border border-white/10 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="text-xs text-white/80 font-sans">{opt}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'checkbox':
                return (
                    <div className="grid gap-2 pl-0.5">
                        {(field.options || []).map((opt: string) => (
                            <label key={opt} className="flex items-center gap-2.5 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={(formData[field.id] || []).includes(opt)}
                                    onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                                    className="w-4 h-4 rounded border-white/10 bg-[#161412] text-[#6366F1] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="text-xs text-white/80 font-sans">{opt}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'textarea':
                return (
                    <textarea
                        rows={3}
                        required={field.required}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#161412] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#6366F1] transition-colors text-xs font-sans resize-none"
                        placeholder="Enter response…"
                    />
                );
            case 'file':
                const selectedFile = formData[field.id];
                return (
                    <div className="flex flex-col gap-2">
                        {selectedFile ? (
                            <div className="flex items-center justify-between p-3 rounded-xl bg-[#161412] border border-white/10">
                                <div className="flex items-center gap-2 min-w-0">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span className="text-xs font-semibold text-white/80 truncate max-w-[200px] font-sans">
                                        {selectedFile.originalName || 'File uploaded'}
                                    </span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleFieldChange(field.id, null)} 
                                    className="p-1 text-white/40 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                >
                                    <XIcon size={14} />
                                </button>
                            </div>
                        ) : (
                            <label className="cursor-pointer px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-2 transition-colors w-fit">
                                <UploadIcon size={14} className="text-[#6366F1]" />
                                <span>{submitting ? 'Uploading…' : 'Upload File (Max 5MB)'}</span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    required={field.required && !selectedFile}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        if (file.size > 5 * 1024 * 1024) {
                                            setError('File exceeds 5MB limit.');
                                            return;
                                        }
                                        setSubmitting(true);
                                        try {
                                            const fData = new FormData();
                                            fData.append('file', file);
                                            fData.append('bucketId', APPWRITE_CONFIG.BUCKETS.FORM_ATTACHMENTS);
                                            const uploaded = await secureUploadFile(fData);
                                            handleFieldChange(field.id, {
                                                fileId: uploaded.$id,
                                                bucketId: APPWRITE_CONFIG.BUCKETS.FORM_ATTACHMENTS,
                                                originalName: file.name
                                            });
                                        } catch (err: any) {
                                            setError(err.message || 'Failed to upload file.');
                                        } finally {
                                            setSubmitting(false);
                                        }
                                    }}
                                />
                            </label>
                        )}
                    </div>
                );
            default:
                return (
                    <input
                        type={field.type || 'text'}
                        required={field.required}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#161412] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-[#6366F1] transition-colors text-xs font-sans"
                        placeholder="Enter response…"
                    />
                );
        }
    };

    let schema: any[] = [];
    try { schema = JSON.parse(form?.schema || '[]'); } catch (_e) {}

    return (
        <div className="flex flex-col h-full bg-[#0A0908] text-white select-none">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between border-b border-white/5 bg-[#0E0D0B] shrink-0">
                <div className="min-w-0 pr-3">
                    <h3 className="font-extrabold text-sm text-white truncate font-sans">
                        {form?.title || 'Form Submission'}
                    </h3>
                    <p className="text-[11px] text-white/40 font-mono truncate mt-0.5">
                        {formId}
                    </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button 
                        type="button"
                        onClick={handleOpenStandalone} 
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        title="Open in Standalone Page"
                    >
                        <ArrowUpRight size={16} />
                    </button>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        title="Close"
                    >
                        <XIcon size={16} />
                    </button>
                </div>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 scrollbar-thin">
                {loading ? (
                    <div className="flex flex-col justify-center items-center py-16 gap-3">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#6366F1] border-t-transparent" />
                        <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">Loading…</span>
                    </div>
                ) : submitted ? (
                    <div className="text-center py-10 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
                            <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-extrabold text-white mb-1.5">Submitted Successfully</h4>
                        <p className="text-white/40 text-xs font-sans mb-6 max-w-xs leading-relaxed">
                            Your submission has been recorded.
                        </p>
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-all text-xs cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {form?.description && (
                            <p className="text-white/60 text-xs font-sans leading-relaxed pb-1 border-b border-white/5">
                                {form.description}
                            </p>
                        )}

                        <div className="flex flex-col gap-4">
                            {schema.map((field) => (
                                <div key={field.id} className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-extrabold text-white/80 font-sans tracking-wide">
                                        {field.label} {field.required && <span className="text-rose-400 font-bold ml-0.5">*</span>}
                                    </label>
                                    {renderField(field)}
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold leading-relaxed text-center">
                                {error}
                            </div>
                        )}

                        <div className="pt-3">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-2.5 px-4 rounded-xl font-bold bg-[#6366F1] text-white hover:bg-[#5254E8] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs cursor-pointer shadow-lg shadow-[#6366F1]/10"
                            >
                                {submitting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                ) : (
                                    <Send size={14} />
                                )}
                                <span>{submitting ? 'Submitting…' : 'Submit'}</span>
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
