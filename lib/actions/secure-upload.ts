'use server';

/**
 * File upload server action stub.
 * File storage is decommissioned. Kylrix operates on a zero-storage, database-only architecture.
 */
export async function secureUploadFile(
  _formData: FormData,
  _jwt?: string,
): Promise<{ $id: string; [key: string]: any }> {
  throw new Error('File storage is decommissioned. Kylrix operates on a zero-storage, database-only architecture.');
}
