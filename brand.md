# Brand — Kylrix

_Status: active_

## Openbricks 2.0 Core

This product is dark-only and follows Openbricks 2.0:

- Topbar-first command rails
- Drawer-first interaction model
- Pitch-black shell + deep-ash active surfaces
- Layered contrast through borders and nested depth

## Token Baseline

### Core surfaces

- `--ob-shell`: `#0A0908`
- `--ob-surface`: `#161412`
- `--ob-surface-alt`: `#1C1917`
- `--ob-border`: `rgba(255,255,255,0.08)`
- `--ob-border-soft`: `rgba(255,255,255,0.05)`

### Text

- `--ob-text-primary`: `#F5F2ED`
- `--ob-text-muted`: `rgba(245,242,237,0.68)`

### Accent families

- `--ob-accent-connect`: `#F59E0B`
- `--ob-accent-primary`: `#6366F1`
- `--ob-accent-danger`: `#FF4D4D`

## Typography

- Headline/display: Clash family
- Body/UI text: Satoshi/system sans fallback
- Technical metadata and compact identity fragments: mono family

## Chrome Rules

- No transparent product chrome.
- No white or pure black panel backgrounds for core app surfaces.
- Topbar and bottom nav must use deep-ash surfaces with visible but soft borders.
- Mobile app icon rail should prioritize icon-only compact headers where intended.

## Interaction Rules

- Mobile-first drawers use bottom anchoring for primary actions where context is page-local.
- Desktop-first drawers use side anchoring for expanded command/navigation surfaces.
- Overlays must unmount when closed and never leave invisible click-blocking backdrops.

## Migration Note

This file is now the active source of truth for Openbricks 2.0 migration and should be kept synchronized with shared UI primitives and shell chrome.
