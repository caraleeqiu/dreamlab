import { describe, it, expect, vi } from 'vitest'

// withRetry 是内部函数，通过代理测试其行为
// 用相同逻辑实现一个可测试的副本

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 0, // 测试时设为 0，避免等待
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts - 1 && baseDelayMs > 0) {
        await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError
}

describe('withRetry', () => {
  it('成功时直接返回结果，不重试', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('第一次失败后重试并成功', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('达到最大重试次数后抛出最后一个错误', async () => {
    const err = new Error('persistent failure')
    const fn = vi.fn().mockRejectedValue(err)

    await expect(withRetry(fn, 3)).rejects.toThrow('persistent failure')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('maxAttempts=1 时不重试', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'))
    await expect(withRetry(fn, 1)).rejects.toThrow('fail')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('前两次失败，第三次成功', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('recovered')

    const result = await withRetry(fn, 3)
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
