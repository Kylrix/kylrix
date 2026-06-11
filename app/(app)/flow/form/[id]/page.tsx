'use client';

import React, { useEffect, useState, use } from 'react';
import { Send, CheckCircle2, Upload as UploadIcon, X as XIcon, ChevronDown, ArrowLeft } from 'lucide-react';
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
                if (localData && localData !== 'undefined') {
                    try {
                        setFormData(JSON.parse(localData));
                    } catch (_e) {}
                }

                // If logged in, prioritize DB draft if exists
                if (user) {
                    try {
                        const draft = await FormsService.getDraft(resolvedParams.id, user.$id);
                        if (draft && draft.payload) {
                            try {
                                setFormData(JSON.parse(draft.payload));
                            } catch (parseErr) {
                                console.warn("[Form] Remote draft payload invalid JSON", parseErr);
                            }
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
            console.error("Failed to parse form schema", _e);
        }
    }

    const visibleFields = schema.filter(isFieldVisible);
    const [currentStep, setCurrentStep] = useState(0);

    // Adjust step if out of bounds due to conditional changes
    useEffect(() => {
        if (currentStep >= visibleFields.length && visibleFields.length > 0) {
            setCurrentStep(visibleFields.length - 1);
        }
    }, [visibleFields, currentStep]);

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
        }, 300);
    };

    const activeField = visibleFields[currentStep];

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

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-[#050505]">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#6366F1] border-t-transparent" />
            </div>
        );
    }

    if (error && !form) {
        return (
            <div className="max-w-md w-full mx-auto px-4 py-20 font-satoshi">
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-[#ff1744] rounded-2xl font-semibold text-center leading-relaxed">
                    {error}
                </div>
            </div>
        );
    }

    const renderField = (field: any) => {
        if (!field) return null;
        switch (field.type) {
            case 'select':
                return (
                    <div className="grid gap-3 w-full">
                        {(field.options || []).map((opt: string) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => handleSingleChoiceSelect(field.id, opt)}
                                className={`w-full text-left px-5 py-4 rounded-2xl border text-sm md:text-base font-satoshi font-semibold transition-all flex items-center justify-between ${
                                    formData[field.id] === opt 
                                        ? 'bg-[#6366F1]/10 border-[#6366F1] text-white shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
                                        : 'bg-[#0B0A09] border-white/5 text-zinc-400 hover:border-white/10 hover:text-white'
                                }`}
                            >
                                <span>{opt}</span>
                                {formData[field.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-[#6366F1]" />}
                            </button>
                        ))}
                    </div>
                );
            case 'radio':
                return (
                    <div className="grid gap-3 w-full">
                        {(field.options || []).map((opt: string) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => handleSingleChoiceSelect(field.id, opt)}
                                className={`w-full text-left px-5 py-4 rounded-2xl border text-sm md:text-base font-satoshi font-semibold transition-all flex items-center justify-between ${
                                    formData[field.id] === opt 
                                        ? 'bg-[#6366F1]/10 border-[#6366F1] text-white shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
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
                    <div className="grid gap-3 w-full">
                        {(field.options || []).map((opt: string) => {
                            const isChecked = (formData[field.id] || []).includes(opt);
                            return (
                                <button
                                    key={opt}
                                    type="button"
                                    onClick={() => handleCheckboxChange(field.id, opt, !isChecked)}
                                    className={`w-full text-left px-5 py-4 rounded-2xl border text-sm md:text-base font-satoshi font-semibold transition-all flex items-center justify-between ${
                                        isChecked 
                                            ? 'bg-[#6366F1]/10 border-[#6366F1] text-white shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
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
                        rows={5}
                        required={field.required}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full px-5 py-4 rounded-2xl bg-[#0B0A09] border border-white/5 text-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 hover:border-white/10 transition-all resize-none font-satoshi leading-relaxed text-base md:text-lg"
                        placeholder="Type your response here..."
                    />
                );
            case 'file':
                const selectedFile = formData[field.id];
                return (
                    <div className="flex flex-col gap-3 w-full">
                        {selectedFile ? (
                            <div className="flex items-center justify-between p-5 rounded-2xl bg-[#0B0A09] border border-white/5 transition-all">
                                <div className="flex items-center gap-3 min-w-0">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                                    <span className="text-sm font-bold text-zinc-200 truncate max-w-[240px] font-satoshi">
                                        {selectedFile.originalName || 'File uploaded'}
                                    </span>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => handleFieldChange(field.id, null)} 
                                    className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <XIcon size={18} />
                                </button>
                            </div>
                        ) : (
                            <label
                                className={`w-full py-5 px-6 rounded-2xl border border-dashed border-white/10 bg-[#0B0A09] hover:bg-white/[0.02] hover:border-[#6366F1] transition-all cursor-pointer flex items-center justify-center gap-3 text-sm font-bold text-zinc-400 hover:text-white font-satoshi ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {submitting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                ) : (
                                    <UploadIcon size={20} />
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
                        className="w-full px-5 py-4 rounded-2xl bg-[#0B0A09] border border-white/5 text-white focus:outline-none focus:border-[#6366F1] focus:ring-1 focus:ring-[#6366F1]/30 hover:border-white/10 transition-all font-satoshi text-base md:text-lg"
                        placeholder="Type response..."
                    />
                );
        }
    };

    const completionProgress = visibleFields.length > 0 ? ((currentStep) / visibleFields.length) * 100 : 0;

    return (
        <div 
            className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-between"
            style={{ backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(99, 102, 241, 0.08) 0%, transparent 60%)' }}
        >
            {/* Top Progress Bar */}
            <div className="w-full h-1.5 bg-white/5 fixed top-0 left-0 z-50">
                <div 
                    className="h-full bg-[#6366F1] shadow-[0_0_12px_rgba(99,102,241,0.5)] transition-all duration-300 ease-out"
                    style={{ width: `${completionProgress}%` }}
                />
            </div>

            {/* Empty Header spacing */}
            <div className="w-full py-6 flex justify-center items-center relative px-6 z-10 shrink-0">
                {currentStep > 0 && !submitted && (
                    <button 
                        onClick={handleBack}
                        className="absolute left-6 text-zinc-400 hover:text-white flex items-center gap-1.5 font-bold font-satoshi text-sm bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl transition-all"
                    >
                        <ArrowLeft size={16} />
                        Back
                    </button>
                )}
                <span className="text-xs font-bold font-mono tracking-widest text-zinc-500">
                    {visibleFields.length > 0 && !submitted ? `${currentStep + 1} OF ${visibleFields.length}` : ''}
                </span>
            </div>

            {/* Main Content card */}
            <div className="max-w-2xl w-full mx-auto px-6 py-8 flex-1 flex flex-col justify-center relative z-10">
                {submitted ? (
                    <div className="p-8 md:p-16 text-center rounded-[28px] bg-[#161412] border border-white/5 flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-8 h-8 text-[#6366F1]" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold font-clash text-white mb-3">Transmission Complete</h2>
                        <p className="text-[#9B9691] mb-8 font-medium font-satoshi text-sm md:text-base">
                            Your data has been securely injected into the Kylrix Flow nexus.
                        </p>
                        <button 
                            type="button" 
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 rounded-xl border border-white/5 text-white font-bold hover:bg-[#1C1A18] hover:border-[#6366F1] hover:text-white transition-all font-satoshi text-sm"
                        >
                            Submit New Entry
                        </button>
                    </div>
                ) : visibleFields.length === 0 ? (
                    <div className="p-8 text-center rounded-[28px] bg-[#161412] border border-white/5">
                        <h2 className="text-xl font-bold font-clash text-white mb-2">No Questions Defined</h2>
                        <p className="text-zinc-400 font-satoshi text-sm">
                            This form doesn&apos;t contain any visible logic fields.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-8">
                        {/* Title and description on the very first question */}
                        {currentStep === 0 && (
                            <div className="mb-4">
                                <h1 className="text-3xl md:text-4.5xl font-extrabold font-clash text-white tracking-tight leading-tight">
                                    {form?.title}
                                </h1>
                                {form?.description && (
                                    <p className="text-zinc-400 font-satoshi font-normal leading-relaxed text-sm md:text-base mt-2">
                                        {form.description}
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-3">
                                <label className="text-xl md:text-2xl font-bold text-white font-satoshi tracking-wide leading-snug">
                                    {activeField.label} {activeField.required && <span className="text-rose-500 font-bold ml-1">*</span>}
                                </label>
                            </div>
                            
                            <div className="w-full">
                                {renderField(activeField)}
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 text-[#ff1744] rounded-xl text-sm font-semibold font-satoshi leading-relaxed text-center">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center gap-4 mt-2">
                            <button
                                onClick={handleNext}
                                disabled={submitting}
                                className="px-8 py-3.5 rounded-2xl font-bold bg-[#6366F1] text-zinc-950 hover:bg-[#5254E8] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-base font-clash tracking-wide"
                            >
                                {submitting ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-zinc-950 border-t-transparent" />
                                ) : currentStep === visibleFields.length - 1 ? (
                                    <Send size={16} />
                                ) : (
                                    <span>OK</span>
                                )}
                                <span>{submitting ? 'Transmitting...' : currentStep === visibleFields.length - 1 ? 'Submit' : 'Next'}</span>
                            </button>
                            
                            {activeField.type !== 'textarea' && (
                                <span className="text-xs font-medium text-zinc-500 font-satoshi hidden sm:inline">
                                    press <strong className="text-zinc-400 font-bold">Enter ↵</strong>
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Footer Info */}
            <div className="w-full py-8 text-center shrink-0">
                <span className="text-[10px] md:text-xs font-mono font-bold tracking-[0.3em] text-[#9B9691] opacity-25">
                    Secured by Kylrix Neural Flow
                </span>
            </div>
        </div>
    );
}
