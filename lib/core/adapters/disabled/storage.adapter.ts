import { StoragePort, FileUploadPayload } from '../../ports/storage.port';

export class DisabledStorageAdapter implements StoragePort {
  async uploadFile(
    _bucketId: string,
    _fileId: string | null,
    _file: FileUploadPayload,
    _permissions?: string[]
  ): Promise<any> {
    throw new Error('File storage and bucket uploads are deprecated and disabled.');
  }

  async getFileViewUrl(_bucketId: string, _fileId: string): Promise<string> {
    return '';
  }

  async getFilePreviewUrl(
    _bucketId: string,
    _fileId: string,
    _width?: number,
    _height?: number
  ): Promise<string> {
    return '';
  }

  async getFileDownloadUrl(_bucketId: string, _fileId: string): Promise<string> {
    return '';
  }

  async deleteFile(_bucketId: string, _fileId: string): Promise<void> {
    // No-op
  }
}
