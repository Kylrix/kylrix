'use client';

import React from 'react';
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
import { ArrowLeft, Shield, Eye, UserCheck, Server, Activity, Database, Trash2, Globe, Lock, Mail, AlertTriangle } from 'lucide-react';

const cardSx = {
  p: 4,
  borderRadius: '24px',
  bgcolor: '#141312',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  position: 'relative' as const,
  overflow: 'hidden',
};

function LegalCard({
  accent,
  icon,
  title,
  children,
}: {
  accent: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Paper elevation={0} sx={cardSx}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: accent }} />
      <Stack direction="row" spacing={2.5} alignItems="flex-start">
        <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: alpha('#fff', 0.04), color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', fontSize: '1.25rem', letterSpacing: '-0.02em' }}>
            {title}
          </Typography>
          <Box sx={{ mt: 1, color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', lineHeight: 1.65, '& strong': { color: 'rgba(255,255,255,0.75)' }, '& ul': { pl: 2.5, my: 1.5 }, '& li': { mb: 1 } }}>
            {children}
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#fff', py: 4 }}>
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
        <Box sx={{ mb: 6 }}>
          <Typography variant="h1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: { xs: '2.5rem', md: '3.5rem' }, lineHeight: 1.1, letterSpacing: '-0.03em', mb: 2 }}>
            Privacy Policy
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', fontWeight: 500, maxWidth: 680 }}>
            How we handle data on our cloud service — and what changes when you self-host.
          </Typography>
        </Box>

        <Stack spacing={4}>
          <LegalCard accent="linear-gradient(90deg, #6366F1 0%, #818CF8 100%)" icon={<Globe size={22} />} title="Scope: Cloud vs Self-Hosted">
            <Typography component="div">
              This Privacy Policy describes practices for the <strong>Kylrix hosted cloud service</strong> we operate.
              <br /><br />
              If you <strong>self-host</strong> Kylrix, you (or your organization) are the data controller for that instance. We do not receive, access, or process your self-hosted data unless you choose to connect to our cloud or send us support information. Self-hosted privacy practices are your responsibility; the software is provided as is with no warranty about privacy outcomes on your deployment.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #EC4899 0%, #F59E0B 100%)" icon={<UserCheck size={22} />} title="What We Collect (Hosted Cloud)">
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

          <LegalCard accent="linear-gradient(90deg, #10B981 0%, #3B82F6 100%)" icon={<Database size={22} />} title="How We Use Data">
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

          <LegalCard accent="linear-gradient(90deg, #6366F1 0%, #A855F7 100%)" icon={<Activity size={22} />} title="Diagnostics & Stability Metrics">
            <Typography component="div">
              Our hosted cloud requires basic anonymized stability and diagnostic signals so we can fix crashes and keep the service reliable. These signals are functional — not for ad targeting.
              <br /><br />
              <strong>Context recording:</strong> You can toggle workspace context recording in Settings. Turning it off limits Smart Action Workflow recording and playback.
              <br /><br />
              <strong>Core analytics on hosted:</strong> Crash and stability signals cannot be fully disabled on our cloud. For zero external telemetry, self-host an isolated copy and configure it to your requirements.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)" icon={<Lock size={22} />} title="Security & Encryption">
            <Typography component="div">
              We apply industry-standard measures to protect data in transit and at rest, including encryption for sensitive vault material where the product design provides it. No system is perfectly secure.
              <br /><br />
              <strong>You are responsible</strong> for your master password, passkeys, recovery codes, and device security. If you lose unlock credentials, we may be unable to recover encrypted data. Security features are provided as is without guarantee of absolute protection.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #818CF8 0%, #6366F1 100%)" icon={<Server size={22} />} title="Third-Party Services & Infrastructure">
            <Typography component="div">
              The hosted service relies on infrastructure and service providers (for example: hosting, database, authentication, email delivery, payment processing, and push notification bridges). Those providers process data only as needed to operate the service, under their own terms and security practices.
              <br /><br />
              Self-hosted operators choose their own providers and are responsible for reviewing those vendors.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #3B82F6 0%, #10B981 100%)" icon={<Trash2 size={22} />} title="Retention, Export & Deletion">
            <Typography component="div">
              We retain account and content data while your hosted account is active and as needed for legal, security, or backup purposes. You may export workspace data through built-in export tools where available.
              <br /><br />
              You may request account deletion on our hosted service. Deletion is irreversible for encrypted content if keys are lost. Some logs or billing records may be retained where required by law.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #EC4899 0%, #6366F1 100%)" icon={<Eye size={22} />} title="Your Choices & Rights">
            <Typography component="div">
              Depending on your location, you may have rights to access, correct, delete, or restrict processing of personal data. Contact us to submit a request. We may need to verify your identity before acting.
              <br /><br />
              Self-hosted users should exercise rights directly through their instance administrator (often yourself).
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #EF4444 0%, #F59E0B 100%)" icon={<AlertTriangle size={22} />} title="No Warranty; Limitation of Liability">
            <Typography component="div">
              Privacy and security practices on both our <strong>hosted cloud</strong> and <strong>self-hosted software</strong> are provided <strong>as is</strong> and <strong>as available</strong>, without warranties of any kind. We do not guarantee that data will never be lost, accessed improperly, or exposed due to bugs, misconfiguration, user error, or third-party failure.
              <br /><br />
              To the fullest extent permitted by law, we are not liable for privacy or security incidents arising from your use of Kylrix, including self-hosted deployments you operate. See our Terms of Service for full liability limits.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #10B981 0%, #6366F1 100%)" icon={<Mail size={22} />} title="Children & Policy Updates">
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

        <Divider sx={{ my: 6, borderColor: 'rgba(255,255,255,0.06)' }} />

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', fontWeight: 500 }}>
          Last modified: June 2026. Applies to the Kylrix hosted cloud service; self-hosted deployments are operated by you.
        </Typography>
      </Container>
    </Box>
  );
}
