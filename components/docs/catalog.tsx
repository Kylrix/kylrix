'use client';

import React from 'react';
import {
  Box,
  Button,
  Grid,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import {
  BookOpen,
  FileCode2,
  FolderGit2,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import NextLink from 'next/link';
import { CodeBlock, LanguageSwitcher } from '@/components/ui/DocsUI';

export type DocsCategoryId = 'getting-started' | 'codebases' | 'security' | 'reference';

export interface DocsCategory {
  id: DocsCategoryId;
  title: string;
  summary: string;
  accent: string;
  icon: React.ComponentType<{ size?: number }>;
}

export interface DocsArticle {
  slug: string;
  title: string;
  summary: string;
  category: DocsCategoryId;
  featured?: boolean;
  keywords: string[];
  render: () => React.ReactNode;
}

const Section = ({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) => (
  <Stack spacing={2}>
    {eyebrow ? (
      <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.18em' }}>
        {eyebrow}
      </Typography>
    ) : null}
    <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.04em' }}>
      {title}
    </Typography>
    {children}
  </Stack>
);

const Callout = ({ title, text, accent = '#6366F1' }: { title: string; text: string; accent?: string }) => (
  <Box
    sx={{
      p: 2.5,
      borderRadius: 4,
      bgcolor: alpha(accent, 0.08),
      border: `1px solid ${alpha(accent, 0.16)}`,
    }}
  >
    <Typography variant="subtitle2" sx={{ color: accent, fontWeight: 900, mb: 1, letterSpacing: '0.14em' }}>
      {title}
    </Typography>
    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.74)', lineHeight: 1.8 }}>
      {text}
    </Typography>
  </Box>
);

const ArticleFrame = ({ children, eyebrow, title, summary }: { children: React.ReactNode; eyebrow: string; title: string; summary: string }) => (
  <Stack spacing={4}>
    <Box>
      <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.24em' }}>
        {eyebrow}
      </Typography>
      <Typography variant="h2" sx={{ mt: 1.5, fontWeight: 900, letterSpacing: '-0.06em' }}>
        {title}
      </Typography>
      <Typography variant="body1" sx={{ mt: 2, maxWidth: 900, color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
        {summary}
      </Typography>
    </Box>
    {children}
  </Stack>
);

const categories: DocsCategory[] = [
  { id: 'getting-started', title: 'Getting Started', summary: 'Onboarding, architecture, and the first integration steps.', accent: '#6366F1', icon: Sparkles },
  { id: 'codebases', title: 'Codebases', summary: 'Living documentation for Note, Vault, Flow, and Connect.', accent: '#EC4899', icon: FolderGit2 },
  { id: 'security', title: 'Security & Trust', summary: 'Identity, encryption tiers, session model, and guardrails.', accent: '#10B981', icon: ShieldCheck },
  { id: 'reference', title: 'Reference', summary: 'SDKs, commands, APIs, and reusable implementation details.', accent: '#F59E0B', icon: FileCode2 },
];

const articles: DocsArticle[] = [
  {
    slug: 'overview',
    title: 'Overview',
    summary: 'A map of the ecosystem, its apps, and the rules that keep the graph coherent.',
    category: 'getting-started',
    featured: true,
    keywords: ['ecosystem', 'apps', 'overview', 'graph', 'landing'],
    render: () => (
      <ArticleFrame eyebrow="INTRODUCTION" title="The Reactive Graph" summary="Kylrix is organized as a graph of specialized apps, not a monolith. Docs should mirror that shape: start broad, then fan out by topic and codebase.">
        <Stack spacing={3}>
          <Callout title="Core rule" text="Point to the source of truth instead of duplicating state across apps. Docs should explain where the source lives and why." />
          <Grid container spacing={2}>
            {[
              { title: 'Accounts', body: 'Root of trust, sessions, passkeys, and ecosystem identity.' },
              { title: 'Vault', body: 'Zero-knowledge state store for secrets, wallets, and MEK-backed data.' },
              { title: 'Flow', body: 'Action engine for work state, schedules, and orchestration.' },
              { title: 'Connect', body: 'Real-time communication with read/unread integrity.' },
            ].map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.title}>
                <Paper sx={{ p: 2.5, height: '100%', bgcolor: alpha('#fff', 0.03), border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
                    {item.body}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </ArticleFrame>
    ),
  },
  {
    slug: 'quick-start',
    title: 'Quick Start',
    summary: 'Install the SDK, create a client, and connect to the ecosystem.',
    category: 'getting-started',
    featured: true,
    keywords: ['install', 'setup', 'sdk', 'quick start', 'client'],
    render: () => (
      <ArticleFrame eyebrow="GETTING STARTED" title="Quick Start" summary="Use the language switcher to see the same setup flow across TypeScript, Go, Python, and Dart.">
        <Stack spacing={3}>
          <LanguageSwitcher />
          <CodeBlock
            languages={{
              typescript: 'pnpm add @kylrix/sdk',
              go: 'go get github.com/kylrix/sdks-go',
              python: 'pip install kylrix-sdk',
              dart: 'dart pub add kylrix_sdk',
            }}
          />
          <Callout
            title="Next step"
            text="After install, move to the architecture doc so the app boundaries and session rules make sense before you start wiring features."
          />
        </Stack>
      </ArticleFrame>
    ),
  },
  {
    slug: 'architecture',
    title: 'Architecture',
    summary: 'How the ecosystem, routing, and data flow are meant to stay coherent.',
    category: 'getting-started',
    keywords: ['architecture', 'routing', 'state', 'source of truth'],
    render: () => (
      <ArticleFrame eyebrow="SYSTEMS" title="Architecture Principles" summary="The docs should explain the same architecture that the apps enforce: source of truth first, no unnecessary duplication, and clear boundaries around transient versus persistent state.">
        <Stack spacing={3}>
          <Section title="Three layers of meaning">
            <Grid container spacing={2}>
              {[
                { title: 'Pulse', body: 'Live, transient state that should move in realtime rather than sit in tables.' },
                { title: 'Notification', body: 'Persistent pointers for noteworthy events that the UI evaluates on activity.' },
                { title: 'Universal session', body: 'One authenticated session spans the ecosystem and powers cross-app access.' },
              ].map((item) => (
                <Grid size={{ xs: 12, md: 4 }} key={item.title}>
                  <Paper sx={{ p: 2.5, height: '100%', bgcolor: alpha('#fff', 0.03), border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
                      {item.body}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Section>
          <CodeBlock
            languages={{
              typescript: '// Example of a docs-driven pointer to the source app\nconst source = getEcosystemUrl("vault");',
              go: '// Cross-app access still follows the same source-of-truth rule',
              python: '# Document the data owner first, then the consumer',
              dart: '// The route should explain the object, not clone it',
            }}
          />
        </Stack>
      </ArticleFrame>
    ),
  },
  {
    slug: 'note',
    title: 'Note',
    summary: 'Why the Note codebase is structured around privacy, sharing, and AI-assisted organization.',
    category: 'codebases',
    featured: true,
    keywords: ['note', 'notes', 'sharing', 'ai', 'privacy'],
    render: () => (
      <ArticleFrame eyebrow="CODEBASE GUIDE" title="Note" summary="Note docs should explain why features are implemented the way they are in code, not just what the UI does.">
        <Stack spacing={3}>
          <Callout
            title="Identity and sharing"
            text="Notes are tied to a user unless they are deliberate ghost notes. Public visibility is link-only, and docs should repeat that rule clearly."
            accent="#EC4899"
          />
          <Section title="What belongs here">
            <Stack spacing={1.5}>
              {[
                'Search and retrieval behavior',
                'Ghost note isolation and link-only access',
                'Sharing flows and collaborator rules',
                'AI enrichment and content intelligence',
              ].map((label) => (
                <Box key={label} sx={{ px: 2, py: 1.5, borderRadius: 3, bgcolor: alpha('#fff', 0.04), border: '1px solid rgba(255,255,255,0.05)' }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {label}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Section>
        </Stack>
      </ArticleFrame>
    ),
  },
  {
    slug: 'vault',
    title: 'Vault',
    summary: 'Zero-knowledge storage, master passwords, MEK handling, and unlock behavior.',
    category: 'codebases',
    keywords: ['vault', 'mek', 'unlock', 'decrypt', 'master password'],
    render: () => (
      <ArticleFrame eyebrow="CODEBASE GUIDE" title="Vault" summary="Vault docs should focus on how the encryption tiers work, what happens during unlock and reset flows, and why the system behaves that way.">
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {[
              { title: 'Tier 2', body: 'Client-side decrypted state backed by the Master Encryption Key.' },
              { title: 'Reset impact', body: 'A master password reset invalidates old MEKs and wipes unreadable Tier 2 material.' },
              { title: 'Passkeys', body: 'Wrapped to the old MEK and purged on reset to avoid stale access.' },
            ].map((item) => (
              <Grid size={{ xs: 12, md: 4 }} key={item.title}>
                <Paper sx={{ p: 2.5, height: '100%', bgcolor: alpha('#fff', 0.03), border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
                    {item.body}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <CodeBlock
            languages={{
              typescript: '// Vault docs should explain why data becomes unreadable after reset.',
              go: '// Any server-side helper still needs to respect the zero-knowledge boundary.',
              python: '# No plaintext fallback in the documentation or in the code.',
              dart: '// Unlocks should be described as derived state, not a permanent session.',
            }}
          />
        </Stack>
      </ArticleFrame>
    ),
  },
  {
    slug: 'security',
    title: 'Security',
    summary: 'Threat model, session model, encryption tiers, and what each docs page must reinforce.',
    category: 'security',
    featured: true,
    keywords: ['security', 'threat model', 'e2ee', 'passkeys', 'session'],
    render: () => (
      <ArticleFrame eyebrow="SECURITY" title="Security Model" summary="This category should stitch together the trust model across all apps so readers can trace why each protection exists.">
        <Stack spacing={3}>
          <Section title="What docs should repeatedly clarify">
            <Grid container spacing={2}>
              {[
                { title: 'Database encryption', body: 'Managed by the backend, decrypted before the UI sees it.' },
                { title: 'Zero-knowledge', body: 'Vault and Connect DMs stay client-decrypted with the MEK.' },
                { title: 'Documented boundaries', body: 'Every article should say what is allowed, what is link-only, and what gets wiped.' },
              ].map((item) => (
                <Grid size={{ xs: 12, md: 4 }} key={item.title}>
                  <Paper sx={{ p: 2.5, height: '100%', bgcolor: alpha('#fff', 0.03), border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
                      {item.body}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Section>
          <Callout
            title="Cross-reference"
            text="Security docs should link back to Note for ghost note behavior, Vault for MEK resets, and Connect for encrypted messages and read-state integrity."
            accent="#10B981"
          />
        </Stack>
      </ArticleFrame>
    ),
  },
  {
    slug: 'connect',
    title: 'Connect',
    summary: 'Messaging, call state, and integrity rules for realtime communication.',
    category: 'codebases',
    keywords: ['connect', 'chat', 'call', 'realtime', 'messaging'],
    render: () => (
      <ArticleFrame eyebrow="CODEBASE GUIDE" title="Connect" summary="Connect docs should focus on realtime pulses, encrypted DMs, read/unread integrity, and why transient state stays transient.">
        <Stack spacing={3}>
          <Callout
            title="Realtime first"
            text="When communication is live, docs should explain the pulse path rather than the database path whenever possible."
            accent="#F59E0B"
          />
          <Grid container spacing={2}>
            {[
              { title: 'Calls', body: 'Session setup, active call state, and why call history is a separate read model.' },
              { title: 'Messages', body: 'Encrypted DMs and the rules that protect unread/read integrity.' },
              { title: 'Presence', body: 'Transient signals should use realtime rather than long-lived tables.' },
            ].map((item) => (
              <Grid size={{ xs: 12, md: 4 }} key={item.title}>
                <Paper sx={{ p: 2.5, height: '100%', bgcolor: alpha('#fff', 0.03), border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
                    {item.body}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </ArticleFrame>
    ),
  },
  {
    slug: 'flow',
    title: 'Flow',
    summary: 'Work orchestration, task state, schedules, and action pipelines.',
    category: 'codebases',
    keywords: ['flow', 'tasks', 'schedule', 'orchestration', 'calendar'],
    render: () => (
      <ArticleFrame eyebrow="CODEBASE GUIDE" title="Flow" summary="Flow docs should capture the action engine: how work gets queued, why tasks live where they do, and how calendars and work state fit together.">
        <Stack spacing={3}>
          <Grid container spacing={2}>
            {[
              { title: 'Tasks', body: 'Explain task lifecycles, status transitions, and where source-of-truth state lives.' },
              { title: 'Calendar', body: 'Show how schedule views relate to work state rather than duplicating it.' },
              { title: 'Automation', body: 'Document orchestration triggers and reusable action patterns.' },
            ].map((item) => (
              <Grid size={{ xs: 12, md: 4 }} key={item.title}>
                <Paper sx={{ p: 2.5, height: '100%', bgcolor: alpha('#fff', 0.03), border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
                    {item.body}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </ArticleFrame>
    ),
  },
  {
    slug: 'typescript-sdk',
    title: 'TypeScript SDK',
    summary: 'Reference for the web-first SDK and the docs authoring patterns it should follow.',
    category: 'reference',
    keywords: ['sdk', 'typescript', 'client', 'reference', 'installation'],
    render: () => (
      <ArticleFrame eyebrow="REFERENCE" title="TypeScript SDK" summary="SDK reference pages should show installation, client setup, and the smallest useful code path first.">
        <Stack spacing={3}>
          <CodeBlock
            languages={{
              typescript: "import { Kylrix } from '@kylrix/sdk';\n\nconst sdk = new Kylrix({ endpoint: 'https://cloud.appwrite.io/v1', project: 'your-project-id' });",
              go: 'sdk := kylrix.NewClient(kylrix.Config{ Endpoint: "https://cloud.appwrite.io/v1", Project: "your-project-id" })',
              python: 'sdk = Kylrix(endpoint="https://cloud.appwrite.io/v1", project="your-project-id")',
              dart: "final sdk = Kylrix(endpoint: 'https://cloud.appwrite.io/v1', project: 'your-project-id');",
            }}
          />
          <Callout
            title="Docs rule"
            text="Keep one compact install/setup block near the top, then split into focused sections for auth, data, and ecosystem-specific helpers."
          />
        </Stack>
      </ArticleFrame>
    ),
  },
];

export const DOCS_CATEGORIES = categories;
export const DOCS_ARTICLES = articles;
const DOCS_ARTICLE_ALIASES: Record<string, string> = {
  identity: 'security',
  'sdks/typescript': 'typescript-sdk',
};

export const DOCS_FEATURED = articles.filter((article) => article.featured);

export const getDocsArticleBySlug = (slug: string) =>
  DOCS_ARTICLES.find((article) => article.slug === slug) ||
  DOCS_ARTICLES.find((article) => article.slug === DOCS_ARTICLE_ALIASES[slug]) ||
  null;

export const getDocsCategory = (id: DocsCategoryId) => DOCS_CATEGORIES.find((category) => category.id === id) || null;

export const getDocsArticleSearchText = (article: DocsArticle) =>
  [article.title, article.summary, article.category, ...article.keywords].join(' ').toLowerCase();

export const searchDocsArticles = (query: string) => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return DOCS_ARTICLES;
  return DOCS_ARTICLES.filter((article) => getDocsArticleSearchText(article).includes(normalized));
};

export const DocsCard = ({
  article,
  selected = false,
}: {
  article: DocsArticle;
  selected?: boolean;
}) => {
  const category = getDocsCategory(article.category);
  const Icon = category?.icon || BookOpen;

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 4,
        bgcolor: selected ? alpha('#fff', 0.05) : alpha('#fff', 0.025),
        border: `1px solid ${selected ? alpha(category?.accent || '#6366F1', 0.32) : 'rgba(255,255,255,0.06)'}`,
        height: '100%',
      }}
    >
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 1.5 }}>
        <Box sx={{ color: category?.accent || '#6366F1' }}>
          <Icon size={18} />
        </Box>
        <Typography variant="subtitle2" sx={{ letterSpacing: '0.14em', fontWeight: 900, color: category?.accent || '#6366F1' }}>
          {category?.title}
        </Typography>
      </Stack>
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
        {article.title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.7 }}>
        {article.summary}
      </Typography>
    </Paper>
  );
};

export const DocsLandingHero = () => (
  <Stack spacing={3}>
    <Typography variant="subtitle2" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.3em' }}>
      DOCUMENTATION
    </Typography>
    <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: '2.6rem', md: '4.6rem' }, letterSpacing: '-0.07em' }}>
      Master the <br /> Ecosystem.
    </Typography>
    <Typography variant="subtitle1" sx={{ maxWidth: 840, opacity: 0.62, fontSize: '1.25rem', lineHeight: 1.8 }}>
      Searchable, categorized documentation for the ecosystem, its codebases, its security model, and its reference material.
    </Typography>
  </Stack>
);

export const DocsLandingSearchTip = () => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      px: 2,
      py: 1.5,
      borderRadius: 3,
      bgcolor: alpha('#fff', 0.03),
      border: '1px solid rgba(255,255,255,0.06)',
    }}
  >
    <Search size={16} />
    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.64)' }}>
      Use the sidebar search to jump across topics, codebases, and reference pages.
    </Typography>
  </Box>
);

export const DocsLandingAction = () => (
  <Button
    component={NextLink}
    href="/docs/quick-start"
    variant="contained"
    sx={{ borderRadius: 2.5, px: 3, py: 1.4, fontWeight: 800 }}
  >
    Start with Quick Start
  </Button>
);

export const DocsRenderArticle = ({ slug }: { slug: string }) => {
  const article = getDocsArticleBySlug(slug);
  if (!article) return null;
  return <>{article.render()}</>;
};
