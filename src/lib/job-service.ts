import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

/**
 * 原子扣积分。
 * 返回 null 表示成功；返回 NextResponse 表示失败，route 直接 return 该响应即可。
 */
export async function deductCredits(
  service: ServiceClient,
  userId: string,
  amount: number,
  reason: string,
): Promise<NextResponse | null> {
  const { error } = await service.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  })
  if (error?.message?.includes('insufficient_credits')) {
    return NextResponse.json({ error: `积分不足（需要 ${amount} 积分）` }, { status: 402 })
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return null
}

/**
 * 批量创建 clip 记录（状态初始化为 pending）。
 * scripts 只需包含 index 字段；其余字段由 Kling 回调后更新。
 */
export async function createClipRecords(
  service: ServiceClient,
  jobId: number,
  scripts: Array<{ index: number }>,
) {
  const inserts = scripts.map(clip => ({
    job_id: jobId,
    clip_index: clip.index,
    status: 'pending',
    prompt: '',
  }))
  const { data } = await service.from('clips').insert(inserts).select()
  return data
}
