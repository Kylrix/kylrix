'use client';

import React, { useEffect, useState } from 'react';
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
    Stack,
    FormControlLabel,
    Checkbox,
    FormGroup,
    Select,
    MenuItem,
    FormControl,
    IconButton,
    Drawer,
    alpha
} from '@mui/material';
import { 
    Send as SendIcon, 
    CheckCircleOutline as SuccessIcon,
    Close as CloseIcon,
    Upload as UploadIcon,
    X as XIcon
} from '@mui/icons-material';
import { FormsService } from '@/lib/services/forms';
import { Forms } from '@/generated/appwrite/types';
import { useDataNexus } from '@/context/DataNexusContext';
import { secureUploadFile } from '@/lib/actions/client-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useAuth } from '@/context/auth/AuthContext';

interface UnifiedFormDrawerProps {
    open: boolean;
    onClose: () => void;
    formId: string;
}

export function UnifiedFormDrawer({ open, onClose, formId }: UnifiedFormDrawerProps) {
    const { fetchOptimized } = useDataNexus();
    const { user } = useAuth();
    const [form, setForm] = useState<Forms | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<Record<string, any>>({});

    useEffect(() => {
        if (!open || !formId) return;

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
    }, [formId, open, fetchOptimized]);

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
            case 'file':
                const selectedFile = formData[field.id];
                return (
                    <Box>
                        {selectedFile ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SuccessIcon sx={{ color: '#10B981', fontSize: 20 }} />
                                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                        {selectedFile.originalName || 'File uploaded'}
                                    </Typography>
                                </Box>
                                <IconButton size="small" onClick={() => handleFieldChange(field.id, null)} sx={{ color: '#FF453A' }}>
                                    <XIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Box>
                        ) : (
                            <Button
                                component="label"
                                variant="outlined"
                                startIcon={submitting ? <CircularProgress size={16} /> : <UploadIcon sx={{ fontSize: 18 }} />}
                                fullWidth
                                disabled={submitting}
                                sx={{
                                    py: 1.5,
                                    borderRadius: '12px',
                                    borderColor: 'rgba(255,255,255,0.1)',
                                    color: 'text.secondary',
                                    textTransform: 'none',
                                    bgcolor: 'rgba(255,255,255,0.02)',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)' }
                                }}
                            >
                                {submitting ? 'Uploading...' : 'Choose File (Max 5MB)'}
                                <input
                                    type="file"
                                    hidden
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
                        InputProps={{ disableUnderline: true, sx: { borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.03)' } }}
                    />
                );
        }
    };

    let schema: any[] = [];
    try { schema = JSON.parse(form?.schema || '[]'); } catch (_e) {}

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    maxHeight: '60vh',
                    borderTopLeftRadius: '32px',
                    borderTopRightRadius: '32px',
                    bgcolor: '#050505',
                    backgroundImage: 'radial-gradient(circle at 50% -20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)',
                    color: 'white',
                    p: 0,
                    overflow: 'hidden'
                }
            }}
        >
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
                    {form?.title || 'Intelligence Portal'}
                </Typography>
                <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.3)' }}>
                    <XIcon />
                </IconButton>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : submitted ? (
                    <Fade in={true}>
                        <Box sx={{ textAlign: 'center', py: 4 }}>
                            <SuccessIcon sx={{ fontSize: 64, color: '#6366F1', mb: 2 }} />
                            <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>Transmission Complete</Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
                                Your request has been securely injected into the Kylrix nexus.
                            </Typography>
                            <Button variant="outlined" onClick={onClose} sx={{ borderRadius: '12px', px: 4 }}>Done</Button>
                        </Box>
                    </Fade>
                ) : error ? (
                    <Alert severity="error" sx={{ borderRadius: '16px' }}>{error}</Alert>
                ) : (
                    <Box component="form" onSubmit={handleSubmit}>
                        {form?.description && (
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.6 }}>
                                {form.description}
                            </Typography>
                        )}

                        <Stack spacing={4}>
                            {schema.map((field) => (
                                <Box key={field.id}>
                                    <Typography variant="caption" sx={{ display: 'block', fontWeight: 900, color: 'text.secondary', mb: 1.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                        {field.label} {field.required && <Box component="span" sx={{ color: '#ef4444' }}>*</Box>}
                                    </Typography>
                                    {renderField(field)}
                                </Box>
                            ))}
                        </Stack>

                        <Box sx={{ mt: 6, pb: 4 }}>
                            <Button
                                type="submit"
                                variant="contained"
                                fullWidth
                                disabled={submitting}
                                startIcon={submitting ? <CircularProgress size={20} /> : <SendIcon />}
                                sx={{
                                    py: 2,
                                    borderRadius: '16px',
                                    fontWeight: 900,
                                    bgcolor: '#6366F1',
                                    color: 'black',
                                    boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
                                    '&:hover': { bgcolor: alpha('#6366F1', 0.9) }
                                }}
                            >
                                {submitting ? 'Transmitting...' : 'Submit Request'}
                            </Button>
                        </Box>
                    </Box>
                )}
            </Box>
        </Drawer>
    );
}
