import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BUILTIN_INFLUENCERS } from '@/lib/influencers-seed'

describe('BUILTIN_INFLUENCERS 种子数据', () => {
  it('所有内置网红都有必需字段', () => {
    for (const inf of BUILTIN_INFLUENCERS) {
      expect(inf.slug).toBeTruthy()
      expect(inf.name).toBeTruthy()
      expect(inf.is_builtin).toBe(true)
      expect(['human', 'animal', 'virtual', 'brand']).toContain(inf.type)
      expect(inf.tagline).toBeTruthy()
      expect(Array.isArray(inf.personality)).toBe(true)
      expect(Array.isArray(inf.domains)).toBe(true)
      expect(inf.voice_prompt).toBeTruthy()
    }
  })

  it('所有 slug 唯一', () => {
    const slugs = BUILTIN_INFLUENCERS.map(i => i.slug)
    const uniqueSlugs = new Set(slugs)
    expect(slugs.length).toBe(uniqueSlugs.size)
  })

  it('所有内置网红都有图片 URL', () => {
    for (const inf of BUILTIN_INFLUENCERS) {
      expect(inf.frontal_image_url, `${inf.name} 缺少 frontal_image_url`).toBeTruthy()
      // 支持本地路径 /influencers/xxx.png 或 R2 URL https://xxx.r2.dev/influencers/xxx.png
      expect(inf.frontal_image_url).toMatch(/^(\/influencers\/|https:\/\/.*\.r2\.dev\/influencers\/).*\.png$/)
    }
  })

  it('chat_style 只能是允许的值', () => {
    const validStyles = ['dominant', 'supportive', 'debate', undefined]
    for (const inf of BUILTIN_INFLUENCERS) {
      expect(validStyles, `${inf.name} 的 chat_style 无效: ${inf.chat_style}`).toContain(inf.chat_style)
    }
  })

  it('动物类网红至少 2 个', () => {
    const animals = BUILTIN_INFLUENCERS.filter(i => i.type === 'animal')
    expect(animals.length).toBeGreaterThanOrEqual(2)
  })

  it('真人类网红至少 3 个', () => {
    const humans = BUILTIN_INFLUENCERS.filter(i => i.type === 'human')
    expect(humans.length).toBeGreaterThanOrEqual(3)
  })

  it('虚拟角色网红至少 3 个', () => {
    const virtuals = BUILTIN_INFLUENCERS.filter(i => i.type === 'virtual')
    expect(virtuals.length).toBeGreaterThanOrEqual(3)
  })

  it('品牌 IP 网红至少 1 个', () => {
    const brands = BUILTIN_INFLUENCERS.filter(i => i.type === 'brand')
    expect(brands.length).toBeGreaterThanOrEqual(1)
  })
})

describe('网红数据验证', () => {
  it('personality 数组非空', () => {
    for (const inf of BUILTIN_INFLUENCERS) {
      expect(inf.personality.length, `${inf.name} 的 personality 为空`).toBeGreaterThan(0)
    }
  })

  it('domains 数组非空', () => {
    for (const inf of BUILTIN_INFLUENCERS) {
      expect(inf.domains.length, `${inf.name} 的 domains 为空`).toBeGreaterThan(0)
    }
  })

  it('voice_prompt 包含语言特征描述', () => {
    for (const inf of BUILTIN_INFLUENCERS) {
      // voice_prompt 应该包含 voice 或 sound 相关词汇
      const hasVoiceDesc = /voice|tone|pitch|pace|sound|speak/i.test(inf.voice_prompt)
      expect(hasVoiceDesc, `${inf.name} 的 voice_prompt 缺少语音描述`).toBe(true)
    }
  })

  it('tagline 不超过 50 个字符', () => {
    for (const inf of BUILTIN_INFLUENCERS) {
      expect(inf.tagline.length, `${inf.name} 的 tagline 过长`).toBeLessThanOrEqual(50)
    }
  })
})

describe('特定网红检查', () => {
  it('Sable 存在且为动物类', () => {
    const sable = BUILTIN_INFLUENCERS.find(i => i.slug === 'sable')
    expect(sable).toBeTruthy()
    expect(sable?.type).toBe('animal')
  })

  it('小花存在且为动物类', () => {
    const xiaohua = BUILTIN_INFLUENCERS.find(i => i.slug === 'xiaohua')
    expect(xiaohua).toBeTruthy()
    expect(xiaohua?.type).toBe('animal')
  })

  it('Loopy 存在且为品牌类', () => {
    const loopy = BUILTIN_INFLUENCERS.find(i => i.slug === 'loopy')
    expect(loopy).toBeTruthy()
    expect(loopy?.type).toBe('brand')
  })

  it('Gintoki 存在且为虚拟角色', () => {
    const gintoki = BUILTIN_INFLUENCERS.find(i => i.slug === 'gintoki')
    expect(gintoki).toBeTruthy()
    expect(gintoki?.type).toBe('virtual')
  })
})
