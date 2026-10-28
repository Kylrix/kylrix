## 2025-02-28 - Accessible Custom Toggle Switches (ModernSwitch)
**Learning:** Custom toggle buttons implemented with plain `<button>` tags without `role="switch"` and `aria-checked` are invisible to screen readers as stateful controls, and lack keyboard focus indicators when using `focus:outline-none`.
**Action:** Always provide `role="switch"`, `aria-checked`, a descriptive `aria-label`, and `focus-visible:ring-2` focus rings when creating custom toggle/switch primitives in this design system.
