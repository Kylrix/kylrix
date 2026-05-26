import { StoragePort, FileUploadPayload } from '../../ports/storage.port';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export class AppwriteStorageAdapter implements StoragePort {
  private getStorage() {
    const { storage } = createSystemClient();
    return storage;
  }

  async uploadFile(
    bucketId: string,
    fileId: string | null,
    file: FileUploadPayload
  ): Promise<any> {
    const { InputFile } = await import('node-appwrite/file');
    const { ID } = await import('node-appwrite');
    
    const inputFile = InputFile.fromBuffer(file.buffer, file.name);
    const resolvedFileId = fileId || ID.unique();
    
    const storage = this.getStorage();
    const uploadedFile = await storage.createFile(bucketId, resolvedFileId, inputFile);
    return JSON.parse(JSON.stringify(uploadedFile));
  }

  async getFileViewUrl(bucketId: string, fileId: string): Promise<string> {
    const endpoint = APPWRITE_CONFIG.ENDPOINT;
    const projectId = APPWRITE_CONFIG.PROJECT_ID;
    return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
  }

  async getFilePreviewUrl(
    bucketId: string,
    fileId: string,
    width?: number,
    height?: number
  ): Promise<string> {
    const endpoint = APPWRITE_CONFIG.ENDPOINT;
    const projectId = APPWRITE_CONFIG.PROJECT_ID;
    let url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${projectId}`;
    if (width) url += `&width=${width}`;
    if (height) url += `&height=${height}`;
    return url;
  }

  async getFileDownloadUrl(bucketId: string, fileId: string): Promise<string> {
    const endpoint = APPWRITE_CONFIG.ENDPOINT;
    const projectId = APPWRITE_CONFIG.PROJECT_ID;
    return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/download?project=${projectId}`;
  }

  async deleteFile(bucketId: string, fileId: string): Promise<void> {
    const storage = this.getStorage();
    await storage.deleteFile(bucketId, fileId);
  }
}
