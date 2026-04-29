import type { ComponentType } from 'react';
import {
  Blocks,
  CirclePlus,
  MessageSquare,
  Palette,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
  Waypoints,
  PanelsTopLeft,
} from 'lucide-react';

export interface SdkSectionNav {
  id: string;
  title: string;
  summary: string;
  accent: string;
  sourceHref: string;
}

export interface SdkSection extends SdkSectionNav {
  description: string;
  snippet: string;
  icon: ComponentType<{ size?: number }>;
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
    snippet: `import { KYLRIX_COLORS, KYLRIX_APP_TONES, TOPBAR_LAYOUT } from '@/lib/sdk/design';`,
    icon: Palette,
  },
  {
    id: 'topbar',
    title: 'Topbar',
    summary: 'Surface registry and pills',
    description: 'The shared topbar contract that powers search, profile, and ecosystem actions.',
    accent: '#EC4899',
    sourceHref: `${githubBase}/topbar/index.ts`,
    snippet: `import { createTopbarSurface, createTopbarAction } from '@/lib/sdk/topbar';`,
    icon: PanelsTopLeft,
  },
  {
    id: 'fab',
    title: 'FAB',
    summary: 'Floating action metadata',
    description: 'The global floating action button model for compose-style shortcuts.',
    accent: '#10B981',
    sourceHref: `${githubBase}/fab/index.ts`,
    snippet: `import { createFabAction } from '@/lib/sdk/fab';`,
    icon: CirclePlus,
  },
  {
    id: 'profile-preview',
    title: 'Profile Preview',
    summary: 'Avatar cache + fetch',
    description: 'Profile photo fetching with cache-first behavior and Appwrite previews.',
    accent: '#F59E0B',
    sourceHref: `${githubBase}/appwrite/index.ts`,
    snippet: `import { createProfilePreviewManager } from '@/lib/sdk/appwrite';`,
    icon: UserRound,
  },
  {
    id: 'ecosystem',
    title: 'Ecosystem',
    summary: 'Routes and app registry',
    description: 'Shared app URLs and cross-app routing helpers for the graph.',
    accent: '#6366F1',
    sourceHref: `${githubBase}/ecosystem/index.ts`,
    snippet: `import { getEcosystemUrl, ECOSYSTEM_APPS } from '@/lib/sdk/ecosystem';`,
    icon: Waypoints,
  },
  {
    id: 'security',
    title: 'Security',
    summary: 'Masterpass + MEK logic',
    description: 'Zero-knowledge primitives, unlock/reset flows, and trust boundaries.',
    accent: '#10B981',
    sourceHref: `${githubBase}/security/index.ts`,
    snippet: `import { deriveMasterpassKey, resetMasterpassState } from '@/lib/sdk/security';`,
    icon: ShieldCheck,
  },
  {
    id: 'messaging',
    title: 'Messaging',
    summary: 'Threads and envelopes',
    description: 'Shared message types for real-time conversations and read state.',
    accent: '#F97316',
    sourceHref: `${githubBase}/messaging/index.ts`,
    snippet: `import { createMessageEnvelope } from '@/lib/sdk/messaging';`,
    icon: MessageSquare,
  },
  {
    id: 'social',
    title: 'Social',
    summary: 'Moments and reactions',
    description: 'Post and thread primitives for the feed and its metadata.',
    accent: '#EC4899',
    sourceHref: `${githubBase}/social/index.ts`,
    snippet: `import { createMomentSignal } from '@/lib/sdk/social';`,
    icon: Sparkles,
  },
  {
    id: 'huddles',
    title: 'Huddles',
    summary: 'Call orchestration',
    description: 'Transient call/session objects for tasks, notes, and threads.',
    accent: '#A855F7',
    sourceHref: `${githubBase}/huddles/index.ts`,
    snippet: `import { createHuddleSignal } from '@/lib/sdk/huddles';`,
    icon: Phone,
  },
  {
    id: 'extensions',
    title: 'Extensions',
    summary: 'Global add-ons',
    description: 'The ecosystem extension contract used by Note and companion apps.',
    accent: '#22C55E',
    sourceHref: `${githubBase}/extensions/index.ts`,
    snippet: `import { createExtensionManifest } from '@/lib/sdk/extensions';`,
    icon: Blocks,
  },
];

export function getSdkSection(id: string) {
  return SDK_SECTIONS.find((section) => section.id === id) || SDK_SECTIONS[0];
}
