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
 
- **Page & Canvas Pitch Black (`#000000` STRICT)**:
  - Page, overlay root backdrop, and app canvas must strictly use pure `#000000` (pitch black). Never substitute false pitch blacks (like `#0A0908` or `#12100E`) as canvas backgrounds.
- **Single Unified Surface Fill (`#161412`)**:
  - Primary panels, cards, header chrome, and drawers adopt the continuous `#161412` OpenBricks deep ash background.
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
- **Mobile Icons-Only Actions**:
  - On mobile viewports, prefer icons only instead of icon + text for action buttons, tabs, and triggers (except where there is abundant screen space). Use `hidden sm:inline` on labels with descriptive `title` and `aria-label` tags.
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
- **Fixed 60% Height Mandate (Mobile)**:
  - Bottom drawers must default to a **fixed 60% viewport height** (`60vh` / `60dvh`).
  - 🚫 **Negative Feature (Strictly Prohibited)**: Varying or auto-calculating drawer height based on changing child content. Auto-collapsing heights cause visual jitter, layout thrash, and jumping interaction targets.
- **Desktop Sidebar Translation Principle (STRICT)**:
  - On desktop, bottom drawers and fullscreen details/drawers **translate cleanly to the native right sidebar** (`NativeSidebarMount` or right `Drawer`, opaque `#161412`, width 420px–560px, `borderLeft: 1px solid rgba(255, 255, 255, 0.06)`).
  - Never render edge-to-edge floating sheets, bottom sheets, or disconnected modals on desktop viewports. The right sidebar provides a stable, tactile surface that preserves the pitch-black `#000000` canvas and leaves primary navigation unobstructed.
- **High-Contrast Surface Layering**:
  - **Outer Drawer Shell / Sidebar**: Signature opaque ash background (`#161412`) to contrast against the standard pitch-black app canvas (`#000000` / `#050505`).
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

## 11. Multi-Item Catalogs & Interactive Action Tiles (Canonical Standard)

### 💡 General Rule of Thumb:
- **Mandatory for Scalable & User-Generated Lists**: Always use this layout for user-generated collections (where a user could theoretically create 10, 50, or 100+ items) and multi-member internal lists (e.g. system agents catalog).
- **Anti-Packing Bottom Drawer Pattern**: Instead of cramming full details, nested controls, or massive forms onto the page, each compact tile acts as a high-contrast gateway that opens into a dedicated bottom drawer (`60dvh`) upon click. This prevents pages from becoming crowded while keeping navigation lightning-fast.
- **Default Card Blueprint**: This is the official canonical card blueprint across the entire product.

### 🚫 When NOT to Use Catalog Action Tiles (Strict Exclusions):
- **Messenger / chat lists** (Hangouts, DMs, Telegram/WhatsApp-style threads): Use flat conversation rows — avatar, name, preview, timestamp. **No** hairline bottom CTA footers (`Open chat`, `Tap to select` as a tile footer). The row itself is the tap target.
- **Notification / activity feeds**, **search result rows**, **picker lists** (single-tap selection): Same — compact rows, not gateway cards.
- **Catalog tiles are for “open another surface”** (agent catalog, workspace picker, settings hub, create flows). If tapping the row **is** the action (open chat, select item), use a **row**, not a card with a separated action footer.
- **Never label a direct chat** with the stored placeholder `Direct Chat` when a peer identity exists — resolve the display name from the other participant (identity cache / profile).

```tsx
<div
  onClick={handleOpenDrawer}
  className="p-4 bg-[#161412] border border-white/10 hover:border-[var(--accent)]/40 hover:bg-[#1C1A18] rounded-[22px] shadow-xl flex flex-col justify-between gap-3 transition-all cursor-pointer group"
>
  {/* Top: Inset Icon Well + Title + Subtitle + Optional Badge */}
  <div className="flex items-center gap-3 min-w-0">
    <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-lg shrink-0 border border-[var(--accent)]/20">
      <Icon size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5 flex-wrap">
        <h4 className="text-white font-bold text-xs font-clash m-0 truncate group-hover:text-[var(--accent)] transition-colors">
          {item.name}
        </h4>
        {item.isBadge && (
          <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-[var(--accent)]/15 text-[var(--accent)] font-bold border border-[var(--accent)]/20">
            {item.badge}
          </span>
        )}
      </div>
      <p className="text-white/40 text-[11px] m-0 mt-0.5 truncate">{item.description}</p>
    </div>
  </div>

  {/* Bottom: Crisp Hairline Divider + Action CTA + Chevron */}
  <div className="flex items-center justify-between text-[11px] font-mono text-[var(--accent)] border-t border-white/10 pt-2">
    <span>{actionLabel}</span>
    <ChevronRight size={12} />
  </div>
</div>
```

### Key Architectural Mandates for Multi-Item Tiles:
1. **Responsive Fluid Grids**: Layout cards in `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5` (or `lg:grid-cols-4` for compact catalog rows, and `sm:grid-cols-3` for 3-item utility rows).
2. **Generous Corner Radii**: Always use `rounded-[22px]`.
3. **High-Contrast Crisp Outlines**: Opaque signature ash base (`#161412`), crisp 1px boundary (`border-white/10`), and illuminated accent hover (`hover:border-[var(--accent)]/40 hover:bg-[#1C1A18]`).
4. **Separated Action Footers**: A crisp hairline top divider (`border-t border-white/10 pt-2`) anchoring the action label and `ChevronRight` at the bottom of each tile for consistent visual balance.

---

## Summary Checklist for OpenBricks 4.0 Upgrades

| Feature | Old (SaaS-y / Clunky) | OpenBricks 4.0 (Tactile & Clean) |
|---|---|---|
| **Multi-Item Cards** | Inconsistent padding / random heights | Standardized `rounded-[22px]` tiles with hairline bottom CTAs — **not** for chat/messenger lists (use flat rows) |
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
