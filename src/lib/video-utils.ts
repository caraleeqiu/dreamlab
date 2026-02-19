import type { ScriptClip } from '@/types'

/**
 * Group script clips into batches for Kling multi-shot API.
 * Constraints: max 6 shots per batch AND max 15s total duration per batch.
 */
export function groupClips(clips: ScriptClip[]): ScriptClip[][] {
  const groups: ScriptClip[][] = []
  let current: ScriptClip[] = []
  let currentDuration = 0

  for (const clip of clips) {
    const d = clip.duration || 5
    if (current.length >= 6 || (currentDuration + d > 15 && current.length > 0)) {
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
