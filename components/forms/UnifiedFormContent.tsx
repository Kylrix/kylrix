'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
    CheckCircle2, 
    Upload as UploadIcon, 
    X as XIcon, 
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    Send
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { Forms } from '@/generated/appwrite/types';
import { useDataNexus } from '@/context/DataNexusContext';
import { secureUploadFile } from '@/lib/actions/client-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { exportToMarkdown, exportToPDF } from '@/lib/utils/export';

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
    const [currentStep, setCurrentStep] = useState(0);
    const [currentUser, setCurrentUser] = useState<any>(null);

    const handleOpenStandalone = () => {
        if (typeof window !== 'undefined') {
            window.open(`/form/${formId}`, '_blank', 'noopener,noreferrer');
        }
    };

    useEffect(() => {
        if (!formId) return;

        let isMounted = true;
        const fetchForm = async () => {
            setLoading(true);
            setError(null);
            try {
                const user = await FormsService.getCurrentUser().catch(() => null);
                if (isMounted) setCurrentUser(user);

                const data = await fetchOptimized(`f_form_schema_${formId}`, () => 
                    FormsService.getForm(formId)
                );

                if (!isMounted) return;

                let settings: any = {};
                try {
                    settings = JSON.parse(data.settings || '{}');
                } catch (_e) {}

                const isOwner = user?.$id === data.userId;

                if (!isOwner && data.status !== 'published' && data.isPublic !== true) {
                    setError('This form is private and not currently accepting submissions.');
                    return;
                }

                if (!isOwner && settings.expiresAt && new Date(settings.expiresAt) < new Date()) {
                    setError('This form has expired and is no longer accepting responses.');
                    return;
                }

                setForm(data);

                // Load existing draft
                const localKey = `form_draft_${formId}`;
                const localData = localStorage.getItem(localKey);
                if (localData && localData !== 'undefined') {
                    try {
                        setFormData(JSON.parse(localData));
                    } catch (_e) {}
                }

                if (user) {
                    try {
                        const draft = await FormsService.getDraft(formId, user.$id);
                        if (draft?.payload) {
                            try {
                                setFormData(JSON.parse(draft.payload));
                            } catch (parseErr) {
                                console.warn('[Form] Remote draft payload invalid JSON', parseErr);
                            }
                        }
                    } catch (_e) {
                        console.error('Failed to check for remote draft', _e);
                    }
                }
            } catch (err: any) {
                if (isMounted) setError(err.message || 'Form not found or inaccessible.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchForm();
        return () => { isMounted = false; };
    }, [formId, fetchOptimized]);

    // Autosave draft
    useEffect(() => {
        if (!form || Object.keys(formData).length === 0 || submitted) return;

        const timer = setTimeout(async () => {
            const localKey = `form_draft_${formId}`;
            localStorage.setItem(localKey, JSON.stringify(formData));

            if (currentUser) {
                try {
                    await FormsService.saveDraft(formId, JSON.stringify(formData), currentUser.$id);
                } catch (_e) {
                    console.error('Autosave failed', _e);
                }
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [formData, formId, currentUser, form, submitted]);

    const isFieldVisible = (field: any) => {
        if (!field.logic || !field.logic.enabled) return true;
        const parentId = field.logic.showIfFieldId;
        const expectedVal = field.logic.showIfValue;
        if (!parentId) return true;
        
        const actualVal = formData[parentId];
        if (Array.isArray(actualVal)) {
            return actualVal.includes(expectedVal);
        }
        return actualVal === expectedVal;
    };

    let schema: any[] = [];
    if (form?.schema) {
        try {
            schema = JSON.parse(form.schema);
        } catch (_e) {
            console.error('Failed to parse form schema', _e);
        }
    }

    const visibleFields = schema.filter(isFieldVisible);
    const activeField = visibleFields[currentStep];

    const handleFieldChange = (fieldId: string, value: any) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
        setError(null);
    };

    const handleCheckboxChange = (fieldId: string, option: string, checked: boolean) => {
        const currentValues = formData[fieldId] || [];
        const nextValues = checked 
            ? [...currentValues, option]
            : currentValues.filter((v: string) => v !== option);
        handleFieldChange(fieldId, nextValues);
    };

    const handleSingleChoiceSelect = (fieldId: string, value: string) => {
        handleFieldChange(fieldId, value);
        setTimeout(() => {
            if (currentStep < visibleFields.length - 1) {
                setCurrentStep(prev => prev + 1);
            }
        }, 250);
    };

    const handleNext = () => {
        if (!activeField) return;
        if (activeField.required && (formData[activeField.id] === undefined || formData[activeField.id] === null || formData[activeField.id] === '' || (Array.isArray(formData[activeField.id]) && formData[activeField.id].length === 0))) {
            setError('This field is required.');
            return;
        }
        setError(null);
        if (currentStep < visibleFields.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            triggerSubmit();
        }
    };

    const handleBack = () => {
        setError(null);
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const triggerSubmit = async () => {
        setSubmitting(true);
        setError(null);

        try {
            await FormsService.submitForm(formId, JSON.stringify(formData));
            setSubmitted(true);
            localStorage.removeItem(`form_draft_${formId}`);
        } catch (err: any) {
            setError(err.message || 'Failed to submit form. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Keyboard navigation (Enter key)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                if (activeField && activeField.type !== 'textarea') {
                    e.preventDefault();
                    handleNext();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentStep, formData, visibleFields, activeField]);

    const formatResponseMarkdown = () => {
        let md = `# Form Submission: ${form?.title || 'Form'}\n\n`;
        md += `**Submitted At:** ${new Date().toLocaleString()}\n\n`;
        md += `## Responses\n\n`;
        
        schema.forEach((field: any) => {
            const val = formData[field.id];
            if (val !== undefined && val !== null && val !== '') {
                md += `### ${field.label}\n`;
                if (Array.isArray(val)) {
                    md += `${val.map(v => `- ${v}`).join('\n')}\n\n`;
                } else if (typeof val === 'object' && val.originalName) {
                    md += `[Attached File: ${val.originalName}]\n\n`;
                } else {
                    md += `${val}\n\n`;
                }
            }
        });
        return md;
    };

    const renderField = (field: any) => {
        if (!field) return null;
        switch (field.type) {
            case 'select':
            case 'radio':
                return (
                    <div className="grid gap-2.5 w-full">
                        {(field.options || []).map((opt: string) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => handleSingleChoiceSelect(field.id, opt)}
                                className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-satoshi font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                    formData[field.id] === opt 
                                        ? 'bg-[#6366F1]/12 border-[#6366F1] text-white shadow-[0_0_16px_rgba(99,102,241,0.12)]' 
                                        : 'bg-[#0B0A09] border-white/5 text-zinc-400 hover:border-white/10 hover:text-white'
                                }`}
                            >
                                <span>{opt}</span>
                                {formData[field.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-[#6366F1]" />}
                            </button>
                        ))}
                    </div>
                );
            case 'checkbox':
                return (
                    <div className="grid gap-2.5 w-full">
                        {(field.options || []).map((opt: string) => {
                            const isChecked = (formData[field.id] || []).includes(opt);
                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleCheckboxChange(field.id, opt, !isChecked)}
                                    className={`w-full text-left px-4 py-3.5 rounded-2xl border text-sm font-satoshi font-semibold transition-all flex items-center justify-between cursor-pointer ${
                                        isChecked 
                                            ? 'bg-[#6366F1]/12 border-[#6366F1] text-white shadow-[0_0_16px_rgba(99,102,241,0.12)]' 
                                            : 'bg-[#0B0A09] border-white/5 text-zinc-400 hover:border-white/10 hover:text-white'
                                    }`}
                                >
                                    <span>{opt}</span>
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                        isChecked ? 'bg-[#6366F1] border-[#6366F1]' : 'border-white/10'
                                    }`}>
                                        {isChecked && (
                                            <svg className="w-3.5 h-3.5 text-[#050505] stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                );
            case 'textarea':
                return (
                    <textarea
                        rows={4}
                        required={field.required}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-4 py-3.5 rounded-2xl bg-[#0B0A09] border border-white/5 text-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 hover:border-white/10 transition-all resize-none font-satoshi leading-relaxed text-sm md:text-base"
                        placeholder="Type response here…"
                        autoFocus
                    />
                );
            case 'file':
                const selectedFile = formData[field.id];
                return (
                    <div className="flex flex-col gap-2.5 w-full">
                        {selectedFile ? (
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-[#0B0A09] border border-white/5 transition-all">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                    <span className="text-xs font-bold text-zinc-200 truncate max-w-[220px] font-satoshi">
                                        {selectedFile.originalName || 'File uploaded'}
                                    </span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleFieldChange(field.id, null)} 
                                    className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                >
                                    <XIcon size={16} />
                                </button>
                            </div>
                        ) : (
                            <label
                                className={`w-full py-4 px-5 rounded-2xl border border-dashed border-white/10 bg-[#0B0A09] hover:bg-white/[0.02] hover:border-[#6366F1] transition-all cursor-pointer flex items-center justify-center gap-2.5 text-xs font-bold text-zinc-400 hover:text-white font-satoshi ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {submitting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                ) : (
                                    <UploadIcon size={18} />
                                )}
                                <span>{submitting ? 'Uploading…' : 'Choose File (Max 5MB)'}</span>
                                {!submitting && (
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
                        className="w-full px-4 py-3.5 rounded-2xl bg-[#0B0A09] border border-white/5 text-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 hover:border-white/10 transition-all font-satoshi text-sm md:text-base"
                        placeholder="Type response…"
                        autoFocus
                    />
                );
        }
    };

    const completionProgress = visibleFields.length > 0 ? ((currentStep + 1) / visibleFields.length) * 100 : 0;

    return (
        <div className="flex flex-col h-full bg-[#161412] text-white select-none">
            {/* Top Progress Bar */}
            <div className="w-full h-1 bg-white/5 shrink-0">
                <div 
                    className="h-full bg-[#6366F1] shadow-[0_0_12px_rgba(99,102,241,0.5)] transition-all duration-300 ease-out"
                    style={{ width: `${submitted ? 100 : completionProgress}%` }}
                />
            </div>

            {/* Header */}
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/5 bg-[#161412] shrink-0">
                <div className="min-w-0 pr-3">
                    <h3 className="font-extrabold text-sm text-white truncate font-clash">
                        {form?.title || 'Form Submission'}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                            {visibleFields.length > 0 && !submitted ? `${currentStep + 1} OF ${visibleFields.length}` : 'COMPLETED'}
                        </span>
                        {form?.description && (
                            <span className="text-[10.5px] text-zinc-400 truncate max-w-[200px]">
                                • {form.description}
                            </span>
                        )}
                    </div>
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

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 flex flex-col justify-between">
                {loading ? (
                    <div className="flex flex-col justify-center items-center py-16 gap-3 my-auto">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#6366F1] border-t-transparent" />
                        <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">Loading form…</span>
                    </div>
                ) : error && !form ? (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-rose-400 rounded-2xl font-semibold text-center text-xs leading-relaxed my-auto">
                        {error}
                    </div>
                ) : submitted ? (
                    <div className="text-center py-8 flex flex-col items-center my-auto">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400">
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <h4 className="text-lg font-black font-clash text-white mb-2">Transmission Complete</h4>
                        <p className="text-zinc-400 text-xs font-satoshi mb-6 max-w-xs leading-relaxed">
                            Your response has been securely transmitted.
                        </p>

                        <div className="flex flex-wrap gap-2 w-full justify-center mb-4">
                            <button 
                                type="button" 
                                onClick={() => {
                                    exportToMarkdown(form?.title || 'Form Response', formatResponseMarkdown());
                                }}
                                className="px-3.5 py-2 rounded-xl border border-white/5 bg-white/[0.03] text-zinc-300 font-bold hover:bg-white/5 transition-all font-satoshi text-xs cursor-pointer"
                            >
                                Export MD
                            </button>
                            <button 
                                type="button" 
                                onClick={() => {
                                    exportToPDF(form?.title || 'Form Response', formatResponseMarkdown());
                                }}
                                className="px-3.5 py-2 rounded-xl border border-white/5 bg-white/[0.03] text-zinc-300 font-bold hover:bg-white/5 transition-all font-satoshi text-xs cursor-pointer"
                            >
                                Export PDF
                            </button>
                            <button 
                                type="button" 
                                onClick={onClose}
                                className="px-5 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold transition-all text-xs cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : activeField ? (
                    <div className="flex flex-col flex-1 justify-between gap-6 my-auto">
                        {/* Staggered Question Block */}
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1">
                                <h4 className="text-base md:text-lg font-black font-clash text-white leading-snug">
                                    {activeField.label} {activeField.required && <span className="text-rose-400 font-bold">*</span>}
                                </h4>
                                {activeField.description && (
                                    <p className="text-xs text-zinc-400 font-satoshi leading-relaxed">
                                        {activeField.description}
                                    </p>
                                )}
                            </div>

                            {/* Render Active Field */}
                            <div className="pt-2">
                                {renderField(activeField)}
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-rose-400 rounded-xl text-xs font-semibold leading-relaxed">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Step Navigation Bar */}
                        <div className="flex items-center justify-between gap-3 pt-4 border-t border-white/5">
                            {currentStep > 0 ? (
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                    <ArrowLeft size={14} />
                                    <span>Back</span>
                                </button>
                            ) : (
                                <div />
                            )}

                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={submitting}
                                className="px-5 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-lg shadow-[#6366F1]/10 ml-auto"
                            >
                                {submitting ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                                ) : currentStep < visibleFields.length - 1 ? (
                                    <>
                                        <span>Next</span>
                                        <ArrowRight size={14} />
                                    </>
                                ) : (
                                    <>
                                        <Send size={14} />
                                        <span>Submit</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-zinc-400 text-xs my-auto">
                        No fields found in this form.
                    </div>
                )}
            </div>
        </div>
    );
}
