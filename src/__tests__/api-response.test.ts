import { describe, it, expect } from 'vitest'
import { apiError } from '@/lib/api-response'

describe('apiError', () => {
  it('返回 JSON 响应，包含 error 字段', async () => {
    const res = apiError('Something went wrong')
    const body = await res.json()
    expect(body).toHaveProperty('error', 'Something went wrong')
  })

  it('默认 status 为 500', () => {
    const res = apiError('Server error')
    expect(res.status).toBe(500)
  })

  it('可以自定义 status', () => {
    expect(apiError('Unauthorized', 401).status).toBe(401)
    expect(apiError('Not found', 404).status).toBe(404)
    expect(apiError('Payment required', 402).status).toBe(402)
    expect(apiError('Bad request', 400).status).toBe(400)
  })

  it('响应体只有 error 字段，无 message 字段（统一格式）', async () => {
    const res = apiError('test error')
    const body = await res.json()
    expect(body).not.toHaveProperty('message')
    expect(Object.keys(body)).toEqual(['error'])
  })
})
