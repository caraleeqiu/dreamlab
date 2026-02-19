/**
 * Seedance 2.0 (即梦) video generation client — Volcengine API
 *
 * Enterprise API: 火山引擎 visual API (available from 2026-02-24)
 * Web product: https://jimeng.jianying.com
 *
 * ⚠️  FACE RESTRICTION: Seedance blocks photorealistic human face images.
 *     Only use for: virtual/anime/brand influencers, or scene-only B-roll.
 *     Human influencers (Aria, Kai, etc.) must use Kling instead.
 *
 * Features vs Kling:
 *   + Superior camera movement replication (@视频 的运镜)
 *   + Built-in audio/BGM/SFX generation
 *   + Video extension (向后延长/向前延长) for seamless chaining
 *   + Multi-modal input (image + video + audio + text up to 12 files)
 *   - No photorealistic face support
 *   - No equivalent to Kling's Subject Library element_id
 *
 * ENV VARS:
 *   SEEDANCE_API_KEY — Volcengine access key (or composite "key:secret")
 *   SEEDANCE_BASE_URL — optional override (default: https://visual.volcengineapi.com)
 *
 * Setup when API is released:
 *   1. Get API key from https://console.volcengine.com
 *   2. Set SEEDANCE_API_KEY + SEEDANCE_BASE_URL in .env.local
 *   3. Implement POST /api/webhooks/seedance for callbacks
 *   4. Update getActiveProvider() in video-router.ts
 */

import { createLogger } from './logger'

const logger = createLogger('seedance')

const BASE_URL = process.env.SEEDANCE_BASE_URL ?? 'https://visual.volcengineapi.com'
const API_KEY  = process.env.SEEDANCE_API_KEY

export function isSeedanceAvailable(): boolean {
  return !!API_KEY
}

// ─── Influencer type guard ────────────────────────────────────────────────────

export type InfluencerType = 'human' | 'animal' | 'virtual' | 'brand'

/**
 * Seedance platform policy blocks photorealistic human faces.
 * Only virtual, brand, and animal influencers can use Seedance.
 */
export function seedanceSupportsFace(influencerType: InfluencerType): boolean {
  return influencerType !== 'human'
}

// ─── Submission result (mirrors Kling's SubmitResult) ────────────────────────

export interface SeedanceSubmitResult {
  taskId: string | null
  error?: string
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function seedanceFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  if (!API_KEY) {
    return { code: -1, message: 'SEEDANCE_API_KEY not configured' }
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        ...(options.headers ?? {}),
      },
      signal: AbortSignal.timeout(30_000),
    })
    return res.json()
  } catch (err) {
    logger.error('Seedance fetch error', { path, err: String(err) })
    return { code: -1, message: String(err) }
  }
}

// ─── Video generation ─────────────────────────────────────────────────────────

export interface SeedanceVideoParams {
  prompt: string
  duration: number               // [4, 15] seconds
  aspectRatio?: string           // '9:16' | '16:9' | '1:1'
  // Reference materials (Seedance @素材 syntax)
  firstFrameUrl?: string         // @图片N 为首帧
  lastFrameUrl?: string          // @图片N 为尾帧
  characterImageUrl?: string     // @图片N 作为角色参考 (virtual/anime only)
  referenceVideoUrl?: string     // @视频N 参考运镜/动作/画风/特效
  referenceVideoType?: 'camera' | 'motion' | 'style' | 'effects'
  audioUrl?: string              // @音频N 用于配乐
  generateAudio?: boolean        // default true
  callbackUrl?: string
}

/**
 * Submit a video generation task to Seedance.
 * Returns taskId on success, error message on failure.
 */
export async function submitSeedanceVideo(params: SeedanceVideoParams): Promise<SeedanceSubmitResult> {
  if (!API_KEY) {
    return { taskId: null, error: 'Seedance API not available (no API key)' }
  }

  // Build @素材 reference string for multimodal prompt
  const materialRefs: string[] = []
  const imageList: object[] = []
  const videoList: object[] = []
  const audioList: object[] = []

  if (params.firstFrameUrl) {
    imageList.push({ url: params.firstFrameUrl, role: 'first_frame' })
    materialRefs.push(`@图片${imageList.length} 为首帧`)
  } else if (params.characterImageUrl) {
    imageList.push({ url: params.characterImageUrl, role: 'character' })
    materialRefs.push(`@图片${imageList.length} 作为角色参考`)
  }

  if (params.lastFrameUrl) {
    imageList.push({ url: params.lastFrameUrl, role: 'end_frame' })
    materialRefs.push(`@图片${imageList.length} 为尾帧`)
  }

  if (params.referenceVideoUrl) {
    videoList.push({ url: params.referenceVideoUrl })
    const typeLabel: Record<string, string> = {
      camera: '运镜', motion: '动作', style: '画风', effects: '特效',
    }
    materialRefs.push(`@视频${videoList.length} 参考${typeLabel[params.referenceVideoType ?? 'camera']}`)
  }

  if (params.audioUrl) {
    audioList.push({ url: params.audioUrl })
    materialRefs.push(`@音频${audioList.length} 用于配乐`)
  }

  const fullPrompt = materialRefs.length > 0
    ? `${materialRefs.join('，')}。${params.prompt}`
    : params.prompt

  const body: Record<string, unknown> = {
    model: 'seedance-2.0',
    prompt: fullPrompt,
    duration: String(params.duration),
    aspect_ratio: params.aspectRatio ?? '9:16',
    generate_audio: params.generateAudio ?? true,
  }

  if (imageList.length > 0) body.image_list = imageList
  if (videoList.length > 0) body.video_list = videoList
  if (audioList.length > 0) body.audio_list = audioList
  if (params.callbackUrl)    body.callback_url = params.callbackUrl

  // TODO: Confirm endpoint path once Volcengine publishes the API spec.
  // Speculative path based on Volcengine visual API conventions:
  const resp = await seedanceFetch('/v1/videos/seedance', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Record<string, unknown>

  const taskId = (resp?.data as Record<string, unknown>)?.task_id as string
    ?? resp?.task_id as string
    ?? null

  if (!taskId) {
    logger.warn('Seedance returned no task_id', { resp: JSON.stringify(resp).slice(0, 200) })
    return { taskId: null, error: (resp?.message as string) ?? 'No task_id returned' }
  }

  logger.info('Seedance task submitted', { taskId })
  return { taskId }
}

// ─── Task status query ────────────────────────────────────────────────────────

export async function getSeedanceTaskStatus(taskId: string): Promise<{
  status: 'pending' | 'processing' | 'done' | 'failed'
  videoUrl?: string
  error?: string
}> {
  if (!API_KEY) return { status: 'failed', error: 'Seedance API not available' }

  const resp = await seedanceFetch(`/v1/videos/seedance/${taskId}`) as Record<string, unknown>
  const data = resp?.data as Record<string, unknown> | undefined
  const taskStatus = data?.task_status as string | undefined

  if (taskStatus === 'succeed') {
    const videos = (data?.task_result as Record<string, unknown>)?.videos as Array<{ url: string }> | undefined
    return { status: 'done', videoUrl: videos?.[0]?.url }
  }
  if (taskStatus === 'failed') {
    return { status: 'failed', error: (data?.task_status_msg as string) ?? 'Generation failed' }
  }
  if (taskStatus === 'processing' || taskStatus === 'submitted') {
    return { status: 'processing' }
  }
  return { status: 'pending' }
}

// ─── Video extension (帧链式 for Seedance) ───────────────────────────────────

/**
 * Extend an existing Seedance-generated video forward or backward.
 * This is Seedance's native frame-chaining mechanism.
 */
export async function extendSeedanceVideo(params: {
  videoUrl: string
  extensionSeconds: number    // [4, 15]
  direction?: 'forward' | 'backward'
  prompt?: string
  callbackUrl?: string
}): Promise<SeedanceSubmitResult> {
  if (!API_KEY) return { taskId: null, error: 'Seedance API not available' }

  const dirLabel = params.direction === 'backward' ? '向前延长' : '向后延长'
  const prompt = `将@视频1 ${dirLabel} ${params.extensionSeconds}s${params.prompt ? `，${params.prompt}` : ''}`

  const body: Record<string, unknown> = {
    model: 'seedance-2.0',
    prompt,
    video_list: [{ url: params.videoUrl }],
    duration: String(params.extensionSeconds),
    generate_audio: true,
  }
  if (params.callbackUrl) body.callback_url = params.callbackUrl

  const resp = await seedanceFetch('/v1/videos/seedance/extend', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as Record<string, unknown>

  const taskId = (resp?.data as Record<string, unknown>)?.task_id as string ?? null
  return taskId
    ? { taskId }
    : { taskId: null, error: (resp?.message as string) ?? 'No task_id returned' }
}
