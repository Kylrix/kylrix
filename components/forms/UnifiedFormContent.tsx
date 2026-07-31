'use client';

import React, { useEffect, useState } from 'react';
import { 
    Send, 
    CheckCircle2, 
    Upload as UploadIcon, 
    X as XIcon, 
    ChevronDown, 
    ChevronUp, 
    ArrowUpRight 
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { Forms } from '@/generated/appwrite/types';
import { useDataNexus } from '@/context/DataNexusContext';
import { secureUploadFile } from '@/lib/actions/client-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useSection } from '@/context/SectionContext';

interface UnifiedFormContentProps {
    formId: string;
    onClose: () => void;
}

export function UnifiedFormContent({ formId, onClose }: UnifiedFormContentProps) {
    const { setActiveDetail } = useSection();
    const [isExpanded, setIsExpanded] = useState(false);
    const { fetchOptimized } = useDataNexus();
    const [form, setForm] = useState<Forms | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [isHydrated, setIsHydrated] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        const checkSize = () => setIsDesktop(window.innerWidth >= 768);
        checkSize();
        window.addEventListener('resize', checkSize);
        return () => window.removeEventListener('resize', checkSize);
    }, []);

    const handleMorphToDetail = () => {
        setActiveDetail({ type: 'form', id: formId });
        onClose();
    };

    // Load draft when form schema is loaded
    useEffect(() => {
        if (!formId || !form || typeof window === 'undefined') {
            setIsHydrated(false);
            return;
        }
        const raw = localStorage.getItem(`kylrix:draft:form:${formId}`);
        if (raw) {
            try {
                const draft = JSON.parse(raw);
                setFormData(draft);
            } catch (e) {
                console.error('Failed to parse form draft', e);
            }
        }
        setIsHydrated(true);
    }, [formId, form]);

    // Save draft when formData changes
    useEffect(() => {
        if (!formId || typeof window === 'undefined' || !isHydrated) return;
        if (Object.keys(formData).length > 0) {
            localStorage.setItem(`kylrix:draft:form:${formId}`, JSON.stringify(formData));
        } else {
            localStorage.removeItem(`kylrix:draft:form:${formId}`);
        }
    }, [formId, isHydrated, formData]);

    useEffect(() => {
        if (!formId) return;

        const fetchForm = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchOptimized(`f_form_schema_${formId}`, () => 
                    FormsService.getForm(formId)
                );
                setForm(data);
            } catch (err: any) {
                setError(err.message || 'Form not found or inaccessible.');
            } finally {
                setLoading(false);
            }
        };
        fetchForm();
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
            await FormsService.submitForm(formId, JSON.stringify(formData));
            if (typeof window !== 'undefined') {
                localStorage.removeItem(`kylrix:draft:form:${formId}`);
            }
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Failed to submit form. Please try again.');
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
                            className="w-full px-4.5 py-3.5 rounded-xl bg-[#0B0A09] border border-[#34322F] text-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 hover:border-[#6366F1] transition-all cursor-pointer font-satoshi text-sm appearance-none"
                        >
                            <option value="" disabled hidden>Select an option</option>
                            {(field.options || []).map((opt: string) => (
                                <option key={opt} value={opt} className="bg-[#161412] text-white font-satoshi">{opt}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                );
            case 'radio':
                return (
                    <div className="grid gap-2.5 pl-1">
                        {(field.options || []).map((opt: string) => (
                            <label key={opt} className="flex items-center gap-3 cursor-pointer group select-none">
                                <input 
                                    type="radio" 
                                    name={field.id}
                                    value={opt}
                                    checked={formData[field.id] === opt}
                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    className="w-4.5 h-4.5 text-[#6366F1] bg-[#0B0A09] border border-[#34322F] checked:bg-[#6366F1] checked:border-[#6366F1] focus:ring-0 focus:ring-offset-0 focus:outline-none transition-all cursor-pointer"
                                />
                                <span className="text-sm font-satoshi text-zinc-300 group-hover:text-white transition-colors">{opt}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'checkbox':
                return (
                    <div className="grid gap-2.5 pl-1">
                        {(field.options || []).map((opt: string) => (
                            <label key={opt} className="flex items-center gap-3 cursor-pointer group select-none">
                                <input 
                                    type="checkbox"
                                    checked={(formData[field.id] || []).includes(opt)}
                                    onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                                    className="w-4.5 h-4.5 text-[#6366F1] bg-[#0B0A09] border border-[#34322F] rounded checked:bg-[#6366F1] checked:border-[#6366F1] focus:ring-0 focus:ring-offset-0 focus:outline-none transition-all cursor-pointer"
                                />
                                <span className="text-sm font-satoshi text-zinc-300 group-hover:text-white transition-colors">{opt}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'textarea':
                return (
                    <textarea
                        rows={4}
                        required={field.required}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-4.5 py-3.5 rounded-xl bg-[#0B0A09] border border-[#34322F] text-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 hover:border-[#6366F1] transition-all resize-y font-satoshi leading-relaxed text-sm"
                        placeholder="Type your response here..."
                    />
                );
            case 'file':
                const selectedFile = formData[field.id];
                return (
                    <div className="flex flex-col gap-2">
                        {selectedFile ? (
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0B0A09] border border-[#34322F] transition-all">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                                    <span className="text-sm font-semibold text-zinc-200 truncate max-w-[200px] font-satoshi">
                                        {selectedFile.originalName || 'File uploaded'}
                                    </span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleFieldChange(field.id, null)} 
                                    className="p-1 text-zinc-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <XIcon size={16} />
                                </button>
                            </div>
                        ) : (
                            <label
                                className={`w-full py-3 px-4 rounded-xl border border-dashed border-[#34322F] bg-[#1C1A18] hover:bg-[#34322F]/20 hover:border-[#6366F1] transition-all cursor-pointer flex items-center justify-center gap-2 text-sm font-bold text-zinc-400 hover:text-white font-satoshi ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {submitting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                ) : (
                                    <UploadIcon size={18} />
                                )}
                                <span>{submitting ? 'Uploading...' : 'Choose File (Max 5MB)'}</span>
                                {!submitting && (
                                    <input
                                        type="file"
                                        className="hidden"
                                        required={field.required && !selectedFile}
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            if (file.size > 5 * 1024 * 1024) {
                                                alert('File exceeds 5MB limit.');
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
                                                alert(err.message || 'Failed to upload file.');
                                            } finally {
                                                setSubmitting(false);
                                            }
                                        }}
                                    />
                                )}
                            </label>
                        )}
                    </div>
                );
            default:
                return (
                    <input
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                        required={field.required}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-[#0B0A09] border border-[#34322F] text-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 hover:border-[#6366F1] transition-all font-satoshi text-sm"
                        placeholder="Type response..."
                    />
                );
        }
    };

    let schema: any[] = [];
    try { schema = JSON.parse(form?.schema || '[]'); } catch (_e) {}

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 z-[1399] animate-in fade-in duration-200 cursor-pointer" 
                onClick={onClose}
            />

            {/* Side/Bottom Drawer */}
            <div 
                className={`fixed z-[1400] bg-[#050505] text-white overflow-hidden transition-all duration-300 ${
                    isDesktop 
                        ? 'right-0 top-0 bottom-0 h-full w-full max-w-[480px] border-l border-white/5 shadow-2xl animate-in slide-in-from-right duration-300' 
                        : 'bottom-0 left-0 right-0 w-full rounded-t-[32px] border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300'
                }`}
                style={!isDesktop ? { height: isExpanded ? '100dvh' : '60dvh' } : undefined}
            >
                <div 
                    className="flex flex-col h-full bg-[#050505] overflow-hidden"
                    style={{ backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(99, 102, 241, 0.08) 0%, transparent 60%)' }}
                >
                    {/* Header */}
                    <div className="p-5 flex justify-between items-center border-b border-white/5">
                        <h3 className="font-bold text-lg font-clash text-white tracking-wide truncate pr-2">
                            {form?.title || 'Intelligence Portal'}
                        </h3>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button 
                                type="button"
                                onClick={handleMorphToDetail} 
                                className="p-1.5 text-amber-500 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-colors"
                                title="Go Full Detail"
                            >
                                <ArrowUpRight size={20} />
                            </button>
                            {!isDesktop && (
                                <button 
                                    type="button"
                                    onClick={() => setIsExpanded(!isExpanded)} 
                                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                                </button>
                            )}
                            <button 
                                type="button"
                                onClick={onClose} 
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <XIcon size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin">
                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#6366F1] border-t-transparent" />
                            </div>
                        ) : submitted ? (
                            <div className="text-center py-6 flex flex-col items-center animate-in fade-in duration-300">
                                <div className="w-16 h-16 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center mb-6">
                                    <CheckCircle2 className="w-8 h-8 text-[#6366F1]" />
                                </div>
                                <h4 className="text-xl md:text-2xl font-bold font-clash text-white mb-2">Transmission Complete</h4>
                                <p className="text-zinc-400 font-satoshi text-sm mb-6 leading-relaxed">
                                    Your request has been securely injected into the Kylrix nexus.
                                </p>
                                <button 
                                    type="button" 
                                    onClick={onClose}
                                    className="px-6 py-2.5 rounded-xl border border-white/10 hover:border-[#6366F1] hover:bg-white/5 text-white font-bold transition-all font-satoshi text-sm"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                                {form?.description && (
                                    <p className="text-zinc-400 font-satoshi text-sm leading-relaxed mb-2">
                                        {form.description}
                                    </p>
                                )}

                                <div className="flex flex-col gap-6">
                                    {schema.map((field) => (
                                        <div key={field.id} className="flex flex-col gap-2.5">
                                            <label className="text-xs font-bold text-zinc-300 font-satoshi tracking-wide">
                                                {field.label} {field.required && <span className="text-rose-500 font-bold ml-0.5">*</span>}
                                            </label>
                                            {renderField(field)}
                                        </div>
                                    ))}
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-[#ff1744] rounded-xl text-sm font-semibold font-satoshi leading-relaxed text-center mt-2">
                                        {error}
                                    </div>
                                )}

                                <div className="mt-8 pb-4">
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full py-3.5 px-6 rounded-xl font-bold bg-[#6366F1] text-zinc-950 shadow-[0_8px_30px_rgb(99,102,241,0.2)] hover:bg-[#5254E8] hover:translate-y-[-1px] transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed font-clash text-base md:text-lg tracking-wide"
                                    >
                                        {submitting ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-zinc-950 border-t-transparent" />
                                        ) : (
                                            <Send size={18} />
                                        )}
                                        <span>{submitting ? 'Transmitting...' : 'Submit Request'}</span>
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
