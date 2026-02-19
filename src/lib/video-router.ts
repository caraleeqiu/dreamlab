import { createLogger } from './logger'

const logger = createLogger('video-router')

// ─── Kling API error code classification ──────────────────────────────────────
//
// These codes mean our Kling ACCOUNT is out of credits/quota.
// No point retrying — block the provider and fail the clip immediately
// rather than leaving it stuck in 'submitted' forever.
const KLING_QUOTA_CODES = new Set([
  1600039,  // Insufficient balance
  1600040,  // Quota / rate limit exceeded
  1600037,  // API limit reached
  1000002,  // Account suspended / no credits
])

export function isKlingQuotaError(resp: unknown): boolean {
  const code = (resp as { code?: number })?.code
  return typeof code === 'number' && KLING_QUOTA_CODES.has(code)
}

export function isKlingApiError(resp: unknown): boolean {
  const code = (resp as { code?: number })?.code
  return typeof code === 'number' && code !== 0
}

export function getKlingErrorMessage(resp: unknown): string {
  return (resp as { message?: string })?.message ?? 'Unknown Kling API error'
}

// ─── Provider availability tracker (in-process, resets on restart) ─────────
//
// When Kling quota is exhausted, block it for 2 hours so subsequent clips
// fail fast instead of burning retry attempts.
//
// When Seedance API becomes available, add 'seedance' as a second provider.
export type VideoProvider = 'kling' | 'seedance'

const _blockedUntil = new Map<VideoProvider, number>() // provider → epoch ms

export function isProviderAvailable(provider: VideoProvider): boolean {
  const until = _blockedUntil.get(provider)
  if (!until) return true
  if (Date.now() >= until) {
    _blockedUntil.delete(provider)
    logger.info('provider unblocked', { provider })
    return true
  }
  return false
}

export function blockProvider(
  provider: VideoProvider,
  durationMs = 2 * 60 * 60 * 1000,  // 2 hours default
): void {
  const until = Date.now() + durationMs
  _blockedUntil.set(provider, until)
  logger.warn('provider blocked', {
    provider,
    durationMin: Math.round(durationMs / 60_000),
    unblockAt: new Date(until).toISOString(),
  })
}

export function getActiveProvider(): VideoProvider {
  if (isProviderAvailable('kling')) return 'kling'
  // Seedance: enabled when SEEDANCE_API_KEY is set and provider not blocked
  if (process.env.SEEDANCE_API_KEY && isProviderAvailable('seedance')) return 'seedance'
  return 'kling'
}

/**
 * Select provider for a specific clip based on:
 * 1. Job-level strategy (all-kling / all-seedance / hybrid)
 * 2. Influencer type (Seedance cannot handle photorealistic human faces)
 * 3. Clip content (character dialogue → Kling; B-roll → Seedance)
 */
export function selectClipProvider(opts: {
  jobStrategy?: 'kling' | 'seedance' | 'hybrid'
  influencerType?: 'human' | 'animal' | 'virtual' | 'brand'
  hasDialogue?: boolean
}): VideoProvider {
  const { jobStrategy = 'kling', influencerType = 'human', hasDialogue = true } = opts

  // human influencer → always Kling (Seedance blocks real faces)
  if (influencerType === 'human') return 'kling'

  if (jobStrategy === 'kling') return 'kling'
  if (jobStrategy === 'seedance' && process.env.SEEDANCE_API_KEY) return 'seedance'

  // Hybrid: character clips (with dialogue) → Kling; scene/B-roll → Seedance
  if (jobStrategy === 'hybrid') {
    if (hasDialogue) return 'kling'
    return process.env.SEEDANCE_API_KEY ? 'seedance' : 'kling'
  }

  return 'kling'
}

// ─── Submission result ────────────────────────────────────────────────────────

export interface SubmitResult {
  taskId: string | null
  provider: VideoProvider
  error?: string
  quotaExhausted?: boolean
}

// ─── classifyKlingResponse ────────────────────────────────────────────────────
//
// Call this after ANY Kling API call (submitImage2Video, submitMultiShotVideo,
// submitSimpleVideo) to get a uniform SubmitResult.
//
// Handles three outcomes:
//   1. taskId present  → success
//   2. quota error     → block provider + return failure
//   3. other API error → return failure (no block)
//
export function classifyKlingResponse(
  resp: unknown,
  provider: VideoProvider = 'kling',
): SubmitResult {
  if (isKlingQuotaError(resp)) {
    blockProvider('kling')
    logger.error('Kling quota exhausted — provider blocked for 2h', {
      code: (resp as { code?: number })?.code,
      message: getKlingErrorMessage(resp),
    })
    return {
      taskId: null,
      provider,
      error: `Kling quota exhausted: ${getKlingErrorMessage(resp)}`,
      quotaExhausted: true,
    }
  }

  if (isKlingApiError(resp)) {
    const msg = getKlingErrorMessage(resp)
    logger.warn('Kling API error', {
      code: (resp as { code?: number })?.code,
      message: msg,
    })
    return { taskId: null, provider, error: msg }
  }

  const taskId = (resp as { data?: { task_id?: string } })?.data?.task_id ?? null
  if (!taskId) {
    const preview = JSON.stringify(resp ?? {}).slice(0, 200)
    logger.warn('Kling returned no task_id', { resp: preview })
    return { taskId: null, provider, error: 'No task_id in Kling response' }
  }

  return { taskId, provider }
}
