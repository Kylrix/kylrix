import { ID } from "appwrite";
import { storage } from "./appwrite/client";
import { APPWRITE_CONFIG } from "./appwrite/config";

const { BUCKETS } = APPWRITE_CONFIG;

// Generic Storage Helpers
async function uploadFile(bucketId: string, file: File, fileId: string = ID.unique()) {
    return await storage.createFile(bucketId, fileId, file);
}

function getFilePreview(bucketId: string, fileId: string) {
    return storage.getFilePreview(bucketId, fileId);
}

function getFileView(bucketId: string, fileId: string) {
    return storage.getFileView(bucketId, fileId);
}

function getFileDownload(bucketId: string, fileId: string) {
    return storage.getFileDownload(bucketId, fileId);
}

async function deleteFile(bucketId: string, fileId: string) {
    await storage.deleteFile(bucketId, fileId);
}

// --- Task Attachments ---

export const taskAttachments = {
    upload: (file: File) => uploadFile(BUCKETS.TASK_ATTACHMENTS, file),
    getPreview: (fileId: string) => getFilePreview(BUCKETS.TASK_ATTACHMENTS, fileId),
    getView: (fileId: string) => getFileView(BUCKETS.TASK_ATTACHMENTS, fileId),
    getDownload: (fileId: string) => getFileDownload(BUCKETS.TASK_ATTACHMENTS, fileId),
    delete: (fileId: string) => deleteFile(BUCKETS.TASK_ATTACHMENTS, fileId),
};

// --- Event Covers ---

export const eventCovers = {
    upload: (file: File) => uploadFile(BUCKETS.EVENT_COVERS, file),
    getPreview: (fileId: string) => getFilePreview(BUCKETS.EVENT_COVERS, fileId),
    getView: (fileId: string) => getFileView(BUCKETS.EVENT_COVERS, fileId),
    getDownload: (fileId: string) => getFileDownload(BUCKETS.EVENT_COVERS, fileId),
    delete: (fileId: string) => deleteFile(BUCKETS.EVENT_COVERS, fileId),
};
