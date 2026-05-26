export interface FileUploadPayload {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}

export interface StoragePort {
  /**
   * Uploads a file buffer to a specific storage bucket.
   */
  uploadFile(
    bucketId: string,
    fileId: string | null,
    file: FileUploadPayload
  ): Promise<any>;

  /**
   * Generates a direct view URL for the file.
   */
  getFileViewUrl(bucketId: string, fileId: string): Promise<string>;

  /**
   * Generates a preview URL with specific downscale attributes.
   */
  getFilePreviewUrl(
    bucketId: string,
    fileId: string,
    width?: number,
    height?: number
  ): Promise<string>;

  /**
   * Generates a secure download URL.
   */
  getFileDownloadUrl(bucketId: string, fileId: string): Promise<string>;

  /**
   * Deletes a file from the bucket.
   */
  deleteFile(bucketId: string, fileId: string): Promise<void>;
}
