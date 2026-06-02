'use client';

import React, { useEffect, useState, use } from 'react';
import { 
    Box, 
    Typography, 
    TextField, 
    Button, 
    Paper, 
    CircularProgress, 
    Container,
    Alert,
    Fade,
    Radio,
    RadioGroup,
    FormControlLabel,
    Checkbox,
    FormGroup,
    Select,
    MenuItem,
    FormControl,
    IconButton
} from '@/lib/mui-tailwind/material';
import { Send as SendIcon, CheckCircleOutline as SuccessIcon } from '@/lib/mui-tailwind/icons';
import { Upload as UploadIcon, X as XIcon } from 'lucide-react';
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
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#050505' }}>
                <CircularProgress color="primary" />
            </Box>
        );
    }

    if (error && !form) {
        return (
            <Container maxWidth="sm" sx={{ py: 10 }}>
                <Alert severity="error" sx={{ bgcolor: 'rgba(211, 47, 47, 0.05)', color: '#ff1744', border: '1px solid rgba(211, 47, 47, 0.2)', borderRadius: '16px' }}>
                    {error}
                </Alert>
            </Container>
        );
    }

    let schema: any[] = [];
    try { schema = JSON.parse(form?.schema || '[]'); } catch (_e) {}

    const renderField = (field: any) => {
        switch (field.type) {
            case 'select':
                return (
                    <FormControl fullWidth variant="filled">
                        <Select
                            value={formData[field.id] || ''}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            required={field.required}
                            disableUnderline
                            sx={{ 
                                borderRadius: '12px', 
                                bgcolor: '#000000', 
                                border: '1px solid #34322F', 
                                color: 'white',
                                '& .MuiSelect-select': { color: 'white' },
                                '&:hover': { borderColor: '#6366F1' }
                            }}
                        >
                            {(field.options || []).map((opt: string) => (
                                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                );
            case 'radio':
                return (
                    <RadioGroup
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    >
                        {(field.options || []).map((opt: string) => (
                            <FormControlLabel 
                                key={opt} 
                                value={opt} 
                                control={<Radio size="small" />} 
                                label={<Typography variant="body2" sx={{ fontFamily: 'var(--font-satoshi)', color: '#FFF' }}>{opt}</Typography>} 
                                sx={{ mb: 0.5 }}
                            />
                        ))}
                    </RadioGroup>
                );
            case 'checkbox':
                return (
                    <FormGroup>
                        {(field.options || []).map((opt: string) => (
                            <FormControlLabel
                                key={opt}
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={(formData[field.id] || []).includes(opt)}
                                        onChange={(e) => handleCheckboxChange(field.id, opt, e.target.checked)}
                                    />
                                }
                                label={<Typography variant="body2" sx={{ fontFamily: 'var(--font-satoshi)', color: '#FFF' }}>{opt}</Typography>}
                                sx={{ mb: 0.5 }}
                            />
                        ))}
                    </FormGroup>
                );
            case 'textarea':
                return (
                    <TextField
                        fullWidth
                        multiline
                        rows={4}
                        variant="filled"
                        required={field.required}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        InputProps={{ 
                            disableUnderline: true, 
                            sx: { 
                                borderRadius: '12px', 
                                bgcolor: '#000000', 
                                border: '1px solid #34322F', 
                                color: 'white',
                                fontFamily: 'var(--font-satoshi)',
                                '&:hover': { borderColor: '#6366F1' } 
                            } 
                        }}
                    />
                );
            case 'file':
                const selectedFile = formData[field.id];
                return (
                    <Box>
                        {selectedFile ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: '12px', bgcolor: '#000000', border: '1px solid #34322F' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SuccessIcon sx={{ color: '#10B981', fontSize: 20 }} />
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 200, fontFamily: 'var(--font-satoshi)', color: '#FFF' }}>
                                        {selectedFile.originalName || 'File uploaded'}
                                    </Typography>
                                </Box>
                                <IconButton size="small" onClick={() => handleFieldChange(field.id, null)} sx={{ color: '#FF453A' }}>
                                    <XIcon size={16} />
                                </IconButton>
                            </Box>
                        ) : (
                            <Button
                                component="label"
                                variant="outlined"
                                startIcon={submitting ? <CircularProgress size={16} /> : <UploadIcon size={18} />}
                                fullWidth
                                disabled={submitting}
                                sx={{
                                    py: 1.5,
                                    borderRadius: '12px',
                                    borderColor: '#34322F',
                                    color: '#9B9691',
                                    textTransform: 'none',
                                    bgcolor: '#1C1A18',
                                    fontFamily: 'var(--font-satoshi)',
                                    fontWeight: 800,
                                    '&:hover': { bgcolor: '#34322F', borderColor: '#6366F1', color: 'white' }
                                }}
                            >
                                {submitting ? 'Uploading...' : 'Choose File (Max 5MB)'}
                                <input
                                    type="file"
                                    hidden
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
                            </Button>
                        )}
                    </Box>
                );
            default:
                return (
                    <TextField
                        fullWidth
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
                        variant="filled"
                        required={field.required}
                        value={formData[field.id] || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        InputProps={{ 
                            disableUnderline: true, 
                            sx: { 
                                borderRadius: '12px', 
                                bgcolor: '#000000', 
                                border: '1px solid #34322F', 
                                color: 'white',
                                fontFamily: 'var(--font-satoshi)',
                                '&:hover': { borderColor: '#6366F1' } 
                            } 
                        }}
                    />
                );
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#000000', backgroundImage: 'none' }}>
            <Container maxWidth="sm" sx={{ py: { xs: 6, md: 12 } }}>
                <Fade in={true} timeout={800}>
                    <Box>
                        <Box sx={{ mb: 8, textAlign: 'center' }}>
                            <Typography variant="h2" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.05em', fontFamily: 'var(--font-clash)', color: '#FFF' }}>
                                {form?.title}
                            </Typography>
                            {form?.description && (
                                <Typography variant="body1" sx={{ color: '#9B9691', maxWidth: 450, mx: 'auto', fontWeight: 500, lineHeight: 1.6, fontFamily: 'var(--font-satoshi)' }}>
                                    {form.description}
                                </Typography>
                            )}

                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                                <Box 
                                    sx={{ 
                                        px: 2, 
                                        py: 0.5, 
                                        borderRadius: '20px', 
                                        bgcolor: '#1C1A18', 
                                        border: '1px solid #34322F',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1
                                    }}
                                >
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: currentUser ? '#10B981' : '#9B9691' }} />
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: currentUser ? '#FFF' : '#9B9691', letterSpacing: '0.02em', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
                                        {currentUser ? `Filling as ${currentUser.name || currentUser.email}` : 'Filling anonymously'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        {submitted ? (
                            <Paper sx={{ p: 8, textAlign: 'center', borderRadius: '28px', bgcolor: '#161412', border: '1px solid #34322F', backgroundImage: 'none', boxShadow: 'none' }}>
                                <SuccessIcon sx={{ fontSize: 80, color: '#6366F1', mb: 4 }} />
                                <Typography variant="h4" sx={{ mb: 2, fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#FFF' }}>Transmission Complete</Typography>
                                <Typography variant="body1" sx={{ color: '#9B9691', mb: 5, fontWeight: 500, fontFamily: 'var(--font-satoshi)' }}>
                                    Your data has been securely injected into the Kylrix Flow nexus.
                                </Typography>
                                <Button 
                                    variant="outlined" 
                                    onClick={() => window.location.reload()}
                                    sx={{ borderRadius: '12px', px: 4, fontWeight: 800, borderColor: '#34322F', color: '#FFF', bgcolor: '#161412', fontFamily: 'var(--font-satoshi)', '&:hover': { bgcolor: '#1C1A18', borderColor: '#6366F1' } }}
                                >
                                    Submit New Entry
                                </Button>
                            </Paper>
                        ) : (
                            <Paper 
                                component="form" 
                                onSubmit={handleSubmit}
                                sx={{ 
                                    p: { xs: 4, md: 6 }, 
                                    borderRadius: '28px', 
                                    bgcolor: '#161412', 
                                    border: '1px solid #34322F',
                                    backgroundImage: 'none',
                                    boxShadow: 'none',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 5
                                }}
                            >
                                {schema.map((field) => (
                                    <Box key={field.id}>
                                        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 800, color: '#FFF', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'var(--font-satoshi)' }}>
                                            {field.label} {field.required && <Box component="span" sx={{ color: '#ff4d4d', fontSize: '1.2rem' }}>*</Box>}
                                        </Typography>
                                        {renderField(field)}
                                    </Box>
                                ))}

                                {error && <Alert severity="error" sx={{ borderRadius: '12px', bgcolor: 'rgba(211, 47, 47, 0.05)', color: '#ff1744', border: '1px solid rgba(211, 47, 47, 0.2)' }}>{error}</Alert>}

                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={submitting}
                                    startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                    sx={{ 
                                        mt: 2,
                                        py: 2,
                                        borderRadius: '12px',
                                        fontWeight: 900,
                                        bgcolor: '#6366F1',
                                        color: 'black',
                                        fontFamily: 'var(--font-satoshi)',
                                        fontSize: '1.1rem',
                                        boxShadow: 'none',
                                        '&:hover': { bgcolor: '#575CF0' },
                                        '&.Mui-disabled': { bgcolor: '#1C1A18', color: '#34322F' }
                                    }}
                                >
                                    {submitting ? 'Transmitting...' : 'Commit Response'}
                                </Button>
                            </Paper>
                        )}

                        <Box sx={{ mt: 8, textAlign: 'center', opacity: 0.2 }}>
                            <Typography variant="caption" sx={{ letterSpacing: '0.3em', fontWeight: 900, fontSize: '0.65rem', color: '#9B9691', fontFamily: 'var(--font-mono)' }}>
                                SECURED BY KYLRIX NEURAL FLOW
                            </Typography>
                        </Box>
                    </Box>
                </Fade>
            </Container>
        </Box>
    );
}
