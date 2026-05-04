export * from './design';
export * from './identity';
export * from './appwrite';
export * from './topbar';
export * from './fab';
export * from './ecosystem';
export * from './security';
export * from './social';
export * from './messaging';
export * from './huddles';
export * from './extensions';

// --- Re-export crosslinks SDK ---
export { buildSourceNoteTags, buildVaultNoteTags, mergeNoteTags, extractLinkedNoteIdsFromTags, buildNoteAttachmentMetadata } from './crosslinks';

// --- Re-export orchestration SDK ---
export type { CrossObjectOrigin, CrossObjectMetadata } from './orchestration';

// --- Re-export ecosystem SDK ---
export { useLastActiveApp, getLastActiveApp, setLastActiveApp } from './ecosystem';

// --- Re-export routing SDK ---
export { useLastActiveApp as useLastActiveAppRouting } from './routing';

// --- Re-export topbar SDK ---
export { createTopbarPanelMotion, createEcosystemPanelItems, isTopbarScrollAtTop, isTopbarScrollAtBottom } from './topbar';
