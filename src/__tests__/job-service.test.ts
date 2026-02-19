import { describe, it, expect, vi } from 'vitest'
import { deductCredits, createClipRecords } from '@/lib/job-service'

// ─── mock Supabase service client ────────────────────────────────────────────
function makeServiceMock(rpcResult: { error: { message: string } | null }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [] }),
      }),
    }),
  } as unknown as Parameters<typeof deductCredits>[0]
}

// ─── deductCredits ────────────────────────────────────────────────────────────
describe('deductCredits', () => {
  it('积分充足时返回 null（表示成功）', async () => {
    const service = makeServiceMock({ error: null })
    const result = await deductCredits(service, 'user-123', 15, 'script')
    expect(result).toBeNull()
  })

  it('积分不足时返回 402 响应', async () => {
    const service = makeServiceMock({ error: { message: 'insufficient_credits' } })
    const result = await deductCredits(service, 'user-123', 15, 'script')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(402)
    const body = await result!.json()
    expect(body.error).toContain('积分不足')
    expect(body.error).toContain('15')
  })

  it('积分不足错误消息包含需求积分数', async () => {
    const service = makeServiceMock({ error: { message: 'insufficient_credits' } })
    const result = await deductCredits(service, 'user-123', 50, 'anime')
    const body = await result!.json()
    expect(body.error).toContain('50')
  })

  it('其他 DB 错误时返回 500 响应', async () => {
    const service = makeServiceMock({ error: { message: 'connection timeout' } })
    const result = await deductCredits(service, 'user-123', 15, 'script')
    expect(result).not.toBeNull()
    expect(result!.status).toBe(500)
    const body = await result!.json()
    expect(body.error).toContain('connection timeout')
  })

  it('调用 deduct_credits RPC 时传入正确参数', async () => {
    const service = makeServiceMock({ error: null })
    await deductCredits(service, 'user-abc', 20, 'podcast')
    expect(service.rpc).toHaveBeenCalledWith('deduct_credits', {
      p_user_id: 'user-abc',
      p_amount: 20,
      p_reason: 'podcast',
    })
  })
})

// ─── createClipRecords ────────────────────────────────────────────────────────
describe('createClipRecords', () => {
  it('为每个 script 片段创建 clip 记录', async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] }),
    })
    const service = {
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as unknown as Parameters<typeof createClipRecords>[0]

    const scripts = [{ index: 0 }, { index: 1 }, { index: 2 }]
    await createClipRecords(service, 42, scripts)

    expect(insertMock).toHaveBeenCalledWith([
      { job_id: 42, clip_index: 0, status: 'pending', prompt: '' },
      { job_id: 42, clip_index: 1, status: 'pending', prompt: '' },
      { job_id: 42, clip_index: 2, status: 'pending', prompt: '' },
    ])
  })

  it('所有 clip 初始状态为 pending，prompt 为空字符串', async () => {
    let capturedInserts: unknown[] = []
    const service = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockImplementation((data) => {
          capturedInserts = data
          return { select: vi.fn().mockResolvedValue({ data: [] }) }
        }),
      }),
    } as unknown as Parameters<typeof createClipRecords>[0]

    await createClipRecords(service, 1, [{ index: 0 }, { index: 1 }])

    for (const clip of capturedInserts as Array<Record<string, unknown>>) {
      expect(clip.status).toBe('pending')
      expect(clip.prompt).toBe('')
    }
  })
})
