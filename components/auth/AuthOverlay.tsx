'use client';

import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';
import { getEcosystemUrl } from '@/lib/constants';

export const AuthOverlay = () => {
    const { user, isLoading } = useAuth();
    const pathname = usePathname();

    if (isLoading) return null;

    // Allow public profiles, posts and home feed to be viewed by guests
    const isPublicRoute = pathname === '/' || pathname?.startsWith('/u/') || pathname?.startsWith('/post/');
    
    if (!user && !isPublicRoute) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 9999
            }}>
                <div className="glass-panel" style={{
                    backgroundColor: 'var(--color-surface)',
                    padding: '48px',
                    borderRadius: 'var(--radius-macro)',
                    textAlign: 'center',
                    maxWidth: '440px',
                    width: '90%',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
                }}>
                    <h2 style={{
                        marginBottom: '16px',
                        color: 'var(--color-titanium)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '2rem',
                        fontWeight: '900',
                        letterSpacing: '-0.03em'
                    }}>
                        Kylrix Connect
                    </h2>
                    <p style={{
                        marginBottom: '32px',
                        color: 'var(--color-gunmetal)',
                        fontSize: '1rem',
                        lineHeight: '1.5'
                    }}>
                        Access the bridge to your private network. Sign in with your Kylrix ID to continue.
                    </p>
                    <button
                        onClick={() => {
                            const loginUrl = `${getEcosystemUrl('accounts')}/login?source=${encodeURIComponent(window.location.href)}`;
                            window.location.href = loginUrl;
                        }}
                        style={{
                            backgroundColor: 'var(--color-electric)',
                            color: 'var(--color-void)',
                            border: 'none',
                            padding: '16px 32px',
                            borderRadius: 'var(--radius-micro)',
                            fontSize: '1rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            width: '100%',
                            boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 240, 255, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 240, 255, 0.3)';
                        }}
                    >
                        Authenticate ID
                    </button>
                </div>
            </div>
        );

    }

    return null;
};
