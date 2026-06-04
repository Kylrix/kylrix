'use client';

import React, { useEffect, useState, use } from 'react';
import { Send, CheckCircle2, Upload as UploadIcon, X as XIcon, ChevronDown } from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { Forms } from '@/generated/appwrite/types';
import { useDataNexus } from '@/context/DataNexusContext';
import { secureUploadFile } from '@/lib/actions/client-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export default function PublicFormPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const { fetchOptimized } = useDataNexus();
    const [form, setForm] = useState<Forms | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        const fetchForm = async () => {
            try {
                if (!resolvedParams?.id) {
                    setError('Invalid form reference.');
                    return;
                }

                const user = await FormsService.getCurrentUser();
                setCurrentUser(user);

                const data = await fetchOptimized(`f_form_schema_${resolvedParams.id}`, () => 
                    FormsService.getForm(resolvedParams.id)
                );
                
                let settings: any = {};
                try {
                    settings = JSON.parse(data.settings || '{}');
                } catch (_e) {}

                const isOwner = user?.$id === data.userId;

                if (!isOwner && data.status !== 'published' && data.isPublic !== true) {
                    setError('This form is private and not currently accepting public submissions.');
                    return;
                }

                if (!isOwner && settings.expiresAt && new Date(settings.expiresAt) < new Date()) {
                    setError('This form has expired and is no longer accepting responses.');
                    return;
                }

                setForm(data);

                // Load existing draft/local data
                const localKey = `form_draft_${resolvedParams.id}`;
                const localData = localStorage.getItem(localKey);
                if (localData) {
                    try {
                        setFormData(JSON.parse(localData));
                    } catch (_e) {}
                }

                // If logged in, prioritize DB draft if exists
                if (user) {
                    try {
                        const draft = await FormsService.getDraft(resolvedParams.id, user.$id);
                        if (draft) {
                            setFormData(JSON.parse(draft.payload));
                        }
                    } catch (_e) {
                        console.error("Failed to check for remote draft", _e);
                    }
                }

            } catch (err: any) {
                setError(err.message || 'Form not found or inaccessible.');
            } finally {
                setLoading(false);
            }
        };
        fetchForm();
    }, [resolvedParams.id, fetchOptimized]);

    // Autosave logic
    useEffect(() => {
        if (!form || Object.keys(formData).length === 0 || submitted) return;

        const timer = setTimeout(async () => {
            // Local save
            const localKey = `form_draft_${resolvedParams.id}`;
            localStorage.setItem(localKey, JSON.stringify(formData));

            // Remote save if logged in
            if (currentUser) {
                try {
                    await FormsService.saveDraft(resolvedParams.id, JSON.stringify(formData), currentUser.$id);
                } catch (_e) {
                    console.error("Autosave failed", _e);
                }
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, [formData, resolvedParams.id, currentUser, form, submitted]);

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
            await FormsService.submitForm(resolvedParams.id, JSON.stringify(formData));
            setSubmitted(true);
            // Clear local draft
            localStorage.removeItem(`form_draft_${resolvedParams.id}`);
        } catch (err: any) {
            setError(err.message || 'Failed to submit form. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-[#050505]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#6366F1] border-t-transparent" />
            </div>
        );
    }

    if (error && !form) {
        return (
            <div className="max-w-md w-full mx-auto px-4 py-20">
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-[#ff1744] rounded-2xl font-semibold">
                    {error}
                </div>
            </div>
        );
    }

    let schema: any[] = [];
    try { schema = JSON.parse(form?.schema || '[]'); } catch (_e) {}

    const renderField = (field: any) => {
        switch (field.type) {
            case 'select':
                return (
                    <div className="relative">
                        <select
                            value={formData[field.id] || ''}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            required={field.required}
                            className="w-full px-4 py-3 rounded-xl bg-black border border-[#34322F] text-white focus:outline-none focus:border-[#6366F1] hover:border-[#6366F1] transition-colors appearance-none cursor-pointer text-sm"
                        >
                            <option value="" disabled hidden>Select an option</option>
                            {(field.options || []).map((opt: string) => (
                                <option key={opt} value={opt} className="bg-black text-white">{opt}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-400">
                            <ChevronDown size={16} />
                        </div>
                    </div>
                );
            case 'radio':
                return (
                    <div className="flex flex-col gap-2">
                        {(field.options || []).map((opt: string) => (
                            <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="radio" 
                                    name={field.id}
                                    value={opt}
                                    checked={formData[field.id] === opt}
                                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                                    className="w-4 h-4 text-[#6366F1] bg-black border border-[#34322F] focus:ring-[#6366F1] focus:ring-offset-0 focus:ring-0"
                                />
                                <span className="text-sm text-white font-medium group-hover:text-zinc-200">{opt}</span>
                            </label>
                        ))}
                    </div>
                );
            case 'checkbox':
                return (
                    <div className="flex flex-col gap-2">
                        {(field.options || []).map((opt: string) => (
                            <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox"
                                    checked={(formData[field.id] || []).includes(opt)}
                                    onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                                    className="w-4 h-4 text-[#6366F1] bg-black border border-[#34322F] rounded focus:ring-[#6366F1] focus:ring-offset-0 focus:ring-0"
                                />
                                <span className="text-sm text-white font-medium group-hover:text-zinc-200">{opt}</span>
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
                        className="w-full px-4 py-3 rounded-xl bg-black border border-[#34322F] text-white focus:outline-none focus:border-[#6366F1] hover:border-[#6366F1] transition-colors resize-y font-sans leading-relaxed text-sm"
                        placeholder="Enter your response..."
                    />
                );
            case 'file':
                const selectedFile = formData[field.id];
                return (
                    <div className="flex flex-col gap-2">
                        {selectedFile ? (
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-black border border-[#34322F]">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                                    <span className="text-sm font-semibold text-white truncate max-w-[200px]">
                                        {selectedFile.originalName || 'File uploaded'}
                                    </span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleFieldChange(field.id, null)} 
                                    className="p-1 text-red-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <XIcon size={16} />
                                </button>
                            </div>
                        ) : (
                            <label
                                className={`w-full py-3.5 px-4 rounded-xl border border-dashed border-[#34322F] bg-[#1C1A18] hover:bg-[#34322F]/20 hover:border-[#6366F1] transition-all cursor-pointer flex items-center justify-center gap-2 text-sm font-bold text-[#9B9691] hover:text-white ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        className="w-full px-4 py-3 rounded-xl bg-black border border-[#34322F] text-white focus:outline-none focus:border-[#6366F1] hover:border-[#6366F1] transition-colors font-sans text-sm"
                        placeholder="Enter response..."
                    />
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center">
            <div className="max-w-xl w-full mx-auto px-4 py-12 md:py-24">
                <div>
                    <div className="mb-8 text-center">
                        <h1 className="text-4xl md:text-5xl font-black mb-3 tracking-tight uppercase font-space-grotesk text-white">
                            {form?.title}
                        </h1>
                        {form?.description && (
                            <p className="text-[#9B9691] max-w-lg mx-auto font-medium leading-relaxed font-sans text-sm md:text-base">
                                {form.description}
                            </p>
                        )}

                        <div className="mt-4 flex justify-center">
                            <div className="px-3 py-1 rounded-full bg-[#1C1A18] border border-[#34322F] flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
                                <span className="text-xs font-bold text-[#9B9691] uppercase tracking-wider font-mono">
                                    {currentUser ? `Filling as ${currentUser.name || currentUser.email}` : 'Filling anonymously'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {submitted ? (
                        <div className="p-8 md:p-12 text-center rounded-[28px] bg-[#161412] border border-[#34322F] flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center mb-6">
                                <CheckCircle2 className="w-8 h-8 text-[#6366F1]" />
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black font-space-grotesk uppercase tracking-wide text-white mb-2">Transmission Complete</h2>
                            <p className="text-[#9B9691] mb-6 font-medium font-sans text-sm md:text-base">
                                Your data has been securely injected into the Kylrix Flow nexus.
                            </p>
                            <button 
                                type="button" 
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 rounded-xl border border-[#34322F] text-white font-bold hover:bg-[#1C1A18] hover:border-[#6366F1] transition-all font-sans text-sm"
                            >
                                Submit New Entry
                            </button>
                        </div>
                    ) : (
                        <form 
                            onSubmit={handleSubmit}
                            className="p-6 md:p-10 rounded-[28px] bg-[#161412] border border-[#34322F] flex flex-col gap-6"
                        >
                            {schema.map((field) => (
                                <div key={field.id} className="flex flex-col gap-2">
                                    <label className="text-xs font-bold text-white uppercase tracking-wider font-sans flex items-center gap-1">
                                        {field.label} {field.required && <span className="text-red-500 font-bold">*</span>}
                                    </label>
                                    {renderField(field)}
                                </div>
                            ))}

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 text-[#ff1744] rounded-xl text-sm font-semibold">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="mt-4 py-3.5 px-6 rounded-xl font-bold bg-[#6366F1] text-black hover:bg-[#575CF0] active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 hover:text-black text-base md:text-lg font-space-grotesk uppercase tracking-wide"
                            >
                                {submitting ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent" />
                                ) : (
                                    <Send size={18} />
                                )}
                                <span>{submitting ? 'Transmitting...' : 'Commit Response'}</span>
                            </button>
                        </form>
                    )}

                    <div className="mt-8 text-center opacity-20">
                        <span className="text-[10px] md:text-xs font-mono font-bold tracking-[0.3em] text-[#9B9691]">
                            SECURED BY KYLRIX NEURAL FLOW
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
