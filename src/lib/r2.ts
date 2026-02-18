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
