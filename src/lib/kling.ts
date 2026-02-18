import { SignJWT } from 'jose'
import type { ScriptClip, Influencer } from '@/types'

const BASE = process.env.KLING_BASE_URL!
const ACCESS_KEY = process.env.KLING_ACCESS_KEY!
const SECRET_KEY = process.env.KLING_SECRET_KEY!

async function generateJWT(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return new SignJWT({ iss: ACCESS_KEY })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime(now + 1800)
    .setNotBefore(now - 5)
    .sign(new TextEncoder().encode(SECRET_KEY))
}

async function klingFetch(path: string, options: RequestInit = {}) {
  const token = await generateJWT()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res.json()
}

export function buildClipPrompt(
  clip: ScriptClip,
  influencer: Influencer,
  firstFrameUrl: string,
  frontalImageUrl: string,
) {
  const shotDesc = clip.shot_description
  const voicePrompt = influencer.voice_prompt
  const dialogue = clip.dialogue

  const prompt = [
    `@Element1 ${shotDesc}`,
    `Mouth opens and closes naturally with speech rhythm.`,
    `[VOICE: ${voicePrompt}]`,
    `[SAYS: ${dialogue}]`,
  ].join(' ')

  return {
    model_name: 'kling-v3',
    prompt,
    image: firstFrameUrl,
    duration: clip.duration,
    aspect_ratio: '9:16',
    mode: 'pro' as const,
    cfg_scale: 0.5,
    elements: [{ frontal_image_url: frontalImageUrl }],
    generate_audio: true,
  }
}

export async function submitImage2Video(payload: ReturnType<typeof buildClipPrompt> & { callback_url?: string }) {
  return klingFetch('/v1/videos/image2video', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getTaskStatus(taskId: string) {
  return klingFetch(`/v1/videos/image2video/${taskId}`)
}

// Simple image-to-video for non-podcast job types (remix / edu / anime / story)
// Uses a flat prompt string without @Element1 / elements[] syntax
export async function submitSimpleVideo(params: {
  prompt: string
  imageUrl: string
  durationS?: number
  aspectRatio?: string
  callbackUrl?: string
}) {
  return klingFetch('/v1/videos/image2video', {
    method: 'POST',
    body: JSON.stringify({
      model_name: 'kling-v3',
      mode: 'pro' as const,
      prompt: params.prompt,
      image: params.imageUrl,
      duration: Math.min(params.durationS ?? 5, 10),
      aspect_ratio: params.aspectRatio ?? '9:16',
      generate_audio: true,
      ...(params.callbackUrl && { callback_url: params.callbackUrl }),
    }),
  })
}

export async function submitLipSync(videoUrl: string, audioUrl: string, callbackUrl?: string) {
  return klingFetch('/v1/videos/lip-sync', {
    method: 'POST',
    body: JSON.stringify({
      input: {
        mode: 'audio2video',
        video_url: videoUrl,
        audio_type: 'url',
        audio_url: audioUrl,
      },
      ...(callbackUrl && { callback_url: callbackUrl }),
    }),
  })
}
