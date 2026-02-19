import type { ScriptClip } from '@/types'

/**
 * 将 clip 列表按 Kling multi-shot 限制分组：
 * - 每组最多 6 个 shot
 * - 每组总时长不超过 15 秒
 *
 * 用于动漫营销（anime）场景，将长脚本拆分为多次 Kling API 调用。
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
