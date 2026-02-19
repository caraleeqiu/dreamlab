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
 * 将单个 clip 标记为提交失败，并检查整个 job 是否全部完成/失败。
 * 用于视频提交阶段（Kling API 返回错误时）立即终结该 clip，
 * 避免其永远卡在 'pending' 或 'submitted' 状态。
 */
export async function failClipAndCheckJob(
  service: ServiceClient,
  jobId: number,
  clipIndex: number,
  errorMsg: string,
): Promise<void> {
  await service
    .from('clips')
    .update({ status: 'failed', error_msg: errorMsg })
    .eq('job_id', jobId)
    .eq('clip_index', clipIndex)

  // Re-check job status: if all clips are now terminal (done/failed), update the job
  const { data: clips } = await service
    .from('clips')
    .select('status')
    .eq('job_id', jobId)
  if (!clips) return

  const allTerminal = clips.every(c => c.status === 'done' || c.status === 'failed')
  if (!allTerminal) return

  const allDone = clips.every(c => c.status === 'done')
  await service
    .from('jobs')
    .update({
      status: allDone ? 'stitching' : 'failed',
      error_msg: allDone ? undefined : '部分切片提交失败',
    })
    .eq('id', jobId)

  // 若 job 以失败告终（提交阶段全部失败），退还积分
  if (!allDone) {
    const { data: job } = await service
      .from('jobs')
      .select('user_id, credit_cost')
      .eq('id', jobId)
      .single()
    if (job?.user_id && job.credit_cost > 0) {
      ;(async () => {
        await service.rpc('add_credits', {
          p_user_id: job.user_id,
          p_amount: job.credit_cost,
          p_reason: `refund:submit_failed:${jobId}`,
        })
      })()
    }
  }
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
