## 2025-05-20 - Accessible Icon-Only Buttons in Sidekick Overlay Drawers
**Learning:** Icon-only action buttons in complex overlay drawers (such as SidekickDrawer header controls, attachment triggers, and detach buttons) frequently lack `aria-label` attributes even when `title` tooltips are present, making them inaccessible to screen reader users who rely on computed accessible names.
**Action:** When creating or modifying drawer header actions, attachment pills, or close triggers, always provide descriptive `aria-label` attributes alongside visual `title` tooltips.
