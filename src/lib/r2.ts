import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET!

export async function uploadToR2(key: string, body: Buffer | Uint8Array, contentType: string) {
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
  const publicBase = process.env.R2_PUBLIC_URL ?? `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${BUCKET}`
  return `${publicBase}/${key}`
}

export async function getPresignedUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  )
}

export function r2Key(path: string) {
  return path.startsWith('/') ? path.slice(1) : path
}

/**
 * Upload base64 encoded image to R2
 * @param base64Data - base64 string (with or without data URI prefix)
 * @param key - R2 object key
 * @returns { url: string } - public URL
 */
export async function uploadBase64ToR2(base64Data: string, key: string): Promise<{ url: string }> {
  // Strip data URI prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Clean, 'base64')

  // Detect content type from data URI or default to JPEG
  let contentType = 'image/jpeg'
  const match = base64Data.match(/^data:(image\/\w+);base64,/)
  if (match) {
    contentType = match[1]
  }

  const url = await uploadToR2(key, buffer, contentType)
  return { url }
}
