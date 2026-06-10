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
import { ArrowLeft, Scale, Terminal, GitFork, AlertTriangle, FileText, CheckCircle, Ban, ShieldOff, Gavel, RefreshCw } from 'lucide-react';

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

export default function TermsOfServicePage() {
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
            Terms of Service
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '1.1rem', fontWeight: 500, maxWidth: 680 }}>
            These terms apply to our cloud service, the open-source software, and any self-hosted copy you run yourself.
          </Typography>
        </Box>

        <Stack spacing={4}>
          <LegalCard accent="linear-gradient(90deg, #6366F1 0%, #818CF8 100%)" icon={<FileText size={22} />} title="Acceptance of Terms">
            <Typography component="div">
              By creating an account, signing in, downloading, forking, self-hosting, or otherwise using Kylrix software or services, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the software or services.
              <br /><br />
              If you use Kylrix on behalf of an organization, you confirm that you have authority to bind that organization to these terms.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #EF4444 0%, #F59E0B 100%)" icon={<AlertTriangle size={22} />} title="Provided &quot;As Is&quot; — Cloud and Self-Hosted">
            <Typography component="div">
              <strong>Kylrix is provided strictly &quot;AS IS&quot; and &quot;AS AVAILABLE.&quot;</strong> This applies equally to:
              <ul>
                <li>Our hosted cloud platform at kylrix.space and related domains</li>
                <li>Any self-hosted, forked, modified, or repackaged copy of the software you run on your own hardware or cloud account</li>
                <li>All related documentation, updates, previews, and community builds</li>
              </ul>
              We disclaim all warranties, whether express, implied, or statutory, including implied warranties of merchantability, fitness for a particular purpose, title, quiet enjoyment, accuracy, and non-infringement. We do not warrant that the software will be uninterrupted, error-free, secure, or free of data loss.
              <br /><br />
              <strong>Self-hosted operators:</strong> If you deploy Kylrix yourself, you alone are responsible for installation, configuration, backups, security hardening, compliance, uptime, and every byte stored on your instance. We provide source code and optional cloud hosting — not an managed guarantee for your deployment.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)" icon={<ShieldOff size={22} />} title="Limitation of Liability">
            <Typography component="div">
              To the fullest extent permitted by applicable law, Kylrix, its creators, maintainers, contributors, and affiliates shall <strong>not be liable</strong> for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, revenue, data, goodwill, business interruption, or security breach — whether arising from:
              <ul>
                <li>Use or inability to use the cloud service or self-hosted software</li>
                <li>Unauthorized access, vault lockout, password loss, or encryption key loss</li>
                <li>Database sync failures, migration errors, or third-party infrastructure outages</li>
                <li>Actions of other users, collaborators, or integrations you enable</li>
                <li>Software bugs, downtime, maintenance, or service changes</li>
              </ul>
              Where liability cannot be fully excluded, our total aggregate liability for any claim shall not exceed the greater of (a) the amount you paid us for the service in the twelve months before the claim, or (b) fifty US dollars (USD $50).
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #A855F7 0%, #EC4899 100%)" icon={<GitFork size={22} />} title="Open Source & Free-First Design">
            <Typography component="div">
              Our codebase is open source. Most workspace features are free. You may use, audit, fork, and self-host the software subject to the applicable open-source license and these terms.
              <br /><br />
              Open-source licensing governs the code itself. These Terms of Service govern your use of our hosted service and set expectations for support, liability, and acceptable use regardless of how you obtain the software.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #6366F1 0%, #10B981 100%)" icon={<CheckCircle size={22} />} title="Cloud Service & Self-Hosting">
            <Typography component="div">
              <strong>Hosted cloud:</strong> We may offer accounts, sync, storage, and optional paid features. Anonymized stability and diagnostic signals are required on our hosted platform so we can detect crashes and keep the service running. See our Privacy Policy for details.
              <br /><br />
              <strong>Self-hosted:</strong> You may run an isolated copy, disable telemetry, and control your own data boundary. We do not operate, monitor, or guarantee self-hosted instances unless we have a separate written agreement with you.
              <br /><br />
              You are responsible for choosing the deployment model that fits your security and compliance needs.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #10B981 0%, #3B82F6 100%)" icon={<Terminal size={22} />} title="Your Responsibilities">
            <Typography component="div">
              You agree to:
              <ul>
                <li>Keep your account credentials, master password, and recovery methods secure</li>
                <li>Maintain your own backups of important data — we are not a backup service</li>
                <li>Use the software lawfully and not to harass, abuse, spam, or distribute malware</li>
                <li>Not attempt to disrupt, scrape, overload, or reverse-engineer our hosted infrastructure beyond what the open-source license allows</li>
                <li>Ensure collaborators you invite comply with these terms</li>
              </ul>
              You are solely responsible for content you create, store, share, or export through Kylrix.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #EC4899 0%, #F59E0B 100%)" icon={<Ban size={22} />} title="Account Suspension & Service Changes">
            <Typography component="div">
              We may suspend or terminate access to our hosted service if you violate these terms, create security risk, or abuse the platform. We may modify, limit, or discontinue features at any time.
              <br /><br />
              Self-hosted copies are under your control; we cannot suspend your private instance. We may still stop providing updates or hosted accounts independently of your self-hosted deployment.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #818CF8 0%, #6366F1 100%)" icon={<Gavel size={22} />} title="Disputes & Governing Law">
            <Typography component="div">
              These terms are governed by the laws applicable to the operator of the hosted Kylrix service, without regard to conflict-of-law rules. Any dispute shall be resolved in the courts of that jurisdiction unless local consumer protection law requires otherwise.
              <br /><br />
              If a court finds any part of these terms unenforceable, the remaining sections stay in effect.
            </Typography>
          </LegalCard>

          <LegalCard accent="linear-gradient(90deg, #3B82F6 0%, #10B981 100%)" icon={<RefreshCw size={22} />} title="Changes to These Terms">
            <Typography component="div">
              We may update these terms from time to time. We will post the revised version on this page and update the &quot;Last modified&quot; date. Continued use of the hosted service after changes take effect constitutes acceptance. For material changes, we may provide additional notice where reasonably practicable.
            </Typography>
          </LegalCard>

          {/* Summary / Core Value Statement */}
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
            <Scale size={28} style={{ color: '#6366F1', marginBottom: 12 }} />
            <Typography variant="body1" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
              Layered Design Principles
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', maxWidth: 560, mx: 'auto', lineHeight: 1.5 }}>
              By using Kylrix — cloud or self-hosted — you accept these terms. The software is provided as is; we bear no liability beyond what the law absolutely requires.
            </Typography>
          </Paper>
        </Stack>

        <Divider sx={{ my: 6, borderColor: 'rgba(255,255,255,0.06)' }} />

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'block', textAlign: 'center', fontWeight: 500 }}>
          Last modified: June 2026. Applies to hosted services, open-source distribution, and self-hosted deployments.
        </Typography>
      </Container>
    </Box>
  );
}
