import { ID } from 'appwrite';
import { storage } from '../appwrite/client';

const BUCKETS = {
    MESSAGES: 'messages', // From your config: "Message Attachments"
    VOICE: 'voice',       // "Voice Messages"
    VIDEO: 'video',       // "Video Files"
    DOCUMENTS: 'documents' // "Documents"
};

export const StorageService = {
    async uploadFile(file: File, bucketId: string = BUCKETS.MESSAGES) {
        return await storage.createFile(bucketId, ID.unique(), file);
    },

    getFileView(fileId: string, bucketId: string = BUCKETS.MESSAGES) {
        return storage.getFileView(bucketId, fileId);
    },

    getFilePreview(fileId: string, bucketId: string = BUCKETS.MESSAGES, width?: number, height?: number) {
        return storage.getFilePreview(bucketId, fileId, width, height);
    },

    getFileDownload(fileId: string, bucketId: string = BUCKETS.MESSAGES) {
        return storage.getFileDownload(bucketId, fileId);
    },
    
    getBucketForType(type: 'image' | 'video' | 'audio' | 'file') {
        switch (type) {
            case 'audio': return BUCKETS.VOICE;
            case 'video': return BUCKETS.VIDEO;
            case 'file': return BUCKETS.DOCUMENTS;
            default: return BUCKETS.MESSAGES;
        }
    }
};
