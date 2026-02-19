import { describe, it, expect } from 'vitest'
import { CREDIT_COSTS, CREDIT_PACKAGES, getCallbackUrl } from '@/lib/config'

describe('CREDIT_COSTS', () => {
  it('所有 job 类型均有积分费用定义', () => {
    const jobTypes = ['script', 'podcast', 'edu', 'anime', 'story', 'remix', 'link'] as const
    for (const type of jobTypes) {
      expect(CREDIT_COSTS[type]).toBeTypeOf('number')
      expect(CREDIT_COSTS[type]).toBeGreaterThan(0)
    }
  })

  it('积分费用为正整数', () => {
    for (const [key, val] of Object.entries(CREDIT_COSTS)) {
      expect(Number.isInteger(val), `${key} 应为整数`).toBe(true)
      expect(val, `${key} 应大于 0`).toBeGreaterThan(0)
    }
  })

  it('anime 是最高费用（50积分）', () => {
    const max = Math.max(...Object.values(CREDIT_COSTS))
    expect(CREDIT_COSTS.anime).toBe(max)
    expect(CREDIT_COSTS.anime).toBe(50)
  })

  it('remix 是 job 类型中最低费用（5积分）', () => {
    const jobCosts = [
      CREDIT_COSTS.script, CREDIT_COSTS.podcast, CREDIT_COSTS.edu,
      CREDIT_COSTS.anime, CREDIT_COSTS.story, CREDIT_COSTS.remix, CREDIT_COSTS.link,
    ]
    const min = Math.min(...jobCosts)
    expect(CREDIT_COSTS.remix).toBe(min)
    expect(CREDIT_COSTS.remix).toBe(5)
  })
})

describe('CREDIT_PACKAGES', () => {
  it('所有套餐均有 credits、bonus、price、name', () => {
    for (const [id, pkg] of Object.entries(CREDIT_PACKAGES)) {
      expect(pkg.credits, `${id}.credits`).toBeGreaterThan(0)
      expect(pkg.bonus, `${id}.bonus`).toBeGreaterThanOrEqual(0)
      expect(pkg.price, `${id}.price`).toBeGreaterThan(0)
      expect(pkg.name, `${id}.name`).toBeTruthy()
    }
  })

  it('套餐按积分量升序排列', () => {
    const amounts = Object.values(CREDIT_PACKAGES).map(p => p.credits)
    const sorted = [...amounts].sort((a, b) => a - b)
    expect(amounts).toEqual(sorted)
  })

  it('专业包含 bonus 积分', () => {
    expect(CREDIT_PACKAGES.pro.bonus).toBeGreaterThan(0)
    expect(CREDIT_PACKAGES.team.bonus).toBeGreaterThan(0)
  })
})

describe('getCallbackUrl', () => {
  it('返回包含 /api/webhooks/kling 的 URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com'
    const url = getCallbackUrl()
    expect(url).toContain('/api/webhooks/kling')
    expect(url).toContain('example.com')
  })
})
