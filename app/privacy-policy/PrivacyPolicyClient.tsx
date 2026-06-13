'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Stack,
  IconButton,
  Paper,
  alpha,
  Divider,
} from '@/lib/mui-tailwind/material';
import { 
  ArrowLeft, 
  Shield, 
  Eye, 
  UserCheck, 
  Server, 
  Activity, 
  Database, 
  Trash2, 
  Globe, 
  Lock, 
  Mail, 
  AlertTriangle,
  Link as LinkIcon,
  Copy,
  Share2
} from 'lucide-react';
import toast from 'react-hot-toast';

const cardSx = {
  p: 4,
  borderRadius: '24px',
  bgcolor: '#141312',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  position: 'relative' as const,
  overflow: 'hidden',
  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
};

interface LegalCardProps {
  id: string;
  accent: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  activeHash: string;
  onContextMenu: (e: React.MouseEvent | React.TouchEvent, id: string, title: string) => void;
}

function LegalCard({
  id,
  accent,
  icon,
  title,
  children,
  activeHash,
  onContextMenu
}: LegalCardProps) {
  const isActive = activeHash === `#${id}`;
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${window.location.origin}${window.location.pathname}?section=${id}#${id}`;
    navigator.clipboard.writeText(link);
    toast.success(`Copied section link: ${title}`);
  };

  return (
    <div
      id={id}
      ref={cardRef}
      onContextMenu={(e) => onContextMenu(e, id, title)}
      onTouchStart={(e) => {
        const timer = setTimeout(() => {
          onContextMenu(e, id, title);
        }, 600);
        cardRef.current?.addEventListener('touchend', () => clearTimeout(timer), { once: true });
        cardRef.current?.addEventListener('touchmove', () => clearTimeout(timer), { once: true });
      }}
      className={`relative rounded-[24px] border transition-all duration-500 ${
        isActive 
          ? 'border-[#6366F1] bg-[#1a1829] shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-[1.01]' 
          : 'border-white/6 bg-[#141312] hover:border-white/12'
      }`}
    >
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: accent }} />
      
      {/* Anchor Hover Button */}
      <div className="absolute top-4 right-4 opacity-40 hover:opacity-100 transition-opacity flex gap-2 z-10">
        <IconButton
          onClick={handleShareClick}
          size="small"
          sx={{
            color: '#fff',
            bgcolor: 'rgba(255,255,255,0.03)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
          }}
          title="Copy Section Link"
        >
          <LinkIcon size={14} />
        </IconButton>
      </div>

      <Box sx={{ p: 4 }}>
        <Stack direction="row" spacing={2.5} alignItems="flex-start">
          <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha('#fff', 0.04), color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            {icon}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.25rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 1 }}>
              {title}
            </Typography>
            <Box sx={{ mt: 2, color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.65, '& strong': { color: 'rgba(255,255,255,0.75)' }, '& ul': { pl: 2.5, my: 1.5 }, '& li': { mb: 1 } }}>
              {children}
            </Box>
          </Box>
        </Stack>
      </Box>
    </div>
  );
}

export default function PrivacyPolicyClient() {
  const router = useRouter();
  const [activeHash, setActiveHash] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sectionId: string;
    sectionTitle: string;
  } | null>(null);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      setActiveHash(hash);
      if (hash) {
        const el = document.querySelector(hash);
        if (el) {
          setTimeout(() => {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleContextMenuOpen = (e: React.MouseEvent | React.TouchEvent, id: string, title: string) => {
    e.preventDefault();
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    setContextMenu({
      x: clientX,
      y: clientY,
      sectionId: id,
      sectionTitle: title
    });
  };

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const copySectionLink = () => {
    if (!contextMenu) return;
    const link = `${window.location.origin}${window.location.pathname}?section=${contextMenu.sectionId}#${contextMenu.sectionId}`;
    navigator.clipboard.writeText(link);
    toast.success(`Copied link for: ${contextMenu.sectionTitle}`);
  };

  const shareSection = () => {
    if (!contextMenu) return;
    const link = `${window.location.origin}${window.location.pathname}?section=${contextMenu.sectionId}#${contextMenu.sectionId}`;
    if (navigator.share) {
      navigator.share({
        title: `Kylrix Privacy: ${contextMenu.sectionTitle}`,
        text: `Read the "${contextMenu.sectionTitle}" clause of Kylrix Privacy Policy.`,
        url: link
      }).catch(() => null);
    } else {
      copySectionLink();
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', py: 4, position: 'relative' }}>
      
      {/* Context Menu Popup */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#161412] border border-white/10 rounded-[12px] p-1.5 shadow-2xl flex flex-col min-w-[180px] gap-0.5"
          style={{ top: contextMenu.y, left: Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : contextMenu.x) }}
        >
          <div className="px-3 py-1.5 text-[10px] text-white/45 font-mono uppercase tracking-wider">
            Section options
          </div>
          <button
            onClick={copySectionLink}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-left rounded-[8px] text-white/80 hover:bg-white/5 hover:text-white"
          >
            <Copy size={13} />
            <span>Copy Direct Link</span>
          </button>
          <button
            onClick={shareSection}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-left rounded-[8px] text-white/80 hover:bg-white/5 hover:text-white"
          >
            <Share2 size={13} />
            <span>Share Clause</span>
          </button>
        </div>
      )}

      <Container maxWidth="md">
        {/* Navigation */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 4 }}>
          <IconButton
            onClick={() => router.push('/')}
            sx={{
              bgcolor: '#161412',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.06)',
              '&:hover': { bgcolor: '#1C1A18' },
            }}
          >
            <ArrowLeft size={18} />
          </IconButton>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            System Integrity & Legal
          </Typography>
        </Stack>

        {/* Title */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1.1, letterSpacing: '-0.03em', mb: 2 }}>
            Privacy Policy
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', fontWeight: 500, maxWidth: 680 }}>
            How we handle data on our cloud service — and what changes when you self-host.
          </Typography>
        </Box>

        {/* Universal Top Notice */}
        <div className="p-4 mb-8 rounded-[16px] bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#818CF8] text-xs md:text-sm font-bold text-center leading-relaxed">
          IMPORTANT NOTICE: By using Kylrix Cloud or any self-hosted instance of the software, whether directly or indirectly or by whatever means, you agree to these Terms of Service and Privacy Policy.
        </div>

        <Stack spacing={4}>
          <LegalCard 
            id="scope"
            accent="linear-gradient(90deg, #6366F1 0%, #818CF8 100%)" 
            icon={<Globe size={22} />} 
            title="1. Scope: Cloud vs Self-Hosted"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              This Privacy Policy describes practices for the <strong>Kylrix hosted cloud service</strong> we operate.
              <br /><br />
              If you <strong>self-host</strong> Kylrix, you (or your organization) are the data controller for that instance. We do not receive, access, or process your self-hosted data unless you choose to connect to our cloud or send us support information. Self-hosted privacy practices are your responsibility; the software is provided as is with no warranty about privacy outcomes on your deployment.
            </Typography>
          </LegalCard>

          <LegalCard 
            id="collection"
            accent="linear-gradient(90deg, #EC4899 0%, #F59E0B 100%)" 
            icon={<UserCheck size={22} />} 
            title="2. What We Collect (Hosted Cloud)"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              Depending on how you use the hosted service, we may process:
              <ul>
                <li><strong>Account data:</strong> username, authentication identifiers, session tokens, and optional email if you provide it for login or notifications</li>
                <li><strong>Content you store:</strong> notes, vault entries, messages, files, tasks, and other workspace data you create — stored to provide the service</li>
                <li><strong>Usage and stability signals:</strong> anonymized crash reports, performance metrics, and diagnostic events required on our hosted platform</li>
                <li><strong>Billing data:</strong> if you purchase paid features, payment-related records handled through our payment processors (we do not need to store full card numbers)</li>
                <li><strong>Support communications:</strong> information you send when contacting us</li>
              </ul>
              Social sharing in Kylrix is built around usernames — we do not require exposing email or phone numbers to collaborate.
            </Typography>
          </LegalCard>

          <LegalCard 
            id="use"
            accent="linear-gradient(90deg, #10B981 0%, #3B82F6 100%)" 
            icon={<Database size={22} />} 
            title="3. How We Use Data"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              We use collected information to:
              <ul>
                <li>Provide, maintain, and improve the hosted service</li>
                <li>Authenticate you and protect accounts from abuse</li>
                <li>Sync your workspace across devices</li>
                <li>Detect crashes, errors, and stability issues</li>
                <li>Process subscriptions or payments where applicable</li>
                <li>Respond to support requests and legal obligations</li>
              </ul>
              We do not sell your personal data. We do not use your private vault or note content for advertising.
            </Typography>
          </LegalCard>

          <LegalCard 
            id="diagnostics"
            accent="linear-gradient(90deg, #6366F1 0%, #A855F7 100%)" 
            icon={<Activity size={22} />} 
            title="4. Diagnostics & Stability Metrics"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              Our hosted cloud requires basic anonymized stability and diagnostic signals so we can fix crashes and keep the service reliable. These signals are functional — not for ad targeting.
              <br /><br />
              <strong>Context recording:</strong> You can toggle workspace context recording in Settings. Turning it off limits Smart Action Workflow recording and playback.
              <br /><br />
              <strong>Core analytics on hosted:</strong> Crash and stability signals cannot be fully disabled on our cloud. For zero external telemetry, self-host an isolated copy and configure it to your requirements.
            </Typography>
          </LegalCard>

          <LegalCard 
            id="security"
            accent="linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)" 
            icon={<Lock size={22} />} 
            title="5. Security & Encryption"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              We apply industry-standard measures to protect data in transit and at rest, including encryption for sensitive vault material where the product design provides it. No system is perfectly secure.
              <br /><br />
              <strong>You are responsible</strong> for your master password, passkeys, recovery codes, and device security. If you lose unlock credentials, we may be unable to recover encrypted data. Security features are provided as is without guarantee of absolute protection.
            </Typography>
          </LegalCard>

          <LegalCard 
            id="third-party"
            accent="linear-gradient(90deg, #818CF8 0%, #6366F1 100%)" 
            icon={<Server size={22} />} 
            title="6. Third-Party Services & Infrastructure"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              The hosted service relies on infrastructure and service providers (for example: hosting, database, authentication, email delivery, payment processing, and push notification bridges). Those providers process data only as needed to operate the service, under their own terms and security practices.
              <br /><br />
              Self-hosted operators choose their own providers and are responsible for reviewing those vendors.
            </Typography>
          </LegalCard>

          <LegalCard 
            id="retention"
            accent="linear-gradient(90deg, #3B82F6 0%, #10B981 100%)" 
            icon={<Trash2 size={22} />} 
            title="7. Retention, Export & Deletion"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              We retain account and content data while your hosted account is active and as needed for legal, security, or backup purposes. You may export workspace data through built-in export tools where available.
              <br /><br />
              You may request account deletion on our hosted service. Deletion is irreversible for encrypted content if keys are lost. Some logs or billing records may be retained where required by law.
            </Typography>
          </LegalCard>

          <LegalCard 
            id="choices"
            accent="linear-gradient(90deg, #EC4899 0%, #6366F1 100%)" 
            icon={<Eye size={22} />} 
            title="8. Your Choices & Rights"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              Depending on your location, you may have rights to access, correct, delete, or restrict processing of personal data. Contact us to submit a request. We may need to verify your identity before acting.
              <br /><br />
              Self-hosted users should exercise rights directly through their instance administrator (often yourself).
            </Typography>
          </LegalCard>

          <LegalCard 
            id="warranty"
            accent="linear-gradient(90deg, #EF4444 0%, #F59E0B 100%)" 
            icon={<AlertTriangle size={22} />} 
            title="9. No Warranty; Limitation of Liability"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              Privacy and security practices on both our <strong>hosted cloud</strong> and <strong>self-hosted software</strong> are provided <strong>as is</strong> and <strong>as available</strong>, without warranties of any kind. We do not guarantee that data will never be lost, accessed improperly, or exposed due to bugs, misconfiguration, user error, or third-party failure.
              <br /><br />
              To the fullest extent permitted by law, we are not liable for privacy or security incidents arising from your use of Kylrix, including self-hosted deployments you operate. See our Terms of Service for full liability limits.
            </Typography>
          </LegalCard>

          <LegalCard 
            id="updates"
            accent="linear-gradient(90deg, #10B981 0%, #6366F1 100%)" 
            icon={<Mail size={22} />} 
            title="10. Children & Policy Updates"
            activeHash={activeHash}
            onContextMenu={handleContextMenuOpen}
          >
            <Typography component="div">
              Kylrix is not directed at children under 13 (or the minimum age required in your country). We do not knowingly collect data from children.
              <br /><br />
              We may update this policy and will revise the date below. Continued use of the hosted service after updates means you accept the revised policy.
            </Typography>
          </LegalCard>

          {/* Summary/Footer Quote */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: '24px',
              bgcolor: 'rgba(99, 102, 241, 0.02)',
              border: '1px dashed rgba(99, 102, 241, 0.15)',
              textAlign: 'center',
            }}
          >
            <Shield size={28} style={{ color: '#6366F1', marginBottom: 12 }} />
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
              Hosted Environment Mandate
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', maxWidth: 560, mx: 'auto', lineHeight: 1.5 }}>
              On our cloud, anonymized stability signals are required. Self-host for full control. Privacy practices are provided as is — see Terms of Service for liability limits.
            </Typography>
          </Paper>
        </Stack>

        {/* Universal Bottom Notice */}
        <div className="p-4 mt-8 rounded-[16px] bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#818CF8] text-xs md:text-sm font-bold text-center leading-relaxed">
          RE-AFFIRMATION: By continuing to use Kylrix Cloud or self-hosted services, you unconditionally reaffirm your agreement to these Terms of Service and Privacy Policy.
        </div>

        <Divider sx={{ my: 6, borderColor: 'rgba(255,255,255,0.06)' }} />

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', fontWeight: 500 }}>
          Last modified: June 2026. Applies to the Kylrix hosted cloud service; self-hosted deployments are operated by you.
        </Typography>
      </Container>
    </Box>
  );
}
