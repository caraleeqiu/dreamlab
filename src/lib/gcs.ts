/**
 * Google Cloud Storage Wrapper
 *
 * Upload/download files to GCS
 * Required for: At least one Google Cloud service
 */

// TODO: npm install @google-cloud/storage
// import { Storage } from '@google-cloud/storage';

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || '';
const GCS_PUBLIC_URL = process.env.GCS_PUBLIC_URL || '';

// const storage = new Storage({
//   projectId: process.env.GOOGLE_CLOUD_PROJECT,
// });

export interface UploadResult {
  url: string;
  gcsPath: string;
}

/**
 * Upload file buffer to GCS
 */
export async function uploadToGCS(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  // TODO: Implement with @google-cloud/storage
  throw new Error('Not implemented - install @google-cloud/storage first');
}

/**
 * Upload from URL to GCS (download then upload)
 */
export async function uploadFromUrlToGCS(
  sourceUrl: string,
  filename: string
): Promise<UploadResult> {
  // TODO: Implement
  throw new Error('Not implemented');
}

/**
 * Generate signed URL for temporary access
 */
export async function getSignedUrl(gcsPath: string, expiresInMinutes = 60): Promise<string> {
  // TODO: Implement
  throw new Error('Not implemented');
}

/**
 * Delete file from GCS
 */
export async function deleteFromGCS(gcsPath: string): Promise<void> {
  // TODO: Implement
  throw new Error('Not implemented');
}
