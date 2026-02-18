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

// Build prompt for a single podcast clip (used in per-clip fallback)
export function buildClipPrompt(
  clip: ScriptClip,
  influencer: Influencer,
  firstFrameUrl: string,
  frontalImageUrl: string,
) {
  const prompt = [
    `<<<element_1>>> ${clip.shot_description}`,
    `Speak naturally: "${clip.dialogue}"`,
    `Voice style: ${influencer.voice_prompt}`,
  ].join('. ')

  return {
    model_name: 'kling-v3',
    prompt,
    image: firstFrameUrl,
    duration: String(clip.duration),
    aspect_ratio: '9:16',
    mode: 'pro' as const,
    cfg_scale: 0.5,
    element_list: [{ frontal_image_url: frontalImageUrl }],
    sound: 'on',
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

// Multi-shot image-to-video — single API call for the whole script
//
// shotType: "intelligence" — single prompt, Kling auto-cuts & handles camera movement
//           "customize"    — per-shot prompts via shots[], full storyboard control
export async function submitMultiShotVideo(params: {
  imageUrl: string
  totalDuration: number
  // intelligence mode: one combined prompt
  prompt?: string
  // customize mode: per-shot prompts (max 6 shots)
  shots?: Array<{ index: number; prompt: string; duration: number }>
  shotType?: 'intelligence' | 'customize'
  aspectRatio?: string
  renderMode?: 'pro' | 'std'
  elementList?: Array<{ element_id?: number; frontal_image_url?: string }>
  voiceList?: Array<{ voice_id: number }>
  callbackUrl?: string
}) {
  const shotType = params.shotType ?? (params.shots?.length ? 'customize' : 'intelligence')

  const body: Record<string, unknown> = {
    model_name: 'kling-v3',
    mode: params.renderMode ?? 'pro',
    image: params.imageUrl,
    multi_shot: 'true',
    shot_type: shotType,
    duration: String(Math.min(params.totalDuration, 15)),
    aspect_ratio: params.aspectRatio ?? '9:16',
    sound: 'on',
  }

  if (shotType === 'customize' && params.shots?.length) {
    body.multi_prompt = params.shots.map(s => ({
      index: s.index,
      prompt: s.prompt,
      duration: String(s.duration),
    }))
  } else {
    body.prompt = params.prompt ?? ''
  }

  if (params.elementList?.length) body.element_list = params.elementList
  if (params.voiceList?.length) body.voice_list = params.voiceList
  if (params.callbackUrl) body.callback_url = params.callbackUrl

  return klingFetch('/v1/videos/image2video', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// Simple single-shot image-to-video (remix / edu / single-clip fallback)
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
      duration: String(Math.min(params.durationS ?? 5, 10)),
      aspect_ratio: params.aspectRatio ?? '9:16',
      sound: 'on',
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
