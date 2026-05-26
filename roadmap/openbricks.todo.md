# Openbricks 2.0 Dark-Mode UI/UX Roadmap 🧱

This roadmap outlines the milestones, aesthetic principles, and implementation tasks required to establish **Openbricks 2.0** as the primary design language of Kylrix. 

The focus of Openbricks 2.0 is an extremely opinionated, dark-mode-only interface that prioritizes ruthless utility optimization while delivering a warm, cozy, techy-nerdy "digital sanctuary" atmosphere. Pure `#000000` pitch black is the constant background everywhere and anywhere.

---

## 🖤 1. The Void Foundation & Opaque Chromatic Stack

- [ ] **Enforce Level 0 Canvas**:
  - Map `html, body, #__next` backgrounds to pure pitch black (`#000000` / The Void) constantly across all viewpoints.
  - Purge all translucent overlays, translucent drawer backdrops, and gradient backgrounds.
- [ ] **Implement Solid Nesting Depth**:
  - Establish the Opaque Chromatic Stack rules for page layouts and component wrappers:
    - **Level 1 (The Bedrock)**: `#0A0908` (Deep container panels, card wells, dividers).
    - **Level 2 (The Chrome)**: `#141211` (Drawers, modals, primary cards).
    - **Level 3 (The Focus)**: `#1E1B19` (Hover fills, selection states, active items).
- [ ] **Global Overlays Unmounting**:
  - Strictly enforce the Global Unmount Policy (`{isOpen && <Overlay />}`) for all drawers, modals, and dropdown overlays to eliminate DOM stacking collisions and unclickable viewport shields.

---

## 📐 2. The Volcanic Hairline Rule & Tactile Physics

- [ ] **Enforce the Volcanic Slate (#23211F) Hairline Token**:
  - Eliminate all generic grey borders (`#2E2E2E`, `#333333`, `#444444`) and harsh whites.
  - Set `#23211F` (Volcanic Slate / Carbon Hairline) as the absolute single source of truth for all outlines, dividers, and modular card boundaries.
- [ ] **Construct hard-offset Solid Shadows**:
  - Wipe out all blurry CSS box-shadows and fuzzy drop-shadows.
  - Implement solid, skeuomorphic, machine-milled offset bevel shadow stacks on interactive surfaces (e.g. Buttons, Inputs, Cards):
    ```tsx
    // Tactile Shadow Stack Anchor
    <Paper sx={{
      border: '2px solid #9B9691',
      boxShadow: '1px 1px 0px #23211F, 2px 2px 0px #1E1B19, 3px 3px 0px #161412, 4px 4px 0px #0A0908, 5px 5px 0px #000000'
    }}>
      Tactile Obsidian Container
    </Paper>
    ```
- [ ] **Specular Highlights & Material Inertia**:
  - Add highly saturated specular highlights (1px solid bright accents) on active panels to simulate sharp directional lighting reflections.
  - Configure inertia-based bezier micro-animations (`transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`) mimicking heavy mechanical keys.

---

## 🔠 3. Brutalist Typography & Brutal Interactive Focus

- [ ] **Establish Font Families**:
  - Set **`Outfit`** (`var(--font-outfit)`) for high-character, rounded geometric weights in headers and titles.
  - Set **`Satoshi`** (`var(--font-satoshi)`) as the body copy standard for clean, ultra-readable geometric sans-serif layouts.
  - Set **`JetBrains Mono`** (`var(--font-mono)`) for metadata labels, system actions, and table row parameters.
- [ ] **High-Character Space Grotesk Focus**:
  - Apply **`Space Grotesk`** (`var(--font-space-grotesk)`) for all text fields, select tags, and active inputs. 
  - Ensure typing on table rows and textboxes triggers monoline brutalist curves, instantly turning passive fields into high-density interactive environments.

---

## 🎛️ 4. Ruthless Utility Optimization (Techy-Nerdy Ambience)

- [ ] **High-Density Layout Refactorings**:
  - Reduce redundant paddings and margins to maximize data density across dashboard views.
  - Implement cozy dividers (`border-bottom: 2px solid #23211F`) separating table rows.
- [ ] **Cozy Terminal HUD Indicators**:
  - Build compact status panels mimicking server CLI outputs to report system metrics, sync updates, and cryptographic status in real time.
