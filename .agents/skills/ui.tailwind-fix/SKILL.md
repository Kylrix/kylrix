---
name: ui.tailwind-fix
description: Row and card text layout fixes after Tailwind v4 + MUI-shim migration. Use when list rows, cards, or drawer items have clipped text, crushed line-height, or copy touching container edges. Pattern derived from ConnectTopbar Contextual Quick Actions.
---

# ui.tailwind-fix

## When to use

Apply this skill when fixing UI that uses `@/lib/mui-tailwind/material` (`Box`, `Typography`, `Paper`, `Stack`) and text looks like thin slivers, overlaps, or sits flush against borders—especially after the Tailwind v4 migration.

Pair with `ui.tailwind-v4` for token/config rules; this skill is **layout and typography structure only**.

## Root causes (post-migration)

1. **`lineHeight` as a number in `sx`** must stay unitless (e.g. `1.35`). The shim must not convert it to `px` (substring match on `"height"` breaks `lineHeight`).
2. **Default `<p>` margins** on `Typography` without `component="span"` stack and crush multi-line blocks.
3. **`Paper` default `p-4` class** fights `sx` padding unless `sx` defines `p` / `px` / `py`.
4. **Absolute children** (dots, dismiss buttons) without reserved space force `pl`/`pr` hacks and collide with title rows.
5. **Title + meta on one row** without a dedicated text column causes horizontal squeeze.

## The reference pattern: Contextual Quick Actions

Each row is a single interactive surface with a **flat flex row** and a **stacked text column**. No absolute overlays on the text area.

### Required structure

```tsx
<Box
  component="button"
  sx={{
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    px: 2.25,
    py: 1.5,
    borderRadius: '18px',
    textAlign: 'left',
    // surface styles…
  }}
>
  {/* 1. Fixed icon slot */}
  <Box
    sx={{
      width: 38,
      height: 38,
      borderRadius: '12px',
      display: 'grid',
      placeItems: 'center',
      flexShrink: 0,
    }}
  >
    {icon}
  </Box>

  {/* 2. Stacked copy column */}
  <Box
    sx={{
      minWidth: 0,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 0.35,
      pr: 0.5,
    }}
  >
    <Typography
      component="span"
      sx={{ fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.25 }}
      noWrap
    >
      {title}
    </Typography>
    <Typography
      component="span"
      sx={{
        color: 'rgba(255,255,255,0.66)',
        fontWeight: 600,
        fontSize: '0.76rem',
        lineHeight: 1.35,
      }}
    >
      {description}
    </Typography>
  </Box>
</Box>
```

### Checklist (every list row / card header)

| Rule | Do | Don't |
|------|----|-------|
| Container | `display: 'flex'`, `alignItems: 'center'` (or `flex-start` for tall cards) | `position: 'relative'` + absolute text |
| Padding | Explicit `px: 2.25`, `py: 1.5` (or `p: 3` on cards) | Bare `p: 2` with overlays |
| Icon | Fixed `width`/`height`, `flexShrink: 0` | Icon in same flex row as title+timestamp |
| Text block | `minWidth: 0`, `flex: 1`, `flexDirection: 'column'`, `gap: 0.35`–`0.75` | Title and subtitle on one horizontal row |
| Typography | `component="span"`, unitless `lineHeight` (1.2–1.55) | Default `<p>` / omitted `lineHeight` |
| Secondary line | Its own `Typography` below title | `noWrap` on both lines unless intentional |
| Actions | Separate column `flexShrink: 0` or footer row | `position: 'absolute'` over copy |

### Cards (templates, projects)

Extend the same pattern:

1. **Header row**: icon + text column (title, then summary/meta).
2. **Body**: only if needed; keep in the column with `lineHeight: 1.5+`.
3. **Footer**: `mt: 'auto'`, own row—do not overlap the text column.
4. **Badges**: prefer inline in the title row or top padding; avoid absolute unless `pr` reserves space.

### Shim reminders

- `CardContent` / `CardHeader` must pass `sx` through; titles that are React elements must not be wrapped in extra `text-sm` divs.
- Spacing tokens in `sx`: `p: 2` → 16px; `gap: 0.35` → ~2.8px—use `gap: 0.5` or higher for readable separation between title and description.

## Anti-pattern: Diagnostics-style alerts

```tsx
// BAD: relative card, absolute dismiss, title + time on one row
<Box sx={{ position: 'relative', p: 2 }}>
  <IconButton sx={{ position: 'absolute', top: 10, right: 10 }} />
  <Box sx={{ pr: 4 }}>
    <Box sx={{ display: 'flex' }}>
      <Typography>{title}</Typography>
      <Typography>{time}</Typography>
    </Box>
    <Typography>{message}</Typography>
  </Box>
</Box>
```

Refactor to: dismiss in a right `flexShrink: 0` column, title/time stacked or time on its own line, message in the text column with `gap`.

## Verification

After edits, confirm in DevTools:

- Computed `line-height` is unitless (~1.25–1.55), not `1.25px`.
- `margin` on title/description nodes is `0`.
- Padding on the interactive surface is ≥ 12px vertical, ≥ 16px horizontal.
