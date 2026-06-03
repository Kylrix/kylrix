---
name: tailwind-fix-v2
description: Advanced techniques for migrating heavy MUI interactive widgets (Drawers, Menus, Grid, Slider) to native Tailwind CSS. Includes implementing unmount policies, backdrop click-aways, custom context menus, slider replacements, and page margin overrides.
---

# tailwind-fix-v2 (MUI to Tailwind Migration - Phase II)

## When to use

Use this skill when refactoring pages/components to completely remove MUI (`@/lib/mui-tailwind/material` dependencies) and transition to pure Tailwind CSS + React. It specializes in interactive elements (drawers, sliders, grids, and context menus) where layouts need to remain premium, clean, and highly performant.

---

## 🏗️ 1. Drawer/Modal Removal (The Slide-up Sheet Pattern)

Instead of relying on MUI `<Drawer>` components, use standard Tailwind blocks triggered by React conditional rendering.

### The Rule
Always prefer conditional rendering (`{isOpen && <Drawer onClose={...} />}`) rather than visibility props (`<Drawer open={isOpen} />`). This physically mounts and unmounts the drawer and its backdrop from the DOM, ensuring hidden overlays never block clicks or freeze screen interactivity.

### Implementation Pattern

```tsx
interface CustomDrawerProps {
  onClose: () => void;
  children: React.ReactNode;
}

export function CustomDrawer({ onClose, children }: CustomDrawerProps) {
  return (
    <>
      {/* 1. Backdrop (Closes on Click) */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ease-in-out cursor-default"
        onClick={onClose}
      />
      
      {/* 2. Slide-up Panel Container */}
      <div className="fixed bottom-0 left-0 right-0 max-h-[85vh] md:max-h-[60vh] bg-[#161412] border-t border-white/8 rounded-t-[28px] z-[100] text-white p-6 md:p-8 flex flex-col gap-6 animate-slide-up overflow-y-auto">
        {/* Decorative drag handle bar */}
        <div className="w-10 h-1 bg-white/12 rounded-[2px] mx-auto mb-2 flex-shrink-0" />
        
        {/* Header container */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-white text-lg font-black tracking-tight leading-tight">Title</h3>
            <p className="text-white/40 text-[11px] font-bold mt-1">Subtitle description</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white bg-white/2 hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="flex flex-col gap-4">
          {children}
        </div>
      </div>
    </>
  );
}
```

---

## 🖱️ 2. Absolute Context Menus with Backdrops

When implementing custom dropdowns (like list row actions, tab options, or context menus), avoid MUI `<Menu>` which depends heavily on anchor coordinates.

### The Rule
Create an absolute-positioned React fragment submenu accompanied by a full-screen click-away backdrop:

```tsx
{menuAnchor && (
  <>
    {/* Fullscreen Backdrop to catch click-outside */}
    <div 
      className="fixed inset-0 z-50 cursor-default" 
      onClick={() => setMenuAnchor(null)} 
    />
    {/* Floating Actions Submenu */}
    <div 
      className="fixed z-[100] bg-[#161412] border border-white/8 rounded-[16px] min-w-[240px] shadow-2xl p-4 flex flex-col gap-2 cursor-default select-none animate-scale-in"
      style={{ top: menuAnchor.y, left: menuAnchor.x }}
    >
      <button
        onClick={() => {
          performAction();
          setMenuAnchor(null);
        }}
        className="w-full text-left font-bold rounded-lg text-white/80 hover:text-white hover:bg-white/4 px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
      >
        <Icon size={16} />
        <span>Action Option</span>
      </button>
    </div>
  </>
)}
```

---

## 🎚️ 3. Slider Replacement (Standard Input Range)

MUI `<Slider>` can be cleanly replaced using the HTML5 native `<input type="range" />` styled with Tailwind.

### Implementation Pattern

```tsx
<input
  type="range"
  min={1}
  max={24}
  value={months}
  onChange={(e) => setMonths(Number(e.target.value))}
  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#6366F1] focus:outline-none"
/>
```
- **`accent-[#6366F1]`**: Sets the theme colors for the slider thumb and active track automatically.
- **`appearance-none` & `bg-white/10`**: Provides custom aesthetic baseline styles.

---

## 📏 4. Dynamic Page Margin Override

On sub-pages or details pages where the primary sidebar is hidden (`showLeftSidebar = false`), standard page wrappers may look too empty or leave excessively wide margins.

### The Rule
Dynamically detect the sub-page path in `GlobalShell` and adjust page padding margins by half to keep content hugging clean layout bounds:

```tsx
// 1. Path detection
const isProjectDetailPage = useMemo(() => Boolean(pathname?.match(/^\/projects\/[^/]+$/)), [pathname]);

// 2. Conditional styling on the main viewport element
<Box
  component="main"
  sx={{
    px: isProjectDetailPage ? { xs: 1, sm: 1, md: 2 } : { xs: 2, sm: 2, md: 4 },
    pl: isProjectDetailPage ? { xs: 1, sm: 1, md: 2 } : { xs: 2, sm: 2, md: showLeftSidebar ? 'calc(80px + 32px)' : 4 },
    maxWidth: 1600,
    mx: 'auto',
  }}
>
  {children}
</Box>
```

---

## 🔠 5. Safe Text Truncation boundaries

When displaying metadata rows inside flexible list cards or grids, text truncation can fail if containing blocks grow beyond safe widths.

### The Rule
Ensure you use the combo `min-w-0 flex-1` on intermediate elements. This forces CSS to properly calculate width bounds so that children with `truncate` or `ellipsis` wrap cleanly instead of bleeding right.

```tsx
<div className="flex items-center gap-4 min-w-0 flex-1">
  <div className="flex-shrink-0">
    <Icon />
  </div>
  <div className="min-w-0 flex-1 flex flex-col gap-1">
    <span className="text-white font-extrabold text-sm truncate">
      {veryLongTitleHere}
    </span>
  </div>
</div>
```
