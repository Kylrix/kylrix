import React from 'react';
import { Link, Typography, Box, alpha } from '@mui/material';
import { ExternalLink, Zap, Lock, MessageSquare, FileText } from 'lucide-react';

interface FormattedTextProps {
    text: string;
    variant?: any;
    sx?: any;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ text, variant = 'body1', sx = {} }) => {
    if (!text) return null;

    // Regex to match URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Split text by URLs
    const parts = text.split(urlRegex);
    
    const getEcosystemType = (url: string) => {
        if (url.includes('connect.kylrix')) return { label: 'CONNECT', color: '#F59E0B', icon: <MessageSquare size={12} /> };
        if (url.includes('flow.kylrix')) return { label: 'FLOW', color: '#A855F7', icon: <Zap size={12} /> };
        if (url.includes('vault.kylrix')) return { label: 'VAULT', color: '#10B981', icon: <Lock size={12} /> };
        if (url.includes('note.kylrix')) return { label: 'NOTE', color: '#EC4899', icon: <FileText size={12} /> };
        return null;
    };

    return (
        <Typography variant={variant} component="div" sx={{ ...sx, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>
            {parts.map((part, i) => {
                if (part.match(urlRegex)) {
                    const eco = getEcosystemType(part);
                    
                    if (eco) {
                        return (
                            <Box
                                key={i}
                                component="a"
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    bgcolor: alpha(eco.color, 0.1),
                                    color: eco.color,
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    border: `1px solid ${alpha(eco.color, 0.2)}`,
                                    my: 0.5,
                                    mr: 0.5,
                                    verticalAlign: 'middle',
                                    transition: 'all 0.2s ease',
                                    fontFamily: 'var(--font-satoshi)',
                                    '&:hover': {
                                        bgcolor: alpha(eco.color, 0.2),
                                        transform: 'translateY(-1px)',
                                        boxShadow: `0 4px 12px ${alpha(eco.color, 0.2)}`
                                    }
                                }}
                            >
                                {eco.icon}
                                <span>{eco.label}</span>
                                <ExternalLink size={12} style={{ opacity: 0.5 }} />
                            </Box>
                        );
                    }

                    return (
                        <Link 
                            key={i} 
                            href={part} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ 
                                color: '#6366F1', 
                                textDecoration: 'none',
                                fontWeight: 700,
                                position: 'relative',
                                '&:hover': { 
                                    textDecoration: 'none',
                                    '&::after': { width: '100%' }
                                },
                                '&::after': {
                                    content: '""',
                                    position: 'absolute',
                                    bottom: -2,
                                    left: 0,
                                    width: '0%',
                                    height: '2px',
                                    bgcolor: '#6366F1',
                                    transition: 'width 0.2s ease',
                                    borderRadius: '2px'
                                }
                            }}
                        >
                            {part}
                        </Link>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </Typography>
    );
};
