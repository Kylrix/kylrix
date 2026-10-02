/**
 * Zero-Storage Architecture Mandate:
 * Storage buckets and file upload integrations (S3, Cloudflare R2, Appwrite Storage)
 * have been decommissioned. The entire Kylrix backend is strictly defined as
 * relational database objects that can be dumped and restored as a single file.
 */

export const StorageService = {
    async uploadFile(_file: File, _bucketId?: string): Promise<never> {
        throw new Error('Storage has been decommissioned. Kylrix operates on a zero-storage, database-only architecture.');
    },

    getFileView(_fileId?: string, _bucketId?: string): string {
        return '';
    },

    getFilePreview(_fileId?: string, _bucketId?: string, _width?: number, _height?: number): string {
        return '';
    },

    getFileDownload(_fileId?: string, _bucketId?: string): string {
        return '';
    },
    
    getBucketForType(_type: 'image' | 'video' | 'audio' | 'file'): string {
        return '';
    }
};
