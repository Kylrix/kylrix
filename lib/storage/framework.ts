'use client';

/**
 * Kylrix Modular Storage Framework
 * 
 * Securely gates file uploads at the client layer, performs mandatory client-side
 * image compression, and categorizes files for unified rendering components.
 */

export type FileTypeCategory = 'image' | 'audio' | 'video' | 'document' | 'other';

export interface StorageGatingConfig {
  maxSizeBytes: number;
  allowedExtensions?: string[];
  compress: boolean;
}

// Global Bucket Size Gating Configuration
export const BUCKET_LIMITS: Record<string, StorageGatingConfig> = {
  profile_pictures: {
    maxSizeBytes: 1 * 1024 * 1024, // 1 MB
    allowedExtensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
    compress: true,
  },
  messages: {
    maxSizeBytes: 1 * 1024 * 1024, // 1 MB
    compress: true,
  },
  notes_attachments: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    compress: true,
  },
  vault_attachments: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    compress: true,
  },
  form_media: {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    compress: true,
  },
  chat_uploads: {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    compress: true,
  },
  // Default fallback limit for any other discrete upload in the ecosystem
  default: {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB Guideline Upper Limit
    compress: false,
  },
};



/**
 * Classifies a file into a distinct FileTypeCategory based on its MIME type or extension.
 */
export function getFileTypeCategory(mimeType: string, filename?: string): FileTypeCategory {
  const mime = (mimeType || '').toLowerCase();
  const ext = filename ? filename.split('.').pop()?.toLowerCase() || '' : '';

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    return 'image';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus'].includes(ext)) {
    return 'audio';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
    return 'video';
  }
  if (
    mime === 'application/pdf' ||
    mime.startsWith('text/') ||
    [
      'pdf',
      'txt',
      'md',
      'markdown',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'ppt',
      'pptx',
      'json',
      'csv',
    ].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

/**
 * Resilient client-side image compressor.
 * Downscales massive images and converts them to highly compressed WebP format.
 */
export async function compressImageToWebP(file: File, maxDimension = 1920, quality = 0.8): Promise<File> {
  // Safe SSR checking
  if (typeof window === 'undefined' || !window.HTMLCanvasElement) {
    return file;
  }

  // Preserve animations or gif structures
  if (file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Downscale proportionally if exceeding bounding box
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const newFilename = file.name.replace(/\.[^/.]+$/, '') + '.webp';
              const compressedFile = new File([blob], newFilename, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Validates file properties against active gating limits.
 * Throws a detailed error description if limits are exceeded.
 */
export function validateFileUploadLimit(file: File, bucketId: string): void {
  const config = BUCKET_LIMITS[bucketId] || BUCKET_LIMITS.default;

  // 1. Strict File Size Validation
  if (file.size > config.maxSizeBytes) {
    const limitMb = (config.maxSizeBytes / (1024 * 1024)).toFixed(1);
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`File size (${sizeMb}MB) exceeds the maximum limit of ${limitMb}MB for this upload.`);
  }

  // 2. Strict Extension Checks if configured
  if (config.allowedExtensions && config.allowedExtensions.length > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!config.allowedExtensions.includes(ext)) {
      throw new Error(`File format .${ext} is not allowed. Supported formats: ${config.allowedExtensions.join(', ')}`);
    }
  }
}

/**
 * Resolves appropriate UI rendering elements/metadata based on file category.
 */
export function resolveFileRenderer(mimeType: string, filename?: string) {
  const category = getFileTypeCategory(mimeType, filename);
  
  return {
    category,
    isRenderableInline: ['image', 'audio', 'video'].includes(category),
    icon: category === 'image' ? 'Image' : category === 'audio' ? 'Volume2' : category === 'video' ? 'Video' : 'FileText',
  };
}
