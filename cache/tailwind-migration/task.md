# Tailwind Migration

## Goal

Remove MUI from the app and finish the Tailwind/Openbricks migration without changing user-facing behavior.

## Current state

- Recent commits added a Tailwind/MUI bridge in `lib/mui-tailwind/*`.
- `app/globals.css` now carries Tailwind tokens and the dark surface palette.
- MUI still remains in many screens, shared components, and helpers.

## Scope

- Replace MUI usage with Tailwind classes and lightweight local primitives.
- Keep layout, interactions, and copy stable while changing implementation details.
- Remove MUI and its bridge dependencies once no code path relies on them.

## Working notes

- Last two commits changed: `app/globals.css`, `lib/mui-tailwind/*`, `postcss.config.js`, `package.json`, and `pnpm-lock.yaml`.
- The bridge currently mimics MUI primitives, so migration should focus on replacing callers first, then deleting the bridge.
- User-visible copy should stay plain and Openbricks-aligned.
