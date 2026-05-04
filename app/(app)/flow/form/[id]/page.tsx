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
    FormControl
} from '@mui/material';
import { Send as SendIcon, CheckCircleOutline as SuccessIcon } from '@mui/icons-material';
import { FormsService } from '@/lib/services/forms';
import { Forms } from '@/generated/appwrite/types';
import { useDataNexus } from '@/context/DataNexusContext';

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

                if (!isOwner && data.status !== 'published') {
                    setError('This form is not currently accepting submissions.');
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
                            sx={{ borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' }}
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
                                label={<Typography variant="body2">{opt}</Typography>} 
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
                                label={<Typography variant="body2">{opt}</Typography>}
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
                        InputProps={{ disableUnderline: true, sx: { borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' } }}
                    />
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
                        InputProps={{ disableUnderline: true, sx: { borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' } }}
                    />
                );
        }
    };

    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#050505', backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)' }}>
            <Container maxWidth="sm" sx={{ py: { xs: 6, md: 12 } }}>
                <Fade in={true} timeout={800}>
                    <Box>
                        <Box sx={{ mb: 8, textAlign: 'center' }}>
                            <Typography variant="h2" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.05em', fontFamily: 'var(--font-clash)' }}>
                                {form?.title}
                            </Typography>
                            {form?.description && (
                                <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 450, mx: 'auto', fontWeight: 500, lineHeight: 1.6 }}>
                                    {form.description}
                                </Typography>
                            )}

                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                                <Box 
                                    sx={{ 
                                        px: 2, 
                                        py: 0.5, 
                                        borderRadius: '20px', 
                                        bgcolor: 'rgba(255, 255, 255, 0.03)', 
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1
                                    }}
                                >
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: currentUser ? '#10B981' : 'rgba(255,255,255,0.2)' }} />
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: currentUser ? 'text.primary' : 'text.secondary', letterSpacing: '0.02em', fontSize: '0.7rem' }}>
                                        {currentUser ? `Filling as ${currentUser.name || currentUser.email}` : 'Filling anonymously'}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        {submitted ? (
                            <Paper sx={{ p: 8, textAlign: 'center', borderRadius: '32px', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(20px)' }}>
                                <SuccessIcon sx={{ fontSize: 80, color: '#6366F1', mb: 4, filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.3))' }} />
                                <Typography variant="h4" sx={{ mb: 2, fontWeight: 900 }}>Transmission Complete</Typography>
                                <Typography variant="body1" sx={{ color: 'text.secondary', mb: 5, fontWeight: 500 }}>
                                    Your data has been securely injected into the Kylrix Flow nexus.
                                </Typography>
                                <Button 
                                    variant="outlined" 
                                    onClick={() => window.location.reload()}
                                    sx={{ borderRadius: '14px', px: 4, fontWeight: 800, borderColor: 'rgba(255,255,255,0.1)' }}
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
                                    borderRadius: '32px', 
                                    bgcolor: 'rgba(255, 255, 255, 0.02)', 
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    backdropFilter: 'blur(20px)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 5
                                }}
                            >
                                {schema.map((field) => (
                                    <Box key={field.id}>
                                        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 800, opacity: 0.9, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {field.label} {field.required && <Box component="span" sx={{ color: '#ff4d4d', fontSize: '1.2rem' }}>*</Box>}
                                        </Typography>
                                        {renderField(field)}
                                    </Box>
                                ))}

                                {error && <Alert severity="error" sx={{ borderRadius: '14px' }}>{error}</Alert>}

                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={submitting}
                                    startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                    sx={{ 
                                        mt: 2,
                                        py: 2,
                                        borderRadius: '16px',
                                        fontWeight: 900,
                                        bgcolor: '#6366F1',
                                        color: 'white',
                                        boxShadow: '0 12px 40px rgba(99, 102, 241, 0.25)',
                                        fontSize: '1.1rem',
                                        '&:hover': { bgcolor: '#5254e0' }
                                    }}
                                >
                                    {submitting ? 'Transmitting...' : 'Commit Response'}
                                </Button>
                            </Paper>
                        )}

                        <Box sx={{ mt: 8, textAlign: 'center', opacity: 0.2 }}>
                            <Typography variant="caption" sx={{ letterSpacing: '0.3em', fontWeight: 900, fontSize: '0.65rem' }}>
                                SECURED BY KYLRIX NEURAL FLOW
                            </Typography>
                        </Box>
                    </Box>
                </Fade>
            </Container>
        </Box>
    );
}
