---
name: brand.openbricks-4.0
description: Core principles, tactile patterns, and anti-SaaS upgrade rules for OpenBricks 4.0. Use when designing or upgrading drawers, overlays, action panels, and input surfaces.
---

# OpenBricks 4.0 Design System & Tactile Patterns

OpenBricks 4.0 evolves the Kylrix design language from rigid, corporate SaaS conventions into a fast, tactile, layman-friendly productivity surface.

---

## 1. Anti-SaaS Philosophy & Layman Tactile Experience

### ❌ What makes UI look "shitty" & enterprise-SaaS-y:
1. **Nested Sub-Modal Hell**: Opening a bottom drawer that opens another bottom drawer/modal just to pick "Public" vs "Private".
2. **Enterprise Wizard Jargon**: Multi-step step-bars (`"Step 1: Link Context"`, `"Step 2: Finalize Workspace"`, `"Advanced Access Control"`, `"Anonymous Guest View"`).
3. **Verbose Explanatory Paragraphs**: Long descriptive blocks explaining obvious toggles.
4. **Bloated Material Textfield Wrappers**: Default thick outline focus borders and floating labels.

### ✅ OpenBricks 4.0 Standard:
1. **Flat, Inline Tactile Controls**: Replace sub-modals with inline segmented pill controls (e.g. `Public` / `Private` switch directly inside the form).
2. **Crisp, Layman Labels**: Use direct, natural language: `"Workspace Name"` → `"Name"`, `"Summary / Purpose"` → `"Description (Optional)"`, `"Access Level"` → `"Access"`.
3. **Single-Action Workflows**: Keep creation snappy. Default to 1-page flows unless complex dependency resolution is strictly necessary.

---

## 2. Surfaces & Unified Color Architecture

- **Single Unified Surface Fill (`#161412`)**:
  - The drawer body, header, and footer share a continuous ash background.
  - Never split a panel into awkward two-tone slabs (e.g. ash header with pitch-black body sharing one outer border).
- **Tactile Inset Child Wells (`#0A0908`)**:
  - Nest interactive child blocks inside `#0A0908` with subtle hairline borders (`rgba(255, 255, 255, 0.08)`).
  - Use generous radii (`rounded-2xl` / `16px`–`20px`).
- **Dark Inset Inputs**:
  - Native `<input>` / `<textarea>` elements styled with:
    ```tsx
    bgcolor: '#0A0908',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '16px',
    px: 2,
    py: 1.5,
    color: '#fff',
    '&:focus': { borderColor: '#6366F1' },
    '&::placeholder': { color: 'rgba(255, 255, 255, 0.25)' }
    ```

---

## 3. Container Insets & Edge Hugging (`ui.tailwind-fix`)

- **Prevent Double-Padding Squish**:
  - Outer `Drawer` / `Paper` wrappers should own outer gutters (`px: 2.25`, `py: 2`), while inner Paper cards should reset extra default padding (`p: 0` or controlled `p: 2`).
- **Generous Internal Padding on Child Tiles**:
  - Identity & resource tiles: `px: 2.25, py: 1.75`–`2`.
  - Inset link containers / URL boxes: `px: 1.75, py: 1.25` with `borderRadius: '14px'`.
  - Buttons: `px: 2, py: 1.25`, `minHeight: 44px`–`46px`.
- **Stacked Copy Columns**:
  - Wrap multi-line text blocks in a dedicated flex column:
    ```tsx
    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.5, pr: 0.5 }}>
      <Typography component="span" sx={{ fontWeight: 900, lineHeight: 1.25 }} noWrap>...</Typography>
      <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.35 }} noWrap>...</Typography>
    </Box>
    ```

---

## 4. Anti-Overflow & Horizontal Containment

- **Strict Ellipsis Truncation**:
  - Every flex container holding text must have `minWidth: 0` and `overflow: 'hidden'`.
  - Every single-line text element must have `noWrap`, `textOverflow: 'ellipsis'`, and `component="span"`.
- **No Side-to-Side Drag on Mobile**:
  - Apply `maxWidth: '100%'`, `boxSizing: 'border-box'`, and `overflowX: 'hidden'` across all drawer panels and drop-downs.

---

## 5. Dynamic 1-Line Grouping & Dismiss Actions

- **Eliminate Single-Pill Full-Width Wastage**:
  - If two complementary actions exist (e.g. `GitHub` + `Discord`, `Wallet` + `Settings`), group them into a dynamic 2-column grid (`grid grid-cols-2 gap-1.25`) with centered labels.
- **Top Dismiss Action**:
  - Always place a compact, circular close button (`✕`, `30px`–`32px`, `rounded-full`, `bg-white/[0.05]`) at the top right of panels so mobile users can immediately dismiss without relying solely on drag gestures.

---

## 6. Thin Outline Depth & Form Definition

- **Formalized Outer Boundaries**:
  - All drawers (top and bottom), sidebars, and dropdown panels must feature a crisp, thin 1px outline to give a clean sense of form and depth:
    - Inner panel card outline: `border: 1px solid alpha(appAccent, 0.22)` or `border: 1px solid rgba(255, 255, 255, 0.08)`.
    - Mobile top drawer / panel: `borderBottom: '1px solid rgba(255, 255, 255, 0.08)'`, `borderRadius: '0 0 28px 28px'`.
    - Mobile bottom drawer: `borderTop: '1px solid rgba(255, 255, 255, 0.08)'`, `borderRadius: '28px 28px 0 0'`.
    - Desktop right sidebar: `borderLeft: '1px solid rgba(255, 255, 255, 0.06)'`.
    - Desktop left sidebar: `borderRight: '1px solid rgba(255, 255, 255, 0.06)'`.
- **Purpose**: Establishes unambiguous structural contouring and tactile form definition across opaque ash surfaces without blurry glassmorphism or translucent haze.

---

## 7. Drawer Architecture & Contrast Hierarchy

- **Deprecated Drag Handles**:
  - Rounded pill drag handles (`<div className="w-10 h-1 rounded-full bg-white/20" />`) are deprecated and removed.
  - The thin 1px outline boundary (`borderTop: 1px solid rgba(255,255,255,0.08)`) defines the surface edge.
- **Fixed 60% Height Mandate**:
  - Bottom drawers must default to a **fixed 60% viewport height** (`60vh` / `60dvh`).
  - 🚫 **Negative Feature (Strictly Prohibited)**: Varying or auto-calculating drawer height based on changing child content. Auto-collapsing heights cause visual jitter, layout thrash, and jumping interaction targets.
- **High-Contrast Surface Layering**:
  - **Outer Drawer Shell**: Signature opaque ash background (`#161412`) to contrast against the standard pitch-black app canvas (`#000000` / `#050505`).
  - **Inner Interactive Components**: Pitch-black wells (`#0A0908` / `#0B0A09`) for cards, text fields, radio buttons, and inputs to create crisp, legible contrast.

---

## 8. Standardized Action Icons Order

Drawer top action bars must follow a strict 3-slot button order:
1. **Pop Out** (Optional, only for resources with a dedicated standalone URL): Navigates to `/form/[id]`, `/note/[id]`, etc. (`ArrowUpRight` / `ExternalLink`).
2. **Expand / Contract** (Dynamic): Toggles between the default **60vh** height and **100vh** full-screen view (`Maximize2` when at 60vh, `Minimize2` when expanded).
3. **Dismiss / Cancel / Done**: Closes the drawer (`X` icon or `Done` action button based on context).

---

## 9. Fixed Non-Scrolling Action Footers

- **Permanent Visibility for State Mutations**:
  - All state-changing or workflow-completion triggers (`Done`, `Next`, `Submit`, `Create`, `Save`, `Confirm`) must be pinned in a **fixed bottom action bar** (`shrink-0 border-t border-white/5 bg-[#161412] px-5 py-3 md:py-3.5`).
- **Zero Scroll Reliance for Action**:
  - 🚫 **Negative Feature (Strictly Prohibited)**: Placing primary action buttons inside the scrollable content container where users must scroll through questions or text to reach them.
  - The content area (`flex-1 overflow-y-auto`) scrolls independently while the action footer remains pinned and immediately clickable at all times.

## 10. Top Bar Back Button Placement & Real Estate Optimization

- **Leading Top Bar Back Control**:
  - In multi-step flows, wizard states, or sub-view transitions (e.g., `currentStep > 0`, `isCreatingKey`, sub-page drilling), place the **Back button** (`ArrowLeft` / `ChevronLeft`) on the **leading (left) side of the top header bar**, on the exact same horizontal row as the trailing control icons (`Pop Out`, `Expand/Contract`, `Dismiss`).
- **Thin Minimalist Header Layer**:
  - Keep the top controls bar slim (`px-4 py-2.5` / `px-5 py-3 shrink-0`) placed directly above titles and content. It must never eat into body content real estate.
- **Conditional & Conspicuous**:
  - The Back button displays conditionally only when backward navigation is possible, with conspicuous high-contrast styling (`text-white/70 hover:text-white`).
- **Footer Real Estate Preservation**:
  - Placing the Back button in the top bar relieves the bottom fixed action bar from splitting space, giving 100% of the footer width to the primary forward action button (`Next`, `Submit`, `Generate Key`, `Mint Agent`).

---

## Summary Checklist for OpenBricks 4.0 Upgrades

| Feature | Old (SaaS-y / Clunky) | OpenBricks 4.0 (Tactile & Clean) |
|---|---|---|
| **Access Picker** | Sub-drawer popup inside bottom drawer | Inline segmented toggle (`Public` / `Private`) |
| **Drawer Height** | Dynamic / content-based varying height | Fixed 60% viewport height (`60dvh`) |
| **Drag Handles** | Centered floating pill drag handles | Thin 1px outline edge (`rgba(255,255,255,0.08)`) |
| **Back Button** | Crammed in bottom footer next to CTA | Leading top controls bar (`ArrowLeft` above title) |
| **Action Buttons** | Embedded in scroll container (needs scroll) | Fixed pinned bottom footer (`shrink-0 bg-[#161412]`) |
| **Surfaces** | Translucent blur or inconsistent blacks | Signature ash shell (`#161412`) + pitch-black wells (`#0A0908`) |
| **Top Action Icons** | Randomly placed / missing buttons | Standardized: `Pop Out` → `Expand/Contract` → `Dismiss/Done` |
| **Inputs** | MUI Textfield with thick floating borders | Inset `#0A0908` dark fields with subtle focus rings |
| **Outlines** | Missing borders / blurry translucent gradients | Crisp 1px thin outline (`alpha(accent, 0.22)` or `white/0.08`) |
| **CTA Rows** | Full-width single buttons stacked vertically | Dynamic 2-column compact grid for complementary CTAs |
| **Copy Tone** | Corporate wizard steps & jargon | Plain English, crisp, action-oriented labels |
| **Text Overflow** | Text pushing container outside viewport | Strict `minWidth: 0` + `textOverflow: 'ellipsis'` |
