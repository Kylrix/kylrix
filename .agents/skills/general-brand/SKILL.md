---
name: general-brand
description: A dark-only brand language system for Kylrix-style products. Use to define or critique UI tone, spacing, chrome, accent color direction, and the openbricks system of pitch-black shells, deep-ash surfaces, topbars, drawers, and layered contrast.
disable-model-invocation: true
---

# general-brand

Use this skill when a product needs a brand language, not just a palette.

## The system

This is **scorched earth and brick wall** design language, also called **openbricks**.

It is:
- dark only
- opinionated
- mature
- chrome-light, content-heavy
- topbar-first
- drawer-first
- blur-aware
- contrast-by-layer, not contrast-by-color

It does **not** support light mode.
It does **not** use modals as a default pattern.
It does **not** rely on glassy, airy, or playful UI tropes.

## Core doctrine

1. **Pitch black is the stage.**
   Use near-black / pitch-black for app shells and full-bleed backgrounds.

2. **Deep ash is the primary surface.**
   Anything that directly sits on black should usually be deep ash, not mid-gray.

3. **Nested contrast is a feature.**
   A surface can invert against its immediate container when it improves focus, like the passkey list inside settings.

4. **Topbars are command rails.**
   They can hold extensions, actions, status, and shortcuts. Keep them dense, useful, and visually anchored.

5. **Drawers beat modals.**
   Prefer bottom drawers, top drawers, or side sheets for core flows. When a drawer is in focus, blur everything else beyond it.

6. **A focused surface should feel physically closer.**
   Use subtle blur, blur scrims, rim borders, and layered depth to make the active panel feel present.

## Surface hierarchy

Use a small stack of dark tones:
- **Pitch black** for the outer shell
- **Deep ash** for primary components
- **Inset ash / rim ash** for nested cards, lists, and technical sections
- **Softer ash** only for secondary separators and hover states

Avoid:
- flat charcoal everywhere
- random gray steps
- translucent chrome
- large glowing gradients

## MUI is the default layer

This system is a subset of MUI-first UI.

Use MUI primitives to express the brand:
- `Box` for layout and shells
- `Paper` for deep-ash surfaces
- `Drawer` for focused flows
- `AppBar` / topbar containers for command rails
- `IconButton`, `Button`, `Chip`, `Tabs`, `SpeedDial` for interactive chrome

Prefer MUI `sx` over ad hoc CSS when shaping brand surfaces.

```tsx
import { Box, Paper, Typography } from '@mui/material';

export function BrandShell({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: '#F5F2ED' }}>
      {children}
    </Box>
  );
}
```

```tsx
import { Box, Paper } from '@mui/material';

export function BrandCard({ children }: { children: React.ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: '#161412',
        border: '1px solid #1C1A18',
        borderRadius: '28px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
      }}
    >
      {children}
    </Paper>
  );
}
```

```tsx
import { Box, Drawer } from '@mui/material';

export function FocusDrawer({ open, onClose, children }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: '28px',
          borderTopRightRadius: '28px',
          bgcolor: '#161412',
          borderTop: '1px solid #1C1A18',
          backgroundImage: 'none',
        },
      }}
    >
      <Box sx={{ p: 3 }}>{children}</Box>
    </Drawer>
  );
}
```

```tsx
import { Box, Typography } from '@mui/material';

export function TopbarRail() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1.5,
        bgcolor: '#0A0908',
        borderBottom: '1px solid #1C1A18',
      }}
    >
      <Typography sx={{ fontWeight: 800 }}>Command rail</Typography>
    </Box>
  );
}
```

## The best examples

Use these as the brand’s role models:

### Settings

The settings experience shows the system at its best:
- the passkey section feels crafted, not generic
- border radii match the shape of the section
- the passkey list can invert against the parent panel while still feeling native
- icons are ultra-modern and precise
- the section reads as one object with internal structure

This is the key lesson: **deep ash on black is the baseline, but nested inversion is what makes the brand feel smart.**

### Live huddle / call link

The call surface is the other canonical example:
- black outer shell
- deep ash used with restraint
- the live video panel has a rim that makes it feel like a physical object
- the component pops without becoming flashy
- it feels solid, adult, and deliberate

This is the second lesson: **build depth with borders, rims, and placement, not decoration.**

## Accent color guidance

Do not hardcode a single brand color for every product.

Instead, suggest a **small family of dark-compatible primaries** based on the product’s vibe:

| Vibe | Suggested primary family |
|---|---|
| Technical, precise, ecosystem | indigo / electric blue / cyan |
| Premium, calm, modern | violet / orchid / muted lavender |
| Social, expressive, warm | rose / magenta / softened pink |
| Energetic, sharp, kinetic | amber / orange / ember |
| Lively, systems-oriented | teal / aqua / mint |
| Experimental, high-signal | lime / acid green, used sparingly |

Rules:
- keep the rest of the palette muted
- use one primary family at a time
- avoid rainbow systems
- avoid over-saturated neon unless the product truly wants it
- pick accents that breathe life into darkness without breaking the sober base

When asked for a primary, give **3-5 targeted suggestions**, not an infinite color dump.

## Chrome rules

- Prefer topbars over scattered floating controls
- Prefer extensions attached to the topbar over detached action clusters
- Prefer drawers over modals
- Prefer inline states over popups
- Prefer blur outside the active surface, not inside everything

## What to avoid

- light mode
- modal-first design
- glassmorphism as a default
- white backgrounds
- noisy gradients
- generic rounded-everything UI
- overly playful motion
- decorative icons that feel childish
- too many colors competing for attention

## Tone and voice

The language should feel:
- concise
- assured
- restrained
- technical when needed
- never cute unless the product explicitly wants that

Copy should sound like the interface knows what it is doing.

## How to apply this skill

When designing or reviewing UI:

1. Start from black shell + deep ash surfaces
2. Decide whether the key interaction belongs in the topbar or a drawer
3. Add nested contrast only where it clarifies hierarchy
4. Pick one primary accent family and keep the rest quiet
5. Use the settings passkey section and the huddle link view as the taste bar
6. Reject anything that weakens the dark-only system

## Short rule

If it does not feel like it was carved out of darkness, it is not openbricks.
