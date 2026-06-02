# ui.skeleton-philosophy

## Description
Enforces the philosophy that skeleton screens must never be disjointed, new components. The skeleton is simply the actual page component itself, rendered instantly, just without data.

## Context
When building loading states, never create abstract "Skeleton" components made of arbitrary boxes, shapes, or pulses that don't match the actual UI. A skeleton is NOT a separate system. Do not use generic `<Skeleton />` blocks that replace real UI elements (like logos, sidebars, or exact page layouts).

## Instructions
- **Never create a disjointed skeleton:** If a page is loading, render the actual page component.
- **Data is secondary:** Pass empty strings, empty arrays, or `null` for the data while loading, but the structural HTML/CSS (the shell, the containers, the borders, the real components) MUST be exactly the same as the fully loaded state.
- **No generic loading shapes:** Do not use `react-loading-skeleton`, Material UI `<Skeleton />`, or random bluish pulsing divs.
- **Instant visual parity:** The user should immediately see the application exactly as it will look, just missing the text/data payloads.
- **Avoid global `loading.tsx` takeovers:** Next.js `loading.tsx` files should not swap out the entire layout for a generic spinner or pulse if it breaks visual continuity. Let the layout render and handle data fetching gracefully.
