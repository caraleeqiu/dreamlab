import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
import { join } from 'path'

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = 'dreamlab-assets'
const IMAGES = ['aria', 'tanjiro', 'luffy', 'atlas', 'marin', 'sable', 'miso', 'quinn', 'ellie', 'kai', 'gintoki', 'loopy', 'senku', 'snowking', 'xiaohua', 'zane']

async function upload() {
  for (const name of IMAGES) {
    const filePath = join(process.cwd(), 'public', 'influencers', `${name}_front.png`)
    const key = `influencers/${name}_front.png`

    try {
      const body = readFileSync(filePath)
      await client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: 'image/png',
      }))
      console.log(`✓ ${name} uploaded`)
    } catch (err) {
      console.error(`✗ ${name} failed:`, err)
    }
  }
}

upload()
