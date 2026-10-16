import {
  VaultService,
  deleteCredential,
  deleteTotpSecret,
  updateCredential,
  updateTotpSecret,
  createCredential,
  createTotpSecret,
} from '@/lib/data';

export {
  VaultService,
  deleteCredential,
  deleteTotpSecret,
  updateCredential,
  updateTotpSecret,
  createCredential,
  createTotpSecret,
};

export async function addAttachmentToCredential(id: string, file: any): Promise<any> {
  return { id, file };
}

export async function deleteCredentialAttachment(id: string, fileId: string): Promise<any> {
  return { id, fileId };
}
