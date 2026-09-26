---
name: storage
description: File uploads, storage buckets, byte ceilings, client-side image compression, and subscription upload gating in Kylrix.
---

# Storage Architecture & Upload Gating

## 1. Storage Buckets & Gating
- Dedicated storage buckets exist for vaults, attachments, moments, and avatars.
- Server-side upload gating enforces strict byte ceilings based on subscription tiers (Free vs Pro).
- Avoid bypassing upload checks in Next.js Server Actions.

## 2. Client-Side Compression & Processing
- Compress images client-side before dispatching to storage buckets to conserve bandwidth and reduce upload latency.
- Ensure audio/voice clips are securely bucketed with appropriate access permissions.
