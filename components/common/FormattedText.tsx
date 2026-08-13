import React from 'react';
import { Link, Typography, Box, alpha } from '@/lib/openbricks/primitives';
import { ExternalLink, Zap, Lock, MessageSquare, FileText } from 'lucide-react';

interface FormattedTextProps {
    text: string;
    variant?: any;
    sx?: any;
    linkPreviewsEnabled?: boolean;
}

export const FormattedText: React.FC<FormattedTextProps> = ({
    text,
    variant = 'body1',
    sx = {},
    linkPreviewsEnabled = true,
}) => {
    if (!text) return null;

    // Regex to match URLs (with or without http:// or https://)
    const urlRegex = /((?:https?:\/\/|www\.)[^\s]+|(?:[a-zA-Z0-9-]+\.)+kylrix\.space[^\s]*)/gi;
    
    // Split text by URLs
    const parts = text.split(urlRegex);
    
    const getEcosystemType = (rawUrl: string) => {
        let fullUrl = rawUrl;
        if (!/^https?:\/\//i.test(fullUrl)) {
            fullUrl = `https://${fullUrl}`;
        }

        let hostname = '';
        let pathname = '';
        try {
            const parsed = new URL(fullUrl);
            hostname = parsed.hostname.toLowerCase();
            pathname = parsed.pathname.toLowerCase();
        } catch {
            /* ignore invalid URL */
        }

        const isCurrentHost = typeof window !== 'undefined' && window.location.hostname.toLowerCase() === hostname;
        const isKylrixDomain = hostname.endsWith('kylrix.space') || hostname.endsWith('kylrix.com') || hostname === 'kylrix.app' || isCurrentHost;

        if (!isKylrixDomain) return null;

        if (pathname.startsWith('/u/') || pathname.startsWith('/user/') || pathname.startsWith('/profile/')) {
            const handle = pathname.split('/')[2] || '';
            return {
                label: handle ? `@${handle.toUpperCase()}` : 'PROFILE',
                color: '#3B82F6',
                icon: <MessageSquare size={12} />,
                href: fullUrl,
            };
        }
        if (hostname.startsWith('connect.') || pathname.startsWith('/connect') || pathname.startsWith('/chats') || pathname.startsWith('/hangouts')) {
            return { label: 'CONNECT', color: '#F59E0B', icon: <MessageSquare size={12} />, href: fullUrl };
        }
        if (hostname.startsWith('flow.') || pathname.startsWith('/flow') || pathname.startsWith('/workflows')) {
            return { label: 'FLOW', color: '#A855F7', icon: <Zap size={12} />, href: fullUrl };
        }
        if (hostname.startsWith('vault.') || pathname.startsWith('/vault')) {
            return { label: 'VAULT', color: '#10B981', icon: <Lock size={12} />, href: fullUrl };
        }
        if (hostname.startsWith('note.') || pathname.startsWith('/note') || pathname.startsWith('/notes') || pathname.startsWith('/app')) {
            return { label: 'KYLRIX NOTE', color: '#EC4899', icon: <FileText size={12} />, href: fullUrl };
        }

        return { label: 'KYLRIX', color: '#6366F1', icon: <FileText size={12} />, href: fullUrl };
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
                                href={eco.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    bgcolor: alpha(eco.color, 0.12),
                                    color: eco.color,
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: '8px',
                                    textDecoration: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.85rem',
                                    border: `1px solid ${alpha(eco.color, 0.25)}`,
                                    my: 0.5,
                                    mr: 0.5,
                                    verticalAlign: 'middle',
                                    transition: 'all 0.2s ease',
                                    fontFamily: 'var(--font-satoshi)',
                                    '&:hover': {
                                        bgcolor: alpha(eco.color, 0.22),
                                        transform: 'translateY(-1px)',
                                        boxShadow: `0 4px 12px ${alpha(eco.color, 0.25)}`
                                    }
                                }}
                            >
                                {eco.icon}
                                <span>{eco.label}</span>
                                <ExternalLink size={12} style={{ opacity: 0.6 }} />
                            </Box>
                        );
                    }

                    const hrefUrl = /^https?:\/\//i.test(part) ? part : `https://${part}`;

                    if (!linkPreviewsEnabled) {
                        return (
                            <span key={i} style={{ color: '#818CF8', wordBreak: 'break-all' }}>
                                {part}
                            </span>
                        );
                    }

                    return (
                        <Link 
                            key={i} 
                            href={hrefUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
