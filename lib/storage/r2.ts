import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME || 'kylrix-storage';
const publicDomain = process.env.R2_PUBLIC_DOMAIN;

const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey);

export const r2Client = isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    })
  : null;

/**
 * Generates a presigned PUT URL for zero-egress, client-to-R2 direct upload.
 */
export async function getR2UploadUrl(key: string, contentType: string = 'application/octet-stream', expiresIn = 3600): Promise<string> {
  if (!r2Client) {
    throw new Error('Cloudflare R2 storage credentials are not configured in environment.');
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Generates a presigned GET URL for safe object downloading or viewing.
 */
export async function getR2DownloadUrl(key: string, expiresIn = 3600): Promise<string> {
  if (publicDomain) {
    return `https://${publicDomain}/${key}`;
  }

  if (!r2Client) {
    throw new Error('Cloudflare R2 storage credentials are not configured in environment.');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return await getSignedUrl(r2Client, command, { expiresIn });
}

/**
 * Directly removes an object from Cloudflare R2.
 */
export async function deleteR2Object(key: string): Promise<boolean> {
  if (!r2Client) return false;

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await r2Client.send(command);
    return true;
  } catch (err) {
    console.warn('[R2 Storage] Failed to delete object:', key, err);
    return false;
  }
}
