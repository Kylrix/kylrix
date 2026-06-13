'use client';

import React from 'react';
import {
  BookOpen,
  Settings,
  ShieldCheck,
  User,
  Sparkles,
  LayoutGrid,
  ClipboardList,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import NextLink from 'next/link';

export type GuideCategoryId = 'basics' | 'security' | 'ecosystem' | 'collaboration';

export interface GuideCategory {
  id: GuideCategoryId;
  title: string;
  summary: string;
  accent: string;
  icon: React.ComponentType<{ size?: number }>;
}

export interface GuideArticle {
  slug: string;
  title: string;
  summary: string;
  category: GuideCategoryId;
  featured?: boolean;
  keywords: string[];
  render: () => React.ReactNode;
}

const Section = ({ eyebrow, title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) => (
  <div className="space-y-4 mt-8">
    {eyebrow && (
      <span className="text-[10px] text-[#F59E0B] font-black uppercase tracking-wider block">
        {eyebrow}
      </span>
    )}
    <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
      {title}
    </h3>
    {children}
  </div>
);

const Callout = ({ title, text, accent = '#6366F1' }: { title: string; text: string; accent?: string }) => (
  <div
    className="p-5 rounded-2xl border"
    style={{
      backgroundColor: `${accent}14`,
      borderColor: `${accent}29`,
    }}
  >
    <span className="text-xs font-black block mb-2 tracking-wider" style={{ color: accent }}>
      {title}
    </span>
    <p className="text-white/75 text-sm leading-relaxed">
      {text}
    </p>
  </div>
);

const StepList = ({ steps }: { steps: { step: string; text: string }[] }) => (
  <ol className="space-y-4">
    {steps.map((item, idx) => (
      <li key={idx} className="flex gap-4 items-start p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#6366F1]/20 text-[#6366F1] font-black text-sm flex-shrink-0">
          {idx + 1}
        </span>
        <div className="space-y-1">
          <strong className="text-white text-sm block font-extrabold">{item.step}</strong>
          <span className="text-white/60 text-xs md:text-sm leading-relaxed block">{item.text}</span>
        </div>
      </li>
    ))}
  </ol>
);

const ArticleFrame = ({ children, eyebrow, title, summary }: { children: React.ReactNode; eyebrow: string; title: string; summary: string }) => (
  <div className="space-y-8">
    <div>
      <span className="text-xs text-[#F59E0B] font-black uppercase tracking-[0.24em] block">
        {eyebrow}
      </span>
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white mt-3 tracking-tight">
        {title}
      </h1>
      <p className="text-white/65 mt-4 max-w-4xl text-sm md:text-base leading-relaxed">
        {summary}
      </p>
    </div>
    <div className="border-t border-white/[0.06] pt-8">
      {children}
    </div>
  </div>
);

const categories: GuideCategory[] = [
  { id: 'basics', title: 'Product Basics', summary: 'Core day-to-day actions including creating notes, tags, and drafts.', accent: '#6366F1', icon: Sparkles },
  { id: 'security', title: 'Security & Auth', summary: 'Enhancing account security with Multi-Factor authentication and passkeys.', accent: '#10B981', icon: ShieldCheck },
  { id: 'ecosystem', title: 'Ecosystem & Tools', summary: 'Navigating Kylrix applications, cross-app routing, and topbar controls.', accent: '#EC4899', icon: LayoutGrid },
  { id: 'collaboration', title: 'Projects & Teams', summary: 'Coordinating active workflows, tasks, group huddles, and permissions.', accent: '#F59E0B', icon: ClipboardList }
];

const articles: GuideArticle[] = [
  {
    slug: 'create-notes',
    title: 'Creating and Managing Notes',
    summary: 'A step-by-step guide to writing notes, attaching tags, and retrieving drafts.',
    category: 'basics',
    featured: true,
    keywords: ['create notes', 'notes', 'drafts', 'rich text', 'tags'],
    render: () => (
      <ArticleFrame eyebrow="BASICS" title="Creating and Managing Notes" summary="Notes are the primary repository of context in Kylrix. They support rich markdown, tag tagging, E2E encryption, and offline-first auto-saving.">
        <div className="space-y-6">
          <Callout title="Encrypted Storage" text="Standard notes are stored securely in Appwrite and synchronized to local IndexedDB. Encrypted notes require an active masterpass session." accent="#6366F1" />
          
          <Section title="Step-by-step Creation Flow">
            <StepList
              steps={[
                { step: 'Open the Note Application', text: 'Click the Note icon in the ecosystem topbar or navigate directly to `/note`.' },
                { step: 'Create a Fresh Note', text: 'Click the "+" button or FAB (Floating Action Button) in the bottom-right corner.' },
                { step: 'Fill Context and Content', text: 'Input your title and content. Standard Markdown headings, lists, and codes are fully supported.' },
                { step: 'Add Tags', text: 'Use the tag selector to categorize your note. Tags automatically index your notes for faster cross-reference lookup.' }
              ]}
            />
          </Section>

          <Section title="Draft Recovery">
            <p className="text-white/70 text-sm md:text-base leading-relaxed">
              If your browser closes abruptly or network connection is interrupted, the **Cascading-on-Demand** sync engine recovers uncommitted note buffers. Check the local cache storage menu to restore draft versions instantly.
            </p>
          </Section>
        </div>
      </ArticleFrame>
    )
  },
  {
    slug: 'add-2fa',
    title: 'Enabling Multi-Factor Authentication',
    summary: 'Secure your login state and masterpass vault by adding 2FA verification.',
    category: 'security',
    featured: true,
    keywords: ['2fa', 'mfa', 'security', 'authenticator', 'passkey'],
    render: () => (
      <ArticleFrame eyebrow="SECURITY" title="Enabling Multi-Factor Authentication" summary="Secure your workspace by configuring temporal Multi-Factor Authentication (MFA). A verified session blocks brute-force credentials attacks.">
        <div className="space-y-6">
          <Callout title="TOTP Normalization" text="Kylrix aligns timestamps strictly during temporal MFA session verifications. Ensure your device time is synchronized with network standard time." accent="#10B981" />

          <Section title="Setting Up Two-Factor Verification">
            <StepList
              steps={[
                { step: 'Navigate to Security Settings', text: 'Go to `/accounts/settings` or click on your profile picture and select Settings.' },
                { step: 'Locate 2FA section', text: 'Find the "Multi-Factor Authentication" segment under the privacy panel.' },
                { step: 'Scan the QR Code', text: 'Use Google Authenticator, Authy, or any TOTP compatible authenticator app to scan the generated QR code.' },
                { step: 'Submit Verification Code', text: 'Input the 6-digit temporal code generated by your app to authorize and seal the setup.' }
              ]}
            />
          </Section>

          <Section title="Temporal Sudo Gateways">
            <p className="text-white/70 text-sm md:text-base leading-relaxed">
              Once MFA is active, performing high-privilege operations (like exporting credentials or changing passwords) prompts a 5-minute temporal **Sudo Mode** verification window, securing background operations.
            </p>
          </Section>
        </div>
      </ArticleFrame>
    )
  },
  {
    slug: 'update-profile-picture',
    title: 'Updating Profile Avatar',
    summary: 'How to upload, compress, and sync your profile identity image across the ecosystem.',
    category: 'basics',
    keywords: ['profile picture', 'avatar', 'identity', 'compress'],
    render: () => (
      <ArticleFrame eyebrow="IDENTITY" title="Updating Profile Avatar" summary="Your identity avatar is shared across Connect chats, huddles, and collaborative project workspaces.">
        <div className="space-y-6">
          <Callout title="Automatic Compression" text="Files are scaled and optimized on the client-side before upload to preserve bandwidth and conform to storage subscription guidelines." accent="#EC4899" />

          <Section title="Uploading New Picture">
            <StepList
              steps={[
                { step: 'Access Profile Details', text: 'Go to Settings (`/accounts/settings`) or the profile page (`/u/[username]`).' },
                { step: 'Trigger Picture Edit', text: 'Hover over or click on your current avatar, and select the file edit icon.' },
                { step: 'Select Image File', text: 'Choose a PNG, JPEG, or WebP image. The client will crop and resize the frame.' },
                { step: 'Commit Changes', text: 'Click Save. Your profile image is instantly distributed to the universal identity cache directory.' }
              ]}
            />
          </Section>
        </div>
      </ArticleFrame>
    )
  },
  {
    slug: 'ecosystem-apps',
    title: 'Ecosystem Apps & Topbar Navigation',
    summary: 'Learn about the topbar icons, ecosystem launcher, and navigating between Note, Vault, Flow, and Connect.',
    category: 'ecosystem',
    featured: true,
    keywords: ['ecosystem apps', 'topbar', 'navigation', 'launcher', 'icon'],
    render: () => (
      <ArticleFrame eyebrow="NAVIGATION" title="Ecosystem Apps & Topbar" summary="The topbar acts as the global command center for Kylrix. It hosts the ecosystem app launcher, notifications ledger, and system state monitors.">
        <div className="space-y-6">
          <Callout title="Unintuitive Icons Explained" text="The grid icon on the top-left or top-right serves as the global App Launcher. Tap it to toggle between Note, Vault, Flow, and Connect apps instantly." accent="#EC4899" />

          <Section title="The Global Topbar Structure">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'Ecosystem Grid Icon', body: 'Located on the bar. Tapping it opens a floating dashboard panel listing all Kylrix modules (Note, Flow, Vault, Connect).' },
                { title: 'Vault Lock Status', body: 'Shows whether your E2E local keychain is unlocked. Click to re-enter masterpass or lock your local state.' },
                { title: 'Direct Messages / Sync Ledger', body: 'The bell or messaging emblem provides a feed of pending activity notifications and huddle requests.' },
                { title: 'Interactive Profile Menu', body: 'Access billing status, terms of service, dark-theme preferences, and profile configurations.' }
              ].map((item) => (
                <div key={item.title} className="p-5 h-full bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                  <h4 className="font-extrabold text-white mb-2 text-sm md:text-base">
                    {item.title}
                  </h4>
                  <p className="text-white/65 text-xs md:text-sm leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Fast Navigation Checklist">
            <StepList
              steps={[
                { step: 'Open App Launcher', text: 'Click the grid icon on the topbar navigation header.' },
                { step: 'Select Target Application', text: 'Choose the suite icon matching your task (e.g. Vault for passwords, Flow for calendar).' },
                { step: 'Sync & Return', text: 'Shared state stays hydrated in the background, allowing frictionless context transitions.' }
              ]}
            />
          </Section>
        </div>
      </ArticleFrame>
    )
  },
  {
    slug: 'projects-and-channels',
    title: 'Managing Projects & Group Channels',
    summary: 'Coordinate team workflows, create group channels, and manage collaborator boundaries.',
    category: 'collaboration',
    keywords: ['projects', 'channels', 'collaborators', 'limit'],
    render: () => (
      <ArticleFrame eyebrow="COLLABORATION" title="Projects & Group Channels" summary="Spin up tasks, link document collections, and start real-time communication channels inside projects.">
        <div className="space-y-6">
          <Callout title="Collaborator Ceilings" text="Free tier accounts can own 1 active project and create 2-participant chats. Upgrade to Pro/Teams to unlock unlimited group sizes and multiple projects." accent="#F59E0B" />

          <Section title="Creating a Shared Channel">
            <StepList
              steps={[
                { step: 'Open Chats', text: 'Navigate to `/connect/chats`.' },
                { step: 'Open Channel Drawer', text: 'Click the "+" action FAB and select "NEW CHANNEL".' },
                { step: 'Specify Identity & Invite', text: 'Enter your channel name and invite verified participants. (Ensure all members have initialized public encryption keys).' },
                { step: 'Initialize Secure Chat', text: 'Click "Create Channel" to spawn the E2EE huddle channel.' }
              ]}
            />
          </Section>
        </div>
      </ArticleFrame>
    )
  }
];

export const GUIDE_CATEGORIES = categories;
export const GUIDE_ARTICLES = articles;
export const getGuideArticleBySlug = (slug: string) =>
  GUIDE_ARTICLES.find((article) => article.slug === slug) || null;

export const getGuideCategory = (id: GuideCategoryId) => GUIDE_CATEGORIES.find((category) => category.id === id) || null;

export const GuidesCard = ({
  article,
  selected = false,
}: {
  article: GuideArticle;
  selected?: boolean;
}) => {
  const category = getGuideCategory(article.category);
  const Icon = category?.icon || BookOpen;
  const accentColor = category?.accent || '#6366F1';

  return (
    <div
      className={`p-5 rounded-2xl h-full transition-all border ${
        selected ? 'bg-white/[0.05]' : 'bg-white/[0.025]'
      }`}
      style={{
        borderColor: selected ? `${accentColor}52` : 'rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div style={{ color: accentColor }}>
          <Icon size={18} />
        </div>
        <span className="font-black text-xs tracking-wider block uppercase" style={{ color: accentColor }}>
          {category?.title}
        </span>
      </div>
      <h3 className="font-extrabold text-white mb-2 text-base">
        {article.title}
      </h3>
      <p className="text-white/65 text-sm leading-relaxed">
        {article.summary}
      </p>
    </div>
  );
};
