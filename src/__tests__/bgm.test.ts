import { describe, it, expect } from 'vitest'
import { dominantBgm, BGM_MAP } from '@/lib/bgm'

describe('BGM utils', () => {
  it('returns null for empty array', () => {
    expect(dominantBgm([])).toBe(null)
  })

  it('returns most common BGM style', () => {
    expect(dominantBgm(['轻松欢快', '轻松欢快', '科技感'])).toBe('轻松欢快')
  })

  it('returns single value when only one style exists', () => {
    expect(dominantBgm(['励志'])).toBe('励志')
  })

  it('handles ties by returning first encountered maximum', () => {
    // When there's a tie, Object.entries iteration order determines winner
    const result = dominantBgm(['励志', '科技感', '励志', '科技感'])
    expect(['励志', '科技感']).toContain(result)
  })

  it('ignores undefined values', () => {
    expect(dominantBgm([undefined, '励志', undefined, '励志'])).toBe('励志')
  })

  it('returns null when all values are undefined', () => {
    expect(dominantBgm([undefined, undefined, undefined])).toBe(null)
  })

  it('handles mixed Chinese and English styles independently', () => {
    // 'cheerful' and '轻松欢快' are separate keys in the count
    const result = dominantBgm(['cheerful', 'cheerful', '轻松欢快'])
    expect(result).toBe('cheerful')
  })
})

describe('BGM_MAP', () => {
  it('contains all required Chinese styles', () => {
    const requiredStyles = ['轻松欢快', '科技感', '励志', '悬疑', '温馨', '紧张']
    for (const style of requiredStyles) {
      expect(BGM_MAP[style], `Missing style: ${style}`).toBeTruthy()
    }
  })

  it('contains all required English styles', () => {
    const requiredStyles = ['cheerful', 'tech', 'motivational', 'suspense', 'warm', 'tense']
    for (const style of requiredStyles) {
      expect(BGM_MAP[style], `Missing style: ${style}`).toBeTruthy()
    }
  })

  it('all URLs are valid http(s) URLs', () => {
    for (const [style, url] of Object.entries(BGM_MAP)) {
      expect(url, `Invalid URL for ${style}`).toMatch(/^https?:\/\//)
    }
  })

  it('Chinese and English aliases map to same URLs', () => {
    expect(BGM_MAP['轻松欢快']).toBe(BGM_MAP['cheerful'])
    expect(BGM_MAP['科技感']).toBe(BGM_MAP['tech'])
    expect(BGM_MAP['励志']).toBe(BGM_MAP['motivational'])
    expect(BGM_MAP['悬疑']).toBe(BGM_MAP['suspense'])
    expect(BGM_MAP['温馨']).toBe(BGM_MAP['warm'])
    expect(BGM_MAP['紧张']).toBe(BGM_MAP['tense'])
  })
})
