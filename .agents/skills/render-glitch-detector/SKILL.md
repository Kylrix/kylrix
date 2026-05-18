---
name: render-glitch-detector
description: Diagnose and fix React rendering glitches caused by real-time subscriptions, animation loops, and GPU-intensive operations. Detects infinite re-subscription cycles, re-triggering animations, and composition errors manifesting as visual artifacts or "matrix scanning" bands.
---

# render-glitch-detector

Use this skill when diagnosing **visual glitches, flicker, scanning bands, or "matrix effect" artifacts** in React components with real-time subscriptions, animations, or GPU-intensive operations.

## The Pattern: Subscription + Animation Feedback Loop

This glitch occurs when **three factors compound**:

1. **Real-time subscription** (e.g., Appwrite realtime, cache subscriptions) triggers `setState`
2. **Spring animation** (Framer Motion, CSS transitions) re-triggers on every render
3. **GPU-intensive operations** (blur filters, gradients, transforms) compound the re-render cost

Result: Overlapping animation frames fight GPU compositing, creating visual artifacts that look like:
- Multicolored bands or "matrix scanning"
- UI elements vibrating or flickering
- Settings/forms appearing unstable or "glitching"

## Root Causes

### 1. **Dependency Array Includes State Being Updated**

```tsx
// ❌ BAD: Causes infinite re-subscription cycle
useEffect(() => {
  const unsubscribe = subscribe((data) => {
    setProfile(data);
  });
  return unsubscribe;
}, [profile?.userId]); // ← profile is being SET, so it changes, causing re-subscribe
```

**Fix:** Use only stable identifiers (IDs, usernames, params) in dependencies:

```tsx
// ✅ GOOD: Only subscribes once when username changes
useEffect(() => {
  if (!username) return;
  const unsubscribe = subscribe((data) => {
    if (data.username === username) setProfile(data);
  });
  return unsubscribe;
}, [username]); // ← stable identifier only
```

### 2. **Spring Animation Re-triggers on Every Render**

```tsx
// ❌ BAD: Re-animates every time component renders
<motion.div
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
>
```

When subscription updates trigger state, the animation re-triggers. Compound this with many renders/sec and you get frame conflicts.

**Fix:** Remove animation or use conditional animation:

```tsx
// ✅ GOOD: No animation = no re-trigger side effects
<Box>
  {content}
</Box>

// Or use layout animation only on mount:
<motion.div
  initial={{ opacity: 0, y: 18 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
>
```

### 3. **GPU-Intensive Filters on Frequently-Re-rendered Elements**

```tsx
// ❌ BAD: filter: blur(50px) on every render
<Box sx={{
  position: 'absolute',
  background: 'radial-gradient(...)',
  filter: 'blur(50px)', // ← GPU operation on every render
}} />
```

**Fix:** Reduce blur or use `willChange: 'auto'` to hint to browser:

```tsx
// ✅ GOOD: Optimized filter + will-change hint
<Box sx={{
  position: 'absolute',
  background: 'radial-gradient(...)',
  filter: 'blur(35px)', // ← reduced from 50px
  willChange: 'auto',   // ← tells browser not to create layer
}} />
```

## Diagnostic Checklist

When investigating a glitch, ask:

1. **Does this component use a real-time subscription (websocket, Appwrite realtime, custom subscribe)?**
   - Yes → Check dependency array below

2. **Does the dependency array include state that the subscription updates?**
   - If yes, refactor to use only stable identifiers

3. **Does the component use Framer Motion animations?**
   - Yes → Check if they re-trigger on every render
   - If yes, move animation to mount-only or remove

4. **Are there GPU-intensive operations (blur, gradients, transforms) on frequently-rendering elements?**
   - Yes → Reduce intensity or optimize

## Common Fixes (Apply in Order)

### Fix 1: Stabilize Dependencies
```tsx
// Change from
}, [dependentState, anotherDependentState]);
// To
}, [stableId, stableUsername]);
```

### Fix 2: Remove or Optimize Animation
```tsx
// Remove spring animation if it's re-triggering
- <motion.div animate={{ ... }} transition={{ type: 'spring' }}>
+ <Box>

// Or keep but make it mount-only
<motion.div
  initial={shouldAnimate ? { opacity: 0 } : false}
  animate={shouldAnimate ? { opacity: 1 } : false}
  transition={{ duration: 0.3 }}
>
```

### Fix 3: Optimize GPU Operations
```tsx
// Reduce blur intensity
- filter: 'blur(50px)',
+ filter: 'blur(35px)',

// Add will-change hint
+ willChange: 'auto',
```

### Fix 4: Debounce State Updates (Last Resort)
```tsx
const timeoutRef = useRef<NodeJS.Timeout>();

useEffect(() => {
  const unsubscribe = subscribe((data) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setProfile(data);
    }, 50); // Batch updates every 50ms
  });
  return () => {
    clearTimeout(timeoutRef.current);
    unsubscribe();
  };
}, [stableId]);
```

## Files to Check When You See Glitches

These patterns appear in:
- Components with **realtime subscriptions** (cache listeners, Appwrite subscriptions)
- Components with **spring animations** on mutable content
- Components with **blur/gradient** decorations on high-render-frequency containers
- Settings/profile editors with **multiple state updates per second**

## How to Use This Skill

1. **Identify the glitch**: Visual artifacts, flicker, "matrix" scanning bands
2. **Find the component**: Check the URL or visual location
3. **Apply diagnostic checklist**: Check for subscriptions, animations, dependencies
4. **Apply fixes in order**: Dependencies → Animation → GPU ops → Debounce
5. **Test**: Build and verify the glitch is gone

## Example: Fixing `/u/[username]` Profile Glitch

**Problem:** Real-time identity subscription + spring animation + blur filter

```tsx
// ❌ BEFORE: Broken dependency array
useEffect(() => {
  const unsubscribe = subscribe(identity => {
    setProfile(identity);
  });
  return unsubscribe;
}, [profile?.userId]); // ← Infinite cycle!

// Framer Motion re-triggers:
<motion.div animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring' }}>

// GPU-intensive blur:
<Box sx={{ filter: 'blur(50px)' }} />
```

**Solution:**

```tsx
// ✅ AFTER: Stable dependency
useEffect(() => {
  if (!normalizedUsername) return;
  const unsubscribe = subscribe(identity => {
    if (identity.username === normalizedUsername) setProfile(identity);
  });
  return unsubscribe;
}, [normalizedUsername]); // ← Only stable identifier

// Remove animation:
<Box> {/* No motion.div */}

// Optimize filter:
<Box sx={{ filter: 'blur(35px)', willChange: 'auto' }} />
```

Result: No re-subscription loops, no re-triggering animations, no GPU thrashing → glitch gone.
