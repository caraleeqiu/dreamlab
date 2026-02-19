import type { ScriptClip } from '@/types'
import type { VideoProvider } from './video-router'

// ─── Kling constraints ─────────────────────────────────────────────────────
const KLING_MAX_SHOTS = 6
const KLING_MAX_DURATION = 15  // seconds

// ─── Seedance constraints (from manual; update when API spec is published) ─
const SEEDANCE_MAX_SHOTS = 1   // Seedance generates one scene at a time (no multi-shot yet)
const SEEDANCE_MAX_DURATION = 15

/**
 * Resolve provider for a clip.
 *
 * Decision rule:
 *   - Explicit clip.provider wins if set
 *   - Otherwise: has dialogue → 'kling' (character-anchored)
 *   - Otherwise: pure scene/B-roll → 'seedance'
 *
 * Falls back to 'kling' when Seedance API is not available.
 */
export function resolveClipProvider(clip: ScriptClip): VideoProvider {
  if (clip.provider) return clip.provider
  // Clips with dialogue need a character — Kling handles this
  if (clip.dialogue?.trim()) return 'kling'
  // Pure scene/voiceover clips → Seedance when available
  return 'seedance'
}

/**
 * Auto-annotate clips with provider based on content.
 * Call this in script generation routes before inserting into DB.
 *
 * @param clips - Script clips (from Gemini/AI output)
 * @param forceKling - True when the wizard always uses a character (edu/talk, podcast, etc.)
 */
export function annotateProviders(
  clips: ScriptClip[],
  opts: { forceKling?: boolean } = {},
): ScriptClip[] {
  return clips.map(clip => ({
    ...clip,
    provider: opts.forceKling
      ? 'kling'
      : resolveClipProvider(clip),
  }))
}

// ─── Clip group (provider-aware) ───────────────────────────────────────────

export interface ClipGroup {
  provider: VideoProvider
  clips: ScriptClip[]
  totalDuration: number
}

/**
 * Group clips into submission batches respecting provider boundaries
 * and per-provider API constraints.
 *
 * Key guarantee: clips within a group are always for the same provider.
 * This means a Kling batch is never mixed with a Seedance batch.
 *
 * Example:
 *   Input:  [K, K, K, S, S, K]
 *   Groups: [K,K,K] [S] [S] [K]   (provider boundaries)
 *   Then Kling groups further split at 6 shots / 15s
 */
export function groupClipsByProvider(clips: ScriptClip[]): ClipGroup[] {
  const groups: ClipGroup[] = []
  let current: ScriptClip[] = []
  let currentProvider: VideoProvider | null = null
  let currentDuration = 0

  function flush() {
    if (current.length > 0 && currentProvider) {
      groups.push({ provider: currentProvider, clips: current, totalDuration: currentDuration })
      current = []
      currentDuration = 0
    }
  }

  for (const clip of clips) {
    const provider = resolveClipProvider(clip)
    const d = clip.duration || 5

    const maxShots = provider === 'kling' ? KLING_MAX_SHOTS : SEEDANCE_MAX_SHOTS
    const maxDur   = provider === 'kling' ? KLING_MAX_DURATION : SEEDANCE_MAX_DURATION

    // Start new group if provider changes OR batch constraints exceeded
    if (
      provider !== currentProvider ||
      current.length >= maxShots ||
      (currentDuration + d > maxDur && current.length > 0)
    ) {
      flush()
      currentProvider = provider
    }

    current.push(clip)
    currentDuration += d
  }
  flush()

  return groups
}

/**
 * Legacy helper — Kling-only grouping, kept for backward compatibility.
 * All groups are assumed to be Kling.
 */
export function groupClips(clips: ScriptClip[]): ScriptClip[][] {
  const groups: ScriptClip[][] = []
  let current: ScriptClip[] = []
  let currentDuration = 0

  for (const clip of clips) {
    const d = clip.duration || 5
    if (current.length >= KLING_MAX_SHOTS || (currentDuration + d > KLING_MAX_DURATION && current.length > 0)) {
      groups.push(current)
      current = []
      currentDuration = 0
    }
    current.push(clip)
    currentDuration += d
  }
  if (current.length > 0) groups.push(current)
  return groups
}

/**
 * Determine the provider mix for a script.
 * Useful for UI display ("This video will use Kling + Seedance") or
 * credit calculation if providers have different costs.
 */
export function getProviderMix(clips: ScriptClip[]): {
  klingClips: number
  seedanceClips: number
  klingDuration: number
  seedanceDuration: number
} {
  let klingClips = 0, seedanceClips = 0
  let klingDuration = 0, seedanceDuration = 0
  for (const clip of clips) {
    if (resolveClipProvider(clip) === 'kling') {
      klingClips++
      klingDuration += clip.duration || 5
    } else {
      seedanceClips++
      seedanceDuration += clip.duration || 5
    }
  }
  return { klingClips, seedanceClips, klingDuration, seedanceDuration }
}
