# ui.tailwind-v4

## Description
Strict rules for generating Tailwind CSS v4 code. Prevents legacy v3 hallucinations and enforces a CSS-first configuration model.

## Context
Tailwind CSS v4 is a major evolution that moves configuration from JavaScript (`tailwind.config.js`) into CSS using native variables and new at-rules. It uses a high-performance engine (Oxide) for lightning-fast builds and automatic content detection.

## Instructions

### 1. Configuration & Setup
- **No JS/TS Config:** NEVER generate a `tailwind.config.js` or `.ts` file unless explicitly requested with a legacy override.
- **CSS-First Theme:** Theme customization must happen exclusively in the main CSS file using the `@theme` directive.
- **Entry Point:** Use the single-line entry point `@import "tailwindcss";` instead of the old three `@tailwind` directives.

### 2. Design Tokens (@theme)
- Define all design tokens (colors, spacing, fonts, breakpoints) within the `@theme` block.
- **Variable Syntax:** Use the `--color-*`, `--spacing-*`, `--font-*` naming conventions.
  ```css
  @theme {
    --color-primary: #6366f1;
    --font-sans: "Inter", sans-serif;
  }
  ```

### 3. Class Usage & Syntax
- **BANNED Classes:** DO NOT use legacy opacity utilities: `bg-opacity-*`, `text-opacity-*`, `ring-opacity-*`, `border-opacity-*`.
- **Slash Modifier:** ALWAYS use the slash modifier syntax for opacity (e.g., `bg-black/50`, `text-primary/10`).
- **Gradients:** Use `bg-linear-to-r` instead of the legacy `bg-gradient-to-r`.
- **Borders:** Remember that `border` now defaults to `currentColor` rather than a default gray.

### 4. Directives (@source, @plugin)
- **Content Detection:** v4 automatically detects content. Use `@source` only for explicit inclusions/exclusions.
- **Plugins:** Load JavaScript plugins directly in CSS using `@plugin`.
  ```css
  @plugin "@tailwindcss/typography";
  ```

### 5. Parity & Best Practices
- **Scale Changes:** The default spacing, shadow, and rounded scales have changed in v4; ensure visual parity checks are made when migrating components.
- **Native CSS:** Leverage native CSS features (logical properties, container queries) which v4 supports deeply.
- **Oxide engine:** Respect build performance by narrowing `@source` globs if the project size is massive.
