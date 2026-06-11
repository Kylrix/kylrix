---
name: storage.core
description: Ecosystem standards and architectural rules for file uploads, size gating, client-side compression, and dynamic rendering across all Kylrix storage buckets.
---

# Kylrix Storage & Client-Side Compression Guidelines

This skill documents the ecosystem-wide standards for managing files, enforcing bucket-specific upload limits, executing mandatory client-side compression, and routing different file types to their dedicated rendering sub-components.

---

## 🏗️ Architectural Mandates

### 1. Zero Large Server Buffers (Mathematical Memory Bounds)
To prevent Node/V8 processes from running out of memory under single-instance or serverless environments, **never** read uncompressed or large file payloads into Server Action buffers. 
* All upload operations must enforce strict client-side compression *before* hitting any network interface.
* Server-side action bounds must reject any upload exceeding the specific bucket gates instantly.

### 2. Mandatory Client-Side Image Compression
Any image (`image/png`, `image/jpeg`, `image/jpg`) uploaded to the system **must** be client-side compressed to WebP:
* Convert png/jpg to WebP (`image/webp`) with a default quality of `0.80` via canvas rendering.
* Downscale massive images (e.g. limit to a bounding box of 1920x1920 pixels).
* This reduces file size by 80%+ while preserving visual clarity.

### 3. File Gating & Bucket Thresholds
Enforce the following strict limits at both the client layer (first gate) and the Server Action layer (final gate):

| Bucket ID | Hard Size limit | Allowed Formats / Notes |
| :--- | :--- | :--- |
| **`profile_pictures`** | **1 MB** | `png, jpg, jpeg, webp, gif`. WebP compression mandatory. |
| **`messages`** (Chat) | **1 MB** | All formats. Audio transcoded/minimized; images compressed. |
| **`notes_attachments`**| **5 MB** | Text, markdown, images, PDF. |
| **General Limit Ceiling** | **10 MB** | Guideline upper bound for any discrete upload. |

---

## 🎨 Sub-Storage File Rendering Policy

All files uploaded to the ecosystem must be classified into one of the following categories to resolve their optimal client-side renderer:

1. **`image`**: Rendered via `<img />` or optimized `NextImage` with full pan/zoom modal support.
2. **`audio`**: Rendered using a specialized audio player (e.g., custom waveform or mini-player component).
3. **`video`**: Rendered inside a HTML5 `<video />` player with native play/pause overlays.
4. **`document`** (PDF, Doc, Sheets): Rendered using an inline document preview iframe or dynamic page viewer.
5. **`other`** (Zip, Tar, Binary): Rendered as a lightweight download card with metadata details.

---

## 👤 Profile Picture Preview Policy

To optimize load speed and avoid complex server-side authorization challenges on restricted buckets, **always retrieve and render profile pictures on the client-side** using `getProfilePicturePreview(fileId)`.
* Since every user-owned file has read permissions readable via client-side cookie/auth headers, client-side fetches leverage existing user credentials.
* Do not route profile picture preview retrieval through server-side fetch actions (`getFilePreviewSecure`) to eliminate unauthenticated backend request failures.
