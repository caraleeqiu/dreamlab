import { describe, it, expect } from 'vitest'
import { groupClips } from '@/lib/video-utils'
import type { ScriptClip } from '@/types'

// 最小化 ScriptClip 构造帮助函数
function clip(index: number, duration: number): ScriptClip {
  return { index, duration, speaker: 'host', dialogue: '', shot_description: '' }
}

describe('groupClips', () => {
  it('空数组返回空数组', () => {
    expect(groupClips([])).toEqual([])
  })

  it('单个 clip 返回一组', () => {
    const result = groupClips([clip(0, 5)])
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(1)
  })

  it('总时长 ≤15s 且数量 ≤6 时放同一组', () => {
    const clips = [clip(0, 5), clip(1, 5), clip(2, 5)]   // 15s total
    const result = groupClips(clips)
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(3)
  })

  it('超过 15s 时分为两组', () => {
    // 3×5=15 → 同组; 第4个(5s) → 超过15 → 新组
    const clips = [clip(0, 5), clip(1, 5), clip(2, 5), clip(3, 5)]
    const result = groupClips(clips)
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveLength(3)
    expect(result[1]).toHaveLength(1)
  })

  it('超过 6 个 shot 时强制分组（不论总时长）', () => {
    // 7 个 1s clip：前 6 个一组，第 7 个新组
    const clips = Array.from({ length: 7 }, (_, i) => clip(i, 1))
    const result = groupClips(clips)
    expect(result).toHaveLength(2)
    expect(result[0]).toHaveLength(6)
    expect(result[1]).toHaveLength(1)
  })

  it('clip.duration 缺失时默认 5s', () => {
    const noDuration = [
      { index: 0, speaker: 'host', dialogue: '', shot_description: '' } as ScriptClip,
      { index: 1, speaker: 'host', dialogue: '', shot_description: '' } as ScriptClip,
      { index: 2, speaker: 'host', dialogue: '', shot_description: '' } as ScriptClip,
    ]
    // 3×5=15 → 同一组
    const result = groupClips(noDuration)
    expect(result).toHaveLength(1)
  })

  it('单个超长 clip（>15s）独占一组', () => {
    // 第一个 clip 本身就 20s，会先加入 current，下一个 clip 触发分组
    const clips = [clip(0, 20), clip(1, 5)]
    const result = groupClips(clips)
    expect(result).toHaveLength(2)
    expect(result[0][0].duration).toBe(20)
  })

  it('所有 clip 的 index 在分组后保留不变', () => {
    const clips = Array.from({ length: 10 }, (_, i) => clip(i, 3))
    const result = groupClips(clips)
    const allClips = result.flat()
    expect(allClips.map(c => c.index)).toEqual([0,1,2,3,4,5,6,7,8,9])
  })
})
