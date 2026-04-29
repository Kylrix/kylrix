export interface SdkSection extends SdkSectionNav {
  description: string;
  snippet: string;
}

export interface SdkSectionNav {
  id: string;
  title: string;
  summary: string;
  accent: string;
  sourceHref: string;
}

const githubBase = 'https://github.com/kylrix/sdks/blob/master/typescript/src';

export const SDK_SECTIONS: SdkSection[] = [
  {
    id: 'design',
    title: 'Design',
    summary: 'Palette, tokens, typography',
    description: 'Shared colors and layout tokens used across the ecosystem.',
    accent: '#6366F1',
    sourceHref: `${githubBase}/design/index.ts`,
    snippet: `import { KYLRIX_COLORS, KYLRIX_APP_TONES, TOPBAR_LAYOUT } from '@kylrix/sdk/design';`,
  },
  {
    id: 'topbar',
    title: 'Topbar',
    summary: 'Surface registry and pills',
    description: 'The shared topbar contract that powers search, profile, and ecosystem actions.',
    accent: '#EC4899',
    sourceHref: `${githubBase}/topbar/index.ts`,
    snippet: `import { createTopbarSurface, createTopbarAction } from '@kylrix/sdk/topbar';`,
  },
  {
    id: 'fab',
    title: 'FAB',
    summary: 'Floating action metadata',
    description: 'The global floating action button model for compose-style shortcuts.',
    accent: '#10B981',
    sourceHref: `${githubBase}/fab/index.ts`,
    snippet: `import { createFabAction } from '@kylrix/sdk/fab';`,
  },
  {
    id: 'profile-preview',
    title: 'Profile Preview',
    summary: 'Avatar cache + fetch',
    description: 'Profile photo fetching with cache-first behavior and Appwrite previews.',
    accent: '#F59E0B',
    sourceHref: `${githubBase}/appwrite/index.ts`,
    snippet: `import { createProfilePreviewManager } from '@kylrix/sdk/appwrite';`,
  },
  {
    id: 'ecosystem',
    title: 'Ecosystem',
    summary: 'Routes and app registry',
    description: 'Shared app URLs and cross-app routing helpers for the graph.',
    accent: '#6366F1',
    sourceHref: `${githubBase}/ecosystem/index.ts`,
    snippet: `import { getEcosystemUrl, ECOSYSTEM_APPS } from '@kylrix/sdk/ecosystem';`,
  },
  {
    id: 'security',
    title: 'Security',
    summary: 'Masterpass + MEK logic',
    description: 'Zero-knowledge primitives, unlock/reset flows, and trust boundaries.',
    accent: '#10B981',
    sourceHref: `${githubBase}/security/index.ts`,
    snippet: `import { deriveMasterpassKey, resetMasterpassState } from '@kylrix/sdk/security';`,
  },
  {
    id: 'messaging',
    title: 'Messaging',
    summary: 'Threads and envelopes',
    description: 'Shared message types for real-time conversations and read state.',
    accent: '#F97316',
    sourceHref: `${githubBase}/messaging/index.ts`,
    snippet: `import { createMessageEnvelope } from '@kylrix/sdk/messaging';`,
  },
  {
    id: 'social',
    title: 'Social',
    summary: 'Moments and reactions',
    description: 'Post and thread primitives for the feed and its metadata.',
    accent: '#EC4899',
    sourceHref: `${githubBase}/social/index.ts`,
    snippet: `import { createMomentSignal } from '@kylrix/sdk/social';`,
  },
  {
    id: 'huddles',
    title: 'Huddles',
    summary: 'Call orchestration',
    description: 'Transient call/session objects for tasks, notes, and threads.',
    accent: '#A855F7',
    sourceHref: `${githubBase}/huddles/index.ts`,
    snippet: `import { createHuddleSignal } from '@kylrix/sdk/huddles';`,
  },
  {
    id: 'extensions',
    title: 'Extensions',
    summary: 'Global add-ons',
    description: 'The ecosystem extension contract used by Note and companion apps.',
    accent: '#22C55E',
    sourceHref: `${githubBase}/extensions/index.ts`,
    snippet: `import { createExtensionManifest } from '@kylrix/sdk/extensions';`,
  },
];

export function getSdkSection(id: string) {
  return SDK_SECTIONS.find((section) => section.id === id) || SDK_SECTIONS[0];
}
