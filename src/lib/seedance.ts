/**
 * Seedance 2.0 video generation client
 *
 * Status: API not yet publicly available (2026-02)
 * The web product is live at https://jimeng.jianying.com (即梦)
 * Capabilities (from official manual):
 *   - Multi-modal input: image + video + audio + text via @素材名 syntax
 *   - Duration: 4–15s per generation
 *   - No realistic human face generation (platform policy)
 *   - Best for: scenic B-roll, abstract animation, non-character visual effects
 *
 * When the Volcengine / ByteDance API is released:
 *   1. Set SEEDANCE_API_KEY in .env.local
 *   2. Implement submitSeedanceVideo() below
 *   3. Add /api/webhooks/seedance route (or polling if no webhook support)
 *   4. Update getActiveProvider() in video-router.ts to enable 'seedance'
 *   5. Update checkAndUpdateJobStatus in webhook/kling/route.ts to handle
 *      seedance clips via seedance polling instead of kling getTaskStatus
 */

const SEEDANCE_KEY = process.env.SEEDANCE_API_KEY

export function isSeedanceAvailable(): boolean {
  return !!SEEDANCE_KEY
}

// ─── Submission result shape (mirrors Kling's classifyKlingResponse output) ─

export interface SeedanceSubmitResult {
  taskId: string | null
  error?: string
}

/**
 * Generate a scene video with Seedance.
 * No character reference image — pure scene/text-to-video.
 *
 * @throws when Seedance API is not available
 */
export async function submitSeedanceVideo(_params: {
  prompt: string
  duration: number              // 4–15 seconds
  aspectRatio?: string
  referenceImageUrl?: string    // optional scene reference (not character)
  callbackUrl?: string
}): Promise<SeedanceSubmitResult> {
  if (!SEEDANCE_KEY) {
    // Fallback: signal that Seedance is unavailable.
    // The caller (route handler) should fall back to Kling.
    return { taskId: null, error: 'Seedance API not available yet' }
  }

  // TODO: implement when Volcengine/ByteDance publishes the REST API
  // Expected endpoint (speculative based on Volcengine SDK patterns):
  //   POST https://visual.volcengineapi.com/?Action=SubmitVideoGenTask&Version=2024-01-01
  //   Body: { prompt, duration, aspect_ratio, ... }
  // Reference: https://www.volcengine.com/docs/6893
  throw new Error('Seedance API implementation pending — API not yet released')
}

/**
 * Poll a Seedance task for completion.
 * @throws when Seedance API is not available
 */
export async function getSeedanceTaskStatus(_taskId: string): Promise<{
  status: 'pending' | 'processing' | 'done' | 'failed'
  videoUrl?: string
  error?: string
}> {
  if (!SEEDANCE_KEY) {
    return { status: 'failed', error: 'Seedance API not available' }
  }

  // TODO: implement when API is available
  throw new Error('Seedance API implementation pending')
}
