/**
 * StorageService stub — file storage (Appwrite Buckets) has been removed.
 * This shim keeps existing import sites building without modification.
 * All methods throw at runtime to surface unsupported operations clearly.
 */
export const StorageService = {
  uploadFile(_file: File, _bucketId: string): Promise<{ $id: string }> {
    return Promise.reject(new Error('File storage has been removed. uploadFile is not supported.'));
  },
  getFileView(_fileId: string, _bucketId?: string): string {
    return '';
  },
  getFilePreview(_fileId: string, _bucketId?: string, _width?: number, _height?: number): string {
    return '';
  },
  deleteFile(_fileId: string, _bucketId: string): Promise<void> {
    return Promise.reject(new Error('File storage has been removed. deleteFile is not supported.'));
  },
};
