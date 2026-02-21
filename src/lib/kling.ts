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

/**
 * 带指数退避的重试工具
 * 仅在网络层抛出异常时重试（如 ECONNRESET、超时）；
 * Kling 返回的业务错误（JSON 格式）不触发重试。
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError
}

async function klingFetch(path: string, options: RequestInit = {}) {
  return withRetry(async () => {
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
  })
}

// Build prompt for a single podcast clip (used in per-clip fallback)
//
// element_id (Kling 3.0 Subject Library) is used when available for better character consistency.
// Without element_id, video generation still works but character may vary between clips.
export function buildClipPrompt(
  clip: ScriptClip,
  influencer: Influencer,
  firstFrameUrl: string,
  _frontalImageUrl: string, // kept for API compatibility, but not used since element_list requires element_id
) {
  const cameraTag = [clip.shot_type, clip.camera_movement].filter(Boolean).join(', ')
  const visualDirective = cameraTag
    ? `[${cameraTag}] ${clip.shot_description}`
    : clip.shot_description

  // Only reference element in prompt if we have a registered element_id
  const elementRef = influencer.kling_element_id ? '<<<element_1>>> ' : ''
  const prompt = [
    `${elementRef}${visualDirective}`,
    `Speak naturally: "${clip.dialogue}"`,
    `Voice style: ${influencer.voice_prompt}`,
  ].join('. ')

  const result: {
    model_name: string
    prompt: string
    image: string
    duration: string
    aspect_ratio: string
    mode: 'pro'
    sound: string
    element_list?: Array<{ element_id: string }>
  } = {
    model_name: 'kling-v3',
    prompt,
    image: firstFrameUrl,
    duration: String(clip.duration),
    aspect_ratio: '9:16',
    mode: 'pro' as const,
    sound: 'on',
  }

  // Only include element_list if we have a valid element_id
  if (influencer.kling_element_id) {
    result.element_list = [{ element_id: influencer.kling_element_id }]
  }

  return result
}

export async function submitImage2Video(payload: ReturnType<typeof buildClipPrompt> & { callback_url?: string }) {
  return klingFetch('/v1/videos/image2video', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Query task status. Tries image2video → text2video → omni-video in order.
 * This handles all Kling task types without needing to store the endpoint type.
 */
export async function getTaskStatus(taskId: string) {
  const resp = await klingFetch(`/v1/videos/image2video/${taskId}`)
  if (resp?.data?.task_id || resp?.data?.task_status) return resp
  const t2v = await klingFetch(`/v1/videos/text2video/${taskId}`)
  if (t2v?.data?.task_id || t2v?.data?.task_status) return t2v
  return klingFetch(`/v1/videos/omni-video/${taskId}`)
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
  elementList?: Array<{ element_id?: string; frontal_image_url?: string }>
  voiceList?: Array<{ voice_id: string }>
  // Frame chaining: use a specific image as the starting frame (overrides imageUrl as first_frame)
  firstFrameUrl?: string
  // Reference video for cinematic style/camera learning (refer_type: "feature")
  referenceVideoUrl?: string
  callbackUrl?: string
}) {
  const shotType = params.shotType ?? (params.shots?.length ? 'customize' : 'intelligence')

  const body: Record<string, unknown> = {
    model_name: 'kling-v3',
    mode: params.renderMode ?? 'pro',
    image: params.imageUrl,
    multi_shot: true,
    shot_type: shotType,
    duration: String(Math.min(params.totalDuration, 15)),
    aspect_ratio: params.aspectRatio ?? '9:16',
    sound: 'on',
  }

  // Frame chaining: pin the first frame to a specific image (e.g. last frame of previous clip)
  if (params.firstFrameUrl) {
    body.image_list = [{ url: params.firstFrameUrl, type: 'first_frame' }]
  }

  // Reference video for camera/cinematic style learning
  if (params.referenceVideoUrl) {
    body.video_list = [{ url: params.referenceVideoUrl, refer_type: 'feature', keep_original_sound: 'no' }]
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

/**
 * Pure text-to-video (no reference image) — for fully animated scenes.
 * Uses Kling's text2video endpoint.
 */
export async function submitText2Video(params: {
  prompt: string
  totalDuration: number
  shots?: Array<{ index: number; prompt: string; duration: number }>
  shotType?: 'intelligence' | 'customize'
  aspectRatio?: string
  renderMode?: 'pro' | 'std'
  callbackUrl?: string
}) {
  const shotType = params.shotType ?? (params.shots?.length ? 'customize' : 'intelligence')

  const body: Record<string, unknown> = {
    model_name: 'kling-v3',
    mode: params.renderMode ?? 'pro',
    multi_shot: true,
    shot_type: shotType,
    duration: String(Math.min(params.totalDuration, 15)),
    aspect_ratio: params.aspectRatio ?? '9:16',
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

  if (params.callbackUrl) body.callback_url = params.callbackUrl

  return klingFetch('/v1/videos/text2video', {
    method: 'POST',
    body: JSON.stringify(body),
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

// ── Kling 3.0 Subject Library ─────────────────────────────────────────────────
//
// Register an influencer as a Kling "Advanced Custom Element" (subject).
// Returns element_id which replaces frontal_image_url in element_list.
// Store element_id in influencers.kling_element_id after first registration.
//
// imageUrls: up to 6 front-facing photos (presigned R2 URLs)
// videoUrl:  optional short reference video (3–10 s)
export async function createSubject(params: {
  name: string
  description?: string
  imageUrls: string[]
  videoUrl?: string
}): Promise<{ element_id: string; voice_id?: string; error?: string } | null> {
  const body: Record<string, unknown> = {
    name: params.name,
    element_description: params.description || `AI influencer character: ${params.name}`,
    image_list: params.imageUrls.map(url => ({ url })),
  }
  if (params.videoUrl) body.video_url = params.videoUrl

  const resp = await klingFetch('/v1/general/advanced-custom-elements', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  if (resp?.code !== 0 || !resp?.data?.element_id) {
    console.error('[Kling createSubject] Failed:', JSON.stringify(resp))
    return { element_id: '', error: resp?.message || `code=${resp?.code}` }
  }
  return {
    element_id: resp.data.element_id as string,
    voice_id: resp.data.voice_id as string | undefined,
  }
}

// ── Kling 3.0 Omni Video ──────────────────────────────────────────────────────
//
// kling-v3-omni model — supports inline voice synthesis via voice_list.
// This avoids a separate lip-sync step: the model generates the avatar
// speaking the dialogue in a single API call.
//
// elementId:  from influencer.kling_element_id (Subject Library)
// voiceId:    from influencer.kling_element_voice_id (cloned voice)
export async function submitOmniVideo(params: {
  prompt: string
  imageUrl: string
  elementId: string
  voiceId?: string
  totalDuration: number
  shots?: Array<{ index: number; prompt: string; duration: number }>
  shotType?: 'intelligence' | 'customize'
  aspectRatio?: string
  callbackUrl?: string
}) {
  const shotType = params.shotType ?? (params.shots?.length ? 'customize' : 'intelligence')

  const body: Record<string, unknown> = {
    model_name: 'kling-v3-omni',
    mode: 'pro',
    image: params.imageUrl,
    multi_shot: true,
    shot_type: shotType,
    duration: String(Math.min(params.totalDuration, 15)),
    aspect_ratio: params.aspectRatio ?? '9:16',
    element_list: [{ element_id: params.elementId }],
    sound: 'on',
  }

  if (shotType === 'customize' && params.shots?.length) {
    body.multi_prompt = params.shots.map(s => ({
      index: s.index,
      prompt: s.prompt,
      duration: String(s.duration),
    }))
  } else {
    body.prompt = params.prompt
  }

  if (params.voiceId) body.voice_list = [{ voice_id: params.voiceId }]
  if (params.callbackUrl) body.callback_url = params.callbackUrl

  return klingFetch('/v1/videos/omni-video', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ── Kling 3.0 Omni Video-to-Video ─────────────────────────────────────────────
//
// Two modes via referType:
//   "feature" — cinematic style reference: new video inherits the framing,
//               motion, and energy of the source. Used for remix/二创.
//   "base"    — editing target: modifies the source video per the prompt.
//               Used for post-editing a generated clip (change BG, etc.)
//
// Kling API constraint: sound must be "off" when video_list is present.
// Use keepOriginalSound to preserve the source video's audio track instead.
export async function submitVideoToVideo(params: {
  prompt: string
  imageUrl: string
  referenceVideoUrl: string
  referType: 'feature' | 'base'
  keepOriginalSound?: boolean
  elementId?: string
  voiceId?: string
  totalDuration: number
  aspectRatio?: string
  callbackUrl?: string
}) {
  const body: Record<string, unknown> = {
    model_name: 'kling-v3-omni',
    mode: 'pro',
    image: params.imageUrl,
    prompt: params.prompt,
    duration: String(Math.min(params.totalDuration, 15)),
    aspect_ratio: params.aspectRatio ?? '9:16',
    video_list: [{
      url: params.referenceVideoUrl,
      refer_type: params.referType,
      keep_original_sound: params.keepOriginalSound ? 'yes' : 'no',
    }],
    // sound must be 'off' when video_list is present (Kling API restriction)
    sound: 'off',
  }

  if (params.elementId) body.element_list = [{ element_id: params.elementId }]
  if (params.voiceId) body.voice_list = [{ voice_id: params.voiceId }]
  if (params.callbackUrl) body.callback_url = params.callbackUrl

  return klingFetch('/v1/videos/omni-video', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
