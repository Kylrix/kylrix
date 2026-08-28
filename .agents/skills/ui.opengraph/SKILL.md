---
name: ui.opengraph
description: OpenGraph (OG) image cards, preview metadata, dynamic share cards, and social link rendering guidelines.
---

# OpenGraph & Social Share Cards (Canonical)

Kylrix generates dynamic, high-contrast OpenGraph preview cards for shared objects, public profiles, and standalone product surfaces using Next.js `ImageResponse` (`@vercel/og`) and the centralized `renderKylrixShareCard` engine.

## 1. Structure & Layout Rules

1. **Standard Dimensions**: `1200 x 630` px (`width: 1200`, `height: 630`, `contentType: 'image/png'`).
2. **Runtime**: Export `export const runtime = 'nodejs';` in all `opengraph-image.tsx` route handlers.
3. **High-Contrast Dark Theme**: Card background is `#0A0908` with subtle radial glow matching the domain accent.
4. **Packed Visual Hierarchy**:
   - **Left Column**: Domain chip / eyebrow + product label, bold uncluttered title (max 52 chars), concise one-liner description (max 90 chars), and up to 3 metadata tag chips.
   - **Right Column**: Large geometric Kylrix mark (`KylrixLogo`) or media preview thumbnail.
   - **Bottom Anchor**: Shared owner avatar / name badge with host indicator (`kylrix.space`).

## 2. Color Palettes (`OgAccent`)

| Accent | Domain Surface | Solid | Glow |
|---|---|---|---|
| `rose` | Sponsorships, Community Tipping, Donations | `#FB7185` | `rgba(244,63,94,0.22)` |
| `indigo` | Core Workspace, User Profiles, System | `#818CF8` | `rgba(99,102,241,0.22)` |
| `violet` | Goals, Milestones, Flow Routines | `#C084FC` | `rgba(168,85,247,0.22)` |
| `amber` | Calendars, Events, Meetings | `#FBBF24` | `rgba(245,158,11,0.22)` |
| `emerald` | Vault Items, TOTP Secrets, Security | `#34D399` | `rgba(16,185,129,0.22)` |

## 3. Route Wiring Pattern

For any public route or shareable surface (`/sponsor`, `/u/[username]`, `/goal/[id]`, `/events/[eventId]`, `/idea/[id]`):

1. **`layout.tsx` (Server Component)**:
   ```typescript
   import type { Metadata } from 'next';
   import { buildOgMetadata } from '@/lib/og/share-card';

   export const metadata: Metadata = buildOgMetadata({
     title: 'Page Title · Kylrix',
     description: 'Concise description under 160 characters.',
     imageUrl: 'https://www.kylrix.space/<path>/opengraph-image',
   });
   ```

2. **`opengraph-image.tsx`**:
   ```typescript
   import { ImageResponse } from 'next/og';
   import { renderKylrixShareCard } from '@/lib/og/share-card';

   export const runtime = 'nodejs';
   export const size = { width: 1200, height: 630 };
   export const contentType = 'image/png';
   export const alt = 'Preview Card Title';

   export default async function Image() {
     return new ImageResponse(
       renderKylrixShareCard({
         productLabel: 'Kylrix Sovereignty',
         eyebrow: 'Section Eyebrow',
         title: 'Bold Title',
         description: 'One-liner summary.',
         accent: 'rose',
         ownerLabel: 'Shared by',
         ownerName: 'Kylrix',
         chips: ['Tag 1', 'Tag 2'],
       }),
       size
     );
   }
   ```
